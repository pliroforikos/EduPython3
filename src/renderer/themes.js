'use strict';
/**
 * Θέματα εμφάνισης. Τα «light» και «dark» είναι τα προεπιλεγμένα της εφαρμογής (χρώματα IDLE στον editor).
 * Τα υπόλοιπα έχουν την εμφάνιση του Android Studio / IntelliJ: Dark, Darcula, Islands Darcula και τα φωτεινά τους
 * αντίστοιχα (Light, IntelliJ Light, Islands Light).
 *
 * Εδώ βρίσκονται τα στοιχεία κάθε θέματος που χρειάζονται το κύριο πρόγραμμα, ο editor (Monaco) και το μενού.
 * Τα χρώματα του περιβάλλοντος (κουμπιά, πάνελ) είναι μεταβλητές CSS στο styles.css, στα blocks `body.theme-<id>`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Themes = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Χρώματα κώδικα (χωρίς #): κείμενο, λέξεις-κλειδιά, συμβολοσειρές, αριθμοί, σχόλια, συναρτήσεις, ενσωματωμένα,
  // διακοσμητές (@), σταθερές, σφάλμα
  const SYN_DARK = {
    text: 'bcbec4', kw: 'cf8e6d', str: '6aab73', esc: 'cf8e6d', num: '2aacb8', com: '7a7e85',
    fn: '56a8f5', builtin: '8888c6', deco: 'b3ae60', op: 'bcbec4', invalid: 'f75464',
  };
  const SYN_DARCULA = {
    text: 'a9b7c6', kw: 'cc7832', str: '6a8759', esc: 'cc7832', num: '6897bb', com: '808080',
    fn: 'ffc66d', builtin: '8888c6', deco: 'bbb529', op: 'a9b7c6', invalid: 'ff6b68',
  };
  const SYN_LIGHT = {
    text: '080808', kw: '0033b3', str: '067d17', esc: '0037a6', num: '1750eb', com: '8c8c8c',
    fn: '00627a', builtin: '871094', deco: '9e880d', op: '080808', invalid: 'f50000',
  };

  // Χρώματα του editor
  const ED_DARK = {
    bg: '#1e1f22', line: '#26282e', lineNo: '#4b5059', lineNoActive: '#a1a3ab', gutter: '#1e1f22',
    selection: '#214283', cursor: '#ced0d6', widget: '#2b2d30', guide: '#393b40',
  };
  const ED_DARCULA = {
    bg: '#2b2b2b', line: '#323232', lineNo: '#606366', lineNoActive: '#a4a3a3', gutter: '#313335',
    selection: '#214283', cursor: '#bbbbbb', widget: '#3c3f41', guide: '#393b3d',
  };
  const ED_LIGHT = {
    bg: '#ffffff', line: '#f5f8fe', lineNo: '#adadad', lineNoActive: '#4c4c4c', gutter: '#ffffff',
    selection: '#a6d2ff', cursor: '#000000', widget: '#f7f8fa', guide: '#ebecf0',
  };
  const ED_INTELLIJ_LIGHT = {
    bg: '#ffffff', line: '#fcfaed', lineNo: '#999999', lineNoActive: '#4c4c4c', gutter: '#f0f0f0',
    selection: '#a6d2ff', cursor: '#000000', widget: '#f2f2f2', guide: '#d9d9d9',
  };

  /**
   * id: ό,τι αποθηκεύεται στις ρυθμίσεις (settings.theme)
   * dark: σκοτεινό (παίρνει και την κλάση theme-dark, αλλιώς theme-light)
   * islands: «νησίδες» (στρογγυλεμένα πάνελ με κενά ανάμεσά τους)
   * pair: το θέμα στο οποίο γυρνά το κουμπί «φωτεινό/σκοτεινό»
   * window: χρώμα του παραθύρου πριν φορτώσει η σελίδα
   * monaco: όνομα του θέματος του editor · syn/ed: χρώματα (μόνο στα νέα θέματα)
   */
  const LIST = [
    { id: 'light', label: 'Φωτεινό', group: 'default', dark: false, pair: 'dark', window: '#ffffff', monaco: 'idle-light' },
    { id: 'dark', label: 'Σκοτεινό', group: 'default', dark: true, pair: 'light', window: '#1e1f22', monaco: 'idle-dark' },

    { id: 'jb-dark', label: 'Dark', group: 'dark', dark: true, pair: 'jb-light', window: '#1e1f22', monaco: 'jb-dark', syn: SYN_DARK, ed: ED_DARK },
    { id: 'jb-darcula', label: 'Darcula', group: 'dark', dark: true, pair: 'jb-intellij-light', window: '#2b2b2b', monaco: 'jb-darcula', syn: SYN_DARCULA, ed: ED_DARCULA },
    { id: 'jb-islands-darcula', label: 'Islands Darcula', group: 'dark', dark: true, islands: true, pair: 'jb-islands-light', window: '#17181b', monaco: 'jb-islands-darcula', syn: SYN_DARK, ed: ED_DARK },

    { id: 'jb-light', label: 'Light', group: 'light', dark: false, pair: 'jb-dark', window: '#ffffff', monaco: 'jb-light', syn: SYN_LIGHT, ed: ED_LIGHT },
    { id: 'jb-intellij-light', label: 'IntelliJ Light', group: 'light', dark: false, pair: 'jb-darcula', window: '#ffffff', monaco: 'jb-intellij-light', syn: SYN_LIGHT, ed: ED_INTELLIJ_LIGHT },
    { id: 'jb-islands-light', label: 'Islands Light', group: 'light', dark: false, islands: true, pair: 'jb-islands-darcula', window: '#e3e5ea', monaco: 'jb-islands-light', syn: SYN_LIGHT, ed: ED_LIGHT },
  ];

  const GROUPS = { default: 'Προεπιλεγμένα', dark: 'Σκοτεινά (τύπου Android Studio)', light: 'Φωτεινά (τύπου Android Studio)' };

  /** Το θέμα με αυτό το id· για άγνωστο id (π.χ. παλιά ρύθμιση) το προεπιλεγμένο φωτεινό. */
  function get(id) {
    return LIST.find((t) => t.id === id) || LIST[0];
  }

  /** Οι κλάσεις του <body>: theme-dark|theme-light (βάση), theme-<id> (χρώματα) και theme-islands. */
  function bodyClasses(id) {
    const t = get(id);
    return [t.dark ? 'theme-dark' : 'theme-light', `theme-${t.id}`, ...(t.islands ? ['theme-islands'] : [])];
  }

  /** Βάζει το θέμα στο <body> χωρίς να πειράξει τις άλλες κλάσεις του (running, no-vars κ.λπ.). */
  function applyToBody(body, id) {
    for (const c of Array.from(body.classList)) if (c.startsWith('theme-')) body.classList.remove(c);
    body.classList.add(...bodyClasses(id));
  }

  /**
   * Ορισμός των θεμάτων στον Monaco. rulesFor(syn): οι κανόνες χρωμάτων με τα ονόματα tokens της γλώσσας της εφαρμογής.
   * Τα προεπιλεγμένα θέματα (idle-*) τα ορίζει ο editor.
   */
  function defineMonaco(monaco, rulesFor) {
    for (const t of LIST) {
      if (!t.syn) continue;
      const e = t.ed;
      monaco.editor.defineTheme(t.monaco, {
        base: t.dark ? 'vs-dark' : 'vs',
        inherit: true,
        rules: rulesFor(t.syn),
        colors: {
          'editor.background': e.bg,
          'editor.foreground': '#' + t.syn.text,
          'editor.lineHighlightBackground': e.line,
          'editor.selectionBackground': e.selection,
          'editor.inactiveSelectionBackground': e.selection + '80',
          'editorCursor.foreground': e.cursor,
          'editorLineNumber.foreground': e.lineNo,
          'editorLineNumber.activeForeground': e.lineNoActive,
          'editorGutter.background': e.gutter,
          'editorIndentGuide.background1': e.guide,
          'editorWidget.background': e.widget,
          'editorSuggestWidget.background': e.widget,
          'editorHoverWidget.background': e.widget,
          'editorWidget.border': e.guide,
          'input.background': e.bg,
        },
      });
    }
  }

  // ------------------------------------------------------------ γραμματοσειρές
  // Inter και JetBrains Mono (οι γραμματοσειρές του Android Studio) περιλαμβάνονται στην εφαρμογή (fonts/fonts.css)
  const MONO_BASE = "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Ubuntu Mono', 'Liberation Mono', 'Courier New', monospace";
  const UI_BASE = "'Segoe UI', system-ui, -apple-system, 'Ubuntu', 'Noto Sans', 'DejaVu Sans', sans-serif";
  const FONTS = {
    mono: [
      { id: 'default', label: 'Προεπιλεγμένη (Cascadia Mono / Consolas)', stack: MONO_BASE },
      { id: 'jetbrains', label: 'JetBrains Mono (όπως στο Android Studio)', stack: "'JetBrains Mono', " + MONO_BASE, family: 'JetBrains Mono' },
    ],
    ui: [
      { id: 'default', label: 'Προεπιλεγμένη (Segoe UI)', stack: UI_BASE },
      { id: 'inter', label: 'Inter (όπως στο Android Studio)', stack: "'Inter', " + UI_BASE, family: 'Inter' },
    ],
  };

  const fontOf = (kind, id) => FONTS[kind].find((f) => f.id === id) || FONTS[kind][0];
  /** Η λίστα γραμματοσειρών (font-family) του editor και του Shell. */
  const monoStack = (id) => fontOf('mono', id).stack;
  const uiStack = (id) => fontOf('ui', id).stack;

  /**
   * Εφαρμόζει τις γραμματοσειρές των ρυθμίσεων (editorFont, uiFont) στη σελίδα. Περιμένει να φορτωθεί η γραμματοσειρά,
   * ώστε ο editor να μετρήσει σωστά τους χαρακτήρες. Μετά ο editor χρειάζεται monaco.editor.remeasureFonts().
   */
  async function applyFonts(doc, settings) {
    const rootStyle = doc.documentElement.style;
    const mono = fontOf('mono', settings.editorFont);
    const ui = fontOf('ui', settings.uiFont);
    const loads = [];
    if (mono.family) for (const v of ['400 16px', '700 16px', 'italic 400 16px']) loads.push(doc.fonts.load(`${v} "${mono.family}"`, 'Aα'));
    if (ui.family) for (const v of ['400 16px', '600 16px', '700 16px']) loads.push(doc.fonts.load(`${v} "${ui.family}"`, 'Aα'));
    try { await Promise.all(loads); } catch (_) { /* χωρίς το αρχείο γραμματοσειράς πέφτει στην προεπιλεγμένη */ }
    // «Προεπιλεγμένη»: ισχύουν οι γραμματοσειρές του styles.css
    if (mono.family) rootStyle.setProperty('--font-mono', mono.stack); else rootStyle.removeProperty('--font-mono');
    if (ui.family) rootStyle.setProperty('--font-ui', ui.stack); else rootStyle.removeProperty('--font-ui');
  }

  return { LIST, GROUPS, get, bodyClasses, applyToBody, defineMonaco, FONTS, monoStack, uiStack, applyFonts };
});
