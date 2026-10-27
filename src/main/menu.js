'use strict';
const { Menu, app } = require('electron');
const path = require('path');

/**
 * Ελληνικό μενού. Οι εντολές του editor (αναίρεση, εύρεση κ.λπ.) δεν δεσμεύουν
 * πλήκτρα (registerAccelerator: false), ώστε να τα χειρίζεται ο ίδιος ο Monaco.
 */
const SPEEDS = [['step', 'Γραμμή γραμμή'], ['slow', 'Αργή'], ['medium', 'Μέτρια'], ['normal', 'Κανονική']];

function buildMenu({ send, settings, examples, recent, openRecent, classroom = { state: 'off' }, teacherMode = true, present = null, setPresent }) {
  const cmd = (id, label, accelerator, extra = {}) => ({
    label, ...(accelerator ? { accelerator } : {}), click: () => send(id), ...extra,
  });
  const local = (id, label, accelerator) => cmd(id, label, accelerator, { registerAccelerator: false });

  const template = [
    {
      label: '&Αρχείο',
      submenu: [
        cmd('new', 'Νέο', 'CmdOrCtrl+N'),
        cmd('open', 'Άνοιγμα…', 'CmdOrCtrl+O'),
        {
          label: 'Πρόσφατα αρχεία',
          submenu: recent.length
            ? recent.map((p) => ({ label: p, click: () => openRecent(p) }))
            : [{ label: '(κανένα)', enabled: false }],
        },
        { type: 'separator' },
        cmd('save', 'Αποθήκευση', 'CmdOrCtrl+S'),
        cmd('saveAs', 'Αποθήκευση ως…', 'CmdOrCtrl+Shift+S'),
        cmd('closeTab', 'Κλείσιμο καρτέλας', 'CmdOrCtrl+W'),
        { type: 'separator' },
        cmd('settings', 'Ρυθμίσεις…', 'CmdOrCtrl+,'),
        { type: 'separator' },
        { label: 'Έξοδος', role: 'quit' },
      ],
    },
    {
      label: '&Επεξεργασία',
      submenu: [
        local('undo', 'Αναίρεση', 'CmdOrCtrl+Z'),
        local('redo', 'Ακύρωση αναίρεσης', 'CmdOrCtrl+Y'),
        { type: 'separator' },
        { label: 'Αποκοπή', role: 'cut' },
        { label: 'Αντιγραφή', role: 'copy' },
        { label: 'Επικόλληση', role: 'paste' },
        local('selectAll', 'Επιλογή όλων', 'CmdOrCtrl+A'),
        { type: 'separator' },
        local('find', 'Εύρεση…', 'CmdOrCtrl+F'),
        local('replace', 'Αντικατάσταση…', 'CmdOrCtrl+H'),
        local('gotoLine', 'Μετάβαση σε γραμμή…', 'CmdOrCtrl+G'),
        { type: 'separator' },
        local('toggleComment', 'Σχόλιο / αποσχολιασμός', 'CmdOrCtrl+/'),
        local('indent', 'Αύξηση εσοχής', 'Tab'),
        local('outdent', 'Μείωση εσοχής', 'Shift+Tab'),
        local('fixQuotes', 'Διόρθωση εισαγωγικών από PDF/Word', ''),
      ],
    },
    {
      label: '&Προβολή',
      submenu: [
        cmd('toggleVariables', 'Μεταβλητές', 'F6', { type: 'checkbox', checked: settings.showVariables }),
        cmd('toggleAssistant', 'Βοηθός', 'F7', { type: 'checkbox', checked: settings.showAssistant }),
        cmd('toggleRecall', 'Θέλω να θυμηθώ', 'F8', { type: 'checkbox', checked: settings.showRecall }),
        { type: 'separator' },
        cmd('zoomIn', 'Μεγαλύτερα γράμματα', 'CmdOrCtrl+='),
        cmd('zoomOut', 'Μικρότερα γράμματα', 'CmdOrCtrl+-'),
        cmd('zoomReset', 'Κανονικό μέγεθος', 'CmdOrCtrl+0'),
        { type: 'separator' },
        cmd('toggleTheme', 'Σκοτεινό θέμα', '', { type: 'checkbox', checked: settings.theme === 'dark' }),
        cmd('toggleMinimap', 'Μικρογραφία κώδικα (minimap)', '', { type: 'checkbox', checked: settings.minimap }),
        cmd('toggleWrap', 'Αναδίπλωση μεγάλων γραμμών', 'Alt+Z', { type: 'checkbox', checked: settings.wordWrap }),
        cmd('toggleWhitespace', 'Εμφάνιση κενών', '', { type: 'checkbox', checked: settings.showWhitespace }),
        { type: 'separator' },
        { label: 'Εργαλεία προγραμματιστή', role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
      ],
    },
    {
      label: 'Ε&κτέλεση',
      submenu: [
        cmd('run', 'Εκτέλεση προγράμματος', 'F5'),
        cmd('stop', 'Διακοπή / Επανεκκίνηση', 'CmdOrCtrl+F2'),
        { type: 'separator' },
        {
          label: 'Ταχύτητα εκτέλεσης',
          submenu: SPEEDS.map(([id, label]) => cmd(`speed:${id}`, label, '',
            { type: 'radio', checked: (settings.runSpeed || 'normal') === id })),
        },
        cmd('step', 'Επόμενη γραμμή (βήμα-βήμα)', 'F10'),
        { type: 'separator' },
        cmd('clearShell', 'Καθαρισμός Shell', ''),
        { type: 'separator' },
        {
          label: 'Κωδικοποίηση ελληνικών κατά την εκτέλεση',
          submenu: [
            cmd('encoding:cp1253', 'cp1253 (όπως το IDLE, len(\'Αθήνα\') = 5)', '',
              { type: 'radio', checked: settings.stringEncoding === 'cp1253' }),
            cmd('encoding:utf-8', 'utf-8 (len(\'Αθήνα\') = 10)', '',
              { type: 'radio', checked: settings.stringEncoding === 'utf-8' }),
          ],
        },
      ],
    },
    {
      label: 'Παρα&δείγματα',
      submenu: examples.length
        ? examples.map((ex) => ({ label: ex.title, click: () => send('example', ex.file) }))
        : [{ label: '(κανένα)', enabled: false }],
    },
    {
      label: '&Τάξη',
      submenu: [
        ['searching', 'connecting', 'connected'].includes(classroom.state)
          ? cmd('classroomLeave', 'Αποσύνδεση από την τάξη', '')
          : cmd('classroomJoin', 'Σύνδεση στην τάξη…', ''),
        cmd('raiseHand', 'Σηκώνω χέρι ✋', 'F9',
          { type: 'checkbox', checked: !!classroom.hand, enabled: classroom.state === 'connected' }),
        // όχι σε υπολογιστή μαθητή (με classroom.json)
        ...(teacherMode ? [{ type: 'separator' }, cmd('teacherMode', 'Λειτουργία καθηγητή…', '')] : []),
        // μόνο όταν η τάξη του καθηγητή είναι ανοιχτή: οι μαθητές βλέπουν την ενεργή καρτέλα αυτού του παραθύρου
        ...(present ? [
          { type: 'separator' },
          { label: '📺 Παρουσίαση στην τάξη', type: 'checkbox', checked: present.on, click: (item) => setPresent({ on: item.checked }) },
          { label: '🔒 Όλοι εδώ (κλειδώνει τους μαθητές)', type: 'checkbox', checked: present.locked, enabled: present.on, click: (item) => setPresent({ locked: item.checked }) },
          { label: 'Επιτρέπεται η αντιγραφή του κώδικα', type: 'checkbox', checked: present.copy, enabled: present.on, click: (item) => setPresent({ copy: item.checked }) },
        ] : []),
      ],
    },
    {
      label: '&Βοήθεια',
      submenu: [
        cmd('help', 'Οδηγός χρήσης', 'F1'),
        cmd('shortcuts', 'Συντομεύσεις πληκτρολογίου', ''),
        { type: 'separator' },
        cmd('about', `Σχετικά (έκδοση ${app.getVersion()})`, ''),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu, examplesDir: path.join(__dirname, '..', '..', 'examples') };
