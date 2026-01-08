const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

input.focus();

add("Hi 👋 I can navigate and explain this website.", "bot");

send.onclick = sendMessage;
input.onkeydown = e => e.key === "Enter" && sendMessage();

function add(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  add(text, "user");
  input.value = "";

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const page = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_PAGE"
  });

  add("Thinking…", "bot");

  const res = await chrome.runtime.sendMessage({
    type: "AI_FETCH",
    payload: { query: text, page }
  });

  chat.lastChild.remove();

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


