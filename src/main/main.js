'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, Notification, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Backend, Checker, findPython, pythonVersion } = require('./pythonProcess');
const { decodeBuffer, encodeForSave } = require('./encoding');
const { buildMenu, examplesDir } = require('./menu');
const { TeacherServer, StudentClient, loadTrust, buildTrustFile, trustFilePath, lanAddresses, newPin, teacherModeAllowed } = require('./classroom');
const { generateIdentity, fingerprint } = require('./classroomCert');

const DEFAULT_SETTINGS = {
  pythonPath: '',
  fontSize: 16,
  theme: 'light',
  stringEncoding: 'cp1253',
  saveBeforeRun: true,
  minimap: true,
  wordWrap: false,
  showWhitespace: false,
  showVariables: true,
  showAssistant: true,
  showRecall: false,
  runSpeed: 'normal',
  liveCheck: true,
  openFiles: [],
  activeFile: null,
  recentFiles: [],
  layout: {},
  window: { width: 1300, height: 840, maximized: false },
  classroom: { studentName: '', teacherName: '', room: '' },
};

let win = null;
function debugLog(...a) {
  const line = a.map(String).join(' ');
  if (process.env.EPAL_LOG) fs.appendFileSync(process.env.EPAL_LOG, line + String.fromCharCode(10));
  else console.log(line);
}
let settings = { ...DEFAULT_SETTINGS };
let forceClose = false;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    const data = JSON.parse(fs.readFileSync(settingsFile(), 'utf-8'));
    settings = { ...DEFAULT_SETTINGS, ...data };
  } catch (_) {
    settings = { ...DEFAULT_SETTINGS };
  }
  settings.pythonPath = findPython(settings.pythonPath) || '';
}

let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
      fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf-8');
    } catch (_) { /* μη κρίσιμο */ }
  }, 300);
}

function workDir() {
  const dir = path.join(app.getPath('documents'), 'EduPython3');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* υπάρχει */ }
  return dir;
}

const getPython = () => settings.pythonPath;
const backend = new Backend(getPython);
const checker = new Checker(getPython);

backend.on('message', (msg) => {
  if (win && !win.isDestroyed()) win.webContents.send('backend', msg);
});

// --- Παραδείγματα ------------------------------------------------------------
function listExamples() {
  const dir = examplesDir.replace('app.asar', 'app.asar.unpacked');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.py')).sort(); } catch (_) { return []; }
  return files.map((file) => {
    let title = file.replace(/\.py$/, '');
    try {
      const { text } = decodeBuffer(fs.readFileSync(path.join(dir, file)));
      const m = /^#\s*Παράδειγμα:\s*(.+)$/m.exec(text);
      if (m) title = m[1].trim();
    } catch (_) { /* χρησιμοποιούμε το όνομα αρχείου */ }
    return { file: path.join(dir, file), title };
  });
}

/** Αντιγράφει το παράδειγμα στον φάκελο Έγγραφα\EduPython3\Παραδείγματα (για να μη χαλάσει το πρωτότυπο). */
function copyExample(src) {
  const dir = path.join(workDir(), 'Παραδείγματα');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, path.basename(src));
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  return dest;
}

// --- Μενού -------------------------------------------------------------------
function sendMenu(id, arg) {
  if (win && !win.isDestroyed()) win.webContents.send('menu', id, arg);
}

function refreshMenu() {
  Menu.setApplicationMenu(buildMenu({
    send: sendMenu,
    settings,
    examples: listExamples(),
    recent: settings.recentFiles,
    openRecent: (p) => sendMenu('openPath', p),
    classroom: studentStatus,
    teacherMode: teacherAllowed(),
    present: teacher ? presentState : null,
    setPresent,
  }));
}

function addRecent(p) {
  settings.recentFiles = [p, ...settings.recentFiles.filter((x) => x.toLowerCase() !== p.toLowerCase())].slice(0, 12);
  saveSettings();
  refreshMenu();
}

// --- Αρχεία ------------------------------------------------------------------
function readSource(p) {
  const buf = fs.readFileSync(p);
  const { text, encoding } = decodeBuffer(buf);
  return { path: p, content: text, encoding };
}

const PY_FILTERS = [
  { name: 'Προγράμματα Python', extensions: ['py', 'pyw'] },
  { name: 'Κείμενο', extensions: ['txt', 'csv', 'dat'] },
  { name: 'Όλα τα αρχεία', extensions: ['*'] },
];

function writeSource(p, content) {
  const enc = encodeForSave(content);
  if (enc.error) {
    return {
      ok: false,
      error: `Ο χαρακτήρας «${enc.char}» (γραμμή ${enc.line}) δεν υπάρχει στην κωδικοποίηση ${enc.encoding} ` +
        'που δηλώνει το αρχείο στην πρώτη γραμμή (coding). Άλλαξε τη δήλωση σε utf-8 ή αφαίρεσε τον χαρακτήρα.',
    };
  }
  try {
    fs.writeFileSync(p, enc.buffer);
  } catch (e) {
    return { ok: false, error: `Δεν ήταν δυνατή η αποθήκευση: ${e.message}` };
  }
  addRecent(p);
  return { ok: true, path: p, encoding: enc.encoding };
}

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Άνοιγμα προγράμματος',
    defaultPath: workDir(),
    filters: PY_FILTERS,
    properties: ['openFile', 'multiSelections'],
  });
  if (r.canceled) return [];
  return r.filePaths.map((p) => { const s = readSource(p); addRecent(p); return s; });
});

ipcMain.handle('file:read', (_e, p) => {
  try { return readSource(p); } catch (e) { return { error: e.message }; }
});

ipcMain.handle('file:save', (_e, p, content) => writeSource(p, content));

ipcMain.handle('file:saveAs', async (_e, content, suggested) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Αποθήκευση προγράμματος',
    defaultPath: suggested && path.isAbsolute(suggested) ? suggested : path.join(workDir(), suggested || 'πρόγραμμα.py'),
    filters: PY_FILTERS,
  });
  if (r.canceled || !r.filePath) return null;
  let p = r.filePath;
  if (!path.extname(p)) p += '.py';
  return writeSource(p, content);
});

ipcMain.handle('file:exists', (_e, p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } });
ipcMain.handle('example:open', (_e, src) => {
  try { const dest = copyExample(src); addRecent(dest); return readSource(dest); } catch (e) { return { error: e.message }; }
});

ipcMain.handle('dialog:unsaved', async (_e, names) => {
  const r = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Μη αποθηκευμένες αλλαγές',
    message: names.length === 1
      ? `Το «${names[0]}» έχει αλλαγές που δεν αποθηκεύτηκαν.`
      : `Υπάρχουν αλλαγές που δεν αποθηκεύτηκαν σε ${names.length} αρχεία:\n${names.join('\n')}`,
    detail: 'Θέλεις να τις αποθηκεύσεις;',
    buttons: ['Αποθήκευση', 'Χωρίς αποθήκευση', 'Άκυρο'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  return ['save', 'discard', 'cancel'][r.response];
});

ipcMain.handle('dialog:message', (_e, opts) => dialog.showMessageBox(win, { noLink: true, ...opts }));

ipcMain.handle('dialog:choosePython', async () => {
  const isWin = process.platform === 'win32';
  const r = await dialog.showOpenDialog(win, {
    title: isWin ? 'Επιλογή python.exe (Python 2.7)' : 'Επιλογή Python 2.7 (π.χ. /usr/bin/python2.7)',
    defaultPath: settings.pythonPath || (isWin ? 'C:\\' : '/usr/bin'),
    filters: isWin ? [{ name: 'python.exe', extensions: ['exe'] }] : [],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

// --- Ρυθμίσεις / Python ---------------------------------------------------------
ipcMain.handle('settings:get', () => ({ ...settings }));
ipcMain.handle('settings:set', (_e, patch) => {
  const pythonChanged = patch.pythonPath !== undefined && patch.pythonPath !== settings.pythonPath;
  settings = { ...settings, ...patch };
  saveSettings();
  if (['theme', 'minimap', 'wordWrap', 'showWhitespace', 'showVariables', 'showAssistant', 'showRecall', 'runSpeed', 'stringEncoding']
    .some((k) => k in patch)) refreshMenu();
  if (pythonChanged) checker.reset();
  return settings;
});
ipcMain.handle('recall:get', () => fs.readFileSync(path.join(__dirname, '..', 'renderer', 'recall.md'), 'utf-8'));
ipcMain.handle('python:info', () => {
  // αν η Python 2.7 εγκαταστάθηκε μετά την πρώτη εκκίνηση, βρίσκεται τώρα
  if (!settings.pythonPath || !fs.existsSync(settings.pythonPath)) {
    const found = findPython('');
    if (found) { settings.pythonPath = found; saveSettings(); }
  }
  return pythonVersion(settings.pythonPath).then((v) => ({ ...v, path: settings.pythonPath, installScript: linuxInstallScript() }));
});

/** Linux: το script εγκατάστασης της Python 2.7 που συνοδεύει τα πακέτα (resources/install-python27.sh). */
function linuxInstallScript() {
  if (process.platform !== 'linux') return null;
  const p = path.join(process.resourcesPath, 'install-python27.sh');
  return fs.existsSync(p) ? p : null;
}
ipcMain.handle('python:test', (_e, p) => pythonVersion(p));

// --- Εκτέλεση -------------------------------------------------------------------
ipcMain.on('backend:run', (_e, { path: p, source, trace }) => {
  backend.run({ path: p, source, encoding: settings.stringEncoding, trace });
});
ipcMain.on('backend:trace', (_e, opts) => backend.trace(opts));
ipcMain.on('backend:step', () => backend.step());
ipcMain.on('backend:shell', () => backend.shell({ cwd: workDir(), encoding: settings.stringEncoding }));
ipcMain.on('backend:stop', () => backend.stop());
ipcMain.on('backend:input', (_e, text) => backend.input(text));
ipcMain.on('backend:repl', (_e, line) => backend.repl(line));
ipcMain.handle('check', (_e, source) => checker.check(source, settings.stringEncoding));

ipcMain.on('app:closeNow', () => { forceClose = true; if (win) win.close(); });

// --- Τάξη: μαθητής ----------------------------------------------------------------
let student = null;
let studentStatus = { state: 'off' };

function onStudentStatus(status) {
  studentStatus = status;
  if (win && !win.isDestroyed()) win.webContents.send('classroom', status);
  refreshMenu();
}

ipcMain.handle('classroom:info', () => {
  const trust = loadTrust();
  return {
    ok: trust.ok,
    file: trust.file,
    error: trust.error || null,
    detail: trust.detail || null,
    teachers: trust.ok ? trust.teachers.map((t) => ({ name: t.name, room: t.room })) : [],
    name: settings.classroom.studentName || os.userInfo().username,
    status: studentStatus,
  };
});

ipcMain.handle('classroom:join', (_e, { name, pin }) => {
  const trust = loadTrust();
  if (!trust.ok) return { ok: false, error: trust.error };
  if (student) student.stop();
  name = String(name || '').trim().slice(0, 80) || os.userInfo().username;
  settings.classroom = { ...settings.classroom, studentName: name };
  saveSettings();
  student = new StudentClient({ trust, name, pin: String(pin || '').trim() });
  student.on('status', onStudentStatus);
  student.on('present', (p) => { if (win && !win.isDestroyed()) win.webContents.send('present', p); });
  student.on('present-out', (o) => { if (win && !win.isDestroyed()) win.webContents.send('present-out', o); });
  student.start();
  return { ok: true };
});
ipcMain.on('classroom:leave', () => { if (student) student.leave(); student = null; });
ipcMain.on('classroom:code', (_e, payload) => { if (student) student.sendCode(payload || {}); });
ipcMain.on('classroom:hand', (_e, up) => { if (student) student.setHand(!!up); });
ipcMain.on('classroom:teacher', () => { if (teacherAllowed()) openTeacherWindow(); });

// --- Τάξη: καθηγητής ---------------------------------------------------------------
let teacherWin = null;
let teacher = null;

/** Το κλειδί του καθηγητή φτιάχνεται μία φορά και μένει στο προφίλ του (το αποτύπωμά του είναι στο classroom.json). */
function teacherIdentity() {
  const file = path.join(app.getPath('userData'), 'classroom-teacher.json');
  try {
    const id = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { keyPem: id.keyPem, certPem: id.certPem, fingerprint: fingerprint(id.keyPem) };
  } catch (_) { /* νέα ταυτότητα */ }
  const id = generateIdentity();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ keyPem: id.keyPem, certPem: id.certPem }, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return id;
}

/** Το αποτύπωμα του κλειδιού του καθηγητή αυτού του υπολογιστή, χωρίς να φτιαχτεί νέο κλειδί (ή null). */
function ownTeacherFingerprint() {
  try {
    return fingerprint(JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'classroom-teacher.json'), 'utf-8')).keyPem);
  } catch (_) {
    return null;
  }
}

/** Όχι λειτουργία καθηγητή σε υπολογιστή μαθητή (με classroom.json που δεν έχει το κλειδί αυτού του υπολογιστή). */
const teacherAllowed = () => teacherModeAllowed(loadTrust(), ownTeacherFingerprint());

function sendTeacher(type, data) {
  if (teacherWin && !teacherWin.isDestroyed()) teacherWin.webContents.send('teacher', type, data);
}

function stopTeacher() {
  if (teacher) teacher.stop();
  teacher = null;
  setPresent({ on: false });
}

// Παρουσίαση: οι μαθητές βλέπουν την ενεργή καρτέλα του κύριου παραθύρου του καθηγητή και την έξοδό της.
let presentState = { on: false, locked: false, copy: true };

function setPresent(patch) {
  const next = { ...presentState, ...patch };
  if (!teacher) next.on = false;
  if (!next.on) next.locked = false;   // κάθε νέα παρουσίαση ξεκινά χωρίς κλείδωμα
  const started = next.on && !presentState.on;
  presentState = next;
  if (teacher) {
    if (next.on) teacher.present({ ...(started ? { on: true } : {}), locked: next.locked, copy: next.copy });
    else teacher.present({ on: false });
  }
  // το κύριο παράθυρο στέλνει τον κώδικα και την έξοδο όσο η παρουσίαση είναι ανοιχτή (στο ξεκίνημα: όλα από την αρχή)
  if (win && !win.isDestroyed()) win.webContents.send('present-state', { ...presentState, started });
  sendTeacher('present', presentState);
  refreshMenu();
}

const fromMain = (e) => !!win && !win.isDestroyed() && e.sender === win.webContents;
ipcMain.on('present:code', (e, payload) => {
  if (!fromMain(e) || !teacher || !presentState.on || !payload || typeof payload !== 'object') return;
  const { file, text, view } = payload;   // ό,τι άλλο (on, locked, copy) το ορίζει μόνο το setPresent
  teacher.present({ ...(file !== undefined ? { file } : {}), ...(text !== undefined ? { text } : {}), ...(view !== undefined ? { view } : {}) });
});
ipcMain.on('present:out', (e, out) => { if (fromMain(e) && teacher && presentState.on) teacher.presentOutput(out); });
ipcMain.on('present:set', (e, patch) => {
  if ((fromMain(e) || fromTeacher(e)) && patch && typeof patch === 'object') {
    setPresent({ ...('on' in patch ? { on: !!patch.on } : {}), ...('locked' in patch ? { locked: !!patch.locked } : {}), ...('copy' in patch ? { copy: !!patch.copy } : {}) });
  }
});

function openTeacherWindow() {
  if (!teacherAllowed()) return;
  if (teacherWin && !teacherWin.isDestroyed()) { teacherWin.focus(); return; }
  teacherWin = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 700,
    minHeight: 480,
    title: 'Τάξη – EduPython3',
    backgroundColor: settings.theme === 'dark' ? '#1e1f22' : '#ffffff',
    icon: path.join(__dirname, '..', 'renderer', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  teacherWin.setMenu(null);
  teacherWin.loadFile(path.join(__dirname, '..', 'renderer', 'teacher.html'));
  teacherWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  teacherWin.webContents.on('will-navigate', (e) => e.preventDefault());
  teacherWin.on('closed', () => { stopTeacher(); teacherWin = null; });
}

const fromTeacher = (e) => !!teacherWin && !teacherWin.isDestroyed() && e.sender === teacherWin.webContents;

ipcMain.handle('teacher:defaults', () => ({
  name: settings.classroom.teacherName || os.userInfo().username,
  room: settings.classroom.room || '',
}));

ipcMain.handle('teacher:start', async (e, { name, room }) => {
  if (!fromTeacher(e) || !teacherAllowed()) return { ok: false, error: 'Σε υπολογιστή μαθητή δεν υπάρχει λειτουργία καθηγητή.' };
  settings.classroom = { ...settings.classroom, teacherName: String(name || '').trim(), room: String(room || '').trim() };
  saveSettings();
  stopTeacher();
  let id;
  try { id = teacherIdentity(); } catch (err) { return { ok: false, error: `Δεν δημιουργήθηκε το κλειδί του καθηγητή: ${err.message}` }; }
  const server = new TeacherServer({ keyPem: id.keyPem, certPem: id.certPem });
  server.on('student', (s) => sendTeacher('student', s));
  server.on('remove', (r) => sendTeacher('remove', r));
  server.on('hand', (s) => {
    sendTeacher('hand', s);
    if (teacherWin && !teacherWin.isFocused()) teacherWin.flashFrame(true);
    if (Notification.isSupported()) {
      const n = new Notification({ title: '✋ Χέρι σηκωμένο', body: `${s.name} (${s.host}) ζητά βοήθεια`, silent: true });
      n.on('click', () => { if (teacherWin) { teacherWin.show(); teacherWin.focus(); sendTeacher('select', s.id); } });
      n.show();
    }
  });
  server.on('error', (err) => sendTeacher('error', err.message));
  try {
    await server.start();
  } catch (err) {
    return {
      ok: false,
      error: err.code === 'EADDRINUSE'
        ? `Η θύρα ${err.port || ''} χρησιμοποιείται ήδη. Μήπως η λειτουργία καθηγητή είναι ήδη ανοιχτή σε άλλο παράθυρο;`
        : err.message,
    };
  }
  teacher = server;
  refreshMenu();   // μενού Τάξη → Παρουσίαση
  return { ok: true, pin: server.pin, fingerprint: id.fingerprint, port: server.port, addresses: lanAddresses().map((a) => a.address) };
});

ipcMain.handle('teacher:newPin', (e) => {
  if (!fromTeacher(e) || !teacher) return null;
  teacher.pin = newPin();   // όσοι είναι ήδη συνδεδεμένοι μένουν
  return teacher.pin;
});
ipcMain.on('teacher:lower', (e, id) => { if (fromTeacher(e) && teacher) teacher.lowerHand(id); });
ipcMain.on('teacher:remove', (e, id) => { if (fromTeacher(e) && teacher) teacher.remove(id); });
ipcMain.on('teacher:stop', (e) => { if (fromTeacher(e)) stopTeacher(); });

ipcMain.handle('teacher:export', async (e) => {
  if (!fromTeacher(e)) return null;
  const id = teacherIdentity();
  const r = await dialog.showSaveDialog(teacherWin, {
    title: 'Αρχείο classroom.json για τους υπολογιστές των μαθητών',
    defaultPath: path.join(app.getPath('documents'), 'classroom.json'),
    filters: [{ name: 'classroom.json', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return null;
  let existing = null;
  try { existing = JSON.parse(fs.readFileSync(r.filePath, 'utf-8').replace(/^﻿/, '')); } catch (_) { /* νέο αρχείο */ }
  const data = buildTrustFile(existing, {
    name: settings.classroom.teacherName || os.userInfo().username,
    room: settings.classroom.room,
    fingerprint: id.fingerprint,
  }, lanAddresses().map((a) => a.address));
  try {
    fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true, path: r.filePath, target: trustFilePath(), teachers: data.teachers.length };
});

// --- Παράθυρο -------------------------------------------------------------------
function createWindow() {
  const w = settings.window || {};
  win = new BrowserWindow({
    width: w.width || 1300,
    height: w.height || 840,
    x: w.x,
    y: w.y,
    minWidth: 760,
    minHeight: 480,
    title: 'EduPython3',
    backgroundColor: settings.theme === 'dark' ? '#1e1f22' : '#ffffff',
    icon: path.join(__dirname, '..', 'renderer', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (w.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // σύνδεσμοι προς εξωτερικές σελίδες ανοίγουν στον browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  const rememberBounds = () => {
    if (!win || win.isDestroyed()) return;
    const maximized = win.isMaximized();
    settings.window = maximized ? { ...settings.window, maximized } : { ...win.getBounds(), maximized };
    saveSettings();
  };
  win.on('resize', rememberBounds);
  win.on('move', rememberBounds);

  win.on('close', (e) => {
    if (!forceClose) {
      e.preventDefault();
      win.webContents.send('menu', 'requestClose');
    }
  });
  win.on('closed', () => {
    win = null;
    if (teacherWin && !teacherWin.isDestroyed()) teacherWin.close();
  });

  if (process.env.EPAL_DEBUG) {
    win.webContents.on('console-message', (e, level, message) => {
      debugLog('[renderer]', (e && e.message) || message);
    });
  }
  // Εργαλείο ανάπτυξης: EPAL_SCREENSHOT=αρχείο.png [EPAL_SCRIPT=αρχείο.js] [EPAL_WAIT=ms]
  if (process.env.EPAL_SCREENSHOT) {
    win.webContents.once('did-finish-load', async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await wait(Number(process.env.EPAL_WAIT) || 2500);
      if (process.env.EPAL_SCRIPT) {
        try {
          const result = await win.webContents.executeJavaScript(fs.readFileSync(process.env.EPAL_SCRIPT, 'utf-8'));
          if (result !== undefined) debugLog('[script]', typeof result === 'string' ? result : JSON.stringify(result));
        } catch (e) { debugLog('[script error]', e.message); }
        await wait(Number(process.env.EPAL_WAIT2) || 2000);
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.EPAL_SCREENSHOT, img.toPNG());
      forceClose = true;
      app.quit();
    });
  }
}

if (process.env.EPAL_USERDATA) app.setPath('userData', process.env.EPAL_USERDATA);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const file = argv.slice(1).find((a) => /\.pyw?$/i.test(a));
    if (file) sendMenu('openPath', path.resolve(file));
  });

  app.whenReady().then(() => {
    // ειδοποιήσεις «χέρι σηκωμένο»· στο dev άλλο ID, αλλιώς τα Windows ταυτίζουν το node_modules\electron.exe με την εγκατεστημένη εφαρμογή
    if (process.platform === 'win32') app.setAppUserModelId(app.isPackaged ? 'gr.edu.python3' : 'gr.edu.python3.dev');
    loadSettings();
    refreshMenu();
    createWindow();
    const file = process.argv.slice(1).find((a) => /\.pyw?$/i.test(a) && fs.existsSync(a));
    if (file) win.webContents.once('did-finish-load', () => sendMenu('openPath', path.resolve(file)));
  });

  app.on('window-all-closed', () => {
    backend.stop();
    checker.dispose();
    if (student) student.stop();
    stopTeacher();
    clearTimeout(saveTimer);
    try { fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf-8'); } catch (_) { /* */ }
    app.quit();
  });
}
