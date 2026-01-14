// NO HARDCODED API KEY! Users provide their own
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Store conversation history per tab
const conversationHistory = new Map();

console.log("🔧 Background service worker loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Extension installed successfully");
  
  // Check if user has set up their API key
  chrome.storage.sync.get(['groqApiKey'], (result) => {
    if (!result.groqApiKey) {
      console.log("⚠️ No API key found - user needs to set up");
    } else {
      console.log("✅ API key found in storage");
    }
  });
});

// Main message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Background received message:", request.type);
  
  if (request.type === "AI_QUERY") {
    handleAIQuery(request, sender, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.type === "CLEAR_HISTORY") {
    const tabId = sender.tab?.id || "popup";
    conversationHistory.delete(tabId);
    console.log("🗑️ Conversation history cleared for tab:", tabId);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === "SAVE_API_KEY") {
    chrome.storage.sync.set({ groqApiKey: request.apiKey }, () => {
      console.log("✅ API key saved successfully");
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.type === "GET_API_KEY") {
    chrome.storage.sync.get(['groqApiKey'], (result) => {
      sendResponse({ apiKey: result.groqApiKey || null });
    });
    return true;
  }
  
  if (request.type === "DELETE_API_KEY") {
    chrome.storage.sync.remove(['groqApiKey'], () => {
      console.log("🗑️ API key deleted");
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.type === "PING_BACKGROUND") {
    sendResponse({ status: "ok", message: "Background is active" });
    return true;
  }
  
  return false;
});

// Handle AI query with Groq API
async function handleAIQuery(request, sender, sendResponse) {
  const tabId = sender.tab?.id || "popup";
  
  // Get user's API key from storage
  chrome.storage.sync.get(['groqApiKey'], async (result) => {
    const userApiKey = result.groqApiKey;
    
    if (!userApiKey) {
      sendResponse({ 
        reply: "⚠️ Please set up your Groq API key first! Click the settings icon in the extension.",
        success: false,
        needsSetup: true
      });
      return;
    }
    
    // Initialize conversation history for this tab
    if (!conversationHistory.has(tabId)) {
      conversationHistory.set(tabId, []);
    }
    
    const history = conversationHistory.get(tabId);
    const systemPrompt = buildSystemPrompt(request.pageData);
    
    // Build messages array
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history,
      {
        role: "user",
        content: request.message
      }
    ];
    
    try {
      console.log("🤖 Sending request to Groq API...");
      console.log("📝 User message:", request.message);
      
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userApiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 1,
          stream: false
        })
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        
        let errorMessage = `API Error ${response.status}`;
        
        if (response.status === 401) {
          errorMessage = "❌ Invalid API key. Please check your Groq API key in settings.";
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error?.message || errorMessage;
          } catch (e) {
            errorMessage = errorText.substring(0, 200);
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ API Response received");
      
      let reply = "I apologize, but I couldn't generate a response. Please try again.";
      let action = null;
      let target = null;
      
      if (data?.choices?.[0]?.message?.content) {
        const aiResponse = data.choices[0].message.content.trim();
        console.log("🤖 AI Response:", aiResponse);
        
        // Parse AI response for actions
        const parsedResponse = parseAIResponse(aiResponse, request.pageData);
        reply = parsedResponse.reply;
        action = parsedResponse.action;
        target = parsedResponse.target;
        
        // Add to conversation history
        history.push({
          role: "user",
          content: request.message
        });
        history.push({
          role: "assistant",
          content: aiResponse
        });
        
        // Keep history manageable (last 10 exchanges = 20 messages)
        if (history.length > 20) {
          history.splice(0, 2);
        }
      }
      
      sendResponse({ 
        reply: reply,
        action: action,
        target: target,
        success: true 
      });
      
    } catch (error) {
      console.error("❌ AI Query Error:", error);
      
      let userFriendlyError = "Sorry, I couldn't connect to the AI service.";
      
      if (error.message.includes("Invalid API key")) {
        userFriendlyError = "❌ Invalid API key. Please update your key in settings.";
      } else if (error.message.includes("API Error 429")) {
        userFriendlyError = "⏳ Rate limit reached. Please wait a moment and try again.";
      } else if (error.message.includes("Failed to fetch")) {
        userFriendlyError = "🌐 Network error. Check your internet connection.";
      } else {
        userFriendlyError = `❌ Error: ${error.message}`;
      }
      
      sendResponse({ 
        reply: userFriendlyError,
        success: false 
      });
    }
  });
}

// Build system prompt with page context
function buildSystemPrompt(pageData) {
  if (!pageData) {
    return "You are a helpful AI assistant for website navigation.";
  }
  
  const title = pageData.title || "Unknown";
  const url = pageData.url || "Unknown";
  const domain = pageData.domain || "Unknown";
  const linksCount = pageData.linksCount || 0;
  const headingsCount = pageData.headingsCount || 0;
  const formsCount = pageData.formsCount || 0;
  const buttonsCount = pageData.buttonsCount || 0;
  
  let prompt = `You are a helpful AI assistant specialized in website navigation and user assistance.

CURRENT PAGE INFORMATION:
- Title: ${title}
- URL: ${url}
- Domain: ${domain}

PAGE STRUCTURE:
- Total Links: ${linksCount}
- Headings: ${headingsCount}
- Forms: ${formsCount}
- Buttons: ${buttonsCount}
`;

  if (pageData.headings && pageData.headings.length > 0) {
    prompt += `\nMAIN HEADINGS ON PAGE:\n${pageData.headings.slice(0, 8).join('\n')}\n`;
  }
  
  if (pageData.navLinks && pageData.navLinks.length > 0) {
    prompt += `\nMAIN NAVIGATION LINKS:\n${pageData.navLinks.slice(0, 20).join(', ')}\n`;
  }
  
  if (pageData.links && pageData.links.length > 0) {
    const importantLinks = pageData.links.slice(0, 30).map(link => {
      if (link.abbreviation) {
        return `"${link.text}" (abbreviation: ${link.abbreviation})`;
      }
      return `"${link.text}"`;
    });
    prompt += `\nALL MAJOR LINKS ON PAGE:\n${importantLinks.join('\n')}\n`;
  }
  
  if (pageData.buttons && pageData.buttons.length > 0) {
    const buttonTexts = pageData.buttons.slice(0, 15).map(btn => {
      if (typeof btn === 'string') return btn;
      if (btn.abbreviation) {
        return `"${btn.text}" (${btn.abbreviation})`;
      }
      return btn.text;
    });
    prompt += `\nBUTTONS ON PAGE:\n${buttonTexts.join(', ')}\n`;
  }
  
  if (pageData.metaDescription) {
    prompt += `\nPAGE DESCRIPTION: ${pageData.metaDescription}\n`;
  }

  prompt += `
YOUR ROLE:
1. Help users navigate this website effectively
2. Answer questions about the page content and structure
3. Guide users to find specific features or information
4. When users want to navigate somewhere, respond with: NAVIGATE_TO: [exact button or link text]
5. For questions, provide helpful, conversational answers
6. **ANSWER GENERAL KNOWLEDGE QUESTIONS** - Use your training knowledge to help with queries about finance, taxes, technology, education, health, etc.
7. Provide detailed, accurate answers when asked complex questions

IMPORTANT INSTRUCTIONS FOR NAVIGATION:
- If user wants to click something or go somewhere, include "NAVIGATE_TO: [exact text]" in your response
- Use the EXACT text from the available links or buttons shown above
- **PAY ATTENTION to abbreviations** - if a link says "System (AUMS)", you can use EITHER "System" OR "AUMS"
- **ALWAYS check the full list of links** before saying something doesn't exist
- **AVOID navigation elements like "store", "shop", "cart", "merchandise" unless specifically requested**
- **PREFER main content links over navigation/footer links**
- For ambiguous requests, ask for clarification instead of guessing

RESPONSE GUIDELINES:
- For navigation/form tasks: Keep responses brief (2-3 sentences)
- For general questions: Provide detailed, comprehensive answers
- Be conversational and helpful
- Reference actual elements from the page when relevant
- Use proper formatting for complex answers (bullet points, numbered lists when appropriate)

FORM FILLING INSTRUCTIONS:
- When user wants to fill a form field, use: FILL_FORM: [field_type] = [value]
- When user wants to submit, use: SUBMIT_FORM
- To see available form fields, use: GET_FORM_FIELDS
`;

  return prompt;
}

// Parse AI response to extract actions
function parseAIResponse(aiResponse, pageData) {
  const navigateMatch = aiResponse.match(/NAVIGATE_TO:\s*(.+?)(?:\n|$)/i);
  
  if (navigateMatch) {
    const target = navigateMatch[1].trim();
    const cleanReply = aiResponse.replace(/NAVIGATE_TO:.+/i, '').trim();
    
    return {
      reply: cleanReply || `Navigating to: ${target}`,
      action: "navigate",
      target: target
    };
  }
  
  const fillFormMatch = aiResponse.match(/FILL_FORM:\s*(.+?)\s*=\s*(.+?)(?:\n|$)/i);
  
  if (fillFormMatch) {
    const fieldType = fillFormMatch[1].trim();
    const value = fillFormMatch[2].trim();
    const cleanReply = aiResponse.replace(/FILL_FORM:.+/i, '').trim();
    
    return {
      reply: cleanReply || `Filling ${fieldType} with: ${value}`,
      action: "fill_form",
      fieldType: fieldType,
      value: value
    };
  }
  
  if (aiResponse.match(/SUBMIT_FORM/i)) {
    const cleanReply = aiResponse.replace(/SUBMIT_FORM/i, '').trim();
    
    return {
      reply: cleanReply || "Submitting the form...",
      action: "submit_form"
    };
  }
  
  if (aiResponse.match(/GET_FORM_FIELDS/i)) {
    return {
      reply: "Let me check what fields are on this form...",
      action: "get_form_fields"
    };
  }
  
  return {
    reply: aiResponse,
    action: "explain",
    target: null
  };
}

// Clean up history when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  conversationHistory.delete(tabId);
  console.log("🗑️ Cleaned up history for closed tab:", tabId);
});
