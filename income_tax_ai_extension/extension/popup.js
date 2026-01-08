const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Always enable input
input.disabled = false;
input.focus();

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  input.disabled = false;
  input.focus();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      addMessage("⚠️ No active tab.", "bot");
      return;
    }

    const tabId = tabs[0].id;

    chrome.tabs.sendMessage(
      tabId,
      { type: "GET_PAGE_STRUCTURE" },
      (pageData) => {

        if (chrome.runtime.lastError) {
          addMessage("⚠️ Open a normal website (not chrome:// pages).", "bot");
          return;
        }

        if (!pageData) {
          addMessage("⚠️ Could not read this page.", "bot");
          return;
        }

        fetch("http://localhost:3000/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            page: pageData
          })
        })
          .then(async (res) => {
            if (!res.ok) {
              const errText = await res.text();
              throw new Error(errText || "Server error");
            }
            return res.json();
          })
          .then((ai) => {
            if (!ai || !ai.action) {
              addMessage("⚠️ AI returned no usable response.", "bot");
              return;
            }

            if (ai.action === "navigate" && ai.target) {
              addMessage(`Navigating to ${ai.target}…`, "bot");

              chrome.tabs.sendMessage(tabId, {
                type: "PERFORM_ACTION",
                target: ai.target
              });
            } else if (ai.action === "explain" && ai.answer) {
              addMessage(ai.answer, "bot");
            } else {
              addMessage("⚠️ I didn’t understand that request.", "bot");
            }
          })
          .catch((err) => {
            console.error(err);
            addMessage("❌ AI server error. Check server terminal.", "bot");
          });
      }
    );
  });
}
