(function () {
  var QR_CDN_FALLBACKS = [
    'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
    'https://unpkg.com/qrcode@1.5.3/build/qrcode.js'
  ];

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-support-qr="' + src + '"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('load failed')); });
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.supportQr = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('load failed')); };
      document.head.appendChild(script);
    });
  }

  function ensureQrLibrary() {
    if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
      return Promise.resolve();
    }
    var chain = Promise.reject(new Error('missing'));
    QR_CDN_FALLBACKS.forEach(function (src) {
      chain = chain.catch(function () {
        return loadScript(src).then(function () {
          if (typeof QRCode === 'undefined' || !QRCode.toCanvas) {
            throw new Error('QRCode API missing');
          }
        });
      });
    });
    return chain;
  }

  function renderQrCodes() {
    document.querySelectorAll('.donate-qr-canvas').forEach(function (canvas) {
      var value = canvas.getAttribute('data-qr');
      if (!value) return;
      QRCode.toCanvas(
        canvas,
        value,
        {
          width: 160,
          margin: 1,
          color: {
            dark: '#1d1d1f',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        },
        function () { /* keep address usable if render fails */ }
      );
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(area);
        if (ok) resolve();
        else reject(new Error('copy failed'));
      } catch (err) {
        document.body.removeChild(area);
        reject(err);
      }
    });
  }

  function bindCopyButtons() {
    document.querySelectorAll('.donate-btn-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var address = btn.getAttribute('data-copy') || '';
        var labelCopy = btn.getAttribute('data-label-copy') || 'Copy Address';
        var labelCopied = btn.getAttribute('data-label-copied') || 'Copied!';
        if (!address) return;

        copyText(address).then(function () {
          btn.classList.add('is-copied');
          btn.textContent = labelCopied;
          window.clearTimeout(btn._copyTimer);
          btn._copyTimer = window.setTimeout(function () {
            btn.classList.remove('is-copied');
            btn.textContent = labelCopy;
          }, 2000);
        }).catch(function () { /* keep original label */ });
      });
    });
  }

  whenReady(function () {
    if (!document.querySelector('.support-page')) return;
    bindCopyButtons();
    ensureQrLibrary()
      .then(renderQrCodes)
      .catch(function () { /* addresses + copy remain available */ });
  });
})();
