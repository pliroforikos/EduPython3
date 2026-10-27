'use strict';
// node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const H = require('../src/renderer/errorHelp.js');

function err(exc_type, message, lineno, extra = {}) {
  return { exc_type, message, location: lineno ? { lineno, line: extra.line } : null, ...extra };
}
const ctxOf = (src, settings) => ({ lines: src.split('\n'), settings });

test('λείπει άνω-κάτω τελεία', () => {
  const src = 'x = 1\nif x > 0\n    print(x)';
  const h = H.explain(err('SyntaxError', "expected ':'", 2), ctxOf(src));
  assert.match(h.title, /άνω-κάτω τελεία/);
  assert.match(h.title, /if/);
  assert.match(h.translation, /άνω-κάτω τελεία/);
});

test('= αντί για == σε συνθήκη', () => {
  const h = H.explain(err('SyntaxError', 'invalid syntax', 1), ctxOf('if x = 5:\n    pass'));
  assert.match(h.title, /==/);
});

test('παρένθεση που δεν έκλεισε στην προηγούμενη γραμμή', () => {
  const src = 'x = int(input("Δώσε: ")\nprint(x)';
  const h = H.explain(err('SyntaxError', 'invalid syntax', 2), ctxOf(src));
  assert.match(h.title, /παρένθεση/);
  assert.equal(h.line, 1);
});

test('Python 3.12+ "(" was never closed', () => {
  const src = 'x = int(input("Δώσε: ")\nprint(x)';
  const h = H.explain(err('SyntaxError', "'(' was never closed", 1), ctxOf(src));
  assert.match(h.title, /Δεν έκλεισε η παρένθεση/);
});

test('unexpected EOF με ανοιχτή παρένθεση', () => {
  const h = H.explain(err('SyntaxError', 'unexpected EOF while parsing', 1), ctxOf('print(len(x'));
  assert.match(h.title, /παρένθεση/);
});

test('καμπύλα εισαγωγικά από PDF', () => {
  const src = 'print(“Γεια”)';
  const h = H.explain(err('SyntaxError', 'invalid character in identifier', 1), ctxOf(src));
  assert.match(h.title, /PDF/);
  assert.equal(H.fixSuspicious('print(“Γεια”) – 1'), 'print("Γεια") - 1');
});

test('ελληνικά σε όνομα μεταβλητής (warn & error)', () => {
  const src = 'όνομα = input("Όνομα: ")';
  // warn setting
  const hWarn = H.explain(err('SyntaxError', 'invalid character', 1), ctxOf(src, { greekNames: 'warn' }));
  assert.match(hWarn.title, /Ελληνικά γράμματα/);
  assert.match(hWarn.what, /εξετάσεις/);

  // error setting
  const hErr = H.explain(err('SyntaxError', 'invalid character', 1), ctxOf(src, { greekNames: 'error' }));
  assert.match(hErr.title, /Ελληνικά γράμματα/);
  assert.match(hErr.what, /μόνο με λατινικούς/);

  assert.deepEqual(H.greekIdentifiers('x = "όνομα" # σχόλιο'), []);
});

test('print χωρίς παρενθέσεις (Missing parentheses)', () => {
  const h = H.explain(err('SyntaxError', "Missing parentheses in call to 'print'. Did you mean print(...) ?", 1), ctxOf('print "Γεια"'));
  assert.match(h.title, /παρενθέσεις στην print/);
});

test('string literal που δεν έκλεισε', () => {
  const h = H.explain(err('SyntaxError', 'unterminated string literal (detected at line 1)', 1), ctxOf('s = "hello'));
  assert.match(h.title, /εισαγωγικά/);
});

test('εσοχές', () => {
  assert.match(H.explain(err('IndentationError', 'expected an indented block', 2), ctxOf('for i in x:\nprint(i)')).title, /εσοχή/);
  assert.match(H.explain(err('IndentationError', 'unexpected indent', 2), ctxOf('x=1\n  y=2')).title, /εσοχή/i);
  assert.match(H.explain(err('IndentationError', 'unindent does not match any outer indentation level', 3), {}).title, /εσοχή/);
});

test('TypeError σύγκρισης str με int (από input)', () => {
  const h = H.explain(err('TypeError', "'<' not supported between instances of 'str' and 'int'", 1), {});
  assert.match(h.title, /σύγκριση κειμένου με αριθμό/i);
  assert.match(h.tips.join(' '), /int\(input/);
});

test('NameError με πρόταση ονόματος', () => {
  const h = H.explain(err('NameError', "name 'athrisma' is not defined", 2, { names: ['athroisma', 'len', 'x'] }), ctxOf('athroisma = 0\nprint(athrisma)'));
  assert.deepEqual(h.suggestions, ['athroisma']);
});

test('NameError για συνάρτηση module χωρίς import', () => {
  const h = H.explain(err('NameError', "name 'sqrt' is not defined", 1, { names: [] }), ctxOf('print(sqrt(4))'));
  assert.match(h.title, /math/);
});

test('NameError για true', () => {
  const h = H.explain(err('NameError', "name 'true' is not defined", 1, { names: ['True'] }), {});
  assert.match(h.title, /True/);
});

test('NameError μεταβλητής που ορίζεται αργότερα', () => {
  const h = H.explain(err('NameError', "name 's' is not defined", 1, { names: [] }), ctxOf('print(s)\ns = 0'));
  assert.ok(h.tips.some((t) => /γραμμή 2/.test(t)));
});

test('TypeError ένωσης str και int', () => {
  const h = H.explain(err('TypeError', 'can only concatenate str (not "int") to str', 1), {});
  assert.match(h.title, /ένωση κειμένου με αριθμό/i);
  assert.match(h.tips.join(' '), /str\(/);
});

test('TypeError από input σε πράξη', () => {
  const h = H.explain(err('TypeError', "unsupported operand type(s) for -: 'str' and 'int'", 1), {});
  assert.match(h.tips.join(' '), /int\(input/);
});

test('TypeError float αντί για int σε δείκτη λίστας', () => {
  const h = H.explain(err('TypeError', 'list indices must be integers or slices, not float', 1), {});
  assert.match(h.title, /δεκαδικός δείκτης/i);
  assert.match(h.tips.join(' '), /\/\//);
});

test('TypeError float στο range', () => {
  const h = H.explain(err('TypeError', "'float' object cannot be interpreted as an integer", 1), {});
  assert.match(h.title, /δεκαδικός.*χρειάζεται \/\//i);
  assert.match(h.tips.join(' '), /\/\//);
});

test('TypeError not callable με επισκιασμένο builtin', () => {
  const src = 'sum = 0\nprint(sum([1, 2]))';
  const h = H.explain(err('TypeError', "'int' object is not callable", 2, { line: 'print(sum([1, 2]))' }), ctxOf(src));
  assert.match(h.tips[0], /sum/);
});

test('ValueError int() με δεκαδικό', () => {
  const h = H.explain(err('ValueError', "invalid literal for int() with base 10: '3.5'", 1), {});
  assert.match(h.tips[0], /float/);
});

test('ValueError int() με κενή είσοδο', () => {
  const h = H.explain(err('ValueError', "invalid literal for int() with base 10: ''", 1), {});
  assert.match(h.tips[0], /Enter/);
});

test('ZeroDivisionError, IndexError, KeyError', () => {
  assert.match(H.explain(err('ZeroDivisionError', 'division by zero', 1), {}).title, /μηδέν/);
  assert.match(H.explain(err('IndexError', 'list index out of range', 1), {}).what, /N-1/);
  assert.match(H.explain(err('IndexError', 'pop from empty list', 1), {}).title, /άδεια/);
  assert.match(H.explain(err('KeyError', "'a'", 1), {}).title, /κλειδί/);
});

test('AttributeError push σε λίστα', () => {
  const h = H.explain(err('AttributeError', "'list' object has no attribute 'push'", 1), {});
  assert.match(h.title, /append/);
});

test('AttributeError NoneType', () => {
  const h = H.explain(err('AttributeError', "'NoneType' object has no attribute 'append'", 1), {});
  assert.match(h.what, /sort/);
});

test('FileNotFoundError αρχείο δεν υπάρχει', () => {
  const h = H.explain(err('FileNotFoundError', "[Errno 2] No such file or directory: 'data.txt'", 1, { cwd: 'C:\\x' }), {});
  assert.match(h.what, /data\.txt/);
  assert.match(h.what, /C:\\x/);
});

test('ImportError Tkinter (Python 2 όνομα με κεφαλαίο)', () => {
  const h = H.explain(err('ModuleNotFoundError', "No module named 'Tkinter'", 1), {});
  assert.match(h.title, /tkinter με πεζά/);
});

test('ImportError tkinter που λείπει (π.χ. Linux python3-tk)', () => {
  const h = H.explain(err('ModuleNotFoundError', "No module named '_tkinter'", 1), {});
  assert.match(h.title, /δεν έχει tkinter/);
  assert.match(h.tips[0], /python3-tk/);
});

test('UnboundLocalError σε συνάρτηση', () => {
  const h = H.explain(err('UnboundLocalError', "local variable 'x' referenced before assignment", 2), {});
  assert.match(h.title, /μέσα στη συνάρτηση δεν έχει τιμή/);
});

test('f-string συντακτικό λάθος', () => {
  const h = H.explain(err('SyntaxError', "f-string: unmatched '('", 1), {});
  assert.match(h.title, /f-string/);
});

test('αναδρομή', () => {
  assert.match(H.explain(err('RecursionError', 'maximum recursion depth exceeded', 2), {}).title, /αναδρομή/);
});

test('γενική εξήγηση για άγνωστο μήνυμα', () => {
  const h = H.explain(err('ValueError', 'something odd', 1), {});
  assert.equal(h.title, 'Μη αποδεκτή τιμή');
  const h2 = H.explain(err('WeirdError', 'x', 1), {});
  assert.equal(h2.title, 'WeirdError');
});

test('levenshtein και similarNames', () => {
  assert.equal(H.levenshtein('kitten', 'sitting'), 3);
  assert.deepEqual(H.similarNames('Print', ['print', 'int']), ['print']);
});
