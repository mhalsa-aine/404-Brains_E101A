import express from "express";
import cors from "cors";
import OpenAI from "openai";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/ai", async (req, res) => {
  const { query, page } = req.body;

  const prompt = `
You are an AI website assistant.

User query:
"${query}"

Website data:
Title: ${page.title}
Headings: ${page.headings.join(", ")}
Links: ${page.links.join(", ")}
Buttons: ${page.buttons.join(", ")}

Decide what to do.

Respond ONLY in JSON.
If navigation needed:
{"action":"navigate","target":"Orders"}

Else:
{"action":"explain","answer":"..."}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  res.json(JSON.parse(completion.choices[0].message.content));
});

app.listen(3000, () =>
  console.log("AI server running at http://localhost:3000")
);
