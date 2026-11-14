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

  // ------------------------------------------------------------ χρώμα γραμμής τίτλου, μενού και εργαλείων
  /**
   * Χρώματα για τη γραμμή μενού και εργαλείων (στυλ Android Studio): όλη η κεφαλίδα έχει ένα χρώμα φόντου.
   * 'theme' = ίδιο με το θέμα (προεπιλογή)· 'custom' = ό,τι διαλέξει ο χρήστης (settings.headerColor = '#rrggbb').
   */
  const HEADER_COLORS = [
    { id: 'theme', label: 'Ίδιο με το θέμα' },
    { id: 'graphite', label: 'Γραφίτης (Android Studio)', color: '#3c3f41' },
    { id: 'charcoal', label: 'Σκούρο γκρι', color: '#2b2d30' },
    { id: 'black', label: 'Μαύρο', color: '#16171a' },
    { id: 'navy', label: 'Μπλε ναυτικό', color: '#1f3a5f' },
    { id: 'blue', label: 'Μπλε', color: '#2f5fa8' },
    { id: 'indigo', label: 'Λουλακί', color: '#3f3f8f' },
    { id: 'purple', label: 'Μωβ', color: '#5b3a8c' },
    { id: 'teal', label: 'Τιρκουάζ', color: '#0f6b66' },
    { id: 'green', label: 'Πράσινο', color: '#2e6b3f' },
    { id: 'red', label: 'Κόκκινο', color: '#8a2b2b' },
    { id: 'orange', label: 'Πορτοκαλί', color: '#b3541e' },
    { id: 'silver', label: 'Ασημί', color: '#dfe1e5' },
    { id: 'white', label: 'Λευκό', color: '#ffffff' },
    { id: 'custom', label: 'Άλλο χρώμα…' },
  ];

  const HEX = /^#[0-9a-f]{6}$/i;

  /** Το χρώμα (#rrggbb) που αντιστοιχεί σε μια τιμή της ρύθμισης headerColor, ή null για «ίδιο με το θέμα». */
  function headerColorOf(value) {
    if (typeof value === 'string' && HEX.test(value)) return value.toLowerCase();
    const preset = HEADER_COLORS.find((c) => c.id === value);
    return preset && preset.color ? preset.color : null;
  }

  /** Φωτεινότητα (WCAG) ενός χρώματος #rrggbb, από 0 (μαύρο) έως 1 (λευκό). */
  function luminance(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  /** Λόγος αντίθεσης (WCAG) δύο χρωμάτων #rrggbb, από 1 έως 21. */
  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /** Ανάμειξη δύο χρωμάτων #rrggbb: t = 0 → a, t = 1 → b. */
  function mix(a, b, t) {
    const ch = (i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
    return '#' + [1, 3, 5].map((i) => ch(i).toString(16).padStart(2, '0')).join('');
  }

  /** Κατευθύνσεις της διαβάθμισης (gradient): από το πρώτο προς το δεύτερο χρώμα. */
  const HEADER_DIRECTIONS = [
    { id: 'right', label: 'Αριστερά → δεξιά', css: '90deg' },
    { id: 'left', label: 'Δεξιά → αριστερά', css: '270deg' },
    { id: 'down', label: 'Πάνω → κάτω', css: '180deg' },
    { id: 'diag', label: 'Διαγώνια', css: '115deg' },
  ];
  const dirOf = (id) => HEADER_DIRECTIONS.find((d) => d.id === id) || HEADER_DIRECTIONS[0];

  /** Η διαβάθμιση ως τιμή CSS για το φόντο της κεφαλίδας. */
  function headerImage(c1, c2, dir) {
    return `linear-gradient(${dirOf(dir).css}, ${c1}, ${c2})`;
  }

  /**
   * Το χρώμα της διαβάθμισης στη δεξιά άκρη της γραμμής τίτλου. Τα κουμπιά του παραθύρου (ελαχιστοποίηση, κλείσιμο…)
   * τα σχεδιάζει το σύστημα σε ΕΝΑ χρώμα, οπότε παίρνουν το χρώμα που έχει εκεί η διαβάθμιση, για να μη φαίνονται «κομμένα».
   */
  function headerEdgeColor(c1, c2, dir) {
    if (dir === 'right') return c2;
    if (dir === 'left' || dir === 'down') return c1;
    return mix(c1, c2, 0.45); // διαγώνια: άνω δεξιά γωνία
  }

  /** Τα υπόλοιπα χρώματα της κεφαλίδας (hover, διαχωριστικά, Εκτέλεση/Διακοπή) για ανοιχτά ή σκούρα γράμματα. */
  function headerPalette(lightText) {
    return {
      muted: lightText ? 'rgba(242, 243, 245, 0.7)' : 'rgba(27, 28, 31, 0.68)',
      hover: lightText ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.09)',
      active: lightText ? 'rgba(255, 255, 255, 0.24)' : 'rgba(0, 0, 0, 0.17)',
      sep: lightText ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.18)',
      run: lightText ? '#6cc070' : '#2e7d32',
      stop: lightText ? '#ff7b7b' : '#c62828',
      dark: lightText,
    };
  }

  const MIN_CONTRAST = 4.5;

  /**
   * Τα χρώματα της κεφαλίδας για φόντο `bg` (#rrggbb), ή για διαβάθμιση από `bg` σε `bg2`. Επιστρέφει τιμές για τις
   * μεταβλητές CSS --hdr-*.
   *
   * Ένα χρώμα: ανοιχτά γράμματα σε σκούρο φόντο, σκούρα σε ανοιχτό, όποιο δίνει τη μεγαλύτερη αντίθεση.
   *
   * Διαβάθμιση: τα ίδια γράμματα πρέπει να διαβάζονται και στις δύο άκρες. Αν τα δύο χρώματα διαφέρουν πολύ σε
   * φωτεινότητα (π.χ. σκούρο γκρι → ασημί), κανένα χρώμα γραμμάτων δεν ταιριάζει και στα δύο· τότε η άκρη που δεν
   * διαβάζεται μαλακώνει όσο χρειάζεται (το λιγότερο δυνατό). Το bg και το bg2 που επιστρέφονται είναι τα χρώματα που
   * πρέπει να ζωγραφιστούν.
   */
  function headerStyle(bg, bg2) {
    if (!bg2) {
      // Απαλά γράμματα (όπως στο Android Studio)· σε μεσαία έντονα χρώματα δεν αρκούν, και τότε καθαρό λευκό ή μαύρο
      // (το καλύτερο από τα δύο δίνει πάντα αντίθεση τουλάχιστον 4.58)
      let LIGHT = '#f2f3f5';
      let DARK = '#1b1c1f';
      if (Math.max(contrast(bg, LIGHT), contrast(bg, DARK)) < MIN_CONTRAST) {
        LIGHT = '#ffffff';
        DARK = '#000000';
      }
      const lightText = contrast(bg, LIGHT) >= contrast(bg, DARK);
      return { bg, bg2: null, menu: bg, fg: lightText ? LIGHT : DARK, ...headerPalette(lightText) };
    }
    const candidates = [
      { fg: '#f2f3f5', light: true, toward: '#000000' },
      { fg: '#1b1c1f', light: false, toward: '#ffffff' },
      { fg: '#ffffff', light: true, toward: '#000000' },
      { fg: '#000000', light: false, toward: '#ffffff' },
    ];
    // Για κάθε επιλογή γραμμάτων: πόσο πρέπει να μαλακώσει κάθε άκρη (t = 0: καθόλου) ώστε να διαβάζεται
    const fit = (color, cand) => {
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const c = mix(color, cand.toward, Math.min(t, 1));
        if (contrast(c, cand.fg) >= MIN_CONTRAST) return { color: t === 0 ? color : c, t };
      }
      return { color: cand.toward, t: 1 };
    };
    let best = null;
    for (const cand of candidates) {
      const a = fit(bg, cand);
      const b = fit(bg2, cand);
      const cost = a.t + b.t;
      if (!best || cost < best.cost - 1e-9) best = { cand, a, b, cost };
    }
    const { cand, a, b } = best;
    return {
      bg: a.color,
      bg2: b.color,
      menu: mix(a.color, b.color, 0.5), // φόντο των πτυσσόμενων μενού
      fg: cand.fg,
      ...headerPalette(cand.light),
    };
  }

  return {
    LIST, GROUPS, get, bodyClasses, applyToBody, defineMonaco, FONTS, monoStack, uiStack, applyFonts,
    HEADER_COLORS, HEADER_DIRECTIONS, headerColorOf, headerStyle, headerImage, headerEdgeColor, luminance, contrast, mix,
  };
});
