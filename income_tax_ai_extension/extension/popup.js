const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

input.focus();

add("Hi! I’m your website assistant 👋", "bot");

send.onclick = sendMessage;
input.onkeydown = e => e.key === "Enter" && sendMessage();

function add(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  add(text, "user");
  input.value = "";

  // TEMP bot echo (next step replaces this)
  setTimeout(() => {
    add("I understood: " + text, "bot");
  }, 400);
}
