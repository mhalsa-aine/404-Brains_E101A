// Wrap in IIFE to avoid conflicts
(function() {
  console.log("🚀 AI Website Assistant content script loaded on:", location.href);

  // Helper function to safely click elements
  function safeClick(element) {
    try {
      // Method 1: Direct navigation for links
      if (element.tagName === 'A' && element.href && !element.href.startsWith('javascript:')) {
        window.location.href = element.href;
        return true;
      }

      // Method 2: Dispatch MouseEvent (CSP-safe)
      const events = ['mousedown', 'mouseup', 'click'];
      events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: element.getBoundingClientRect().left + 5,
          clientY: element.getBoundingClientRect().top + 5
        });
        element.dispatchEvent(event);
      });

      // Method 3: Focus and trigger keyboard event for buttons
      if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
        element.focus();
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(enterEvent);
      }

      return true;
    } catch (error) {
      console.error("Safe click error:", error);
      return false;
    }
  }

  function extractPageStructure() {
    try {
      // Helper function to check if text is valid
      const isValidText = (text) => {
        if (!text || typeof text !== 'string') return false;
        text = text.trim();
        
        // Filter out obvious junk
        if (text.length === 0 || text.length > 100) return false;
        
        // Filter out multi-line text (likely code blocks)
        if (text.split('\n').length > 2) return false;
        
        // Filter out CSS/code patterns (now handles newlines)
        const normalized = text.replace(/\s+/g, ' ').toLowerCase();
        
        if (normalized.includes('{') || normalized.includes('}')) return false;
        if (normalized.includes('fill:') || normalized.includes('stroke:')) return false;
        if (normalized.includes('rgba') || normalized.includes('rgb(')) return false;
        if (normalized.includes('cls-') || normalized.includes('shp')) return false;
        if (normalized.includes('white-space') || normalized.includes('tspan')) return false;
        if (normalized.includes('prefix__') || normalized.includes('xmlns')) return false;
        if (normalized.includes('opacity:') || normalized.includes('display:')) return false;
        if (normalized.includes('px;') || normalized.includes('em;')) return false;
        
        // Filter out style/script-like content
        if (/\.(cls|shp|prefix)[0-9_-]/.test(normalized)) return false;
        if (/fill\s*:\s*[#a-f0-9rgba(),.\s]+/i.test(normalized)) return false;
        if (/[a-z-]+\s*:\s*[^;{]+[;{]/i.test(normalized)) return false;
        
        // Must contain at least one meaningful word (2+ letters)
        if (!/[a-zA-Z]{2,}/.test(text)) return false;
        
        // Filter out just punctuation or special chars
        if (/^[^a-zA-Z0-9\s]+$/.test(text)) return false;
        
        // Filter out obvious non-navigation text
        const lowText = text.toLowerCase();
        if (lowText.startsWith('function') || lowText.startsWith('var ')) return false;
        if (lowText.startsWith('const ') || lowText.startsWith('let ')) return false;
        
        return true;
      };

      // Get all interactive elements, excluding style/script/svg containers
      const skipSelectors = 'style, script, noscript, svg, [class*="style"], [class*="css"]';
      
      const links = [...document.querySelectorAll("a")]
        .filter(a => !a.closest(skipSelectors))
        .map(a => {
          const text = (a.innerText || a.textContent || a.getAttribute("aria-label") || "").trim();
          return {
            text: text,
            href: a.href
          };
        })
        .filter(l => l && isValidText(l.text))
        .slice(0, 100);

      const buttons = [
        ...document.querySelectorAll("button, input[type='button'], input[type='submit'], [role='button'], .btn, .button")
      ]
        .filter(b => !b.closest(skipSelectors))
        .map(b => (b.innerText || b.textContent || b.value || b.getAttribute("aria-label") || "").trim())
        .filter(t => isValidText(t))
        .slice(0, 50);

      const headings = [...document.querySelectorAll("h1, h2, h3, h4")]
        .filter(h => !h.closest(skipSelectors))
        .map(h => h.innerText.trim())
        .filter(t => isValidText(t))
        .slice(0, 30);

      // Get navigation menus
      const navItems = [...document.querySelectorAll("nav a, [role='navigation'] a, .nav a, .menu a, header a")]
        .filter(a => !a.closest(skipSelectors))
        .map(a => (a.innerText || a.textContent || "").trim())
        .filter(t => isValidText(t))
        .slice(0, 30);

      const structure = {
        title: document.title || "Untitled",
        url: location.href,
        headings: headings,
        links: links,
        buttons: [...new Set(buttons)],
        navItems: [...new Set(navItems)],
        forms: [...document.querySelectorAll("form")].map(f => ({
          action: f.action,
          method: f.method,
          inputs: [...f.querySelectorAll("input, select, textarea")]
            .map(i => ({
              type: i.type,
              name: i.name,
              placeholder: i.placeholder,
              label: i.labels?.[0]?.innerText || ""
            }))
        })).slice(0, 5)
      };
      
      console.log("✅ Extracted structure:", {
        title: structure.title,
        linkCount: structure.links.length,
        buttonCount: structure.buttons.length,
        headingCount: structure.headings.length,
        navItemCount: structure.navItems.length,
        sampleLinks: structure.links.slice(0, 5).map(l => l.text)
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
        navItems: [],
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

      // Search all possible elements
      const allElements = [
        ...document.querySelectorAll("a, button, input[type='button'], input[type='submit'], [role='button'], .btn, .button")
      ];

      // Find best match
      let bestMatch = null;
      let bestScore = 0;

      for (const el of allElements) {
        const text = (el.innerText || el.textContent || el.value || el.getAttribute("aria-label") || "").toLowerCase();
        
        if (!text) continue;

        // Exact match
        if (text === target) {
          bestMatch = el;
          bestScore = 100;
          break;
        }

        // Contains match
        if (text.includes(target)) {
          const score = 80;
          if (score > bestScore) {
            bestMatch = el;
            bestScore = score;
          }
        }

        // Reverse contains
        if (target.includes(text)) {
          const score = 70;
          if (score > bestScore) {
            bestMatch = el;
            bestScore = score;
          }
        }

        // Word overlap
        const targetWords = target.split(/\s+/);
        const textWords = text.split(/\s+/);
        const overlap = targetWords.filter(w => textWords.some(tw => tw.includes(w) || w.includes(tw)));
        
        if (overlap.length > 0) {
          const score = 50 + (overlap.length * 10);
          if (score > bestScore) {
            bestMatch = el;
            bestScore = score;
          }
        }
      }

      if (bestMatch && bestScore > 40) {
        console.log("✅ Found match:", bestMatch.innerText || bestMatch.value, "Score:", bestScore);
        
        // Highlight the element
        bestMatch.style.outline = "3px solid #007bff";
        bestMatch.style.outlineOffset = "2px";
        bestMatch.style.transition = "outline 0.3s ease";
        bestMatch.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Wait for scroll, then click
        setTimeout(() => {
          const success = safeClick(bestMatch);
          
          if (!success && bestMatch.href) {
            // Fallback: direct navigation
            window.location.href = bestMatch.href;
          }
          
          // Remove highlight after action
          setTimeout(() => {
            bestMatch.style.outline = "";
          }, 1000);
        }, 600);
        
        sendResponse({ success: true, matched: bestMatch.innerText || bestMatch.value });
      } else {
        console.log("❌ No good match found for:", target);
        sendResponse({ success: false, message: "Element not found" });
      }
      
      return true;
    }
  });

  console.log("✅ Content script message listener registered");
})();