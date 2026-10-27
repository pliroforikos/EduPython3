'use strict';
// node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const R = require('../src/renderer/recall.js');

const md = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'recall.md'), 'utf-8');
const cats = R.parse(md);
const topics = cats.flatMap((c) => c.topics);
const PYTHON = process.env.PYTHON27 || 'C:/Python27/python.exe';

test('parse: κατηγορίες, θέματα και μπλοκ', () => {
  const sample = [
    '<!-- σχόλιο -->',
    '# Κατηγορία',
    '## Θέμα',
    '@exams: 2024 Γ',
    '@tags: λέξη',
    'Πρώτη γραμμή',
    'συνέχεια.',
    '',
    '- ένα',
    '- δύο',
    '! προσοχή',
    '> συμβουλή',
    '| α | β |',
    '|---|---|',
    '| 1 | 2 |',
    '```python',
    'x = 1',
    '',
    'print x',
    '```',
    '```output',
    '1',
    '```',
  ].join('\n');
  const [c] = R.parse(sample);
  assert.equal(c.title, 'Κατηγορία');
  const t = c.topics[0];
  assert.equal(t.title, 'Θέμα');
  assert.equal(t.exams, '2024 Γ');
  assert.equal(t.tags, 'λέξη');
  assert.deepEqual(t.blocks.map((b) => b.type), ['p', 'list', 'warn', 'tip', 'table', 'code', 'output']);
  assert.equal(t.blocks[0].text, 'Πρώτη γραμμή συνέχεια.');
  assert.deepEqual(t.blocks[1].items, ['ένα', 'δύο']);
  assert.deepEqual(t.blocks[4].rows, [['α', 'β'], ['1', '2']]);
  assert.equal(t.blocks[5].text, 'x = 1\n\nprint x');
});

test('normalize: χωρίς τόνους και τελικό σίγμα', () => {
  assert.equal(R.normalize('Μέγιστος'), R.normalize('μεγιστοσ'));
});

test('recall.md: υπάρχουν τα βασικά θέματα', () => {
  assert.ok(cats.length >= 8, 'κατηγορίες');
  assert.ok(topics.length >= 35, 'θέματα');
  const titles = topics.map((t) => t.title).join('\n');
  for (const re of [/ακέραιους/, /πραγματικούς/, /εμφανίζω/, /φτιάχνω μια συνάρτηση/, /Παράμετροι/,
    /τιμή τερματισμού/, /Μέγιστο και ελάχιστο/, /Πλήθος/, /Άθροισμα/, /λειτουργεί μια λίστα/,
    /φυσαλίδας/, /Δυαδική/, /αρχείο/, /Κλάση/]) {
    assert.match(titles, re);
  }
  const ids = new Set(topics.map((t) => t.id));
  assert.equal(ids.size, topics.length, 'μοναδικά id');
  for (const t of topics) assert.ok(t.blocks.length, `κενό θέμα: ${t.title}`);
  for (const t of topics) {
    for (const b of t.blocks.filter((x) => x.type === 'table')) {
      const n = b.rows[0].length;
      for (const r of b.rows) assert.equal(r.length, n, `πίνακας με άνισες στήλες στο «${t.title}»: ${r.join(' | ')}`);
    }
  }
});

test('recall.md: κάθε παράδειγμα κώδικα είναι σωστή Python 2.7', { skip: !fs.existsSync(PYTHON) && 'δεν βρέθηκε Python 2.7' }, () => {
  const snippets = topics.flatMap((t) => t.blocks.filter((b) => b.type === 'code').map((b) => ({ title: t.title, code: b.text })));
  assert.ok(snippets.length > 50);
  const script = [
    'import sys, json',
    'bad = []',
    'for s in json.loads(sys.stdin.read()):',
    '    try:',
    '        compile(s["code"] + u"\\n", "<recall>", "exec")',
    '    except SyntaxError as e:',
    '        bad.append(u"%s (γραμμή %s): %s" % (s["title"], e.lineno, e.msg))',
    'sys.stdout.write(json.dumps(bad))',
  ].join('\n');
  const r = spawnSync(PYTHON, ['-c', script], { input: JSON.stringify(snippets), encoding: 'utf-8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), []);
});
