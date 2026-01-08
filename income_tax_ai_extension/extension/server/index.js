import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = 3000;

// 🔴 REQUIRED FOR CHROME EXTENSIONS
app.use(cors());
app.use(express.json());

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY missing in .env");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get("/", (req, res) => {
  res.send("AI server is running");
});

// MAIN AI ENDPOINT
app.post("/ai", async (req, res) => {
  try {
    const { query, page } = req.body;

    if (!query || !page) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a website navigation assistant. Decide whether to navigate or explain."
        },
        {
          role: "user",
          content: `
User query: ${query}

Website structure:
${JSON.stringify(page).slice(0, 8000)}
          `
        }
      ]
    });

    const text = completion.choices[0].message.content.toLowerCase();

    if (text.includes("click") || text.includes("navigate")) {
      res.json({
        action: "navigate",
        target: query
      });
    } else {
      res.json({
        action: "explain",
        answer: completion.choices[0].message.content
      });
    }
  } catch (err) {
    console.error("❌ AI error:", err.message);
    res.status(500).json({ error: "AI processing failed" });
  }
});

app.listen(port, () => {
  console.log(`✅ AI server running at http://localhost:${port}`);
});

