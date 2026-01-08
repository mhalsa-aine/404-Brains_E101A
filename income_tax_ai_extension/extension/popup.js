const box = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const send = document.getElementById("send");

add("Hi! I can explain or navigate this website 😊", "bot");

send.onclick = sendMsg;
input.onkeydown = e => e.key === "Enter" && sendMsg();

function add(text, who) {
  const d = document.createElement("div");
  d.className = `msg ${who}`;
  d.textContent = text;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

async function sendMsg() {
  const text = input.value.trim();
  if (!text) return;

  add(text, "user");
  input.value = "";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const page = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE" });

  const res = await chrome.runtime.sendMessage({
    type: "AI_FETCH",
    payload: { query: text, page }
  });

  if (!res.success) {
    add("Server error", "bot");
    return;
  }

  const ai = res.data;

  if (ai.action === "navigate") {
    add(ai.message || "Navigating...", "bot");
    await chrome.tabs.sendMessage(tab.id, {
      type: "PERFORM_ACTION",
      target: ai.target
    });
  } else {
    add(ai.answer, "bot");
  }
}
