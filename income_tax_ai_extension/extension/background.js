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
        console.error("Background fetch error:", err);
        sendResponse({ success: false, error: err.message });
      });

    // Required to keep message channel open
    return true;
  }
});
