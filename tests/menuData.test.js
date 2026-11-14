'use strict';

/*
 * Το μενού της εφαρμογής ως δεδομένα για τα έγχρωμα πτυσσόμενα μενού της σελίδας: ετικέτες, συντομεύσεις, επιλογές,
 * και εύρεση του στοιχείου που θα εκτελεστεί. Δοκιμάζεται και με το πραγματικό πρότυπο του μενού (src/main/menu.js).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/main/menuData');
const MenuBar = require('../src/renderer/menubar');

test('Ετικέτες: το «&» δείχνει το πλήκτρο Alt', () => {
  assert.deepEqual(M.splitLabel('&Αρχείο'), { label: 'Αρχείο', mnemonic: 'Α' });
  assert.deepEqual(M.splitLabel('Ε&κτέλεση'), { label: 'Εκτέλεση', mnemonic: 'κ' });
  assert.deepEqual(M.splitLabel('Χωρίς'), { label: 'Χωρίς', mnemonic: '' });
  assert.deepEqual(M.splitLabel('Τα && τα'), { label: 'Τα & τα', mnemonic: '' }, '«&&» είναι ένα «&»');
  assert.deepEqual(M.splitLabel('Μεταβλητές & Πίνακες'), { label: 'Μεταβλητές & Πίνακες', mnemonic: '' }, '«&» πριν από κενό είναι σύμβολο');
  assert.deepEqual(M.splitLabel('Τέλος &'), { label: 'Τέλος &', mnemonic: '' });
  assert.deepEqual(M.splitLabel(undefined), { label: '', mnemonic: '' });
});

test('Συντομεύσεις: CmdOrCtrl γίνεται Ctrl (Cmd στο macOS)', () => {
  assert.equal(M.acceleratorText('CmdOrCtrl+Shift+S', 'win32'), 'Ctrl+Shift+S');
  assert.equal(M.acceleratorText('CmdOrCtrl+S', 'darwin'), 'Cmd+S');
  assert.equal(M.acceleratorText('F5', 'linux'), 'F5');
  assert.equal(M.acceleratorText('', 'win32'), '');
  assert.equal(M.acceleratorText(undefined, 'win32'), '');
});

const sample = [
  {
    label: '&Αρχείο',
    submenu: {
      items: [
        { label: 'Νέο', accelerator: 'CmdOrCtrl+N', type: 'normal', enabled: true },
        { type: 'separator' },
        { label: 'Αντιγραφή', role: 'copy' },
        { label: 'Πρόσφατα', submenu: { items: [{ label: '(κανένα)', enabled: false }] } },
        { label: 'Κρυφό', visible: false },
        { label: 'Προβολή', type: 'checkbox', checked: true },
        { label: 'Γρήγορα', type: 'radio', checked: false },
      ],
    },
  },
  { label: 'Κρυφό μενού', visible: false, submenu: { items: [] } },
  { label: '&Βοήθεια', submenu: [{ label: 'Σχετικά', click() {} }] },
];

test('Σειριοποίηση του μενού', () => {
  const out = M.serializeMenu(sample, 'win32');
  assert.equal(out.length, 2, 'τα κρυφά δεν μετρούν');
  assert.equal(out[0].label, 'Αρχείο');
  assert.equal(out[0].mnemonic, 'Α');
  assert.equal(out[0].type, 'submenu');
  const items = out[0].submenu;
  assert.equal(items.length, 6, 'χωρίς το κρυφό στοιχείο');
  assert.deepEqual(items[0], { type: 'normal', label: 'Νέο', mnemonic: '', enabled: true, checked: false, accelerator: 'Ctrl+N' });
  assert.equal(items[1].type, 'separator');
  assert.equal(items[2].accelerator, 'Ctrl+C', 'ενσωματωμένη εντολή: η γνωστή συντόμευση');
  assert.equal(items[3].type, 'submenu');
  assert.equal(items[3].submenu[0].enabled, false);
  assert.equal(items[4].type, 'checkbox');
  assert.equal(items[4].checked, true);
  assert.equal(items[5].type, 'radio');
  assert.equal(out[1].submenu[0].label, 'Σχετικά', 'δέχεται και απλό πίνακα');
  // Τα δεδομένα περνούν από το IPC: πρέπει να είναι απλά (χωρίς συναρτήσεις)
  assert.doesNotThrow(() => JSON.stringify(out));
  assert.equal(JSON.stringify(out).includes('click'), false);
});

test('Εύρεση στοιχείου με τη θέση του: οι θέσεις μετρούν όπως στη σειριοποίηση', () => {
  assert.equal(M.findItem(sample, [0, 0]).label, 'Νέο');
  assert.equal(M.findItem(sample, [0, 3, 0]).label, '(κανένα)');
  assert.equal(M.findItem(sample, [0, 4]).label, 'Προβολή', 'το κρυφό στοιχείο δεν μετρά');
  assert.equal(M.findItem(sample, [1, 0]).label, 'Σχετικά', 'το κρυφό μενού δεν μετρά');
  assert.equal(M.findItem(sample, [5]), null);
  assert.equal(M.findItem(sample, [0, 99]), null);
  assert.equal(M.findItem(sample, []), null);
  assert.equal(M.findItem(sample, 'x'), null);
  assert.equal(M.findItem(sample, [0, -1]), null);
  assert.equal(M.findItem(sample, [0, 1.5]), null);
  assert.equal(M.findItem(sample, [0, '0']), null, 'μόνο ακέραιοι');
});

test('Πλοήγηση με βέλη: παραλείπει διαχωριστικά και ανενεργά, με κύκλο', () => {
  const items = [
    { type: 'normal', enabled: true },
    { type: 'separator' },
    { type: 'normal', enabled: false },
    { type: 'normal', enabled: true },
  ];
  assert.equal(MenuBar.nextSelectable(items, -1, 1), 0);
  assert.equal(MenuBar.nextSelectable(items, 0, 1), 3, 'πάνω από διαχωριστικό και ανενεργό');
  assert.equal(MenuBar.nextSelectable(items, 3, 1), 0, 'κύκλος');
  assert.equal(MenuBar.nextSelectable(items, 0, -1), 3);
  assert.equal(MenuBar.nextSelectable([], 0, 1), -1);
  assert.equal(MenuBar.nextSelectable([{ type: 'separator' }], -1, 1), -1);
});

test('Το πραγματικό μενού της εφαρμογής σειριοποιείται σωστά', () => {
  // Το menu.js φορτώνει το electron· εδώ το αντικαθιστούμε με ένα απλό ομοίωμα που επιστρέφει το πρότυπο ως έχει
  const Module = require('node:module');
  const orig = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'electron') {
      return { Menu: { buildFromTemplate: (t) => ({ items: t }) }, app: { getVersion: () => '0.0.0' } };
    }
    return orig.call(this, request, ...rest);
  };
  let buildMenu;
  try {
    ({ buildMenu } = require('../src/main/menu'));
  } finally {
    Module._load = orig;
  }
  const menu = buildMenu({
    send() {}, settings: { showVariables: true, theme: 'light' }, examples: [{ title: 'Α', file: 'a' }], recent: [], openRecent() {},
  });
  const out = M.serializeMenu(menu, 'win32');
  assert.deepEqual(out.map((m) => m.label), ['Αρχείο', 'Επεξεργασία', 'Προβολή', 'Εκτέλεση', 'Παραδείγματα', 'Τάξη', 'Βοήθεια']);
  assert.deepEqual(out.map((m) => m.mnemonic), ['Α', 'Ε', 'Π', 'κ', 'δ', 'Τ', 'Β']);
  const file = out[0].submenu;
  assert.ok(file.some((i) => i.label === 'Αποθήκευση' && i.accelerator === 'Ctrl+S'));
  assert.ok(file.some((i) => i.type === 'submenu' && i.label === 'Πρόσφατα αρχεία'));
  const run = out[3].submenu.find((i) => i.label === 'Εκτέλεση προγράμματος');
  assert.equal(run.accelerator, 'F5');
  const view = out[2].submenu;
  assert.equal(view.find((i) => i.label === 'Μεταβλητές').checked, true);
  assert.ok(view.find((i) => i.type === 'submenu' && i.label === 'Θέμα εμφάνισης').submenu.some((i) => i.type === 'radio'));
  // Κάθε στοιχείο που εκτελείται βρίσκεται με τη θέση του
  assert.equal(M.findItem(menu, [0, 4]).label, 'Αποθήκευση');
});

