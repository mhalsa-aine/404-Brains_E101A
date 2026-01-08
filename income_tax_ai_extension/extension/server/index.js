import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const GROK_API_KEY = process.env.GROK_API_KEY;

/* Health check */
app.get("/", (req, res) => {
  res.json({ status: "running", ai: true });
});

/* Call Grok */
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
            "You are a website navigation AI. Respond ONLY with valid JSON."
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
      ...(page.links || []).map(l => l.text),
      ...(page.buttons || [])
    ].filter(Boolean);

    const prompt = `
WEBSITE TITLE: ${page.title}
URL: ${page.url}

CLICKABLE ITEMS:
${items.slice(0, 60).join("\n")}

USER INPUT:
"${query}"

YOUR TASK:
1. Understand user intent (not exact words).
2. login → sign in / account / create account
3. signup → register / create account
4. cart → basket / bag
5. If navigation makes sense, navigate.
6. ALSO explain in simple words.

RESPONSE FORMAT (JSON ONLY):

If navigation is needed:
{
  "action": "navigate",
  "target": "BEST MATCH FROM CLICKABLE ITEMS",
  "message": "Navigating for you",
  "answer": "Explanation"
}

If only explanation:
{
  "action": "explain",
  "answer": "Helpful explanation"
}
`;

    const aiText = await askGrok(prompt);

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const match = aiText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed) throw new Error("Invalid AI response");

    res.json(parsed);
  } catch (err) {
    res.json({
      action: "explain",
      answer: "Sorry, I couldn’t understand that."
    });
  }
});

app.listen(PORT, () => {
  console.log("🤖 GROK AI SERVER RUNNING");
  console.log("🌐 http://localhost:" + PORT);
});
