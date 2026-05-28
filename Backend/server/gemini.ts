import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export interface AnalysisResult {
  summary: string;
  severity: "good" | "average" | "poor" | "bad" | "worst" | "critical";
  keywords: string[];
}

// --------------------------------------------------
// 1. Keyword extraction
// --------------------------------------------------
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
    "because", "as", "until", "while", "this", "that", "these", "those",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
    "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
    "she", "her", "hers", "herself", "it", "its", "itself", "they", "them",
    "their", "theirs", "themselves", "what", "which", "who", "whom",
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  const wordFreq: Record<string, number> = {};
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// --------------------------------------------------
// 2. Simple summariser (fallback)
// --------------------------------------------------
function simpleSummarize(text: string): string {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 2) {
    return text.slice(0, 200);
  }
  return sentences.slice(0, 2).join(". ").slice(0, 200) + "...";
}

function determineSeverity(text: string): AnalysisResult["severity"] {
  const lowerText = text.toLowerCase();

  const criticalWords = ["emergency", "danger", "life-threatening", "urgent", "critical", "immediately"];
  const worstWords = ["broken", "failure", "unusable", "blocked", "shutdown"];
  const badWords = ["problem", "issue", "not working", "failed", "error"];
  const poorWords = ["slow", "delay", "inconvenient", "frustrating"];
  const averageWords = ["could be better", "improvement", "suggestion"];

  if (criticalWords.some(word => lowerText.includes(word))) return "critical";
  if (worstWords.some(word => lowerText.includes(word))) return "worst";
  if (badWords.some(word => lowerText.includes(word))) return "bad";
  if (poorWords.some(word => lowerText.includes(word))) return "poor";
  if (averageWords.some(word => lowerText.includes(word))) return "average";

  return "average";
}

// --------------------------------------------------
// 3. Main complaint analyser
// --------------------------------------------------
export async function analyzeComplaint(text: string): Promise<AnalysisResult> {
  if (!genAI) {
    console.log("⚠️ No Gemini API key, using fallback analysis");
    return {
      summary: simpleSummarize(text),
      severity: determineSeverity(text),
      keywords: extractKeywords(text),
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
    Analyze this student complaint and provide:
    1. A brief summary (max 100 characters)
    2. Severity rating: good, average, poor, bad, worst, or critical
    3. Up to 5 keywords for clustering
    
    Complaint: "${text}"
    
    Respond in this exact JSON format:
    {
      "summary": "Brief summary here",
      "severity": "average",
      "keywords": ["keyword1", "keyword2"]
    }
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || simpleSummarize(text),
          severity: parsed.severity || "average",
          keywords: parsed.keywords || extractKeywords(text),
        };
      } catch (error) {
        console.log("❌ Failed to parse Gemini JSON, using fallback");
      }
    }
    
    let summary = simpleSummarize(text);
    let severity = determineSeverity(text);
    let keywords = extractKeywords(text);
    
    const summaryMatch = response.match(/summary[:\s]+([^\n]+)/i);
    if (summaryMatch) summary = summaryMatch[1].trim().slice(0, 100);
    
    const severityMatch = response.match(/severity[:\s]+(good|average|poor|bad|worst|critical)/i);
    if (severityMatch) severity = severityMatch[1].toLowerCase() as any;
    
    const keywordsMatch = response.match(/keywords[:\s]+\[([^\]]+)\]/i);
    if (keywordsMatch) {
      keywords = keywordsMatch[1]
        .split(',')
        .map((k: string) => k.trim().replace(/['"]/g, ''))
        .filter((k: string) => k);
    }
    
    return { summary, severity, keywords };
    
  } catch (error) {
    console.error("❌ Gemini analysis failed:", error);
    return {
      summary: simpleSummarize(text),
      severity: determineSeverity(text),
      keywords: extractKeywords(text),
    };
  }
}

// --------------------------------------------------
// 4. Keyword overlap calculator
// --------------------------------------------------
export function calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  if (!keywords1.length || !keywords2.length) return 0;
  
  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));
  
  let overlap = 0;
  for (const keyword of Array.from(set1)) {
    if (set2.has(keyword)) overlap++;
  }
  
  const totalUnique = new Set([...Array.from(set1), ...Array.from(set2)]).size;
  return totalUnique > 0 ? overlap / totalUnique : 0;
}

// --------------------------------------------------
// 5. Abuse detection (Multilingual)
// --------------------------------------------------
export async function detectAbuseWithAI(text: string): Promise<{
  isAbusive: boolean;
  detectedWords: string[];
  confidence: number;
}> {
  try {
    if (!genAI || !process.env.GEMINI_API_KEY) {
      return { isAbusive: false, detectedWords: [], confidence: 0 };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
    Analyze this text for abusive, harassing, or inappropriate content in ANY language (English, Hindi, Urdu, etc.).
    
    Text: "${text}"
    
    Respond in JSON format:
    {
      "isAbusive": true/false,
      "detectedWords": ["word1", "word2"] (empty array if not abusive),
      "confidence": 0.95 (number between 0-1),
      "reason": "Brief explanation"
    }
    
    Consider:
    1. Profanity/swear words in any language
    2. Personal attacks, insults
    3. Threats, harassment
    4. Hate speech, discrimination
    5. Sexual harassment content
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isAbusive: parsed.isAbusive === true,
          detectedWords: Array.isArray(parsed.detectedWords) ? parsed.detectedWords : [],
          confidence: parsed.confidence || 0,
        };
      } catch (e) {
        console.log("Failed to parse AI response:", e);
      }
    }
    
    return { isAbusive: false, detectedWords: [], confidence: 0 };
    
  } catch (error) {
    console.error("AI abuse detection failed:", error);
    return { isAbusive: false, detectedWords: [], confidence: 0 };
  }
}

// --------------------------------------------------
// 6. Fake complaint detection (facilities)
// --------------------------------------------------
export async function detectFakeComplaint(
  text: string,
  knownFacilities: string[] = []
): Promise<{ isLikelyFake: boolean; reason?: string }> {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    console.log("⚠️ Gemini not configured, skipping fake detection");
    return { isLikelyFake: false };
  }

  if (!knownFacilities || knownFacilities.length === 0) {
    return { isLikelyFake: false };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `
You are an integrity checker for a student grievance portal at a specific college.
The college has the following known facilities/locations: ${knownFacilities.join(", ")}.

A student submitted this complaint: "${text}".

Check if the complaint refers to locations, rooms, facilities, or departments that do NOT exist in the provided list.
If it mentions something that is clearly not in the list, mark it as likely fake.
If it only mentions things that could exist or are generic, mark it as not fake.

Return ONLY valid JSON:
{
  "isLikelyFake": true or false,
  "reason": "Brief explanation if fake, or null"
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isLikelyFake: parsed.isLikelyFake === true,
        reason: parsed.reason || undefined,
      };
    }

    return { isLikelyFake: false };
  } catch (error) {
    console.error("❌ Fake complaint detection failed:", error);
    return { isLikelyFake: false };
  }
}

// --------------------------------------------------
// 7. Frivolous complaint detection (NEW)
// --------------------------------------------------
export async function detectFrivolousComplaint(
  text: string
): Promise<{ isFrivolous: boolean; reason?: string }> {
  if (!genAI || !process.env.GEMINI_API_KEY) {
    return { isFrivolous: false };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `
You are a complaint validator for a college grievance portal that handles real student issues.
Read the following submission and determine if it is a **genuine, actionable grievance** or a **frivolous/joke complaint**.

Examples of frivolous complaints:
- Requests for luxury items (Baskin Robbins, Starbucks, McDonald's, helipad, runway, high-end clothing brands)
- Demands that are clearly unreasonable or impossible in a college setting
- Complaints about "low number of female students" with solutions like "build love parks" or "add skincare items"
- Complaints that are testing the system with absurd demands
- Obviously sarcastic or humorous content

Examples of genuine complaints:
- Broken infrastructure (water cooler, WiFi, furniture)
- Academic concerns (grading, teaching quality)
- Harassment or discrimination
- Administrative delays
- Safety issues

Return ONLY valid JSON:
{
  "isFrivolous": true or false,
  "reason": "Brief explanation if frivolous, or null"
}

Complaint: "${text.slice(0, 600)}"`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isFrivolous: parsed.isFrivolous === true,
        reason: parsed.reason || undefined,
      };
    }
    return { isFrivolous: false };
  } catch (error) {
    console.error("❌ Frivolous complaint detection failed:", error);
    return { isFrivolous: false };
  }
}