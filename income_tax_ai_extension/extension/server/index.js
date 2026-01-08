import express from "express";
import cors from "cors";

const app = express();
const port = 3000;

// Allow requests from Chrome extension
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("AI server is running");
});

// ===============================
// AI EXPLANATION ENDPOINT
// ===============================
app.post("/ai", (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.json({
        action: "explain",
        answer: "Please ask something about this website."
      });
    }

    const q = query.toLowerCase();

    // UNIVERSAL GUIDANCE (WORKS ON ALL WEBSITES)

    if (q.includes("help") || q.includes("support")) {
      return res.json({
        action: "explain",
        answer:
          "Most websites provide help or support sections. These are usually found in the footer, top navigation menu, or under links like Help, Support, FAQ, or Contact Us."
      });
    }

    if (q.includes("login") || q.includes("sign in")) {
      return res.json({
        action: "explain",
        answer:
          "Login or Sign In options are typically located at the top right corner of the website or inside the main navigation menu."
      });
    }

    if (q.includes("profile") || q.includes("account")) {
      return res.json({
        action: "explain",
        answer:
          "Profile or account settings are usually available after logging in, under a user icon or account menu."
      });
    }

    if (q.includes("contact")) {
      return res.json({
        action: "explain",
        answer:
          "Contact information is usually available in the footer of the website or under a section called Contact Us."
      });
    }

    if (q.includes("announcement") || q.includes("news")) {
      return res.json({
        action: "explain",
        answer:
          "Announcements or news are often displayed on the homepage or under sections like News, Updates, or Announcements."
      });
    }

    // DEFAULT RESPONSE
    return res.json({
      action: "explain",
      answer:
        "This assistant understands the structure of the website and guides users step by step to find relevant sections without requiring prior knowledge of the site."
    });

  } catch (error) {
    return res.json({
      action: "explain",
      answer: "An internal error occurred while processing your request."
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`AI server running at http://localhost:${port}`);
});



