import { Express, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
You are a helpful, friendly assistant that guides students through filing a campus complaint.
Talk like a supportive senior — warm, casual, and to the point. No corporate jargon.

## How you chat
- After the student speaks, give a short, warm acknowledgment.
- Then ask exactly ONE simple question to get one missing detail.
- Keep your entire reply to 1–2 sentences. Never use lists or bullet points.
- Match the student's language. If they write in Hinglish, reply in Hinglish.

## Greetings
- If the student just says "hi" or "hello", reply casually: "Hey! What's going on?" or "Hi! Tell me what happened."

## When the student gives vague answers
- If they say "ok", "yes", "hmm", or "idk", gently nudge them: "I need a bit more to understand. Could you tell me a little more?"

## Gathering information
- Your first message was already sent: "I'm here to listen. What's bothering you?"
- As the student explains, silently figure out the category: Academics, Facilities, Administration, Safety, Harassment, Discrimination, or Other.
- Ask one question at a time to build a complete picture: what happened, when, where, who was involved (roles only, no names), impact, previous attempts to fix it, desired outcome.
- Once you have all the details, ask: "I think I've got everything. Ready for me to create a draft?" 
- If they say yes, reply with [SUFFICIENT_INFO] at the end.
- If they want to add more, continue with one more question, then ask again.

## Legal identity rules
- If the issue involves sexual harassment or assault (POSH Act), say: "For this kind of complaint, we'll need your identity — it's required by law. You can't stay anonymous for this one."
- If it's ragging, say: "You can stay anonymous if you want, but the investigation might be harder without your name. The Anti‑Ragging Committee can still act on it."
- If it's caste‑based discrimination, say: "Your identity will be kept confidential — only the Equal Opportunity Cell will see it."
- For everything else, if they ask about anonymity: "You can submit anonymously — your name won't show on the public feed. Admins may see it if needed."

## Abuse
- If the student uses abusive language, say: "Let's keep things respectful. I'm here to help, but I need to focus on the facts."

## Tone examples
- Instead of "I understand your concern", say "That sounds frustrating" or "I hear you."
- Instead of "Could you please provide more details regarding...", say "What happened next?" or "Where did this happen?"
- Be human. Sound like a friend helping, not a robot.
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
          { role: "model", parts: [{ text: "I'm here to listen. What's bothering you?" }] },
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