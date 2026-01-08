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

        // Detect if it's a question vs navigation
        const isQuestion = /^(what|where|how|why|when|who|which|can you tell|explain|describe|tell me)/i.test(query) ||
                          query.includes('?');

        const prompt = `You are an intelligent website navigation assistant.

CURRENT WEBSITE: ${page?.title || page?.url || "Unknown"}
URL: ${page?.url || "Unknown"}

AVAILABLE LINKS/BUTTONS ON THIS PAGE:
${allItems.slice(0, 60).join('\n')}

USER QUERY: "${query}"

ANALYSIS: This ${isQuestion ? 'IS A QUESTION' : 'might be navigation or a question'}.

YOUR TASK:
${isQuestion ? 
`The user is ASKING A QUESTION about the website. You MUST answer their question conversationally.

ANSWER their question by:
1. Explaining what this website is/does
2. Mentioning relevant sections available
3. Being helpful and informative

Respond: {"action": "explain", "answer": "Your conversational answer explaining the website and what's available"}` 
:
`Determine if this is:
A) A NAVIGATION request → respond with {"action": "navigate", "target": "EXACT_ITEM", "message": "Taking you there"}
B) A QUESTION → respond with {"action": "explain", "answer": "Helpful answer about the website"}`
}

NAVIGATION MATCHING RULES (only for navigation requests):
- "sign in" = "login" = "Hello, sign in" = "Account & Lists"
- "cart" = "shopping cart" = "Cart"
- "orders" = "my orders" = "Orders"
- "pricing" = "plans" = "cost"

FOR QUESTIONS (like "what is this website"):
- DO NOT navigate
- DO NOT just list items
- ANSWER the question conversationally
- Explain what the website does
- Mention key features/sections

Example question responses:
Q: "What is this website used for?"
A: "This is Amazon, an online shopping platform where you can browse and purchase millions of products. You can search for items, add them to your cart, manage orders, and track deliveries. Key sections include: Cart for your items, Orders for purchase history, and Search to find products."

Q: "What can I do here?"
A: "On this page, you can access your Amazon account (Hello, sign in), view your shopping Cart, check your Orders, search for products, and browse different categories. You can shop for virtually anything from electronics to groceries."

RESPOND ONLY WITH VALID JSON:`;

        const aiResponse = await askAI(prompt);
        console.log(`🤖 ${AI_PROVIDER} response:`, aiResponse);

        // Try to extract JSON
        let parsed;
        try {
          parsed = JSON.parse(aiResponse);
        } catch {
          const jsonMatch = aiResponse.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }

        if (parsed && parsed.action) {
          if (parsed.action === "explain" && parsed.answer) {
            console.log("💬 AI answering question");
            return res.json({
              action: "explain",
              answer: parsed.answer
            });
          } else if (parsed.action === "navigate" && parsed.target) {
            // Find the best match
            let found = allItems.find(item => 
              item.toLowerCase() === parsed.target.toLowerCase()
            );

            if (!found) {
              found = allItems.find(item =>
                item.toLowerCase().includes(parsed.target.toLowerCase()) ||
                parsed.target.toLowerCase().includes(item.toLowerCase())
              );
            }

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
            }
          }
        }

        console.log("⚠️ Couldn't use AI response, using fallback");
      } catch (aiError) {
        console.error(`❌ ${AI_PROVIDER} error:`, aiError.message);
      }
    }

    // ENHANCED FALLBACK with better question detection
    const isDefiniteQuestion = /^(what|where|how|why|when|who|which|can you tell|explain|describe|tell me about)/i.test(query) ||
                               query.includes('?');
    
    // If it's clearly a question, answer it - DON'T navigate
    if (isDefiniteQuestion) {
      console.log("💬 Detected question, providing answer");
      
      // Identify website/page type
      const url = page?.url || "";
      const title = page?.title || "";
      
      let websiteType = "website";
      let mainPurpose = "browse and interact with various sections";
      
      if (url.includes("amazon") || title.toLowerCase().includes("amazon")) {
        websiteType = "Amazon";
        mainPurpose = "shop for products online. You can search for millions of items, add them to your cart, manage orders, and track deliveries";
      } else if (url.includes("github")) {
        websiteType = "GitHub";
        mainPurpose = "host and collaborate on code. You can explore repositories, view documentation, and manage software projects";
      } else if (url.includes("youtube")) {
        websiteType = "YouTube";
        mainPurpose = "watch and share videos. You can search for content, subscribe to channels, and manage your viewing history";
      }
      
      // Categorize available items
      const accountItems = allItems.filter(i => /account|sign|login|hello|profile/i.test(i)).slice(0, 2);
      const shoppingItems = allItems.filter(i => /cart|order|wish|save|buy|shop/i.test(i)).slice(0, 2);
      const navigationItems = allItems.filter(i => /home|search|menu|browse/i.test(i)).slice(0, 2);
      const otherItems = allItems.filter(i => 
        !/(account|sign|login|cart|order|wish|home|search|menu)/i.test(i)
      ).slice(0, 3);
      
      let answer = `This is ${websiteType}, used to ${mainPurpose}. `;
      
      if (accountItems.length > 0) {
        answer += `For account access: ${accountItems.join(", ")}. `;
      }
      if (shoppingItems.length > 0) {
        answer += `For shopping/orders: ${shoppingItems.join(", ")}. `;
      }
      if (navigationItems.length > 0) {
        answer += `Navigation options: ${navigationItems.join(", ")}. `;
      }
      if (otherItems.length > 0) {
        answer += `Other features: ${otherItems.join(", ")}.`;
      }
      
      return res.json({
        action: "explain",
        answer: answer
      });
    }

    // Not a question - try to navigate
    const cleanQuery = query.toLowerCase()
      .replace(/^(go to|show me|take me to|open|find|i want|please|can you)\s+/i, '')
      .replace(/\b(the|a|an|page)\b/g, '')
      .trim();

    console.log("🔍 Fallback navigation search:", cleanQuery);

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

    // After trying to find match...
    if (bestMatch && bestScore >= 50) {
      console.log("✅ Fallback matched:", bestMatch, "Score:", bestScore);
      return res.json({
        action: "navigate",
        target: bestMatch,
        message: `Taking you to ${bestMatch}`
      });
    }

    // No match - provide helpful response
    console.log("❌ No match found");
    return res.json({
      action: "explain",
      answer: `I couldn't find "${cleanQuery}" on this page. Available options: ${allItems.slice(0, 8).join(", ")}. What would you like to do?`
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