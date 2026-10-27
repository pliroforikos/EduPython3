'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { findPython, pythonVersion, cleanEnv } = require('../src/main/pythonProcess');

test('findPython βρίσκει Python 3 (3.10+)', () => {
  const py = findPython();
  assert.ok(py, 'Πρέπει να βρεθεί εκτελέσιμο Python');
  assert.ok(fs.existsSync(py), `Το αρχείο ${py} πρέπει να υπάρχει`);
  assert.doesNotMatch(py, /WindowsApps/i, 'Δεν πρέπει να επιλεγεί το WindowsApps stub');
});

test('findPython προτιμά την ρυθμισμένη διαδρομή αν υπάρχει', () => {
  const current = findPython();
  assert.strictEqual(findPython(current), current);
});

test('cleanEnv αφαιρεί επικίνδυνες μεταβλητές και ορίζει UTF-8', () => {
  const oldEnv = {
    PYTHONHOME: 'C:\\fake',
    PYTHONPATH: 'C:\\fake',
    PYTHONSTARTUP: 'C:\\fake',
    PYTHONUSERBASE: 'C:\\fake',
    VIRTUAL_ENV: 'C:\\fake',
    PATH: process.env.PATH,
  };
  const prevEnv = process.env;
  try {
    process.env = { ...prevEnv, ...oldEnv };
    const cleaned = cleanEnv();
    assert.strictEqual(cleaned.PYTHONHOME, undefined);
    assert.strictEqual(cleaned.PYTHONPATH, undefined);
    assert.strictEqual(cleaned.PYTHONSTARTUP, undefined);
    assert.strictEqual(cleaned.PYTHONUSERBASE, undefined);
    assert.strictEqual(cleaned.VIRTUAL_ENV, undefined);
    assert.strictEqual(cleaned.PYTHONUTF8, '1');
    assert.strictEqual(cleaned.PYTHONIOENCODING, 'utf-8');
    assert.strictEqual(cleaned.PYTHONDONTWRITEBYTECODE, '1');
  } finally {
    process.env = prevEnv;
  }
});

test('pythonVersion αναγνωρίζει έγκυρη Python 3', async () => {
  const py = findPython();
  const res = await pythonVersion(py);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.error, null);
  assert.match(res.version, /^3\.(1[0-9]|[2-9][0-9])\./);
  assert.strictEqual(typeof res.tk, 'boolean');
});

test('pythonVersion απορρίπτει ανύπαρκτη διαδρομή', async () => {
  const res = await pythonVersion('C:\\non_existent_python_path_12345\\python.exe');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'notfound');
});

test('pythonVersion απορρίπτει Python 2 ως notpy3', async () => {
  const py2 = 'C:\\Python27\\python.exe';
  if (fs.existsSync(py2)) {
    const res = await pythonVersion(py2);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, 'notpy3');
    assert.match(res.version, /^2\./);
  }
});
