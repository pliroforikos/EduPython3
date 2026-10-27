'use strict';
// Διαχείριση των διεργασιών Python 2.7: ο runner (εκτέλεση + Shell) και ο
// checker (ζωντανός έλεγχος σύνταξης). Επικοινωνία με JSON ανά γραμμή.

const { spawn, execFile } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..', '..', 'backend').replace('app.asar', 'app.asar.unpacked');
const RUNNER = path.join(BACKEND_DIR, 'runner.py');
const CHECKER = path.join(BACKEND_DIR, 'checker.py');

const IS_WIN = process.platform === 'win32';

const PYTHON_CANDIDATES = IS_WIN ? [
  'C:\\Python27\\python.exe',
  'C:\\Program Files\\Python27\\python.exe',
  'C:\\Program Files (x86)\\Python27\\python.exe',
  'D:\\Python27\\python.exe',
] : [
  '/usr/bin/python2.7',
  '/usr/bin/python2',
  '/usr/local/bin/python2.7',
  '/opt/python2.7/bin/python2.7',   // εγκατάσταση με το scripts/install-python27-linux.sh
];

function findPython(configured) {
  if (configured && fs.existsSync(configured)) return configured;
  return PYTHON_CANDIDATES.find((p) => fs.existsSync(p)) || (IS_WIN ? null : findPythonOnPath()) || configured || null;
}

/** Linux: python2.7 / python2 στο PATH ή η νεότερη 2.7.x του pyenv. */
function findPythonOnPath() {
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const name of ['python2.7', 'python2']) {
      if (fs.existsSync(path.join(dir, name))) return path.join(dir, name);
    }
  }
  const pyenv = path.join(os.homedir(), '.pyenv', 'versions');
  try {
    const v = fs.readdirSync(pyenv).filter((d) => /^2\.7\.\d+$/.test(d))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).pop();
    if (v) return path.join(pyenv, v, 'bin', 'python2.7');
  } catch (_) { /* χωρίς pyenv */ }
  return null;
}

function cleanEnv() {
  const env = { ...process.env };
  // μεταβλητές μιας εγκατάστασης Python 3 μπορεί να χαλάσουν την Python 2
  for (const k of ['PYTHONHOME', 'PYTHONPATH', 'PYTHONSTARTUP', 'PYTHONUSERBASE', 'VIRTUAL_ENV']) delete env[k];
  env.PYTHONDONTWRITEBYTECODE = '1';
  // Linux: η Python 2 κωδικοποιεί τα ονόματα αρχείων με το locale. Χωρίς UTF-8 locale (π.χ. LANG=C),
  // διαδρομές όπως ~/Έγγραφα/Python2 δεν θα μπορούσαν να ανοίξουν.
  if (!IS_WIN && !/utf-?8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || '')) env.LC_ALL = 'C.UTF-8';
  return env;
}

function pythonVersion(pythonPath) {
  return new Promise((resolve) => {
    if (!pythonPath || !fs.existsSync(pythonPath)) return resolve({ ok: false, error: 'notfound' });
    execFile(pythonPath, ['-c', 'import sys; sys.stdout.write(sys.version.split()[0])'],
      { env: cleanEnv(), timeout: 8000, windowsHide: true }, (err, stdout) => {
        if (err) return resolve({ ok: false, error: 'failed', detail: String(err.message || err) });
        const version = String(stdout).trim();
        resolve({ ok: version.startsWith('2.'), version, error: version.startsWith('2.') ? null : 'notpy2' });
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
    // ό,τι γράφεται απευθείας στο fd (π.χ. os.system) έρχεται εδώ, στην κωδικοποίηση του συστήματος
    const errDecoder = new TextDecoder(IS_WIN ? 'windows-1253' : 'utf-8');
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

  check(source, encoding) {
    return new Promise((resolve) => {
      if (!this._ensure()) return resolve(null);
      const id = this.nextId++;
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) resolve(null);
      }, 4000);
      this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      this.proc.stdin.write(JSON.stringify({ id, source, encoding }) + '\n');
    });
  }

  reset() {
    this.failures = 0;
    if (this.proc) killTree(this.proc);
    this.proc = null;
  }

  dispose() { this.reset(); }
}

module.exports = { Backend, Checker, findPython, pythonVersion };
