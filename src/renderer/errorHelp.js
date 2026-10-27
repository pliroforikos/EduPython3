/*
 * Βοηθός λαθών: εξηγεί τα λάθη της Python 2.7 στα ελληνικά, με απλά λόγια.
 *
 * explain(err, ctx) -> { title, what, tips[], example?, suggestions?, translation, kind }
 *   err: μήνυμα "error" του runner (exc_type, message, location, names, from_input, ...)
 *   ctx: { lines: [γραμμές του προγράμματος] }
 *
 * Τα κείμενα χρησιμοποιούν `κώδικα` σε backticks και **έντονα**.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ErrorHelp = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- βοηθητικά
  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function similarNames(name, names, max) {
    if (!name || !names) return [];
    const lower = name.toLowerCase();
    const limit = name.length <= 3 ? 1 : 2;
    const scored = [];
    for (const n of names) {
      if (n === name) continue;
      let d = n.toLowerCase() === lower ? 0 : levenshtein(lower, n.toLowerCase());
      if (d <= limit) scored.push([d, n]);
    }
    scored.sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1]));
    // αν διαφέρει μόνο στα πεζά/κεφαλαία, αυτή είναι σίγουρα η απάντηση
    const exact = scored.filter((x) => x[0] === 0);
    return (exact.length ? exact : scored).slice(0, max || 3).map((x) => x[1]);
  }

  /** Η γραμμή χωρίς σχόλια και με κενά τα περιεχόμενα των strings. */
  function codeOnly(line) {
    if (!line) return '';
    let out = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quote) {
        if (ch === '\\') { out += '  '; i++; continue; }
        if (ch === quote) { quote = null; out += ch; continue; }
        out += ' ';
        continue;
      }
      if (ch === '#') break;
      if (ch === '"' || ch === "'") quote = ch;
      out += ch;
    }
    return out;
  }

  const OPEN = { '(': ')', '[': ']', '{': '}' };
  const CLOSE = { ')': '(', ']': '[', '}': '{' };

  /** Βρίσκει την πρώτη αγκύλη που δεν έκλεισε ως και τη γραμμή uptoLine. */
  function unclosedBracket(lines, uptoLine) {
    const stack = [];
    const last = Math.min(uptoLine || lines.length, lines.length);
    for (let ln = 0; ln < last; ln++) {
      const code = codeOnly(lines[ln]);
      for (let c = 0; c < code.length; c++) {
        const ch = code[c];
        if (OPEN[ch]) stack.push({ ch, line: ln + 1, col: c });
        else if (CLOSE[ch]) {
          if (stack.length && stack[stack.length - 1].ch === CLOSE[ch]) stack.pop();
          else return { extra: true, ch, line: ln + 1, col: c };
        }
      }
    }
    return stack.length ? stack[stack.length - 1] : null;
  }

  const SUSPICIOUS = {
    '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u00ab': '"', '\u00bb': '"',
    '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u0384': "'", '\u00b4': "'",
    '\u2013': '-', '\u2014': '-', '\u2212': '-',
    '\u037e': ';', '\u00a0': ' ', '\u2009': ' ', '\u200b': '',
    '\u00d7': '*', '\u00f7': '/', '\u2026': '...',
  };
  const SUSPICIOUS_NAMES = {
    '\u201c': 'καμπύλο εισαγωγικό “', '\u201d': 'καμπύλο εισαγωγικό ”', '\u201e': 'εισαγωγικό „',
    '\u00ab': 'ελληνικό εισαγωγικό «', '\u00bb': 'ελληνικό εισαγωγικό »',
    '\u2018': 'καμπύλο απόστροφο ‘', '\u2019': 'καμπύλο απόστροφο ’', '\u201a': 'απόστροφο ‚',
    '\u0384': 'ελληνικός τόνος ΄', '\u00b4': 'τόνος ´',
    '\u2013': 'μεσαία παύλα –', '\u2014': 'μεγάλη παύλα —', '\u2212': 'σύμβολο μείον −',
    '\u037e': 'ελληνικό ερωτηματικό ;', '\u00a0': 'αόρατο κενό (non-breaking space)',
    '\u2009': 'λεπτό κενό', '\u200b': 'αόρατος χαρακτήρας μηδενικού πλάτους',
    '\u00d7': 'σύμβολο επί ×', '\u00f7': 'σύμβολο διά ÷', '\u2026': 'αποσιωπητικά …',
  };

  /** Για κάθε χαρακτήρα της γραμμής: true αν είναι κώδικας (όχι μέσα σε string ή σχόλιο). */
  function codeMask(line) {
    const mask = new Array(line.length).fill(true);
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quote) {
        mask[i] = false;
        if (ch === '\\') { if (i + 1 < line.length) mask[++i] = false; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '#') { for (let j = i; j < line.length; j++) mask[j] = false; break; }
      if (ch === '"' || ch === "'") { quote = ch; mask[i] = false; }
    }
    return mask;
  }

  /** Χαρακτήρες που συνήθως έρχονται με αντιγραφή από PDF/Word και χαλάνε τον κώδικα
   *  (μόνο έξω από strings και σχόλια· εκεί μέσα είναι απολύτως έγκυροι). */
  function suspiciousChars(text) {
    const found = [];
    const lines = String(text).split(/\r\n|\r|\n/);
    lines.forEach((line, i) => {
      let mask = null;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (Object.prototype.hasOwnProperty.call(SUSPICIOUS, ch)) {
          mask = mask || codeMask(line);
          if (mask[c]) found.push({ line: i + 1, col: c, ch, replacement: SUSPICIOUS[ch], name: SUSPICIOUS_NAMES[ch] });
        }
      }
    });
    return found;
  }

  /** Διόρθωση όλων των ύποπτων χαρακτήρων του κώδικα (για «Διόρθωση εισαγωγικών»). */
  function fixSuspicious(text) {
    return String(text).split('\n').map((line) => {
      let cur = line;
      // ένας-ένας: μόλις ένα “ γίνει ", όσα ακολουθούν βρίσκονται πια μέσα σε string
      for (let guard = 0; guard < 500; guard++) {
        const mask = codeMask(cur);
        let idx = -1;
        for (let c = 0; c < cur.length; c++) {
          if (mask[c] && Object.prototype.hasOwnProperty.call(SUSPICIOUS, cur[c])) { idx = c; break; }
        }
        if (idx < 0) break;
        const rep = SUSPICIOUS[cur[idx]];
        // καμπύλο εισαγωγικό: αλλάζουμε μαζί και το ταίρι του, ώστε το περιεχόμενο να μείνει ανέγγιχτο
        const group = rep === '"' ? '“”„«»' : rep === "'" ? '‘’‚΄´' : '';
        let end = -1;
        if (group) {
          for (let c = idx + 1; c < cur.length; c++) if (group.includes(cur[c])) { end = c; break; }
        }
        if (end > idx) cur = cur.slice(0, idx) + rep + cur.slice(idx + 1, end) + rep + cur.slice(end + 1);
        else cur = cur.slice(0, idx) + rep + cur.slice(idx + 1);
      }
      return cur;
    }).join('\n');
  }

  const GREEK_RE = /[\u0370-\u03ff\u1f00-\u1fff]/;
  /** Ονόματα (εκτός strings/σχολίων) που περιέχουν ελληνικά γράμματα. */
  function greekIdentifiers(line) {
    const code = codeOnly(line);
    const m = code.match(/[A-Za-z_\u0370-\u03ff\u1f00-\u1fff][\w\u0370-\u03ff\u1f00-\u1fff]*/g) || [];
    return m.filter((w) => GREEK_RE.test(w));
  }

  const BLOCK_RE = /^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b/;

  const BUILTINS = ['abs', 'all', 'any', 'bin', 'bool', 'chr', 'cmp', 'dict', 'dir', 'divmod', 'enumerate',
    'eval', 'file', 'filter', 'float', 'format', 'help', 'hex', 'input', 'int', 'isinstance', 'len', 'list',
    'long', 'map', 'max', 'min', 'oct', 'open', 'ord', 'pow', 'range', 'raw_input', 'reduce', 'repr',
    'reversed', 'round', 'set', 'sorted', 'str', 'sum', 'tuple', 'type', 'unicode', 'xrange', 'zip',
    'True', 'False', 'None'];

  const MODULE_HINTS = {
    sqrt: 'math', pi: 'math', floor: 'math', ceil: 'math', sin: 'math', cos: 'math', tan: 'math',
    log: 'math', log10: 'math', exp: 'math', fabs: 'math', factorial: 'math', e: 'math', radians: 'math',
    degrees: 'math', hypot: 'math', trunc: 'math',
    randint: 'random', random: 'random', choice: 'random', shuffle: 'random', randrange: 'random',
    uniform: 'random', sample: 'random', seed: 'random',
    sleep: 'time', time: 'time', ctime: 'time',
    connect: 'sqlite3',
    Tk: 'Tkinter', Label: 'Tkinter', Button: 'Tkinter', Entry: 'Tkinter', Frame: 'Tkinter',
    Canvas: 'Tkinter', Text: 'Tkinter', StringVar: 'Tkinter', IntVar: 'Tkinter', END: 'Tkinter',
    Radiobutton: 'Tkinter', Checkbutton: 'Tkinter', Listbox: 'Tkinter', Scale: 'Tkinter',
    mainloop: 'Tkinter', showinfo: 'tkMessageBox', askyesno: 'tkMessageBox', showerror: 'tkMessageBox',
  };
  const MODULES = ['math', 'random', 'os', 'sys', 'time', 'sqlite3', 'string', 'Tkinter', 'tkMessageBox',
    'datetime', 'copy', 'turtle'];

  const TYPE_GR = {
    int: 'ακέραιος (int)', long: 'μεγάλος ακέραιος (long)', float: 'πραγματικός (float)',
    str: 'συμβολοσειρά (str)', unicode: 'συμβολοσειρά unicode', list: 'λίστα (list)',
    tuple: 'πλειάδα (tuple)', dict: 'λεξικό (dict)', bool: 'λογική τιμή (bool)', NoneType: 'None (καμία τιμή)',
    set: 'σύνολο (set)', function: 'συνάρτηση', builtin_function_or_method: 'ενσωματωμένη συνάρτηση',
    module: 'module', file: 'αρχείο (file)', instance: 'αντικείμενο',
  };
  const typeGr = (t) => TYPE_GR[t] || `\`${t}\``;

  // ----------------------------------------------------------- μεταφράσεις
  const TRANSLATIONS = [
    [/^(?:global )?name '(.+)' is not defined$/, "το όνομα '$1' δεν έχει οριστεί"],
    [/^local variable '(.+)' referenced before assignment$/, "η τοπική μεταβλητή '$1' χρησιμοποιήθηκε πριν πάρει τιμή"],
    [/^invalid syntax$/, 'μη έγκυρη σύνταξη'],
    [/^EOL while scanning string literal$/, 'η συμβολοσειρά (string) δεν κλείνει μέχρι το τέλος της γραμμής'],
    [/^EOF while scanning triple-quoted string literal$/, 'η συμβολοσειρά με τριπλά εισαγωγικά δεν κλείνει ποτέ'],
    [/^unexpected EOF while parsing$/, 'το πρόγραμμα τελείωσε ενώ κάτι έμεινε ανοιχτό'],
    [/^expected an indented block$/, 'περίμενα μπλοκ εντολών με εσοχή'],
    [/^unexpected indent$/, 'απροσδόκητη εσοχή'],
    [/^unindent does not match any outer indentation level$/, 'η εσοχή δεν ταιριάζει με κανένα προηγούμενο επίπεδο'],
    [/^inconsistent use of tabs and spaces in indentation$/, 'ανάμικτη χρήση Tab και κενών στην εσοχή'],
    [/^invalid token$/, 'μη έγκυρο σύμβολο'],
    [/^cannot concatenate '(\w+)' and '(\w+)' objects$/, "δεν μπορούν να ενωθούν τιμές τύπου '$1' και '$2'"],
    [/^unsupported operand type\(s\) for (.+): '(\w+)' and '(\w+)'$/, "η πράξη $1 δεν γίνεται ανάμεσα σε '$2' και '$3'"],
    [/^bad operand type for unary (.+): '(\w+)'$/, "η πράξη $1 δεν γίνεται σε '$2'"],
    [/^integer division or modulo by zero$/, 'ακέραια διαίρεση ή υπόλοιπο (%) με το μηδέν'],
    [/^float division by zero$/, 'διαίρεση με το μηδέν'],
    [/^float modulo$/, 'υπόλοιπο διαίρεσης με το μηδέν'],
    [/division by zero$/, 'διαίρεση με το μηδέν'],
    [/^list index out of range$/, 'η θέση (δείκτης) είναι έξω από τα όρια της λίστας'],
    [/^string index out of range$/, 'η θέση (δείκτης) είναι έξω από τα όρια της συμβολοσειράς'],
    [/^tuple index out of range$/, 'η θέση (δείκτης) είναι έξω από τα όρια της πλειάδας'],
    [/^list assignment index out of range$/, 'ανάθεση σε θέση της λίστας που δεν υπάρχει'],
    [/^pop from empty list$/, 'pop() από άδεια λίστα'],
    [/^pop index out of range$/, 'η θέση του pop() είναι έξω από τα όρια της λίστας'],
    [/^invalid literal for int\(\) with base 10: (.*)$/, 'η τιμή $1 δεν είναι ακέραιος αριθμός'],
    [/^invalid literal for long\(\) with base 10: (.*)$/, 'η τιμή $1 δεν είναι ακέραιος αριθμός'],
    [/^could not convert string to float: ?(.*)$/, 'η τιμή $1 δεν είναι πραγματικός αριθμός'],
    [/^'(\w+)' object is not callable$/, "η τιμή τύπου '$1' δεν είναι συνάρτηση για να την καλέσεις με ()"],
    [/^'module' object has no attribute '(\w+)'$/, "το module δεν έχει κάτι με όνομα '$1'"],
    [/^'(\w+)' object has no attribute '(\w+)'$/, "η τιμή τύπου '$1' δεν έχει μέθοδο ή ιδιότητα '$2'"],
    [/^(\w+) instance has no attribute '(\w+)'$/, "το αντικείμενο της κλάσης $1 δεν έχει ιδιότητα '$2'"],
    [/^'(\w+)' object does not support item assignment$/, "η τιμή τύπου '$1' δεν επιτρέπει αλλαγή των στοιχείων της"],
    [/^'(\w+)' object does not support item deletion$/, "η τιμή τύπου '$1' δεν επιτρέπει διαγραφή στοιχείων"],
    [/^'(\w+)' object has no attribute '__getitem__'$/, "η τιμή τύπου '$1' δεν έχει στοιχεία για να τα πάρεις με [ ]"],
    [/^'(\w+)' object is unsubscriptable$/, "η τιμή τύπου '$1' δεν έχει στοιχεία για να τα πάρεις με [ ]"],
    [/^(\w+)\(\) takes exactly (\d+) arguments? \((\d+) given\)$/, 'η $1() θέλει ακριβώς $2 ορίσματα, αλλά δόθηκαν $3'],
    [/^(\w+)\(\) takes at least (\d+) arguments? \((\d+) given\)$/, 'η $1() θέλει τουλάχιστον $2 ορίσματα, αλλά δόθηκαν $3'],
    [/^(\w+)\(\) takes at most (\d+) arguments? \((\d+) given\)$/, 'η $1() θέλει το πολύ $2 ορίσματα, αλλά δόθηκαν $3'],
    [/^(\w+)\(\) takes no arguments \((\d+) given\)$/, 'η $1() δεν θέλει ορίσματα, αλλά δόθηκαν $2'],
    [/^(\w+) expected (\d+) arguments?, got (\d+)$/, 'η $1 θέλει $2 ορίσματα, αλλά δόθηκαν $3'],
    [/No such file or directory: (.+)$/, 'δεν υπάρχει αρχείο ή φάκελος με όνομα $1'],
    [/Permission denied: (.+)$/, 'δεν επιτρέπεται η πρόσβαση στο $1'],
    [/^No module named (.+)$/, 'δεν υπάρχει module με όνομα $1'],
    [/^cannot import name (.+)$/, 'δεν βρέθηκε το $1 μέσα στο module'],
    [/^maximum recursion depth exceeded/, 'ξεπεράστηκε το μέγιστο βάθος αναδρομής'],
    [/^math domain error$/, 'η τιμή είναι εκτός πεδίου ορισμού της μαθηματικής συνάρτησης'],
    [/^math range error$/, 'το αποτέλεσμα είναι πολύ μεγάλο'],
    [/^too many values to unpack$/, 'περισσότερες τιμές από όσες μεταβλητές'],
    [/^need more than (\d+) values? to unpack$/, 'λιγότερες τιμές ($1) από όσες μεταβλητές'],
    [/^list\.remove\(x\): x not in list$/, 'η τιμή δεν υπάρχει στη λίστα'],
    [/^(.+) is not in list$/, 'η τιμή $1 δεν υπάρχει στη λίστα'],
    [/^substring not found$/, 'το κομμάτι κειμένου δεν βρέθηκε'],
    [/^argument of type '(\w+)' is not iterable$/, "ο τελεστής in δεν εφαρμόζεται σε τιμή τύπου '$1'"],
    [/^'(\w+)' object is not iterable$/, "η τιμή τύπου '$1' δεν διατρέχεται με for"],
    [/^object of type '(\w+)' has no len\(\)$/, "η τιμή τύπου '$1' δεν έχει μήκος (len)"],
    [/^list indices must be integers(?:, not (\w+))?$/, 'οι θέσεις μιας λίστας πρέπει να είναι ακέραιοι αριθμοί'],
    [/^string indices must be integers(?:, not (\w+))?$/, 'οι θέσεις μιας συμβολοσειράς πρέπει να είναι ακέραιοι αριθμοί'],
    [/^can't multiply sequence by non-int of type '(\w+)'$/, "δεν γίνεται πολλαπλασιασμός συμβολοσειράς/λίστας με τιμή τύπου '$1'"],
    [/^can't assign to (.+)$/, 'δεν γίνεται ανάθεση τιμής σε $1'],
    [/^'return' outside function$/, 'return έξω από συνάρτηση'],
    [/^'break' outside loop$/, 'break έξω από βρόχο'],
    [/^'continue' not properly in loop$/, 'continue έξω από βρόχο'],
    [/^not all arguments converted during string formatting$/, 'περισσεύουν τιμές στη μορφοποίηση με %'],
    [/^not enough arguments for format string$/, 'λείπουν τιμές στη μορφοποίηση με %'],
    [/^%d format: a number is required, not (\w+)$/, 'το %d θέλει αριθμό, όχι $1'],
    [/^range\(\) integer end argument expected, got (\w+)\.?$/, 'η range() θέλει ακέραιους, όχι $1'],
    [/^range\(\) step argument must not be zero$/, 'το βήμα της range() δεν μπορεί να είναι 0'],
    [/^unhashable type: '(\w+)'$/, "τιμή τύπου '$1' δεν μπορεί να γίνει κλειδί λεξικού ή στοιχείο συνόλου"],
    [/^empty range for randrange\(\)/, 'κενό διάστημα τιμών για τυχαίο αριθμό'],
    [/^You must not use 8-bit bytestrings/, 'η sqlite3 δεν δέχεται ελληνικά σε απλές συμβολοσειρές'],
    [/^no such table: (.+)$/, 'δεν υπάρχει πίνακας $1'],
    [/^no such column: (.+)$/, 'δεν υπάρχει στήλη $1'],
    [/^table (.+) already exists$/, 'ο πίνακας $1 υπάρχει ήδη'],
    [/^near "(.+)": syntax error$/, 'λάθος σύνταξη SQL κοντά στο "$1"'],
    [/^I\/O operation on closed file$/, 'χρήση αρχείου που έχει ήδη κλείσει'],
    [/^File not open for (reading|writing)$/, 'το αρχείο δεν άνοιξε για $1'],
    [/^non-default argument follows default argument$/, 'παράμετρος χωρίς προεπιλογή μετά από παράμετρο με προεπιλογή'],
    [/^keyword can't be an expression$/, 'μη έγκυρο όνομα παραμέτρου'],
    [/^Missing parentheses in call to/, 'λείπουν παρενθέσεις'],
  ];

  function translateMessage(message) {
    if (!message) return '';
    for (const [re, gr] of TRANSLATIONS) {
      if (re.test(message)) {
        return message.replace(re, gr).replace(/\$\d/g, '').replace('για reading', 'για ανάγνωση')
          .replace('για writing', 'για εγγραφή');
      }
    }
    return '';
  }

  // ----------------------------------------------------------- περιγραφές τύπων
  const GENERIC = {
    SyntaxError: ['Λάθος σύνταξης', 'Η Python δεν μπορεί να καταλάβει πώς είναι γραμμένη αυτή η γραμμή. Το πρόγραμμα **δεν ξεκίνησε καν**· πρέπει πρώτα να διορθωθεί η γραφή.'],
    IndentationError: ['Λάθος στην εσοχή', 'Η Python χρησιμοποιεί την εσοχή (τα κενά στην αρχή της γραμμής) για να ξέρει ποιες εντολές ανήκουν μέσα σε ένα if, for, while ή def.'],
    TabError: ['Ανάμικτα Tab και κενά', 'Στην εσοχή υπάρχουν και Tab και κενά. Η Python δεν μπορεί να καταλάβει πόσο μέσα είναι η γραμμή.'],
    NameError: ['Άγνωστο όνομα', 'Η Python συνάντησε ένα όνομα (μεταβλητή ή συνάρτηση) που δεν ξέρει τι είναι.'],
    UnboundLocalError: ['Μεταβλητή χωρίς τιμή μέσα σε συνάρτηση', 'Μια μεταβλητή χρησιμοποιήθηκε μέσα σε συνάρτηση πριν πάρει τιμή εκεί.'],
    TypeError: ['Λάθος τύπος τιμής', 'Μια πράξη ή συνάρτηση πήρε τιμή λάθος τύπου (π.χ. κείμενο εκεί που χρειάζεται αριθμός).'],
    ValueError: ['Μη αποδεκτή τιμή', 'Ο τύπος της τιμής είναι σωστός, αλλά η ίδια η τιμή δεν είναι αποδεκτή.'],
    ZeroDivisionError: ['Διαίρεση με το μηδέν', 'Το πρόγραμμα προσπάθησε να διαιρέσει με το 0 (με `/` ή `%`), κάτι που δεν ορίζεται στα μαθηματικά.'],
    IndexError: ['Θέση εκτός ορίων', 'Ζητήθηκε στοιχείο σε θέση (δείκτη) που δεν υπάρχει.'],
    KeyError: ['Το κλειδί δεν υπάρχει στο λεξικό', 'Ζητήθηκε από ένα λεξικό (dict) κλειδί που δεν υπάρχει μέσα του.'],
    AttributeError: ['Δεν υπάρχει τέτοια μέθοδος ή ιδιότητα', 'Μετά την τελεία (`.`) γράφτηκε όνομα που δεν υπάρχει για αυτόν τον τύπο τιμής.'],
    IOError: ['Πρόβλημα με αρχείο', 'Κάτι πήγε στραβά στο άνοιγμα, το διάβασμα ή το γράψιμο ενός αρχείου.'],
    OSError: ['Πρόβλημα του λειτουργικού συστήματος', 'Μια λειτουργία σε αρχείο ή φάκελο απέτυχε.'],
    ImportError: ['Το import απέτυχε', 'Η Python δεν βρήκε το module (βιβλιοθήκη) ή το όνομα που ζητήθηκε.'],
    RuntimeError: ['Σφάλμα κατά την εκτέλεση', 'Κάτι πήγε στραβά ενώ έτρεχε το πρόγραμμα.'],
    OverflowError: ['Πολύ μεγάλος αριθμός', 'Το αποτέλεσμα ενός υπολογισμού είναι πολύ μεγάλο για να αναπαρασταθεί.'],
    MemoryError: ['Τελείωσε η μνήμη', 'Το πρόγραμμα χρησιμοποίησε όλη τη διαθέσιμη μνήμη. Συνήθως φταίει ένας βρόχος που μεγαλώνει συνέχεια μια λίστα.'],
    UnicodeEncodeError: ['Πρόβλημα με ελληνικούς χαρακτήρες', 'Ένας χαρακτήρας δεν μπορεί να μετατραπεί στην κωδικοποίηση που χρησιμοποιείται.'],
    UnicodeDecodeError: ['Πρόβλημα με ελληνικούς χαρακτήρες', 'Κάποια bytes δεν αντιστοιχούν σε χαρακτήρες της κωδικοποίησης που χρησιμοποιείται.'],
    AssertionError: ['Ο έλεγχος assert απέτυχε', 'Η συνθήκη μιας εντολής `assert` βγήκε ψευδής (False).'],
    StopIteration: ['Τέλος επανάληψης', 'Ζητήθηκε επόμενο στοιχείο ενώ δεν υπάρχουν άλλα.'],
    EOFError: ['Δεν δόθηκε είσοδος', 'Η `raw_input()`/`input()` δεν πήρε καμία τιμή.'],
    KeyboardInterrupt: ['Διακοπή', 'Το πρόγραμμα διακόπηκε από τον χρήστη.'],
    'sqlite3.OperationalError': ['Λάθος στη βάση δεδομένων', 'Η εντολή SQL δεν μπόρεσε να εκτελεστεί.'],
    'sqlite3.ProgrammingError': ['Λάθος χρήσης της sqlite3', 'Η βιβλιοθήκη sqlite3 χρησιμοποιήθηκε με λάθος τρόπο.'],
    'sqlite3.IntegrityError': ['Παραβίαση κανόνα της βάσης', 'Η εγγραφή παραβιάζει έναν κανόνα του πίνακα (π.χ. διπλό πρωτεύον κλειδί).'],
    '_tkinter.TclError': ['Λάθος στο Tkinter', 'Το Tkinter (γραφικό περιβάλλον) δεν μπόρεσε να εκτελέσει την εντολή.'],
  };

  // ----------------------------------------------------------------- κανόνες
  function lineOf(err, ctx) {
    if (err.location && err.location.line != null) return err.location.line;
    const n = err.location && err.location.lineno;
    return (n && ctx.lines && ctx.lines[n - 1]) || '';
  }
  function lineNo(err) { return (err.location && err.location.lineno) || null; }
  function prevLine(err, ctx) {
    const n = lineNo(err);
    if (!n || !ctx.lines) return null;
    for (let i = n - 2; i >= 0; i--) {
      if (ctx.lines[i] && ctx.lines[i].trim() && !/^\s*#/.test(ctx.lines[i])) return { text: ctx.lines[i], no: i + 1 };
    }
    return null;
  }
  const msgIs = (err, re) => re.test(err.message || '');
  const isType = (err, ...types) => types.includes(err.exc_type);

  const RULES = [
    // --- Χαρακτήρες από PDF/Word -----------------------------------------
    {
      when: (err, ctx) => isType(err, 'SyntaxError', 'UnicodeEncodeError') && suspiciousChars(lineOf(err, ctx)).length,
      help: (err, ctx) => {
        const s = suspiciousChars(lineOf(err, ctx));
        const names = [...new Set(s.map((x) => x.name))];
        return {
          title: 'Ειδικοί χαρακτήρες από αντιγραφή (PDF/Word)',
          what: `Στη γραμμή ${lineNo(err)} υπάρχει ${names.join(', ')}. Μοιάζει με κανονικό σύμβολο, αλλά η Python δεν τον καταλαβαίνει. Συμβαίνει συχνά όταν αντιγράφουμε κώδικα από PDF, Word ή ιστοσελίδα.`,
          tips: [
            'Σβήσε τον χαρακτήρα και γράψε τον ξανά από το πληκτρολόγιο: εισαγωγικά `\'` ή `"`, μείον `-`.',
            'Ή χρησιμοποίησε το μενού **Επεξεργασία → Διόρθωση εισαγωγικών από PDF/Word**, που τα διορθώνει όλα μαζί.',
          ],
          example: { bad: 'print “Γεια σου”\nx = 10 – 1', good: 'print "Γεια σου"\nx = 10 - 1' },
        };
      },
    },
    // --- Ελληνικά ονόματα μεταβλητών ---------------------------------------
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && greekIdentifiers(lineOf(err, ctx)).length,
      help: (err, ctx) => {
        const words = greekIdentifiers(lineOf(err, ctx));
        return {
          title: 'Ελληνικά γράμματα σε όνομα μεταβλητής',
          what: `Το όνομα \`${words[0]}\` περιέχει ελληνικά γράμματα. Στην Python 2 τα ονόματα μεταβλητών και συναρτήσεων γράφονται **μόνο με λατινικούς χαρακτήρες**, ψηφία και \`_\`. Ελληνικά επιτρέπονται μόνο **μέσα σε εισαγωγικά** (κείμενο) και σε σχόλια.`,
          tips: [
            'Γράψε το όνομα με λατινικούς χαρακτήρες (greeklish), π.χ. `onoma`, `vathmos`, `athroisma`.',
            'Πρόσεξε μήπως άφησες το πληκτρολόγιο στα ελληνικά: το `Α` (άλφα) μοιάζει με `A` αλλά είναι διαφορετικό γράμμα.',
            'Αν ήθελες να γράψεις κείμενο, βάλε το σε εισαγωγικά: `"Καλημέρα"`.',
          ],
          example: { bad: 'όνομα = raw_input("Όνομα: ")', good: 'onoma = raw_input("Όνομα: ")' },
        };
      },
    },
    // --- print/f-string της Python 3 ---------------------------------------
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && /\bprint\s*\(.*\b(end|sep|file)\s*=/.test(lineOf(err, ctx)),
      help: () => ({
        title: 'Το print της Python 3 δεν υπάρχει στην Python 2',
        what: 'Στην Python 2.7 το `print` είναι **εντολή**, όχι συνάρτηση. Οι παράμετροι `end=` και `sep=` υπάρχουν μόνο στην Python 3.',
        tips: [
          'Για να μην αλλάξει γραμμή, βάλε **κόμμα στο τέλος**: `print x,`',
          'Για να τυπώσεις πολλές τιμές χωρισμένες με κενό: `print a, b, c`',
          'Για κολλητές τιμές, ένωσέ τες σε κείμενο: `print str(a) + "-" + str(b)`',
        ],
        example: { bad: 'for i in range(5):\n    print(i, end=" ")', good: 'for i in range(5):\n    print i,' },
      }),
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && /(^|[^\w])[fF]["']/.test(lineOf(err, ctx)),
      help: () => ({
        title: 'Τα f-strings δεν υπάρχουν στην Python 2',
        what: 'Η γραφή `f"..."` προστέθηκε στην Python 3.6. Στην Python 2.7 χρησιμοποιούμε τον τελεστή `%` ή τη μέθοδο `format`.',
        tips: ['`print "Βαθμός: %d" % vathmos`', '`print "Βαθμός: {}".format(vathmos)`', '`print "Βαθμός:", vathmos`'],
        example: { bad: 'print f"Σύνολο: {s}"', good: 'print "Σύνολο: %d" % s' },
      }),
    },
    // --- Συμβολοσειρές -----------------------------------------------------
    {
      when: (err) => isType(err, 'SyntaxError') && msgIs(err, /^EOL while scanning/),
      help: (err) => ({
        title: 'Δεν έκλεισαν τα εισαγωγικά',
        what: `Στη γραμμή ${lineNo(err)} ένα κείμενο (string) ανοίγει με εισαγωγικά αλλά δεν κλείνει πριν τελειώσει η γραμμή.`,
        tips: [
          'Βάλε στο τέλος του κειμένου το **ίδιο** είδος εισαγωγικών με την αρχή: `\'...\'` ή `"..."`.',
          'Αν το κείμενο περιέχει απόστροφο, χρησιμοποίησε διπλά εισαγωγικά γύρω του: `"I\'m here"`.',
          'Το χρώμα του κώδικα βοηθά: αν όλη η υπόλοιπη γραμμή έγινε πράσινη, εκεί είναι το πρόβλημα.',
        ],
        example: { bad: 'print "Καλημέρα', good: 'print "Καλημέρα"' },
      }),
    },
    {
      when: (err) => isType(err, 'SyntaxError') && msgIs(err, /^EOF while scanning triple-quoted/),
      help: () => ({
        title: 'Δεν έκλεισαν τα τριπλά εισαγωγικά',
        what: 'Κάπου ανοίγει κείμενο με `"""` ή `\'\'\'` που δεν κλείνει ποτέ, οπότε όλο το υπόλοιπο πρόγραμμα θεωρείται κείμενο.',
        tips: ['Βρες πού ξεκινούν τα τριπλά εισαγωγικά (το υπόλοιπο πρόγραμμα θα φαίνεται πράσινο) και κλείσε τα.'],
      }),
    },
    // --- Αγκύλες ------------------------------------------------------------
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && ctx.lines && (msgIs(err, /^unexpected EOF/) || msgIs(err, /^invalid syntax/)) &&
        (() => { const u = unclosedBracket(ctx.lines, lineNo(err) || ctx.lines.length); return u && !u.extra && u.line < (lineNo(err) || Infinity) + (msgIs(err, /EOF/) ? 1 : 0); })(),
      help: (err, ctx) => {
        const u = unclosedBracket(ctx.lines, lineNo(err) || ctx.lines.length);
        return {
          title: `Δεν έκλεισε η παρένθεση «${u.ch}» της γραμμής ${u.line}`,
          what: `Στη γραμμή ${u.line} άνοιξε \`${u.ch}\` που δεν κλείνει με \`${OPEN[u.ch]}\`. Η Python συνεχίζει να ψάχνει το κλείσιμο στις επόμενες γραμμές και γι' αυτό το λάθος μπορεί να φαίνεται λίγο πιο κάτω.`,
          tips: [
            `Πρόσθεσε το \`${OPEN[u.ch]}\` που λείπει στη γραμμή ${u.line}.`,
            'Μέτρησε: κάθε `(` θέλει το δικό της `)`. Ο editor χρωματίζει τα ζευγάρια με το ίδιο χρώμα.',
          ],
          example: { bad: 'x = int(raw_input("Δώσε αριθμό: ")\nprint x', good: 'x = int(raw_input("Δώσε αριθμό: "))\nprint x' },
          line: u.line,
        };
      },
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && ctx.lines && msgIs(err, /^invalid syntax/) &&
        (() => { const u = unclosedBracket(ctx.lines, lineNo(err)); return u && u.extra && u.line === lineNo(err); })(),
      help: (err, ctx) => {
        const u = unclosedBracket(ctx.lines, lineNo(err));
        return {
          title: `Περισσεύει το «${u.ch}»`,
          what: `Στη γραμμή ${u.line} κλείνει \`${u.ch}\` χωρίς να έχει ανοίξει αντίστοιχο \`${CLOSE[u.ch]}\`.`,
          tips: ['Σβήσε την παρένθεση που περισσεύει ή πρόσθεσε αυτή που λείπει στην αρχή.'],
        };
      },
    },
    {
      when: (err) => isType(err, 'SyntaxError') && msgIs(err, /^unexpected EOF/),
      help: () => ({
        title: 'Το πρόγραμμα τελειώνει απότομα',
        what: 'Η Python έφτασε στο τέλος του προγράμματος ενώ περίμενε συνέχεια: μια παρένθεση που δεν έκλεισε ή μια εντολή (if, for, def…) χωρίς σώμα.',
        tips: ['Έλεγξε την τελευταία γραμμή του προγράμματος.', 'Μέτρησε τις παρενθέσεις: κάθε `(` θέλει `)`.'],
      }),
    },
    // --- Άνω-κάτω τελεία ----------------------------------------------------
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && msgIs(err, /^invalid syntax/) && (() => {
        const code = codeOnly(lineOf(err, ctx)).trimEnd();
        return BLOCK_RE.test(code) && !code.endsWith(':');
      })(),
      help: (err, ctx) => {
        const kw = BLOCK_RE.exec(codeOnly(lineOf(err, ctx)))[1];
        const ex = {
          if: ['if x > 0\n    print "θετικός"', 'if x > 0:\n    print "θετικός"'],
          elif: ['elif x < 0\n    print "αρνητικός"', 'elif x < 0:\n    print "αρνητικός"'],
          else: ['else\n    print "μηδέν"', 'else:\n    print "μηδέν"'],
          for: ['for i in range(10)\n    print i', 'for i in range(10):\n    print i'],
          while: ['while x > 0\n    x = x - 1', 'while x > 0:\n    x = x - 1'],
          def: ['def embadon(a, b)\n    return a * b', 'def embadon(a, b):\n    return a * b'],
        }[kw] || ['class A\n    pass', 'class A:\n    pass'];
        return {
          title: `Λείπει η άνω-κάτω τελεία (:) μετά το ${kw}`,
          what: `Η γραμμή ${lineNo(err)} ξεκινά με \`${kw}\`. Οι εντολές \`if\`, \`elif\`, \`else\`, \`for\`, \`while\`, \`def\` πρέπει να τελειώνουν με **\`:\`**, και οι εντολές που ανήκουν σε αυτές γράφονται από κάτω με εσοχή.`,
          tips: [`Πρόσθεσε \`:\` στο τέλος της γραμμής ${lineNo(err)}.`],
          example: { bad: ex[0], good: ex[1] },
        };
      },
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && /^\s*else\s+if\b/.test(lineOf(err, ctx)),
      help: () => ({
        title: 'Γράφεται elif, όχι else if',
        what: 'Στην Python, το «αλλιώς αν» γράφεται με μία λέξη: `elif`.',
        tips: ['Άλλαξε το `else if` σε `elif`.'],
        example: { bad: 'else if x == 0:', good: 'elif x == 0:' },
      }),
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && msgIs(err, /^invalid syntax/) &&
        /^\s*(if|elif|while)\b/.test(lineOf(err, ctx)) && /[^=!<>]=[^=]/.test(codeOnly(lineOf(err, ctx))),
      help: () => ({
        title: 'Στη σύγκριση χρησιμοποιούμε == και όχι =',
        what: 'Το `=` **δίνει τιμή** σε μεταβλητή (ανάθεση). Για να **ελέγξεις** αν δύο τιμές είναι ίσες, χρειάζεται το διπλό `==`.',
        tips: ['Άλλαξε το `=` σε `==` μέσα στη συνθήκη.', 'Θυμήσου και τους άλλους τελεστές: `!=` (διάφορο), `<=`, `>=`.'],
        example: { bad: 'if vathmos = 20:', good: 'if vathmos == 20:' },
      }),
    },
    {
      when: (err) => isType(err, 'SyntaxError') && msgIs(err, /^can't assign to/),
      help: (err, ctx) => ({
        title: 'Λάθος σειρά στην ανάθεση',
        what: 'Στην ανάθεση, **αριστερά** του `=` μπαίνει πάντα ένα **όνομα μεταβλητής** και δεξιά η τιμή ή η παράσταση. Εδώ αριστερά υπάρχει τιμή, πράξη ή κλήση συνάρτησης.',
        tips: [
          'Γύρισε ανάποδα την ανάθεση: `x = 5` και όχι `5 = x`.',
          /^\s*(if|elif|while)\b/.test(lineOf(err, ctx)) ? 'Αν ήθελες σύγκριση, χρησιμοποίησε `==`.' : 'Αν ήθελες σύγκριση, χρησιμοποίησε `==` μέσα σε `if`.',
        ],
        example: { bad: 'x + 1 = y', good: 'y = x + 1' },
      }),
    },
    {
      when: (err) => isType(err, 'SyntaxError') && msgIs(err, /outside function/),
      help: () => ({
        title: 'return έξω από συνάρτηση',
        what: 'Η εντολή `return` επιστρέφει τιμή από μια συνάρτηση, οπότε μπαίνει μόνο **μέσα** σε `def`, με εσοχή.',
        tips: ['Έλεγξε την εσοχή: το `return` πρέπει να είναι πιο μέσα από το `def`.', 'Για να τυπώσεις αποτέλεσμα στο κύριο πρόγραμμα, χρησιμοποίησε `print`.'],
        example: { bad: 'def diplo(x):\n    y = 2 * x\nreturn y', good: 'def diplo(x):\n    y = 2 * x\n    return y' },
      }),
    },
    {
      when: (err) => isType(err, 'SyntaxError') && msgIs(err, /'(break|continue)'/),
      help: () => ({
        title: 'break/continue έξω από βρόχο',
        what: 'Τα `break` και `continue` λειτουργούν μόνο **μέσα** σε βρόχο `for` ή `while`.',
        tips: ['Έλεγξε την εσοχή της γραμμής.'],
      }),
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && msgIs(err, /^invalid token/) && /\b0\d+/.test(lineOf(err, ctx)),
      help: () => ({
        title: 'Αριθμός που ξεκινά με 0',
        what: 'Στην Python 2, ακέραιος που ξεκινά με `0` θεωρείται **οκταδικός** (π.χ. `010` = 8), και τα ψηφία 8 και 9 δεν επιτρέπονται.',
        tips: ['Γράψε τον αριθμό χωρίς μηδενικά μπροστά: `8` αντί για `08`.'],
      }),
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && msgIs(err, /^invalid syntax/) &&
        /^\s*[A-Za-z_]\w*(\s+[A-Za-z_]\w*)+\s*=[^=]/.test(codeOnly(lineOf(err, ctx))) &&
        !/^\s*(print|return|del|if|elif|while|for|import|from|global|assert|exec|raise|not)\b/.test(lineOf(err, ctx)),
      help: () => ({
        title: 'Κενό μέσα σε όνομα μεταβλητής',
        what: 'Το όνομα μιας μεταβλητής πρέπει να είναι **μία λέξη**, χωρίς κενά.',
        tips: ['Ένωσε τις λέξεις με κάτω παύλα: `mesos_oros` ή `mesosOros`.'],
        example: { bad: 'mesos oros = s / n', good: 'mesos_oros = s / n' },
      }),
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && /^\s*\d+[A-Za-z_]\w*\s*=/.test(lineOf(err, ctx)),
      help: () => ({
        title: 'Όνομα μεταβλητής που ξεκινά με ψηφίο',
        what: 'Τα ονόματα μεταβλητών δεν επιτρέπεται να ξεκινούν με ψηφίο.',
        tips: ['Ξεκίνα με γράμμα: `x2` αντί για `2x`.'],
      }),
    },
    {
      when: (err, ctx) => isType(err, 'SyntaxError') && msgIs(err, /^invalid syntax/) && (() => {
        const p = prevLine(err, ctx);
        return p && /\\\s*$/.test(p.text) === false && BLOCK_RE.test(p.text) && !codeOnly(p.text).trimEnd().endsWith(':');
      })(),
      help: (err, ctx) => {
        const p = prevLine(err, ctx);
        return {
          title: `Λείπει η άνω-κάτω τελεία (:) στη γραμμή ${p.no}`,
          what: `Η γραμμή ${p.no} ξεκινά εντολή που τελειώνει με \`:\`.`,
          tips: [`Πρόσθεσε \`:\` στο τέλος της γραμμής ${p.no}.`],
          line: p.no,
        };
      },
    },
    // --- Εσοχές --------------------------------------------------------------
    {
      when: (err) => msgIs(err, /^expected an indented block/),
      help: (err, ctx) => {
        const p = prevLine(err, ctx);
        return {
          title: 'Λείπει η εσοχή',
          what: `Μετά από γραμμή που τελειώνει με \`:\`${p ? ` (γραμμή ${p.no})` : ''}, οι εντολές που ανήκουν σε αυτήν πρέπει να γράφονται **πιο μέσα** (συνήθως 4 κενά).`,
          tips: [
            `Πάτησε Tab (ή 4 κενά) στην αρχή της γραμμής ${lineNo(err)}.`,
            'Αν δεν θέλεις ακόμα να γράψεις τίποτα μέσα στο μπλοκ, βάλε την εντολή `pass`.',
          ],
          example: { bad: 'for i in range(3):\nprint i', good: 'for i in range(3):\n    print i' },
        };
      },
    },
    {
      when: (err) => msgIs(err, /^unexpected indent/),
      help: (err) => ({
        title: 'Περιττή εσοχή',
        what: `Η γραμμή ${lineNo(err)} είναι πιο μέσα από όσο πρέπει. Εσοχή μπαίνει **μόνο** μετά από γραμμή που τελειώνει με \`:\`.`,
        tips: ['Σβήσε τα κενά στην αρχή της γραμμής ώστε να ευθυγραμμιστεί με τις γραμμές πάνω της.'],
        example: { bad: 'x = 5\n    y = 10', good: 'x = 5\ny = 10' },
      }),
    },
    {
      when: (err) => msgIs(err, /^unindent does not match/),
      help: (err) => ({
        title: 'Η εσοχή δεν ταιριάζει',
        what: `Η γραμμή ${lineNo(err)} έχει διαφορετικό αριθμό κενών από τις γραμμές του ίδιου μπλοκ. Οι γραμμές που ανήκουν μαζί πρέπει να ξεκινούν **ακριβώς** στην ίδια στήλη.`,
        tips: [
          'Ευθυγράμμισε τη γραμμή με το `if`/`for`/`while` στο οποίο ανήκει.',
          'Ενεργοποίησε **Προβολή → Εμφάνιση κενών** για να μετρήσεις τα κενά.',
        ],
        example: { bad: 'if x > 0:\n    print "α"\n  print "β"', good: 'if x > 0:\n    print "α"\n    print "β"' },
      }),
    },
    {
      when: (err) => isType(err, 'TabError') || msgIs(err, /inconsistent use of tabs/),
      help: () => ({
        title: 'Ανάμικτα Tab και κενά',
        what: 'Στις εσοχές υπάρχουν και χαρακτήρες Tab και κενά. Δεν φαίνονται διαφορετικά, αλλά η Python τα μετράει διαφορετικά.',
        tips: ['Ενεργοποίησε **Προβολή → Εμφάνιση κενών** και αντικατέστησε τα Tab με 4 κενά.', 'Ο editor μετατρέπει αυτόματα το Tab σε κενά όταν γράφεις· το πρόβλημα έρχεται συνήθως από επικόλληση.'],
      }),
    },
    // --- NameError ---------------------------------------------------------------
    {
      when: (err) => isType(err, 'NameError', 'SyntaxError') && err.from_input,
      help: (err) => ({
        title: 'Έδωσες κείμενο στην input()',
        what: `Στην Python 2 η \`input()\` **υπολογίζει** ό,τι πληκτρολογηθεί σαν να ήταν κώδικας Python. Γράφοντας ${err.last_input ? `«${err.last_input}»` : 'μια λέξη'}, η Python το πέρασε για όνομα μεταβλητής ή για παράσταση και δεν το βρήκε.`,
        tips: [
          'Για **κείμενο** (ονόματα, απαντήσεις ναι/όχι κ.λπ.) χρησιμοποίησε `raw_input()`.',
          'Για **αριθμούς** μπορείς να χρησιμοποιήσεις `int(raw_input())` ή `float(raw_input())`.',
          'Η `input()` είναι κατάλληλη μόνο όταν ο χρήστης δίνει αριθμό.',
        ],
        example: { bad: 'onoma = input("Όνομα: ")', good: 'onoma = raw_input("Όνομα: ")' },
      }),
    },
    {
      when: (err) => isType(err, 'NameError') && /'(true|false|none|TRUE|FALSE)'/.test(err.message || ''),
      help: (err) => {
        const w = /'(\w+)'/.exec(err.message)[1];
        const right = w[0].toUpperCase() + w.slice(1).toLowerCase();
        return {
          title: `Γράφεται ${right} με κεφαλαίο το πρώτο γράμμα`,
          what: `Οι λογικές τιμές στην Python είναι \`True\`, \`False\` και \`None\`, με κεφαλαίο πρώτο γράμμα. Το \`${w}\` είναι για την Python άγνωστο όνομα.`,
          tips: [`Γράψε \`${right}\`.`],
          suggestions: [right],
        };
      },
    },
    {
      when: (err) => isType(err, 'NameError'),
      help: (err, ctx) => {
        const m = /name '(.+?)' is not defined/.exec(err.message || '');
        const name = m ? m[1] : '';
        const sugg = similarNames(name, err.names || BUILTINS, 3);
        const tips = [];
        let title = `Το όνομα «${name}» δεν υπάρχει`;
        // ορίζεται αργότερα;
        let laterLine = null;
        if (ctx.lines && name) {
          const defRe = new RegExp(`^\\s*(def\\s+${name}\\b|${name}\\s*=[^=]|for\\s+${name}\\b|import\\s+${name}\\b)`);
          for (let i = (lineNo(err) || 0); i < ctx.lines.length; i++) {
            if (defRe.test(ctx.lines[i])) { laterLine = i + 1; break; }
          }
        }
        const mod = MODULE_HINTS[name];
        if (MODULES.includes(name)) {
          title = `Ξέχασες το import ${name}`;
          tips.push(`Γράψε \`import ${name}\` στην αρχή του προγράμματος.`);
        } else if (mod) {
          title = `Το ${name} ανήκει στο module ${mod}`;
          tips.push(`Γράψε στην αρχή \`from ${mod} import ${name}\` ή \`import ${mod}\` και χρησιμοποίησε \`${mod}.${name}\`.`);
        }
        if (laterLine) {
          tips.push(`Το \`${name}\` παίρνει τιμή αργότερα, στη γραμμή ${laterLine}. Η Python εκτελεί τις εντολές με τη σειρά, οπότε πρέπει να οριστεί **πριν** χρησιμοποιηθεί.`);
        }
        if (sugg.length) {
          tips.unshift(`Μήπως εννοείς ${sugg.map((s) => `\`${s}\``).join(' ή ')}; Η Python ξεχωρίζει πεζά/κεφαλαία και κάθε γράμμα μετράει.`);
        }
        if (!sugg.length && !mod && !laterLine && !MODULES.includes(name)) {
          tips.push('Αν είναι μεταβλητή, δώσε της πρώτα τιμή (π.χ. `athroisma = 0`) πριν τη χρησιμοποιήσεις.');
          tips.push(`Αν ήθελες να γράψεις κείμενο, βάλε το σε εισαγωγικά: \`"${name}"\`.`);
        }
        return {
          title,
          what: `Η Python βρήκε το όνομα \`${name}\` αλλά δεν ξέρει τι είναι: δεν έχει οριστεί ως μεταβλητή ή συνάρτηση, ή δεν έγινε import.`,
          tips,
          suggestions: sugg,
        };
      },
    },
    {
      when: (err) => isType(err, 'UnboundLocalError'),
      help: (err) => {
        const m = /local variable '(.+?)'/.exec(err.message || '');
        const name = m ? m[1] : 'x';
        return {
          title: `Η μεταβλητή «${name}» μέσα στη συνάρτηση δεν έχει τιμή`,
          what: `Μέσα στη συνάρτηση γίνεται ανάθεση στο \`${name}\`, οπότε η Python το θεωρεί **τοπική** μεταβλητή της συνάρτησης. Χρησιμοποιήθηκε όμως πριν πάρει τιμή μέσα σε αυτήν. Η καθολική μεταβλητή με το ίδιο όνομα δεν χρησιμοποιείται.`,
          tips: [
            `Αν θέλεις να αλλάξεις την καθολική μεταβλητή, γράψε \`global ${name}\` στην αρχή της συνάρτησης.`,
            'Καλύτερα: πέρασε την τιμή ως παράμετρο και επέστρεψε το αποτέλεσμα με `return`.',
          ],
          example: {
            bad: `${name} = 0\ndef afxisi():\n    ${name} = ${name} + 1`,
            good: `${name} = 0\ndef afxisi():\n    global ${name}\n    ${name} = ${name} + 1`,
          },
        };
      },
    },
    // --- TypeError ---------------------------------------------------------------
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^cannot concatenate 'str' and '(int|float|long|list|NoneType)'|^unsupported operand type\(s\) for \+: '(int|float|long)' and 'str'|coercing to Unicode/),
      help: (err) => ({
        title: 'Ένωση κειμένου με αριθμό',
        what: 'Το `+` ανάμεσα σε **κείμενο** (str) και **αριθμό** δεν επιτρέπεται: η Python δεν ξέρει αν θέλεις πρόσθεση αριθμών ή ένωση κειμένων.',
        tips: [
          'Μετάτρεψε τον αριθμό σε κείμενο με `str()`: `"Σύνολο: " + str(s)`',
          'Ή απλά χώρισε με κόμμα στο print: `print "Σύνολο:", s`',
          'Αν ήθελες αριθμητική πρόσθεση, μετάτρεψε το κείμενο σε αριθμό με `int()` ή `float()`.',
        ],
        example: { bad: 'print "Ο μέσος όρος είναι " + mo', good: 'print "Ο μέσος όρος είναι " + str(mo)' },
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^unsupported operand type\(s\) for .+: '(str|int|float)' and '(str|int|float)'|^bad operand type for unary/),
      help: (err) => {
        const m = /for (.+?): '(\w+)' and '(\w+)'/.exec(err.message || '');
        return {
          title: 'Πράξη ανάμεσα σε κείμενο και αριθμό',
          what: m
            ? `Η πράξη \`${m[1]}\` δεν γίνεται ανάμεσα σε ${typeGr(m[2])} και ${typeGr(m[3])}. Συνήθως συμβαίνει όταν μια τιμή διαβάστηκε με \`raw_input()\`, που επιστρέφει **πάντα κείμενο**.`
            : 'Η πράξη δεν γίνεται σε αυτόν τον τύπο τιμής.',
          tips: [
            'Μετάτρεψε την είσοδο σε αριθμό: `x = int(raw_input("Δώσε αριθμό: "))`',
            'Για δεκαδικούς: `x = float(raw_input(...))`',
          ],
          example: { bad: 'x = raw_input("x: ")\nprint x * 2 - 1', good: 'x = int(raw_input("x: "))\nprint x * 2 - 1' },
        };
      },
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^unsupported operand type\(s\) for .+: '(NoneType)'|'NoneType'/),
      help: () => ({
        title: 'Χρήση της τιμής None',
        what: 'Μια τιμή είναι `None` (δηλαδή «τίποτα»). Συνήθως συμβαίνει όταν μια συνάρτηση **δεν έχει `return`** ή όταν αποθηκεύεται το αποτέλεσμα μεθόδων όπως `sort()` και `append()`, που επιστρέφουν `None`.',
        tips: [
          'Βεβαιώσου ότι η συνάρτησή σου τελειώνει με `return τιμή`.',
          'Μη γράφεις `lista = lista.sort()`· αρκεί `lista.sort()`.',
        ],
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^can't multiply sequence by non-int/),
      help: () => ({
        title: 'Πολλαπλασιασμός κειμένου',
        what: 'Ένα κείμενο (ή λίστα) πολλαπλασιάζεται μόνο με ακέραιο, για να επαναληφθεί (π.χ. `"ab" * 3`). Πιθανότατα η τιμή διαβάστηκε με `raw_input()` και είναι κείμενο αντί για αριθμός.',
        tips: ['Μετάτρεψε την τιμή σε αριθμό με `int()` ή `float()` πριν τον πολλαπλασιασμό.'],
        example: { bad: 'timi = raw_input("Τιμή: ")\nprint timi * 1.24', good: 'timi = float(raw_input("Τιμή: "))\nprint timi * 1.24' },
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /object is not callable/),
      help: (err, ctx) => {
        const t = (/^'(\w+)'/.exec(err.message) || [])[1];
        const line = codeOnly(lineOf(err, ctx));
        const tips = [];
        const shadow = ctx.lines ? BUILTINS.filter((b) => ctx.lines.some((l) => new RegExp(`^\\s*${b}\\s*=[^=]`).test(l)) &&
          new RegExp(`\\b${b}\\s*\\(`).test(line)) : [];
        if (shadow.length) {
          tips.push(`Έδωσες σε μεταβλητή το όνομα \`${shadow[0]}\`, που είναι και όνομα ενσωματωμένης συνάρτησης. Από εκεί και πέρα η \`${shadow[0]}()\` δεν λειτουργεί. Μετονόμασε τη μεταβλητή (π.χ. \`${shadow[0]}1\` ή \`athroisma\`).`);
        }
        if (/(\d|\))\s*\(/.test(line)) {
          tips.push('Λείπει μάλλον το `*`: στα μαθηματικά γράφουμε `2(x+1)`, αλλά στην Python χρειάζεται `2 * (x + 1)`.');
        }
        if (!tips.length) tips.push('Έλεγξε μήπως μια μεταβλητή έχει το ίδιο όνομα με μια συνάρτηση ή μήπως λείπει τελεστής πριν από την παρένθεση.');
        return {
          title: 'Κλήση σε κάτι που δεν είναι συνάρτηση',
          what: `Μετά από μια τιμή τύπου ${typeGr(t)} υπάρχουν παρενθέσεις \`( )\`, σαν να ήταν συνάρτηση.`,
          tips,
          example: { bad: 'y = 2(x + 1)', good: 'y = 2 * (x + 1)' },
        };
      },
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /takes (exactly|at least|at most|no) /),
      help: (err) => {
        const m = /^(\w+)\(\) takes \w+(?: (\d+))? arguments? \((\d+) given\)/.exec(err.message || '') || [];
        return {
          title: 'Λάθος πλήθος ορισμάτων',
          what: `Η συνάρτηση \`${m[1] || '?'}()\` κλήθηκε με διαφορετικό αριθμό τιμών από όσες παραμέτρους έχει στο \`def\`.`,
          tips: [
            'Σύγκρινε την κλήση με τον ορισμό της συνάρτησης: κάθε παράμετρος θέλει μία τιμή.',
            'Σε μεθόδους κλάσεων, η Python μετράει και το `self` στα «given».',
          ],
          example: { bad: 'def embadon(a, b):\n    return a * b\nprint embadon(5)', good: 'def embadon(a, b):\n    return a * b\nprint embadon(5, 3)' },
        };
      },
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^'(str|tuple|unicode)' object does not support item (assignment|deletion)/),
      help: (err) => {
        const isStr = /'(str|unicode)'/.test(err.message);
        return {
          title: isStr ? 'Οι συμβολοσειρές δεν αλλάζουν' : 'Οι πλειάδες δεν αλλάζουν',
          what: isStr
            ? 'Μια συμβολοσειρά (str) **δεν μπορεί να αλλάξει** (είναι immutable). Δεν μπορείς να αλλάξεις έναν χαρακτήρα της με `s[i] = ...`.'
            : 'Μια πλειάδα (tuple) **δεν μπορεί να αλλάξει** μετά τη δημιουργία της.',
          tips: isStr
            ? ['Φτιάξε νέα συμβολοσειρά: `s = s[:i] + "Χ" + s[i+1:]`', 'Ή μετάτρεψέ την σε λίστα: `l = list(s)`, άλλαξε τη λίστα και μετά `s = "".join(l)`.']
            : ['Χρησιμοποίησε λίστα `[ ]` αντί για πλειάδα `( )` αν χρειάζεται να αλλάζουν τα στοιχεία.'],
        };
      },
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /indices must be integers/),
      help: (err) => ({
        title: 'Η θέση (δείκτης) πρέπει να είναι ακέραιος',
        what: 'Μέσα στις αγκύλες `[ ]` μπαίνει ακέραιος αριθμός θέσης. Εδώ μπήκε ' + (/not str/.test(err.message) ? 'κείμενο (μάλλον από `raw_input()`).' : /not float/.test(err.message) ? 'δεκαδικός αριθμός.' : 'τιμή άλλου τύπου.'),
        tips: [
          'Μετάτρεψε τη θέση σε ακέραιο: `lista[int(i)]`.',
          'Για το μέσο μιας λίστας χρησιμοποίησε ακέραιη διαίρεση: `mesi = (first + last) // 2`.',
        ],
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^'(int|float|long|NoneType)' object is not iterable/),
      help: () => ({
        title: 'Η for χρειάζεται λίστα ή range',
        what: 'Η `for` διατρέχει τα στοιχεία μιας ακολουθίας (λίστα, συμβολοσειρά, `range`). Ένας αριθμός δεν έχει στοιχεία.',
        tips: ['Για επανάληψη N φορές γράψε `for i in range(N):`'],
        example: { bad: 'for i in 10:', good: 'for i in range(10):' },
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /has no len\(\)/),
      help: () => ({
        title: 'Ο αριθμός δεν έχει μήκος',
        what: 'Η `len()` δίνει το πλήθος στοιχείων λίστας, συμβολοσειράς, πλειάδας ή λεξικού. Ένας αριθμός δεν έχει μήκος.',
        tips: ['Για το πλήθος ψηφίων ενός αριθμού: `len(str(x))`.'],
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^'(int|float|NoneType)' object (has no attribute '__getitem__'|is unsubscriptable)/),
      help: () => ({
        title: 'Αγκύλες [ ] σε αριθμό',
        what: 'Οι αγκύλες `[ ]` παίρνουν στοιχείο από λίστα ή συμβολοσειρά. Η μεταβλητή εδώ είναι αριθμός (ή `None`).',
        tips: ['Έλεγξε ότι η μεταβλητή είναι πράγματι λίστα· μήπως της έδωσες κατά λάθος αριθμό πιο πάνω;'],
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /string formatting|format string|format: a number is required/),
      help: () => ({
        title: 'Λάθος στη μορφοποίηση με %',
        what: 'Το πλήθος και ο τύπος των `%d`, `%s`, `%f` στο κείμενο πρέπει να ταιριάζουν με τις τιμές μετά το `%`.',
        tips: [
          'Για πολλές τιμές χρησιμοποίησε πλειάδα: `"%s: %d" % (onoma, vathmos)`',
          '`%d` για ακέραιους, `%f` ή `%.2f` για δεκαδικούς, `%s` για κείμενο.',
        ],
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^range\(\) integer/),
      help: () => ({
        title: 'Η range() θέλει ακέραιους',
        what: 'Οι τιμές της `range()` πρέπει να είναι ακέραιοι. Εδώ δόθηκε δεκαδικός ή κείμενο.',
        tips: ['Χρησιμοποίησε `int(...)`: `range(int(n))`.', 'Αν η τιμή ήρθε από `raw_input()`, μετάτρεψέ την με `int()`.'],
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /^unhashable type/),
      help: () => ({
        title: 'Μη αποδεκτό κλειδί λεξικού',
        what: 'Τα κλειδιά ενός λεξικού πρέπει να είναι τιμές που δεν αλλάζουν (αριθμοί, κείμενο, πλειάδες). Μια λίστα δεν μπορεί να είναι κλειδί.',
        tips: ['Μετάτρεψε τη λίστα σε πλειάδα: `tuple(lista)`.'],
      }),
    },
    {
      when: (err) => isType(err, 'TypeError') && msgIs(err, /argument of type .* is not iterable/),
      help: () => ({
        title: 'Το in θέλει λίστα ή κείμενο',
        what: 'Ο τελεστής `in` ελέγχει αν κάτι υπάρχει μέσα σε λίστα, συμβολοσειρά ή λεξικό. Δεν εφαρμόζεται σε αριθμό.',
        tips: ['Για αριθμούς χρησιμοποίησε σύγκριση: `x == 5`.'],
      }),
    },
    // --- ValueError ---------------------------------------------------------------
    {
      when: (err) => isType(err, 'ValueError') && msgIs(err, /^invalid literal for (int|long)\(\)/),
      help: (err) => {
        const v = (/: (.*)$/.exec(err.message) || [])[1] || '';
        const inner = v.replace(/^'|'$/g, '');
        const tips = [];
        if (inner === '') tips.push('Πατήθηκε Enter χωρίς να γραφτεί τίποτα. Δοκίμασε ξανά και γράψε έναν αριθμό.');
        else if (/^-?\d+[.,]\d*$/.test(inner)) tips.push(`Το «${inner}» είναι δεκαδικός· για δεκαδικούς χρησιμοποίησε \`float()\` αντί για \`int()\`${/,/.test(inner) ? ' και τελεία αντί για κόμμα' : ''}.`);
        else if (/^\s|\s$/.test(inner)) tips.push('Υπάρχουν κενά πριν ή μετά τον αριθμό.');
        else tips.push(`Το «${inner}» δεν είναι αριθμός. Όταν το πρόγραμμα ζητά αριθμό, δώσε μόνο ψηφία.`);
        tips.push('Για να μην «σκάει» το πρόγραμμα, μπορείς να ελέγξεις την είσοδο με `if s.isdigit():` πριν από τη μετατροπή.');
        return {
          title: 'Η τιμή δεν είναι ακέραιος αριθμός',
          what: `Η \`int()\` μετατρέπει κείμενο σε ακέραιο, μόνο όταν το κείμενο αποτελείται από ψηφία. Πήρε όμως το ${v}.`,
          tips,
        };
      },
    },
    {
      when: (err) => isType(err, 'ValueError') && msgIs(err, /^could not convert string to float/),
      help: (err) => ({
        title: 'Η τιμή δεν είναι αριθμός',
        what: 'Η `float()` πήρε κείμενο που δεν είναι αριθμός.',
        tips: [/,/.test(err.message) ? 'Στην Python οι δεκαδικοί γράφονται με **τελεία**: `3.5` και όχι `3,5`.' : 'Δώσε αριθμό, π.χ. `12` ή `3.5`.'],
      }),
    },
    {
      when: (err) => isType(err, 'ValueError') && msgIs(err, /not in list|substring not found/),
      help: () => ({
        title: 'Η τιμή δεν βρέθηκε',
        what: 'Οι μέθοδοι `remove()` και `index()` προκαλούν λάθος όταν η τιμή που ζητήθηκε δεν υπάρχει.',
        tips: ['Έλεγξε πρώτα αν υπάρχει: `if x in lista: lista.remove(x)`', 'Για συμβολοσειρές, η `find()` επιστρέφει -1 αντί για λάθος.'],
      }),
    },
    {
      when: (err) => isType(err, 'ValueError') && msgIs(err, /to unpack/),
      help: () => ({
        title: 'Δεν ταιριάζει το πλήθος τιμών με το πλήθος μεταβλητών',
        what: 'Σε μια ανάθεση όπως `a, b = ...`, το δεξί μέρος πρέπει να έχει **ακριβώς** τόσες τιμές όσες μεταβλητές υπάρχουν αριστερά.',
        tips: ['Μέτρησε τις μεταβλητές αριστερά και τις τιμές δεξιά.', 'Στο `for k, v in lexiko:` χρειάζεται `.items()`: `for k, v in lexiko.items():`'],
      }),
    },
    {
      when: (err) => isType(err, 'ValueError') && msgIs(err, /^math domain error/),
      help: () => ({
        title: 'Μαθηματικά αδύνατη πράξη',
        what: 'Μια μαθηματική συνάρτηση πήρε τιμή εκτός πεδίου ορισμού, π.χ. τετραγωνική ρίζα αρνητικού (`sqrt(-4)`) ή λογάριθμο του 0.',
        tips: ['Έλεγξε την τιμή πριν από τον υπολογισμό: `if x >= 0: y = sqrt(x)`'],
      }),
    },
    {
      when: (err) => isType(err, 'ValueError') && msgIs(err, /empty range for randrange/),
      help: () => ({
        title: 'Λάθος όρια στον τυχαίο αριθμό',
        what: 'Στην `randint(a, b)` πρέπει να ισχύει `a <= b`.',
        tips: ['Βάλε πρώτα το μικρότερο όριο: `randint(1, 10)`.'],
      }),
    },
    {
      when: (err) => isType(err, 'ValueError') && msgIs(err, /^I\/O operation on closed file/),
      help: () => ({
        title: 'Το αρχείο έχει ήδη κλείσει',
        what: 'Μετά το `f.close()` δεν μπορείς να διαβάσεις ή να γράψεις στο αρχείο.',
        tips: ['Μετακίνησε το `close()` στο τέλος, μετά από όλες τις αναγνώσεις/εγγραφές.', 'Πρόσεξε την εσοχή: το `close()` δεν πρέπει να είναι μέσα στον βρόχο.'],
      }),
    },
    // --- Διαίρεση με μηδέν -------------------------------------------------------------
    {
      when: (err) => isType(err, 'ZeroDivisionError'),
      help: () => ({
        title: 'Διαίρεση με το μηδέν',
        what: 'Ο διαιρέτης (ο αριθμός μετά το `/` ή το `%`) έγινε 0. Η διαίρεση με το μηδέν δεν ορίζεται.',
        tips: [
          'Συχνά συμβαίνει στον μέσο όρο όταν το πλήθος είναι 0. Έλεγξέ το πρώτα: `if plithos > 0:`',
          'Δες στο πάνελ **Μεταβλητές** ποια τιμή είχε ο διαιρέτης.',
        ],
        example: { bad: 'mo = athroisma / plithos', good: 'if plithos > 0:\n    mo = athroisma / float(plithos)\nelse:\n    print "Δεν δόθηκαν τιμές"' },
      }),
    },
    // --- IndexError ------------------------------------------------------------------
    {
      when: (err) => isType(err, 'IndexError') && msgIs(err, /^pop from empty list/),
      help: () => ({
        title: 'pop() από άδεια λίστα (στοίβα/ουρά)',
        what: 'Η λίστα είναι άδεια, οπότε δεν υπάρχει στοιχείο να αφαιρεθεί. Σε στοίβα, αυτό λέγεται **υποχείλιση** (underflow).',
        tips: ['Έλεγξε πριν από το pop: `if len(stoiva) > 0:` ή απλά `if stoiva:`'],
        example: { bad: 'x = stoiva.pop()', good: 'if len(stoiva) > 0:\n    x = stoiva.pop()\nelse:\n    print "Η στοίβα είναι άδεια"' },
      }),
    },
    {
      when: (err) => isType(err, 'IndexError') && msgIs(err, /assignment index out of range/),
      help: () => ({
        title: 'Ανάθεση σε θέση που δεν υπάρχει',
        what: 'Με `lista[i] = x` αλλάζει μια **υπάρχουσα** θέση. Δεν δημιουργείται νέα θέση στο τέλος.',
        tips: ['Για να προσθέσεις στοιχείο στο τέλος χρησιμοποίησε `lista.append(x)`.', 'Ή φτιάξε από πριν λίστα με Ν θέσεις: `lista = [0] * N`.'],
        example: { bad: 'lista = []\nlista[0] = 5', good: 'lista = []\nlista.append(5)' },
      }),
    },
    {
      when: (err) => isType(err, 'IndexError'),
      help: () => ({
        title: 'Θέση εκτός ορίων',
        what: 'Ζητήθηκε στοιχείο σε θέση που δεν υπάρχει. Σε λίστα με **N** στοιχεία, οι έγκυρες θέσεις είναι από **0** έως **N-1**. Το `lista[N]` δεν υπάρχει!',
        tips: [
          'Στους βρόχους χρησιμοποίησε `range(len(lista))`, που φτάνει μέχρι το N-1.',
          'Το τελευταίο στοιχείο είναι το `lista[len(lista) - 1]` ή απλά `lista[-1]`.',
          'Δες στο πάνελ **Μεταβλητές** το μήκος της λίστας και την τιμή του δείκτη.',
        ],
        example: { bad: 'for i in range(len(a) + 1):\n    print a[i]', good: 'for i in range(len(a)):\n    print a[i]' },
      }),
    },
    // --- KeyError ---------------------------------------------------------------------
    {
      when: (err) => isType(err, 'KeyError'),
      help: (err) => ({
        title: `Το κλειδί ${err.message || ''} δεν υπάρχει στο λεξικό`,
        what: 'Ζητήθηκε τιμή από λεξικό με κλειδί που δεν υπάρχει. Τα κλειδιά ξεχωρίζουν πεζά/κεφαλαία και τύπο (`1` ≠ `"1"`).',
        tips: [
          'Έλεγξε αν υπάρχει πριν το χρησιμοποιήσεις: `if kleidi in lexiko:`',
          'Ή χρησιμοποίησε `lexiko.get(kleidi, 0)`, που επιστρέφει προεπιλεγμένη τιμή.',
        ],
      }),
    },
    // --- AttributeError ------------------------------------------------------------------
    {
      when: (err) => isType(err, 'AttributeError') && msgIs(err, /^'NoneType' object has no attribute/),
      help: () => ({
        title: 'Η μεταβλητή έχει τιμή None',
        what: 'Η μεταβλητή πριν από την τελεία είναι `None`. Συχνή αιτία: `lista = lista.sort()`. Η `sort()` (όπως και οι `append()`, `reverse()`) αλλάζει την ίδια τη λίστα και **επιστρέφει None**.',
        tips: ['Γράψε σκέτο `lista.sort()` χωρίς ανάθεση.', 'Ή χρησιμοποίησε `lista2 = sorted(lista)`, που επιστρέφει νέα λίστα.', 'Αν η τιμή ήρθε από δική σου συνάρτηση, βεβαιώσου ότι έχει `return`.'],
        example: { bad: 'lista = lista.sort()', good: 'lista.sort()' },
      }),
    },
    {
      when: (err) => isType(err, 'AttributeError') && msgIs(err, /^'list' object has no attribute '(push|add|insertLast|enqueue|length|size|len|lenght)'/),
      help: (err) => {
        const a = /attribute '(\w+)'/.exec(err.message)[1];
        const right = { push: 'append', add: 'append', insertLast: 'append', enqueue: 'append', length: 'len', size: 'len', len: 'len', lenght: 'len' }[a];
        return {
          title: right === 'len' ? 'Το μήκος λίστας δίνεται από τη len()' : `Στις λίστες της Python λέγεται append()`,
          what: right === 'len'
            ? `Οι λίστες δεν έχουν μέθοδο \`.${a}\`. Το πλήθος στοιχείων δίνεται από τη συνάρτηση \`len(lista)\`.`
            : `Οι λίστες δεν έχουν μέθοδο \`.${a}()\`. Για να προσθέσεις στοιχείο στο τέλος (π.χ. ώθηση σε στοίβα ή εισαγωγή σε ουρά) χρησιμοποίησε \`.append()\`.`,
          tips: right === 'len' ? ['`plithos = len(lista)`'] : ['`stoiva.append(x)`: ώθηση (push)', '`stoiva.pop()`: απώθηση (pop)', '`oura.pop(0)`: εξαγωγή από ουρά'],
        };
      },
    },
    {
      when: (err) => isType(err, 'AttributeError') && msgIs(err, /^'(str|unicode)' object has no attribute '(append|remove|sort|pop|insert)'/),
      help: () => ({
        title: 'Οι συμβολοσειρές δεν έχουν μεθόδους λίστας',
        what: 'Η μεταβλητή είναι κείμενο (str), όχι λίστα. Οι μέθοδοι `append`, `remove`, `sort` υπάρχουν μόνο στις λίστες.',
        tips: ['Για να «προσθέσεις» σε κείμενο: `s = s + "κάτι"`.', 'Αν χρειάζεσαι λίστα: `lista = []` ή `lista = list(s)`.'],
      }),
    },
    {
      when: (err) => isType(err, 'AttributeError') && msgIs(err, /^'module' object has no attribute/),
      help: (err) => {
        const a = (/attribute '(\w+)'/.exec(err.message) || [])[1];
        const known = { randInt: 'randint', RandInt: 'randint', Randint: 'randint', squareroot: 'sqrt', Sqrt: 'sqrt', PI: 'pi', Pi: 'pi', Random: 'random', Connect: 'connect' };
        return {
          title: `Το module δεν έχει «${a}»`,
          what: 'Το όνομα μετά την τελεία δεν υπάρχει μέσα στο module. Πρόσεξε την ορθογραφία και τα πεζά/κεφαλαία.',
          tips: known[a] ? [`Μήπως εννοείς \`${known[a]}\`;`] : ['Στο Shell (κάτω) μπορείς να δεις όλα τα ονόματα ενός module με `dir(math)`.', 'Μήπως έχεις δικό σου αρχείο με το ίδιο όνομα (π.χ. `random.py`) στον φάκελο; Τότε το import φέρνει αυτό αντί για τη βιβλιοθήκη.'],
          suggestions: known[a] ? [known[a]] : [],
        };
      },
    },
    {
      when: (err) => isType(err, 'AttributeError'),
      help: (err) => {
        const m = /^'(\w+)' object has no attribute '(\w+)'/.exec(err.message || '') || [];
        return {
          title: m[2] ? `Δεν υπάρχει «.${m[2]}» για ${typeGr(m[1])}` : 'Δεν υπάρχει τέτοια μέθοδος ή ιδιότητα',
          what: 'Μετά την τελεία γράφτηκε όνομα μεθόδου που δεν υπάρχει για αυτόν τον τύπο τιμής.',
          tips: ['Πρόσεξε την ορθογραφία και τα πεζά/κεφαλαία (π.χ. `upper()` και όχι `Upper()`).', 'Έλεγξε στο πάνελ **Μεταβλητές** τι τύπου είναι η μεταβλητή.', 'Στο Shell, το `dir(x)` δείχνει όλες τις μεθόδους της τιμής x.'],
        };
      },
    },
    // --- Αρχεία -------------------------------------------------------------------------
    {
      when: (err) => isType(err, 'IOError', 'OSError') && msgIs(err, /No such file or directory/),
      help: (err) => {
        const f = (/: '(.+)'$/.exec(err.message) || [])[1] || '';
        return {
          title: 'Το αρχείο δεν βρέθηκε',
          what: `Δεν βρέθηκε αρχείο με όνομα «${f}». Όταν δίνεις μόνο όνομα (χωρίς φάκελο), η Python το ψάχνει **στον φάκελο του προγράμματος**:\n\`${err.cwd || ''}\``,
          tips: [
            'Έλεγξε την ορθογραφία και την κατάληξη (`.txt`). Τα Windows συχνά κρύβουν τις καταλήξεις.',
            'Το άνοιγμα με `"r"` (ανάγνωση) θέλει το αρχείο να υπάρχει ήδη. Με `"w"` δημιουργείται νέο αρχείο.',
            'Σε πλήρη διαδρομή, χρησιμοποίησε `/` αντί για `\\`: `open("C:/dedomena/arxeio.txt")`.',
          ],
        };
      },
    },
    {
      when: (err) => isType(err, 'IOError', 'OSError') && msgIs(err, /Permission denied/),
      help: () => ({
        title: 'Δεν επιτρέπεται η πρόσβαση στο αρχείο',
        what: 'Τα Windows δεν επιτρέπουν το άνοιγμα του αρχείου.',
        tips: ['Μήπως το αρχείο είναι ανοιχτό σε άλλο πρόγραμμα (π.χ. Excel ή Word); Κλείσε το και ξαναδοκίμασε.', 'Μήπως είναι φάκελος και όχι αρχείο;'],
      }),
    },
    {
      when: (err) => isType(err, 'IOError') && msgIs(err, /^File not open for/),
      help: (err) => ({
        title: /writing/.test(err.message) ? 'Το αρχείο άνοιξε μόνο για ανάγνωση' : 'Το αρχείο άνοιξε μόνο για εγγραφή',
        what: 'Ο τρόπος ανοίγματος (δεύτερη παράμετρος της `open`) δεν επιτρέπει αυτή τη λειτουργία.',
        tips: ['`"r"`: ανάγνωση', '`"w"`: εγγραφή (σβήνει τα προηγούμενα περιεχόμενα)', '`"a"`: προσθήκη στο τέλος'],
      }),
    },
    // --- Import ------------------------------------------------------------------------
    {
      when: (err) => isType(err, 'ImportError') && msgIs(err, /No module named (tkinter|tkinter\.messagebox|queue|configparser)$/),
      help: (err) => {
        const n = (/named (.+)$/.exec(err.message) || [])[1];
        const py2 = { tkinter: 'Tkinter', 'tkinter.messagebox': 'tkMessageBox', queue: 'Queue', configparser: 'ConfigParser' }[n];
        return {
          title: `Στην Python 2 γράφεται ${py2}`,
          what: `Το \`${n}\` είναι το όνομα στην Python 3. Στην Python 2.7 το module λέγεται \`${py2}\` (με κεφαλαίο).`,
          tips: [`Γράψε \`from ${py2} import *\` ή \`import ${py2}\`.`],
          example: { bad: `from ${n} import *`, good: `from ${py2} import *` },
        };
      },
    },
    {
      // η Python 2.7 χωρίς Tkinter, π.χ. στο Ubuntu: «No module named _tkinter, please install the python-tk package»
      when: (err) => isType(err, 'ImportError') && msgIs(err, /No module named (_tkinter|Tkinter)\b/),
      help: () => ({
        title: 'Η εγκατάσταση της Python 2.7 δεν έχει Tkinter',
        what: 'Το πρόγραμμα είναι σωστό, αλλά στον υπολογιστή λείπει το κομμάτι της Python 2.7 για τα γραφικά παράθυρα (Tkinter).',
        tips: [
          'Στα **Windows**: ξανατρέξε τον installer της Python 2.7, διάλεξε «Change» και τσέκαρε το «Tcl/Tk».',
          'Στο **Ubuntu/Linux**: `sudo apt install python-tk` όπου υπάρχει· αλλιώς η Python 2.7 εγκαθίσταται με Tkinter από το script `install-python27-linux.sh` (δες τις οδηγίες για Linux).',
          'Αν δεν έχεις δικαιώματα διαχειριστή, ζήτησε βοήθεια από τον καθηγητή σου.',
        ],
      }),
    },
    {
      when: (err) => isType(err, 'ImportError'),
      help: (err) => {
        const n = (/named (.+)$|cannot import name (.+)$/.exec(err.message) || []).slice(1).find(Boolean) || '';
        const sugg = similarNames(n, MODULES, 2);
        return {
          title: 'Το module δεν βρέθηκε',
          what: `Η Python δεν βρήκε το \`${n}\`.`,
          tips: [
            ...(sugg.length ? [`Μήπως εννοείς \`${sugg[0]}\`; Πρόσεξε τα πεζά/κεφαλαία.`] : []),
            'Αν είναι δικό σου αρχείο (module), πρέπει να βρίσκεται **στον ίδιο φάκελο** με το πρόγραμμα και να λέγεται `ονομα.py`.',
          ],
          suggestions: sugg,
        };
      },
    },
    // --- Αναδρομή ---------------------------------------------------------------------
    {
      when: (err) => isType(err, 'RuntimeError') && msgIs(err, /maximum recursion depth/),
      help: () => ({
        title: 'Ατέρμονη αναδρομή',
        what: 'Μια συνάρτηση καλεί τον εαυτό της ξανά και ξανά χωρίς να σταματά ποτέ (η Python σταματά μετά από ~1000 κλήσεις).',
        tips: ['Κάθε αναδρομική συνάρτηση χρειάζεται **συνθήκη τερματισμού** (βασική περίπτωση) που δεν καλεί ξανά τη συνάρτηση.', 'Βεβαιώσου ότι σε κάθε κλήση η παράμετρος πλησιάζει τη συνθήκη τερματισμού (π.χ. `n - 1`).'],
        example: { bad: 'def par(n):\n    return n * par(n - 1)', good: 'def par(n):\n    if n <= 1:\n        return 1\n    return n * par(n - 1)' },
      }),
    },
    // --- Κωδικοποίηση ------------------------------------------------------------------
    {
      when: (err) => isType(err, 'UnicodeEncodeError') && err.phase === 'compile',
      help: (err) => ({
        title: 'Χαρακτήρας που δεν υποστηρίζεται',
        what: `Ο χαρακτήρας «${err.char || '?'}» (γραμμή ${lineNo(err)}) δεν υπάρχει στην κωδικοποίηση ${err.encoding || 'cp1253'}, που χρησιμοποιείται για τα ελληνικά κατά την εκτέλεση.`,
        tips: ['Σβήσε τον χαρακτήρα (π.χ. emoji ή σύμβολο) ή αντικατέστησέ τον με απλό.', 'Εναλλακτικά, άλλαξε την κωδικοποίηση από **Εκτέλεση → Κωδικοποίηση ελληνικών** σε utf-8.'],
      }),
    },
    {
      when: (err) => isType(err, 'UnicodeEncodeError', 'UnicodeDecodeError'),
      help: () => ({
        title: 'Ανάμειξη ελληνικού κειμένου διαφορετικών τύπων',
        what: 'Στην Python 2 υπάρχουν δύο είδη κειμένου: το απλό `\'...\'` (str) και το unicode `u\'...\'`. Η ανάμειξή τους με ελληνικούς χαρακτήρες μπορεί να προκαλέσει αυτό το λάθος.',
        tips: ['Χρησιμοποίησε το ίδιο είδος παντού (συνήθως απλές συμβολοσειρές χωρίς `u`).', 'Απόφυγε το `str()` σε τιμές unicode με ελληνικά.'],
      }),
    },
    // --- sqlite3 -----------------------------------------------------------------------
    {
      when: (err) => /ProgrammingError/.test(err.exc_type) && msgIs(err, /8-bit bytestrings/),
      help: () => ({
        title: 'Ελληνικά στη βάση δεδομένων',
        what: 'Η sqlite3 της Python 2 δέχεται ελληνικά μόνο ως κείμενο **unicode**. Οι απλές συμβολοσειρές με ελληνικά απορρίπτονται.',
        tips: [
          'Βάλε `u` μπροστά από τα εισαγωγικά: `u"Αθήνα"`.',
          'Για τιμές από `raw_input()`: `poli = raw_input("Πόλη: ").decode("cp1253")`.',
          'Ή, αμέσως μετά το connect, γράψε `conn.text_factory = str`.',
        ],
        example: { bad: 'curs.execute("INSERT INTO t VALUES (?)", ("Αθήνα",))', good: 'curs.execute("INSERT INTO t VALUES (?)", (u"Αθήνα",))' },
      }),
    },
    {
      when: (err) => /OperationalError/.test(err.exc_type) && msgIs(err, /^no such table/),
      help: () => ({
        title: 'Ο πίνακας δεν υπάρχει',
        what: 'Η εντολή SQL αναφέρεται σε πίνακα που δεν υπάρχει στη βάση.',
        tips: ['Δημιούργησε πρώτα τον πίνακα με `CREATE TABLE`.', 'Έλεγξε την ορθογραφία του ονόματος.', 'Η βάση δημιουργείται στον φάκελο του προγράμματος. Αν άλλαξες φάκελο, δημιουργήθηκε νέα, άδεια βάση.'],
      }),
    },
    {
      when: (err) => /OperationalError/.test(err.exc_type) && msgIs(err, /already exists/),
      help: () => ({
        title: 'Ο πίνακας υπάρχει ήδη',
        what: 'Το πρόγραμμα προσπαθεί να δημιουργήσει πίνακα που δημιουργήθηκε σε προηγούμενη εκτέλεση.',
        tips: ['Γράψε `CREATE TABLE IF NOT EXISTS ...`', 'Ή διάγραψε πρώτα τον πίνακα με `DROP TABLE IF EXISTS ...`'],
      }),
    },
    {
      when: (err) => /OperationalError/.test(err.exc_type) && msgIs(err, /syntax error|no such column/),
      help: () => ({
        title: 'Λάθος στην εντολή SQL',
        what: 'Η εντολή SQL μέσα στο `execute()` δεν είναι σωστή.',
        tips: ['Έλεγξε ορθογραφία λέξεων-κλειδιών (`SELECT`, `FROM`, `WHERE`) και ονόματα στηλών.', 'Οι τιμές κειμένου μέσα στην SQL μπαίνουν σε απλά εισαγωγικά, ή ακόμα καλύτερα με `?`: `execute("... WHERE id = ?", (x,))`.'],
      }),
    },
    {
      when: (err) => /IntegrityError/.test(err.exc_type),
      help: () => ({
        title: 'Διπλή ή μη αποδεκτή εγγραφή',
        what: 'Η εγγραφή παραβιάζει κανόνα του πίνακα, π.χ. το πρωτεύον κλειδί (PRIMARY KEY) υπάρχει ήδη.',
        tips: ['Χρησιμοποίησε διαφορετική τιμή κλειδιού, ή άφησε τη βάση να το δώσει αυτόματα (INTEGER PRIMARY KEY).'],
      }),
    },
    // --- Tkinter -----------------------------------------------------------------------
    {
      when: (err) => /TclError/.test(err.exc_type) && msgIs(err, /unknown option/),
      help: (err) => ({
        title: 'Άγνωστη επιλογή widget',
        what: `Το Tkinter δεν αναγνωρίζει την επιλογή ${(/"(-?\w+)"/.exec(err.message) || [])[1] || ''}.`,
        tips: ['Πρόσεξε την ορθογραφία: `text`, `bg`, `fg`, `font`, `width`, `height`, `command`.'],
      }),
    },
    {
      when: (err) => /TclError/.test(err.exc_type) && msgIs(err, /geometry manager/),
      help: () => ({
        title: 'Ανάμειξη pack() και grid()',
        what: 'Στο ίδιο παράθυρο (ή Frame) δεν μπορείς να χρησιμοποιήσεις μαζί `pack()` και `grid()`.',
        tips: ['Χρησιμοποίησε μόνο έναν τρόπο τοποθέτησης για όλα τα widgets του ίδιου γονέα.'],
      }),
    },
    {
      when: (err) => isType(err, 'EOFError'),
      help: () => ({
        title: 'Δεν δόθηκε είσοδος',
        what: 'Η `raw_input()` ή η `input()` περίμενε τιμή αλλά δεν πήρε.',
        tips: ['Ξανατρέξε το πρόγραμμα και γράψε την τιμή στο Shell (κάτω).'],
      }),
    },
  ];

  function explain(err, ctx) {
    ctx = ctx || {};
    const translation = translateMessage(err.message);
    for (const rule of RULES) {
      let ok = false;
      try { ok = rule.when(err, ctx); } catch (_) { ok = false; }
      if (ok) {
        const h = rule.help(err, ctx);
        return { kind: 'error', translation, ...h };
      }
    }
    const generic = GENERIC[err.exc_type] || GENERIC[(err.exc_type || '').split('.').pop()];
    if (generic) {
      return {
        kind: 'error',
        translation,
        title: generic[0],
        what: generic[1],
        tips: isType(err, 'SyntaxError')
          ? ['Κοίτα προσεκτικά τη γραμμή που δείχνει η Python **και την προηγούμενή της**: συχνά το λάθος είναι λίγο πιο πάνω (π.χ. παρένθεση που δεν έκλεισε).',
            'Το `^` στο μήνυμα δείχνει περίπου πού «σκόνταψε» η Python.']
          : ['Διάβασε την τελευταία γραμμή του μηνύματος στο Shell: γράφει τι πήγε στραβά.', 'Δες στο πάνελ **Μεταβλητές** τις τιμές τη στιγμή του λάθους.'],
      };
    }
    return {
      kind: 'error',
      translation,
      title: err.exc_type || 'Λάθος',
      what: 'Συνέβη λάθος κατά την εκτέλεση του προγράμματος.',
      tips: ['Διάβασε την τελευταία γραμμή του μηνύματος στο Shell και δες τη γραμμή του κώδικα που δείχνει.'],
    };
  }

  function explainStop() {
    return {
      kind: 'info',
      title: 'Το πρόγραμμα διακόπηκε',
      what: 'Σταμάτησες την εκτέλεση του προγράμματος.',
      tips: [
        'Αν το πρόγραμμα δεν τελείωνε ποτέ, ίσως έχεις **ατέρμονο βρόχο**: ένα `while` του οποίου η συνθήκη δεν γίνεται ποτέ ψευδής.',
        'Βεβαιώσου ότι μέσα στο `while` αλλάζει η μεταβλητή της συνθήκης (π.χ. `i = i + 1`).',
      ],
      example: { bad: 'i = 0\nwhile i < 10:\n    print i', good: 'i = 0\nwhile i < 10:\n    print i\n    i = i + 1' },
    };
  }

  return {
    explain, explainStop, translateMessage, levenshtein, similarNames, suspiciousChars, fixSuspicious,
    greekIdentifiers, codeOnly, unclosedBracket,
  };
});
