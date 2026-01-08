const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

sendBtn.onclick = sendMessage;
input.onkeydown = e => e.key === "Enter" && sendMessage();

function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(
      tab.id,
      { type: "GET_PAGE_STRUCTURE" },
      pageData => {
        fetch("http://localhost:3000/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            page: pageData
          })
        })
          .then(res => res.json())
          .then(ai => {
            if (ai.action === "navigate") {
              chrome.tabs.sendMessage(tab.id, {
                type: "PERFORM_ACTION",
                target: ai.target
              });
              addMessage(`Navigating to ${ai.target}…`, "bot");
            } else {
              addMessage(ai.answer, "bot");
            }
          });
      }
    );
  });
}
