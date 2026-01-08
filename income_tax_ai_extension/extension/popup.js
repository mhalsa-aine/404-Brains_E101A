const input = document.getElementById("input");
const btn = document.getElementById("btn");
const log = document.getElementById("log");

input.focus(); // 🔥 force focus

btn.onclick = () => {
  log.textContent = "You typed: " + input.value;
};
