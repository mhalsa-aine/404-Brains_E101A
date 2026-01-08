console.log("🚀 AI Website Assistant loaded");

function extractPageStructure() {
  const links = [];
  const buttons = [];
  
  // Get all links
  document.querySelectorAll("a").forEach(a => {
    const text = (a.innerText || a.textContent || "").trim();
    if (text && text.length > 0 && text.length < 100) {
      links.push({
        text: text,
        href: a.href,
        element: a
      });
    }
  });
  
  // Get all buttons
  document.querySelectorAll("button, input[type='button'], input[type='submit']").forEach(b => {
    const text = (b.innerText || b.textContent || b.value || "").trim();
    if (text && text.length > 0 && text.length < 100) {
      buttons.push(text);
    }
  });
  
  // Get page title with better fallback
  let pageTitle = document.title;
  if (!pageTitle || pageTitle.trim() === "") {
    // Try to get from meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    
    if (ogTitle && ogTitle.content) {
      pageTitle = ogTitle.content;
    } else if (twitterTitle && twitterTitle.content) {
      pageTitle = twitterTitle.content;
    } else {
      // Use domain name as fallback
      pageTitle = window.location.hostname.replace('www.', '');
    }
  }
  
  console.log("✅ Found:", links.length, "links,", buttons.length, "buttons");
  console.log("📄 Page title:", pageTitle);
  
  return {
    title: pageTitle,
    url: location.href,
    links: links.map(l => ({ text: l.text, href: l.href })),
    buttons: buttons
  };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "PING") {
    sendResponse({ status: "ok" });
    return true;
  }

  if (req.type === "GET_PAGE_STRUCTURE") {
    const structure = extractPageStructure();
    sendResponse(structure);
    return true;
  }

  if (req.type === "PERFORM_ACTION") {
    const target = req.target.toLowerCase();
    console.log("🎯 Looking for:", target);

    // Find all clickable elements
    const allElements = document.querySelectorAll("a, button, input[type='button'], input[type='submit']");
    
    let bestMatch = null;
    let bestScore = 0;

    allElements.forEach(el => {
      const text = (el.innerText || el.textContent || el.value || "").toLowerCase().trim();
      
      if (!text) return;
      
      let score = 0;
      
      // Exact match
      if (text === target) {
        score = 100;
      }
      // Text contains target
      else if (text.includes(target)) {
        score = 80;
      }
      // Target contains text
      else if (target.includes(text)) {
        score = 60;
      }
      // Word match
      else {
        const targetWords = target.split(/\s+/);
        const textWords = text.split(/\s+/);
        const matches = targetWords.filter(w => textWords.includes(w));
        if (matches.length > 0) {
          score = 40 + (matches.length * 10);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    });

    if (bestMatch && bestScore >= 40) {
      console.log("✅ Found:", bestMatch.innerText || bestMatch.value, "Score:", bestScore);
      
      // Highlight
      bestMatch.style.outline = "3px solid #007bff";
      bestMatch.style.outlineOffset = "2px";
      bestMatch.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Click after delay
      setTimeout(() => {
        if (bestMatch.tagName === 'A' && bestMatch.href) {
          // For links, navigate directly
          window.location.href = bestMatch.href;
        } else {
          // For buttons, click them
          bestMatch.click();
        }
      }, 500);
      
      sendResponse({ success: true });
    } else {
      console.log("❌ Not found:", target);
      sendResponse({ success: false });
    }
    
    return true;
  }
});