const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

input.disabled = false;

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

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      addMessage("No active website detected.", "bot");
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "GET_PAGE_STRUCTURE" },
      (pageData) => {

        if (chrome.runtime.lastError || !pageData) {
          addMessage("⚠️ Open a normal website (not chrome:// pages).", "bot");
          return;
        }

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
              addMessage("Server error.", "bot");
              return;
            }

            addMessage(response.data.answer, "bot");
          }
        );
      }
    );
  });
}
