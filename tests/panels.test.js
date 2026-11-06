'use strict';
// node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { findParallel } = require('../src/renderer/panels').Panels;

/** Μεταβλητή όπως τη στέλνει ο runner: απλή λίστα. */
const flat = (name, n, type = 'list') => ({
  name, type, repr: '[…]', len: n, seq: { items: Array.from({ length: n }, (_, i) => String(i)), more: false },
});
/** Πίνακας: λίστα από R λίστες με C στήλες. */
const grid = (name, R, C) => ({
  name, type: 'list', repr: '[[…]]', len: R,
  seq: {
    items: Array.from({ length: R }, () => '[…]'), more: false, cols: C,
    grid: Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => String(i * C + j))),
  },
});

test('Παράλληλες λίστες: λίστες με το ίδιο πλήθος στοιχείων', () => {
  const g = findParallel([flat('onomata', 5), flat('vathmoi', 5), flat('alli', 3), { name: 'i', type: 'int', repr: '2' }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'rows');
  assert.equal(g[0].size, 5);
  assert.deepEqual(g[0].ones.map((v) => v.name), ['onomata', 'vathmoi']);
  assert.deepEqual(g[0].twos, []);
});

test('Παράλληλες λίστες: μία μόνη λίστα δεν είναι παράλληλη με κάτι', () => {
  assert.deepEqual(findParallel([flat('a', 4), flat('b', 3)]), []);
});

test('Παράλληλες λίστες: λίστα με πίνακα στις γραμμές, με επικεφαλίδες στηλών', () => {
  const g = findParallel([flat('onomata', 30), flat('mathimata', 4), grid('vathmoi', 30, 4)]);
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'rows');
  assert.deepEqual(g[0].ones.map((v) => v.name), ['onomata']);
  assert.equal(g[0].twos.length, 1);
  assert.equal(g[0].twos[0].cols, 4);
  assert.deepEqual(g[0].twos[0].colHeads.map((v) => v.name), ['mathimata']);
});

test('Παράλληλες λίστες: πίνακας μόνο με λίστα ίση με τις στήλες του', () => {
  const g = findParallel([flat('mathimata', 4), grid('vathmoi', 10, 4)]);
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'cols');
  assert.equal(g[0].rows, 10);
  assert.deepEqual(g[0].colHeads.map((v) => v.name), ['mathimata']);
});

test('Παράλληλες λίστες: λίστες που κόπηκαν (πολλά στοιχεία) δεν συγκρίνονται', () => {
  const big = flat('a', 5);
  big.seq.more = true;
  assert.deepEqual(findParallel([big, flat('b', 5)]), []);
});
