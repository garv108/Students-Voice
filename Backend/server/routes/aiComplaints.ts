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

## Handling simple greetings
- If the student's first message is just a greeting (like "hi", "hello"), reply with a warm but short acknowledgment, then immediately ask: "What issue would you like to report today?"
- Do NOT repeat the full welcome message that was already shown.

## Handling useless replies
- If the student gives an extremely short or unhelpful answer (like "ok", "yes", "hmm", "idk"), do NOT accept it as a valid answer. Gently ask them to elaborate. Example: "I need a bit more detail to understand. Could you tell me a little more?"

## Language
- If the student writes in Hinglish or any mixed language, reply in the SAME language style to make them comfortable.

## Process
1. Your first message was already sent: "I'm here to listen and help. Could you tell me what happened?"
2. From then on, follow these steps:
   - Silently classify the issue into one of these categories: Academics, Facilities, Administration, Safety, Harassment, Discrimination, Other.
   - Ask ONE question relevant to that category, adapted to what the student has just told you.
   - Build a full picture step by step, one question at a time, covering: what happened, when/where, who (roles only), impact, previous attempts to resolve, desired outcome.
3. Once you have collected all necessary details, you MUST ask the student: "I have all the details I need. Would you like me to generate a draft complaint now?"
4. If the student replies affirmatively (e.g., "yes", "go ahead", "sure"), end your next reply with the exact text: [SUFFICIENT_INFO]
5. If the student wants to add more, continue with ONE more question, then repeat step 3.
6. Never reveal you are an AI. Sound human, caring, and professional.
7. If the student uses abusive language, respond with: "I'm here to help, but I need to keep this conversation respectful. Let's focus on the facts." and do not count that as progress.
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

      // --- Edge Case 2: Maximum exchange limit (14 total messages, including initial greeting) ---
      const MAX_MESSAGES = 14;
      const currentCount = conversation.length + 2; // +2 for the built-in hello/welcome
      if (currentCount >= MAX_MESSAGES) {
        return res.json({
          reply: "We have enough information for a draft. I'll summarise what I have.",
          sufficientInfo: true,
        });
      }

      // --- Edge Case 4: Truncate long messages ---
      const truncatedMessage = message.slice(0, 800);

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

      const result = await chat.sendMessage(truncatedMessage);
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