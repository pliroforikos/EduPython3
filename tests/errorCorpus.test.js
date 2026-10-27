'use strict';
// node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const H = require('../src/renderer/errorHelp');
const { findPython } = require('../src/main/pythonProcess');

function findInstalledPython3s() {
  const pythons = new Set();
  const mainPy = findPython();
  if (mainPy && fs.existsSync(mainPy)) pythons.add(path.normalize(mainPy));

  if (process.platform === 'win32') {
    try {
      const res = spawnSync('py', ['-0p'], { encoding: 'utf-8' });
      if (res.status === 0 && res.stdout) {
        for (const line of res.stdout.split('\n')) {
          const match = line.match(/-V:(3\.\d+)\s*\*?\s*(.+)$/);
          if (match) {
            const ver = parseFloat(match[1]);
            const p = path.normalize(match[2].trim());
            if (ver >= 3.10 && fs.existsSync(p) && !p.toLowerCase().includes('windowsapps')) {
              pythons.add(p);
            }
          }
        }
      }
    } catch (_) {}
  } else {
    for (const bin of ['python3.10', 'python3.11', 'python3.12', 'python3.13', 'python3.14', 'python3']) {
      try {
        const res = spawnSync('which', [bin], { encoding: 'utf-8' });
        if (res.status === 0 && res.stdout.trim()) {
          const p = path.normalize(res.stdout.trim());
          if (fs.existsSync(p)) pythons.add(p);
        }
      } catch (_) {}
    }
  }

  return Array.from(pythons);
}

const installedPythons = findInstalledPython3s();
const errorsDir = path.join(__dirname, 'errors');
const errorFiles = fs.readdirSync(errorsDir).filter((f) => f.endsWith('.py')).sort();
const runnerPath = path.resolve(__dirname, '../backend/runner.py');

function runCorpusFile(pyBin, file) {
  return new Promise((resolve) => {
    const raw = fs.readFileSync(path.join(errorsDir, file), 'utf-8');
    const match = raw.match(/^# rule: ([^\r\n]+)/);
    const expected = match ? match[1].trim() : null;

    const py = spawn(pyBin, [runnerPath], {
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    });

    let buf = '';
    let foundError = null;

    py.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'error') foundError = msg;
          if (msg.type === 'prompt' || msg.type === 'done') {
            py.kill();
            break;
          }
        } catch (_) {}
      }
    });

    py.on('close', () => {
      if (!foundError) {
        return resolve({ file, ok: false, reason: 'δεν εκπέμφθηκε σφάλμα' });
      }
      const exp = H.explain(foundError, { lines: raw.split('\n') });
      resolve({
        file,
        ok: exp.ruleId === expected,
        expected,
        actual: exp.ruleId,
        errorMsg: foundError.message,
        excType: foundError.exc_type,
      });
    });

    py.stdin.write(JSON.stringify({ cmd: 'run', source: raw, filename: file }) + '\n');
  });
}

test('εύρεση εγκατεστημένων εκδόσεων Python 3', () => {
  assert.ok(installedPythons.length >= 1, 'Πρέπει να βρεθεί τουλάχιστον μία Python 3 (3.10+)');
});

test('ύπαρξη αρχείων corpus', () => {
  assert.ok(errorFiles.length >= 60, `Αναμένονταν τουλάχιστον 60 αρχεία σφαλμάτων, βρέθηκαν ${errorFiles.length}`);
});

for (const pyBin of installedPythons) {
  test(`corpus σφαλμάτων (${pyBin})`, async () => {
    const results = [];
    const queue = [...errorFiles];
    const concurrency = 8;
    const workers = Array(concurrency).fill(null).map(async () => {
      while (queue.length > 0) {
        const file = queue.shift();
        results.push(await runCorpusFile(pyBin, file));
      }
    });
    await Promise.all(workers);

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      assert.fail(`Απέτυχαν ${failed.length} / ${results.length} αρχεία στο ${pyBin}:\n` +
        failed.map((f) => `  - ${f.file}: αναμενόταν ${f.expected}, βρέθηκε ${f.actual} (${f.excType}: ${f.errorMsg})`).join('\n'));
    }
    assert.strictEqual(failed.length, 0);
  });
}
