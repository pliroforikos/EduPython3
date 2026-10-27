'use strict';
// node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const H = require('../src/renderer/errorHelp.js');

function err(exc_type, message, lineno, extra = {}) {
  return { exc_type, message, location: lineno ? { lineno, line: extra.line } : null, ...extra };
}
const ctxOf = (src) => ({ lines: src.split('\n') });

test('λείπει άνω-κάτω τελεία', () => {
  const src = 'x = 1\nif x > 0\n    print x';
  const h = H.explain(err('SyntaxError', 'invalid syntax', 2), ctxOf(src));
  assert.match(h.title, /άνω-κάτω τελεία/);
  assert.match(h.title, /if/);
  assert.equal(h.translation, 'μη έγκυρη σύνταξη');
});

test('= αντί για == σε συνθήκη', () => {
  const h = H.explain(err('SyntaxError', 'invalid syntax', 1), ctxOf('if x = 5:\n    pass'));
  assert.match(h.title, /==/);
});

test('παρένθεση που δεν έκλεισε στην προηγούμενη γραμμή', () => {
  const src = 'x = int(raw_input("Δώσε: ")\nprint x';
  const h = H.explain(err('SyntaxError', 'invalid syntax', 2), ctxOf(src));
  assert.match(h.title, /παρένθεση/);
  assert.equal(h.line, 1);
});

test('unexpected EOF με ανοιχτή παρένθεση', () => {
  const h = H.explain(err('SyntaxError', 'unexpected EOF while parsing', 1), ctxOf('print len(x'));
  assert.match(h.title, /παρένθεση/);
});

test('καμπύλα εισαγωγικά από PDF', () => {
  const src = 'print “Γεια”';
  const h = H.explain(err('SyntaxError', 'invalid syntax', 1), ctxOf(src));
  assert.match(h.title, /PDF/);
  assert.equal(H.fixSuspicious('print “Γεια” – 1'), 'print "Γεια" - 1');
});

test('ελληνικά σε όνομα μεταβλητής', () => {
  const src = 'όνομα = raw_input("Όνομα: ")';
  const h = H.explain(err('SyntaxError', 'invalid syntax', 1), ctxOf(src));
  assert.match(h.title, /Ελληνικά γράμματα/);
  assert.deepEqual(H.greekIdentifiers('x = "όνομα" # σχόλιο'), []);
});

test('print της Python 3', () => {
  const h = H.explain(err('SyntaxError', 'invalid syntax', 1), ctxOf('print(i, end=" ")'));
  assert.match(h.title, /print/);
});

test('εσοχές', () => {
  assert.match(H.explain(err('IndentationError', 'expected an indented block', 2), ctxOf('for i in x:\nprint i')).title, /εσοχή/);
  assert.match(H.explain(err('IndentationError', 'unexpected indent', 2), ctxOf('x=1\n  y=2')).title, /εσοχή/i);
  assert.match(H.explain(err('IndentationError', 'unindent does not match any outer indentation level', 3), {}).title, /εσοχή/);
});

test('NameError από input()', () => {
  const h = H.explain(err('NameError', "name 'Kostas' is not defined", 1, { from_input: true, last_input: 'Kostas' }), {});
  assert.match(h.title, /input/);
  assert.match(h.what, /Kostas/);
  assert.equal(h.translation, "το όνομα 'Kostas' δεν έχει οριστεί");
});

test('NameError με πρόταση ονόματος', () => {
  const h = H.explain(err('NameError', "name 'athrisma' is not defined", 2, { names: ['athroisma', 'len', 'x'] }), ctxOf('athroisma = 0\nprint athrisma'));
  assert.deepEqual(h.suggestions, ['athroisma']);
});

test('NameError για συνάρτηση module χωρίς import', () => {
  const h = H.explain(err('NameError', "name 'sqrt' is not defined", 1, { names: [] }), ctxOf('print sqrt(4)'));
  assert.match(h.title, /math/);
});

test('NameError για true', () => {
  const h = H.explain(err('NameError', "name 'true' is not defined", 1, { names: ['True'] }), {});
  assert.match(h.title, /True/);
});

test('NameError μεταβλητής που ορίζεται αργότερα', () => {
  const h = H.explain(err('NameError', "name 's' is not defined", 1, { names: [] }), ctxOf('print s\ns = 0'));
  assert.ok(h.tips.some((t) => /γραμμή 2/.test(t)));
});

test('TypeError ένωσης str και int', () => {
  const h = H.explain(err('TypeError', "cannot concatenate 'str' and 'int' objects", 1), {});
  assert.match(h.title, /κειμένου με αριθμό/);
});

test('TypeError από raw_input σε πράξη', () => {
  const h = H.explain(err('TypeError', "unsupported operand type(s) for -: 'str' and 'int'", 1), {});
  assert.match(h.tips.join(' '), /int\(raw_input/);
});

test('TypeError not callable με επισκιασμένο builtin', () => {
  const src = 'sum = 0\nprint sum([1, 2])';
  const h = H.explain(err('TypeError', "'int' object is not callable", 2, { line: 'print sum([1, 2])' }), ctxOf(src));
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
  assert.match(H.explain(err('ZeroDivisionError', 'integer division or modulo by zero', 1), {}).title, /μηδέν/);
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

test('IOError αρχείο δεν υπάρχει', () => {
  const h = H.explain(err('IOError', "[Errno 2] No such file or directory: 'data.txt'", 1, { cwd: 'C:\\x' }), {});
  assert.match(h.what, /data\.txt/);
  assert.match(h.what, /C:\\x/);
});

test('ImportError tkinter', () => {
  const h = H.explain(err('ImportError', 'No module named tkinter', 1), {});
  assert.match(h.title, /Tkinter/);
});

test('ImportError: η Python 2.7 χωρίς Tkinter (Linux)', () => {
  const h = H.explain(err('ImportError', 'No module named _tkinter, please install the python-tk package', 1), {});
  assert.match(h.title, /δεν έχει Tkinter/);
  // το όνομα της Python 3 εξακολουθεί να εξηγείται χωριστά
  assert.match(H.explain(err('ImportError', 'No module named tkinter', 1), {}).title, /Στην Python 2/);
});

test('sqlite3 8-bit bytestrings', () => {
  const h = H.explain(err('sqlite3.ProgrammingError', 'You must not use 8-bit bytestrings unless you use a text_factory', 1), {});
  assert.match(h.title, /βάση/);
});

test('αναδρομή', () => {
  assert.match(H.explain(err('RuntimeError', 'maximum recursion depth exceeded', 2), {}).title, /αναδρομή/);
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
