document.getElementById("askBtn").onclick = () => {
  const input = document.getElementById("userInput");
  const chat = document.getElementById("chat");

  const question = input.value.toLowerCase();

  let response = "I am analyzing this page to guide you.";

  // Intent: Login / Navigation
  if (question.includes("login") || question.includes("sign in")) {
    response = "Look for Login or Sign In options, usually at the top of the page.";
  }

  // Intent: Results / Grades / Information
  else if (question.includes("grade") || question.includes("result")) {
    response = "Check sections like Academics, Results, or Dashboard.";
  }

  // Intent: Refund / Payment / Task
  else if (question.includes("refund") || question.includes("payment")) {
    response = "Navigate to Services, Payments, or Billing sections.";
  }

  // Intent: Contact / Support
  else if (question.includes("contact") || question.includes("support")) {
    response = "Look for Help, Support, or Contact Us links, often in the footer.";
  }

  chat.innerText = response;
  input.value = "";
};
