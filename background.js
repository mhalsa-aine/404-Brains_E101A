const GEMINI_API_KEY = "AIzaSyDOHtPjrR3BbfeuGX7P-53r5kbNiuF7nqQ";


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "AI_QUERY") {
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: request.message }]
            }
          ]
        })
      }
    )
      .then(res => res.json())
      .then(data => {
        let reply = "Sorry, I couldn't understand that.";


        if (data?.candidates?.[0]?.content?.parts) {
          reply = data.candidates[0].content.parts
            .map(p => p.text)
            .join(" ");
        }


        sendResponse({ reply });
      })
      .catch(() => {
        sendResponse({ reply: "AI request failed." });
      });


    return true;
  }
});
