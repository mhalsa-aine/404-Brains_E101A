import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ status: "running" });
});

// Simple but smart matching
function findBestMatch(query, items) {
  const q = query.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  console.log(`\n🔍 Searching for: "${q}"`);
  console.log(`📦 In ${items.length} items`);

  for (const item of items) {
    if (!item) continue;
    
    const itemLower = item.toLowerCase().trim();
    let score = 0;

    // Exact match
    if (itemLower === q) {
      score = 100;
      console.log(`  ✅ EXACT: "${item}"`);
    }
    // Item contains query
    else if (itemLower.includes(q)) {
      score = 80;
      console.log(`  ✓ Contains: "${item}"`);
    }
    // Query contains item (for short items)
    else if (itemLower.length >= 3 && q.includes(itemLower)) {
      score = 60;
      console.log(`  ~ Partial: "${item}"`);
    }
    // Word overlap
    else {
      const qWords = q.split(/\s+/);
      const iWords = itemLower.split(/\s+/);
      const overlap = qWords.filter(w => iWords.includes(w));
      if (overlap.length > 0) {
        score = 40 + (overlap.length * 10);
        console.log(`  - Words match (${overlap.length}): "${item}"`);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && bestScore >= 40) {
    console.log(`\n🎯 BEST MATCH: "${bestMatch}" (score: ${bestScore})`);
    return bestMatch;
  }
  
  console.log(`\n❌ No good match found`);
  return null;
}

app.post("/ai", async (req, res) => {
  try {
    const { query, page } = req.body;

    if (!query) {
      return res.status(400).json({
        action: "explain",
        answer: "No query provided."
      });
    }

    console.log("\n" + "=".repeat(50));
    console.log("📝 Query:", query);
    console.log("📄 Page:", page?.title);

    // Get all available items
    const allLinks = (page?.links || []).map(l => l.text).filter(Boolean);
    const allButtons = (page?.buttons || []).filter(Boolean);
    const allItems = [...allLinks, ...allButtons];

    console.log("📊 Available:", allLinks.length, "links,", allButtons.length, "buttons");

    // Remove common filler words
    let cleanQuery = query.toLowerCase()
      .replace(/^(go to|navigate to|take me to|show me|open|find|where is|click|access)\s+/i, '')
      .replace(/\b(the|a|an|page|section)\b/g, '')
      .trim();

    console.log("🧹 Clean query:", cleanQuery);

    // Try to find a match
    const match = findBestMatch(cleanQuery, allItems);

    if (match) {
      return res.json({
        action: "navigate",
        target: match
      });
    }

    // If no match, check if it's an info query
    if (query.toLowerCase().includes("what") || 
        query.toLowerCase().includes("where") ||
        query.toLowerCase().includes("help")) {
      
      const topItems = allItems.slice(0, 10).join(", ");
      return res.json({
        action: "explain",
        answer: `Available on this page: ${topItems}`
      });
    }

    // No match and not info query
    return res.json({
      action: "explain",
      answer: `I couldn't find "${cleanQuery}". Available: ${allItems.slice(0, 8).join(", ")}`
    });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({
      action: "explain",
      answer: "Server error."
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});