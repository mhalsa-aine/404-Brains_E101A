const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

/* INITIAL FOCUS — SAFE */
setTimeout(() => input.focus(), 50);

addMessage("Hi 👋 I can navigate and explain this website.", "bot");

send.addEventListener("click", onSend);
input.addEventListener("keydown", e => {
  if (e.key === "Enter") onSend();
});

function addMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function onSend() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  // IMPORTANT: refocus immediately
  input.focus();

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const page = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_PAGE"
  });

  addMessage("Thinking…", "bot");

  const res = await chrome.runtime.sendMessage({
    type: "AI_FETCH",
    payload: { query: text, page }
  });

  // remove "Thinking..."
  chat.lastChild.remove();

  if (!res.success) {
    addMessage("Server error.", "bot");
    input.focus();
    return;
  }

  const ai = res.data;

  if (ai.action === "navigate") {
    addMessage(ai.message || "Navigating…", "bot");

    await chrome.tabs.sendMessage(tab.id, {
      type: "PERFORM_ACTION",
      target: ai.target
    });

    if (ai.answer) addMessage(ai.answer, "bot");
  } else {
    addMessage(ai.answer, "bot");
  }

  // 🔥 FINAL GUARANTEE
  input.focus();
}


