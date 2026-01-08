function getPageData() {
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
    sendResponse(getPageData());
  }

  if (req.type === "PERFORM_ACTION") {
    const target = req.target.toLowerCase();
    const elements = [...document.querySelectorAll("a, button")];

    let best = null;
    let score = 0;

    elements.forEach(el => {
      const text = el.innerText.toLowerCase();
      if (!text) return;

      let s = 0;
      if (text === target) s = 100;
      else if (text.includes(target)) s = 80;
      else if (target.includes(text)) s = 60;
      else {
        const t = target.split(" ");
        const e = text.split(" ");
        if (t.some(w => e.some(x => x.includes(w)))) s = 50;
      }

      if (s > score) {
        score = s;
        best = el;
      }
    });

    if (best && score >= 40) {
      best.scrollIntoView({ behavior: "smooth", block: "center" });
      best.click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  }

  return true;
});
