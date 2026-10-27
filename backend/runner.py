"""Backend εκτέλεσης προγραμμάτων Python 3 (μοντέλο Thonny).

Πρωτόκολλο: μία εντολή JSON ανά γραμμή στο stdin, ένα μήνυμα JSON ανά γραμμή
στο stdout. Το πρόγραμμα του μαθητή βλέπει δικά μας sys.stdin/stdout/stderr.

Εντολές:   {"cmd":"run", "path", "source", "encoding"}
           {"cmd":"shell", "cwd", "encoding"}
           {"cmd":"input", "text"}      απάντηση σε input()
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
import inspect
import re
import time
import queue
import builtins

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)
import _epal_util as U  # noqa: E402
sys.path[:] = [p for p in sys.path if os.path.normcase(os.path.abspath(p or '.')) !=
               os.path.normcase(BACKEND_DIR)]

OWN_FILES = set(os.path.normcase(os.path.join(BACKEND_DIR, f))
                for f in ('runner.py', '_epal_util.py'))
SHELL_FILE = '<shell>'
MAX_REPR = 1500
STAR_RE = re.compile(r'^[ \t]*from[ \t]+([\w.]+)[ \t]+import[ \t]*\*', re.M)

# --- Ιδιωτικά κανάλια πρωτοκόλλου -------------------------------------------
# Κρατάμε αντίγραφα των fd 0/1 για το πρωτόκολλο (σε binary). Το fd 0 δείχνει
# πλέον στο devnull και το fd 1 στο stderr, ώστε έξοδος από C κώδικα ή
# υποδιεργασίες (os.system) να μη χαλάει το JSON πρωτόκολλο.
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
    data = (json.dumps(msg, ensure_ascii=False) + '\n').encode('utf-8')
    with _write_lock:
        _proto_out.write(data)


class _State:
    encoding = 'utf-8'
    default_encoding = 'utf-8'
    prog_path = None        # διαδρομή προγράμματος (str)
    last_input = None
    sources = {}            # όνομα αρχείου (str) -> λίστα str γραμμών
    star_modules = set()    # modules από `from X import *`


S = _State()


# --- Έξοδος -----------------------------------------------------------------
class _OutputBuffer:
    """Συγκεντρώνει την έξοδο και τη στέλνει ανά ~30ms ή όταν χρειάζεται."""

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
            self.budget = max(self.budget, -self.RATE)
            self.last = now
            delay = -self.budget / self.RATE if self.budget < 0 else 0
        if big:
            self.flush()
        if delay:
            time.sleep(min(delay, 1.0))

    def flush(self):
        with self.flush_lock:
            with self.lock:
                items, self.items, self.size = self.items, [], 0
            for stream, parts in items:
                _raw_send({'type': 'out', 'stream': stream, 'text': ''.join(parts)})


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


class OutStream:
    def __init__(self, name):
        self.name = name
        self.closed = False
        self.mode = 'w'

    @property
    def encoding(self):
        return 'utf-8'

    def write(self, data):
        if not isinstance(data, str):
            data = str(data)
        if data:
            OUTPUT.add(self.name, data)
        return len(data)

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
_cmd_queue = queue.Queue()


def _reader():
    while True:
        line = _proto_in.readline()
        if not line:
            os._exit(0)
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line.decode('utf-8', 'replace'))
        except ValueError:
            continue
        if msg.get('cmd') in ('trace', 'step'):
            TRACE.command(msg)
        else:
            _cmd_queue.put(msg)


def _pump_tk():
    tk = sys.modules.get('tkinter')
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
        except queue.Empty:
            _pump_tk()
            continue
        if msg.get('cmd') in accept:
            return msg


class InStream:
    closed = False
    mode = 'r'

    @property
    def encoding(self):
        return 'utf-8'

    def readline(self, size=-1):
        send({'type': 'input_request'})
        msg = wait_cmd(('input',))
        text = msg.get('text', '')
        if not text.endswith('\n'):
            text += '\n'
        S.last_input = text.rstrip('\n')
        return text

    read = readline

    def readlines(self):
        return [self.readline()]

    def __iter__(self):
        return self

    def __next__(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line

    def isatty(self):
        return False

    def fileno(self):
        return 0


def _edu_input(prompt=''):
    """Αντικατάσταση της builtins.input ώστε να στέλνει input_request στο IDE."""
    if prompt:
        sys.stdout.write(str(prompt))
        sys.stdout.flush()
    send({'type': 'input_request'})
    msg = wait_cmd(('input',))
    text = msg.get('text', '')
    if text.endswith('\n'):
        text = text[:-1]
    S.last_input = text
    return text


def register_source(filename, text):
    if not filename or not text:
        return
    for m in STAR_RE.finditer(text):
        S.star_modules.add(m.group(1))
    lines = U.normalize_source(text).split('\n')
    S.sources[filename] = lines
    linecache.cache[filename] = (
        len(text), None, [l + '\n' for l in lines], filename)


# --- Αναφορά λαθών ----------------------------------------------------------
def _line_for(filename, lineno):
    lines = S.sources.get(filename)
    if lines is not None:
        if lineno and 1 <= lineno <= len(lines):
            return lines[lineno - 1]
        return None
    line = linecache.getline(filename, lineno)
    return line.rstrip('\r\n') if line else None


def _is_own(filename):
    try:
        return os.path.normcase(os.path.abspath(filename)) in OWN_FILES
    except Exception:
        return False


def _display_name(filename):
    if filename == S.prog_path and S.prog_path:
        return S.prog_path
    return filename


def _exc_type_name(etype):
    name = getattr(etype, '__name__', str(etype))
    mod = getattr(etype, '__module__', None)
    if mod and mod not in ('builtins', '__main__'):
        return f'{mod}.{name}'
    return name


def _exc_message(value):
    if isinstance(value, SyntaxError):
        return str(value.msg or '')
    return str(value)


def _visible_names(tb):
    names = set(dir(builtins))
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
                       'name': name, 'line': _line_for(fn, ln),
                       'user': fn == S.prog_path or fn == SHELL_FILE})

    msg = _exc_message(value)
    type_name = _exc_type_name(etype)
    out = {'type': 'error', 'phase': phase, 'exc_type': type_name, 'message': msg,
           'frames': frames, 'cwd': os.getcwd(), 'encoding': S.encoding,
           'last_input': S.last_input, 'location': None}

    lines = ['Traceback (most recent call last):'] if frames else []
    for fr in frames:
        lines.append(f'  File "{fr["filename"]}", line {fr["lineno"]}, in {fr["name"]}')
        if fr['line']:
            lines.append('    ' + fr['line'].strip())

    user = [f for f in frames if f['user']]
    if user:
        f = user[-1]
        out['location'] = {'filename': f['filename'], 'lineno': f['lineno'], 'col': None,
                           'line': f['line']}
    if isinstance(value, SyntaxError):
        fn = value.filename or ''
        text = source_text if fn in (S.prog_path, SHELL_FILE) else None
        if text is None and fn in S.sources:
            text = '\n'.join(S.sources[fn])
        lineno, col, end_col, line_str = U.syntax_error_info(value, text)
        if fn in S.sources or fn == S.prog_path or not user:
            out['location'] = {'filename': _display_name(fn), 'lineno': lineno, 'col': col,
                               'end_col': end_col, 'line': line_str}
        lines.append(f'  File "{_display_name(fn)}", line {lineno}')
        if line_str is not None:
            stripped = line_str.lstrip()
            lines.append('    ' + stripped)
            if col is not None:
                caret = max(0, col - (len(line_str) - len(stripped)))
                if end_col is not None and getattr(value, 'end_lineno', lineno) == lineno and end_col > col:
                    width = max(1, end_col - col)
                    lines.append('    ' + ' ' * caret + '^' * width)
                else:
                    lines.append('    ' + ' ' * caret + '^')
    lines.append(f'{type_name}: {msg}' if msg else type_name)
    out['traceback'] = '\n'.join(lines)

    if etype is NameError or type_name == 'UnboundLocalError':
        out['names'] = _visible_names(tb)
    del tb
    send(out)


# --- Μεταβλητές -------------------------------------------------------------
def friendly_repr(v, depth=0):
    """repr όπου τα ελληνικά φαίνονται ως ελληνικά (μόνο για το πάνελ μεταβλητών)."""
    t = type(v)
    if t is str:
        s = (v.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')
             .replace('\r', '\\r').replace('\t', '\\t'))
        if len(s) > MAX_REPR:
            s = s[:MAX_REPR] + '…'
        return "'" + s + "'"
    if t is bytes:
        r = repr(v)
        if len(r) > MAX_REPR:
            r = r[:MAX_REPR] + '…'
        return r
    if depth > 3:
        return '…'
    if t in (list, tuple, set, frozenset):
        items = []
        for i, x in enumerate(v):
            if i >= 100:
                items.append('…')
                break
            items.append(friendly_repr(x, depth + 1))
        body = ', '.join(items)
        if t is list:
            return '[' + body + ']'
        if t is tuple:
            return '(' + body + (',)' if len(v) == 1 else ')')
        return f'{t.__name__}([{body}])'
    if t is dict:
        items = []
        for i, (k, x) in enumerate(v.items()):
            if i >= 100:
                items.append('…')
                break
            items.append(friendly_repr(k, depth + 1) + ': ' + friendly_repr(x, depth + 1))
        return '{' + ', '.join(items) + '}'
    try:
        r = repr(v)
    except Exception:
        return '<σφάλμα στο repr>'
    return r


def _imported_names(ns):
    """Ονόματα που ήρθαν από `from X import *` (π.χ. tkinter) και δεν θέλουμε στο πάνελ."""
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
    """Η «υπογραφή» μιας συνάρτησης, π.χ. dequeue(queue) ή f(a, b=1, *args)."""
    if isinstance(func, types.FunctionType):
        try:
            sig = inspect.signature(func)
            return f'{name}{sig}'
        except (ValueError, TypeError):
            return f'{name}(…)'
    return f'{name}(…)'


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
            fname = name if v.__name__ == '<lambda>' else v.__name__
            item = {'name': name, 'type': type(v).__name__, 'kind': 'function',
                    'repr': function_signature(fname, v)}
            code = getattr(v, '__code__', None)
            if code is not None and code.co_filename == S.prog_path:
                item['line'] = code.co_firstlineno
            doc = getattr(v, '__doc__', None)
            if doc and isinstance(v, types.FunctionType):
                item['doc'] = doc.strip().split('\n')[0][:300]
            out.append(item)
            continue
        item = {'name': name, 'type': type(v).__name__, 'repr': friendly_repr(v)}
        if isinstance(v, (str, bytes, list, tuple, dict, set, frozenset, range)):
            try:
                item['len'] = len(v)
            except TypeError:
                pass
        out.append(item)
    return out


def send_globals(ns):
    try:
        send({'type': 'globals', 'vars': describe_globals(ns)})
    except Exception:
        send({'type': 'globals', 'vars': []})


# --- Εκτέλεση βήμα-βήμα ----------------------------------------------------
class _Trace:
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
        msg['func'] = frame.f_code.co_name
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
    if event == 'call' and frame.f_code.co_filename == S.prog_path:
        return _local_trace
    return None


# --- Εκτέλεση ---------------------------------------------------------------
def make_namespace(path_str):
    ns = {'__name__': '__main__', '__builtins__': builtins, '__doc__': None}
    if path_str:
        ns['__file__'] = path_str
    main_mod = types.ModuleType('__main__')
    main_mod.__dict__.update(ns)
    sys.modules['__main__'] = main_mod
    return main_mod.__dict__


def setup_folder(folder):
    if folder and os.path.isdir(folder):
        os.chdir(folder)
        norm = os.path.normcase(os.path.abspath(folder))
        if not any(os.path.normcase(os.path.abspath(p or '.')) == norm for p in sys.path):
            sys.path.insert(0, folder)


def run_program(msg):
    path_str = msg.get('path') or '<χωρίς όνομα>'
    text = msg.get('source', '')
    S.default_encoding = 'utf-8'
    S.encoding = 'utf-8'
    S.prog_path = path_str
    folder = msg.get('cwd') or (os.path.dirname(path_str) if msg.get('path') else None)
    setup_folder(folder)
    sys.argv = [S.prog_path]
    ns = make_namespace(S.prog_path)
    register_source(S.prog_path, text)
    send({'type': 'started', 'encoding': 'utf-8', 'reason': 'python3', 'cwd': os.getcwd()})

    ok = False
    code = None
    try:
        code = U.compile_source(text, S.prog_path)
    except (SyntaxError, TypeError, ValueError, OverflowError):
        report_exception('compile', text)

    trace = msg.get('trace')
    if code is not None:
        if trace and trace.get('mode', 'off') != 'off':
            TRACE.command(dict(trace, cmd='trace'))
            sys.settrace(_global_trace)
        try:
            exec(code, ns)
            ok = True
        except SystemExit as e:
            ok = e.code in (None, 0)
            if not ok and e.code is not None:
                if isinstance(e.code, int):
                    OUTPUT.add('stderr', f'(Το πρόγραμμα τερμάτισε με κωδικό {e.code})\n')
                else:
                    OUTPUT.add('stderr', str(e.code) + '\n')
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
        buf.append(msg.get('line', ''))
        source = '\n'.join(buf)
        try:
            code = codeop.compile_command(U.normalize_source(source), SHELL_FILE, 'single')
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
            exec(code, ns)
        except SystemExit:
            OUTPUT.add('stderr', '(Το exit() αγνοείται στο Shell)\n')
        except BaseException:
            report_exception('repl', source)
        _pump_tk()
        send_globals(ns)
        send({'type': 'prompt', 'more': False})


def main():
    sys.stdout = OutStream('stdout')
    sys.stderr = OutStream('stderr')
    sys.stdin = InStream()
    builtins.input = _edu_input
    for target in (_reader, _flusher):
        t = threading.Thread(target=target)
        t.daemon = True
        t.start()
    send({'type': 'ready', 'version': sys.version.split()[0],
          'executable': sys.executable})
    msg = wait_cmd(('run', 'shell'))
    if msg['cmd'] == 'run':
        ns = run_program(msg)
    else:
        S.default_encoding = 'utf-8'
        S.encoding = 'utf-8'
        setup_folder(msg.get('cwd'))
        ns = make_namespace(None)
    repl_loop(ns)


if __name__ == '__main__':
    main()
