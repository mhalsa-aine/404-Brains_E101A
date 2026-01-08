import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = 3000;

// Initialize OpenAI
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log("✅ OpenAI API initialized");
} else {
  console.log("⚠️ No OpenAI API key - using intelligent fallback");
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ 
    status: "running",
    aiEnabled: !!openai 
  });
});

// Smart matching function
function findBestMatch(query, availableItems) {
  const q = query.toLowerCase().trim();
  const matches = [];

  console.log(`\n🔍 Searching for: "${q}"`);
  console.log(`📦 Searching in ${availableItems.length} items`);

  for (const item of availableItems) {
    if (!item || typeof item !== 'string') continue;
    
    const itemLower = item.toLowerCase().trim();
    
    // Skip if item is too short or empty
    if (itemLower.length === 0) continue;
    
    // Exact match - highest priority
    if (itemLower === q) {
      console.log(`  ✅ EXACT match: "${item}" (score: 100)`);
      matches.push({ item, score: 100 });
      continue;
    }
    
    // Exact word match in item
    const itemWords = itemLower.split(/\s+/);
    if (itemWords.includes(q)) {
      console.log(`  ✅ WORD match: "${item}" (score: 95)`);
      matches.push({ item, score: 95 });
      continue;
    }
    
    // Item contains query (only if query is substantial)
    if (q.length >= 3 && itemLower.includes(q)) {
      const score = 80 + (q.length / itemLower.length) * 10;
      console.log(`  ✓ Contains: "${item}" (score: ${score.toFixed(0)})`);
      matches.push({ item, score });
      continue;
    }
    
    // Query contains item (be more strict)
    if (itemLower.length >= 4 && q.includes(itemLower)) {
      const score = 60 + (itemLower.length / q.length) * 10;
      console.log(`  ~ Contained in query: "${item}" (score: ${score.toFixed(0)})`);
      matches.push({ item, score });
      continue;
    }
    
    // Word overlap (only for multi-word queries)
    const queryWords = q.split(/\s+/);
    if (queryWords.length > 1) {
      const overlap = queryWords.filter(w => 
        w.length >= 3 && itemWords.some(iw => iw.includes(w) || w.includes(iw))
      );
      
      if (overlap.length > 0) {
        const score = 40 + (overlap.length * 15);
        console.log(`  - Word overlap: "${item}" (score: ${score}, words: ${overlap.join(',')})`);
        matches.push({ item, score });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  
  if (matches.length > 0) {
    console.log(`\n🎯 Best match: "${matches[0].item}" with score ${matches[0].score}`);
    if (matches.length > 1) {
      console.log(`   Alternatives:`, matches.slice(1, 4).map(m => `"${m.item}" (${m.score})`).join(', '));
    }
  } else {
    console.log(`\n❌ No matches found for "${q}"`);
  }
  
  // Only return if score is good enough
  return matches.length > 0 && matches[0].score >= 50 ? matches[0].item : null;
}

// Enhanced AI endpoint
app.post("/ai", async (req, res) => {
  try {
    const { query, page } = req.body;

    if (!query) {
      return res.status(400).json({
        action: "explain",
        answer: "No query received."
      });
    }

    console.log("\n📝 Query:", query);
    console.log("📄 Page:", page?.title);
    console.log("🔗 Available links:", page?.links?.length || 0);
    console.log("🔘 Available buttons:", page?.buttons?.length || 0);

    const q = query.toLowerCase();

    // Check if it's a navigation intent
    const navigationWords = [
      'go to', 'navigate to', 'take me to', 'show me', 'open', 
      'find', 'where is', 'how to get to', 'click', 'access'
    ];
    
    const isNavigationQuery = navigationWords.some(word => q.includes(word));
    
    // Try OpenAI if available
    if (openai) {
      try {
        const linksList = page?.links?.slice(0, 30).map(l => l.text).join(", ") || "None";
        const buttonsList = page?.buttons?.slice(0, 20).join(", ") || "None";
        const headingsList = page?.headings?.slice(0, 10).join(", ") || "None";

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a website navigation assistant. Analyze the page and help users.

Page: ${page?.title || "Unknown"}
URL: ${page?.url || "Unknown"}

Available sections/links: ${linksList}
Available buttons: ${buttonsList}
Page headings: ${headingsList}

User query: "${query}"

Determine:
1. If user wants to NAVIGATE somewhere - respond with: {"action": "navigate", "target": "exact_link_or_button_text_from_above", "explanation": "brief reason"}
2. If user wants INFORMATION - respond with: {"action": "explain", "answer": "helpful explanation based on what's available on this page"}

Rules:
- For navigation, "target" MUST be exact text from available links/buttons above
- Be smart about synonyms (e.g., "sign in" = "login", "my account" = "profile")
- If exact match not found, use closest related link
- Keep explanations under 100 words`
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.3,
          max_tokens: 250
        });

        const aiResponse = response.choices[0]?.message?.content;
        console.log("🤖 AI Response:", aiResponse);
        
        if (aiResponse) {
          try {
            const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, ''));
            
            // Validate the target exists
            if (parsed.action === "navigate" && parsed.target) {
              const allItems = [
                ...(page?.links?.map(l => l.text) || []),
                ...(page?.buttons || [])
              ].filter(Boolean);
              
              const bestMatch = findBestMatch(parsed.target, allItems);
              
              if (bestMatch) {
                return res.json({
                  action: "navigate",
                  target: bestMatch,
                  explanation: parsed.explanation
                });
              }
            }
            
            return res.json(parsed);
          } catch (parseError) {
            console.log("Failed to parse AI JSON, treating as explanation");
            return res.json({
              action: "explain",
              answer: aiResponse
            });
          }
        }
      } catch (aiError) {
        console.error("OpenAI error:", aiError.message);
        // Fall through to intelligent fallback
      }
    }

    // INTELLIGENT FALLBACK SYSTEM
    console.log("Using intelligent fallback...");

    // Extract intent and keywords from query
    let extractedKeywords = q
      .replace(/^(go to|navigate to|take me to|show me|open|find|where is|how to get to|click|access)\s+/i, '')
      .replace(/\b(the|a|an|page|section|area)\b/g, '')
      .trim();

    console.log("🔍 Extracted keywords:", extractedKeywords);

    // Common aliases for better matching
    const aliases = {
      'signin': 'sign in',
      'signup': 'sign up',
      'log in': 'login',
      'log out': 'logout',
      'my account': 'account',
      'shopping bag': 'cart',
      'shopping basket': 'cart',
      'check out': 'checkout'
    };

    // Apply aliases
    if (aliases[extractedKeywords]) {
      console.log(`🔄 Using alias: "${extractedKeywords}" → "${aliases[extractedKeywords]}"`);
      extractedKeywords = aliases[extractedKeywords];
    }

    // Get all available navigation items
    const allLinks = (page?.links || []).map(l => l.text).filter(Boolean);
    const allButtons = (page?.buttons || []).filter(Boolean);
    const allNavItems = (page?.navItems || []).filter(Boolean);
    
    // Aggressive filter function to remove junk
    const isCleanText = (text) => {
      if (!text || typeof text !== 'string') return false;
      text = text.trim();
      
      // Basic filters
      if (text.length === 0 || text.length > 100) return false;
      
      // Multi-line = likely code
      if (text.split('\n').length > 2) return false;
      
      // Normalize whitespace for checking
      const normalized = text.replace(/\s+/g, ' ').toLowerCase();
      
      // Filter CSS/code patterns
      const badPatterns = [
        '{', '}', 'fill:', 'rgba', 'rgb(', 'cls-', 'shp',
        'white-space', 'tspan', 'prefix__', 'xmlns',
        'opacity:', 'display:', 'px;', 'em;', 'none;',
        'stroke:', 'transform:', 'viewbox', 'path d='
      ];
      
      if (badPatterns.some(pattern => normalized.includes(pattern))) {
        console.log(`  ❌ Filtered out (contains "${badPatterns.find(p => normalized.includes(p))}"): "${text.substring(0, 50)}..."`);
        return false;
      }
      
      // Must have at least 2 letters
      if (!/[a-zA-Z]{2,}/.test(text)) return false;
      
      // Filter style/script keywords
      if (/^(function|var|const|let|return|if|else)\s/i.test(text)) return false;
      
      return true;
    };
    
    // Combine and clean all items
    const cleanedLinks = allLinks.filter(isCleanText);
    const cleanedButtons = allButtons.filter(isCleanText);
    const cleanedNavItems = allNavItems.filter(isCleanText);
    
    console.log(`🧹 Cleaned: ${allLinks.length}→${cleanedLinks.length} links, ${allButtons.length}→${cleanedButtons.length} buttons, ${allNavItems.length}→${cleanedNavItems.length} nav`);
    
    const allItems = [
      ...cleanedNavItems,
      ...cleanedButtons,
      ...cleanedLinks
    ];
    
    // Remove duplicates while preserving order
    const uniqueItems = [...new Set(allItems)];

    console.log("🎯 Total unique clean items:", uniqueItems.length);
    console.log("📋 Clean sample:", uniqueItems.slice(0, 10).join(" | "));

    // Try to find best match
    const bestMatch = findBestMatch(extractedKeywords, uniqueItems);

    if (bestMatch) {
      console.log("✅ Final match decision:", bestMatch);
      return res.json({
        action: "navigate",
        target: bestMatch
      });
    }

    // If no match found but it's a navigation query
    if (isNavigationQuery) {
      const suggestions = uniqueItems.slice(0, 5).join(", ");
      console.log("❌ No match found. Suggestions:", suggestions);
      return res.json({
        action: "explain",
        answer: `I couldn't find "${extractedKeywords}" on this page. Available sections include: ${suggestions}. Try asking about one of these.`
      });
    }

    // Information query
    if (q.includes("what") || q.includes("where") || q.includes("how") || q.includes("which")) {
      const info = [];
      
      if (page?.title) {
        info.push(`You're on the "${page.title}" page.`);
      }
      
      if (uniqueItems.length > 0) {
        const topItems = uniqueItems.slice(0, 8).join(", ");
        info.push(`Available sections: ${topItems}`);
      }

      return res.json({
        action: "explain",
        answer: info.join(" ")
      });
    }

    // General query - try to be helpful
    return res.json({
      action: "explain",
      answer: `I can help you navigate this page. Available options: ${uniqueItems.slice(0, 6).join(", ")}. What would you like to do?`
    });

  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({
      action: "explain",
      answer: "Internal server error. Please try again."
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 AI server running at http://localhost:${port}`);
  console.log(`📊 OpenAI: ${openai ? 'Enabled' : 'Disabled (using smart fallback)'}`);
});