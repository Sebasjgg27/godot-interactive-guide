/* ============================================================
   tutorial.js — guided "Hello World" first-script walkthrough
   Bilingual, self-contained, progress persisted in localStorage.
   Each step states how to KNOW it worked (objective verification).
   ============================================================ */
(function () {
  'use strict';
  var LS = 'gdscript-guide-tutorial-v1';
  function es() { return document.documentElement.lang === 'es'; }
  function esch(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var STEPS = [
    {
      t: { en: '1. Install and open Godot', es: '1. Instalá y abrí Godot' },
      d: { en: 'Download Godot 4.3+ from godotengine.org (a single file, no installer). Open it and click <strong>New Project</strong>. Pick a folder path with no spaces or accents.', es: 'Descargá Godot 4.3+ desde godotengine.org (un solo archivo, sin instalador). Abrilo y tocá <strong>New Project</strong>. Elegí una carpeta sin espacios ni tildes.' },
      ok: { en: 'You see the empty Godot editor with an empty Scene panel.', es: 'Ves el editor de Godot vacío, con el panel Scene vacío.' }
    },
    {
      t: { en: '2. Create a root node', es: '2. Creá un nodo raíz' },
      d: { en: 'In the Scene panel, click <strong>+ Other Node</strong> and choose <strong>Node2D</strong>.', es: 'En el panel Scene, tocá <strong>+ Other Node</strong> y elegí <strong>Node2D</strong>.' },
      ok: { en: 'A node called "Node2D" appears at the top of the Scene panel.', es: 'Aparece un nodo llamado “Node2D” arriba en el panel Scene.' }
    },
    {
      t: { en: '3. Save the scene', es: '3. Guardá la escena' },
      d: { en: 'Press <code>Ctrl+S</code> and save it as <code>main.tscn</code>.', es: 'Apretá <code>Ctrl+S</code> y guardala como <code>main.tscn</code>.' },
      ok: { en: 'A file "main.tscn" shows up in the FileSystem panel (bottom-left).', es: 'Aparece un archivo “main.tscn” en el panel FileSystem (abajo a la izquierda).' }
    },
    {
      t: { en: '4. Attach a script', es: '4. Adjuntá un script' },
      d: { en: 'Right-click the Node2D → <strong>Attach Script</strong> → <strong>Create</strong>.', es: 'Clic derecho en el Node2D → <strong>Attach Script</strong> → <strong>Create</strong>.' },
      ok: { en: 'The Script editor opens showing <code>extends Node2D</code> at the top.', es: 'Se abre el editor de Script mostrando <code>extends Node2D</code> arriba.' }
    },
    {
      t: { en: '5. Write your first line', es: '5. Escribí tu primera línea' },
      d: { en: 'Inside the <code>_ready()</code> function, type: <code>print("Hello, Godot!")</code>', es: 'Dentro de la función <code>_ready()</code>, escribí: <code>print("Hello, Godot!")</code>' },
      code: 'extends Node2D\n\nfunc _ready() -> void:\n    print("Hello, Godot!")',
      ok: { en: 'Your code matches the snippet above, with the print indented inside _ready().', es: 'Tu código coincide con el de arriba, con el print indentado dentro de _ready().' }
    },
    {
      t: { en: '6. Run it', es: '6. Ejecutalo' },
      d: { en: 'Press <code>F5</code> (Run Project). If asked, set the current scene as the main scene.', es: 'Apretá <code>F5</code> (Run Project). Si te pregunta, definí la escena actual como principal.' },
      ok: { en: 'The word "Hello, Godot!" appears in the Output panel at the bottom. 🎉 You just ran GDScript!', es: '“Hello, Godot!” aparece en el panel Output, abajo. 🎉 ¡Acabás de ejecutar GDScript!' }
    }
  ];

  var state = {};
  try { state = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { state = {}; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }

  var modal;
  function build() {
    modal = document.createElement('div');
    modal.id = 'tutorial-modal';
    modal.className = 'cmd-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.hidden = true;
    document.body.appendChild(modal);
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) close(); });
    render();
  }
  function render() {
    var done = STEPS.filter(function (_, i) { return state[i]; }).length;
    var pct = Math.round((done / STEPS.length) * 100);
    var steps = STEPS.map(function (s, i) {
      var on = !!state[i];
      return '<div class="tut-step' + (on ? ' done' : '') + '" data-i="' + i + '">' +
        '<button class="tut-check" aria-label="' + (es() ? 'Marcar paso' : 'Toggle step') + '">' + (on ? '✓' : '') + '</button>' +
        '<div class="tut-body"><div class="tut-t">' + esch(es() ? s.t.es : s.t.en) + '</div>' +
        '<div class="tut-d">' + (es() ? s.d.es : s.d.en) + '</div>' +
        (s.code ? '<pre class="tut-code"><code>' + esch(s.code) + '</code></pre>' : '') +
        '<div class="tut-ok"><span>' + (es() ? '¿Cómo sé que funcionó?' : 'How do I know it worked?') + '</span> ' + esch(es() ? s.ok.es : s.ok.en) + '</div>' +
        '</div></div>';
    }).join('');
    modal.innerHTML = '<div class="tut-box" role="document">' +
      '<button class="help-close" aria-label="' + (es() ? 'Cerrar' : 'Close') + '">✕</button>' +
      '<h2>🎓 ' + (es() ? 'Tu primer script: “Hola Mundo”' : 'Your first script: "Hello World"') + '</h2>' +
      '<p class="tut-intro">' + (es() ? 'Seguí estos 6 pasos en Godot. Marcá cada uno cuando veas el resultado esperado.' : 'Follow these 6 steps in Godot. Tick each one when you see the expected result.') + '</p>' +
      '<div class="tut-progress"><div class="tut-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="tut-pct">' + done + '/' + STEPS.length + '</div>' +
      steps +
      (done === STEPS.length ? '<div class="tut-win">🏆 ' + (es() ? '¡Completaste tu primer programa en Godot!' : 'You completed your first Godot program!') + '</div>' : '') +
      '</div>';
    modal.querySelector('.help-close').addEventListener('click', close);
    modal.querySelectorAll('.tut-step').forEach(function (st) {
      st.querySelector('.tut-check').addEventListener('click', function () {
        var i = st.getAttribute('data-i');
        state[i] = !state[i]; save(); render();
      });
    });
  }
  function open() { if (!modal) build(); else render(); modal.hidden = false; document.body.classList.add('modal-open'); }
  function close() { if (modal) { modal.hidden = true; document.body.classList.remove('modal-open'); } }

  function addButton() {
    var bar = document.querySelector('.fab-toolbar');
    var b = document.createElement('button');
    b.className = 'fab'; b.id = 'fab-tutorial'; b.textContent = '🎓';
    b.title = es() ? 'Tutorial: Hola Mundo' : 'Hello World tutorial';
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', open);
    if (bar) bar.appendChild(b); else document.body.appendChild(b);
  }
  function init() {
    try {
      addButton();
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && !modal.hidden) close(); });
      var last = document.documentElement.lang;
      new MutationObserver(function () {
        if (document.documentElement.lang !== last) { last = document.documentElement.lang; if (modal && !modal.hidden) render(); }
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (e) { console.error('tutorial init', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
