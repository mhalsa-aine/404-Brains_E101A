document.addEventListener("DOMContentLoaded", function () {
  const askBtn = document.getElementById("askBtn");
  const input = document.getElementById("userInput");
  const chat = document.getElementById("chat");

  askBtn.addEventListener("click", function () {
    const question = input.value.trim().toLowerCase();

    if (!question) {
      chat.innerText = "Please type a question.";
      return;
    }

    chat.innerText = "Analyzing this page...";

    // Collect clickable elements
    const elements = [...document.querySelectorAll("a, button")]
      .map(el => el.innerText.toLowerCase())
      .filter(Boolean);

    if (question.includes("login")) {
      const loginEl = [...document.querySelectorAll("a, button")].find(el =>
        el.innerText.toLowerCase().includes("login")
      );

      if (loginEl) {
        loginEl.scrollIntoView({ behavior: "smooth", block: "center" });
        loginEl.style.outline = "3px solid red";
        chat.innerText = "I found the login option and highlighted it for you.";
      } else {
        chat.innerText = "I could not find a login option on this page.";
      }
    } else if (
      question.includes("service") ||
      question.includes("support") ||
      question.includes("contact")
    ) {
      const serviceEl = [...document.querySelectorAll("a, button")].find(el =>
        el.innerText.toLowerCase().includes("service") ||
        el.innerText.toLowerCase().includes("support") ||
        el.innerText.toLowerCase().includes("contact")
      );

      if (serviceEl) {
        serviceEl.scrollIntoView({ behavior: "smooth", block: "center" });
        serviceEl.style.outline = "3px solid blue";
        chat.innerText = "Here is the service/support section.";
      } else {
        chat.innerText = "I could not find a service or support section here.";
      }
    } else {
      chat.innerText =
        "I understand login, service, support, and contact queries for now.";
    }

    input.value = "";
  });
});
