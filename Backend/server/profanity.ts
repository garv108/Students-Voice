import { detectAbuseWithAI } from "./gemini";

// English profanity (existing)
const ENGLISH_PROFANITY = [
  "fuck", "shit", "ass", "bitch", "damn", "hell", "crap",
  "bastard", "dick", "pussy", "cock", "cunt", "whore",
  "slut", "fag", "nigger", "retard", "idiot", "stupid",
  "dumb", "moron", "asshole", "bullshit", "motherfucker",
];

// Hindi/Urdu profanity
const HINDI_PROFANITY = [
  "chutiya", "chutia", "madarchod", "madar chod", "bhosdike",
  "bhenchod", "behen chod", "gandu", "gaandu", "lauda", "lund",
  "chut", "gaand", "bhosda", "randi", "kutta", "kuttiya",
  "saala", "sala", "harami", "kamina", "ullu", "bewakoof",
];

// Common abusive phrases (Hindi/English mixed)
const ABUSIVE_PHRASES = [
  "number kat", "marks kat", "fail kar", "tod denge", "maar denge",
  "fuck you", "fuck off", "screw you", "go to hell", "die",
];

// Combine all word lists
const PROFANITY_LIST = [...ENGLISH_PROFANITY, ...HINDI_PROFANITY, ...ABUSIVE_PHRASES];

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
  "*": "a",
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
  detectedBy: "word_list" | "pattern" | "ai";
}

export async function detectProfanity(text: string): Promise<ProfanityResult> {
  const normalizedText = normalizeLeetspeak(text);
  const words = normalizedText.split(/\s+/);
  const detectedWords: string[] = [];
  let detectionMethod: "word_list" | "pattern" | "ai" = "word_list";

  // METHOD 1: Direct word matching
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z]/g, "");
    for (const profanity of PROFANITY_LIST) {
      if (cleanWord.includes(profanity) || profanity.includes(cleanWord)) {
        detectedWords.push(word);
        break;
      }
    }
  }

  // METHOD 2: Phrase pattern matching
  for (const phrase of ABUSIVE_PHRASES) {
    if (normalizedText.includes(phrase)) {
      detectedWords.push(phrase);
      detectionMethod = "pattern";
    }
  }

  // METHOD 3: AI detection (if previous methods didn't catch anything)
  if (detectedWords.length === 0) {
    try {
      const aiResult = await detectAbuseWithAI(text);
      if (aiResult.isAbusive) {
        detectedWords.push(...aiResult.detectedWords);
        detectionMethod = "ai";
      }
    } catch (error) {
      console.log("⚠️ AI abuse detection failed, using word list only:", error);
    }
  }

  return {
    isAbusive: detectedWords.length > 0,
    detectedWords: Array.from(new Set(detectedWords)),
    detectedBy: detectionMethod,
  };
}

export function getBanExpiration(hours: number = 3): Date {
  const banUntil = new Date();
  banUntil.setHours(banUntil.getHours() + hours);
  return banUntil;
}

// Helper function for testing
export function getProfanityLists() {
  return {
    english: ENGLISH_PROFANITY.length,
    hindi: HINDI_PROFANITY.length,
    phrases: ABUSIVE_PHRASES.length,
    total: PROFANITY_LIST.length,
  };
}