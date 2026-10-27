'use strict';
// node --test tests/  — λειτουργία «Τάξη» με πραγματικό TLS server στο 127.0.0.1
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateIdentity, normalizeFingerprint } = require('../src/main/classroomCert');
const C = require('../src/main/classroom');

const teacherId = generateIdentity();

/** Περιμένει γεγονός του emitter που ικανοποιεί τη συνθήκη. */
function waitFor(emitter, event, pred = () => true, ms = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { emitter.removeListener(event, on); reject(new Error(`timeout: ${event}`)); }, ms);
    function on(arg) {
      if (!pred(arg)) return;
      clearTimeout(timer);
      emitter.removeListener(event, on);
      resolve(arg);
    }
    emitter.on(event, on);
  });
}

async function classroom(t, { trustFp = teacherId.fingerprint, pin = '1234', studentPin = pin } = {}) {
  const server = new C.TeacherServer({ keyPem: teacherId.keyPem, certPem: teacherId.certPem, port: 0, discoveryPort: 0, pin });
  const { port, discoveryPort } = await server.start();
  const trust = { ok: true, teachers: [{ name: 'Λ. Προκόπης', room: 'Εργ. 1', fingerprint: normalizeFingerprint(trustFp) }], port, discoveryPort, hosts: ['127.0.0.1'] };
  const student = new C.StudentClient({ trust, name: 'Μαρία', user: 'maria', host: 'PC07', pin: studentPin });
  t.after(() => { student.stop(); server.stop(); });
  return { server, student };
}

test('λειτουργία καθηγητή: όχι σε υπολογιστή μαθητή (με classroom.json)', () => {
  const other = generateIdentity();
  const trust = { ok: true, teachers: [{ name: 'Λ. Προκόπης', fingerprint: normalizeFingerprint(teacherId.fingerprint) }] };
  // χωρίς classroom.json: υπολογιστής καθηγητή
  assert.strictEqual(C.teacherModeAllowed({ ok: false, error: 'missing' }, null), true);
  // classroom.json που υπάρχει αλλά είναι χαλασμένο: υπολογιστής μαθητή
  assert.strictEqual(C.teacherModeAllowed({ ok: false, error: 'invalid' }, teacherId.fingerprint), false);
  // classroom.json χωρίς το κλειδί αυτού του υπολογιστή: υπολογιστής μαθητή
  assert.strictEqual(C.teacherModeAllowed(trust, null), false);
  assert.strictEqual(C.teacherModeAllowed(trust, other.fingerprint), false);
  // ο καθηγητής του classroom.json στον δικό του υπολογιστή (αποτύπωμα σε οποιαδήποτε μορφή)
  assert.strictEqual(C.teacherModeAllowed(trust, teacherId.fingerprint), true);
  assert.strictEqual(C.teacherModeAllowed(trust, teacherId.fingerprint.toUpperCase()), true);
});

test('frameReader: γραμμές JSON σε κομμάτια, αγνοεί τα άκυρα', () => {
  const got = [];
  const feed = C.frameReader((m) => got.push(m), () => got.push('overflow'));
  feed('{"a":1}\n{"b"');
  feed(':2}\nόχι json\n\n{"c":3}\n');
  assert.deepStrictEqual(got, [{ a: 1 }, { b: 2 }, { c: 3 }]);
  feed('x'.repeat(600 * 1024));
  assert.strictEqual(got.pop(), 'overflow');
});

test('classroom.json: φόρτωση, λάθη, συγχώνευση καθηγητών', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epal-class-'));
  const file = path.join(dir, 'classroom.json');
  assert.strictEqual(C.loadTrust(file).error, 'missing');
  fs.writeFileSync(file, '{ σπασμένο');
  assert.strictEqual(C.loadTrust(file).error, 'invalid');
  fs.writeFileSync(file, JSON.stringify({ teachers: [{ name: 'Χ', fingerprint: 'abc' }] }));
  assert.strictEqual(C.loadTrust(file).error, 'invalid');

  const other = generateIdentity();
  const first = C.buildTrustFile(null, { name: 'Α', fingerprint: other.fingerprint });
  const both = C.buildTrustFile(first, { name: 'Β', room: 'Εργ. 2', fingerprint: teacherId.fingerprint }, ['10.0.0.5']);
  const again = C.buildTrustFile(both, { name: 'Β νέο', fingerprint: teacherId.fingerprint.toUpperCase() });
  assert.deepStrictEqual(again.teachers.map((x) => x.name), ['Α', 'Β νέο']);
  fs.writeFileSync(file, '﻿' + JSON.stringify(again));
  const tr = C.loadTrust(file);
  assert.ok(tr.ok);
  assert.strictEqual(tr.teachers.length, 2);
  assert.strictEqual(tr.teachers[1].fingerprint, normalizeFingerprint(teacherId.fingerprint));
  assert.deepStrictEqual(tr.hosts, ['10.0.0.5']);
  assert.strictEqual(tr.port, C.DEFAULT_PORT);
});

test('μαθητής βρίσκει τον καθηγητή, στέλνει κώδικα και σηκώνει χέρι', async (t) => {
  const { server, student } = await classroom(t);
  const joined = waitFor(server, 'student', (s) => s.online);
  student.start();
  const connected = await waitFor(student, 'status', (s) => s.state === 'connected');
  assert.deepStrictEqual(connected.teacher, { name: 'Λ. Προκόπης', room: 'Εργ. 1' });
  const s = await joined;
  assert.strictEqual(s.name, 'Μαρία');
  assert.strictEqual(s.host, 'PC07');

  const code = waitFor(server, 'student', (x) => x.text.includes('print'));
  student.sendCode({ file: 'askisi.py', text: 'x = 5\nprint x\n', cursor: { line: 2, column: 8 }, errors: [{ line: 2, message: 'λάθος' }] });
  const c = await code;
  assert.strictEqual(c.file, 'askisi.py');
  assert.deepStrictEqual(c.cursor, { line: 2, column: 8 });
  assert.strictEqual(c.errors[0].message, 'λάθος');

  const hand = waitFor(server, 'hand');
  student.setHand(true);
  assert.strictEqual((await hand).id, s.id);
  assert.ok(server.list()[0].hand);

  const lowered = waitFor(student, 'status', (x) => x.lowered);
  server.lowerHand(s.id);
  await lowered;
  assert.strictEqual(student.hand, false);

  const left = waitFor(server, 'student', (x) => !x.online);
  student.leave();
  await left;
});

test('λάθος PIN: ο μαθητής απορρίπτεται και δεν εμφανίζεται', async (t) => {
  const { server, student } = await classroom(t, { pin: '1234', studentPin: '9999' });
  student.start();
  const st = await waitFor(student, 'status', (s) => s.state === 'rejected');
  assert.strictEqual(st.reason, 'pin');
  assert.strictEqual(server.list().length, 0);
});

test('«ψεύτικος καθηγητής»: κλειδί που δεν είναι στο classroom.json → καμία αποστολή', async (t) => {
  const stranger = generateIdentity();
  const { server, student } = await classroom(t, { trustFp: stranger.fingerprint });
  let reply = null;
  server.fingerprint = stranger.fingerprint;   // ψεύτικο beacon: ισχυρίζεται ότι έχει το σωστό κλειδί
  student.on('status', (s) => { if (s.state === 'connected') reply = s; });
  student.sendCode({ file: 'a.py', text: 'μυστικό', cursor: null, errors: [] });
  student.start();
  await waitFor(student, 'impostor');
  assert.strictEqual(reply, null);
  assert.strictEqual(server.list().length, 0);
});

test('ο καθηγητής αφαιρεί μαθητή', async (t) => {
  const { server, student } = await classroom(t);
  const joined = waitFor(server, 'student', (s) => s.online);
  student.start();
  const s = await joined;
  const kicked = waitFor(student, 'status', (x) => x.state === 'kicked');
  server.remove(s.id);
  await kicked;
  assert.strictEqual(server.list().length, 0);
});

test('παρουσίαση: κώδικας, μερικές ενημερώσεις, έξοδος, τέλος', async (t) => {
  const { server, student } = await classroom(t);
  student.start();
  await waitFor(student, 'status', (s) => s.state === 'connected');

  const first = waitFor(student, 'present');
  server.present({ on: true, file: 'demo.py', text: 'print 1\n', view: { cursor: { line: 1, column: 3 }, sel: [[1, 1, 1, 6]], top: 1, exec: 0 }, locked: true, copy: false });
  const p = await first;
  assert.deepStrictEqual(p, {
    on: true, file: 'demo.py', text: 'print 1\n', locked: true, copy: false,
    view: { cursor: { line: 1, column: 3 }, sel: [[1, 1, 1, 6]], top: 1, exec: 0 },
  });

  // μόνο ο κέρσορας άλλαξε: χωρίς κείμενο
  const moved = waitFor(student, 'present');
  server.present({ view: { cursor: { line: 1, column: 8 }, top: 1 } });
  const m = await moved;
  assert.strictEqual(m.text, undefined);
  assert.strictEqual(m.view.cursor.column, 8);
  assert.strictEqual(server.presentation.text, 'print 1\n');

  // έξοδος: άγνωστες κλάσεις και άκυρα κομμάτια πετιούνται
  const out = waitFor(student, 'present-out');
  server.presentOutput([['out', '1\n'], ['<script>', 'x'], ['err', 42], ['stderr', 'λάθος\n']]);
  assert.deepStrictEqual((await out).chunks, [['out', '1\n'], ['stderr', 'λάθος\n']]);

  const end = waitFor(student, 'present', (x) => !x.on);
  server.present({ on: false });
  await end;
  assert.strictEqual(server.presentation, null);
  // μετά το τέλος δεν φεύγει τίποτα
  server.present({ text: 'μυστικό' });
  assert.strictEqual(server.presentation, null);
});

test('παρουσίαση: όποιος μπαίνει αργότερα βλέπει κώδικα και έξοδο· χωρίς σύνδεση τελειώνει', async (t) => {
  const { server, student } = await classroom(t);
  server.present({ on: true, file: 'a.py', text: 'x = 1\n', locked: true });
  server.presentOutput([['command', '%Run a.py\n'], ['out', 'x'.repeat(40 * 1024)]]);
  assert.ok(server.presentOut.reduce((n, c) => n + c[1].length, 0) <= 30 * 1024);

  const got = waitFor(student, 'present', (x) => x.on);
  const out = waitFor(student, 'present-out', (x) => x.chunks);
  student.start();
  const p = await got;
  assert.strictEqual(p.text, 'x = 1\n');
  assert.strictEqual(p.locked, true);
  assert.strictEqual(p.copy, true);
  assert.ok((await out).chunks.length > 0);

  // ο καθηγητής κλείνει την τάξη: ο μαθητής ξεκλειδώνει
  const end = waitFor(student, 'present', (x) => !x.on);
  server.stop();
  await end;
});

test('έξοδος παρουσίασης: όριο μεγέθους, κρατά τα τελευταία', () => {
  const chunks = C.cleanChunks([['out', 'a'.repeat(10)], ['out', 'b'.repeat(10)]], 15);
  assert.deepStrictEqual(chunks, [['out', 'aaaaa'], ['out', 'b'.repeat(10)]]);
  assert.deepStrictEqual(C.cleanChunks('όχι πίνακας'), []);
});

test('PIN: πάντα 4 ψηφία', () => {
  for (let i = 0; i < 200; i++) assert.match(C.newPin(), /^\d{4}$/);
});
