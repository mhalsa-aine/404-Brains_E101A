
// popup.js
// Handles page explanations and AI-like FAQ responses

// Page explanations based on detected page
const pageExplanations = {
  login: "This page is for logging in to the Income Tax portal using PAN or Aadhaar.",
  dashboard: "This is your main dashboard where you can file ITR, check refund status, and view submitted returns.",
  fileITR: "This section helps you start filing your Income Tax Return step by step.",
  incomeDetails: "Here you enter details about your salary, interest, or other income.",
  taxPaid: "This page shows tax already paid through TDS or advance tax.",
  refund: "This page shows the status of your income tax refund.",
  everify: "This page is used to e-Verify your return after submission."
};

// FAQ-style AI answers
const faqAnswers = {
  "which itr should i file":
    "The ITR form depends on your income type. Salaried individuals usually file ITR-1.",

  "how to check refund status":
    "You can check your refund status from the Refund Status section on the dashboard.",

  "what is e verification":
    "e-Verification is the final step after submitting your return. Without it, your return is incomplete.",

  "what if i make a mistake":
    "If you make a mistake, you can file a revised return before the deadline.",

  "is aadhaar mandatory":
    "Yes, Aadhaar is generally required for filing income tax returns.",

  "what is tds":
    "TDS means Tax Deducted at Source. It is tax already deducted from your income."
};

// Function to get explanation text
function getPageExplanation(page) {
  return pageExplanations[page] ||
    "This page contains important income tax related information.";
}

// Function to get FAQ answer
function getFaqAnswer(question) {
  const q = question.toLowerCase();

  for (let key in faqAnswers) {
    if (q.includes(key)) {
      return faqAnswers[key];
    }
  }

  return "Sorry, I can help with common income tax questions only.";
}
