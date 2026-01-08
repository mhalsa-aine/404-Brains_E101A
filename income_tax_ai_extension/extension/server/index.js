import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables from .env file (standard location)
dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Support BOTH OpenAI and Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Use whichever key is available
const AI_PROVIDER = GEMINI_API_KEY ? 'GEMINI' : (OPENAI_API_KEY ? 'OPENAI' : 'NONE');
const API_KEY = GEMINI_API_KEY || OPENAI_API_KEY;

// Store conversations
const conversations = new Map();

// Test endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "running",
    ai: !!API_KEY,
    provider: AI_PROVIDER
  });
});

// OpenAI API call
async function askOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful website navigation assistant. Respond only with valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

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

// Universal AI caller
async function askAI(prompt) {
  if (AI_PROVIDER === 'GEMINI') {
    return await askGemini(prompt);
  } else if (AI_PROVIDER === 'OPENAI') {
    return await askOpenAI(prompt);
  } else {
    throw new Error("No AI provider available");
  }
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

    // Try AI if available
    if (API_KEY) {
      try {
        console.log(`🤖 Using ${AI_PROVIDER} AI...`);

        const prompt = `You are an intelligent website navigation assistant.

CURRENT WEBSITE: ${page?.title || page?.url || "Unknown"}

AVAILABLE LINKS/BUTTONS:
${allItems.slice(0, 60).join('\n')}

USER QUERY: "${query}"

YOUR TASKS:
1. If user wants to NAVIGATE somewhere, find the best matching item
2. If user asks a QUESTION, answer it based on the page content
3. Be smart about synonyms and variations

RESPOND IN THIS JSON FORMAT:

For NAVIGATION queries ("go to", "show me", "open", "take me to"):
{
  "action": "navigate",
  "target": "EXACT_ITEM_FROM_LIST_ABOVE",
  "message": "Taking you to [destination]"
}

For QUESTION queries ("what", "where", "how", "tell me", "explain"):
{
  "action": "explain", 
  "answer": "A helpful, conversational answer about the website and what's available. Be specific and mention actual items from the list."
}

IMPORTANT MATCHING RULES:
- "sign in" = "login" = "Hello, sign in" = "Account & Lists"
- "pricing" = "plans" = "cost" = "View Pricing"
- "help" = "support" = "customer service" = "Help"
- "cart" = "shopping bag" = "basket" = "Cart"
- "orders" = "my orders" = "order history" = "Orders"

BE SMART: If user says "sign in" and list has "Hello, sign in Account & Lists", match it!

RESPOND ONLY WITH VALID JSON:`;

        const aiResponse = await askAI(prompt);
        console.log(`🤖 ${AI_PROVIDER} response:`, aiResponse);

        // Try to extract JSON (handle both clean and wrapped responses)
        let parsed;
        try {
          // First try direct parse
          parsed = JSON.parse(aiResponse);
        } catch {
          // Try to find JSON in the response
          const jsonMatch = aiResponse.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }

        if (parsed && parsed.action) {
          if (parsed.action === "navigate" && parsed.target) {
            // Find the best match for the target (case-insensitive, partial match)
            let found = allItems.find(item => 
              item.toLowerCase() === parsed.target.toLowerCase()
            );

            // If exact match not found, try partial matches
            if (!found) {
              found = allItems.find(item =>
                item.toLowerCase().includes(parsed.target.toLowerCase()) ||
                parsed.target.toLowerCase().includes(item.toLowerCase())
              );
            }

            // Try word-by-word matching
            if (!found) {
              const targetWords = parsed.target.toLowerCase().split(/\s+/);
              found = allItems.find(item => {
                const itemWords = item.toLowerCase().split(/\s+/);
                return targetWords.some(tw => itemWords.some(iw => iw.includes(tw) || tw.includes(iw)));
              });
            }

            if (found) {
              console.log("✅ AI matched to:", found);
              return res.json({
                action: "navigate",
                target: found,
                message: parsed.message || `Taking you to ${found}`
              });
            } else {
              console.log("⚠️ AI target not found:", parsed.target);
            }
          } else if (parsed.action === "explain" && parsed.answer) {
            console.log("💬 AI answering question");
            return res.json({
              action: "explain",
              answer: parsed.answer
            });
          }
        }

        console.log("⚠️ Couldn't use AI response, using fallback");
      } catch (aiError) {
        console.error(`❌ ${AI_PROVIDER} error:`, aiError.message);
      }
    }

    // ENHANCED FALLBACK: Smart keyword matching with synonyms
    const cleanQuery = query.toLowerCase()
      .replace(/^(go to|show me|take me to|open|find|i want|please|can you)\s+/i, '')
      .replace(/\b(the|a|an|page)\b/g, '')
      .trim();

    console.log("🔍 Fallback search:", cleanQuery);

    // Define synonym mappings
    const synonyms = {
      'login': ['sign in', 'log in', 'signin', 'account', 'hello'],
      'cart': ['shopping cart', 'bag', 'basket', 'shopping bag'],
      'orders': ['my orders', 'order history', 'past orders'],
      'help': ['support', 'customer service', 'assistance', 'faq'],
      'search': ['find', 'look for'],
      'home': ['homepage', 'main page'],
      'pricing': ['price', 'cost', 'plans', 'packages']
    };

    // Expand query with synonyms
    let searchTerms = [cleanQuery];
    for (const [key, values] of Object.entries(synonyms)) {
      if (cleanQuery.includes(key) || values.some(v => cleanQuery.includes(v))) {
        searchTerms.push(key, ...values);
      }
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const item of allItems) {
      if (!item) continue;
      const itemLower = item.toLowerCase();
      let score = 0;

      // Check all search terms
      for (const term of searchTerms) {
        // Exact match
        if (itemLower === term) {
          score = Math.max(score, 100);
        }
        // Item contains term
        else if (itemLower.includes(term)) {
          score = Math.max(score, 80);
        }
        // Term contains item
        else if (term.includes(itemLower) && itemLower.length >= 3) {
          score = Math.max(score, 70);
        }
        // Word-level matching
        else {
          const termWords = term.split(/\s+/).filter(w => w.length > 2);
          const itemWords = itemLower.split(/\s+/);
          const overlap = termWords.filter(tw => 
            itemWords.some(iw => iw.includes(tw) || tw.includes(iw))
          );
          if (overlap.length > 0) {
            score = Math.max(score, 50 + (overlap.length * 10));
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && bestScore >= 50) {
      console.log("✅ Fallback matched:", bestMatch, "Score:", bestScore);
      return res.json({
        action: "navigate",
        target: bestMatch,
        message: `Taking you to ${bestMatch}`
      });
    }

    // Answer questions in fallback mode
    if (query.toLowerCase().includes('what') || query.toLowerCase().includes('help')) {
      // Group similar items
      const categories = {
        account: allItems.filter(i => /account|sign|login|hello/i.test(i)),
        shopping: allItems.filter(i => /cart|order|wish|save/i.test(i)),
        navigation: allItems.filter(i => /home|search|menu/i.test(i))
      };

      let answer = `This appears to be ${page?.title || 'a website'}. `;
      
      if (categories.account.length > 0) {
        answer += `For account access, you can use: ${categories.account.slice(0, 2).join(", ")}. `;
      }
      if (categories.shopping.length > 0) {
        answer += `For shopping, there's: ${categories.shopping.slice(0, 2).join(", ")}. `;
      }
      
      answer += `Other options include: ${allItems.slice(0, 5).join(", ")}.`;
      
      return res.json({
        action: "explain",
        answer: answer
      });
    }

    return res.json({
      action: "explain",
      answer: `I couldn't find "${cleanQuery}". Available: ${allItems.slice(0, 8).join(", ")}`
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
  console.log("📂 Reading from: .env file");
  
  if (AI_PROVIDER === 'GEMINI') {
    console.log("🧠 AI: Google Gemini ENABLED ✅");
    console.log("💰 Cost: FREE!");
    console.log("🔑 Key: " + GEMINI_API_KEY.substring(0, 10) + "...");
  } else if (AI_PROVIDER === 'OPENAI') {
    console.log("🧠 AI: OpenAI GPT-3.5 ENABLED ✅");
    console.log("💰 Cost: ~$0.002 per query");
    console.log("🔑 Key: " + OPENAI_API_KEY.substring(0, 10) + "...");
  } else {
    console.log("⚠️  AI: DISABLED - No API key found");
    console.log("💡 Add to server/.env:");
    console.log("   Option 1 (FREE): GEMINI_API_KEY=your_key");
    console.log("   Option 2 (Paid): OPENAI_API_KEY=your_key");
    console.log("");
    console.log("📝 Get Gemini key (FREE): https://aistudio.google.com/app/apikey");
  }
  
  console.log("=".repeat(60) + "\n");
});