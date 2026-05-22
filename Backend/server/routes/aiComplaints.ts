import { Express, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

// System prompt for the complaint intake assistant
const SYSTEM_PROMPT = `You are a helpful, empathetic complaint intake assistant for a student grievance portal. 
Your job is to ask the student a series of questions (one at a time) to gather all necessary details about their issue.

Ask about:
- What happened? (When, where, how often)
- Who is involved? (Departments, individuals – no names, just roles)
- What impact did it have? (On studies, safety, campus life)
- Did you try to resolve it yourself? How?
- What outcome do you want?

After 4-6 exchanges, when you have enough information, end your reply with the exact flag: [SUFFICIENT_INFO]. 
Otherwise, continue asking the next logical question.

Important rules:
- Never reveal that you are an AI; act as a human intake officer.
- If the user uses abusive language, reply with: "I'm here to help, but I need to keep this conversation respectful. Let's focus on the facts." and do NOT count that exchange as progress.
- Keep replies concise and friendly.`;

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function getModel() {
  if (!genAI) throw new Error("Gemini API not configured");
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

// Endpoint: handle a chat turn
export function registerAIChatRoutes(app: Express) {
  // POST /api/complaints/ai-chat
  app.post("/api/complaints/ai-chat", async (req: Request, res: Response) => {
    try {
      const { conversation, message } = req.body;
      if (!message || !conversation || !Array.isArray(conversation)) {
        return res.status(400).json({ error: "Invalid request format" });
      }

      // Build the conversation history for Gemini
      const model = getModel();
      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: "Hello" }] },
          { role: "model", parts: [{ text: "Welcome! I'll help you file a complaint. Let's start by describing what happened." }] },
          ...conversation.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          })),
        ],
        systemInstruction: SYSTEM_PROMPT,
      });

      const result = await chat.sendMessage(message);
      const reply = result.response.text();

      // Check if Gemini flagged sufficient info
      const sufficientInfo = reply.includes("[SUFFICIENT_INFO]");
      // Clean the flag from the display text
      const cleanReply = reply.replace("[SUFFICIENT_INFO]", "").trim();

      res.json({
        reply: cleanReply,
        sufficientInfo,
      });
    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Chat service unavailable" });
    }
  });

  // POST /api/complaints/ai-draft – generate final complaint draft
  app.post("/api/complaints/ai-draft", async (req: Request, res: Response) => {
    try {
      const { conversation } = req.body;
      if (!conversation || !Array.isArray(conversation)) {
        return res.status(400).json({ error: "Conversation required" });
      }

      const model = getModel();
      const prompt = `
Based on the following conversation between a student and an intake officer, create a formal complaint draft.
Extract the key points and fill in the JSON below.

Conversation:
${conversation.map((m: any) => `${m.role}: ${m.content}`).join("\n")}

Return ONLY valid JSON with these fields:
{
  "title": "Brief, one-line summary of the complaint",
  "description": "A well-structured, factual description combining all details from the conversation (200-500 words)",
  "category": "One of: Academics, Facilities, Administration, Safety, Harassment, Discrimination, Other",
  "severity": "One of: low, medium, high, critical"
}

Do not include any text outside the JSON.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Extract JSON from possible markdown fences
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse draft from AI");
      }

      const draft = JSON.parse(jsonMatch[0]);
      res.json({ draft });
    } catch (error: any) {
      console.error("AI draft error:", error);
      res.status(500).json({ error: "Failed to generate draft" });
    }
  });
}