chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "AI_FETCH") {
    fetch("http://localhost:3000/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.payload)
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));

    return true;
  }
});
