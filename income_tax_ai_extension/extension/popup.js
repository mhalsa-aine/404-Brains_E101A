const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

add("Hi! I can navigate and explain this website 😊", "bot");

send.onclick = sendMsg;
input.onkeydown = e => e.key === "Enter" && sendMsg();

function add(text, who) {
  const d = document.createElement("div");
  d.className = `msg ${who}`;
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
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
    add(ai.message || "Navigating…", "bot");
    await chrome.tabs.sendMessage(tab.id, {
      type: "PERFORM_ACTION",
      target: ai.target
    });

    if (ai.answer) add(ai.answer, "bot");
  } else {
    add(ai.answer, "bot");
  }
}
