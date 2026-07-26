chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'suggest') {
    fetch('https://api.bing.com/osjson.aspx?query=' + encodeURIComponent(message.query))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sendResponse({ data: data[1] || [] });
      })
      .catch(function () {
        sendResponse({ data: [] });
      });
    return true;
  }
});
