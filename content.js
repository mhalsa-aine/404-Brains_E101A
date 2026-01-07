// content.js
// Detects current Income Tax portal page

let currentPage = "dashboard";

if (window.location.href.includes("login")) {
  currentPage = "login";
} else if (window.location.href.includes("dashboard")) {
  currentPage = "dashboard";
} else if (window.location.href.includes("refund")) {
  currentPage = "refund";
}

chrome.runtime.sendMessage({
  page: currentPage
});
