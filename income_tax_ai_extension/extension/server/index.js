import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

// Allow Chrome extension + localhost
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.send("AI server is running");
});

// ===============================
// AI / FALLBACK ENDPOINT
// ===============================
app.post("/ai", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        action: "explain",
        answer: "No query received."
      });
    }

    const q = query.toLowerCase();

    // -------- NAVIGATION RULES --------
    if (q.includes("login") || q.includes("sign in")) {
      return res.json({
        action: "navigate",
        target: "login"
      });
    }

    if (q.includes("profile") || q.includes("account")) {
      return res.json({
        action: "navigate",
        target: "profile"
      });
    }

    if (q.includes("dashboard")) {
      return res.json({
        action: "navigate",
        target: "dashboard"
      });
    }

    if (q.includes("contact")) {
      return res.json({
        action: "navigate",
        target: "contact"
      });
    }

    if (q.includes("help") || q.includes("support")) {
      return res.json({
        action: "navigate",
        target: "help"
      });
    }

    // -------- DEFAULT EXPLANATION --------
    return res.json({
      action: "explain",
      answer:
        "This AI assistant understands the structure of the website and helps users navigate to the correct sections or explains how to complete tasks step by step, without requiring prior knowledge of the site."
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({
      action: "explain",
      answer: "Internal server error."
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`AI server running at http://localhost:${port}`);
});


