function getPageData() {
  const links = [...document.querySelectorAll("a")]
    .map(a => a.innerText.trim())
    .filter(t => t && t.length < 80);

  const buttons = [...document.querySelectorAll("button, input")]
    .map(b => (b.innerText || b.value || "").trim())
    .filter(t => t && t.length < 80);

  return {
    title: document.title,
    url: location.href,
    links: links.map(text => ({ text })),
    buttons
  };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PAGE") {
    sendResponse(getPageData());
    return true;
  }

  if (req.type === "PERFORM_ACTION") {
    const target = req.target.toLowerCase();
    const elements = [
      ...document.querySelectorAll("a, button, input")
    ];

    let best = null;
    let bestScore = 0;

    elements.forEach(el => {
      const text = (el.innerText || el.value || "").toLowerCase();
      if (!text) return;

      let score = 0;
      if (text === target) score = 100;
      else if (text.includes(target)) score = 80;
      else if (target.includes(text)) score = 60;
      else {
        const t = target.split(" ");
        const e = text.split(" ");
        if (t.some(w => e.some(x => x.includes(w)))) score = 50;
      }

      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });

    if (best && bestScore >= 40) {
      best.scrollIntoView({ behavior: "smooth", block: "center" });
      best.click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }
});
