import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const GROK_API_KEY = process.env.GROK_API_KEY;

// ✅ Health check
app.get("/", (req, res) => {
  res.json({
    status: "running",
    ai: !!GROK_API_KEY,
    provider: "GROK (xAI)"
  });
});

// 🧠 Grok API call
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
            "You are a website navigation assistant. Respond ONLY with valid JSON. No markdown. No explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 600
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// 🎯 MAIN AI ENDPOINT
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
${items.slice(0, 50).join("\n")}

USER QUERY: "${query}"

RULES:
- If navigation → { "action":"navigate","target":"EXACT_TEXT","message":"..." }
- If question → { "action":"explain","answer":"..." }

RESPOND ONLY JSON
`;

    const aiText = await askGrok(prompt);

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const match = aiText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!parsed?.action) throw new Error("Invalid AI JSON");

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      action: "explain",
      answer: "AI error. Please try again."
    });
  }
});

app.listen(port, () => {
  console.log("==================================");
  console.log("🤖 GROK AI SERVER RUNNING");
  console.log("🌐 http://localhost:" + port);
  console.log("==================================");
});
