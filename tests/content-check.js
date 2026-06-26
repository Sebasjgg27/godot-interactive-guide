#!/usr/bin/env node
/* ============================================================
   content-check.js — static content-integrity QA (no browser)
   Run: node tests/content-check.js
   Validates the guide's content is internally consistent:
     · HTML <div> balance
     · every PAGES page has a matching #page-<name> (and vice versa)
     · every section quiz has exactly ONE correct answer
     · every navigate() target points to a real section + page
     · every learn.js challenge is well-formed
   Exits non-zero if any check fails (CI-friendly).
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const learnJs = fs.readFileSync(path.join(ROOT, 'js/learn.js'), 'utf8');

const fails = [];
const warns = [];
function check(name, cond, detail) { if (!cond) fails.push(name + (detail ? ' — ' + detail : '')); else console.log('  ok  ' + name); }

/* extract a brace-delimited literal that follows `marker` */
function literalAfter(src, marker) {
  const i = src.indexOf(marker);
  if (i === -1) return null;
  let s = src.indexOf('{', i);
  let depth = 0, inStr = false, q = '';
  for (let j = s; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === q && src[j - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(s, j + 1); }
  }
  return null;
}
function evalLiteral(lit) { return Function('"use strict";return (' + lit + ');')(); }
function decode(s) { return s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }

/* ---- 1. div balance ---- */
const opens = (html.match(/<div\b/g) || []).length;
const closes = (html.match(/<\/div>/g) || []).length;
check('div balance', opens === closes, opens + ' open vs ' + closes + ' close');

/* ---- parse PAGES / QUIZZES from app.js ---- */
let PAGES, QUIZZES, CH;
try { PAGES = evalLiteral(literalAfter(appJs, 'const PAGES =')); } catch (e) { fails.push('parse PAGES: ' + e.message); }
try { QUIZZES = evalLiteral(literalAfter(appJs, 'const QUIZZES =')); } catch (e) { fails.push('parse QUIZZES: ' + e.message); }
try { CH = evalLiteral(literalAfter(learnJs, 'var CH =')); } catch (e) { warns.push('parse learn CH: ' + e.message); }

/* ---- 2. PAGES <-> page divs ---- */
if (PAGES) {
  const pageIds = new Set((html.match(/id="page-([^"]+)"/g) || []).map(s => decode(s.slice(9, -1))));
  const flat = [];
  Object.keys(PAGES).forEach(k => PAGES[k].pages.forEach(p => flat.push(p)));
  // 'build' (Blueprint) is rendered dynamically into #build-mount, not a static div
  const dynamic = new Set(PAGES.build ? PAGES.build.pages : []);
  const missing = flat.filter(p => !pageIds.has(p) && !dynamic.has(p));
  check('every PAGES page has a #page- div', missing.length === 0, 'missing: ' + missing.join(', '));
  check('build section mounts dynamically (#build-mount)', html.indexOf('id="build-mount"') !== -1);
  const known = new Set(flat);
  const orphan = [...pageIds].filter(p => !known.has(p));
  check('no orphan page divs', orphan.length === 0, 'orphan: ' + orphan.join(', '));
  // section containers exist
  const secMissing = Object.keys(PAGES).filter(k => html.indexOf('id="section-' + k + '"') === -1);
  check('every section has a #section- container', secMissing.length === 0, 'missing: ' + secMissing.join(', '));
}

/* ---- 3. quizzes: exactly one correct ---- */
if (QUIZZES) {
  const bad = [];
  Object.keys(QUIZZES).forEach(k => {
    const correct = QUIZZES[k].options.filter(o => o[1] === true).length;
    if (correct !== 1) bad.push(k + '(' + correct + ')');
  });
  check('each quiz has exactly one correct answer', bad.length === 0, bad.join(', '));
}

/* ---- 4. navigate() targets are valid ---- */
if (PAGES) {
  const calls = [...html.matchAll(/navigate\('([^']+)','[^']*','([^']+)'/g)];
  const bad = [];
  calls.forEach(m => {
    const sec = m[1], pg = decode(m[2]);
    if (!PAGES[sec] || PAGES[sec].pages.indexOf(pg) === -1) bad.push(sec + ':' + pg);
  });
  check('all navigate() targets are valid pages', bad.length === 0, [...new Set(bad)].join(', '));
}

/* ---- 5. learn.js challenges well-formed ---- */
if (CH) {
  const bad = [];
  Object.keys(CH).forEach(k => {
    const c = CH[k];
    if (c.type === 'mc') {
      const opts = Array.isArray(c.options) ? c.options : (c.options && c.options.en);
      if (!opts || typeof c.correct !== 'number' || c.correct < 0 || c.correct >= opts.length) bad.push(k);
    } else if (c.type === 'blank') {
      if (!Array.isArray(c.accept) || !c.accept.length) bad.push(k);
    } else bad.push(k + '(type)');
  });
  check('learn.js challenges are well-formed', bad.length === 0, bad.join(', '));
  // challenge sections must be real sections
  if (PAGES) {
    const badSec = Object.keys(CH).filter(k => !PAGES[k]);
    check('challenge keys map to real sections', badSec.length === 0, badSec.join(', '));
  }
}

/* ---- report ---- */
console.log('');
if (warns.length) { console.log('WARNINGS:'); warns.forEach(w => console.log('  ! ' + w)); console.log(''); }
if (fails.length) {
  console.log('FAILED (' + fails.length + '):');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('All content-integrity checks passed.');
