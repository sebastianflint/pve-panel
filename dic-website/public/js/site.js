(function () {
  'use strict';
  // Menu mobile
  var tg = document.querySelector('.nav-toggle'), menu = document.getElementById('menu');
  if (tg && menu) tg.addEventListener('click', function () {
    var o = menu.classList.toggle('open'); tg.setAttribute('aria-expanded', o); tg.setAttribute('aria-label', tg.getAttribute(o ? 'data-label-close' : 'data-label-open'));
  });

  // Hero carousel (berhenti otomatis bila pengguna memilih reduced motion)
  var slides = [].slice.call(document.querySelectorAll('[data-slide]')), dots = [].slice.call(document.querySelectorAll('.dot'));
  if (slides.length > 1) {
    var i = 0, paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches, t;
    var show = function (n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('active', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    };
    var loop = function () { clearInterval(t); if (!paused) t = setInterval(function () { show(i + 1); }, 6500); };
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.dataset.goto); loop(); }); });
    var pp = document.querySelector('[data-pause]');
    if (pp) pp.addEventListener('click', function () { paused = !paused; pp.firstElementChild.textContent = paused ? '▶' : 'II'; pp.setAttribute('aria-label', pp.getAttribute(paused ? 'data-play-label' : 'data-pause-label')); loop(); });
    loop();
  }

  // Analytics dengan persetujuan cookie
  var gaMeta = document.querySelector('meta[name="ga-id"]'), gaId = gaMeta && gaMeta.content;
  var consent = null; try { consent = localStorage.getItem('dic_cookie'); } catch (e) {}
  function loadGA() {
    if (!gaId || window.gtag) return;
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', gaId, { anonymize_ip: true });
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId); document.head.appendChild(s);
  }
  var bar = document.getElementById('cookie');
  if (bar) {
    if (consent === 'yes') loadGA(); else if (!consent) bar.hidden = false;
    bar.addEventListener('click', function (e) {
      var v = e.target.getAttribute('data-cookie'); if (!v) return;
      try { localStorage.setItem('dic_cookie', v); } catch (x) {}
      bar.hidden = true; if (v === 'yes') loadGA();
    });
  }
  // Event CTA dan unduhan (hanya terkirim bila GA aktif dan disetujui)
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-event]'); if (!el || !window.gtag) return;
    gtag('event', el.getAttribute('data-event'), { link_url: el.getAttribute('href') || undefined });
  });
})();
