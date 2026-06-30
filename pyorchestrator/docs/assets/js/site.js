document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.menu-toggle');
  var overlay = document.querySelector('.sidebar-overlay');
  var body = document.body;

  function closeNav() {
    body.classList.remove('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (toggle) toggle.setAttribute('aria-label', 'Открыть меню');
  }

  function openNav() {
    body.classList.add('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    if (toggle) toggle.setAttribute('aria-label', 'Закрыть меню');
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

  var issuesRoot = document.querySelector('.sidebar-issues');
  if (issuesRoot) {
    var list = issuesRoot.querySelector('.sidebar-issues-list');
    var repo = issuesRoot.getAttribute('data-repo');
    if (list && repo) {
      fetch('https://api.github.com/repos/' + repo + '/issues?state=open&per_page=8&sort=updated')
        .then(function (res) {
          if (!res.ok) throw new Error('fetch failed');
          return res.json();
        })
        .then(function (items) {
          var issues = items.filter(function (item) {
            return !item.pull_request;
          });
          if (issues.length === 0) {
            list.innerHTML = '<li class="sidebar-issues-empty">Нет открытых issues</li>';
            return;
          }
          list.innerHTML = issues.map(function (issue) {
            var title = issue.title
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
            return (
              '<li><a href="' + issue.html_url + '" target="_blank" rel="noopener" title="#' +
              issue.number + ' ' + title + '">#' + issue.number + ' ' + title + '</a></li>'
            );
          }).join('');
        })
        .catch(function () {
          list.innerHTML =
            '<li class="sidebar-issues-empty"><a href="https://github.com/' + repo +
            '/issues" target="_blank" rel="noopener">Открыть на GitHub</a></li>';
        });
    }
  }
});
