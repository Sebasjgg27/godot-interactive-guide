/* ============================================================
   learn.js — "Learning Mode" gamification + self-verification
   Self-contained, bilingual (follows <html lang>), persists in
   localStorage. Adds:
     · Auto-graded challenges per section (predict / fix-bug / fill-blank)
     · XP, levels and achievements (with toasts)
     · A metroidvania-style progress map
   Depends only on the DOM + the global `navigate`/`answer` from app.js.
   ============================================================ */
(function () {
  'use strict';
  var LS = 'gdscript-guide-learn-v1';

  function lang() { return document.documentElement.lang === 'es' ? 'es' : 'en'; }
  function tr(o) { return (o && (o[lang()] || o.en)) || ''; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- state ---------------- */
  var state = { xp: 0, pages: {}, sections: {}, quizzes: 0, challenges: {}, ach: {} };
  function load() {
    try { var s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s) state = Object.assign(state, s); } catch (e) {}
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }

  /* ---------------- levels ---------------- */
  var LEVELS = [
    { xp: 0, en: 'Novice', es: 'Novato' },
    { xp: 60, en: 'Apprentice', es: 'Aprendiz' },
    { xp: 160, en: 'Indie Dev', es: 'Dev Indie' },
    { xp: 320, en: 'Game Master', es: 'Game Master' }
  ];
  function levelIndex(xp) {
    var i = 0; for (var k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].xp) i = k; return i;
  }
  function nextLevelXp(xp) {
    var i = levelIndex(xp); return i < LEVELS.length - 1 ? LEVELS[i + 1].xp : LEVELS[i].xp;
  }

  /* ---------------- achievements ---------------- */
  var ACH = [
    { id: 'first', icon: '🚀', en: { t: 'First Steps', d: 'Open the guide' }, es: { t: 'Primeros pasos', d: 'Abrir la guía' } },
    { id: 'curious', icon: '🧭', en: { t: 'Curious', d: 'Visit 5 pages' }, es: { t: 'Curioso', d: 'Visitar 5 páginas' } },
    { id: 'explorer', icon: '🗺️', en: { t: 'Explorer', d: 'Reach all 9 sections' }, es: { t: 'Explorador', d: 'Llegar a las 9 secciones' } },
    { id: 'quizzer', icon: '🎯', en: { t: 'Quiz Master', d: 'Pass 3 quizzes' }, es: { t: 'Maestro del quiz', d: 'Aprobar 3 quizzes' } },
    { id: 'bug', icon: '🐛', en: { t: 'Bug Hunter', d: 'Solve a fix-the-bug challenge' }, es: { t: 'Cazador de bugs', d: 'Resolver un reto de “encontrá el bug”' } },
    { id: 'challenger', icon: '⚔️', en: { t: 'Challenger', d: 'Pass 3 challenges' }, es: { t: 'Retador', d: 'Aprobar 3 retos' } },
    { id: 'shipit', icon: '🏆', en: { t: 'Ship It!', d: 'Pass every challenge' }, es: { t: '¡A producción!', d: 'Aprobar todos los retos' } }
  ];

  /* ---------------- challenges (per section) ---------------- */
  /* type: 'mc' (multiple choice) | 'blank' (text input)
     mc: options[], correct index. blank: accept[] (normalized). */
  var CH = {
    gdscript: {
      type: 'mc', kind: 'predict',
      q: { en: 'What does this print?', es: '¿Qué imprime esto?' },
      code: 'var x := 5\nx += 3\nprint(x)',
      options: ['5', '8', '53', 'error'], correct: 1,
      ok: { en: 'Correct — 5 + 3 = 8.', es: 'Correcto — 5 + 3 = 8.' },
      ko: { en: '+= adds to the current value: 5 + 3 = 8.', es: '+= suma al valor actual: 5 + 3 = 8.' }
    },
    nodes: {
      type: 'mc', kind: 'bug',
      q: { en: 'This code throws an error. What is wrong?', es: 'Este código da error. ¿Qué está mal?' },
      code: 'func _ready():\n    add_to_group "enemies"',
      options: {
        en: ['It should be add_to_group("enemies")', 'func should be function', 'It needs a semicolon'],
        es: ['Debería ser add_to_group("enemies")', 'func debería ser function', 'Le falta un punto y coma']
      },
      correct: 0,
      ok: { en: 'Right — method calls need parentheses.', es: 'Exacto — las llamadas a métodos llevan paréntesis.' },
      ko: { en: 'Method arguments go inside parentheses: add_to_group("enemies").', es: 'Los argumentos van entre paréntesis: add_to_group("enemies").' }
    },
    player: {
      type: 'mc', kind: 'predict',
      q: { en: 'Only the right key is held. What does get_axis("move_left","move_right") return?', es: 'Solo se mantiene la tecla derecha. ¿Qué devuelve get_axis("move_left","move_right")?' },
      code: 'var dir = Input.get_axis("move_left", "move_right")',
      options: ['-1', '0', '1'], correct: 2,
      ok: { en: 'Correct — positive (right) action returns 1.', es: 'Correcto — la acción positiva (derecha) devuelve 1.' },
      ko: { en: 'get_axis returns negative for the first action, positive for the second: 1.', es: 'get_axis devuelve negativo para la primera acción y positivo para la segunda: 1.' }
    },
    metroidvania: {
      type: 'blank', kind: 'blank',
      q: { en: 'Fill the blank to check an unlocked ability:', es: 'Completá el hueco para comprobar una habilidad desbloqueada:' },
      code: 'if AbilitySystem.____("dash"):\n    do_dash()',
      accept: ['has'],
      placeholder: { en: 'method name', es: 'nombre del método' },
      ok: { en: 'Correct — AbilitySystem.has("dash").', es: 'Correcto — AbilitySystem.has("dash").' },
      ko: { en: 'The helper is has(): AbilitySystem.has("dash").', es: 'El método es has(): AbilitySystem.has("dash").' }
    },
    pixelart: {
      type: 'mc', kind: 'predict',
      q: { en: 'Recommended internal resolution for low-res pixel art?', es: '¿Resolución interna recomendada para pixel art de baja resolución?' },
      code: '# Project Settings -> Display -> Window\nviewport_width  = ?\nviewport_height = ?',
      options: ['320 × 180', '1920 × 1080', '800 × 600'], correct: 0,
      ok: { en: 'Correct — a small base like 320×180 scales pixel-perfect.', es: 'Correcto — una base chica como 320×180 escala pixel-perfect.' },
      ko: { en: 'Pixel art uses a small base resolution (e.g. 320×180) then scales up.', es: 'El pixel art usa una base chica (ej. 320×180) y luego escala.' }
    },
    sistemas: {
      type: 'mc', kind: 'predict',
      q: { en: 'JSON.stringify(data) returns a value of which type?', es: 'JSON.stringify(data) devuelve un valor de qué tipo?' },
      code: 'var text = JSON.stringify(save_data)',
      options: ['String', 'Dictionary', 'Array'], correct: 0,
      ok: { en: 'Correct — it returns a String you can write to a file.', es: 'Correcto — devuelve un String que podés escribir a un archivo.' },
      ko: { en: 'stringify serializes the data into a String.', es: 'stringify serializa los datos en un String.' }
    }
  };
  var CH_TOTAL = Object.keys(CH).length;

  /* ---------------- XP / awards ---------------- */
  function award(xp) {
    var before = levelIndex(state.xp);
    state.xp += xp;
    save();
    updateHud();
    var after = levelIndex(state.xp);
    if (after > before) toast('⭐ ' + (lang() === 'es' ? 'Subiste a nivel' : 'Level up') + ' ' + (after + 1) + ' · ' + tr(LEVELS[after]));
  }
  function unlock(id) {
    if (state.ach[id]) return;
    state.ach[id] = 1; save();
    var a = ACH.filter(function (x) { return x.id === id; })[0];
    if (a) toast(a.icon + ' ' + (lang() === 'es' ? '¡Logro!' : 'Achievement!') + ' ' + tr(a));
    renderPanel();
  }
  function checkAchievements() {
    if (Object.keys(state.pages).length >= 1) unlock('first');
    if (Object.keys(state.pages).length >= 5) unlock('curious');
    if (Object.keys(state.sections).length >= 9) unlock('explorer');
    if (state.quizzes >= 3) unlock('quizzer');
    if (state.challenges.nodes) unlock('bug');
    var passed = Object.keys(state.challenges).length;
    if (passed >= 3) unlock('challenger');
    if (passed >= CH_TOTAL) unlock('shipit');
  }

  /* ---------------- toast ---------------- */
  var toastBox;
  function toast(msg) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'learn-toasts'; document.body.appendChild(toastBox); }
    var el = document.createElement('div'); el.className = 'learn-toast'; el.textContent = msg;
    toastBox.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 300); }, 3200);
  }

  /* ---------------- HUD (level + xp) ---------------- */
  var hud;
  function buildHud() {
    var controls = document.querySelector('.top-bar .controls');
    if (!controls) return;
    hud = document.createElement('button');
    hud.id = 'learn-hud';
    hud.className = 'learn-hud';
    hud.addEventListener('click', openPanel);
    controls.insertBefore(hud, controls.firstChild);
    updateHud();
  }
  function updateHud() {
    if (!hud) return;
    var i = levelIndex(state.xp);
    var base = LEVELS[i].xp, next = nextLevelXp(state.xp);
    var pct = next > base ? Math.round(((state.xp - base) / (next - base)) * 100) : 100;
    hud.innerHTML = '<span class="lvl">Lv' + (i + 1) + '</span>' +
      '<span class="lvl-name">' + esc(tr(LEVELS[i])) + '</span>' +
      '<span class="xp-wrap"><span class="xp-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="xp-num">' + state.xp + ' XP</span>';
    hud.title = (lang() === 'es' ? 'Progreso de aprendizaje' : 'Learning progress');
  }

  /* ---------------- panel (achievements + map) ---------------- */
  var panel;
  var SECTION_ORDER = [
    ['intro', { en: 'Introduction', es: 'Introducción' }],
    ['gdscript', { en: 'GDScript', es: 'GDScript' }],
    ['nodes', { en: 'Nodes', es: 'Nodos' }],
    ['player', { en: '2D Player', es: 'Jugador 2D' }],
    ['metroidvania', { en: 'Metroidvania', es: 'Metroidvania' }],
    ['pixelart', { en: 'Pixel Art', es: 'Pixel Art' }],
    ['sistemas', { en: 'Systems', es: 'Sistemas' }],
    ['reference', { en: 'Reference', es: 'Referencia' }],
    ['build', { en: 'Build', es: 'Build' }]
  ];
  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'learn-panel';
    panel.className = 'cmd-overlay';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.hidden = true;
    document.body.appendChild(panel);
    panel.addEventListener('mousedown', function (e) { if (e.target === panel) closePanel(); });
    renderPanel();
  }
  function renderPanel() {
    if (!panel) return;
    var i = levelIndex(state.xp);
    var es = lang() === 'es';
    var map = SECTION_ORDER.map(function (s) {
      var on = !!state.sections[s[0]];
      return '<div class="map-room ' + (on ? 'lit' : '') + '">' + (on ? '◆' : '◇') + '<span>' + esc(tr(s[1])) + '</span></div>';
    }).join('');
    var ach = ACH.map(function (a) {
      var on = !!state.ach[a.id];
      return '<div class="ach ' + (on ? 'on' : '') + '"><span class="ach-i">' + a.icon + '</span>' +
        '<div><div class="ach-t">' + esc(tr(a)) + '</div><div class="ach-d">' + esc(tr({ en: a.en.d, es: a.es.d })) + '</div></div></div>';
    }).join('');
    panel.innerHTML = '<div class="learn-box" role="document">' +
      '<button class="help-close" aria-label="' + (es ? 'Cerrar' : 'Close') + '">✕</button>' +
      '<h2>🎮 ' + (es ? 'Modo Aprendizaje' : 'Learning Mode') + '</h2>' +
      '<div class="learn-lvl">' + (es ? 'Nivel' : 'Level') + ' ' + (i + 1) + ' · ' + esc(tr(LEVELS[i])) + ' · ' + state.xp + ' XP</div>' +
      '<h3>' + (es ? '🗺️ Mapa del curso' : '🗺️ Course map') + '</h3><div class="learn-map">' + map + '</div>' +
      '<h3>' + (es ? '🏅 Logros' : '🏅 Achievements') + '</h3><div class="learn-ach">' + ach + '</div>' +
      '<p class="learn-hint">' + (es
        ? 'Ganás XP leyendo páginas, aprobando quizzes y resolviendo los retos al final de cada sección.'
        : 'Earn XP by reading pages, passing quizzes and solving the challenges at the end of each section.') + '</p>' +
      '</div>';
    panel.querySelector('.help-close').addEventListener('click', closePanel);
  }
  function openPanel() { if (!panel) buildPanel(); renderPanel(); panel.hidden = false; document.body.classList.add('modal-open'); }
  function closePanel() { if (panel) { panel.hidden = true; document.body.classList.remove('modal-open'); } }

  /* ---------------- challenges ---------------- */
  function challengeHtml(key) {
    var c = CH[key];
    var solved = !!state.challenges[key];
    var opts = '';
    if (c.type === 'mc') {
      var labels = Array.isArray(c.options) ? c.options : tr(c.options);
      opts = '<div class="ch-opts">' + labels.map(function (lab, idx) {
        return '<button class="ch-opt" data-i="' + idx + '">' + esc(lab) + '</button>';
      }).join('') + '</div>';
    } else {
      opts = '<div class="ch-blank"><input type="text" class="ch-input" placeholder="' + esc(tr(c.placeholder)) + '" autocomplete="off" spellcheck="false">' +
        '<button class="ch-check">' + (lang() === 'es' ? 'Comprobar' : 'Check') + '</button></div>';
    }
    var tag = c.kind === 'bug' ? (lang() === 'es' ? 'Encontrá el bug' : 'Find the bug')
      : c.kind === 'blank' ? (lang() === 'es' ? 'Completá el código' : 'Fill the blank')
        : (lang() === 'es' ? 'Predecí la salida' : 'Predict the output');
    return '<div class="learn-challenge' + (solved ? ' solved' : '') + '" data-ch="' + key + '">' +
      '<div class="ch-head"><span class="ch-badge">🧪 ' + (lang() === 'es' ? 'Reto' : 'Challenge') + '</span><span class="ch-kind">' + tag + '</span>' +
      (solved ? '<span class="ch-done">✓ ' + (lang() === 'es' ? 'Resuelto' : 'Solved') + '</span>' : '') + '</div>' +
      '<div class="ch-q">' + esc(tr(c.q)) + '</div>' +
      '<pre class="ch-code"><code>' + esc(c.code) + '</code></pre>' +
      opts + '<div class="ch-fb"></div></div>';
  }

  function wireChallenge(box) {
    var key = box.getAttribute('data-ch');
    var c = CH[key];
    var fb = box.querySelector('.ch-fb');
    function pass() {
      box.classList.add('solved');
      fb.className = 'ch-fb ok'; fb.textContent = '✓ ' + tr(c.ok);
      if (!state.challenges[key]) { state.challenges[key] = 1; save(); award(12); checkAchievements(); }
      var head = box.querySelector('.ch-head');
      if (head && !head.querySelector('.ch-done')) {
        var s = document.createElement('span'); s.className = 'ch-done'; s.textContent = '✓ ' + (lang() === 'es' ? 'Resuelto' : 'Solved'); head.appendChild(s);
      }
    }
    function fail() { fb.className = 'ch-fb ko'; fb.textContent = '✗ ' + tr(c.ko); }
    if (c.type === 'mc') {
      box.querySelectorAll('.ch-opt').forEach(function (b) {
        b.addEventListener('click', function () {
          box.querySelectorAll('.ch-opt').forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel');
          if (+b.dataset.i === c.correct) { b.classList.add('good'); pass(); }
          else { b.classList.add('bad'); fail(); }
        });
      });
    } else {
      var input = box.querySelector('.ch-input');
      var btn = box.querySelector('.ch-check');
      function tryAns() {
        var v = (input.value || '').trim().toLowerCase().replace(/[()"';:]/g, '');
        if (c.accept.indexOf(v) !== -1) { input.classList.add('good'); pass(); }
        else { input.classList.add('bad'); fail(); }
      }
      btn.addEventListener('click', tryAns);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryAns(); });
    }
  }

  function injectChallenges() {
    Object.keys(CH).forEach(function (key) {
      var section = document.getElementById('section-' + key);
      if (!section) return;
      if (section.querySelector('.learn-challenge')) return;
      var quiz = section.querySelector('.quiz');
      var html = challengeHtml(key);
      if (quiz) quiz.insertAdjacentHTML('afterend', html);
      else {
        var footer = section.querySelector('.nav-footer');
        if (footer) footer.insertAdjacentHTML('beforebegin', html);
        else return;
      }
      wireChallenge(section.querySelector('.learn-challenge'));
    });
  }
  function rerenderChallenges() {
    document.querySelectorAll('.learn-challenge').forEach(function (box) {
      var key = box.getAttribute('data-ch');
      box.outerHTML = challengeHtml(key);
    });
    Object.keys(CH).forEach(function (key) {
      var s = document.getElementById('section-' + key);
      var box = s && s.querySelector('.learn-challenge');
      if (box) wireChallenge(box);
    });
  }

  /* ---------------- hooks ---------------- */
  function trackNav() {
    var sec = (typeof currentSection !== 'undefined') ? currentSection : null;
    var pg = (typeof currentPage !== 'undefined') ? currentPage : null;
    if (!sec || !pg) return;
    var key = sec + ':' + pg;
    if (!state.pages[key]) { state.pages[key] = 1; award(4); }
    if (!state.sections[sec]) { state.sections[sec] = 1; }
    save(); checkAchievements();
  }
  function wrapGlobals() {
    if (typeof window.navigate === 'function' && !window.__learnNav) {
      var on = window.navigate;
      window.navigate = function () { var r = on.apply(this, arguments); try { trackNav(); } catch (e) {} return r; };
      window.__learnNav = true;
    }
    if (typeof window.answer === 'function' && !window.__learnAns) {
      var oa = window.answer;
      window.answer = function (el, correct) {
        var r = oa.apply(this, arguments);
        try { if (correct) { state.quizzes = (state.quizzes || 0) + 1; save(); award(8); checkAchievements(); } } catch (e) {}
        return r;
      };
      window.__learnAns = true;
    }
  }

  /* re-render text when language changes */
  function watchLang() {
    var last = document.documentElement.lang;
    new MutationObserver(function () {
      if (document.documentElement.lang !== last) {
        last = document.documentElement.lang;
        updateHud(); renderPanel(); rerenderChallenges();
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  function init() {
    try {
      load();
      buildHud();
      buildPanel();
      injectChallenges();
      wrapGlobals();
      watchLang();
      trackNav();
      checkAchievements();
    } catch (e) { console.error('learn init error:', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
