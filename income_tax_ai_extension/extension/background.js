chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "AI_FETCH") {
    fetch("http://localhost:3000/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.payload)
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text);
        }
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    // 🔴 REQUIRED for async response
    return true;
  }
});

