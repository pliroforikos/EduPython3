'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    read: (p) => ipcRenderer.invoke('file:read', p),
    save: (p, content) => ipcRenderer.invoke('file:save', p, content),
    saveAs: (content, suggested) => ipcRenderer.invoke('file:saveAs', content, suggested),
    exists: (p) => ipcRenderer.invoke('file:exists', p),
  },
  openExample: (file) => ipcRenderer.invoke('example:open', file),
  recall: () => ipcRenderer.invoke('recall:get'),
  dialog: {
    unsaved: (names) => ipcRenderer.invoke('dialog:unsaved', names),
    message: (opts) => ipcRenderer.invoke('dialog:message', opts),
    choosePython: () => ipcRenderer.invoke('dialog:choosePython'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  python: {
    info: () => ipcRenderer.invoke('python:info'),
    test: (p) => ipcRenderer.invoke('python:test', p),
  },
  backend: {
    run: (path, source, trace) => ipcRenderer.send('backend:run', { path, source, trace }),
    trace: (opts) => ipcRenderer.send('backend:trace', opts),
    step: () => ipcRenderer.send('backend:step'),
    shell: () => ipcRenderer.send('backend:shell'),
    stop: () => ipcRenderer.send('backend:stop'),
    input: (text) => ipcRenderer.send('backend:input', text),
    repl: (line) => ipcRenderer.send('backend:repl', line),
    onMessage: (cb) => ipcRenderer.on('backend', (_e, msg) => cb(msg)),
  },
  check: (source) => ipcRenderer.invoke('check', source),
  classroom: {
    info: () => ipcRenderer.invoke('classroom:info'),
    join: (name, pin) => ipcRenderer.invoke('classroom:join', { name, pin }),
    leave: () => ipcRenderer.send('classroom:leave'),
    code: (payload) => ipcRenderer.send('classroom:code', payload),
    hand: (up) => ipcRenderer.send('classroom:hand', up),
    openTeacher: () => ipcRenderer.send('classroom:teacher'),
    onStatus: (cb) => ipcRenderer.on('classroom', (_e, status) => cb(status)),
    onPresent: (cb) => ipcRenderer.on('present', (_e, p) => cb(p)),
    onPresentOut: (cb) => ipcRenderer.on('present-out', (_e, o) => cb(o)),
  },
  // παρουσίαση του καθηγητή (κύριο παράθυρο του υπολογιστή του καθηγητή)
  present: {
    code: (payload) => ipcRenderer.send('present:code', payload),
    out: (out) => ipcRenderer.send('present:out', out),
    set: (patch) => ipcRenderer.send('present:set', patch),
    onState: (cb) => ipcRenderer.on('present-state', (_e, s) => cb(s)),
  },
  teacher: {
    defaults: () => ipcRenderer.invoke('teacher:defaults'),
    start: (opts) => ipcRenderer.invoke('teacher:start', opts),
    stop: () => ipcRenderer.send('teacher:stop'),
    newPin: () => ipcRenderer.invoke('teacher:newPin'),
    lowerHand: (id) => ipcRenderer.send('teacher:lower', id),
    remove: (id) => ipcRenderer.send('teacher:remove', id),
    exportTrust: () => ipcRenderer.invoke('teacher:export'),
    present: (patch) => ipcRenderer.send('present:set', patch),
    onEvent: (cb) => ipcRenderer.on('teacher', (_e, type, data) => cb(type, data)),
  },
  onMenu: (cb) => ipcRenderer.on('menu', (_e, id, arg) => cb(id, arg)),
  closeNow: () => ipcRenderer.send('app:closeNow'),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch (_) { return null; } },
});
