(function () {
  var form = document.getElementById('searchForm');
  var input = document.getElementById('searchInput');
  var list = document.getElementById('suggestList');
  var hint = document.getElementById('hint');

  var suggestData = [];
  var selectedIndex = -1;
  var debounceTimer = null;

  function showHint(msg) {
    hint.textContent = msg;
    hint.classList.add('show');
    setTimeout(function () {
      hint.classList.remove('show');
    }, 1800);
  }

  function fetchSuggestions(query) {
    console.log('Fetching suggestions for:', query);
    if (query.length === 0) {
      list.classList.remove('active');
      list.innerHTML = '';
      suggestData = [];
      selectedIndex = -1;
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { type: 'suggest', query: query },
        function (response) {
          console.log('Suggest response:', response);
          if (response && response.data) {
            renderSuggestions(response.data);
          }
        }
      );
    } catch (e) {
      console.log('Using fallback fetch:', e);
      fetch('https://api.bing.com/osjson.aspx?query=' + encodeURIComponent(query))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          console.log('Bing API response:', data);
          renderSuggestions(data[1] || []);
        })
        .catch(function (err) {
          console.log('Fetch error:', err);
        });
    }
  }

  function renderSuggestions(items) {
    console.log('Rendering suggestions:', items);
    suggestData = items || [];
    selectedIndex = -1;
    list.innerHTML = '';

    if (suggestData.length === 0) {
      list.classList.remove('active');
      return;
    }

    suggestData.forEach(function (item, i) {
      var li = document.createElement('li');
      li.dataset.index = i;

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.innerHTML = '<circle cx="10.5" cy="10.5" r="7"/><line x1="15.5" y1="15.5" x2="21" y2="21"/>';

      var span = document.createElement('span');
      span.textContent = item;

      li.appendChild(svg);
      li.appendChild(span);

      li.addEventListener('click', function () {
        input.value = item;
        list.classList.remove('active');
        window.location.href = 'https://www.bing.com/search?q=' + encodeURIComponent(item);
      });

      list.appendChild(li);
    });

    list.classList.add('active');
  }

  input.addEventListener('input', function () {
    var val = input.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      fetchSuggestions(val);
    }, 200);
  });

  input.addEventListener('keydown', function (e) {
    var items = list.querySelectorAll('li');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateActive(items);
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault();
        input.value = suggestData[selectedIndex];
        list.classList.remove('active');
        window.location.href = 'https://www.bing.com/search?q=' + encodeURIComponent(suggestData[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      list.classList.remove('active');
      selectedIndex = -1;
    }
  });

  function updateActive(items) {
    items.forEach(function (li, i) {
      li.classList.toggle('active', i === selectedIndex);
    });
    if (selectedIndex >= 0 && items[selectedIndex]) {
      input.value = suggestData[selectedIndex];
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (q.length === 0) {
      showHint('请输入搜索内容');
      return;
    }
    list.classList.remove('active');
    window.location.href = 'https://www.bing.com/search?q=' + encodeURIComponent(q);
  });

  document.addEventListener('click', function (e) {
    if (!form.contains(e.target)) {
      list.classList.remove('active');
      selectedIndex = -1;
    }
  });

  var settingsBtn = document.getElementById('settingsBtn');
  var settingsPanel = document.getElementById('settingsPanel');
  var settingsClose = document.getElementById('settingsClose');

  settingsBtn.addEventListener('click', function () {
    settingsPanel.classList.add('open');
  });

  function closeSettings() {
    settingsPanel.classList.remove('open');
  }

  settingsClose.addEventListener('click', closeSettings);
  document.addEventListener('click', function (e) {
    if (settingsPanel.classList.contains('open') && !settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
      closeSettings();
    }
  });

  var bgLayer = document.getElementById('bgLayer');
  var bgVideo = document.getElementById('bgVideo');
  var bgOverlay = document.getElementById('bgOverlay');
  var bgUploadInput = document.getElementById('bgUploadInput');
  var bgGrid = document.getElementById('bgGrid');

  var currentBgUrl = null;
  var activeBgId = null;
  var tileUrls = {};

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('LingTabDB', 3);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (e.oldVersion < 3) {
          if (db.objectStoreNames.contains('bg')) db.deleteObjectStore('bg');
          db.createObjectStore('bg', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function getAllBg() {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('bg', 'readonly');
        var req = tx.objectStore('bg').getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    });
  }

  function addBg(type, file) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('bg', 'readwrite');
        var req = tx.objectStore('bg').add({ type: type, blob: file });
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      });
    });
  }

  function deleteBg(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('bg', 'readwrite');
        tx.objectStore('bg').delete(id);
        tx.oncomplete = function () { resolve(); };
      });
    });
  }

  function applyBackground(type, file) {
    if (currentBgUrl) { URL.revokeObjectURL(currentBgUrl); currentBgUrl = null; }
    bgLayer.style.backgroundImage = '';
    bgVideo.style.display = 'none';
    bgVideo.pause();
    bgVideo.removeAttribute('src');
    bgVideo.load();

    if (type === 'image') {
      currentBgUrl = URL.createObjectURL(file);
      bgLayer.style.backgroundImage = 'url(' + currentBgUrl + ')';
      bgOverlay.classList.add('active');
    } else {
      currentBgUrl = URL.createObjectURL(file);
      bgVideo.src = currentBgUrl;
      bgVideo.style.display = 'block';
      bgVideo.play().catch(function () {});
      bgOverlay.classList.add('active');
    }
  }

  function clearBg() {
    if (currentBgUrl) { URL.revokeObjectURL(currentBgUrl); currentBgUrl = null; }
    bgLayer.style.backgroundImage = '';
    bgVideo.style.display = 'none';
    bgVideo.pause();
    bgVideo.removeAttribute('src');
    bgVideo.load();
    bgOverlay.classList.remove('active');
    activeBgId = null;
    localStorage.removeItem('lingtab_active_bg');
    renderGallery();
  }

  function renderGallery() {
    getAllBg().then(function (list) {
      var html = '';
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var isActive = item.id === activeBgId;
        var blobUrl = tileUrls[item.id];
        if (!blobUrl) {
          blobUrl = URL.createObjectURL(item.blob);
          tileUrls[item.id] = blobUrl;
        }
        html += '<div class="bg-tile' + (isActive ? ' active' : '') + '" data-id="' + item.id + '">';
        if (item.type === 'video') {
          html += '<video src="' + blobUrl + '" muted loop playsinline></video>';
          html += '<div class="bg-tile-play"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg></div>';
        } else {
          html += '<img src="' + blobUrl + '">';
        }
        html += '<button class="bg-tile-del" data-id="' + item.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        html += '</div>';
      }
      html += '<div class="bg-tile bg-tile-add" id="bgAddTile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>';
      bgGrid.innerHTML = html;

      document.getElementById('bgAddTile').addEventListener('click', function () { bgUploadInput.click(); });

      bgGrid.querySelectorAll('.bg-tile[data-id]').forEach(function (tile) {
        tile.addEventListener('click', function (e) {
          if (e.target.closest('.bg-tile-del')) return;
          var id = parseInt(this.dataset.id);
          activateBg(id);
        });
      });

      bgGrid.querySelectorAll('.bg-tile-del').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = parseInt(this.dataset.id);
          removeBg(id);
        });
      });
    });
  }

  function activateBg(id) {
    getAllBg().then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          activeBgId = id;
          localStorage.setItem('lingtab_active_bg', id);
          applyBackground(list[i].type, list[i].blob);
          renderGallery();
          return;
        }
      }
    });
  }

  function removeBg(id) {
    if (tileUrls[id]) { URL.revokeObjectURL(tileUrls[id]); delete tileUrls[id]; }
    deleteBg(id).then(function () {
      if (activeBgId === id) clearBg();
      else renderGallery();
    });
  }

  bgUploadInput.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    this.value = '';
    var type = file.type.indexOf('video') === 0 ? 'video' : 'image';
    addBg(type, file).then(function (id) {
      if (id) activateBg(id);
    });
  });

  getAllBg().then(function (list) {
    var savedId = parseInt(localStorage.getItem('lingtab_active_bg'), 10);
    if (savedId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === savedId) {
          activeBgId = savedId;
          applyBackground(list[i].type, list[i].blob);
          break;
        }
      }
    }
    renderGallery();
  });

  var cpTrigger = document.getElementById('cpTrigger');
  var cpOverlay = document.getElementById('cpOverlay');
  var cpPopup = document.querySelector('.cp-popup');
  var cpPopupClose = document.getElementById('cpPopupClose');
  var cpPanel = document.getElementById('cpPanel');
  var cpCursor = document.getElementById('cpCursor');
  var cpHue = document.getElementById('cpHue');
  var cpHueCursor = document.getElementById('cpHueCursor');
  var cpPreview = document.getElementById('cpPreview');
  var cpHex = document.getElementById('cpHex');
  var cpPreviewSm = document.getElementById('cpPreviewSm');

  var cpHueVal = 212;
  var cpSat = 65;
  var cpBri = 85;
  var cpDragging = false;
  var cpHueDragging = false;

  cpTrigger.addEventListener('click', function () {
    cpOverlay.style.display = 'flex';
  });

  cpPopupClose.addEventListener('click', function () {
    cpOverlay.style.display = 'none';
  });

  cpOverlay.addEventListener('click', function (e) {
    if (!cpPopup.contains(e.target)) cpOverlay.style.display = 'none';
  });

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (c) {
      var h = Math.round(c).toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('');
  }

  function hsbToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var r1, g1, b1;
    if (h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
  }

  function rgbToHsb(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;
    var d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) { h = 0; }
    else {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
      h *= 360;
    }
    return { h: h, s: s, v: v };
  }

  function setAccentFromHSB() {
    var rgb = hsbToRgb(cpHueVal, cpSat / 100, cpBri / 100);
    var hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--cp-hue', cpHueVal);
    cpPreview.style.background = hex;
    cpPreviewSm.style.background = hex;
    cpHex.textContent = hex;
    localStorage.setItem('lingtab_accent', hex);
  }

  function updateCursor() {
    var panelRect = cpPanel.getBoundingClientRect();
    var x = (cpSat / 100) * panelRect.width;
    var y = (1 - cpBri / 100) * panelRect.height;
    cpCursor.style.left = x + 'px';
    cpCursor.style.top = y + 'px';
    cpCursor.style.background = 'hsl(' + cpHueVal + ', 100%, 50%)';
  }

  function updateHueCursor() {
    var hueRect = cpHue.getBoundingClientRect();
    var x = (cpHueVal / 360) * hueRect.width;
    cpHueCursor.style.left = x + 'px';
  }

  function cpPanelPos(e) {
    var rect = cpPanel.getBoundingClientRect();
    var ex = e.clientX || (e.touches && e.touches[0].clientX);
    var ey = e.clientY || (e.touches && e.touches[0].clientY);
    var x = Math.max(0, Math.min(1, (ex - rect.left) / rect.width));
    var y = Math.max(0, Math.min(1, (ey - rect.top) / rect.height));
    cpSat = x * 100;
    cpBri = (1 - y) * 100;
    updateCursor();
    setAccentFromHSB();
  }

  function cpHuePos(e) {
    var rect = cpHue.getBoundingClientRect();
    var ex = e.clientX || (e.touches && e.touches[0].clientX);
    var x = Math.max(0, Math.min(1, (ex - rect.left) / rect.width));
    cpHueVal = x * 360;
    cpPanel.style.background = 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(' + cpHueVal + ', 100%, 50%))';
    updateHueCursor();
    setAccentFromHSB();
  }

  cpPanel.addEventListener('mousedown', function (e) {
    cpDragging = true;
    cpPanelPos(e);
  });

  cpHue.addEventListener('mousedown', function (e) {
    cpHueDragging = true;
    cpHuePos(e);
  });

  document.addEventListener('mousemove', function (e) {
    if (cpDragging) cpPanelPos(e);
    if (cpHueDragging) cpHuePos(e);
  });

  document.addEventListener('mouseup', function () {
    cpDragging = false;
    cpHueDragging = false;
  });

  function loadSavedAccent() {
    var saved = localStorage.getItem('lingtab_accent');
    if (saved) {
      var r = parseInt(saved.slice(1,3), 16);
      var g = parseInt(saved.slice(3,5), 16);
      var b = parseInt(saved.slice(5,7), 16);
      var hsb = rgbToHsb(r, g, b);
      cpHueVal = hsb.h;
      cpSat = hsb.s * 100;
      cpBri = hsb.v * 100;
    }
    cpPanel.style.background = 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(' + cpHueVal + ', 100%, 50%))';
    updateCursor();
    updateHueCursor();
    setAccentFromHSB();
  }

  loadSavedAccent();

  var sponsorOverlay = document.getElementById('sponsorOverlay');
  var sponsorImg = document.getElementById('sponsorImg');
  var sponsorClose = document.getElementById('sponsorClose');
  var sponsorAlipay = document.getElementById('sponsorAlipay');
  var sponsorWechat = document.getElementById('sponsorWechat');

  function showSponsor(src) {
    sponsorImg.src = src;
    sponsorOverlay.classList.add('active');
  }

  function closeSponsor() {
    sponsorOverlay.classList.remove('active');
    sponsorImg.src = '';
  }

  sponsorAlipay.addEventListener('click', function () {
    showSponsor('alipay.png');
  });

  sponsorWechat.addEventListener('click', function () {
    showSponsor('wechat.png');
  });

  sponsorClose.addEventListener('click', closeSponsor);

  sponsorOverlay.addEventListener('click', function (e) {
    if (e.target === sponsorOverlay) closeSponsor();
  });


  // ---------- Clock ----------
  var clockEl = document.getElementById('clock');
  var clockDigital = document.getElementById('clockDigital');
  var clockAnalog = document.getElementById('clockAnalog');

  var clockTime = document.getElementById('clockTime');
  var clockSec = document.getElementById('clockSec');
  var clockDate = document.getElementById('clockDate');

  var clockHour = document.getElementById('clockHour');
  var clockMinute = document.getElementById('clockMinute');
  var clockSecond = document.getElementById('clockSecond');
  var clockMarks = document.getElementById('clockMarks');

  var clockToggle = document.getElementById('clockToggle');
  var clockSecondsToggle = document.getElementById('clockSecondsToggle');
  var clockDateToggle = document.getElementById('clockDateToggle');
  var clockStyleBtns = document.querySelectorAll('.clock-style-btn');

  var clockStyle = localStorage.getItem('lingtab_clock_style') || 'digital';
  // 默认显示时钟，除非明确设置为 'false'
  var clockVisibleSaved = localStorage.getItem('lingtab_clock_visible');
  var clockVisible = clockVisibleSaved === null ? true : clockVisibleSaved !== 'false';
  var clockSeconds = localStorage.getItem('lingtab_clock_seconds') === 'true';
  var clockDateVisible = localStorage.getItem('lingtab_clock_date') !== 'false';
  var clockColor = localStorage.getItem('lingtab_clock_color') || 'auto';
  var clockScale = parseFloat(localStorage.getItem('lingtab_clock_scale')) || 1;
  var clockPosX = localStorage.getItem('lingtab_clock_pos_x') || '';
  var clockPosY = localStorage.getItem('lingtab_clock_pos_y') || '';

  // Clock context menu
  var clockContextMenu = document.getElementById('clock-context-menu');
  var clockSizeSlider = document.getElementById('clockSizeSlider');
  var clockResetPos = document.getElementById('clockResetPos');

  // 调试：确保时钟元素存在
  if (!clockEl) {
    console.error('Clock element not found');
  } else {
    console.log('Clock element found, visible:', clockVisible);
  }

  // Clock color picker
  var clockCpTrigger = document.getElementById('clockCpTrigger');
  var clockCpOverlay = document.getElementById('clockCpOverlay');
  var clockCpPopupClose = document.getElementById('clockCpPopupClose');
  var clockCpPanel = document.getElementById('clockCpPanel');
  var clockCpCursor = document.getElementById('clockCpCursor');
  var clockCpHue = document.getElementById('clockCpHue');
  var clockCpHueCursor = document.getElementById('clockCpHueCursor');
  var clockCpPreview = document.getElementById('clockCpPreview');
  var clockCpHex = document.getElementById('clockCpHex');
  var clockCpPreviewSm = document.getElementById('clockCpPreviewSm');
  var clockColorAutoBtn = document.getElementById('clockColorAutoBtn');

  var clockCpHueVal = 212;
  var clockCpSat = 65;
  var clockCpBri = 85;
  var clockCpDragging = false;
  var clockCpHueDragging = false;

  // Generate clock marks
  function generateClockMarks() {
    var html = '';
    for (var i = 0; i < 12; i++) {
      var angle = i * 30;
      var rad = (angle - 90) * Math.PI / 180;
      var x1 = 100 + 85 * Math.cos(rad);
      var y1 = 100 + 85 * Math.sin(rad);
      var x2 = 100 + 78 * Math.cos(rad);
      var y2 = 100 + 78 * Math.sin(rad);
      html += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    }
    clockMarks.innerHTML = html;
  }

  generateClockMarks();

  function updateClock() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var s = now.getSeconds();
    var ms = now.getMilliseconds();

    var hStr = String(h).padStart(2, '0');
    var mStr = String(m).padStart(2, '0');
    var sStr = String(s).padStart(2, '0');

    // Digital
    clockTime.textContent = hStr + ':' + mStr;
    clockSec.textContent = sStr;

    // Date
    var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    var dateStr = (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekdays[now.getDay()];
    clockDate.textContent = dateStr;

    // Analog
    var hourDeg = (h % 12 + m / 60) * 30;
    var minDeg = (m + s / 60) * 6;
    var secDeg = (s + ms / 1000) * 6;

    clockHour.style.transform = 'rotate(' + hourDeg + 'deg)';
    clockMinute.style.transform = 'rotate(' + minDeg + 'deg)';
    clockSecond.style.transform = 'rotate(' + secDeg + 'deg)';
  }

  function setClockStyle(style) {
    clockStyle = style;
    localStorage.setItem('lingtab_clock_style', style);

    clockDigital.style.display = 'none';
    clockAnalog.style.display = 'none';

    if (style === 'digital') {
      clockDigital.style.display = 'flex';
      document.body.classList.remove('no-clock');
    } else if (style === 'analog') {
      clockAnalog.style.display = 'block';
      document.body.classList.remove('no-clock');
    } else if (style === 'off') {
      document.body.classList.add('no-clock');
    }

    clockStyleBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.style === style);
    });

    updateClock();
  }

  function setClockVisible(visible) {
    clockVisible = visible;
    localStorage.setItem('lingtab_clock_visible', visible);
    document.body.classList.toggle('no-clock', !visible);
  }

  function setClockSeconds(show) {
    clockSeconds = show;
    localStorage.setItem('lingtab_clock_seconds', show);
    clockSec.classList.toggle('hidden', !show);
    document.body.classList.toggle('no-clock-seconds', !show);
  }

  function setClockDateVisible(show) {
    clockDateVisible = show;
    localStorage.setItem('lingtab_clock_date', show);
    clockDate.classList.toggle('hidden', !show);
  }

  function setClockScale(scale) {
    clockScale = scale;
    localStorage.setItem('lingtab_clock_scale', scale);
    clockEl.style.transform = 'scale(' + scale + ')';
    // 时钟固定时重新定位，使缩放以中心为基准
    if (clockPosX && clockPosY) {
      setClockPosition(clockPosX, clockPosY);
    }
  }

  var clockSpacer = null;

  function setClockPosition(x, y) {
    clockPosX = x;
    clockPosY = y;
    localStorage.setItem('lingtab_clock_pos_x', x);
    localStorage.setItem('lingtab_clock_pos_y', y);
    if (x !== '' && y !== '') {
      // 时钟脱离 flex 流之前插入占位符，防止容器位移
      if (!clockSpacer) {
        clockSpacer = document.createElement('div');
        clockSpacer.className = 'clock-spacer';
        clockSpacer.style.visibility = 'hidden';
        clockSpacer.style.pointerEvents = 'none';
      }
      if (!clockSpacer.parentNode) {
        clockEl.parentNode.insertBefore(clockSpacer, clockEl);
      }
      clockSpacer.style.width = clockEl.offsetWidth + 'px';
      clockSpacer.style.height = clockEl.offsetHeight + 'px';
      clockSpacer.style.marginBottom = '32px';
      clockSpacer.style.flexShrink = '0';
      clockSpacer.style.display = 'inline-block';

      clockEl.style.position = 'fixed';
      var centerX, centerY;
      if (x.indexOf('%') !== -1) {
        centerX = (parseFloat(x) / 100) * window.innerWidth;
        centerY = (parseFloat(y) / 100) * window.innerHeight;
      } else {
        centerX = parseFloat(x);
        centerY = parseFloat(y);
      }
      var clockWidth = clockEl.offsetWidth || 200;
      var clockHeight = clockEl.offsetHeight || 80;
      var leftVal = centerX - clockWidth / 2;
      var topVal = centerY - clockHeight / 2;
      clockEl.style.left = leftVal + 'px';
      clockEl.style.top = topVal + 'px';
      clockEl.style.marginBottom = '0';
    } else {
      clockEl.style.position = '';
      clockEl.style.left = '';
      clockEl.style.top = '';
      clockEl.style.marginBottom = '';
      if (clockSpacer && clockSpacer.parentNode) {
        clockSpacer.parentNode.removeChild(clockSpacer);
      }
    }
  }

  function setClockColor(color) {
    clockColor = color;
    localStorage.setItem('lingtab_clock_color', color);

    if (color === 'auto') {
      // 根据背景亮度自动选择颜色
      applyAutoClockColor();
      clockCpHex.textContent = '自动';
      clockCpPreviewSm.style.background = 'linear-gradient(135deg, #333, #666)';
    } else {
      clockEl.style.color = color;
      clockCpHex.textContent = color;
      clockCpPreviewSm.style.background = color;
      clockCpPreview.style.background = color;
    }
  }

  function applyAutoClockColor() {
    // 获取背景色或默认白色
    var bgColor = window.getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
    var rgb = bgColor.match(/\d+/g);
    if (!rgb) rgb = [255, 255, 255];
    
    // 计算亮度
    var brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    
    // 根据亮度选择文字颜色
    if (brightness > 128) {
      clockEl.style.color = '#333333';
    } else {
      clockEl.style.color = '#ffffff';
    }
  }

  // Clock color picker functions
  function setClockColorFromHSB() {
    var rgb = hsbToRgb(clockCpHueVal, clockCpSat / 100, clockCpBri / 100);
    var hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    clockCpPreview.style.background = hex;
    clockCpPreviewSm.style.background = hex;
    clockCpHex.textContent = hex;
    clockEl.style.color = hex;
    localStorage.setItem('lingtab_clock_color', hex);
    clockColor = hex;
  }

  function updateClockCpCursor() {
    var panelRect = clockCpPanel.getBoundingClientRect();
    var x = (clockCpSat / 100) * panelRect.width;
    var y = (1 - clockCpBri / 100) * panelRect.height;
    clockCpCursor.style.left = x + 'px';
    clockCpCursor.style.top = y + 'px';
    clockCpCursor.style.background = 'hsl(' + clockCpHueVal + ', 100%, 50%)';
  }

  function updateClockCpHueCursor() {
    var hueRect = clockCpHue.getBoundingClientRect();
    var x = (clockCpHueVal / 360) * hueRect.width;
    clockCpHueCursor.style.left = x + 'px';
  }

  function clockCpPanelPos(e) {
    var rect = clockCpPanel.getBoundingClientRect();
    var ex = e.clientX || (e.touches && e.touches[0].clientX);
    var ey = e.clientY || (e.touches && e.touches[0].clientY);
    var x = Math.max(0, Math.min(1, (ex - rect.left) / rect.width));
    var y = Math.max(0, Math.min(1, (ey - rect.top) / rect.height));
    clockCpSat = x * 100;
    clockCpBri = (1 - y) * 100;
    updateClockCpCursor();
    setClockColorFromHSB();
  }

  function clockCpHuePos(e) {
    var rect = clockCpHue.getBoundingClientRect();
    var ex = e.clientX || (e.touches && e.touches[0].clientX);
    var x = Math.max(0, Math.min(1, (ex - rect.left) / rect.width));
    clockCpHueVal = x * 360;
    clockCpPanel.style.background = 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(' + clockCpHueVal + ', 100%, 50%))';
    updateClockCpHueCursor();
    setClockColorFromHSB();
  }

  clockCpTrigger.addEventListener('click', function () {
    clockCpOverlay.style.display = 'flex';
  });

  clockCpPopupClose.addEventListener('click', function () {
    clockCpOverlay.style.display = 'none';
  });

  clockCpOverlay.addEventListener('click', function (e) {
    if (!clockCpOverlay.querySelector('.cp-popup').contains(e.target)) {
      clockCpOverlay.style.display = 'none';
    }
  });

  clockCpPanel.addEventListener('mousedown', function (e) {
    clockCpDragging = true;
    clockCpPanelPos(e);
  });

  clockCpHue.addEventListener('mousedown', function (e) {
    clockCpHueDragging = true;
    clockCpHuePos(e);
  });

  document.addEventListener('mousemove', function (e) {
    if (clockCpDragging) clockCpPanelPos(e);
    if (clockCpHueDragging) clockCpHuePos(e);
  });

  document.addEventListener('mouseup', function () {
    clockCpDragging = false;
    clockCpHueDragging = false;
  });

  clockColorAutoBtn.addEventListener('click', function () {
    setClockColor('auto');
    clockCpOverlay.style.display = 'none';
  });

  function loadClockColor() {
    var saved = localStorage.getItem('lingtab_clock_color');
    if (saved && saved !== 'auto') {
      var r = parseInt(saved.slice(1, 3), 16);
      var g = parseInt(saved.slice(3, 5), 16);
      var b = parseInt(saved.slice(5, 7), 16);
      var hsb = rgbToHsb(r, g, b);
      clockCpHueVal = hsb.h;
      clockCpSat = hsb.s * 100;
      clockCpBri = hsb.v * 100;
    }
    clockCpPanel.style.background = 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(' + clockCpHueVal + ', 100%, 50%))';
    updateClockCpCursor();
    updateClockCpHueCursor();
    setClockColor(saved || 'auto');
  }

  loadClockColor();

  clockToggle.checked = clockVisible;
  clockSecondsToggle.checked = clockSeconds;
  clockDateToggle.checked = clockDateVisible;

  setClockStyle(clockStyle);
  setClockVisible(clockVisible);
  setClockSeconds(clockSeconds);
  setClockDateVisible(clockDateVisible);
  setClockScale(clockScale);

  // 确保时钟可见：移除 no-clock 类
  document.body.classList.remove('no-clock');

  // 检查保存的位置是否有效
  if (clockPosX && clockPosY) {
    var px, py;
    if (clockPosX.indexOf('%') !== -1) {
      px = (parseFloat(clockPosX) / 100) * window.innerWidth;
      py = (parseFloat(clockPosY) / 100) * window.innerHeight;
    } else {
      px = parseInt(clockPosX);
      py = parseInt(clockPosY);
      // 迁移旧版像素值为百分比
      clockPosX = (px / window.innerWidth * 100).toFixed(2) + '%';
      clockPosY = (py / window.innerHeight * 100).toFixed(2) + '%';
      localStorage.setItem('lingtab_clock_pos_x', clockPosX);
      localStorage.setItem('lingtab_clock_pos_y', clockPosY);
    }
    var maxW = window.innerWidth + 200;
    var maxH = window.innerHeight + 200;
    if (px >= -200 && px <= maxW && py >= -50 && py <= maxH) {
      setClockPosition(clockPosX, clockPosY);
    } else {
      localStorage.removeItem('lingtab_clock_pos_x');
      localStorage.removeItem('lingtab_clock_pos_y');
    }
  }

  clockToggle.addEventListener('change', function () {
    setClockVisible(this.checked);
  });

  clockSecondsToggle.addEventListener('change', function () {
    setClockSeconds(this.checked);
  });

  clockDateToggle.addEventListener('change', function () {
    setClockDateVisible(this.checked);
  });

  clockStyleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setClockStyle(this.dataset.style);
    });
  });

  // Clock context menu
  clockEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    clockContextMenu.style.display = 'block';
    clockContextMenu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    clockContextMenu.style.top = Math.min(e.clientY, window.innerHeight - 100) + 'px';
    clockSizeSlider.value = clockScale * 100;
  });

  document.addEventListener('click', function (e) {
    if (!clockContextMenu.contains(e.target) && e.target !== clockEl) {
      clockContextMenu.style.display = 'none';
    }
  });

  clockSizeSlider.addEventListener('input', function () {
    setClockScale(this.value / 100);
  });

  clockResetPos.addEventListener('click', function () {
    setClockPosition('', '');
    setClockScale(1);
    clockSizeSlider.value = 100;
    clockContextMenu.style.display = 'none';
  });

  // Clock dragging
  var clockDragging = false;
  var clockDragOffsetX = 0;
  var clockDragOffsetY = 0;

  clockEl.addEventListener('mousedown', function (e) {
    if (e.button === 0 && !e.target.closest('#clock-context-menu')) {
      clockDragging = true;
      var rect = clockEl.getBoundingClientRect();
      var clockWidth = rect.width;
      var clockHeight = rect.height;
      // 鼠标位置相对于时钟中心的偏移
      clockDragOffsetX = (e.clientX - rect.left) - clockWidth / 2;
      clockDragOffsetY = (e.clientY - rect.top) - clockHeight / 2;
      // 立即固定时钟位置并插入占位符，防止容器布局变化导致搜索框跳动
      var centerX = e.clientX - clockDragOffsetX;
      var centerY = e.clientY - clockDragOffsetY;
      var pctX = (centerX / window.innerWidth * 100).toFixed(2) + '%';
      var pctY = (centerY / window.innerHeight * 100).toFixed(2) + '%';
      setClockPosition(pctX, pctY);
      clockEl.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', function (e) {
    if (clockDragging) {
      var centerX = e.clientX - clockDragOffsetX;
      var centerY = e.clientY - clockDragOffsetY;
      var pctX = (centerX / window.innerWidth * 100).toFixed(2) + '%';
      var pctY = (centerY / window.innerHeight * 100).toFixed(2) + '%';
      setClockPosition(pctX, pctY);
    }
  });

  document.addEventListener('mouseup', function () {
    if (clockDragging) {
      clockDragging = false;
      clockEl.style.cursor = 'grab';
    }
  });

  // 窗口缩放时按百分比重新计算时钟位置
  window.addEventListener('resize', function () {
    if (clockPosX && clockPosY && clockPosX.indexOf('%') !== -1) {
      setClockPosition(clockPosX, clockPosY);
    }
  });

  // ---------- 版本检查更新 ----------
  var APP_VERSION = '1.0.0';
  var _latestVersion = '';
  var updateNotif = document.getElementById('update-notification');
  var updateNotifDesc = document.getElementById('updateNotifDesc');
  var updateNotifClose = document.getElementById('updateNotifClose');

  document.getElementById('appVersion').textContent = APP_VERSION;

  updateNotifClose.addEventListener('click', function () {
    updateNotif.style.display = 'none';
    if (_latestVersion) {
      localStorage.setItem('lingtab_update_dismissed', _latestVersion);
    }
  });

  function gtVersion(a, b) {
    var pa = a.split('.').map(Number);
    var pb = b.split('.').map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return true;
      if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return false;
  }

  function checkUpdate() {
    var dismissed = localStorage.getItem('lingtab_update_dismissed');

    fetch('https://gitee.com/api/v5/repos/muliuawa/lingtab/releases?page=1&per_page=10', { cache: 'no-cache' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.length) return;
        // Gitee 返回按创建时间升序，取最后一个为最新
        var latest = data[data.length - 1];
        var tag = (latest.tag_name || '').trim();
        var latestVer = tag.replace(/^v/i, '').replace(/,/g, '.');
        if (latestVer && gtVersion(latestVer, APP_VERSION) && latestVer !== dismissed) {
          _latestVersion = latestVer;
          updateNotifDesc.textContent = 'v' + latestVer + ' 已发布，点击前往官网下载最新版';
          updateNotif.style.display = 'block';
        }
      })
      .catch(function () {});
  }

  checkUpdate();

  updateClock();
  setInterval(updateClock, 50);


  // ---------- Dock ----------
  var bmDock = document.getElementById('bm-dock');
  var dockToggle = document.getElementById('dockToggle');
  var bmFormWrap = document.getElementById('bm-form-wrap');
  var bmForm = document.getElementById('bm-form');
  var bmNameInput = document.getElementById('bm-name');
  var bmUrlInput = document.getElementById('bm-url');
  var bmCancelBtn = document.getElementById('bmCancel');
  var bmSaveBtn = document.getElementById('bmSave');
  var bmContextMenu = document.getElementById('bm-context-menu');
  var bmMenuDelete = document.getElementById('bmMenuDelete');

  var dockItems = [];
  var contextMenuIndex = -1;

  // 判断是否是本地地址
  function isLocalUrl(url) {
    try {
      var u = new URL(url);
      var host = u.hostname;
      return host === 'localhost' || 
             host === '127.0.0.1' || 
             host.startsWith('192.168.') || 
             host.startsWith('10.') || 
             host.startsWith('172.') ||
             host === '::1' ||
             host.endsWith('.local');
    } catch (e) {
      return false;
    }
  }

  // 使用多个 favicon 服务源
  function getFaviconUrl(url, index) {
    try {
      var u = new URL(url);
      var domain = u.hostname;
      var origin = u.origin;
      
      // 根据索引返回不同方案
      if (!index || index === 0) {
        // 方案1: Icon.horse (最稳定)
        return 'https://icon.horse/icon/' + domain;
      } else if (index === 1) {
        // 方案2: Google S2
        return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=32';
      } else if (index === 2) {
        // 方案3: DuckDuckGo
        return 'https://icons.duckduckgo.com/ip3/' + domain + '.ico';
      } else if (index === 3) {
        // 方案4: 直接访问网站 favicon
        return origin + '/favicon.ico';
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function loadDockItems() {
    var saved = localStorage.getItem('lingtab_dock_items');
    if (saved) {
      try {
        dockItems = JSON.parse(saved);
      } catch (e) {
        dockItems = [];
      }
    }
    
    if (dockItems.length === 0) {
      // 尝试从书签导入，如果失败则使用默认网站
      try {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          chrome.bookmarks.getTree(function (tree) {
            var bookmarks = [];
            function extractBookmarks(nodes) {
              for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (node.url) {
                  bookmarks.push({ name: node.title, url: node.url });
                }
                if (node.children) {
                  extractBookmarks(node.children);
                }
              }
            }
            extractBookmarks(tree);
            dockItems = bookmarks.slice(0, 10);
            saveDockItems();
            renderDock();
          });
        } else {
          // 非 Chrome 扩展环境，使用默认网站
          dockItems = [
            { name: 'Google', url: 'https://www.google.com' },
            { name: 'Bilibili', url: 'https://www.bilibili.com' },
            { name: 'GitHub', url: 'https://github.com' },
            { name: '知乎', url: 'https://www.zhihu.com' }
          ];
          saveDockItems();
          renderDock();
        }
      } catch (e) {
        dockItems = [
          { name: 'Google', url: 'https://www.google.com' },
          { name: 'Bilibili', url: 'https://www.bilibili.com' },
          { name: 'GitHub', url: 'https://github.com' },
          { name: '知乎', url: 'https://www.zhihu.com' }
        ];
        saveDockItems();
        renderDock();
      }
    }
  }

  function saveDockItems() {
    localStorage.setItem('lingtab_dock_items', JSON.stringify(dockItems));
  }

  function renderDock() {
    var html = '';
    for (var i = 0; i < dockItems.length; i++) {
      var item = dockItems[i];
      var isLocal = isLocalUrl(item.url);
      var name = item.name || '网站';
      var shortName = name.length > 5 ? name.substring(0, 5) : name;
      
      html += '<div class="bm-item" data-index="' + i + '">';
      
      if (isLocal) {
        // 本地地址显示服务器/网络图标
        html += '<svg class="bm-icon bm-icon-local" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
        html += '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>';
        html += '<rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>';
        html += '<line x1="6" y1="6" x2="6.01" y2="6"></line>';
        html += '<line x1="6" y1="18" x2="6.01" y2="18"></line>';
        html += '</svg>';
      } else {
        html += '<span class="bm-icon placeholder" style="display:none;">' + name.charAt(0).toUpperCase() + '</span>';
        html += '<img class="bm-icon" src="" alt="" style="display:none;">';
      }
      
      html += '<span class="bm-label">' + shortName + '</span>';
      html += '</div>';
    }
    html += '<div class="bm-add">+</div>';
    bmDock.innerHTML = html;

    // 加载图标（仅网络地址）
    bmDock.querySelectorAll('.bm-item').forEach(function (el) {
      var idx = parseInt(el.dataset.index);
      if (idx === undefined || !dockItems[idx]) return;
      
      var item = dockItems[idx];
      if (isLocalUrl(item.url)) return; // 本地地址跳过
      
      var img = el.querySelector('img.bm-icon');
      var placeholder = el.querySelector('span.bm-icon');
      if (!img) return;
      
      var tryIndex = 0;
      
      function tryLoadIcon() {
        var iconUrl = getFaviconUrl(item.url, tryIndex);
        if (iconUrl) {
          img.src = iconUrl;
        } else {
          // 所有方案都失败，显示占位符
          img.style.display = 'none';
          placeholder.style.display = 'flex';
        }
      }
      
      img.onerror = function () {
        tryIndex++;
        if (tryIndex <= 3) {
          tryLoadIcon();
        } else {
          img.style.display = 'none';
          placeholder.style.display = 'flex';
        }
      };
      
      img.onload = function () {
        img.style.display = 'block';
        placeholder.style.display = 'none';
      };
      
      tryLoadIcon();
    });

    // 点击打开网站
    bmDock.querySelectorAll('.bm-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var idx = parseInt(this.dataset.index);
        if (dockItems[idx]) {
          window.open(dockItems[idx].url, '_blank');
        }
      });

      // 右键显示菜单
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        contextMenuIndex = parseInt(this.dataset.index);
        
        var rect = this.getBoundingClientRect();
        var menuWidth = 100;
        var menuHeight = 40;
        
        var x = e.clientX;
        var y = e.clientY;
        
        // 防止超出屏幕
        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
        
        bmContextMenu.style.left = x + 'px';
        bmContextMenu.style.top = y + 'px';
        bmContextMenu.classList.add('show');
      });
    });

    // 点击删除按钮
    bmMenuDelete.addEventListener('click', function () {
      if (contextMenuIndex >= 0 && dockItems[contextMenuIndex]) {
        dockItems.splice(contextMenuIndex, 1);
        saveDockItems();
        renderDock();
      }
      bmContextMenu.classList.remove('show');
      contextMenuIndex = -1;
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', function (e) {
      if (!bmContextMenu.contains(e.target)) {
        bmContextMenu.classList.remove('show');
        contextMenuIndex = -1;
      }
    });

    bmDock.querySelector('.bm-add').addEventListener('click', function () {
      bmFormWrap.classList.add('open');
      bmNameInput.value = '';
      bmUrlInput.value = '';
      bmNameInput.focus();
    });
  }

  function toggleDock(show) {
    document.body.classList.toggle('no-dock', !show);
    localStorage.setItem('lingtab_dock_visible', show);
  }

  dockToggle.checked = localStorage.getItem('lingtab_dock_visible') !== 'false';

  toggleDock(dockToggle.checked);

  dockToggle.addEventListener('change', function () {
    toggleDock(this.checked);
  });

  bmCancelBtn.addEventListener('click', function () {
    bmFormWrap.classList.remove('open');
  });

  bmUrlInput.addEventListener('input', function () {
    bmSaveBtn.disabled = !bmUrlInput.value.trim();
  });

  bmNameInput.addEventListener('input', function () {
    bmSaveBtn.disabled = !bmUrlInput.value.trim();
  });

  bmForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = bmNameInput.value.trim();
    var url = bmUrlInput.value.trim();
    
    if (!url) return;
    
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }

    if (!name) {
      try {
        name = new URL(url).hostname.replace('www.', '');
      } catch (e) {
        name = '网站';
      }
    }

    dockItems.push({
      name: name,
      url: url,
      icon: getFaviconUrl(url)
    });

    saveDockItems();
    renderDock();
    bmFormWrap.classList.remove('open');
  });

  bmFormWrap.addEventListener('click', function (e) {
    if (e.target === bmFormWrap) {
      bmFormWrap.classList.remove('open');
    }
  });

  // 先加载数据再渲染
  var saved = localStorage.getItem('lingtab_dock_items');
  if (saved) {
    try {
      dockItems = JSON.parse(saved);
      renderDock();
    } catch (e) {}
  }
  
  // 异步加载书签（如果可用）
  if (dockItems.length === 0) {
    loadDockItems();
  }

  // ---------- Weather ----------
  var weatherEl = document.getElementById('weather');
  var weatherToggle = document.getElementById('weatherToggle');
  var weatherEnabled = localStorage.getItem('lingtab_weather_enabled') === 'true';

  var weatherCodes = {
    0: { desc: '晴', icon: '☀️' },
    1: { desc: '晴', icon: '🌤️' },
    2: { desc: '多云', icon: '⛅' },
    3: { desc: '阴', icon: '☁️' },
    45: { desc: '雾', icon: '🌫️' },
    48: { desc: '雾凇', icon: '🌫️' },
    51: { desc: '小毛毛雨', icon: '🌦️' },
    53: { desc: '毛毛雨', icon: '🌦️' },
    55: { desc: '大毛毛雨', icon: '🌦️' },
    56: { desc: '冻毛毛雨', icon: '🌧️' },
    57: { desc: '大冻毛毛雨', icon: '🌧️' },
    61: { desc: '小雨', icon: '🌧️' },
    63: { desc: '中雨', icon: '🌧️' },
    65: { desc: '大雨', icon: '🌧️' },
    66: { desc: '冻雨', icon: '🌧️' },
    67: { desc: '大冻雨', icon: '🌧️' },
    71: { desc: '小雪', icon: '❄️' },
    73: { desc: '中雪', icon: '❄️' },
    75: { desc: '大雪', icon: '❄️' },
    77: { desc: '雪粒', icon: '❄️' },
    80: { desc: '小阵雨', icon: '🌦️' },
    81: { desc: '阵雨', icon: '🌦️' },
    82: { desc: '大阵雨', icon: '🌧️' },
    85: { desc: '小阵雪', icon: '🌨️' },
    86: { desc: '大阵雪', icon: '🌨️' },
    95: { desc: '雷暴', icon: '⛈️' },
    96: { desc: '雷暴+小冰雹', icon: '⛈️' },
    99: { desc: '雷暴+大冰雹', icon: '⛈️' }
  };

  function getWeatherInfo(code) {
    return weatherCodes[code] || { desc: '未知', icon: '❓' };
  }

  function setWeatherVisible(visible) {
    weatherEnabled = visible;
    localStorage.setItem('lingtab_weather_enabled', visible);
    document.body.classList.toggle('no-weather', !visible);
    if (visible) {
      loadWeather();
    }
  }

  function renderWeather(data) {
    if (!data || !data.current) {
      weatherEl.style.display = 'none';
      return;
    }

    var current = data.current;
    var temp = Math.round(current.temperature_2m);
    var weatherInfo = getWeatherInfo(current.weather_code);
    var isDay = current.is_day === 1;

    var html = '<span class="weather-icon">' + weatherInfo.icon + '</span>';
    html += '<span class="weather-temp">' + temp + '°C</span>';
    html += '<span class="weather-desc">' + weatherInfo.desc + '</span>';

    if (data.city) {
      html += '<span class="weather-city">' + data.city + '</span>';
    }

    weatherEl.innerHTML = html;
    weatherEl.style.display = 'flex';
  }

  function loadWeather() {
    if (!weatherEnabled) return;

    var cached = localStorage.getItem('lingtab_weather_data');
    var cacheTime = localStorage.getItem('lingtab_weather_time');
    var now = Date.now();

    if (cached && cacheTime && (now - parseInt(cacheTime)) < 30 * 60 * 1000) {
      try {
        renderWeather(JSON.parse(cached));
        return;
      } catch (e) {}
    }

    function fetchWeatherByCoords(lat, lng, city) {
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.current) {
            data.city = city;
            localStorage.setItem('lingtab_weather_data', JSON.stringify(data));
            localStorage.setItem('lingtab_weather_time', now.toString());
            renderWeather(data);
          }
        })
        .catch(function () {});
    }

    function fetchGeo() {
      fetch('http://ip-api.com/json/?lang=zh-CN')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.status === 'success' && data.lat !== undefined) {
            fetchWeatherByCoords(data.lat, data.lon, data.city);
          }
        })
        .catch(function () {});
    }

    try {
      chrome.runtime.sendMessage({ type: 'geolocation' }, function (geoResponse) {
        if (geoResponse && geoResponse.data && geoResponse.data.latitude) {
          fetchWeatherByCoords(geoResponse.data.latitude, geoResponse.data.longitude, geoResponse.data.city);
        } else {
          fetchGeo();
        }
      });
    } catch (e) {
      fetchGeo();
    }
  }

  weatherToggle.checked = weatherEnabled;

  weatherToggle.addEventListener('change', function () {
    setWeatherVisible(this.checked);
  });

  setWeatherVisible(weatherEnabled);

})();
