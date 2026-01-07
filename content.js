console.log("AI content script loaded");

// STEP 1: Extract page understanding
function extractPageContext() {
  return {
    url: window.location.href,
    title: document.title,

    headings: Array.from(document.querySelectorAll("h1, h2, h3"))
      .map(h => h.innerText.trim())
      .filter(Boolean),

    links: Array.from(document.querySelectorAll("a"))
      .map(a => ({
        text: a.innerText.trim(),
        href: a.href
      }))
      .filter(l => l.text.length > 0)
      .slice(0, 40),

    buttons: Array.from(document.querySelectorAll("button"))
      .map(b => b.innerText.trim())
      .filter(Boolean),

    inputs: Array.from(document.querySelectorAll("input, select, textarea"))
      .map(el => ({
        type: el.tagName.toLowerCase(),
        name: el.name || el.id || "unnamed"
      }))
  };
}

// STEP 2: Save context globally
function updateContext() {
  window.__AI_WEBSITE_CONTEXT__ = extractPageContext();
  console.log("AI context updated", window.__AI_WEBSITE_CONTEXT__);
}

// Initial load
updateContext();

// STEP 3: Handle SPA / sub‑page navigation
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    updateContext();
  }
}, 1000);
