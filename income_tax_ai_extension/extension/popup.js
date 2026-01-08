const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

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
  input.focus();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      addMessage("⚠️ No active tab.", "bot");
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "GET_PAGE_STRUCTURE" },
      (pageData) => {
        if (chrome.runtime.lastError || !pageData) {
          addMessage("⚠️ Cannot read this page.", "bot");
          return;
        }

        // 🔥 SEND TO BACKGROUND, NOT FETCH DIRECTLY
        chrome.runtime.sendMessage(
          {
            type: "AI_FETCH",
            payload: {
              query: text,
              page: pageData
            }
          },
          (response) => {
            if (!response || !response.success) {
              addMessage("❌ AI server error.", "bot");
              return;
            }

            const ai = response.data;

            if (ai.action === "navigate" && ai.target) {
              addMessage(`Navigating to ${ai.target}…`, "bot");
              chrome.tabs.sendMessage(tabs[0].id, {
                type: "PERFORM_ACTION",
                target: ai.target
              });
            } else if (ai.action === "explain" && ai.answer) {
              addMessage(ai.answer, "bot");
            } else {
              addMessage("⚠️ I didn’t understand that.", "bot");
            }
          }
        );
      }
    );
  });
}

