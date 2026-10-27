# -*- coding: utf-8 -*-
"""Backend εκτέλεσης προγραμμάτων Python 2.7 (μοντέλο Thonny).

Πρωτόκολλο: μία εντολή JSON ανά γραμμή στο stdin, ένα μήνυμα JSON ανά γραμμή
στο stdout. Το πρόγραμμα του μαθητή βλέπει δικά μας sys.stdin/stdout/stderr.

Εντολές:   {"cmd":"run", "path", "source", "encoding"}
           {"cmd":"shell", "cwd", "encoding"}
           {"cmd":"input", "text"}      απάντηση σε raw_input/input
           {"cmd":"repl", "line"}       γραμμή του Shell (>>>)
           {"cmd":"globals"}
           {"cmd":"trace", "mode", "delay"}  εκτέλεση βήμα-βήμα: mode step | auto | off
           {"cmd":"step"}               «Επόμενη γραμμή» (όταν mode = step)
Μηνύματα:  ready, started, out, input_request, error, done, globals, prompt, step
"""
import os
import sys
import json
import threading
import traceback
import linecache
import codeop
import types
import imp
import inspect
import re
import time
import Queue
import __builtin__

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)
import _epal_util as U  # noqa: E402
sys.path[:] = [p for p in sys.path if os.path.normcase(os.path.abspath(p or '.')) !=
               os.path.normcase(BACKEND_DIR)]

OWN_FILES = set(os.path.normcase(os.path.join(BACKEND_DIR, f))
                for f in ('runner.py', 'runner.pyc', '_epal_util.py', '_epal_util.pyc'))
SHELL_FILE = '<shell>'
MAX_REPR = 1500
STAR_RE = re.compile(r'^[ \t]*from[ \t]+([\w.]+)[ \t]+import[ \t]*\*', re.M)

# --- Ιδιωτικά κανάλια πρωτοκόλλου -------------------------------------------
# Κρατάμε αντίγραφα των fd 0/1 για το πρωτόκολλο. Το fd 0 δείχνει πλέον στο NUL
# και το fd 1 στο stderr, ώστε έξοδος από C κώδικα ή υποδιεργασίες (os.system)
# να μη χαλάει το πρωτόκολλο.
_proto_in = os.fdopen(os.dup(0), 'rb')
_proto_out = os.fdopen(os.dup(1), 'wb', 0)
try:
    _nul = os.open(os.devnull, os.O_RDONLY)
    os.dup2(_nul, 0)
    os.dup2(2, 1)
except OSError:
    pass

_write_lock = threading.Lock()


def _raw_send(msg):
    data = json.dumps(msg) + '\n'
    with _write_lock:
        _proto_out.write(data)


class _State(object):
    encoding = 'cp1253'
    default_encoding = 'cp1253'
    prog_path_u = None      # unicode διαδρομή προγράμματος
    prog_path_b = None      # bytes διαδρομή (όπως τη βλέπει η Python 2)
    last_input = None
    sources = {}            # όνομα αρχείου (bytes) -> λίστα unicode γραμμών
    star_modules = set()    # modules από `from X import *`


S = _State()


# --- Έξοδος -----------------------------------------------------------------
class _OutputBuffer(object):
    """Συγκεντρώνει την έξοδο και τη στέλνει ανά ~30ms ή όταν χρειάζεται."""

    # Ρυθμός εξόδου προς το IDE: έως RATE χαρακτήρες/δευτερόλεπτο, με «απόθεμα» BURST για
    # σύντομες εκρήξεις. Ένα ατέρμονο print έστελνε ~8 MB/s και η εφαρμογή «κολλούσε».
    RATE = 200000.0
    BURST = 200000.0

    def __init__(self):
        self.lock = threading.Lock()
        self.flush_lock = threading.RLock()
        self.items = []
        self.size = 0
        self.budget = self.BURST
        self.last = time.time()

    def add(self, stream, text):
        with self.lock:
            if self.items and self.items[-1][0] == stream:
                self.items[-1][1].append(text)
            else:
                self.items.append((stream, [text]))
            self.size += len(text)
            big = self.size > 32768
            now = time.time()
            self.budget = min(self.BURST, self.budget + (now - self.last) * self.RATE) - len(text)
            self.budget = max(self.budget, -self.RATE)    # το πολύ 1 δευτερόλεπτο «χρέος»
            self.last = now
            delay = -self.budget / self.RATE if self.budget < 0 else 0
        if big:
            self.flush()
        if delay:
            # το πρόγραμμα του μαθητή περιμένει λίγο (μόνο όταν τυπώνει υπερβολικά πολλά)
            time.sleep(min(delay, 1.0))

    def flush(self):
        with self.flush_lock:
            with self.lock:
                items, self.items, self.size = self.items, [], 0
            for stream, parts in items:
                _raw_send({'type': 'out', 'stream': stream, 'text': u''.join(parts)})


OUTPUT = _OutputBuffer()


def send(msg):
    OUTPUT.flush()
    _raw_send(msg)


def _flusher():
    while True:
        time.sleep(0.03)
        try:
            OUTPUT.flush()
        except Exception:
            pass


class OutStream(object):
    def __init__(self, name):
        self.name = name
        self.softspace = 0
        self.closed = False
        self.mode = 'w'

    @property
    def encoding(self):
        return S.encoding

    def write(self, data):
        if isinstance(data, unicode):
            text = data
        else:
            if not isinstance(data, str):
                data = str(data)
            text = data.decode(S.encoding, 'replace')
        if text:
            OUTPUT.add(self.name, text)

    def writelines(self, lines):
        for line in lines:
            self.write(line)

    def flush(self):
        OUTPUT.flush()

    def isatty(self):
        return False

    def fileno(self):
        return 1 if self.name == 'stdout' else 2


# --- Είσοδος ----------------------------------------------------------------
_cmd_queue = Queue.Queue()


def _reader():
    while True:
        line = _proto_in.readline()
        if not line:
            os._exit(0)
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        # οι εντολές του βήμα-βήμα ισχύουν αμέσως, ακόμα και όσο το πρόγραμμα περιμένει
        if msg.get('cmd') in ('trace', 'step'):
            TRACE.command(msg)
        else:
            _cmd_queue.put(msg)


def _pump_tk():
    tk = sys.modules.get('Tkinter')
    root = getattr(tk, '_default_root', None) if tk else None
    if root is not None:
        try:
            root.update()
        except Exception:
            pass


def wait_cmd(accept):
    """Περιμένει εντολή από το IDE με cmd μέσα στο accept. Στο μεταξύ κρατά
    ζωντανά τυχόν παράθυρα Tkinter."""
    while True:
        try:
            msg = _cmd_queue.get(True, 0.05)
        except Queue.Empty:
            _pump_tk()
            continue
        if msg.get('cmd') in accept:
            return msg


class InStream(object):
    closed = False
    mode = 'r'
    softspace = 0

    @property
    def encoding(self):
        return S.encoding

    def readline(self, size=-1):
        send({'type': 'input_request'})
        msg = wait_cmd(('input',))
        text = msg.get('text', u'')
        if not text.endswith(u'\n'):
            text += u'\n'
        S.last_input = text.rstrip(u'\n')
        return text.encode(S.encoding, 'replace')

    read = readline

    def readlines(self):
        return [self.readline()]

    def __iter__(self):
        return self

    def next(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line

    def isatty(self):
        return False

    def fileno(self):
        return 0


# --- Import αρχείων του μαθητή ----------------------------------------------
class StudentImporter(object):
    """Φορτώνει modules από τον φάκελο του προγράμματος με τους ίδιους κανόνες
    κωδικοποίησης (χωρίς να απαιτείται δήλωση coding)."""

    def __init__(self, folder_u):
        self.folder = folder_u
        self.found = {}

    def find_module(self, fullname, path=None):
        if path is not None or '.' in fullname or not self.folder:
            return None
        fp = os.path.join(self.folder, fullname.decode('ascii', 'replace') + u'.py')
        if os.path.isfile(fp):
            self.found[fullname] = fp
            return self
        return None

    def load_module(self, fullname):
        if fullname in sys.modules:
            return sys.modules[fullname]
        fp_u = self.found[fullname]
        fp_b = U.fs_encode(fp_u)
        with open(fp_u, 'rb') as f:
            text = U.decode_file_bytes(f.read())
        enc, _ = U.choose_encoding(text, S.default_encoding)
        register_source(fp_b, text)
        code = U.compile_source(text, fp_b, enc)
        mod = imp.new_module(fullname)
        mod.__file__ = fp_b
        mod.__loader__ = self
        sys.modules[fullname] = mod
        try:
            exec code in mod.__dict__
        except BaseException:
            sys.modules.pop(fullname, None)
            raise
        return mod


def register_source(filename_b, text):
    for m in STAR_RE.finditer(text):
        S.star_modules.add(m.group(1).encode('ascii', 'replace'))
    lines = U.normalize_source(text).split(u'\n')
    S.sources[filename_b] = lines
    linecache.cache[filename_b] = (
        len(text), None, [l.encode('utf-8') + '\n' for l in lines], filename_b)


# --- Αναφορά λαθών ----------------------------------------------------------
def _line_for(filename, lineno):
    lines = S.sources.get(filename)
    if lines is not None:
        if lineno and 1 <= lineno <= len(lines):
            return lines[lineno - 1]
        return None
    line = linecache.getline(filename, lineno)
    return U.to_u(line).rstrip(u'\r\n') if line else None


def _is_own(filename):
    try:
        return os.path.normcase(os.path.abspath(filename)) in OWN_FILES
    except Exception:
        return False


def _display_name(filename):
    if filename == S.prog_path_b and S.prog_path_u:
        return S.prog_path_u
    return U.fs_decode(filename)


def _exc_type_name(etype):
    name = getattr(etype, '__name__', str(etype))
    mod = getattr(etype, '__module__', None)
    if mod and mod not in ('exceptions', '__main__', '__builtin__'):
        return '%s.%s' % (mod, name)
    return name


_HEX_RUN_RE = re.compile(r'(?:\\x[0-9a-fA-F]{2})+')


def _unescape_hex(text):
    """'\\xf0\\xdd' μέσα σε μηνύματα λάθους -> πραγματικοί (ελληνικοί) χαρακτήρες."""
    def repl(m):
        raw = m.group(0).replace('\\x', '').decode('hex')
        return raw.decode(S.encoding, 'replace').encode('utf-8')
    return _HEX_RUN_RE.sub(repl, text).decode('utf-8', 'replace')


def _exc_message(value):
    if isinstance(value, SyntaxError):
        return U.to_u(value.msg, S.encoding)
    try:
        s = str(value)
        if '\\x' in s:
            try:
                s.decode('ascii')
                return _unescape_hex(s)
            except UnicodeError:
                pass
        return s.decode(S.encoding, 'replace')
    except UnicodeError:
        try:
            return unicode(value)
        except Exception:
            return u'<μη εκτυπώσιμο μήνυμα>'
    except Exception:
        return u'<μη εκτυπώσιμο μήνυμα>'


def _visible_names(tb):
    names = set(dir(__builtin__))
    while tb is not None and tb.tb_next is not None:
        tb = tb.tb_next
    if tb is not None:
        names.update(tb.tb_frame.f_globals.keys())
        names.update(tb.tb_frame.f_locals.keys())
    return sorted(n for n in names if not n.startswith('__'))


def report_exception(phase, source_text=None):
    """Στέλνει μήνυμα error για την τρέχουσα εξαίρεση (sys.exc_info)."""
    etype, value, tb = sys.exc_info()
    frames = []
    for fn, ln, name, _ in traceback.extract_tb(tb):
        if _is_own(fn) or fn in ('codeop.py',) or fn.endswith(('codeop.py', 'codeop.pyc')):
            continue
        frames.append({'filename': _display_name(fn), 'lineno': ln,
                       'name': U.to_u(name), 'line': _line_for(fn, ln),
                       'user': fn == S.prog_path_b or fn == SHELL_FILE})

    msg = _exc_message(value)
    type_name = _exc_type_name(etype)
    out = {'type': 'error', 'phase': phase, 'exc_type': type_name, 'message': msg,
           'frames': frames, 'cwd': os.getcwdu(), 'encoding': S.encoding,
           'last_input': S.last_input, 'location': None}

    lines = [u'Traceback (most recent call last):'] if frames else []
    for fr in frames:
        lines.append(u'  File "%s", line %s, in %s' % (fr['filename'], fr['lineno'], fr['name']))
        if fr['line']:
            lines.append(u'    ' + fr['line'].strip())

    user = [f for f in frames if f['user']]
    if user:
        f = user[-1]
        out['location'] = {'filename': f['filename'], 'lineno': f['lineno'], 'col': None,
                           'line': f['line']}
    if isinstance(value, SyntaxError):
        fn = value.filename or ''
        text = source_text if fn in (S.prog_path_b, SHELL_FILE) else None
        if text is None and fn in S.sources:
            text = u'\n'.join(S.sources[fn])
        lineno, col, line_u = U.syntax_error_info(value, text, S.encoding)
        if fn in S.sources or fn == S.prog_path_b or not user:
            out['location'] = {'filename': _display_name(fn), 'lineno': lineno, 'col': col,
                               'line': line_u}
        lines.append(u'  File "%s", line %s' % (_display_name(fn), lineno))
        if line_u is not None:
            stripped = line_u.lstrip()
            lines.append(u'    ' + stripped)
            if col is not None:
                caret = max(0, col - (len(line_u) - len(stripped)))
                lines.append(u'    ' + u' ' * caret + u'^')
    lines.append(u'%s: %s' % (type_name, msg) if msg else type_name)
    out['traceback'] = u'\n'.join(lines)

    if etype is NameError or type_name == 'UnboundLocalError':
        out['names'] = _visible_names(tb)
    # NameError/SyntaxError μέσα από την input(): ο μαθητής έδωσε κείμενο στην input()
    if isinstance(value, SyntaxError) and value.filename == '<string>':
        caller = frames[-1] if frames else None
    elif len(frames) >= 2 and frames[-1]['filename'] == u'<string>':
        caller = frames[-2]
    else:
        caller = None
    out['from_input'] = bool(caller and u'input' in (caller['line'] or u''))
    del tb
    send(out)


def report_encode_error(err, text, filename_u):
    lineno, col, ch = U.encode_error_info(err, text)
    line = U.normalize_source(text).split(u'\n')[lineno - 1]
    msg = (u"ο χαρακτήρας '%s' δεν υπάρχει στην κωδικοποίηση %s" % (ch, S.encoding))
    send({'type': 'error', 'phase': 'compile', 'exc_type': 'UnicodeEncodeError',
          'message': msg, 'frames': [], 'cwd': os.getcwdu(), 'encoding': S.encoding,
          'last_input': None, 'from_input': False, 'char': ch,
          'location': {'filename': filename_u, 'lineno': lineno, 'col': col, 'line': line},
          'traceback': u'  File "%s", line %d\n    %s\nUnicodeEncodeError: %s'
                       % (filename_u, lineno, line.strip(), msg)})


# --- Μεταβλητές -------------------------------------------------------------
def friendly_repr(v, depth=0):
    """repr όπου τα ελληνικά φαίνονται ως ελληνικά (μόνο για το πάνελ μεταβλητών)."""
    t = type(v)
    if t is str or t is unicode:
        s = v.decode(S.encoding, 'replace') if t is str else v
        s = (s.replace(u'\\', u'\\\\').replace(u"'", u"\\'").replace(u'\n', u'\\n')
             .replace(u'\r', u'\\r').replace(u'\t', u'\\t'))
        if len(s) > MAX_REPR:
            s = s[:MAX_REPR] + u'…'
        return (u"u'" if t is unicode else u"'") + s + u"'"
    if depth > 3:
        return u'…'
    if t in (list, tuple, set, frozenset):
        items = []
        for i, x in enumerate(v):
            if i >= 100:
                items.append(u'…')
                break
            items.append(friendly_repr(x, depth + 1))
        body = u', '.join(items)
        if t is list:
            return u'[' + body + u']'
        if t is tuple:
            return u'(' + body + (u',)' if len(v) == 1 else u')')
        return u'%s([%s])' % (t.__name__, body)
    if t is dict:
        items = []
        for i, (k, x) in enumerate(v.items()):
            if i >= 100:
                items.append(u'…')
                break
            items.append(friendly_repr(k, depth + 1) + u': ' + friendly_repr(x, depth + 1))
        return u'{' + u', '.join(items) + u'}'
    try:
        r = repr(v)
    except Exception:
        return u'<σφάλμα στο repr>'
    return U.to_u(r, S.encoding)


def _imported_names(ns):
    """Ονόματα που ήρθαν από `from X import *` (π.χ. Tkinter) και δεν θέλουμε στο πάνελ."""
    hidden = set()
    mods = [sys.modules[n] for n in S.star_modules if sys.modules.get(n) is not None]
    if not mods:
        return hidden
    for name, value in ns.items():
        for m in mods:
            d = getattr(m, '__dict__', None)
            if d is not None and d is not ns and d.get(name, hidden) is value:
                hidden.add(name)
                break
    return hidden


def function_signature(name, func):
    """Η «υπογραφή» μιας συνάρτησης, π.χ. dequeue(queue) ή f(a, b=1, *args).
    Αντί για <function dequeue at 0x02D82370>, που δεν λέει κάτι στον μαθητή."""
    if isinstance(func, types.FunctionType):
        try:
            args, varargs, keywords, defaults = inspect.getargspec(func)
        except TypeError:
            return u'%s(…)' % U.to_u(name)
        parts = []
        first_default = len(args) - len(defaults or ())
        for i, a in enumerate(args):
            a = U.to_u(a) if isinstance(a, basestring) else u'(…)'
            if i >= first_default:
                a += u'=' + friendly_repr(defaults[i - first_default], 1)
            parts.append(a)
        if varargs:
            parts.append(u'*' + U.to_u(varargs))
        if keywords:
            parts.append(u'**' + U.to_u(keywords))
        return u'%s(%s)' % (U.to_u(name), u', '.join(parts))
    return u'%s(…)' % U.to_u(name)


def describe_globals(ns):
    hidden = _imported_names(ns)
    out = []
    for name in sorted(ns.keys(), key=lambda n: n.lower()):
        if name.startswith('__') or name in hidden:
            continue
        v = ns[name]
        if isinstance(v, types.ModuleType):
            continue
        if isinstance(v, (types.FunctionType, types.BuiltinFunctionType)):
            # για lambda το όνομα της μεταβλητής, αλλιώς το όνομα του def
            fname = name if v.__name__ == '<lambda>' else v.__name__
            item = {'name': U.to_u(name), 'type': type(v).__name__, 'kind': 'function',
                    'repr': function_signature(fname, v)}
            code = getattr(v, 'func_code', None)
            if code is not None and code.co_filename == S.prog_path_b:
                item['line'] = code.co_firstlineno
            doc = getattr(v, '__doc__', None)
            if doc and isinstance(v, types.FunctionType):
                item['doc'] = U.to_u(doc.strip().split('\n')[0], S.encoding)[:300]
            out.append(item)
            continue
        item = {'name': U.to_u(name), 'type': type(v).__name__, 'repr': friendly_repr(v)}
        if isinstance(v, (str, unicode, list, tuple, dict, set, frozenset)):
            item['len'] = len(v)
        out.append(item)
    return out


def send_globals(ns):
    try:
        send({'type': 'globals', 'vars': describe_globals(ns)})
    except Exception:
        send({'type': 'globals', 'vars': []})


# --- Εκτέλεση βήμα-βήμα ----------------------------------------------------
class _Trace(object):
    """Η εκτέλεση βήμα-βήμα. Οι ρυθμίσεις αλλάζουν από το νήμα _reader ενώ τρέχει
    το πρόγραμμα (π.χ. ο μαθητής περνά από «Αργή» σε «Γραμμή γραμμή»)."""

    def __init__(self):
        self.cond = threading.Condition()
        self.mode = 'off'       # off | step | auto
        self.delay = 0.0        # δευτερόλεπτα ανά γραμμή (mode = auto)
        self.steps = 0          # πατήματα «Επόμενη» που δεν έχουν καταναλωθεί

    def command(self, msg):
        with self.cond:
            if msg.get('cmd') == 'step':
                self.steps += 1
            else:
                self.mode = msg.get('mode') or 'off'
                self.delay = max(0.0, float(msg.get('delay') or 0) / 1000.0)
                self.steps = 0
            self.cond.notify_all()

    def pause(self):
        """Περιμένει πριν από την επόμενη γραμμή, ανάλογα με την ταχύτητα."""
        start = time.time()
        with self.cond:
            while True:
                if self.mode == 'step':
                    if self.steps > 0:
                        self.steps -= 1
                        return
                    self.cond.wait(0.1)
                elif self.mode == 'auto':
                    left = self.delay - (time.time() - start)
                    if left <= 0:
                        return
                    self.cond.wait(min(left, 0.1))
                else:
                    return


TRACE = _Trace()


def _send_step(frame):
    g = frame.f_globals
    msg = {'type': 'step', 'line': frame.f_lineno, 'vars': describe_globals(g)}
    if frame.f_code.co_name != '<module>' and frame.f_locals is not g:
        msg['func'] = U.to_u(frame.f_code.co_name)
        msg['locals'] = describe_globals(frame.f_locals)
    send(msg)


def _local_trace(frame, event, arg):
    if event == 'line' and TRACE.mode != 'off':
        try:
            _send_step(frame)
        except Exception:
            pass
        TRACE.pause()
    return _local_trace


def _global_trace(frame, event, arg):
    # μόνο οι γραμμές του προγράμματος του μαθητή, όχι οι βιβλιοθήκες
    if event == 'call' and frame.f_code.co_filename == S.prog_path_b:
        return _local_trace
    return None


# --- Εκτέλεση ---------------------------------------------------------------
def make_namespace(path_b):
    ns = {'__name__': '__main__', '__builtins__': __builtin__, '__doc__': None}
    if path_b:
        ns['__file__'] = path_b
    main_mod = imp.new_module('__main__')
    main_mod.__dict__.update(ns)
    sys.modules['__main__'] = main_mod
    return main_mod.__dict__


def setup_folder(folder_u):
    if folder_u and os.path.isdir(folder_u):
        os.chdir(folder_u)
        sys.path.insert(0, U.fs_encode(folder_u))
        sys.meta_path.insert(0, StudentImporter(folder_u))


def run_program(msg):
    path_u = msg.get('path') or u'<χωρίς όνομα>'
    text = msg.get('source', u'')
    S.default_encoding = msg.get('encoding') or 'cp1253'
    enc, reason = U.choose_encoding(text, S.default_encoding)
    S.encoding = enc
    S.prog_path_u = path_u
    S.prog_path_b = U.fs_encode(path_u)
    folder = msg.get('cwd') or (os.path.dirname(path_u) if msg.get('path') else None)
    setup_folder(folder)
    sys.argv = [S.prog_path_b]
    ns = make_namespace(S.prog_path_b)
    register_source(S.prog_path_b, text)
    send({'type': 'started', 'encoding': enc, 'reason': reason, 'cwd': os.getcwdu()})

    ok = False
    try:
        code = U.compile_source(text, S.prog_path_b, enc)
    except UnicodeEncodeError as e:
        report_encode_error(e, text, path_u)
        code = None
    except (SyntaxError, TypeError, ValueError, OverflowError):
        report_exception('compile', text)
        code = None
    trace = msg.get('trace')
    if code is not None:
        if trace and trace.get('mode', 'off') != 'off':
            TRACE.command(dict(trace, cmd='trace'))
            sys.settrace(_global_trace)
        try:
            exec code in ns
            ok = True
        except SystemExit as e:
            ok = e.code in (None, 0)
            if not ok and e.code is not None:
                if isinstance(e.code, (int, long)):
                    OUTPUT.add('stderr', u'(Το πρόγραμμα τερμάτισε με κωδικό %d)\n' % e.code)
                else:
                    OUTPUT.add('stderr', U.to_u(e.code, S.encoding) + u'\n')
        except BaseException:
            report_exception('run', text)
        finally:
            sys.settrace(None)
    _pump_tk()
    send({'type': 'done', 'ok': ok})
    send_globals(ns)
    return ns


def repl_loop(ns):
    buf = []
    send({'type': 'prompt', 'more': False})
    while True:
        msg = wait_cmd(('repl', 'globals'))
        if msg['cmd'] == 'globals':
            send_globals(ns)
            continue
        buf.append(msg.get('line', u''))
        source = u'\n'.join(buf)
        try:
            data = U.normalize_source(source).encode(S.encoding)
        except UnicodeEncodeError as e:
            buf = []
            report_encode_error(e, source, u'<shell>')
            send({'type': 'prompt', 'more': False})
            continue
        try:
            code = codeop.compile_command(data, SHELL_FILE, 'single')
        except (SyntaxError, OverflowError, ValueError, TypeError):
            buf = []
            register_source(SHELL_FILE, source)
            report_exception('repl', source)
            send({'type': 'prompt', 'more': False})
            continue
        if code is None:
            send({'type': 'prompt', 'more': True})
            continue
        buf = []
        register_source(SHELL_FILE, source)
        try:
            exec code in ns
        except SystemExit:
            OUTPUT.add('stderr', u'(Το exit() αγνοείται στο Shell)\n')
        except BaseException:
            report_exception('repl', source)
        sys.stdout.softspace = 0
        _pump_tk()
        send_globals(ns)
        send({'type': 'prompt', 'more': False})


def main():
    sys.stdout = OutStream('stdout')
    sys.stderr = OutStream('stderr')
    sys.stdin = InStream()
    for target in (_reader, _flusher):
        t = threading.Thread(target=target)
        t.daemon = True
        t.start()
    send({'type': 'ready', 'version': U.to_u(sys.version.split()[0]),
          'executable': U.fs_decode(sys.executable)})
    msg = wait_cmd(('run', 'shell'))
    if msg['cmd'] == 'run':
        ns = run_program(msg)
    else:
        S.default_encoding = msg.get('encoding') or 'cp1253'
        S.encoding = U.choose_encoding(u'', S.default_encoding)[0]
        setup_folder(msg.get('cwd'))
        ns = make_namespace(None)
    repl_loop(ns)


if __name__ == '__main__':
    main()
