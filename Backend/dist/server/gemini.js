"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeComplaint = analyzeComplaint;
exports.calculateKeywordOverlap = calculateKeywordOverlap;
const generative_ai_1 = require("@google/generative-ai");
// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY
    ? new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;
// Keep the same helper functions from openai.ts
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
    // Fallback if no Gemini API key
    if (!genAI) {
        console.log("⚠️ No Gemini API key, using fallback analysis");
        return {
            summary: simpleSummarize(text),
            severity: determineSeverity(text),
            keywords: extractKeywords(text),
        };
    }
    try {
        // Use Gemini Flash (fast & cheap)
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
        // Try to parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    summary: parsed.summary || simpleSummarize(text),
                    severity: parsed.severity || "average",
                    keywords: parsed.keywords || extractKeywords(text),
                };
            }
            catch (error) {
                console.log("❌ Failed to parse Gemini JSON, using fallback");
            }
        }
        // If JSON parsing failed, try to extract from text
        let summary = simpleSummarize(text);
        let severity = determineSeverity(text);
        let keywords = extractKeywords(text);
        // Try to extract summary from response
        const summaryMatch = response.match(/summary[:\s]+([^\n]+)/i);
        if (summaryMatch)
            summary = summaryMatch[1].trim().slice(0, 100);
        // Try to extract severity
        const severityMatch = response.match(/severity[:\s]+(good|average|poor|bad|worst|critical)/i);
        if (severityMatch)
            severity = severityMatch[1].toLowerCase();
        // Try to extract keywords
        const keywordsMatch = response.match(/keywords[:\s]+\[([^\]]+)\]/i);
        if (keywordsMatch) {
            keywords = keywordsMatch[1]
                .split(',')
                .map(k => k.trim().replace(/['"]/g, ''))
                .filter(k => k);
        }
        return { summary, severity, keywords };
    }
    catch (error) {
        console.error("❌ Gemini analysis failed:", error);
        // Fallback to simple analysis
        return {
            summary: simpleSummarize(text),
            severity: determineSeverity(text),
            keywords: extractKeywords(text),
        };
    }
}
// Keep the same function for compatibility
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
