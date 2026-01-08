function extractPage() {
  const links = [...document.querySelectorAll("a")]
    .map(a => a.innerText.trim())
    .filter(t => t && t.length < 80);

  const buttons = [...document.querySelectorAll("button")]
    .map(b => b.innerText.trim())
    .filter(t => t && t.length < 80);

  return {
    title: document.title,
    url: location.href,
    links: links.map(t => ({ text: t })),
    buttons
  };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PAGE") {
    sendResponse(extractPage());
  }

  if (req.type === "PERFORM_ACTION") {
    const target = req.target.toLowerCase();
    const elements = [...document.querySelectorAll("a, button")];

    const found = elements.find(el =>
      el.innerText.toLowerCase().includes(target)
    );

    if (found) {
      found.scrollIntoView({ behavior: "smooth", block: "center" });
      found.click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  }

  return true;
});
