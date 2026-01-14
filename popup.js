const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const settingsBtn = document.getElementById("settings-btn");
const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");

// Check API key on load
let hasApiKey = false;

async function checkApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
    hasApiKey = !!response.apiKey;
    
    if (!hasApiKey) {
      statusDot.classList.add('warning');
      statusText.textContent = "⚠️ API key not configured";
      addMessage("⚠️ Welcome! To get started:\n\n1. Click the ⚙️ settings icon (top right)\n2. Get your FREE API key from Groq\n3. Paste it in settings\n4. Start chatting!\n\nGroq offers generous free tier with fast AI responses.", "bot", false, true);
    } else {
      statusDot.classList.remove('warning');
      statusText.textContent = "Ready to help you navigate";
      addMessage("👋 Hello! I'm your AI navigation assistant powered by Groq.\n\nTry:\n• 'Take me to the home page'\n• 'What can I do here?'\n• 'Click the login button'", "bot");
    }
  } catch (error) {
    console.error("Failed to check API key:", error);
  }
}

checkApiKey();

// Settings button
settingsBtn.addEventListener("click", () => {
  window.location.href = 'settings.html';
});

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

if (clearBtn) {
  clearBtn.addEventListener("click", clearConversation);
}

function addMessage(text, sender, isError = false, isWarning = false) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  if (isError) msg.classList.add("error");
  if (isWarning) msg.classList.add("warning");
  
  // Convert markdown-style formatting and preserve line breaks
  let formattedText = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  
  // Handle numbered lists
  formattedText = formattedText.replace(/^(\d+)\.\s(.+)$/gm, '<div style="margin-left: 20px;">$1. $2</div>');
  
  // Handle bullet points
  formattedText = formattedText.replace(/^-\s(.+)$/gm, '<div style="margin-left: 20px;">• $1</div>');
  
  msg.innerHTML = formattedText;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "message bot typing-indicator";
  indicator.id = "typing-indicator";
  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  chatBox.appendChild(indicator);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) indicator.remove();
}

function updateStatus(text, isError = false) {
  if (statusText) {
    statusText.textContent = text;
    if (isError) {
      statusText.style.color = "#e53e3e";
    } else {
      statusText.style.color = "#718096";
    }
    
    // Reset after 3 seconds
    setTimeout(() => {
      if (hasApiKey) {
        statusText.textContent = "Ready to help you navigate";
      } else {
        statusText.textContent = "⚠️ API key not configured";
      }
      statusText.style.color = "#718096";
    }, 3000);
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  
  // Check if API key is configured
  if (!hasApiKey) {
    addMessage("⚠️ Please configure your API key first! Click the ⚙️ settings icon.", "bot", false, true);
    updateStatus("API key required", true);
    // Prompt to recheck
    setTimeout(checkApiKey, 100);
    return;
  }
  
  addMessage(text, "user");
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;
  
  updateStatus("Processing...");
  addTypingIndicator();
  
  try {
    console.log("🚀 Starting AI-powered message processing");
    
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("📑 Tabs found:", tabs.length);
    
    if (!tabs || !tabs[0]) {
      removeTypingIndicator();
      addMessage("⚠️ No active tab found.", "bot", true);
      updateStatus("Error: No active tab", true);
      return;
    }
    
    const tab = tabs[0];
    console.log("📄 Active tab:", tab.url);
    
    // Check if we can access this page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      removeTypingIndicator();
      addMessage("⚠️ Cannot access system pages or extension pages. Please open a regular website.", "bot", true);
      updateStatus("Cannot access system pages", true);
      return;
    }
    
    // Inject content script if needed
    let contentScriptReady = false;
    try {
      console.log("🔌 Testing content script connection");
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
      console.log("✅ Content script already loaded:", pingResponse);
      contentScriptReady = true;
    } catch (error) {
      console.log("❌ Content script not loaded, injecting...");
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log("✅ Content script injected");
        await new Promise(r => setTimeout(r, 500));
        contentScriptReady = true;
      } catch (injectError) {
        console.error("❌ Failed to inject content script:", injectError);
        removeTypingIndicator();
        addMessage("❌ Cannot access this page. Try reloading the page first.", "bot", true);
        updateStatus("Injection failed", true);
        return;
      }
    }
    
    if (!contentScriptReady) {
      removeTypingIndicator();
      addMessage("❌ Failed to connect to page.", "bot", true);
      updateStatus("Connection failed", true);
      return;
    }
    
    // Get page structure
    console.log("📊 Getting page structure");
    let pageData;
    try {
      pageData = await chrome.tabs.sendMessage(tab.id, { 
        type: "GET_PAGE_STRUCTURE" 
      });
      console.log("✅ Page data received:", pageData);
      updateStatus("Analyzing with AI...");
    } catch (error) {
      console.error("❌ Failed to get page structure:", error);
      removeTypingIndicator();
      addMessage("❌ Failed to read page structure.", "bot", true);
      updateStatus("Failed to read page", true);
      return;
    }
    
    // Send to AI (Groq API via background script)
    console.log("🤖 Sending to Groq AI...");
    updateStatus("Asking AI...");
    
    let aiResponse;
    try {
      aiResponse = await chrome.runtime.sendMessage({
        type: "AI_QUERY",
        message: text,
        pageData: pageData
      });
      console.log("✅ AI response received:", aiResponse);
    } catch (error) {
      console.error("❌ AI query failed:", error);
      removeTypingIndicator();
      addMessage("❌ Failed to get AI response. Please check your API key in settings.", "bot", true);
      updateStatus("AI query failed", true);
      return;
    }
    
    removeTypingIndicator();
    
    // Check if user needs to set up API key
    if (aiResponse && aiResponse.needsSetup) {
      hasApiKey = false;
      statusDot.classList.add('warning');
      addMessage("⚠️ Please set up your Groq API key in settings first! Click the ⚙️ icon.", "bot", false, true);
      updateStatus("API key required", true);
      return;
    }
    
    if (!aiResponse || !aiResponse.success) {
      addMessage(aiResponse?.reply || "❌ AI service error. Please check your API key in settings.", "bot", true);
      updateStatus("AI error", true);
      return;
    }
    
    // Show AI's reply
    addMessage(aiResponse.reply, "bot");
    
    // Handle different actions
    if (aiResponse.action === "navigate" && aiResponse.target) {
      console.log("🎯 AI requested navigation to:", aiResponse.target);
      updateStatus("Navigating...");
      
      // Small delay before navigating
      await new Promise(r => setTimeout(r, 800));
      
      try {
        const navResult = await chrome.tabs.sendMessage(tab.id, {
          type: "PERFORM_ACTION",
          target: aiResponse.target
        });
        
        console.log("🔄 Navigation result:", navResult);
        
        if (navResult && navResult.success) {
          addMessage(`✅ Successfully clicked: ${navResult.found}`, "bot");
          updateStatus("Navigation successful!");
        } else {
          addMessage(`❌ Could not find: ${aiResponse.target}\n\nTry asking "What can I click on this page?"`, "bot");
          updateStatus("Element not found", true);
        }
      } catch (error) {
        console.error("❌ Navigation error:", error);
        addMessage("❌ Navigation failed. The element might not be clickable.", "bot", true);
        updateStatus("Navigation failed", true);
      }
    } 
    else if (aiResponse.action === "fill_form" && aiResponse.fieldType && aiResponse.value) {
      console.log("📝 AI requested form fill:", aiResponse.fieldType, "=", aiResponse.value);
      updateStatus("Filling form...");
      
      await new Promise(r => setTimeout(r, 500));
      
      try {
        const fillResult = await chrome.tabs.sendMessage(tab.id, {
          type: "FILL_FORM",
          fieldType: aiResponse.fieldType,
          value: aiResponse.value
        });
        
        console.log("📝 Fill result:", fillResult);
        
        if (fillResult && fillResult.success) {
          addMessage(`✅ Filled ${fillResult.field} with: ${fillResult.value}`, "bot");
          updateStatus("Form filled!");
        } else {
          addMessage(`❌ Could not find ${aiResponse.fieldType} field on this page`, "bot", true);
          updateStatus("Field not found", true);
        }
      } catch (error) {
        console.error("❌ Form fill error:", error);
        addMessage("❌ Failed to fill form field.", "bot", true);
        updateStatus("Fill failed", true);
      }
    }
    else if (aiResponse.action === "submit_form") {
      console.log("📤 AI requested form submission");
      updateStatus("Submitting form...");
      
      await new Promise(r => setTimeout(r, 500));
      
      try {
        const submitResult = await chrome.tabs.sendMessage(tab.id, {
          type: "SUBMIT_FORM"
        });
        
        console.log("📤 Submit result:", submitResult);
        
        if (submitResult && submitResult.success) {
          addMessage(`✅ Form submitted successfully!`, "bot");
          updateStatus("Form submitted!");
        } else {
          addMessage(`❌ Could not find submit button on this page`, "bot", true);
          updateStatus("Submit failed", true);
        }
      } catch (error) {
        console.error("❌ Form submit error:", error);
        addMessage("❌ Failed to submit form.", "bot", true);
        updateStatus("Submit failed", true);
      }
    }
    else if (aiResponse.action === "get_form_fields") {
      console.log("📋 AI requested form fields list");
      updateStatus("Checking form fields...");
      
      try {
        const fieldsResult = await chrome.tabs.sendMessage(tab.id, {
          type: "GET_FORM_FIELDS"
        });
        
        console.log("📋 Form fields:", fieldsResult);
        
        if (fieldsResult && fieldsResult.success && fieldsResult.fields.length > 0) {
          let fieldsMessage = `📋 Found ${fieldsResult.fields.length} form fields:\n\n`;
          fieldsResult.fields.forEach((field, i) => {
            const required = field.required ? " (required)" : "";
            fieldsMessage += `${i+1}. ${field.name} - ${field.type}${required}\n`;
            if (field.placeholder) fieldsMessage += `   Placeholder: "${field.placeholder}"\n`;
          });
          addMessage(fieldsMessage, "bot");
          updateStatus("Form analyzed!");
        } else {
          addMessage(`ℹ️ No form fields found on this page`, "bot");
          updateStatus("No forms found");
        }
      } catch (error) {
        console.error("❌ Get fields error:", error);
        addMessage("❌ Failed to analyze form.", "bot", true);
        updateStatus("Analysis failed", true);
      }
    }
    else {
      updateStatus("Response received!");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
    removeTypingIndicator();
    addMessage(`❌ Error: ${error.message}`, "bot", true);
    updateStatus("Error occurred", true);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

async function clearConversation() {
  // Clear visual chat
  chatBox.innerHTML = "";
  
  // Re-check API key and show appropriate welcome message
  const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
  hasApiKey = !!response.apiKey;
  
  if (!hasApiKey) {
    addMessage("⚠️ Welcome! Please configure your API key in settings (⚙️ icon) to get started.", "bot", false, true);
  } else {
    addMessage("🔄 Conversation cleared! Starting fresh.", "bot");
  }
  
  // Clear backend history
  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
    console.log("✅ Conversation history cleared");
    updateStatus("Conversation cleared");
  } catch (error) {
    console.error("❌ Failed to clear history:", error);
  }
}

// Auto-focus input on popup open
window.addEventListener("load", () => {
  input.focus();
})