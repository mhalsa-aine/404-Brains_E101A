import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Get API key from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Store conversations
const conversations = new Map();

// Test endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "running",
    ai: !!GEMINI_API_KEY,
    mode: GEMINI_API_KEY ? "GEMINI_AI" : "FALLBACK"
  });
});

// Gemini API call
async function askGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Main AI endpoint
app.post("/ai", async (req, res) => {
  try {
    const { query, page, conversationId } = req.body;

    if (!query) {
      return res.json({
        action: "explain",
        answer: "Please ask me something!"
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("📝 Query:", query);
    console.log("📄 Page:", page?.title || "Unknown");

    // Get available items from page
    const allLinks = (page?.links || []).map(l => l.text).filter(t => t && t.length < 100);
    const allButtons = (page?.buttons || []).filter(t => t && t.length < 100);
    const allItems = [...new Set([...allLinks, ...allButtons])];

    console.log("📊 Found:", allItems.length, "items");

    // Try Gemini if available
    if (GEMINI_API_KEY) {
      try {
        console.log("🤖 Using Gemini AI...");

        const prompt = `You are a website navigation assistant.

AVAILABLE ITEMS ON PAGE:
${allItems.slice(0, 50).join('\n')}

USER QUERY: "${query}"

RESPOND WITH JSON ONLY (no markdown, no extra text):

If user wants to NAVIGATE:
{"action": "navigate", "target": "EXACT_ITEM_FROM_LIST", "message": "Taking you there"}

If user asks a QUESTION:
{"action": "explain", "answer": "Your helpful answer"}

RULES:
- "target" must be EXACT text from the list above
- Understand synonyms: "price" = "pricing", "login" = "sign in"
- Be smart and conversational

JSON RESPONSE:`;

        const aiResponse = await askGemini(prompt);
        console.log("🤖 Gemini said:", aiResponse.substring(0, 100) + "...");

        // Extract JSON from response
        const jsonMatch = aiResponse.match(/\{[^}]*"action"[^}]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          if (parsed.action === "navigate" && parsed.target) {
            // Verify target exists
            const found = allItems.find(item => 
              item.toLowerCase() === parsed.target.toLowerCase() ||
              item.toLowerCase().includes(parsed.target.toLowerCase())
            );

            if (found) {
              console.log("✅ Navigating to:", found);
              return res.json({
                action: "navigate",
                target: found,
                message: parsed.message || `Going to ${found}`
              });
            }
          } else if (parsed.action === "explain") {
            console.log("💬 Explaining");
            return res.json(parsed);
          }
        }

        console.log("⚠️ Couldn't parse AI response, using fallback");
      } catch (aiError) {
        console.error("❌ Gemini error:", aiError.message);
      }
    } else {
      console.log("⚠️ No Gemini key, using fallback");
    }

    // FALLBACK: Smart keyword matching
    const cleanQuery = query.toLowerCase()
      .replace(/^(go to|show me|take me to|open|find|i want|please)\s+/i, '')
      .replace(/\b(the|a|an|page)\b/g, '')
      .trim();

    console.log("🔍 Fallback search:", cleanQuery);

    let bestMatch = null;
    let bestScore = 0;

    for (const item of allItems) {
      const itemLower = item.toLowerCase();
      let score = 0;

      if (itemLower === cleanQuery) score = 100;
      else if (itemLower.includes(cleanQuery)) score = 80;
      else if (cleanQuery.includes(itemLower) && itemLower.length >= 3) score = 60;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && bestScore >= 60) {
      console.log("✅ Found:", bestMatch);
      return res.json({
        action: "navigate",
        target: bestMatch,
        message: `Taking you to ${bestMatch}`
      });
    }

    // No match found
    if (query.toLowerCase().includes('what') || query.toLowerCase().includes('help')) {
      return res.json({
        action: "explain",
        answer: `Available: ${allItems.slice(0, 10).join(", ")}`
      });
    }

    return res.json({
      action: "explain",
      answer: `Couldn't find "${cleanQuery}". Try: ${allItems.slice(0, 6).join(", ")}`
    });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({
      action: "explain",
      answer: "Error occurred. Please try again."
    });
  }
});

// Start server
app.listen(port, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🤖 AI WEBSITE ASSISTANT");
  console.log("=".repeat(60));
  console.log("🚀 Server: http://localhost:" + port);
  
  if (GEMINI_API_KEY) {
    console.log("🧠 AI: Google Gemini ENABLED ✅");
    console.log("💰 Cost: FREE!");
  } else {
    console.log("⚠️  AI: DISABLED");
    console.log("💡 Add GEMINI_API_KEY to .env for AI features");
    console.log("📝 Get free key: https://aistudio.google.com/app/apikey");
  }
  
  console.log("=".repeat(60) + "\n");
});