import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const GROK_API_KEY = process.env.GROK_API_KEY;

/* Health check */
app.get("/", (req, res) => {
  res.json({
    status: "running",
    ai: !!GROK_API_KEY,
    provider: "GROK (xAI)"
  });
});

/* Grok call */
async function askGrok(prompt) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: "grok-2-latest",
      messages: [
        {
          role: "system",
          content:
            "You are a website assistant. Respond ONLY with valid JSON."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 500
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/* AI endpoint */
app.post("/ai", async (req, res) => {
  try {
    const { query, page } = req.body;
    if (!query) {
      return res.json({
        action: "explain",
        answer: "Please ask something."
      });
    }

    const items = [
      ...(page?.links || []).map(l => l.text),
      ...(page?.buttons || [])
    ].filter(Boolean);

    const prompt = `
WEBSITE: ${page?.title}
URL: ${page?.url}

ITEMS:
${items.slice(0, 40).join("\n")}

USER QUERY: "${query}"

RULES:
- Navigation → {"action":"navigate","target":"EXACT_TEXT","message":"Navigating"}
- Question → {"action":"explain","answer":"Helpful answer"}

JSON ONLY
`;

    const aiText = await askGrok(prompt);

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const match = aiText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!parsed?.action) throw new Error("Bad AI response");

    res.json(parsed);
  } catch (err) {
    res.status(500).json({
      action: "explain",
      answer: "AI error. Try again."
    });
  }
});

app.listen(port, () => {
  console.log("🤖 GROK AI SERVER RUNNING");
  console.log("🌐 http://localhost:" + port);
});
