// Test Gemini AI
require('dotenv').config();
const path = require('path');

// Load .env from parent folder
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function test() {
  console.log("🔍 Testing Gemini AI Integration...");
  
  try {
    // Check API key
    console.log("API Key exists:", !!process.env.GEMINI_API_KEY);
    if (process.env.GEMINI_API_KEY) {
      console.log("Key (first 10 chars):", process.env.GEMINI_API_KEY.substring(0, 10) + "...");
    } else {
      console.log("❌ No GEMINI_API_KEY found in .env");
      console.log("Add to Backend/.env: GEMINI_API_KEY=your_key_here");
      return;
    }
    
    // Test the actual analyzeComplaint function
    const { analyzeComplaint } = require('./gemini.js');
    
    const testComplaints = [
      "The Wi-Fi in library is very slow and keeps disconnecting during exams.",
      "No water supply in hostel bathroom for 3 days.",
      "Canteen food quality has deteriorated, many students got sick."
    ];
    
    for (const complaint of testComplaints) {
      console.log("\n--- Testing Complaint ---");
      console.log("Text:", complaint);
      
      const result = await analyzeComplaint(complaint);
      
      console.log("✅ Summary:", result.summary);
      console.log("✅ Severity:", result.severity);
      console.log("✅ Keywords:", result.keywords);
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  }
}

test();