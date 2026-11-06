'use strict';
// node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../src/renderer/themes');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');
const HEX = /^#[0-9a-f]{6}$/i;

test('Θέματα: τα προεπιλεγμένα παραμένουν το φωτεινό και το σκοτεινό', () => {
  assert.equal(T.LIST[0].id, 'light');
  assert.equal(T.LIST[1].id, 'dark');
  assert.equal(T.get('light').monaco, 'idle-light');
  assert.equal(T.get('dark').monaco, 'idle-dark');
  assert.equal(T.get('κάτι που δεν υπάρχει').id, 'light', 'άγνωστο θέμα: το προεπιλεγμένο');
  assert.equal(T.get(undefined).id, 'light');
});

test('Θέματα: τρία σκοτεινά και τρία φωτεινά τύπου Android Studio, με αντίστοιχα ζεύγη', () => {
  const ids = T.LIST.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'μοναδικά id');
  assert.deepEqual(T.LIST.filter((t) => t.group === 'dark').map((t) => t.label), ['Dark', 'Darcula', 'Islands Darcula']);
  assert.deepEqual(T.LIST.filter((t) => t.group === 'light').map((t) => t.label), ['Light', 'IntelliJ Light', 'Islands Light']);
  for (const t of T.LIST) {
    const other = T.get(t.pair);
    assert.equal(other.id, t.pair, `το ζεύγος του ${t.id} υπάρχει`);
    assert.equal(other.pair, t.id, `το ζεύγος του ${t.id} είναι αμφίδρομο`);
    assert.notEqual(other.dark, t.dark, `το ${t.id} γυρνά στο αντίθετο φωτεινό/σκοτεινό`);
    assert.equal(!!other.islands, !!t.islands, `οι νησίδες ταιριάζουν στο ζεύγος του ${t.id}`);
  }
});

test('Θέματα: χρώματα έγκυρα, και block στο styles.css για κάθε νέο θέμα', () => {
  for (const t of T.LIST) {
    assert.match(t.window, HEX, t.id);
    if (!t.syn) continue;
    for (const [k, v] of Object.entries(t.syn)) assert.match('#' + v, HEX, `${t.id} syn.${k}`);
    for (const [k, v] of Object.entries(t.ed)) assert.match(v, HEX, `${t.id} ed.${k}`);
    assert.ok(css.includes(`body.theme-${t.id} {`), `λείπουν τα χρώματα στο CSS για το ${t.id}`);
  }
  assert.ok(css.includes('body.theme-islands'), 'διάταξη νησίδων');
});

test('Θέματα: κλάσεις του body και εφαρμογή χωρίς να χαθούν οι υπόλοιπες κλάσεις', () => {
  assert.deepEqual(T.bodyClasses('jb-islands-darcula'), ['theme-dark', 'theme-jb-islands-darcula', 'theme-islands']);
  assert.deepEqual(T.bodyClasses('jb-intellij-light'), ['theme-light', 'theme-jb-intellij-light']);
  const set = new Set(['running', 'no-vars', 'theme-light']);
  const body = {
    get classList() {
      return {
        add: (...c) => c.forEach((x) => set.add(x)),
        remove: (c) => set.delete(c),
        [Symbol.iterator]: () => set[Symbol.iterator](),
      };
    },
  };
  // το Array.from του applyToBody χρειάζεται iterable
  T.applyToBody(body, 'jb-dark');
  assert.deepEqual([...set].sort(), ['no-vars', 'running', 'theme-dark', 'theme-jb-dark']);
  T.applyToBody(body, 'jb-islands-light');
  assert.deepEqual([...set].sort(), ['no-vars', 'running', 'theme-islands', 'theme-jb-islands-light', 'theme-light']);
});

test('Θέματα: ο ορισμός στον Monaco δίνει θέμα για κάθε νέο id, με τα χρώματα της παλέτας', () => {
  const defined = {};
  T.defineMonaco({ editor: { defineTheme: (name, def) => { defined[name] = def; } } }, (s) => [{ token: 'keyword', foreground: s.kw }]);
  assert.deepEqual(Object.keys(defined).sort(), T.LIST.filter((t) => t.syn).map((t) => t.monaco).sort());
  assert.equal(defined['jb-darcula'].base, 'vs-dark');
  assert.equal(defined['jb-darcula'].colors['editor.background'], '#2b2b2b');
  assert.equal(defined['jb-darcula'].rules[0].foreground, 'cc7832');
  assert.equal(defined['jb-light'].base, 'vs');
});

test('Γραμματοσειρές: προεπιλογή και Inter / JetBrains Mono, με αρχεία που υπάρχουν (ελληνικά και λατινικά)', () => {
  assert.equal(T.FONTS.mono[0].id, 'default');
  assert.equal(T.FONTS.ui[0].id, 'default');
  assert.ok(T.monoStack('jetbrains').startsWith("'JetBrains Mono', "));
  assert.ok(T.uiStack('inter').startsWith("'Inter', "));
  assert.equal(T.monoStack('άγνωστη'), T.monoStack('default'), 'άγνωστη επιλογή: η προεπιλογή');
  const dir = path.join(__dirname, '..', 'src', 'renderer', 'fonts');
  const fcss = fs.readFileSync(path.join(dir, 'fonts.css'), 'utf-8');
  const urls = [...fcss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 14);
  for (const u of urls) assert.ok(fs.existsSync(path.join(dir, u)), `λείπει το ${u}`);
  for (const fam of ['Inter', 'JetBrains Mono']) {
    assert.ok(urls.some((u) => /greek/.test(u)) && fcss.includes(`font-family: '${fam}'`), fam);
  }
  assert.ok(fs.existsSync(path.join(dir, 'LICENSE-Inter.txt')) && fs.existsSync(path.join(dir, 'LICENSE-JetBrainsMono.txt')));
});
