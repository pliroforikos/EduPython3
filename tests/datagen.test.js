'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/renderer/datagen');

/** Ψευδοτυχαία γεννήτρια με σπόρο, για επαναλήψιμα τεστ. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const isSorted = (arr, cmp) => arr.every((v, i) => i === 0 || cmp(arr[i - 1], v) <= 0);

test('Γεννήτρια: ακέραιοι μέσα στα όρια, χωρίς επαναλήψεις, μέγιστο πλήθος 50', () => {
  const r = G.generate({ kind: 'int', count: 80, min: 1, max: 100, unique: true, order: 'random', rnd: seeded(1) });
  assert.equal(r.values.length, 50, 'το πλήθος περιορίζεται στο 50');
  const nums = r.values.map(Number);
  assert.ok(nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 100));
  assert.equal(new Set(nums).size, 50);
});

test('Γεννήτρια: αύξουσα και φθίνουσα σειρά αριθμών (αριθμητικά, όχι αλφαβητικά)', () => {
  const asc = G.generate({ kind: 'int', count: 30, min: -50, max: 500, order: 'asc', rnd: seeded(2) }).values.map(Number);
  assert.ok(isSorted(asc, (a, b) => a - b));
  const desc = G.generate({ kind: 'real', count: 30, min: 0, max: 20, decimals: 1, order: 'desc', rnd: seeded(3) }).values.map(Number);
  assert.ok(isSorted(desc, (a, b) => b - a));
  assert.ok(desc.every((n) => n >= 0 && n <= 20 && Math.round(n * 10) === n * 10), 'ένα δεκαδικό ψηφίο');
});

test('Γεννήτρια: πραγματικοί με 2 δεκαδικά και αρνητικά όρια', () => {
  const r = G.generate({ kind: 'real', count: 20, min: -1.5, max: 1.5, decimals: 2, rnd: seeded(4) });
  for (const v of r.values) {
    const n = Number(v);
    assert.ok(n >= -1.5 && n <= 1.5, v);
    assert.ok(/^-?\d+(\.\d{1,2})?$/.test(v), v);
  }
});

test('Γεννήτρια: παιδαγωγικά μηνύματα για λάθος ρυθμίσεις', () => {
  assert.match(G.generate({ kind: 'int', count: 20, min: 1, max: 10, unique: true }).error, /μόνο 10 ακέραιοι/);
  assert.match(G.generate({ kind: 'int', count: 5, min: 10, max: 1 }).error, /μεγαλύτερο από το «Έως»/);
  assert.match(G.generate({ kind: 'int', count: 5, min: 1.5, max: 9 }).error, /ακέραιοι αριθμοί/);
  assert.match(G.generate({ kind: 'int', count: 0, min: 1, max: 9 }).error, /από 1 έως 50/);
  assert.match(G.generate({ kind: 'int', count: 5, min: '', max: 9 }).error, /Από/);
});

test('Γεννήτρια: ονόματα, πόλεις και χώρες χωρίς επαναλήψεις, έως 50', () => {
  for (const kind of ['name', 'fullname', 'city', 'country']) {
    const r = G.generate({ kind, count: 50, unique: true, caps: false, rnd: seeded(5) });
    assert.equal(r.values.length, 50, kind);
    assert.equal(new Set(r.values).size, 50, kind);
  }
});

test('Γεννήτρια: κεφαλαία χωρίς τόνους', () => {
  assert.equal(G.caps('Πτολεμαΐδα'), 'ΠΤΟΛΕΜΑΙΔΑ');
  assert.equal(G.caps('Άγιος Νικόλαος'), 'ΑΓΙΟΣ ΝΙΚΟΛΑΟΣ');
  const r = G.generate({ kind: 'city', count: 50, unique: true, caps: true, rnd: seeded(6) });
  assert.ok(r.values.every((v) => v === G.caps(v)));
});

test('Γεννήτρια: αριθμοί ταυτότητας της μορφής ΑΚ123456', () => {
  const r = G.generate({ kind: 'id', count: 50, unique: true, order: 'asc', rnd: seeded(7) });
  assert.equal(r.values.length, 50);
  assert.ok(r.values.every((v) => /^[ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ]{2}\d{6}$/.test(v)));
  assert.ok(isSorted(r.values, G.comparePython));
});

test('Γεννήτρια: η ταξινόμηση κειμένων συμφωνεί με τη σύγκριση της Python (για δυαδική αναζήτηση)', () => {
  for (const caps of [true, false]) {
    const r = G.generate({ kind: 'fullname', count: 50, unique: true, caps, order: 'asc', rnd: seeded(8) });
    for (let i = 1; i < r.values.length; i++) {
      assert.ok(r.values[i - 1] <= r.values[i], `${r.values[i - 1]} <= ${r.values[i]}`);
    }
  }
});

test('Γεννήτρια: εναλλάξ ομάδες για παράλληλους πίνακες και κείμενο για το αρχείο', () => {
  const names = ['ΑΝΝΑ', 'ΝΙΚΟΣ'];
  const grades = ['18.5', '12'];
  const groups = G.interleave(names.map((v) => [v]), grades);
  assert.deepEqual(groups, [['ΑΝΝΑ', '18.5'], ['ΝΙΚΟΣ', '12']]);
  assert.equal(G.interleave([['α']], ['1', '2']), null, 'διαφορετικό πλήθος');
  const text = G.blockText({ labels: ['2 ονόματα', '2 πραγματικοί'], groups });
  assert.equal(text, '# Εναλλάξ ανά 2 γραμμές: 2 ονόματα | 2 πραγματικοί\nΑΝΝΑ\n18.5\nΝΙΚΟΣ\n12\n');
  assert.deepEqual(G.countLines('# σχόλιο\n5\n\n?\n7\n'), { values: 2, ask: 1 });
});
