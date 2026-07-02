/* ============================================================
   EXTENSIONS — non-invasive enhancements layer
   Loaded AFTER app.js. Adds:
     · Command palette (global search)  Ctrl+K  /
     · Keyboard navigation  ← →  Esc  ?
     · Back-to-top button
     · Auto Table of Contents
     · Reading time per page
     · Accessibility (roles, focus, aria-live)
     · "How to learn" help modal
   Relies on globals from app.js: PAGES, navigate, currentSection, currentPage
   ============================================================ */
(function () {
  'use strict';

  /* ---------- flat, ordered list of every page ---------- */
  var FLAT = [];
  try {
    Object.keys(PAGES).forEach(function (key) {
      PAGES[key].pages.forEach(function (page) {
        FLAT.push({ section: key, title: PAGES[key].title, page: page });
      });
    });
  } catch (e) {
    console.warn('extensions: PAGES not available', e);
  }

  // currentSection / currentPage are global `let` bindings from app.js
  // (accessible by bare name across classic scripts, NOT as window.* props)
  function curSection() { try { return currentSection; } catch (e) { return null; } }
  function curPage() { try { return currentPage; } catch (e) { return null; } }

  function currentIndex() {
    var cs = curSection(), cp = curPage();
    for (var i = 0; i < FLAT.length; i++) {
      if (FLAT[i].section === cs && FLAT[i].page === cp) return i;
    }
    return 0;
  }

  function go(entry, phase) {
    if (!entry) return;
    var opts = {};
    if (typeof phase === 'number') opts.phase = phase;
    navigate(entry.section, entry.title, entry.page, opts);
  }

  function pageEl() {
    var el = document.getElementById('page-' + curPage());
    if (el) return el;
    if (curSection() === 'build') return document.getElementById('section-build');
    return document.querySelector('.section.active-section');
  }

  function isTyping() {
    var a = document.activeElement;
    if (!a) return false;
    var t = a.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || a.isContentEditable;
  }

  /* ====================================================== */
  /*  SEARCH INDEX                                           */
  /* ====================================================== */
  var INDEX = [];
  function buildIndex() {
    INDEX = FLAT.map(function (entry) {
      var el = document.getElementById('page-' + entry.page);
      var headings = '';
      var headingText = '';
      var body = '';
      if (el) {
        headings = [].slice.call(el.querySelectorAll('h2, h3, h4'))
          .map(function (h) { return h.textContent.trim(); }).join(' · ');
        // section-title carries the bilingual label e.g. "Señales (Signals)"
        var st = el.querySelector('.section-title');
        headingText = st ? st.textContent.trim() : '';
        // a slice of body text catches concept keywords (incl. English terms)
        body = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 700);
      }
      var subtitle = headings || headingText;
      return {
        section: entry.section,
        title: entry.title,
        page: entry.page,
        headings: subtitle,
        haystack: (entry.title + ' ' + entry.page + ' ' + headingText + ' ' + headings + ' ' + body).toLowerCase()
      };
    });
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return INDEX.slice(0, 12);
    var tokens = q.split(/\s+/);
    var scored = [];
    INDEX.forEach(function (item) {
      var score = 0;
      var pageLc = item.page.toLowerCase();
      tokens.forEach(function (tok) {
        if (item.haystack.indexOf(tok) === -1) { score -= 100; return; }
        if (pageLc.indexOf(tok) === 0) score += 8;
        else if (pageLc.indexOf(tok) !== -1) score += 5;
        if (item.title.toLowerCase().indexOf(tok) !== -1) score += 3;
        if (item.headings.toLowerCase().indexOf(tok) !== -1) score += 2;
        score += 1;
      });
      if (score > 0) scored.push({ item: item, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 14).map(function (s) { return s.item; });
  }

  /* ====================================================== */
  /*  COMMAND PALETTE                                        */
  /* ====================================================== */
  var palette, paletteInput, paletteList, paletteSel = 0, paletteResults = [];

  function buildPalette() {
    palette = document.createElement('div');
    palette.id = 'cmd-palette';
    palette.className = 'cmd-overlay';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', 'Búsqueda global de la guía');
    palette.hidden = true;
    palette.innerHTML =
      '<div class="cmd-box">' +
        '<div class="cmd-input-row">' +
          '<span class="cmd-icon" aria-hidden="true">⌕</span>' +
          '<input id="cmd-input" type="text" autocomplete="off" spellcheck="false" ' +
            'placeholder="Buscar páginas, temas, conceptos…" aria-label="Buscar" ' +
            'role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-autocomplete="list">' +
          '<kbd class="cmd-esc">esc</kbd>' +
        '</div>' +
        '<ul id="cmd-list" class="cmd-list" role="listbox" aria-label="Resultados"></ul>' +
        '<div class="cmd-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>' +
          '<span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> cerrar</span></div>' +
      '</div>';
    document.body.appendChild(palette);
    paletteInput = palette.querySelector('#cmd-input');
    paletteList = palette.querySelector('#cmd-list');

    palette.addEventListener('mousedown', function (e) {
      if (e.target === palette) closePalette();
    });
    paletteInput.addEventListener('input', function () { renderResults(); });
    paletteInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); chooseSel(); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });
  }

  function renderResults() {
    paletteResults = search(paletteInput.value);
    paletteSel = 0;
    if (!paletteResults.length) {
      paletteList.innerHTML = '<li class="cmd-empty">Sin resultados</li>';
      return;
    }
    paletteList.innerHTML = paletteResults.map(function (r, i) {
      var sub = r.headings ? '<span class="cmd-sub">' + escAttr(r.headings) + '</span>' : '';
      return '<li class="cmd-item' + (i === 0 ? ' active' : '') + '" role="option" ' +
        'id="cmd-opt-' + i + '" aria-selected="' + (i === 0) + '" data-i="' + i + '">' +
        '<span class="cmd-sec">' + escAttr(r.title) + '</span>' +
        '<span class="cmd-page">' + escAttr(r.page) + '</span>' + sub + '</li>';
    }).join('');
    [].slice.call(paletteList.children).forEach(function (li) {
      li.addEventListener('mouseenter', function () { setSel(+li.dataset.i); });
      li.addEventListener('click', function () { setSel(+li.dataset.i); chooseSel(); });
    });
  }

  function setSel(i) {
    paletteSel = i;
    [].slice.call(paletteList.querySelectorAll('.cmd-item')).forEach(function (li, idx) {
      var on = idx === i;
      li.classList.toggle('active', on);
      li.setAttribute('aria-selected', on);
    });
    paletteInput.setAttribute('aria-activedescendant', 'cmd-opt-' + i);
  }
  function moveSel(d) {
    if (!paletteResults.length) return;
    var n = paletteResults.length;
    setSel((paletteSel + d + n) % n);
    var active = paletteList.querySelector('.cmd-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }
  function chooseSel() {
    var r = paletteResults[paletteSel];
    if (!r) return;
    closePalette();
    go({ section: r.section, title: r.title, page: r.page });
  }

  var lastFocus = null;
  function openPalette() {
    if (!palette) buildPalette();
    lastFocus = document.activeElement;
    palette.hidden = false;
    document.body.classList.add('modal-open');
    paletteInput.value = '';
    renderResults();
    requestAnimationFrame(function () { paletteInput.focus(); });
  }
  function closePalette() {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ====================================================== */
  /*  HELP / HOW-TO-LEARN MODAL                              */
  /* ====================================================== */
  var help;
  function buildHelp() {
    help = document.createElement('div');
    help.id = 'help-modal';
    help.className = 'cmd-overlay';
    help.setAttribute('role', 'dialog');
    help.setAttribute('aria-modal', 'true');
    help.setAttribute('aria-label', 'Cómo aprender con esta guía');
    help.hidden = true;
    help.innerHTML =
      '<div class="help-box" role="document">' +
        '<button class="help-close" aria-label="Cerrar">✕</button>' +
        '<h2>// Cómo sacarle el máximo a esta guía</h2>' +
        '<div class="help-grid">' +
          '<section><h3>🧭 Forma de aprender</h3><ol class="help-steps">' +
            '<li><strong>Lee</strong> la teoría de cada página y los recuadros TIP / ⚠️.</li>' +
            '<li><strong>Analiza</strong> el código: lee línea por línea, cambia valores.</li>' +
            '<li><strong>Escribe</strong> el código tú mismo en Godot (no copies y pegues).</li>' +
            '<li><strong>Construye</strong> tu Metroidvania siguiendo la sección Build en paralelo.</li>' +
            '<li><strong>Repasa</strong> con el quiz al final de cada sección.</li>' +
          '</ol></section>' +
          '<section><h3>⌨️ Atajos de teclado</h3><table class="help-keys">' +
            '<tr><td><kbd>Ctrl</kbd>+<kbd>K</kbd> &nbsp;/&nbsp; <kbd>/</kbd></td><td>Buscar en toda la guía</td></tr>' +
            '<tr><td><kbd>←</kbd> &nbsp; <kbd>→</kbd></td><td>Página anterior / siguiente</td></tr>' +
            '<tr><td><kbd>T</kbd></td><td>Mostrar / ocultar el índice (TOC)</td></tr>' +
            '<tr><td><kbd>?</kbd></td><td>Abrir esta ayuda</td></tr>' +
            '<tr><td><kbd>Esc</kbd></td><td>Cerrar ventanas y menú lateral</td></tr>' +
          '</table></section>' +
        '</div>' +
        '<p class="help-tip">💡 El aprendizaje activo es ~10× más efectivo que leer en pasivo. ' +
          'Navega, responde quizzes, marca checklists y, sobre todo, <strong>construye</strong>.</p>' +
      '</div>';
    document.body.appendChild(help);
    help.addEventListener('mousedown', function (e) { if (e.target === help) closeHelp(); });
    help.querySelector('.help-close').addEventListener('click', closeHelp);
  }
  function openHelp() {
    if (!help) buildHelp();
    lastFocus = document.activeElement;
    help.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { help.querySelector('.help-close').focus(); });
  }
  function closeHelp() {
    if (!help || help.hidden) return;
    help.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ====================================================== */
  /*  FLOATING TOOLBAR + BACK TO TOP                         */
  /* ====================================================== */
  function buildToolbar() {
    var bar = document.createElement('div');
    bar.className = 'fab-toolbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Herramientas de la guía');
    bar.innerHTML =
      '<button class="fab" id="fab-search" title="Buscar (Ctrl+K)" aria-label="Buscar">⌕</button>' +
      '<button class="fab" id="fab-toc" title="Índice de la página (T)" aria-label="Índice de la página">☰</button>' +
      '<button class="fab" id="fab-help" title="Ayuda (?)" aria-label="Ayuda">?</button>' +
      '<button class="fab fab-top" id="fab-top" title="Volver arriba" aria-label="Volver arriba" hidden>↑</button>';
    document.body.appendChild(bar);
    document.getElementById('fab-search').addEventListener('click', openPalette);
    document.getElementById('fab-help').addEventListener('click', openHelp);
    document.getElementById('fab-toc').addEventListener('click', toggleTOC);
    var topBtn = document.getElementById('fab-top');
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      topBtn.hidden = window.scrollY < 400;
    }, { passive: true });
  }

  /* ====================================================== */
  /*  TABLE OF CONTENTS                                      */
  /* ====================================================== */
  var tocPanel, tocVisible = false;
  function buildTOC() {
    tocPanel = document.createElement('nav');
    tocPanel.id = 'toc-panel';
    tocPanel.setAttribute('aria-label', 'Contenido de la página');
    tocPanel.hidden = true;
    document.body.appendChild(tocPanel);
  }
  function refreshTOC() {
    if (!tocPanel) return;
    var el = pageEl();
    var heads = el ? [].slice.call(el.querySelectorAll('h2, h3')) : [];
    if (heads.length < 2) {
      tocPanel.innerHTML = '<div class="toc-head">En esta página</div><div class="toc-empty">Sin subsecciones</div>';
      return;
    }
    var items = heads.map(function (h, i) {
      if (!h.id) h.id = 'h-' + curSection() + '-' + i;
      var lvl = h.tagName === 'H3' ? ' toc-l3' : '';
      return '<li class="toc-item' + lvl + '"><a href="#' + h.id + '">' + escAttr(h.textContent.trim()) + '</a></li>';
    }).join('');
    tocPanel.innerHTML = '<div class="toc-head">En esta página</div><ul class="toc-list">' + items + '</ul>';
    [].slice.call(tocPanel.querySelectorAll('a')).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = document.getElementById(a.getAttribute('href').slice(1));
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
  function toggleTOC() {
    if (!tocPanel) buildTOC();
    tocVisible = !tocVisible;
    tocPanel.hidden = !tocVisible;
    var btn = document.getElementById('fab-toc');
    if (btn) btn.classList.toggle('active', tocVisible);
    if (tocVisible) refreshTOC();
  }

  /* ====================================================== */
  /*  READING TIME                                          */
  /* ====================================================== */
  var rtBadge;
  function buildReadingTime() {
    var controls = document.querySelector('.top-bar .controls');
    if (!controls) return;
    rtBadge = document.createElement('span');
    rtBadge.className = 'reading-time';
    rtBadge.setAttribute('aria-live', 'polite');
    controls.insertBefore(rtBadge, controls.firstChild);
  }
  function refreshReadingTime() {
    if (!rtBadge) return;
    var el = pageEl();
    if (!el) { rtBadge.textContent = ''; return; }
    var words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    var mins = Math.max(1, Math.round(words / 200));
    rtBadge.textContent = '⏱ ' + mins + ' min';
    rtBadge.title = '~' + words + ' palabras · lectura estimada ' + mins + ' min';
  }

  /* ====================================================== */
  /*  ACCESSIBILITY                                          */
  /* ====================================================== */
  function enhanceA11y() {
    // Sidebar tree: section titles + items become keyboard-operable buttons
    document.querySelectorAll('.tree-section-title, .tree-item').forEach(function (el) {
      if (el.getAttribute('role')) return;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });
    // Quizzes: group + options operable by keyboard
    function wireQuiz(q) {
      q.setAttribute('role', 'group');
      q.setAttribute('aria-label', 'Quiz de repaso');
      q.querySelectorAll('.quiz-opt').forEach(function (opt) {
        if (opt.getAttribute('role')) return;
        opt.setAttribute('role', 'button');
        opt.setAttribute('tabindex', '0');
        opt.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click(); }
        });
      });
    }
    document.querySelectorAll('.quiz').forEach(wireQuiz);
    // Quizzes are injected by app.js on load; re-scan shortly after just in case
    setTimeout(function () { document.querySelectorAll('.quiz').forEach(wireQuiz); }, 300);

    // Progress as a live region
    var pt = document.getElementById('progress-text');
    if (pt) {
      pt.setAttribute('aria-live', 'polite');
      pt.setAttribute('aria-label', 'Progreso del curso');
    }
    // Hamburger / overlay labels
    var burger = document.getElementById('hamburger');
    if (burger) burger.setAttribute('aria-label', 'Abrir menú de navegación');
    var main = document.getElementById('main');
    if (main && !main.getAttribute('role')) main.setAttribute('role', 'main');
    var side = document.getElementById('sidebar');
    if (side) side.setAttribute('aria-label', 'Índice de secciones');
  }

  /* ====================================================== */
  /*  PREV / NEXT NAVIGATION                                 */
  /* ====================================================== */
  function gotoPrev() {
    var i = currentIndex();
    if (i > 0) go(FLAT[i - 1]);
  }
  function gotoNext() {
    var i = currentIndex();
    if (i < FLAT.length - 1) go(FLAT[i + 1]);
  }

  /* ====================================================== */
  /*  GLOBAL KEYBOARD HANDLER                                */
  /* ====================================================== */
  function onKey(e) {
    // Search: Ctrl/Cmd+K always; "/" only when not typing
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault(); openPalette(); return;
    }
    var paletteOpen = palette && !palette.hidden;
    var helpOpen = help && !help.hidden;

    if (e.key === 'Escape') {
      if (paletteOpen) { closePalette(); return; }
      if (helpOpen) { closeHelp(); return; }
      var sb = document.getElementById('sidebar');
      if (sb && sb.classList.contains('open')) { closeSidebar(); return; }
      if (tocVisible) { toggleTOC(); return; }
      return;
    }
    if (paletteOpen || helpOpen || isTyping()) return;

    if (e.key === '/') { e.preventDefault(); openPalette(); }
    else if (e.key === '?') { e.preventDefault(); openHelp(); }
    else if (e.key === 'ArrowLeft') { gotoPrev(); }
    else if (e.key === 'ArrowRight') { gotoNext(); }
    else if (e.key === 't' || e.key === 'T') { toggleTOC(); }
  }

  /* ====================================================== */
  /*  AFTER-NAVIGATE HOOK (wrap app.js navigate)            */
  /* ====================================================== */
  function afterNavigate() {
    refreshReadingTime();
    if (tocVisible) refreshTOC();
    updateFooter();
    markSidebar();
  }

  /* ---------- dynamic prev/next footer (follows FLAT order) ---------- */
  var dynFooter = null;
  var visitedKeys = null;
  function loadVisited() {
    visitedKeys = {};
    try {
      var st = JSON.parse(localStorage.getItem('gdscript-guide-state-v3') || 'null');
      if (st && st.visited) st.visited.forEach(function (v) { visitedKeys[v] = 1; });
    } catch (e) {}
  }
  function footerName(entry) {
    var en = document.documentElement.lang === 'en';
    var map = window.I18N_PAGE;
    return (en && map && map[entry.page]) ? map[entry.page] : entry.page;
  }
  function buildFooter() {
    var content = document.querySelector('#main .content');
    if (!content || dynFooter) return;
    dynFooter = document.createElement('nav');
    dynFooter.id = 'dyn-footer';
    dynFooter.className = 'nav-footer dyn-footer';
    content.appendChild(dynFooter);
  }
  function updateFooter() {
    if (!dynFooter) return;
    var i = currentIndex();
    var prev = FLAT[i - 1], next = FLAT[i + 1];
    var en = document.documentElement.lang === 'en';
    var html = '';
    if (prev) html += '<button class="nav-btn" type="button" data-dir="prev"><span class="nav-dir">\u2190 ' + (en ? 'Previous' : 'Anterior') + '</span><span>' + escAttr(footerName(prev)) + '</span></button>';
    else html += '<div></div>';
    if (next) html += '<button class="nav-btn" type="button" data-dir="next"><span class="nav-dir">' + (en ? 'Next' : 'Siguiente') + ' \u2192</span><span>' + escAttr(footerName(next)) + '</span></button>';
    else html += '<div></div>';
    dynFooter.innerHTML = html;
    var pb = dynFooter.querySelector('[data-dir="prev"]');
    if (pb) pb.addEventListener('click', function () { go(prev); });
    var nb = dynFooter.querySelector('[data-dir="next"]');
    if (nb) nb.addEventListener('click', function () { go(next); });
  }
  function markSidebar() {
    if (!visitedKeys) loadVisited();
    var cs = curSection(), cp = curPage();
    if (cs && cp) visitedKeys[cs + ':' + cp] = 1;
    document.querySelectorAll('#sidebar .tree-item').forEach(function (it) {
      var m = (it.getAttribute('onclick') || '').match(/navigate\('([^']+)','[^']*','([^']+)'/);
      if (m && visitedKeys[m[1] + ':' + m[2]]) it.classList.add('visited');
    });
  }
  if (typeof window.navigate === 'function' && !window.__navWrapped) {
    var orig = window.navigate;
    window.navigate = function () {
      var r = orig.apply(this, arguments);
      try { afterNavigate(); } catch (e) { /* defensive */ }
      return r;
    };
    window.__navWrapped = true;
  }

  /* ---------- tiny helper ---------- */
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ====================================================== */
  /*  INIT                                                  */
  /* ====================================================== */
  function init() {
    try {
      buildIndex();
      buildToolbar();
      buildReadingTime();
      enhanceA11y();
      document.addEventListener('keydown', onKey);
      loadVisited();
      buildFooter();
      afterNavigate();
    } catch (e) {
      console.error('extensions init error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
