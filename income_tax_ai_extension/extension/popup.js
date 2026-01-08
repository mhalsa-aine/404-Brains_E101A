const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Add initial message
addMessage("Hello! Ask me anything about this website.", "bot");

input.disabled = false;
input.focus();

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

async function ensureContentScript(tabId, url) {
  // Check if URL is valid for content scripts
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') || 
      url.startsWith('about:') ||
      url.startsWith('edge://') ||
      url.startsWith('data:')) {
    throw new Error("Cannot access system pages");
  }

  try {
    // Try to ping the content script with timeout
    const pingPromise = chrome.tabs.sendMessage(tabId, { type: "PING" });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 1000)
    );
    
    await Promise.race([pingPromise, timeoutPromise]);
    console.log("Content script already loaded");
    return true;
  } catch (error) {
    console.log("Content script not responding, injecting...");
    
    // Content script not loaded, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // Wait for script to initialize
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it loaded
      try {
        await chrome.tabs.sendMessage(tabId, { type: "PING" });
        console.log("Content script injected successfully");
        return true;
      } catch (verifyError) {
        console.error("Content script injection failed verification");
        return false;
      }
    } catch (err) {
      console.error("Failed to inject content script:", err);
      throw new Error("Cannot inject script: " + err.message);
    }
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  input.disabled = true;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs || !tabs[0]) {
      addMessage("⚠️ No active tab found.", "bot");
      input.disabled = false;
      return;
    }

    const tab = tabs[0];
    
    console.log("Tab URL:", tab.url);
    console.log("Tab ID:", tab.id);

    // Check if URL is accessible
    if (!tab.url || tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('about:') ||
        tab.url.startsWith('edge://')) {
      addMessage("⚠️ Cannot access system pages. Please navigate to a regular website.", "bot");
      input.disabled = false;
      return;
    }

    // Ensure content script is loaded
    try {
      await ensureContentScript(tab.id, tab.url);
    } catch (err) {
      addMessage(`⚠️ ${err.message}. Try refreshing the page.`, "bot");
      input.disabled = false;
      return;
    }

    // Get page structure with timeout
    let pageData;
    try {
      const dataPromise = chrome.tabs.sendMessage(tab.id, { 
        type: "GET_PAGE_STRUCTURE" 
      });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout getting page data")), 3000)
      );
      
      pageData = await Promise.race([dataPromise, timeoutPromise]);
      console.log("Page data:", pageData);
    } catch (err) {
      addMessage("⚠️ Cannot read page structure. Try refreshing.", "bot");
      input.disabled = false;
      return;
    }

    if (!pageData) {
      addMessage("⚠️ Page data is empty.", "bot");
      input.disabled = false;
      return;
    }

    addMessage("🔄 Thinking...", "bot");

    // Send to AI via background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "AI_FETCH",
        payload: {
          query: text,
          page: pageData
        }
      }, resolve);
    });

    // Remove "Thinking..." message
    chatBox.lastChild.remove();

    if (!response || !response.success) {
      const errorMsg = response?.error || "Unknown error";
      addMessage(`❌ Error: ${errorMsg}`, "bot");
      
      if (errorMsg.includes("fetch")) {
        addMessage("💡 Make sure the server is running: npm start", "bot");
      }
      
      input.disabled = false;
      return;
    }

    const ai = response.data;

    if (ai.action === "navigate" && ai.target) {
      addMessage(`🎯 Navigating to ${ai.target}...`, "bot");
      await chrome.tabs.sendMessage(tab.id, {
        type: "PERFORM_ACTION",
        target: ai.target
      });
    } else if (ai.action === "explain" && ai.answer) {
      addMessage(ai.answer, "bot");
    } else {
      addMessage("⚠️ I didn't understand that.", "bot");
    }

  } catch (error) {
    console.error("Error:", error);
    addMessage(`❌ Error: ${error.message}`, "bot");
  } finally {
    input.disabled = false;
    input.focus();
  }
}