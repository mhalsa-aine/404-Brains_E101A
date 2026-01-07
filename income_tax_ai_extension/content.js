console.log("AI content script loaded");

// Function to read the website + sub-pages
function extractPageContext() {
  return {
    url: window.location.href,
    title: document.title,

    headings: Array.from(document.querySelectorAll("h1, h2"))
      .map(h => h.innerText.trim())
      .filter(Boolean),

    links: Array.from(document.querySelectorAll("a"))
      .map(a => ({
        text: a.innerText.trim(),
        href: a.href
      }))
      .filter(l => l.text.length > 0)
      .slice(0, 30),

    buttons: Array.from(document.querySelectorAll("button"))
      .map(b => b.innerText.trim())
      .filter(Boolean),

    forms: Array.from(document.querySelectorAll("form")).map(form =>
      Array.from(form.querySelectorAll("label"))
        .map(label => label.innerText.trim())
        .filter(Boolean)
    )
  };
}

// Initial extraction
window.__AI_WEBSITE_CONTEXT__ = extractPageContext();
console.log("AI context set", window.__AI_WEBSITE_CONTEXT__);

// Handle SPA navigation (important for portals)
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    window.__AI_WEBSITE_CONTEXT__ = extractPageContext();
    console.log("AI context updated", window.__AI_WEBSITE_CONTEXT__);
  }
}, 1000);
