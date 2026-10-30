/* window.desktop — Electron preload-тэй ижил API (src/desktop.ts). Go талын __stt_call-оор дамжина. */
(function () {
  if (window.desktop) return;
  // WebView2 ↔ Go: chrome.webview.postMessage → Go → window.__stt_resolve
  if (!window.__stt_call && window.chrome && window.chrome.webview) {
    var seq = 0;
    var pending = {};
    window.__stt_resolve = function (id, ok, value) {
      var p = pending[id];
      if (!p) return;
      delete pending[id];
      if (ok) p.resolve(value);
      else p.reject(new Error(value));
    };
    window.__stt_call = function (method, args) {
      return new Promise(function (resolve, reject) {
        var id = ++seq;
        pending[id] = { resolve: resolve, reject: reject };
        window.chrome.webview.postMessage(JSON.stringify({ id: id, method: method, params: args }));
      });
    };
  }
  if (!window.__stt_call || !/^https?:$/.test(location.protocol)) return; // хэвлэх цонх (about:blank) г.м.
  var call = function (method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return window.__stt_call(method, args);
  };
  var copy = function (text) {
    text = String(text);
    var legacy = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        /* */
      }
      ta.remove();
      return ok;
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacy();
        }
      );
    }
    return Promise.resolve(legacy());
  };
  window.desktop = Object.freeze({
    isDesktop: true,
    license: Object.freeze({
      status: function () { return call('license.status'); },
      activate: function (key) { return call('license.activate', String(key || '')); },
      importFile: function () { return call('license.importFile'); },
      deactivate: function () { return call('license.deactivate'); },
    }),
    backup: Object.freeze({
      save: function (json) { return call('backup.save', String(json)); },
      list: function () { return call('backup.list'); },
      load: function (filename) { return call('backup.load', String(filename)); },
      openFolder: function () { return call('backup.openFolder'); },
    }),
    app: Object.freeze({
      info: function () { return call('app.info'); },
      saveFile: function (name, content) { return call('app.saveFile', String(name || ''), String(content)); },
      copy: copy,
    }),
  });
  // Лицензгүй үед программын хуудсыг нээхгүй (идэвхжүүлэх цонх руу буцаана)
  if (!/__activation\.html$/.test(location.pathname)) {
    call('license.status').then(function (s) {
      if (!s || s.state !== 'active') location.replace('/__activation.html');
    });
  }
})();
