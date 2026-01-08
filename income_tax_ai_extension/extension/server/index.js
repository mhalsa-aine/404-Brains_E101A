import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = 3000;

// Initialize OpenAI (optional - falls back to rules if not configured)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log("✅ OpenAI API initialized");
} else {
  console.log("⚠️ No OpenAI API key found, using rule-based fallback");
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ 
    status: "running",
    aiEnabled: !!openai 
  });
});

// Enhanced AI endpoint with OpenAI integration
app.post("/ai", async (req, res) => {
  try {
    const { query, page } = req.body;

    if (!query) {
      return res.status(400).json({
        action: "explain",
        answer: "No query received."
      });
    }

    console.log("Query:", query);
    console.log("Page:", page?.title);

    // Try OpenAI first if available
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a website navigation assistant. Analyze the page structure and help users navigate or understand the website.

Page Information:
- Title: ${page?.title || "Unknown"}
- URL: ${page?.url || "Unknown"}
- Available Links: ${page?.links?.map(l => l.text).join(", ") || "None"}
- Available Buttons: ${page?.buttons?.join(", ") || "None"}
- Headings: ${page?.headings?.join(", ") || "None"}

Respond in JSON format with one of these actions:
1. {"action": "navigate", "target": "keyword"} - to navigate to a specific section
2. {"action": "explain", "answer": "your explanation"} - to explain something

Keep explanations concise and helpful.`
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.7,
          max_tokens: 200
        });

        const aiResponse = response.choices[0]?.message?.content;
        
        if (aiResponse) {
          // Try to parse JSON response
          try {
            const parsed = JSON.parse(aiResponse);
            return res.json(parsed);
          } catch {
            // If not JSON, treat as explanation
            return res.json({
              action: "explain",
              answer: aiResponse
            });
          }
        }
      } catch (aiError) {
        console.error("OpenAI error:", aiError.message);
        // Fall through to rule-based system
      }
    }

    // Rule-based fallback
    const q = query.toLowerCase();

    // Navigation rules
    const navigationRules = [
      { keywords: ["login", "sign in", "log in"], target: "login" },
      { keywords: ["register", "sign up", "create account"], target: "register" },
      { keywords: ["profile", "account", "my account"], target: "profile" },
      { keywords: ["dashboard", "home"], target: "dashboard" },
      { keywords: ["contact", "contact us", "get in touch"], target: "contact" },
      { keywords: ["help", "support", "faq"], target: "help" },
      { keywords: ["about", "about us"], target: "about" },
      { keywords: ["cart", "shopping cart", "basket"], target: "cart" },
      { keywords: ["checkout", "pay", "payment"], target: "checkout" },
      { keywords: ["search"], target: "search" }
    ];

    for (const rule of navigationRules) {
      if (rule.keywords.some(keyword => q.includes(keyword))) {
        return res.json({
          action: "navigate",
          target: rule.target
        });
      }
    }

    // Information queries
    if (q.includes("what") || q.includes("where") || q.includes("how")) {
      const pageInfo = [];
      
      if (page?.title) {
        pageInfo.push(`This is the "${page.title}" page.`);
      }
      
      if (page?.links?.length > 0) {
        const topLinks = page.links.slice(0, 5).map(l => l.text).join(", ");
        pageInfo.push(`Available sections: ${topLinks}`);
      }
      
      if (page?.buttons?.length > 0) {
        const topButtons = page.buttons.slice(0, 3).join(", ");
        pageInfo.push(`Actions available: ${topButtons}`);
      }

      return res.json({
        action: "explain",
        answer: pageInfo.length > 0 
          ? pageInfo.join(" ") 
          : "I can help you navigate this website. Try asking me to go to login, profile, or any section you see."
      });
    }

    // Default response
    return res.json({
      action: "explain",
      answer: "I can help you navigate this website. Try asking me to 'go to login' or 'show me the contact page'."
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({
      action: "explain",
      answer: "Internal server error. Please try again."
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 AI server running at http://localhost:${port}`);
});