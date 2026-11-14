'use strict';

/*
 * Χρώμα της γραμμής μενού και εργαλείων (στυλ Android Studio): επιλέγεται από τις Ρυθμίσεις και τα γράμματα
 * προσαρμόζονται μόνα τους ώστε να διαβάζονται σε κάθε φόντο.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/renderer/themes');

test('Χρώματα κεφαλίδας: προεπιλογή «ίδιο με το θέμα», προκαθορισμένα και προσαρμοσμένο', () => {
  assert.equal(T.HEADER_COLORS[0].id, 'theme');
  assert.equal(T.headerColorOf('theme'), null, 'ακολουθεί το θέμα');
  assert.equal(T.headerColorOf(undefined), null);
  assert.equal(T.headerColorOf('άκυρο'), null);
  assert.equal(T.headerColorOf('graphite'), '#3c3f41');
  assert.equal(T.headerColorOf('custom'), null, 'το «άλλο» χρειάζεται συγκεκριμένο χρώμα');
  assert.equal(T.headerColorOf('#A1B2C3'), '#a1b2c3', 'προσαρμοσμένο χρώμα');
  assert.equal(T.headerColorOf('#abc'), null, 'μόνο #rrggbb');
  assert.equal(T.headerColorOf('red; background: url(x)'), null, 'τίποτα άλλο δεν περνά στο CSS');

  const ids = T.HEADER_COLORS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'μοναδικά αναγνωριστικά');
  for (const c of T.HEADER_COLORS) {
    assert.ok(c.label, c.id);
    if (c.color) assert.match(c.color, /^#[0-9a-f]{6}$/i, c.id);
  }
  assert.ok(T.HEADER_COLORS.length >= 10, 'αρκετά χρώματα για επιλογή');
});

test('Τα γράμματα της κεφαλίδας διαβάζονται σε κάθε φόντο (αντίθεση ≥ 4.5)', () => {
  for (const c of T.HEADER_COLORS.filter((x) => x.color)) {
    const s = T.headerStyle(c.color);
    assert.ok(T.contrast(c.color, s.fg) >= 4.5, `${c.id}: αντίθεση ${T.contrast(c.color, s.fg).toFixed(1)}`);
  }
  // Σκούρο φόντο → ανοιχτά γράμματα, ανοιχτό φόντο → σκούρα
  assert.equal(T.headerStyle('#3c3f41').dark, true);
  assert.equal(T.headerStyle('#3c3f41').fg, '#f2f3f5');
  assert.equal(T.headerStyle('#ffffff').dark, false);
  assert.equal(T.headerStyle('#ffffff').fg, '#1b1c1f');
  assert.equal(T.headerStyle('#dfe1e5').dark, false);

  // Τυχαία χρώματα που διαλέγει ο χρήστης: πάντα αναγνώσιμα
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 500; i++) {
    const hex = '#' + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, '0')).join('');
    assert.ok(T.contrast(hex, T.headerStyle(hex).fg) >= 4.5, hex);
  }
});

test('Φωτεινότητα και αντίθεση: γνωστές τιμές', () => {
  assert.equal(T.luminance('#000000'), 0);
  assert.ok(Math.abs(T.luminance('#ffffff') - 1) < 1e-9);
  assert.ok(Math.abs(T.contrast('#000000', '#ffffff') - 21) < 1e-6);
});

// ---------------------------------------------------------------- διαβάθμιση (gradient)
test('mix: ανάμειξη δύο χρωμάτων', () => {
  assert.equal(T.mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(T.mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(T.mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(T.mix('#ff0000', '#0000ff', 0.5), '#800080');
});

test('Διαβάθμιση: τιμή CSS και κατευθύνσεις', () => {
  assert.equal(T.headerImage('#111111', '#eeeeee', 'right'), 'linear-gradient(90deg, #111111, #eeeeee)');
  assert.equal(T.headerImage('#111111', '#eeeeee', 'down'), 'linear-gradient(180deg, #111111, #eeeeee)');
  assert.equal(T.headerImage('#111111', '#eeeeee', 'άκυρο'), 'linear-gradient(90deg, #111111, #eeeeee)', 'άγνωστη κατεύθυνση: αριστερά → δεξιά');
  const ids = T.HEADER_DIRECTIONS.map((d) => d.id);
  assert.deepEqual(ids, ['right', 'left', 'down', 'diag']);
  for (const d of T.HEADER_DIRECTIONS) assert.ok(d.label && /^\d+deg$/.test(d.css), d.id);
});

test('Κουμπιά παραθύρου: παίρνουν το χρώμα της άκρης της διαβάθμισης', () => {
  assert.equal(T.headerEdgeColor('#111111', '#eeeeee', 'right'), '#eeeeee', 'δεξιά άκρη = δεύτερο χρώμα');
  assert.equal(T.headerEdgeColor('#111111', '#eeeeee', 'left'), '#111111', 'δεξιά άκρη = πρώτο χρώμα');
  assert.equal(T.headerEdgeColor('#111111', '#eeeeee', 'down'), '#111111', 'η γραμμή τίτλου είναι το πάνω μέρος');
  const d = T.headerEdgeColor('#000000', '#ffffff', 'diag');
  assert.ok(d > '#000000' && d < '#ffffff', 'διαγώνια: ενδιάμεσο χρώμα');
});

test('Διαβάθμιση: τα γράμματα διαβάζονται και στις δύο άκρες (αντίθεση ≥ 4.5) για κάθε ζεύγος χρωμάτων', () => {
  const ends = T.HEADER_COLORS.filter((c) => c.color).map((c) => c.color);
  let checked = 0;
  for (const a of ends) {
    for (const b of ends) {
      const s = T.headerStyle(a, b);
      assert.match(s.bg, /^#[0-9a-f]{6}$/);
      assert.match(s.bg2, /^#[0-9a-f]{6}$/);
      assert.match(s.menu, /^#[0-9a-f]{6}$/);
      for (const c of [s.bg, s.bg2, s.menu]) {
        assert.ok(T.contrast(c, s.fg) >= 4.5 - 0.05, `${a}→${b}: γράμματα ${s.fg} σε ${c} = ${T.contrast(c, s.fg).toFixed(2)}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 100);
});

test('Διαβάθμιση: ζεύγη που ήδη διαβάζονται δεν αλλάζουν χρώμα', () => {
  const s = T.headerStyle('#2b2d30', '#5b3a8c');
  assert.equal(s.bg, '#2b2d30');
  assert.equal(s.bg2, '#5b3a8c');
  assert.equal(s.dark, true, 'σκούρο → σκούρο: ανοιχτά γράμματα');
  const l = T.headerStyle('#ffffff', '#dfe1e5');
  assert.equal(l.bg, '#ffffff');
  assert.equal(l.bg2, '#dfe1e5');
  assert.equal(l.dark, false, 'ανοιχτό → ανοιχτό: σκούρα γράμματα');
});

test('Διαβάθμιση: πολύ διαφορετικές φωτεινότητες μαλακώνουν το άκρο που δεν διαβάζεται', () => {
  // σκούρο γκρι → ασημί: κανένα χρώμα γραμμάτων δεν ταιριάζει και στα δύο
  const s = T.headerStyle('#3c3f41', '#dfe1e5');
  assert.ok(T.contrast(s.bg, s.fg) >= 4.45 && T.contrast(s.bg2, s.fg) >= 4.45);
  assert.ok(s.bg !== '#3c3f41' || s.bg2 !== '#dfe1e5', 'ένα άκρο άλλαξε');
  assert.notEqual(s.bg, s.bg2, 'παραμένει διαβάθμιση');
  // μαύρο → λευκό: το ίδιο, και πάλι διαβάθμιση
  const bw = T.headerStyle('#000000', '#ffffff');
  assert.ok(T.contrast(bw.bg, bw.fg) >= 4.45 && T.contrast(bw.bg2, bw.fg) >= 4.45);
  assert.notEqual(bw.bg, bw.bg2);
});

test('Ένα χρώμα: δεν αλλάζει συμπεριφορά (χωρίς δεύτερο χρώμα)', () => {
  const s = T.headerStyle('#3c3f41');
  assert.equal(s.bg2, null);
  assert.equal(s.menu, '#3c3f41', 'το μενού έχει το ίδιο χρώμα');
  assert.deepEqual(T.headerStyle('#3c3f41', null), s);
});
