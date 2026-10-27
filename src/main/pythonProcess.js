'use strict';
// Διαχείριση των διεργασιών Python 3: ο runner (εκτέλεση + Shell) και ο
// checker (ζωντανός έλεγχος σύνταξης). Επικοινωνία με JSON ανά γραμμή.

const { spawn, execFile, execFileSync } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..', '..', 'backend').replace('app.asar', 'app.asar.unpacked');
const RUNNER = path.join(BACKEND_DIR, 'runner.py');
const CHECKER = path.join(BACKEND_DIR, 'checker.py');

const IS_WIN = process.platform === 'win32';

/**
 * Αναζητά κατάλληλη εγκατάσταση Python 3 (3.10 έως 3.14).
 * Σειρά στα Windows:
 *  1. η διαδρομή από τις Ρυθμίσεις (αν έχει οριστεί και υπάρχει)
 *  2. ο py launcher (py -0p), επιλέγεται η νεότερη 3.10+
 *  3. %LOCALAPPDATA%\Programs\Python\Python3*\python.exe
 *  4. C:\Program Files\Python3*\python.exe
 *  5. python.exe στο PATH, εκτός από το stub του Microsoft Store (WindowsApps)
 *
 * Σειρά στο Linux: python3 στο PATH, /usr/bin/python3, νεότερη 3.x του pyenv.
 */
function findPython(configured) {
  if (configured && fs.existsSync(configured)) return configured;

  if (IS_WIN) {
    // 2. py launcher
    const py = findViaPyLauncher();
    if (py) return py;

    // 3. %LOCALAPPDATA%\Programs\Python\Python3*\python.exe
    const localPy = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python');
    const fromLocal = findInPythonDir(localPy);
    if (fromLocal.length) return fromLocal[0];

    // 4. Program Files\Python3*\python.exe
    const progFiles = [process.env.ProgramFiles, 'C:\\Program Files', process.env['ProgramFiles(x86)']]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    for (const pf of progFiles) {
      const fromPf = findInPythonDir(pf);
      if (fromPf.length) return fromPf[0];
    }

    // 5. python.exe στο PATH, εκτός από το Microsoft Store stub (WindowsApps)
    const onPath = findPythonOnPathWin();
    if (onPath) return onPath;
  } else {
    // Linux
    const onPath = findPythonOnPathLinux();
    if (onPath) return onPath;

    if (fs.existsSync('/usr/bin/python3')) return '/usr/bin/python3';

    const fromPyenv = findPythonPyenv();
    if (fromPyenv) return fromPyenv;
  }

  return configured || null;
}

function findViaPyLauncher() {
  try {
    const out = execFileSync('py', ['-0p'], { encoding: 'utf-8', timeout: 3000, windowsHide: true });
    const list = [];
    for (const line of out.split('\n')) {
      const m = /^\s*-V:(\d+)\.(\d+)(?:-\d+)?\s*\*?\s+(.+)$/.exec(line.trim());
      if (!m) continue;
      const major = Number(m[1]), minor = Number(m[2]), p = m[3].trim();
      if (major === 3 && minor >= 10 && fs.existsSync(p)) {
        list.push({ minor, path: p });
      }
    }
    list.sort((a, b) => b.minor - a.minor);
    return list.length ? list[0].path : null;
  } catch (_) {
    return null;
  }
}

function findInPythonDir(baseDir) {
  try {
    if (!fs.existsSync(baseDir)) return [];
    return fs.readdirSync(baseDir)
      .filter((d) => /^Python3(\d+)/i.test(d))
      .map((d) => {
        const m = /^Python3(\d+)/i.exec(d);
        return { minor: Number(m[1]), exe: path.join(baseDir, d, 'python.exe') };
      })
      .filter((item) => item.minor >= 10 && fs.existsSync(item.exe))
      .sort((a, b) => b.minor - a.minor)
      .map((item) => item.exe);
  } catch (_) {
    return [];
  }
}

function findPythonOnPathWin() {
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    if (/WindowsApps/i.test(dir)) continue;
    const exe = path.join(dir, 'python.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function findPythonOnPathLinux() {
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const exe = path.join(dir, 'python3');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function findPythonPyenv() {
  const pyenv = path.join(os.homedir(), '.pyenv', 'versions');
  try {
    const v = fs.readdirSync(pyenv)
      .filter((d) => /^3\.(1[0-9]|[2-9][0-9])\.\d+$/.test(d))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      .pop();
    if (v) {
      const exe = path.join(pyenv, v, 'bin', 'python3');
      if (fs.existsSync(exe)) return exe;
    }
  } catch (_) { /* χωρίς pyenv */ }
  return null;
}

function cleanEnv() {
  const env = { ...process.env };
  for (const k of ['PYTHONHOME', 'PYTHONPATH', 'PYTHONSTARTUP', 'PYTHONUSERBASE', 'VIRTUAL_ENV']) delete env[k];
  env.PYTHONDONTWRITEBYTECODE = '1';
  env.PYTHONUTF8 = '1';
  env.PYTHONIOENCODING = 'utf-8';
  if (!IS_WIN && !/utf-?8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || '')) env.LC_ALL = 'C.UTF-8';
  return env;
}

function pythonVersion(pythonPath) {
  return new Promise((resolve) => {
    if (!pythonPath || !fs.existsSync(pythonPath)) return resolve({ ok: false, error: 'notfound' });
    const code = 'import sys; tk=0\ntry:\n import tkinter; tk=1\nexcept:\n pass\nsys.stdout.write(sys.version.split()[0] + chr(32) + str(tk))';
    execFile(pythonPath, ['-c', code],
      { env: cleanEnv(), timeout: 8000, windowsHide: true }, (err, stdout) => {
        if (err) return resolve({ ok: false, error: 'failed', detail: String(err.message || err) });
        const parts = String(stdout).trim().split(' ');
        const version = parts[0] || '';
        const tk = parts[1] === '1';
        if (!version.startsWith('3.')) {
          return resolve({ ok: false, version, tk: false, error: 'notpy3' });
        }
        const vparts = version.split('.').map(Number);
        const minor = vparts[1] || 0;
        if (minor < 10) {
          return resolve({ ok: false, version, tk, error: 'tooold' });
        }
        resolve({ ok: true, version, tk, error: null });
      });
  });
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  try {
    if (IS_WIN) {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
    } else {
      proc.kill('SIGKILL');
    }
  } catch (_) {
    try { proc.kill(); } catch (__) { /* ήδη τερματίστηκε */ }
  }
}

function lineReader(onLine) {
  let buf = '';
  return (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line) onLine(line);
    }
  };
}

/**
 * Ο runner. Κάθε Εκτέλεση ξεκινά νέα διεργασία (όπως ο Thonny). Μηνύματα από
 * παλιές διεργασίες αγνοούνται μέσω του αριθμού γενιάς.
 */
class Backend extends EventEmitter {
  constructor(getPython) {
    super();
    this.getPython = getPython;
    this.proc = null;
    this.gen = 0;
  }

  _spawn(firstCmd) {
    this._kill();
    const gen = ++this.gen;
    const python = this.getPython();
    if (!python || !fs.existsSync(python)) {
      this.emit('message', { type: 'no_python', path: python });
      return;
    }
    let proc;
    try {
      proc = spawn(python, ['-u', '-B', RUNNER], {
        cwd: firstCmd.cwd || (firstCmd.path ? path.dirname(firstCmd.path) : undefined),
        env: cleanEnv(),
        windowsHide: true,
      });
    } catch (e) {
      this.emit('message', { type: 'no_python', path: python, detail: String(e) });
      return;
    }
    this.proc = proc;
    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', lineReader((line) => {
      if (gen !== this.gen) return;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { msg = { type: 'out', stream: 'stdout', text: line + '\n' }; }
      this.emit('message', msg);
    }));
    // ό,τι γράφεται απευθείας στο fd (π.χ. os.system) έρχεται εδώ σε UTF-8
    const errDecoder = new TextDecoder('utf-8');
    proc.stderr.on('data', (chunk) => {
      if (gen !== this.gen) return;
      const text = errDecoder.decode(chunk, { stream: true });
      if (text) this.emit('message', { type: 'out', stream: 'stdout', text });
    });
    proc.on('error', (e) => {
      if (gen !== this.gen) return;
      this.emit('message', { type: 'no_python', path: python, detail: String(e) });
    });
    proc.on('exit', (code) => {
      if (gen !== this.gen) return;
      this.proc = null;
      this.emit('message', { type: 'exit', code });
    });
    proc.stdin.on('error', () => { /* η διεργασία έκλεισε */ });
    this._send(firstCmd);
  }

  _send(obj) {
    if (this.proc && this.proc.stdin.writable) this.proc.stdin.write(JSON.stringify(obj) + '\n');
  }

  _kill() {
    if (this.proc) {
      const p = this.proc;
      this.proc = null;
      p.removeAllListeners('exit');
      killTree(p);
    }
  }

  /** trace: null για κανονική εκτέλεση, ή { mode: 'step' | 'auto', delay } για βήμα-βήμα. */
  run({ path: filePath, source, encoding, trace }) {
    this._spawn({ cmd: 'run', path: filePath, source, encoding, trace: trace || null, cwd: filePath ? path.dirname(filePath) : undefined });
  }

  shell({ cwd, encoding }) {
    this._spawn({ cmd: 'shell', cwd, encoding });
  }

  input(text) { this._send({ cmd: 'input', text }); }
  repl(line) { this._send({ cmd: 'repl', line }); }
  trace(opts) { this._send({ cmd: 'trace', ...opts }); }
  step() { this._send({ cmd: 'step' }); }

  stop() {
    this.gen++;
    this._kill();
  }

}

/** Μόνιμη διεργασία για έλεγχο σύνταξης καθώς γράφει ο μαθητής. */
class Checker {
  constructor(getPython) {
    this.getPython = getPython;
    this.proc = null;
    this.pending = new Map();
    this.nextId = 1;
    this.failures = 0;
  }

  _ensure() {
    if (this.proc) return true;
    const python = this.getPython();
    if (!python || !fs.existsSync(python) || this.failures > 3) return false;
    try {
      this.proc = spawn(python, ['-u', '-B', CHECKER], { env: cleanEnv(), windowsHide: true });
    } catch (_) {
      this.failures++;
      return false;
    }
    const proc = this.proc;
    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', lineReader((line) => {
      let msg;
      try { msg = JSON.parse(line); } catch (_) { return; }
      const cb = this.pending.get(msg.id);
      if (cb) { this.pending.delete(msg.id); cb(msg); }
    }));
    proc.stdin.on('error', () => {});
    const onGone = () => {
      if (this.proc === proc) this.proc = null;
      this.failures++;
      for (const cb of this.pending.values()) cb(null);
      this.pending.clear();
    };
    proc.on('exit', onGone);
    proc.on('error', onGone);
    return true;
  }

  check(source, encoding, greekNames) {
    return new Promise((resolve) => {
      if (!this._ensure()) return resolve(null);
      const id = this.nextId++;
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) resolve(null);
      }, 4000);
      this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      this.proc.stdin.write(JSON.stringify({ id, source, encoding, greekNames }) + '\n');
    });
  }

  reset() {
    this.failures = 0;
    if (this.proc) killTree(this.proc);
    this.proc = null;
  }

  dispose() { this.reset(); }
}

module.exports = { Backend, Checker, findPython, pythonVersion, cleanEnv };
