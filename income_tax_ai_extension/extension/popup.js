const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      {
        type: "FIND_AND_SCROLL",
        query: text
      },
      (response) => {
        if (response?.found) {
          addMessage(
            "Found it 👀 — I’ve highlighted it on the page.",
            "bot"
          );
        } else {
          addMessage(
            "I read the page, but I couldn’t find that clearly 😔",
            "bot"
          );
        }
      }
    );
  });
}

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}


