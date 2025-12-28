"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeComplaint = analyzeComplaint;
exports.calculateKeywordOverlap = calculateKeywordOverlap;
const openai_1 = __importDefault(require("openai"));
const openai = process.env.OPENAI_API_KEY
    ? new openai_1.default({ apiKey: process.env.OPENAI_API_KEY })
    : null;
function extractKeywords(text) {
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
    const wordFreq = {};
    for (const word of words) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
}
function simpleSummarize(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 2) {
        return text.slice(0, 200);
    }
    return sentences.slice(0, 2).join(". ").slice(0, 200) + "...";
}
function determineSeverity(text) {
    const lowerText = text.toLowerCase();
    const criticalWords = ["emergency", "danger", "life-threatening", "urgent", "critical", "immediately"];
    const worstWords = ["broken", "failure", "unusable", "blocked", "shutdown"];
    const badWords = ["problem", "issue", "not working", "failed", "error"];
    const poorWords = ["slow", "delay", "inconvenient", "frustrating"];
    const averageWords = ["could be better", "improvement", "suggestion"];
    if (criticalWords.some(word => lowerText.includes(word)))
        return "critical";
    if (worstWords.some(word => lowerText.includes(word)))
        return "worst";
    if (badWords.some(word => lowerText.includes(word)))
        return "bad";
    if (poorWords.some(word => lowerText.includes(word)))
        return "poor";
    if (averageWords.some(word => lowerText.includes(word)))
        return "average";
    return "average";
}
async function analyzeComplaint(text) {
    if (!openai) {
        return {
            summary: simpleSummarize(text),
            severity: determineSeverity(text),
            keywords: extractKeywords(text),
        };
    }
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an AI assistant that analyzes student complaints. 
Given a complaint text, provide:
1. A brief summary (max 100 characters)
2. A severity rating: good, average, poor, bad, worst, or critical
3. Up to 5 keywords for clustering

Respond in JSON format:
{
  "summary": "Brief summary here",
  "severity": "average",
  "keywords": ["keyword1", "keyword2"]
}`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 200,
        });
        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = JSON.parse(content);
            return {
                summary: parsed.summary || simpleSummarize(text),
                severity: parsed.severity || "average",
                keywords: parsed.keywords || extractKeywords(text),
            };
        }
    }
    catch (error) {
        console.error("OpenAI analysis failed, using fallback:", error);
    }
    return {
        summary: simpleSummarize(text),
        severity: determineSeverity(text),
        keywords: extractKeywords(text),
    };
}
function calculateKeywordOverlap(keywords1, keywords2) {
    if (!keywords1.length || !keywords2.length)
        return 0;
    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));
    let overlap = 0;
    for (const keyword of Array.from(set1)) {
        if (set2.has(keyword))
            overlap++;
    }
    const totalUnique = new Set([...Array.from(set1), ...Array.from(set2)]).size;
    return totalUnique > 0 ? overlap / totalUnique : 0;
}
