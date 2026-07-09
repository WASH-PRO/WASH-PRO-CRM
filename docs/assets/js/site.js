document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.menu-toggle');
  var overlay = document.querySelector('.sidebar-overlay');
  var body = document.body;
  var menuOpen = body.getAttribute('data-menu-open') || 'Open menu';
  var menuClose = body.getAttribute('data-menu-close') || 'Close menu';

  document.querySelectorAll('.lang-switcher a').forEach(function (link) {
    link.addEventListener('click', function () {
      try {
        var href = link.getAttribute('href') || '';
        var match = href.match(/\/(ru|en|kk)\//);
        if (match) localStorage.setItem('wash-docs-lang', match[1]);
      } catch (e) { /* ignore */ }
    });
  });

  function closeNav() {
    body.classList.remove('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (toggle) toggle.setAttribute('aria-label', menuOpen);
  }

  function openNav() {
    body.classList.add('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    if (toggle) toggle.setAttribute('aria-label', menuClose);
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      if (body.classList.contains('nav-open')) {
        closeNav();
      } else {
        openNav();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeNav);
  }

  document.querySelectorAll('.sidebar-nav .nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.matchMedia('(max-width: 900px)').matches) {
        closeNav();
      }
    });
  });

  document.querySelectorAll('.content table').forEach(function (table) {
    if (table.parentElement && table.parentElement.classList.contains('table-scroll')) {
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
});
