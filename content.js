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
        href: a.href
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
  
  // Get headings for context
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .slice(0, 10)
    .map(h => h.textContent.trim())
    .filter(h => h.length > 4);

  // Get nav links
  const navLinks = Array.from(document.querySelectorAll('nav a, header a'))
    .slice(0, 15)
    .map(a => a.textContent.trim())
    .filter(text => text && text.length > 0 && text.length < 50);

  const metaDescription = document.querySelector('meta[name="description"]')?.content || "";
  
  console.log("✅ Found:", links.length, "links,", buttons.length, "buttons");
  
  return {
    title: document.title,
    url: location.href,
    domain: location.hostname,
    links: links,
    buttons: buttons,
    linksCount: links.length,
    headingsCount: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
    formsCount: document.querySelectorAll('form').length,
    buttonsCount: buttons.length,
    imagesCount: document.querySelectorAll('img').length,
    headings: headings,
    navLinks: navLinks,
    metaDescription: metaDescription
  };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  console.log("📩 Message received:", req.type);
  
  if (req.type === "PING") {
    console.log("✅ PING received");
    sendResponse({ status: "ok" });
    return true;
  }
  
  if (req.type === "GET_PAGE_STRUCTURE") {
    console.log("📄 Getting page structure");
    const structure = extractPageStructure();
    console.log("📤 Sending structure:", structure);
    sendResponse(structure);
    return true;
  }
  
  if (req.type === "PERFORM_ACTION") {
    const target = req.target.toLowerCase();
    console.log("🎯 Looking for:", target);
    
    // Find all clickable elements
    const allElements = document.querySelectorAll("a, button, input[type='button'], input[type='submit']");
    console.log("🔍 Total clickable elements:", allElements.length);
    
    let bestMatch = null;
    let bestScore = 0;
    const matches = []; // Store all potential matches
    
    allElements.forEach(el => {
      const text = (el.innerText || el.textContent || el.value || "").toLowerCase().trim();
      
      if (!text) return;
      
      let score = 0;
      
      // Exact match (highest priority)
      if (text === target) {
        score = 100;
      }
      // Text contains target
      else if (text.includes(target)) {
        score = 80;
        
        // Bonus points for being in main content area (not nav/footer)
        const isInMainContent = !el.closest('nav, header, footer, aside, .sidebar');
        if (isInMainContent) score += 15;
        
        // Bonus for article/content links
        if (el.closest('article, main, .content, #content')) score += 10;
        
        // Penalty for store/shop/buy links
        if (text.includes('shop') || text.includes('store') || text.includes('buy') || 
            text.includes('cart') || text.includes('merchandise')) {
          score -= 30;
        }
        
        // Bonus for exact word match (not partial)
        const targetWords = target.split(/\s+/);
        const textWords = text.split(/\s+/);
        if (targetWords.every(tw => textWords.includes(tw))) {
          score += 20;
        }
        
        // Prefer shorter text (more specific)
        if (text.length < 50) score += 5;
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
      
      if (score > 0) {
        matches.push({ element: el, score: score, text: text });
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    });
    
    // Log top matches for debugging
    if (matches.length > 0) {
      console.log("🎯 Top 5 matches:");
      matches
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .forEach((m, i) => {
          console.log(`  ${i+1}. [${m.score}] "${m.text.substring(0, 50)}..."`);
        });
    }
    
    if (bestMatch && bestScore >= 40) {
      const matchedText = bestMatch.innerText || bestMatch.value || "element";
      console.log("✅ Selected best match:", matchedText, "Score:", bestScore);
      
      // Highlight
      bestMatch.style.outline = "3px solid #007bff";
      bestMatch.style.outlineOffset = "2px";
      bestMatch.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Click after delay
      setTimeout(() => {
        console.log("👆 Clicking element");
        if (bestMatch.tagName === 'A' && bestMatch.href) {
          // For links, navigate directly
          window.location.href = bestMatch.href;
        } else {
          // For buttons, click them
          bestMatch.click();
        }
      }, 500);
      
      sendResponse({ success: true, found: matchedText });
    } else {
      console.log("❌ No match found for:", target);
      sendResponse({ success: false, message: "No matching element found" });
    }
    
    return true;
  }
  
  // NEW: Fill form fields
  if (req.type === "FILL_FORM") {
    console.log("📝 Filling form field:", req.fieldType, "with value:", req.value);
    
    try {
      let field = null;
      const fieldType = req.fieldType.toLowerCase();
      const value = req.value;
      
      // Find the right input field based on type
      if (fieldType.includes('email')) {
        field = document.querySelector('input[type="email"]') || 
                document.querySelector('input[name*="email" i]') ||
                document.querySelector('input[id*="email" i]') ||
                document.querySelector('input[placeholder*="email" i]');
      } 
      else if (fieldType.includes('name')) {
        // Check if it's first name, last name, or full name
        if (fieldType.includes('first')) {
          field = document.querySelector('input[name*="first" i]') ||
                  document.querySelector('input[id*="first" i]') ||
                  document.querySelector('input[placeholder*="first" i]');
        } else if (fieldType.includes('last')) {
          field = document.querySelector('input[name*="last" i]') ||
                  document.querySelector('input[id*="last" i]') ||
                  document.querySelector('input[placeholder*="last" i]');
        } else {
          // Full name or just "name"
          field = document.querySelector('input[name*="name" i]') ||
                  document.querySelector('input[id*="name" i]') ||
                  document.querySelector('input[placeholder*="name" i]') ||
                  document.querySelector('input[type="text"]');
        }
      }
      else if (fieldType.includes('phone') || fieldType.includes('tel')) {
        field = document.querySelector('input[type="tel"]') ||
                document.querySelector('input[name*="phone" i]') ||
                document.querySelector('input[id*="phone" i]') ||
                document.querySelector('input[placeholder*="phone" i]');
      }
      else if (fieldType.includes('password')) {
        field = document.querySelector('input[type="password"]');
      }
      else if (fieldType.includes('address')) {
        field = document.querySelector('input[name*="address" i]') ||
                document.querySelector('input[id*="address" i]') ||
                document.querySelector('textarea[name*="address" i]');
      }
      else if (fieldType.includes('city')) {
        field = document.querySelector('input[name*="city" i]') ||
                document.querySelector('input[id*="city" i]');
      }
      else if (fieldType.includes('zip') || fieldType.includes('postal')) {
        field = document.querySelector('input[name*="zip" i]') ||
                document.querySelector('input[name*="postal" i]') ||
                document.querySelector('input[id*="zip" i]');
      }
      else if (fieldType.includes('message') || fieldType.includes('comment')) {
        field = document.querySelector('textarea[name*="message" i]') ||
                document.querySelector('textarea[name*="comment" i]') ||
                document.querySelector('textarea[id*="message" i]') ||
                document.querySelector('textarea');
      }
      else if (fieldType.includes('search')) {
        field = document.querySelector('input[type="search"]') ||
                document.querySelector('input[name*="search" i]') ||
                document.querySelector('input[id*="search" i]') ||
                document.querySelector('input[placeholder*="search" i]');
      }
      else {
        // Generic: try to find any text input
        field = document.querySelector('input[type="text"]') ||
                document.querySelector('input:not([type])') ||
                document.querySelector('textarea');
      }
      
      if (field) {
        // Highlight the field
        field.style.outline = "3px solid #48bb78";
        field.style.outlineOffset = "2px";
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Fill the field
        setTimeout(() => {
          field.focus();
          field.value = value;
          
          // Trigger input events (some sites need this)
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log("✅ Field filled successfully:", field.name || field.id || field.type);
          sendResponse({ 
            success: true, 
            field: field.name || field.id || field.placeholder || "field",
            value: value
          });
        }, 300);
      } else {
        console.log("❌ Field not found:", fieldType);
        sendResponse({ 
          success: false, 
          message: `Could not find ${fieldType} field on this page`
        });
      }
    } catch (error) {
      console.error("❌ Form fill error:", error);
      sendResponse({ success: false, message: error.message });
    }
    
    return true;
  }
  
  // NEW: Submit form
  if (req.type === "SUBMIT_FORM") {
    console.log("📤 Submitting form");
    
    try {
      // Find submit button or form
      let submitBtn = document.querySelector('button[type="submit"]') ||
                      document.querySelector('input[type="submit"]') ||
                      document.querySelector('button:not([type])');
      
      if (submitBtn) {
        submitBtn.style.outline = "3px solid #48bb78";
        submitBtn.style.outlineOffset = "2px";
        submitBtn.scrollIntoView({ behavior: "smooth", block: "center" });
        
        setTimeout(() => {
          submitBtn.click();
          console.log("✅ Form submitted");
          sendResponse({ success: true, message: "Form submitted" });
        }, 500);
      } else {
        // Try finding and submitting form directly
        const form = document.querySelector('form');
        if (form) {
          form.submit();
          console.log("✅ Form submitted directly");
          sendResponse({ success: true, message: "Form submitted" });
        } else {
          console.log("❌ No submit button or form found");
          sendResponse({ success: false, message: "No submit button found" });
        }
      }
    } catch (error) {
      console.error("❌ Submit error:", error);
      sendResponse({ success: false, message: error.message });
    }
    
    return true;
  }
  
  // NEW: Get form fields on page
  if (req.type === "GET_FORM_FIELDS") {
    console.log("📋 Getting form fields");
    
    const fields = [];
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      // Skip hidden and submit buttons
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') return;
      
      const fieldInfo = {
        type: input.type || 'text',
        name: input.name || input.id || input.placeholder || 'unknown',
        placeholder: input.placeholder || '',
        value: input.value || '',
        required: input.required
      };
      
      fields.push(fieldInfo);
    });
    
    console.log("✅ Found", fields.length, "form fields");
    sendResponse({ success: true, fields: fields });
    return true;
  }
});