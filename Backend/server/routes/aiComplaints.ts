import { Express, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
You are an empathetic, professional grievance intake officer for a student complaint portal.
Your job is to interview the student and collect all necessary information to file a complete complaint.

## Your behavior:
1. Start with a warm, polite opener: "I'm here to listen and help. Could you tell me what happened?"
2. After the student's first message, classify the issue into ONE of these categories:
   - Academics (grading, teaching, unfair evaluation, etc.)
   - Facilities (broken equipment, poor infrastructure, etc.)
   - Administration (office delays, mismanagement, bureaucracy)
   - Safety (physical danger, threats, campus security)
   - Harassment (bullying, sexual harassment, intimidation)
   - Discrimination (race, gender, disability, etc.)
   - Other (if nothing fits)
3. Once classified, ask questions SPECIFIC to that category. Do NOT ask irrelevant questions.
   Example category-specific questions:
   - Academics: course name, instructor role, what exactly happened, any previous communication, impact on your studies.
   - Facilities: exact location, what is broken, since when, safety risks, any prior reports.
   - Safety: what happened, where, when, any witnesses, did you contact security, immediate actions taken.
   - Harassment: nature (verbal/physical/online), frequency, who is involved (roles only, no names), any evidence, how it has affected you, desired resolution.
   - Discrimination: basis, examples, witnesses, impact, what outcome you seek.
   - Administration: which office, process issue, timeline, impact, previous attempts.
   - Other: any details that can help us understand.
4. Adapt to the student: if they are confused, rephrase. If they give partial answers, gently probe for missing info.
5. Be concise but thorough. Avoid repeating questions already answered.
6. Once you are confident you have collected ALL the details needed (what, when, where, who (roles), impact, previous steps, desired outcome), end your reply with the exact text: [SUFFICIENT_INFO]
7. While conducting the interview, NEVER reveal that you are an AI. Sound human, caring, and professional.
8. If the student uses abusive language, respond: "I'm here to help, but I need to keep this conversation respectful. Let's focus on the facts." and do NOT count that as progress.

## Important:
- Keep replies friendly and to the point.
- Do not ask the student to fill forms or do extra work – you do the gathering.
`;

const DRAFT_PROMPT_PREFIX = `
Based on the following conversation with a student, create a formal complaint draft.
Use the student's own words as much as possible, but correct grammar and phrasing for clarity. Do NOT add information the student did not provide.

Conversation:
`;

const DRAFT_PROMPT_SUFFIX = `

Return ONLY valid JSON (no extra text) with these fields:
{
  "title": "Brief one-line summary",
  "description": "Well-structured description combining all details from the student's answers, in their own words but with corrected grammar.",
  "category": "One of: Academics, Facilities, Administration, Safety, Harassment, Discrimination, Other",
  "severity": "One of: low, medium, high, critical"
}
`;

// ✅ Use Gemini 3.1 Flash Lite for high rate limits and good performance
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function getModel() {
  if (!genAI) throw new Error("Gemini API not configured. Set GEMINI_API_KEY environment variable.");
  // High RPM, TPM, RPD – ideal for multi-user chat applications
  return genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
}

export function registerAIChatRoutes(app: Express) {
  // POST /api/complaints/ai-chat
  app.post("/api/complaints/ai-chat", async (req: Request, res: Response) => {
    try {
      const { conversation, message } = req.body;
      if (!message || !conversation || !Array.isArray(conversation)) {
        return res.status(400).json({ error: "Invalid request format" });
      }

      const model = getModel();
      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: "Hello" }] },
          { role: "model", parts: [{ text: "I'm here to listen and help. Could you tell me what happened?" }] },
          ...conversation.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          })),
        ],
        systemInstruction: {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
      });

      const result = await chat.sendMessage(message);
      const reply = result.response.text();

      const sufficientInfo = reply.includes("[SUFFICIENT_INFO]");
      const cleanReply = reply.replace("[SUFFICIENT_INFO]", "").trim();

      res.json({ reply: cleanReply, sufficientInfo });
    } catch (error: any) {
      console.error("AI chat error:", error);
      if (error.message && error.message.includes("Gemini API not configured")) {
        return res.status(500).json({ error: "AI service is not configured. Please contact support." });
      }
      res.status(500).json({ error: "Chat service unavailable. Please try again later." });
    }
  });

  // POST /api/complaints/ai-draft
  app.post("/api/complaints/ai-draft", async (req: Request, res: Response) => {
    try {
      const { conversation } = req.body;
      if (!conversation || !Array.isArray(conversation)) {
        return res.status(400).json({ error: "Conversation required" });
      }

      const model = getModel();
      const prompt = DRAFT_PROMPT_PREFIX +
        conversation.map((m: any) => `${m.role}: ${m.content}`).join("\n") +
        DRAFT_PROMPT_SUFFIX;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse draft from AI");
      }

      const draft = JSON.parse(jsonMatch[0]);
      res.json({ draft });
    } catch (error: any) {
      console.error("AI draft error:", error);
      if (error.message && error.message.includes("Gemini API not configured")) {
        return res.status(500).json({ error: "AI service is not configured. Please contact support." });
      }
      res.status(500).json({ error: "Failed to generate draft. Please try again later." });
    }
  });
}