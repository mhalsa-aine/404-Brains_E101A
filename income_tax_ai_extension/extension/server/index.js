import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = 3000;

// Initialize OpenAI
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_api_key_here') {
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("✅ OpenAI initialized");
  } catch (e) {
    console.log("⚠️ OpenAI init failed:", e.message);
  }
} else {
  console.log("⚠️ No OpenAI API key found");
  console.log("💡 Add OPENAI_API_KEY to .env file for AI features");
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ 
    status: "running",
    ai: !!openai
  });
});

// Fallback matching for when AI is not available
function fallbackMatch(query, items) {
  const q = query.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const item of items) {
    if (!item) continue;
    const itemLower = item.toLowerCase().trim();
    let score = 0;

    if (itemLower === q) score = 100;
    else if (itemLower.includes(q)) score = 80;
    else if (itemLower.length >= 3 && q.includes(itemLower)) score = 60;
    else {
      const qWords = q.split(/\s+/);
      const iWords = itemLower.split(/\s+/);
      const overlap = qWords.filter(w => iWords.includes(w));
      if (overlap.length > 0) score = 40 + (overlap.length * 10);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore >= 40 ? bestMatch : null;
}

app.post("/ai", async (req, res) => {
  try {
    const { query, page } = req.body;

    if (!query) {
      return res.status(400).json({
        action: "explain",
        answer: "No query provided."
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("📝 Query:", query);
    console.log("📄 Page:", page?.title || "Unknown");
    console.log("🌐 URL:", page?.url || "Unknown");

    // Get all available items
    const allLinks = (page?.links || []).map(l => l.text).filter(t => t && t.length > 0 && t.length < 100);
    const allButtons = (page?.buttons || []).filter(t => t && t.length > 0 && t.length < 100);
    const allItems = [...new Set([...allLinks, ...allButtons])]; // Remove duplicates

    console.log("📊 Found:", allLinks.length, "links,", allButtons.length, "buttons");
    console.log("📋 Available items:", allItems.slice(0, 20).join(" | "));

    // Use OpenAI if available
    if (openai) {
      try {
        console.log("🤖 Using OpenAI...");

        const systemPrompt = `You are a website navigation assistant. The user is on a webpage and wants help navigating it.

PAGE INFORMATION:
Title: ${page?.title || "Unknown"}
URL: ${page?.url || "Unknown"}

AVAILABLE LINKS AND BUTTONS:
${allItems.slice(0, 50).join("\n")}

USER QUERY: "${query}"

INSTRUCTIONS:
1. Understand what the user wants to do
2. Find the BEST MATCHING link or button from the list above
3. Return ONLY a JSON object, no other text

RESPONSE FORMAT (choose ONE):
- If user wants to navigate: {"action": "navigate", "target": "exact_text_from_list", "reason": "why this matches"}
- If user asks a question: {"action": "explain", "answer": "helpful response based on available options"}

MATCHING RULES:
- "target" MUST be EXACT text from the available list above
- Handle synonyms: "sign in" = "login", "my profile" = "account", "help center" = "support"
- Be smart about partial matches: if user says "pricing" and you see "View Pricing Plans", use "View Pricing Plans"
- If no good match exists, use "explain" action to list relevant options

RESPOND ONLY WITH VALID JSON, NO MARKDOWN, NO EXPLANATION OUTSIDE JSON.`;

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
          temperature: 0.3,
          max_tokens: 300
        });

        const aiResponse = response.choices[0]?.message?.content?.trim();
        console.log("🤖 AI Response:", aiResponse);

        if (aiResponse) {
          // Parse JSON response
          let parsed;
          try {
            // Remove markdown code blocks if present
            const cleaned = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
            parsed = JSON.parse(cleaned);
          } catch (e) {
            console.log("⚠️ Failed to parse AI JSON:", e.message);
            throw e;
          }

          // Validate navigation target exists
          if (parsed.action === "navigate" && parsed.target) {
            // Check if target exists in our list (exact or close match)
            const targetMatch = allItems.find(item => 
              item.toLowerCase() === parsed.target.toLowerCase()
            );

            if (targetMatch) {
              console.log("✅ AI matched:", targetMatch);
              return res.json({
                action: "navigate",
                target: targetMatch,
                reason: parsed.reason
              });
            } else {
              // AI suggested something not in list, try fallback
              console.log("⚠️ AI target not found, using fallback");
              const fallback = fallbackMatch(query, allItems);
              if (fallback) {
                return res.json({
                  action: "navigate",
                  target: fallback
                });
              }
            }
          } else if (parsed.action === "explain") {
            console.log("💬 AI explaining");
            return res.json(parsed);
          }
        }
      } catch (aiError) {
        console.error("❌ OpenAI error:", aiError.message);
        // Fall through to fallback
      }
    }

    // Fallback: Use simple matching
    console.log("🔄 Using fallback matching...");

    // Clean query
    let cleanQuery = query.toLowerCase()
      .replace(/^(go to|navigate to|take me to|show me|open|find|where is|click|access|i want to|can you|please)\s+/i, '')
      .replace(/\b(the|a|an|page|section|area)\b/g, '')
      .trim();

    console.log("🧹 Clean query:", cleanQuery);

    const match = fallbackMatch(cleanQuery, allItems);

    if (match) {
      console.log("✅ Fallback matched:", match);
      return res.json({
        action: "navigate",
        target: match
      });
    }

    // No match - provide helpful response
    console.log("❌ No match found");
    
    if (query.toLowerCase().includes("what") || 
        query.toLowerCase().includes("where") ||
        query.toLowerCase().includes("help") ||
        query.toLowerCase().includes("show me")) {
      
      return res.json({
        action: "explain",
        answer: `Available on this page: ${allItems.slice(0, 10).join(", ")}`
      });
    }

    return res.json({
      action: "explain",
      answer: `I couldn't find "${cleanQuery}". Available options: ${allItems.slice(0, 8).join(", ")}. Try asking about one of these.`
    });

  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({
      action: "explain",
      answer: "Server error. Please try again."
    });
  }
});

app.listen(port, () => {
  console.log("=".repeat(60));
  console.log("🚀 AI Website Navigator running at http://localhost:" + port);
  console.log("🤖 AI Status:", openai ? "ENABLED ✅" : "DISABLED (fallback mode)");
  console.log("=".repeat(60));
});