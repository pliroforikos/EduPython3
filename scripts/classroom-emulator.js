#!/usr/bin/env node
'use strict';
/*
 * Προσομοίωση τάξης για δοκιμές της λειτουργίας «Τάξη»: εικονικοί μαθητές συνδέονται στον καθηγητή,
 * γράφουν σιγά-σιγά προγράμματα, κάνουν λάθη σύνταξης που διορθώνουν και σηκώνουν χέρι.
 * Όταν ο καθηγητής παρουσιάζει, ο πρώτος μαθητής τυπώνει τι βλέπει (αρχείο, γραμμές, έξοδο).
 *
 *   node scripts/classroom-emulator.js <PIN> [πλήθος μαθητών]
 *
 * Το PIN είναι αυτό που δείχνει η οθόνη του καθηγητή. Ο emulator διαβάζει το κλειδί του καθηγητή από το
 * classroom-teacher.json του ίδιου υπολογιστή (ή από το αρχείο του EPAL_TEACHER) και συνδέεται στο 127.0.0.1.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const C = require('../src/main/classroom');
const { fingerprint, normalizeFingerprint } = require('../src/main/classroomCert');

const pin = process.argv[2];
const count = Math.max(1, Math.min(40, Number(process.argv[3]) || 12));
if (!/^\d{4}$/.test(pin || '')) {
  console.log('Χρήση: node scripts/classroom-emulator.js <PIN> [πλήθος μαθητών]');
  process.exit(1);
}

const appData = process.platform === 'win32' ? process.env.APPDATA : path.join(os.homedir(), '.config');
const teacherFile = process.env.EPAL_TEACHER || path.join(appData, 'Python 2.7 ΕΠΑΛ', 'classroom-teacher.json');
const id = JSON.parse(fs.readFileSync(teacherFile, 'utf-8'));
const trust = {
  ok: true,
  teachers: [{ name: 'Καθηγητής', room: 'Προσομοίωση', fingerprint: normalizeFingerprint(fingerprint(id.keyPem)) }],
  port: C.DEFAULT_PORT,
  discoveryPort: C.DISCOVERY_PORT,
  hosts: ['127.0.0.1'],
};

const NAMES = ['Μαρία Παπαδοπούλου', 'Γιώργος Νικολάου', 'Ελένη Γεωργίου', 'Νίκος Δημητρίου', 'Κατερίνα Ιωάννου',
  'Δημήτρης Αθανασίου', 'Σοφία Κωνσταντίνου', 'Παναγιώτης Βασιλείου', 'Άννα Μιχαηλίδου', 'Κώστας Αλεξίου',
  'Χριστίνα Σταύρου', 'Βασίλης Πέτρου', 'Ιωάννα Λαμπράκη', 'Αντώνης Καραγιάννης', 'Δέσποινα Μαυρίδου',
  'Θανάσης Οικονόμου', 'Ευαγγελία Ζαχαρίου', 'Στέλιος Παππάς', 'Φωτεινή Αργυρίου', 'Μιχάλης Σωτηρίου'];

const PROGRAMS = [
  ['athroisma.py', 'athroisma = 0\nplithos = 0\nx = int(raw_input("Αριθμός (0 για τέλος): "))\nwhile x != 0:\n    athroisma = athroisma + x\n    plithos = plithos + 1\n    x = int(raw_input("Αριθμός (0 για τέλος): "))\nif plithos > 0:\n    print "Μέσος όρος:", float(athroisma) / plithos\n'],
  ['megisto.py', 'megisto = -1\nfor i in range(10):\n    onoma = raw_input("Όνομα: ")\n    vathmos = int(raw_input("Βαθμός: "))\n    while vathmos < 0 or vathmos > 20:\n        vathmos = int(raw_input("Βαθμός (0-20): "))\n    if vathmos > megisto:\n        megisto = vathmos\n        onoma_max = onoma\nprint "Μεγαλύτερος βαθμός:", megisto, onoma_max\n'],
  ['synartisi.py', 'def ypologismos(temaxia):\n    if temaxia <= 3:\n        poso = temaxia * 120\n    elif temaxia <= 6:\n        poso = temaxia * 100\n    else:\n        poso = temaxia * 70\n    return poso\n\nsynolo = 0\nfor i in range(5):\n    t = int(raw_input("Τεμάχια: "))\n    synolo = synolo + ypologismos(t)\nprint "Έσοδα:", synolo\n'],
  ['fysalida.py', 'def bubbleSort(array):\n    N = len(array)\n    for i in range(N - 1):\n        for j in range(N - 1, i, -1):\n            if array[j] < array[j - 1]:\n                array[j], array[j - 1] = array[j - 1], array[j]\n\nlista = [7, 8, 3, 4, -2]\nbubbleSort(lista)\nprint lista\n'],
  ['lexi.py', 'lexi = raw_input("Λέξη: ")\nplithos = 0\nfor ch in lexi:\n    if ch == "Α":\n        plithos = plithos + 1\nprint "Το Α υπάρχει", plithos, "φορές"\nantistrofi = ""\nfor ch in lexi:\n    antistrofi = ch + antistrofi\nprint antistrofi\n'],
  ['arxeio.py', 'f = open("thermo.txt", "w")\nfor i in range(3):\n    poli = raw_input("Πόλη: ")\n    t = float(raw_input("Θερμοκρασία: "))\n    f.write(poli + " " + str(t) + "\\n")\nf.close()\nprint "Αποθηκεύτηκε"\n'],
  ['klasi.py', 'class Student:\n    def __init__(self, onoma, v1, v2):\n        self.onoma = onoma\n        self.v1 = v1\n        self.v2 = v2\n\n    def find_mo(self):\n        return (self.v1 + self.v2) / 2.0\n\ns1 = Student("Άννα", 16, 19)\nprint s1.onoma, s1.find_mo()\n'],
  ['stoiva.py', 'stack = []\nx = int(raw_input("Αριθμός: "))\nwhile x != 0:\n    stack.append(x)\n    x = int(raw_input("Αριθμός: "))\nwhile len(stack) > 0:\n    print stack.pop()\n'],
];

const rnd = (a, b) => a + Math.random() * (b - a);
const BLOCK = /^\s*(if|elif|else|for|while|def|class)\b/;

/** Ο κώδικας όπως τον έχει γράψει ο μαθητής ως τώρα: κάποιες γραμμές-μπλοκ χωρίς «:» για λίγο. */
function snapshot(st) {
  const text = st.program.slice(0, st.typed);
  const lines = text.split('\n');
  const errors = [];
  for (const ln of st.missingColon) {
    if (ln - 1 < lines.length - 1 && lines[ln - 1].endsWith(':')) {
      lines[ln - 1] = lines[ln - 1].slice(0, -1);
      if (!errors.length) {
        const kw = BLOCK.exec(lines[ln - 1])[1];
        errors.push({ line: ln, message: `Λείπει η άνω-κάτω τελεία (:) στο τέλος του ${kw}` });
      }
    }
  }
  const last = lines[lines.length - 1];
  return { file: st.file, text: lines.join('\n'), cursor: { line: lines.length, column: last.length + 1 }, errors };
}

function newProgram(st) {
  const [file, program] = PROGRAMS[Math.floor(Math.random() * PROGRAMS.length)];
  st.file = file;
  st.program = program;
  st.typed = 0;
  st.missingColon = new Set();
  // σε μία από τις γραμμές-μπλοκ ο μαθητής θα ξεχάσει την άνω-κάτω τελεία
  const blocks = program.split('\n').map((l, i) => (BLOCK.test(l) ? i + 1 : 0)).filter(Boolean);
  if (blocks.length && Math.random() < 0.6) st.forget = blocks[Math.floor(Math.random() * blocks.length)];
  else st.forget = 0;
}

function tick(st) {
  if (st.client.state === 'connected') {
    if (st.typed < st.program.length) {
      // γράφει μερικούς χαρακτήρες (πιο αργά οι αρχάριοι)
      st.typed = Math.min(st.program.length, st.typed + Math.round(rnd(2, 9) * st.speed));
      const lineNo = st.program.slice(0, st.typed).split('\n').length;
      if (st.forget && lineNo > st.forget && !st.missingColon.has(st.forget) && !st.fixed) {
        st.missingColon.add(st.forget);
        st.fixAt = Date.now() + rnd(8000, 25000);
      }
      if (st.fixAt && Date.now() > st.fixAt) { st.missingColon.clear(); st.fixed = true; st.fixAt = 0; }
    } else if (!st.doneAt) {
      st.doneAt = Date.now() + rnd(8000, 20000);
    } else if (Date.now() > st.doneAt) {
      st.doneAt = 0;
      st.fixed = false;
      newProgram(st);
    }
    st.client.sendCode(snapshot(st));
    if (!st.client.hand && Math.random() < 0.006) {
      st.client.setHand(true);
      st.handDownAt = Date.now() + rnd(40000, 90000);
      console.log(`✋ ${st.name}`);
    } else if (st.client.hand && Date.now() > st.handDownAt) {
      st.client.setHand(false);
    }
  }
  st.timer = setTimeout(() => tick(st), rnd(500, 1800));
}

/** Ο πρώτος εικονικός μαθητής δείχνει στην κονσόλα ό,τι παρουσιάζει ο καθηγητής (κώδικας και έξοδος). */
function watchPresentation(client) {
  const st = { on: false, file: '', lines: 0, locked: false, copy: true, last: '' };
  client.on('present', (p) => {
    if (!p.on) {
      if (st.on) console.log('📺 τέλος παρουσίασης');
      Object.assign(st, { on: false, last: '' });
      return;
    }
    if (!st.on) Object.assign(st, { on: true, file: '', lines: 0, locked: false, copy: true });
    if ('file' in p) st.file = p.file;
    if ('locked' in p) st.locked = p.locked;
    if ('copy' in p) st.copy = p.copy;
    if (typeof p.text === 'string') st.lines = p.text.split('\n').length;
    const line = `📺 παρουσίαση: ${st.file || '—'}, ${st.lines} γραμμές${st.locked ? ' · 🔒 Όλοι εδώ' : ''}${st.copy ? '' : ' · χωρίς αντιγραφή'}`;
    if (line !== st.last) console.log(line);
    st.last = line;
  });
  client.on('present-out', (o) => {
    for (const [, text] of o.chunks || []) process.stdout.write(text);
  });
}

const students = [];
for (let i = 0; i < count; i++) {
  const n = String(i + 1).padStart(2, '0');
  const name = NAMES[i % NAMES.length];
  const client = new C.StudentClient({ trust, name, user: `mathitis${n}`, host: `PC${n}`, pin });
  const st = { name, client, speed: rnd(0.6, 1.6) };
  newProgram(st);
  let last = 'off';
  client.on('status', (s) => {
    if (s.state === 'connected' && last !== 'connected') console.log(`✔ ${name} (PC${n})`);
    last = s.state;
    if (s.state === 'rejected') {
      console.log(`✖ ${name}: ${s.reason === 'pin' ? 'λάθος PIN' : s.reason}`);
      if (s.reason === 'pin' || s.reason === 'blocked') process.exit(1);
    }
    if (s.state === 'kicked') console.log(`– ${name}: αφαιρέθηκε από τον καθηγητή`);
    if (s.lowered) console.log(`👇 ${name}: ο καθηγητής κατέβασε το χέρι`);
  });
  if (i === 0) watchPresentation(client);
  students.push(st);
  // οι μαθητές μπαίνουν σιγά-σιγά, όπως στο εργαστήριο
  setTimeout(() => { client.start(); tick(st); }, i * rnd(300, 900));
}
console.log(`${count} εικονικοί μαθητές συνδέονται με PIN ${pin}… (Ctrl+C για τέλος)`);
process.on('SIGINT', () => { students.forEach((s) => s.client.stop()); process.exit(0); });
