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
    console.log("✅ OpenAI initialized - TRUE AI MODE");
  } catch (e) {
    console.log("⚠️ OpenAI init failed:", e.message);
  }
} else {
  console.log("❌ No OpenAI API key - AI features disabled");
  console.log("💡 Add OPENAI_API_KEY to .env file");
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ 
    status: "running",
    ai: !!openai,
    mode: openai ? "AI_CHATBOT" : "FALLBACK"
  });
});

// Store conversation history (in production, use a database)
const conversations = new Map();

app.post("/ai", async (req, res) => {
  try {
    const { query, page, conversationId } = req.body;

    if (!query) {
      return res.status(400).json({
        action: "explain",
        answer: "Please ask me something!"
      });
    }

    console.log("\n" + "=".repeat(70));
    console.log("🤖 AI CHATBOT MODE");
    console.log("📝 Query:", query);
    console.log("📄 Page:", page?.title || page?.url || "Unknown");
    console.log("🌐 URL:", page?.url || "Unknown");
    console.log("🆔 Conversation:", conversationId || "new");

    // Get conversation history
    const history = conversations.get(conversationId) || [];

    // Get available items from page
    const allLinks = (page?.links || [])
      .map(l => l.text)
      .filter(t => t && t.length > 0 && t.length < 100);
    
    const allButtons = (page?.buttons || [])
      .filter(t => t && t.length > 0 && t.length < 100);
    
    const allItems = [...new Set([...allLinks, ...allButtons])];

    console.log("📊 Available items:", allItems.length);

    if (!openai) {
      return res.status(503).json({
        action: "explain",
        answer: "⚠️ AI is not configured. Please add OPENAI_API_KEY to the .env file to enable intelligent responses."
      });
    }

    // Determine page context
    const pageContext = page?.title || page?.url || "this page";
    const pageDescription = page?.title ? `on ${page.title}` : `at ${page.url}`;

    // Build AI prompt
    const systemPrompt = `You are an intelligent website navigation assistant chatbot. You help users by:
1. ANSWERING their questions about the website
2. NAVIGATING them to the right pages when they ask
3. HAVING natural conversations
4. UNDERSTANDING context and intent

CURRENT PAGE CONTEXT:
- Page: ${pageContext}
- URL: ${page?.url || "Unknown"}
- Available links/buttons on this page:
${allItems.slice(0, 80).map((item, i) => `  ${i + 1}. ${item}`).join('\n')}

IMPORTANT INSTRUCTIONS:

When user wants to NAVIGATE (asks to "go to", "show me", "take me to", "open", "find"):
- Respond with JSON: {"action": "navigate", "target": "EXACT_TEXT_FROM_LIST", "message": "Taking you to [destination]"}
- The "target" MUST be EXACTLY one of the items from the list above (copy it precisely)
- Be smart about matching: "pricing" can match "View Pricing Plans", "login" matches "Sign In", etc.

When user asks QUESTIONS (asks "what", "how", "why", "explain", "tell me about"):
- Respond with JSON: {"action": "explain", "answer": "Your helpful conversational response"}
- Answer based on what's available ${pageDescription}
- Be conversational and friendly
- Provide useful information

When user wants HELP or exploration:
- Show them what's available on the page
- Suggest relevant sections
- Be helpful and guide them

RESPONSE FORMAT - ALWAYS JSON:
{"action": "navigate", "target": "exact text", "message": "friendly message"}
OR
{"action": "explain", "answer": "conversational response"}

CRITICAL RULES:
1. ALWAYS respond with valid JSON (no markdown, no extra text)
2. For navigation, "target" must be EXACT text from the available list
3. Be conversational and natural in messages
4. Understand synonyms: "price" = "pricing" = "cost" = "plans"
5. Be intelligent about matching: don't require exact keywords
6. If unsure, ASK the user or suggest alternatives

Remember: You're a smart assistant who understands context and can have real conversations!`;

    // Build messages including history
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history (last 5 messages)
    history.slice(-5).forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // Add current query
    messages.push({ role: "user", content: query });

    console.log("🧠 Sending to OpenAI with", messages.length, "messages...");

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7, // More creative for conversation
      max_tokens: 500,
      response_format: { type: "json_object" } // Force JSON response
    });

    const aiResponse = response.choices[0]?.message?.content?.trim();
    console.log("🤖 AI Response:", aiResponse);

    if (!aiResponse) {
      throw new Error("Empty response from AI");
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch (e) {
      console.error("❌ Failed to parse JSON:", e.message);
      console.log("Raw response:", aiResponse);
      throw new Error("Invalid AI response format");
    }

    // Update conversation history
    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: aiResponse });
    conversations.set(conversationId || Date.now().toString(), history);

    // Validate and return response
    if (parsed.action === "navigate") {
      if (!parsed.target) {
        console.log("⚠️ No target specified, converting to explanation");
        return res.json({
          action: "explain",
          answer: parsed.message || "I'm not sure where to navigate. Can you be more specific?"
        });
      }

      // Verify target exists (case-insensitive)
      const targetExists = allItems.some(item => 
        item.toLowerCase() === parsed.target.toLowerCase()
      );

      if (!targetExists) {
        // Find closest match
        const closest = allItems.find(item =>
          item.toLowerCase().includes(parsed.target.toLowerCase()) ||
          parsed.target.toLowerCase().includes(item.toLowerCase())
        );

        if (closest) {
          console.log("✅ Found close match:", closest);
          return res.json({
            action: "navigate",
            target: closest,
            message: parsed.message || `Taking you to ${closest}`
          });
        }

        console.log("⚠️ Target not found, returning explanation");
        return res.json({
          action: "explain",
          answer: `I couldn't find "${parsed.target}" on this page. Available options: ${allItems.slice(0, 8).join(", ")}. Which one would you like?`
        });
      }

      console.log("✅ Navigation:", parsed.target);
      return res.json(parsed);
    } 
    else if (parsed.action === "explain") {
      console.log("💬 Explanation provided");
      return res.json(parsed);
    }
    else {
      console.log("⚠️ Unknown action:", parsed.action);
      return res.json({
        action: "explain",
        answer: parsed.answer || parsed.message || "I'm not sure how to help with that. Can you rephrase?"
      });
    }

  } catch (err) {
    console.error("❌ Server error:", err);
    
    if (err.message.includes("API key")) {
      return res.status(401).json({
        action: "explain",
        answer: "⚠️ OpenAI API key is invalid. Please check your .env file."
      });
    }

    if (err.message.includes("quota")) {
      return res.status(429).json({
        action: "explain",
        answer: "⚠️ OpenAI quota exceeded. Please check your OpenAI account billing."
      });
    }

    res.status(500).json({
      action: "explain",
      answer: "Sorry, I encountered an error. Please try again."
    });
  }
});

// Clear conversation history endpoint
app.post("/clear", (req, res) => {
  const { conversationId } = req.body;
  if (conversationId) {
    conversations.delete(conversationId);
  }
  res.json({ success: true });
});

app.listen(port, () => {
  console.log("=".repeat(70));
  console.log("🤖 TRUE AI CHATBOT SERVER");
  console.log("🚀 Running at http://localhost:" + port);
  console.log("🧠 AI Status:", openai ? "ENABLED ✅" : "DISABLED ❌");
  console.log("💬 Mode:", openai ? "Intelligent Conversation + Navigation" : "Fallback");
  console.log("=".repeat(70));
});