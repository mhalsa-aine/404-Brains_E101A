chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "AI_FETCH") {
    fetch("http://localhost:3000/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.payload)
    })
      .then(res => res.json())
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(err => {
        sendResponse({ success: false });
      });

    // REQUIRED for async response
    return true;
  }
});
