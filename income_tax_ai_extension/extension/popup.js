const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

/* FORCE INPUT TO WORK */
input.disabled = false;
input.readOnly = false;
input.focus();

addMessage("Hi 👋 I’m your website assistant.", "bot");

send.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

function addMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  // Temporary response (AI will be added next)
  setTimeout(() => {
    addMessage("I understood: " + text, "bot");
  }, 300);
}

