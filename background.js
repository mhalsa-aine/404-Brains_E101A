// ⚠️ PUT YOUR GROQ API KEY HERE (between the quotes)
// Example: const GROQ_API_KEY = "gsk_abc123def456...";
const GROQ_API_KEY = "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"; // Get from: https://console.groq.com/keys
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Validate API key on load
if (GROQ_API_KEY === "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" || !GROQ_API_KEY.startsWith("gsk_")) {
  console.error("🚨 CRITICAL: Invalid or missing GROQ_API_KEY in background.js!");
  console.error("Current key:", GROQ_API_KEY);
  console.error("Please update line 3 with your actual Groq API key from https://console.groq.com/keys");
}

// Store conversation history per tab
const conversationHistory = new Map();

console.log("🔧 Background service worker loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Extension installed successfully");
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
  
  if (request.type === "PING_BACKGROUND") {
    sendResponse({ status: "ok", message: "Background is active" });
    return true;
  }
  
  return false;
});

// Handle AI query with Groq API
async function handleAIQuery(request, sender, sendResponse) {
  const tabId = sender.tab?.id || "popup";
  
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
    console.log("🔑 API Key check:", GROQ_API_KEY.substring(0, 10) + "..." + GROQ_API_KEY.substring(GROQ_API_KEY.length - 5));
    console.log("🔑 Key length:", GROQ_API_KEY.length, "characters");
    
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Fast and smart model
        messages: messages,
        max_tokens: 2000, // Increased for detailed answers
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
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText.substring(0, 200);
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
    
    if (error.message.includes("API Error 401") || error.message.includes("Invalid API Key")) {
      userFriendlyError = "❌ Invalid API key. Please update GROQ_API_KEY in background.js";
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
    // Show important links with their abbreviations
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
6. **ANSWER GENERAL KNOWLEDGE QUESTIONS** - Use your training knowledge to help with queries about:
   - Finance, taxes, ITR, investments
   - Technology, coding, software
   - Education, careers, courses
   - Health, science, general topics
   - Any domain-specific expertise
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
- Cite sources or mention if information is from general knowledge vs. page content

FORM FILLING INSTRUCTIONS:
- When user wants to fill a form field, use: FILL_FORM: [field_type] = [value]
- When user wants to submit, use: SUBMIT_FORM
- To see available form fields, use: GET_FORM_FIELDS
- Supported field types: email, name, first_name, last_name, phone, password, address, city, zip, message, search
- Examples:
  * "Fill in my email" → FILL_FORM: email = user@example.com
  * "Enter John Doe in name field" → FILL_FORM: name = John Doe
  * "Submit the form" → SUBMIT_FORM

Examples:
User: "Click home"
You: "I'll take you to the home page! NAVIGATE_TO: Home"

User: "What's on this page?"
You: "This page is ${title}. It has ${linksCount} links and ${buttonsCount} buttons. The main sections include: [list top headings]."

User: "Click on AUMS" (when link says "Amrita University Management System (AUMS)")
You: "Opening the Amrita University Management System! NAVIGATE_TO: AUMS"

User: "How do I file ITR online?"
You: "To file your Income Tax Return (ITR) online in India:

1. Visit the Income Tax e-filing portal (incometax.gov.in)
2. Register/Login with your PAN
3. Select the appropriate ITR form based on your income sources
4. Fill in your income details, deductions, and tax paid
5. Verify using Aadhaar OTP, net banking, or DSC
6. Submit and download your acknowledgement

Common ITR forms:
- ITR-1: For salary income up to ₹50 lakh
- ITR-2: For capital gains, multiple properties
- ITR-3: For business/professional income
- ITR-4: For presumptive income

Would you like help finding the ITR portal on this page?"

User: "What is capital gains tax?"
You: "Capital Gains Tax is the tax on profit from selling capital assets like property, stocks, or mutual funds.

Types:
1. Short-term Capital Gains (STCG):
   - Assets held < 1 year (stocks) or < 2 years (property)
   - Taxed at your income tax slab rate
   - Exception: Listed equity/equity MFs taxed at 15%

2. Long-term Capital Gains (LTCG):
   - Assets held > 1 year (stocks) or > 2 years (property)
   - Listed equity: 10% tax on gains > ₹1 lakh/year
   - Property: 20% with indexation benefit

Exemptions: Section 54 (property), Section 54EC (bonds)"

User: "What links are available?"
You: "I can see these main links: [list all important navigation links with their abbreviations]"

User: "Fill in my email with john@example.com"
You: "I'll fill in your email! FILL_FORM: email = john@example.com"

User: "Tell me about wrestling" (on Wikipedia)
You: "I can help you learn about wrestling! Let me search for the wrestling article. NAVIGATE_TO: Professional wrestling"

User: "Explain React hooks"
You: "React Hooks are functions that let you use state and lifecycle features in functional components.

Key hooks:
1. useState: Manage component state
   const [count, setCount] = useState(0);

2. useEffect: Handle side effects (API calls, subscriptions)
   useEffect(() => { fetchData(); }, [dependency]);

3. useContext: Access context values
4. useReducer: Complex state logic
5. useMemo: Memoize expensive calculations
6. useCallback: Memoize functions

Benefits:
- Cleaner code than class components
- Better code reuse with custom hooks
- No 'this' keyword confusion"
`;

  return prompt;
}

// Parse AI response to extract actions
function parseAIResponse(aiResponse, pageData) {
  // Check if AI wants to navigate
  const navigateMatch = aiResponse.match(/NAVIGATE_TO:\s*(.+?)(?:\n|$)/i);
  
  if (navigateMatch) {
    const target = navigateMatch[1].trim();
    // Clean up the reply to remove the NAVIGATE_TO command
    const cleanReply = aiResponse.replace(/NAVIGATE_TO:.+/i, '').trim();
    
    return {
      reply: cleanReply || `Navigating to: ${target}`,
      action: "navigate",
      target: target
    };
  }
  
  // Check if AI wants to fill a form field
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
  
  // Check if AI wants to submit form
  if (aiResponse.match(/SUBMIT_FORM/i)) {
    const cleanReply = aiResponse.replace(/SUBMIT_FORM/i, '').trim();
    
    return {
      reply: cleanReply || "Submitting the form...",
      action: "submit_form"
    };
  }
  
  // Check if AI wants to get form fields
  if (aiResponse.match(/GET_FORM_FIELDS/i)) {
    return {
      reply: "Let me check what fields are on this form...",
      action: "get_form_fields"
    };
  }
  
  // Check for common navigation phrases in AI response
  const lowerResponse = aiResponse.toLowerCase();
  const navPhrases = ['i\'ll take you', 'let me open', 'opening', 'clicking', 'navigating to'];
  
  if (navPhrases.some(phrase => lowerResponse.includes(phrase))) {
    // Try to extract target from quotes or context
    const quotedMatch = aiResponse.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return {
        reply: aiResponse,
        action: "navigate",
        target: quotedMatch[1]
      };
    }
  }
  
  // No action, just return the reply
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