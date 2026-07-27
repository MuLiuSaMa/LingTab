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

  if (message.type === 'weather') {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + message.latitude + '&longitude=' + message.longitude + '&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sendResponse({ data: data });
      })
      .catch(function () {
        sendResponse({ data: null });
      });
    return true;
  }

  if (message.type === 'geolocation') {
    fetch('http://ip-api.com/json/?lang=zh-CN')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.status === 'success') {
          sendResponse({ data: { latitude: data.lat, longitude: data.lon, city: data.city } });
        } else {
          sendResponse({ data: null });
        }
      })
      .catch(function () {
        sendResponse({ data: null });
      });
    return true;
  }
});
