/* ============================================================
   extras.js — floating glossary + static GDScript checker
   Both bilingual (follow <html lang>), self-contained, defensive.
   ============================================================ */

/* ===================== 1) GLOSSARY ===================== */
(function () {
  'use strict';
  function lang() { return document.documentElement.lang === 'es' ? 'es' : 'en'; }

  // term groups: words to match per language + bilingual definition
  var TERMS = [
    { es: ['nodo', 'nodos'], en: ['node', 'nodes'], def: { es: 'La pieza básica de Godot. Todo (sprites, sonidos, colisiones) es un nodo que se cuelga en un árbol.', en: 'Godot\'s basic building block. Everything (sprites, sounds, collisions) is a node placed in a tree.' } },
    { es: ['escena', 'escenas'], en: ['scene', 'scenes'], def: { es: 'Un grupo de nodos guardado como archivo .tscn; funciona como un "prefab" reutilizable.', en: 'A group of nodes saved as a .tscn file; works as a reusable "prefab".' } },
    { es: ['señal', 'señales'], en: ['signal', 'signals'], def: { es: 'Un aviso que un nodo emite cuando pasa algo; otros nodos lo escuchan y reaccionan, sin acoplarse.', en: 'A notice a node emits when something happens; other nodes listen and react, without coupling.' } },
    { es: ['delta'], en: ['delta'], def: { es: 'El tiempo (en segundos) desde el cuadro anterior. Multiplicá movimientos por delta para que sean iguales a cualquier FPS.', en: 'The time (in seconds) since the previous frame. Multiply movement by delta so it is consistent at any FPS.' } },
    { es: ['tween'], en: ['tween'], def: { es: 'Una animación por código que interpola una propiedad de un valor a otro a lo largo del tiempo.', en: 'A code-driven animation that interpolates a property from one value to another over time.' } },
    { es: ['autoload', 'autoloads'], en: ['autoload', 'autoloads'], def: { es: 'Un nodo global (singleton) que vive durante todo el juego y es accesible desde cualquier script.', en: 'A global node (singleton) that lives for the whole game and is reachable from any script.' } },
    { es: ['singleton'], en: ['singleton'], def: { es: 'Una única instancia compartida y accesible globalmente. En Godot se logra con Autoloads.', en: 'A single shared instance reachable globally. In Godot you get it with Autoloads.' } },
    { es: ['tilemap'], en: ['tilemap'], def: { es: 'Una grilla donde "pintás" el nivel con piezas pequeñas y repetibles (tiles).', en: 'A grid where you "paint" the level with small, repeatable pieces (tiles).' } },
    { es: ['viewport'], en: ['viewport'], def: { es: 'El área donde se dibuja el juego. Su tamaño define la resolución interna.', en: 'The area where the game is drawn. Its size defines the internal resolution.' } },
    { es: ['shader'], en: ['shader'], def: { es: 'Un mini-programa que corre en la GPU y cambia cómo se ve algo (contornos, flashes, colores).', en: 'A tiny program that runs on the GPU and changes how something looks (outlines, flashes, colors).' } },
    { es: ['colisión', 'colisiones'], en: ['collision', 'collisions'], def: { es: 'La detección de cuándo dos cuerpos se tocan, para frenar, dañar o disparar eventos.', en: 'Detecting when two bodies touch, to stop, damage or trigger events.' } },
    { es: ['grupo', 'grupos'], en: ['group', 'groups'], def: { es: 'Una etiqueta que ponés a varios nodos para tratarlos en conjunto (p. ej. "enemies").', en: 'A label you put on several nodes to handle them together (e.g. "enemies").' } },
    { es: ['gravedad'], en: ['gravity'], def: { es: 'Fuerza que tira los cuerpos hacia abajo. Se suma a la velocidad vertical cada cuadro.', en: 'Force that pulls bodies downward. It is added to vertical velocity each frame.' } },
    { es: ['sprite', 'sprites'], en: ['sprite', 'sprites'], def: { es: 'Una imagen 2D (normalmente del personaje u objeto) que se dibuja en pantalla.', en: 'A 2D image (usually of a character or object) drawn on screen.' } },
    { es: ['spritesheet'], en: ['spritesheet'], def: { es: 'Una sola imagen con todos los cuadros de una animación en fila.', en: 'A single image with all the frames of an animation in a row.' } },
    { es: ['instanciar'], en: ['instancing', 'instance'], def: { es: 'Crear una copia de una escena mientras el juego corre (una bala, un enemigo).', en: 'Creating a copy of a scene while the game runs (a bullet, an enemy).' } },
    { es: ['metroidvania'], en: ['metroidvania'], def: { es: 'Juego de exploración 2D con un mapa interconectado donde habilidades nuevas abren zonas nuevas.', en: 'A 2D exploration game with an interconnected map where new abilities unlock new areas.' } },
    { es: ['coyote time'], en: ['coyote time'], def: { es: 'Pequeño margen tras caer de un borde en el que todavía podés saltar. Mejora el "game feel".', en: 'A small grace window after leaving a ledge in which you can still jump. Improves game feel.' } },
    { es: ['jump buffer'], en: ['jump buffer'], def: { es: 'Recordar un salto pulsado un instante antes de tocar el piso, para ejecutarlo al aterrizar.', en: 'Remembering a jump pressed just before landing, so it fires the moment you touch ground.' } },
    { es: ['pixel art'], en: ['pixel art'], def: { es: 'Arte hecho con pocos píxeles grandes y definidos; requiere filtro "Nearest" para verse nítido.', en: 'Art made with few large, defined pixels; needs the "Nearest" filter to stay crisp.' } }
  ];

  var tip;
  function ensureTip() {
    if (tip) return;
    tip = document.createElement('div');
    tip.className = 'gloss-tip';
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  function showTip(el) {
    ensureTip();
    tip.textContent = el.getAttribute('data-def-' + lang()) || el.getAttribute('data-def-en');
    tip.hidden = false;
    var r = el.getBoundingClientRect();
    var top = r.bottom + window.scrollY + 6;
    var left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 320);
    tip.style.top = top + 'px';
    tip.style.left = Math.max(8, left) + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  var SKIP = { A: 1, CODE: 1, PRE: 1, BUTTON: 1, SCRIPT: 1, STYLE: 1, H1: 1, H2: 1, H3: 1, H4: 1 };
  function skipped(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (SKIP[p.tagName]) return true;
      if (p.classList && (p.classList.contains('gloss') || p.classList.contains('ch-code'))) return true;
      if (p.id === 'sidebar') return true;
      p = p.parentNode;
    }
    return false;
  }

  function unwrapAll() {
    document.querySelectorAll('span.gloss').forEach(function (s) {
      var t = document.createTextNode(s.textContent);
      s.parentNode.replaceChild(t, s);
    });
  }

  function tagContainer(container, words) {
    // words: array of {re, def} sorted by length desc
    for (var w = 0; w < words.length; w++) {
      var info = words[w];
      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      var node, target = null, m = null;
      while ((node = walker.nextNode())) {
        if (skipped(node)) continue;
        info.re.lastIndex = 0;
        m = info.re.exec(node.nodeValue);
        if (m) { target = node; break; }
      }
      if (target && m) {
        var txt = target.nodeValue;
        var span = document.createElement('span');
        span.className = 'gloss';
        span.textContent = m[0];
        span.setAttribute('data-def-en', info.def.en);
        span.setAttribute('data-def-es', info.def.es);
        span.tabIndex = 0;
        var after = target.splitText(m.index);
        after.nodeValue = after.nodeValue.slice(m[0].length);
        target.parentNode.insertBefore(span, after);
      }
    }
  }

  function tagAll() {
    var lng = lang();
    var words = TERMS.map(function (t) {
      var list = (t[lng] || t.en).slice().sort(function (a, b) { return b.length - a.length; });
      var pat = list.map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
      return { re: new RegExp('(?<![\\wÁÉÍÓÚáéíóúñÑ])(' + pat + ')(?![\\wÁÉÍÓÚáéíóúñÑ])', 'i'), def: t.def };
    });
    // longer phrases first so "coyote time" beats nothing etc.
    var containers = document.querySelectorAll('#main .content [id^="page-"], #section-build');
    containers.forEach(function (c) { try { tagContainer(c, words); } catch (e) {} });
  }

  function retag() { try { unwrapAll(); tagAll(); } catch (e) { console.error('glossary retag', e); } }

  function bind() {
    document.addEventListener('mouseover', function (e) {
      var g = e.target.closest && e.target.closest('.gloss');
      if (g) showTip(g);
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest('.gloss')) hideTip();
    });
    document.addEventListener('focusin', function (e) {
      if (e.target.classList && e.target.classList.contains('gloss')) showTip(e.target);
    });
    document.addEventListener('focusout', hideTip);
    document.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('.gloss');
      if (g) { if (tip && !tip.hidden) hideTip(); else showTip(g); }
      else hideTip();
    });
    window.addEventListener('scroll', hideTip, { passive: true });
  }

  function init() {
    try {
      tagAll();
      bind();
      var last = document.documentElement.lang;
      new MutationObserver(function () {
        if (document.documentElement.lang !== last) { last = document.documentElement.lang; retag(); }
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (e) { console.error('glossary init', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ===================== 2) STATIC GDSCRIPT CHECKER ===================== */
(function () {
  'use strict';
  function es() { return document.documentElement.lang === 'es'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var SAMPLE = 'extends CharacterBody2D\n\nfunc _physics_process(delta)\n    velocity.y += 980 * delta\n    move_and_slide();';

  function check(code) {
    var issues = [];
    var lines = code.split('\n');
    // balanced brackets
    var pairs = { ')': '(', ']': '[', '}': '{' };
    var open = { '(': 0, '[': 0, '{': 0 };
    var stack = [];
    var inStr = false, strCh = '';
    for (var i = 0; i < code.length; i++) {
      var ch = code[i];
      if (inStr) { if (ch === strCh) inStr = false; continue; }
      if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
      if (ch === '#') { while (i < code.length && code[i] !== '\n') i++; continue; }
      if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
      else if (pairs[ch]) { if (stack.pop() !== pairs[ch]) issues.push({ l: 0, m: es() ? 'Paréntesis/llaves/corchetes desbalanceados.' : 'Unbalanced parentheses/brackets/braces.', sev: 'err' }); }
    }
    if (stack.length) issues.push({ l: 0, m: es() ? 'Falta cerrar ' + stack.length + ' paréntesis/llave/corchete.' : 'Missing ' + stack.length + ' closing bracket(s).', sev: 'err' });

    var usesTab = false, usesSpace = false;
    lines.forEach(function (raw, idx) {
      var n = idx + 1;
      var line = raw.replace(/#.*/, '');
      var trimmed = line.trim();
      var lead = (line.match(/^[ \t]*/) || [''])[0];
      if (/\t/.test(lead)) usesTab = true;
      if (/ /.test(lead)) usesSpace = true;
      if (/\bfunction\b/.test(line)) issues.push({ l: n, m: es() ? 'Usá "func", no "function".' : 'Use "func", not "function".', sev: 'err' });
      if (/^\s*def\b/.test(line)) issues.push({ l: n, m: es() ? 'GDScript usa "func", no "def".' : 'GDScript uses "func", not "def".', sev: 'err' });
      if (/^\s*let\b/.test(line)) issues.push({ l: n, m: es() ? 'GDScript usa "var", no "let".' : 'GDScript uses "var", not "let".', sev: 'err' });
      if (/;\s*$/.test(line)) issues.push({ l: n, m: es() ? 'GDScript no usa punto y coma al final.' : 'GDScript does not use trailing semicolons.', sev: 'warn' });
      if (/^\s*(if|elif|else|for|while|func|class|match)\b.*[^:]\s*$/.test(line) && !/:\s*(#.*)?$/.test(line) && trimmed && !/\\$/.test(trimmed))
        issues.push({ l: n, m: es() ? 'Probable falta de ":" al final de la línea.' : 'Likely missing ":" at the end of the line.', sev: 'warn' });
      if (/\bprint\s+[^(]/.test(line)) issues.push({ l: n, m: es() ? 'print necesita paréntesis: print("...").' : 'print needs parentheses: print("...").', sev: 'warn' });
    });
    if (usesTab && usesSpace) issues.push({ l: 0, m: es() ? 'Mezclás tabs y espacios en la indentación; usá uno solo.' : 'You mix tabs and spaces for indentation; pick one.', sev: 'warn' });
    return issues;
  }

  var modal;
  function build() {
    modal = document.createElement('div');
    modal.id = 'lint-modal';
    modal.className = 'cmd-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.hidden = true;
    render();
    document.body.appendChild(modal);
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) close(); });
  }
  function render() {
    var e = es();
    modal.innerHTML = '<div class="lint-box" role="document">' +
      '<button class="help-close" aria-label="' + (e ? 'Cerrar' : 'Close') + '">✕</button>' +
      '<h2>🧪 ' + (e ? 'Verificador de GDScript' : 'GDScript Checker') + '</h2>' +
      '<p class="lint-note">' + (e ? 'Pegá tu código y revisá errores de sintaxis comunes. <strong>No ejecuta</strong> el código: es un chequeo estático.' : 'Paste your code and check for common syntax mistakes. It does <strong>not run</strong> the code: this is a static check.') + '</p>' +
      '<textarea id="lint-input" spellcheck="false">' + esc(SAMPLE) + '</textarea>' +
      '<div class="lint-actions"><button id="lint-run">' + (e ? 'Comprobar' : 'Check') + '</button>' +
      '<button id="lint-clear" class="ghost">' + (e ? 'Limpiar' : 'Clear') + '</button></div>' +
      '<div id="lint-out" class="lint-out"></div></div>';
    modal.querySelector('.help-close').addEventListener('click', close);
    modal.querySelector('#lint-run').addEventListener('click', run);
    modal.querySelector('#lint-clear').addEventListener('click', function () {
      modal.querySelector('#lint-input').value = ''; modal.querySelector('#lint-out').innerHTML = '';
    });
  }
  function run() {
    var code = modal.querySelector('#lint-input').value || '';
    var out = modal.querySelector('#lint-out');
    var issues = check(code);
    if (!issues.length) {
      out.innerHTML = '<div class="lint-ok">✓ ' + (es() ? 'Sin errores básicos. (Recordá: esto no ejecuta el código.)' : 'No basic issues found. (Remember: this does not run the code.)') + '</div>';
      return;
    }
    out.innerHTML = issues.map(function (it) {
      var where = it.l ? (es() ? 'Línea ' : 'Line ') + it.l + ': ' : '';
      return '<div class="lint-item ' + it.sev + '">' + (it.sev === 'err' ? '✗ ' : '⚠ ') + where + esc(it.m) + '</div>';
    }).join('');
  }
  function open() { if (!modal) build(); else render(); modal.hidden = false; document.body.classList.add('modal-open'); }
  function close() { if (modal) { modal.hidden = true; document.body.classList.remove('modal-open'); } }

  function addButton() {
    var bar = document.querySelector('.fab-toolbar');
    var b = document.createElement('button');
    b.className = 'fab'; b.id = 'fab-lint'; b.textContent = '{}';
    b.title = es() ? 'Verificar código GDScript' : 'Check GDScript code';
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', open);
    if (bar) bar.insertBefore(b, bar.querySelector('#fab-help') || null);
    else document.body.appendChild(b);
  }

  function init() {
    try {
      addButton();
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && !modal.hidden) close();
      });
    } catch (e) { console.error('linter init', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
