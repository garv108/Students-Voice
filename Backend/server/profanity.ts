import { detectAbuseWithAI } from "./gemini";

// English profanity
const ENGLISH_PROFANITY = [
  "fuck", "shit", "bitch", "bastard", "dick", "pussy", "cock",
  "cunt", "whore", "slut", "fag", "nigger", "asshole", "bullshit",
  "motherfucker",
];

// Hindi/Urdu profanity (full words only — no partial matches)
const HINDI_PROFANITY = [
  "chutiya", "chutia", "madarchod", "madar chod", "bhosdike",
  "bhenchod", "behen chod", "gandu", "gaandu", "lauda", "lund",
  "chut", "gaand", "bhosda", "randi", "harami", "kamina",
];

// Abusive phrases (matched as substrings in full text)
const ABUSIVE_PHRASES = [
  "fuck you", "fuck off", "screw you", "go to hell",
  "maar denge", "tod denge",
];

const LEETSPEAK_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
};

function normalizeLeetspeak(text: string): string {
  let normalized = text.toLowerCase();
  for (const [leet, letter] of Object.entries(LEETSPEAK_MAP)) {
    normalized = normalized.split(leet).join(letter);
  }
  return normalized;
}

export interface ProfanityResult {
  isAbusive: boolean;
  detectedWords: string[];
  detectedBy: "word_list" | "phrase" | "ai";
}

export async function detectProfanity(text: string): Promise<ProfanityResult> {
  const normalizedText = normalizeLeetspeak(text);
  const detectedWords: string[] = [];
  let detectionMethod: "word_list" | "phrase" | "ai" = "word_list";

  // METHOD 1: Word-level exact matching
  // Split on whitespace and strip non-alpha characters from each token
  const words = normalizedText.split(/\s+/);
  for (const rawWord of words) {
    const cleanWord = rawWord.replace(/[^a-z]/g, "");

    // Skip empty tokens or very short tokens (avoids false positives)
    if (cleanWord.length < 3) continue;

    // FIXED: Only check if the cleaned word CONTAINS a profanity term.
    // Removed the reversed check (profanity.includes(cleanWord)) which
    // caused any short substring to match against profanity words.
    for (const profanity of [...ENGLISH_PROFANITY, ...HINDI_PROFANITY]) {
      if (cleanWord === profanity || cleanWord.includes(profanity)) {
        detectedWords.push(rawWord);
        break;
      }
    }
  }

  // METHOD 2: Full-text phrase matching
  if (detectedWords.length === 0) {
    for (const phrase of ABUSIVE_PHRASES) {
      if (normalizedText.includes(phrase)) {
        detectedWords.push(phrase);
        detectionMethod = "phrase";
      }
    }
  }

  // METHOD 3: AI detection — only if word list and phrases found nothing
  // Require high confidence (>= 0.85) to avoid false positives from AI
  if (detectedWords.length === 0) {
    try {
      const aiResult = await detectAbuseWithAI(text);
      if (aiResult.isAbusive && aiResult.confidence >= 0.85) {
        detectedWords.push(...aiResult.detectedWords);
        detectionMethod = "ai";
      }
    } catch (error) {
      console.log("⚠️ AI abuse detection failed, skipping:", error);
    }
  }

  return {
    isAbusive: detectedWords.length > 0,
    detectedWords: Array.from(new Set(detectedWords)),
    detectedBy: detectionMethod,
  };
}

export function getBanExpiration(hours: number = 48): Date {
  const banUntil = new Date();
  banUntil.setHours(banUntil.getHours() + hours);
  return banUntil;
}

export function getProfanityLists() {
  return {
    english: ENGLISH_PROFANITY.length,
    hindi: HINDI_PROFANITY.length,
    phrases: ABUSIVE_PHRASES.length,
    total: ENGLISH_PROFANITY.length + HINDI_PROFANITY.length,
  };
}