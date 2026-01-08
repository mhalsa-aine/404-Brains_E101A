import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const GROK_API_KEY = process.env.GROK_API_KEY;

/* Health check */
app.get("/", (req, res) => {
  res.json({ status: "running", ai: true, provider: "Grok" });
});

/* Grok call */
async function askGrok(prompt) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: "grok-2-latest",
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a website assistant. Respond ONLY with valid JSON."
        },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await res.json();
  return data.choices[0].message.content;
}

/* AI endpoint */
app.post("/ai", async (req, res) => {
  try {
    const { query, page } = req.body;

    const items = [
      ...(page?.links || []).map(l => l.text),
      ...(page?.buttons || [])
    ].filter(Boolean);

    const prompt = `
WEBSITE: ${page?.title}
URL: ${page?.url}

VISIBLE ITEMS:
${items.slice(0, 60).join("\n")}

USER INPUT:
"${query}"

TASK:
- Understand intent, not exact words
- login → sign in / sign up / account
- signup → register / create account
- If navigation makes sense, navigate
- ALSO explain briefly

JSON FORMAT:

If navigate:
{
  "action": "navigate",
  "target": "BEST_MATCH_FROM_ITEMS",
  "message": "Navigating for you",
  "answer": "Explanation"
}

Else:
{
  "action": "explain",
  "answer": "Helpful answer"
}

JSON ONLY.
`;

    const aiText = await askGrok(prompt);

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const match = aiText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    res.json(parsed);
  } catch {
    res.json({
      action: "explain",
      answer: "I couldn’t understand that. Try again."
    });
  }
});

app.listen(PORT, () => {
  console.log("🤖 GROK AI SERVER RUNNING");
  console.log("🌐 http://localhost:" + PORT);
});
