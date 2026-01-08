function extractPageStructure() {
  return {
    title: document.title,
    url: location.href,
    headings: [...document.querySelectorAll("h1,h2,h3")].map(h => h.innerText),
    links: [...document.querySelectorAll("a")]
      .map(a => a.innerText.trim())
      .filter(Boolean),
    buttons: [...document.querySelectorAll("button")]
      .map(b => b.innerText.trim())
      .filter(Boolean)
  };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PAGE_STRUCTURE") {
    sendResponse(extractPageStructure());
  }

  if (req.type === "PERFORM_ACTION") {
    const target = req.target.toLowerCase();

    const link = [...document.querySelectorAll("a")]
      .find(a => a.innerText.toLowerCase().includes(target));

    if (link) {
      link.style.outline = "3px solid red";
      link.scrollIntoView({ behavior: "smooth" });
      link.click();
    }
  }
});
