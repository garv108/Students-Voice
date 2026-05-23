import { Express, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
You are an empathetic, professional grievance intake officer for a student complaint portal.
Your job is to interview the student and collect all necessary information to file a complete complaint.

## Core rule: ONE short question at a time
- After the student speaks, acknowledge what they said in one brief sentence.
- Then ask exactly ONE simple, direct follow-up question.
- Never ask multiple questions at once. Never use numbered lists.
- Keep your entire reply to 1–2 sentences. Be warm but concise.

## Process
1. Start with: "I'm here to listen and help. Could you tell me what happened?"
2. After the student's first description, silently classify the issue into one of these categories:
   Academics, Facilities, Administration, Safety, Harassment, Discrimination, Other.
3. Ask ONE question relevant to that category. Adapt based on what the student has already said.
   For example, if they mention a broken fountain (Facilities): "When did you first notice it stopped working?"
   Or if they mention a hostile instructor (Academics): "Which course does this relate to?"
4. Continue one question at a time, building a full picture:
   - What exactly happened?
   - When and where did it occur?
   - Who is involved (roles only, no names)?
   - What impact has it had on you?
   - Have you tried to resolve it yourself? How?
   - What outcome are you hoping for?
5. If the student seems confused, rephrase your question simply.
6. Once you have all the necessary details, end your reply with the exact text: [SUFFICIENT_INFO]
7. Never reveal you are an AI. Sound human, caring, and professional.
8. If the student uses abusive language, respond with: "I'm here to help, but I need to keep this conversation respectful. Let's focus on the facts." and do not count that as progress.
`;

const DRAFT_PROMPT_PREFIX = `
Based on the following conversation with a student, create a formal complaint draft.
Use the student's own words as much as possible, but correct grammar and phrasing for clarity.
Do NOT add information the student did not provide.

Conversation:
`;

const DRAFT_PROMPT_SUFFIX = `

Return ONLY valid JSON (no extra text) with these fields:
{
  "title": "Brief one-line summary of the complaint",
  "description": "A detailed, structured summary of the incident. Use BULLET POINTS (each starting with '- ') to list all relevant facts, timeline, impact, involved parties (roles only), and the student's desired outcome. Be thorough – include every detail the student shared. Do NOT write long paragraphs.",
  "category": "One of: Academics, Facilities, Administration, Safety, Harassment, Discrimination, Other",
  "severity": "One of: low, medium, high, critical"
}
`;

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function getModel() {
  if (!genAI) throw new Error("Gemini API not configured. Set GEMINI_API_KEY environment variable.");
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