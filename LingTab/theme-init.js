// 在页面渲染前设置主题色，避免闪烁
try {
  var accent = localStorage.getItem('lingtab_accent');
  if (accent) {
    var s = document.createElement('style');
    s.textContent = ':root{--accent:' + accent + '}';
    document.head.appendChild(s);
  }
} catch (e) {}