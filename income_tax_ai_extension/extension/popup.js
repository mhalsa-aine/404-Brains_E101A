const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

addMessage("Hello! Ask me anything about this website.", "bot");

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  input.disabled = true;

  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
      addMessage("⚠️ No active tab.", "bot");
      input.disabled = false;
      return;
    }

    const tab = tabs[0];

    // Check if we can access this page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      addMessage("⚠️ Cannot access system pages.", "bot");
      input.disabled = false;
      return;
    }

    // Inject content script if needed
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "PING" });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 200));
    }

    // Get page structure
    const pageData = await chrome.tabs.sendMessage(tab.id, { 
      type: "GET_PAGE_STRUCTURE" 
    });

    console.log("Page data:", pageData);

    // Send to AI server
    const response = await chrome.runtime.sendMessage({
      type: "AI_FETCH",
      payload: { query: text, page: pageData }
    });

    if (!response || !response.success) {
      addMessage(`❌ ${response?.error || "Server error"}`, "bot");
      input.disabled = false;
      return;
    }

    const ai = response.data;

    if (ai.action === "navigate" && ai.target) {
      addMessage(`🎯 Navigating to: ${ai.target}`, "bot");
      
      await chrome.tabs.sendMessage(tab.id, {
        type: "PERFORM_ACTION",
        target: ai.target
      });
    } else if (ai.action === "explain" && ai.answer) {
      addMessage(ai.answer, "bot");
    } else {
      addMessage("⚠️ No action taken.", "bot");
    }

  } catch (error) {
    console.error("Error:", error);
    addMessage(`❌ ${error.message}`, "bot");
  } finally {
    input.disabled = false;
    input.focus();
  }
}