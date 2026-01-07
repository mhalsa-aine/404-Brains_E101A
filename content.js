console.log("AI content script loaded");

function extractPageContext() {
  return {
    meta: {
      url: window.location.href,
      title: document.title
    },

    structure: {
      headings: Array.from(document.querySelectorAll("h1, h2, h3"))
        .map(h => h.innerText.trim())
        .filter(Boolean),

      links: Array.from(document.querySelectorAll("a"))
        .map(a => ({
          text: a.innerText.trim(),
          href: a.href
        }))
        .filter(l => l.text.length > 0)
        .slice(0, 50),

      buttons: Array.from(document.querySelectorAll("button"))
        .map(b => b.innerText.trim())
        .filter(Boolean),

      inputs: Array.from(
        document.querySelectorAll("input, select, textarea")
      ).map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || null,
        name: el.name || null,
        placeholder: el.placeholder || null
      }))
    }
  };
}

function updateContext() {
  window.__AI_WEBSITE_CONTEXT__ = extractPageContext();
  console.log("AI CONTEXT UPDATED", window.__AI_WEBSITE_CONTEXT__);
}

// Initial load
updateContext();

// Handle SPA / dynamic navigation
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    updateContext();
  }
}, 1000);
