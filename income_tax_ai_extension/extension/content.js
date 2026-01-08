// Wrap in IIFE to avoid conflicts
(function() {
  console.log("🚀 AI Website Assistant content script loaded on:", location.href);

  function extractPageStructure() {
    try {
      const structure = {
        title: document.title || "Untitled",
        url: location.href,
        headings: [...document.querySelectorAll("h1, h2, h3")]
          .map(h => h.innerText.trim())
          .filter(Boolean)
          .slice(0, 20),
        links: [...document.querySelectorAll("a")]
          .map(a => ({
            text: a.innerText.trim(),
            href: a.href
          }))
          .filter(l => l.text && l.text.length > 0)
          .slice(0, 50),
        buttons: [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a.btn, .button")]
          .map(b => b.innerText.trim() || b.value || b.getAttribute("aria-label") || "")
          .filter(Boolean)
          .slice(0, 20),
        forms: [...document.querySelectorAll("form")].map(f => ({
          action: f.action,
          method: f.method,
          inputs: [...f.querySelectorAll("input, select, textarea")]
            .map(i => ({
              type: i.type,
              name: i.name,
              placeholder: i.placeholder
            }))
        })).slice(0, 5)
      };
      
      console.log("✅ Extracted structure:", {
        title: structure.title,
        linkCount: structure.links.length,
        buttonCount: structure.buttons.length,
        headingCount: structure.headings.length
      });
      
      return structure;
    } catch (error) {
      console.error("❌ Error extracting structure:", error);
      return {
        title: document.title || "Error",
        url: location.href,
        headings: [],
        links: [],
        buttons: [],
        forms: []
      };
    }
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    console.log("📨 Content script received message:", req.type);

    if (req.type === "PING") {
      console.log("✅ PING received");
      sendResponse({ status: "ok" });
      return true;
    }

    if (req.type === "GET_PAGE_STRUCTURE") {
      try {
        const structure = extractPageStructure();
        sendResponse(structure);
      } catch (error) {
        console.error("❌ Error in GET_PAGE_STRUCTURE:", error);
        sendResponse(null);
      }
      return true;
    }

    if (req.type === "PERFORM_ACTION") {
      const target = req.target.toLowerCase();
      console.log("🎯 Performing action for target:", target);

      // Find matching link
      const link = [...document.querySelectorAll("a")].find(a => 
        a.innerText.toLowerCase().includes(target) ||
        a.href.toLowerCase().includes(target)
      );

      if (link) {
        link.style.outline = "3px solid #007bff";
        link.style.outlineOffset = "2px";
        link.scrollIntoView({ behavior: "smooth", block: "center" });
        
        setTimeout(() => {
          link.click();
        }, 500);
        
        sendResponse({ success: true });
      } else {
        // Try buttons
        const button = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a.btn, .button")]
          .find(b => 
            (b.innerText || b.value || "").toLowerCase().includes(target)
          );

        if (button) {
          button.style.outline = "3px solid #007bff";
          button.style.outlineOffset = "2px";
          button.scrollIntoView({ behavior: "smooth", block: "center" });
          
          setTimeout(() => {
            button.click();
          }, 500);
          
          sendResponse({ success: true });
        } else {
          console.log("❌ Element not found for target:", target);
          sendResponse({ success: false, message: "Element not found" });
        }
      }
      
      return true;
    }
  });

  console.log("✅ Content script message listener registered");
})();