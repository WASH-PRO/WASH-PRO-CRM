(function () {
  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function waitForQrCode(attempt) {
    if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
      renderQrCodes();
      return;
    }
    if (attempt > 40) return;
    setTimeout(function () {
      waitForQrCode(attempt + 1);
    }, 50);
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
        function () {
          /* ignore render errors — address + buttons remain usable */
        }
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
        }).catch(function () {
          /* keep original label if copy fails */
        });
      });
    });
  }

  whenReady(function () {
    if (!document.querySelector('.support-page')) return;
    bindCopyButtons();
    waitForQrCode(0);
  });
})();
