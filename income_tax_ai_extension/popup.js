// AI-like Website Navigation Assistant (Popup Logic)

document.getElementById("askBtn").onclick = () => {
  const input = document.getElementById("userInput");
  const chat = document.getElementById("chat");

  const question = input.value.trim().toLowerCase();

  if (!question) {
    chat.innerText = "Please ask a question about this website.";
    return;
  }

  chat.innerText = "Analyzing this page to guide you...";

  // Collect clickable elements
  const clickableElements = [...document.querySelectorAll("a, button, input")]
    .filter(el => el.innerText && el.innerText.length < 50);

  // Helper function to highlight element
  function highlightElement(el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.outline = "3px solid red";
    el.style.backgroundColor = "#fff3cd";
  }

  // LOGIN / SIGN IN
  if (question.includes("login") || question.includes("sign in")) {
    const loginEl = clickableElements.find(el =>
      el.innerText.toLowerCase().includes("login") ||
      el.innerText.toLowerCase().includes("sign in")
    );

    if (loginEl) {
      highlightElement(loginEl);
      chat.innerText = `I found the Login option here → "${loginEl.innerText}". I have highlighted it for you.`;
    } else {
      chat.innerText = "I could not find a Login option on this page.";
    }
  }

  // RESULTS / GRADES
  else if (question.includes("result") || question.includes("grade")) {
    const resultEl = clickableElements.find(el =>
      el.innerText.toLowerCase().includes("result") ||
      el.innerText.toLowerCase().includes("grade")
    );

    if (resultEl) {
      highlightElement(resultEl);
      chat.innerText = `This page has a Results section → "${resultEl.innerText}". I have highlighted it.`;
    } else {
      chat.innerText = "I do not see Results on this page. Try checking the Academics or Dashboard section.";
    }
  }

  // PAYMENT / REFUND
  else if (
    question.includes("payment") ||
    question.includes("pay") ||
    question.includes("refund")
  ) {
    const paymentEl = clickableElements.find(el =>
      el.innerText.toLowerCase().includes("payment") ||
      el.innerText.toLowerCase().includes("pay") ||
      el.innerText.toLowerCase().includes("refund")
    );

    if (paymentEl) {
      highlightElement(paymentEl);
      chat.innerText = `I found the Payments option → "${paymentEl.innerText}". I have highlighted it.`;
    } else {
      chat.innerText = "I could not find a Payments or Refund option on this page.";
    }
  }

  // CONTACT / SUPPORT
  else if (
    question.includes("contact") ||
    question.includes("support") ||
    question.includes("help")
  ) {
    const supportEl = clickableElements.find(el =>
      el.innerText.toLowerCase().includes("contact") ||
      el.innerText.toLowerCase().includes("support") ||
      el.innerText.toLowerCase().includes("help")
    );

    if (supportEl) {
      highlightElement(supportEl);
      chat.innerText = `Here is the Support section → "${supportEl.innerText}". I have highlighted it.`;
    } else {
      chat.innerText = "I could not find a Support section on this page.";
    }
  }

  // UNKNOWN QUERY
  else {
    chat.innerText =
      "I analyzed this page but could not find a matching section. Try asking about login, results, payments, or support.";
  }

  input.value = "";
};
