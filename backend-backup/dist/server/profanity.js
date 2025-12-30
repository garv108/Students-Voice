"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectProfanity = detectProfanity;
exports.getBanExpiration = getBanExpiration;
const PROFANITY_LIST = [
    "fuck", "shit", "ass", "bitch", "damn", "hell", "crap",
    "bastard", "dick", "pussy", "cock", "cunt", "whore",
    "slut", "fag", "nigger", "retard", "idiot", "stupid",
    "dumb", "moron", "asshole", "bullshit", "motherfucker",
];
const LEETSPEAK_MAP = {
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
function normalizeLeetspeak(text) {
    let normalized = text.toLowerCase();
    for (const [leet, letter] of Object.entries(LEETSPEAK_MAP)) {
        normalized = normalized.split(leet).join(letter);
    }
    return normalized;
}
function detectProfanity(text) {
    const normalizedText = normalizeLeetspeak(text);
    const words = normalizedText.split(/\s+/);
    const detectedWords = [];
    for (const word of words) {
        const cleanWord = word.replace(/[^a-z]/g, "");
        for (const profanity of PROFANITY_LIST) {
            if (cleanWord.includes(profanity)) {
                detectedWords.push(word);
                break;
            }
        }
    }
    for (const profanity of PROFANITY_LIST) {
        if (normalizedText.includes(profanity) && !detectedWords.some(w => w.includes(profanity))) {
            detectedWords.push(profanity);
        }
    }
    return {
        isAbusive: detectedWords.length > 0,
        detectedWords: Array.from(new Set(detectedWords)),
    };
}
function getBanExpiration(hours = 48) {
    const banUntil = new Date();
    banUntil.setHours(banUntil.getHours() + hours);
    return banUntil;
}
