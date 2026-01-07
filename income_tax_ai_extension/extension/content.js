let lastHighlight = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FIND_AND_SCROLL") {
    const query = request.query.trim();
    if (!query) {
      sendResponse({ found: false });
      return;
    }

    // Remove previous highlight
    if (lastHighlight) {
      lastHighlight.outerHTML = lastHighlight.innerText;
      lastHighlight = null;
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (
            node.parentElement &&
            ["SCRIPT", "STYLE", "NOSCRIPT"].includes(
              node.parentElement.tagName
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const lowerQuery = query.toLowerCase();
    let node;

    while ((node = walker.nextNode())) {
      const index = node.nodeValue.toLowerCase().indexOf(lowerQuery);
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + query.length);

        const highlight = document.createElement("mark");
        highlight.style.backgroundColor = "yellow";
        highlight.style.padding = "2px";
        highlight.style.borderRadius = "3px";

        range.surroundContents(highlight);
        lastHighlight = highlight;

        highlight.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        sendResponse({
          found: true,
          context: highlight.innerText
        });
        return;
      }
    }

    sendResponse({ found: false });
  }
});

