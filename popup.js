chrome.runtime.onMessage.addListener((msg) => {
  const url = msg.currentUrl;

  fetch("pages.json")
    .then(res => res.json())
    .then(data => {
      let found = null;

      for (let page in data) {
        if (url.includes(data[page].match)) {
          found = data[page];
        }
      }

      if (found) {
        document.getElementById("pageInfo").innerHTML =
          `<b>${found.title}</b><br>${found.description}<br><br>` +
          found.next_steps.map(step => 
            `<a href="${step.link}" target="_blank">${step.label}</a><br>`
          ).join("");
      } else {
        document.getElementById("pageInfo").innerHTML =
          "This page is not mapped yet.";
      }
    });
});
