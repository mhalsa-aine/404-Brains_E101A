// Get UI elements
const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Make sure input is enabled
input.disabled = false;

// Event listeners
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// Utility to add messages to chat
function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Main send function
function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  // Always re-enable input (safety)
  input.disabled = false;
  input.focus();

  // Get active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      addMessage("⚠️ No active tab found.", "bot");
      return;
    }

    const tabId = tabs[0].id;

    // Ask content script for page structure
    chrome.tabs.sendMessage(
      tabId,
      { type: "GET_PAGE_STRUCTURE" },
      (pageData) => {

        // 🔴 IMPORTANT SAFETY CHECK
        if (chrome.runtime.lastError) {
          addMessage(
            "⚠️ Open a normal website (not chrome:// or new tab).",
            "bot"
          );
          return;
        }

        // If page data is missing
        if (!pageData) {
          addMessage("⚠️ Could not read this page.", "bot");
          return;
        }

        // Send data to AI backend
        fetch("http://localhost:3000/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: text,
            page: pageData
          })
        })
          .then((res) => res.json())
          .then((ai) => {
            if (!ai || !ai.action) {
              addMessage("⚠️ AI returned an invalid response.", "bot");
              return;
            }

            // If AI wants navigation
            if (ai.action === "navigate" && ai.target) {
              addMessage(`Navigating to ${ai.target}…`, "bot");

              chrome.tabs.sendMessage(tabId, {
                type: "PERFORM_ACTION",
                target: ai.target
              });
            }
            // Otherwise explain
            else if (ai.action === "explain" && ai.answer) {
              addMessage(ai.answer, "bot");
            }
            // Fallback
            else {
              addMessage("⚠️ I didn’t understand what to do.", "bot");
            }
          })
          .catch((err) => {
            console.error(err);
            addMessage("❌ AI server not reachable. Is it running?", "bot");
          });
      }
    );
  });
}
