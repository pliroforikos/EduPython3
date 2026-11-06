'use strict';
// node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { parseVersion, compareVersions, parseRelease, fetchLatest } = require('../src/main/updateInfo');

test('Εκδόσεις: ανάλυση και σύγκριση αριθμητικά, όχι αλφαβητικά', () => {
  assert.deepEqual(parseVersion('v1.6.1'), [1, 6, 1]);
  assert.equal(parseVersion('κάτι άλλο'), null);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.6.1', 'v1.6.1'), 0);
  assert.equal(compareVersions('1.6', '1.6.1'), -1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('άκυρη', '1.0.0'), 0, 'χωρίς έκδοση δεν προτείνεται ενημέρωση');
});

test('Release: κρατά έκδοση, σημειώσεις και σύνδεσμο· αγνοεί προσχέδια και προδημοσιεύσεις', () => {
  const rel = parseRelease({
    tag_name: 'v1.7.0', name: 'Έκδοση 1.7.0', body: 'Νέα\r\nπράγματα', html_url: 'https://github.com/x/y/releases/tag/v1.7.0',
    assets: [{ name: 'a-setup.exe' }, { name: 'latest.yml' }],
  });
  assert.equal(rel.version, '1.7.0');
  assert.equal(rel.notes, 'Νέα\nπράγματα');
  assert.deepEqual(rel.assets, ['a-setup.exe', 'latest.yml']);
  assert.equal(parseRelease({ tag_name: 'v2.0.0', draft: true }), null);
  assert.equal(parseRelease({ tag_name: 'v2.0.0', prerelease: true }), null);
  assert.equal(parseRelease({ tag_name: 'nightly' }), null);
  assert.equal(parseRelease(null), null);
  assert.ok(parseRelease({ tag_name: 'v1.0', body: 'x'.repeat(2000) }).notes.length <= 701);
});

/** Τοπικός «GitHub»: απαντά στο /repos/o/r/releases/latest. */
function fakeGithub(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

test('fetchLatest: διαβάζει την τελευταία έκδοση από το API', async () => {
  let seen = null;
  const srv = await fakeGithub((req, res) => {
    seen = { url: req.url, ua: req.headers['user-agent'] };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ tag_name: 'v3.1.4', name: 'Τρίτη', body: '', html_url: 'u', assets: [] }));
  });
  try {
    const rel = await fetchLatest('pliroforikos', 'demo', `http://127.0.0.1:${srv.address().port}`);
    assert.equal(rel.version, '3.1.4');
    assert.equal(seen.url, '/repos/pliroforikos/demo/releases/latest');
    assert.ok(seen.ua, 'το GitHub απαιτεί User-Agent');
  } finally {
    srv.close();
  }
});

test('fetchLatest: 404 (δεν υπάρχει release) και κατεστραμμένη απάντηση δίνουν σφάλμα', async () => {
  let mode = 404;
  const srv = await fakeGithub((req, res) => {
    if (mode === 404) { res.statusCode = 404; res.end('{}'); } else { res.end('όχι json'); }
  });
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    await assert.rejects(fetchLatest('a', 'b', base), /404/);
    mode = 200;
    await assert.rejects(fetchLatest('a', 'b', base));
  } finally {
    srv.close();
  }
});

test('fetchLatest: χωρίς σύνδεση απορρίπτεται (δεν κρεμάει)', async () => {
  await assert.rejects(fetchLatest('a', 'b', 'http://127.0.0.1:1'));
});
