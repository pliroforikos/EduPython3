# -*- coding: utf-8 -*-
"""Κοινά βοηθήματα για runner.py και checker.py (Python 2.7).

Ο editor στέλνει τον κώδικα ως unicode. Τον κωδικοποιούμε σε bytes με την
κατάλληλη κωδικοποίηση και τον περνάμε στη compile(), που για bytes χωρίς
δήλωση coding δεν διαμαρτύρεται για μη-ASCII χαρακτήρες και κρατά σωστούς
τους αριθμούς γραμμών.
"""
import re
import sys
import codecs

CODING_RE = re.compile(r'^[ \t\f]*#.*?coding[:=][ \t]*([-\w.]+)')
TK_RE = re.compile(
    r'^[ \t]*(?:from|import)[ \t]+'
    r'(?:Tkinter|tkMessageBox|tkSimpleDialog|tkFileDialog|ttk|tkFont|ScrolledText)\b',
    re.M)

FS_ENCODING = sys.getfilesystemencoding() or ('mbcs' if sys.platform == 'win32' else 'utf-8')


def declared_encoding(text):
    """Η κωδικοποίηση της δήλωσης PEP 263 στις 2 πρώτες γραμμές (ή None)."""
    for line in text.splitlines()[:2]:
        m = CODING_RE.match(line)
        if m:
            name = m.group(1)
            try:
                return codecs.lookup(name).name
            except LookupError:
                return None
    return None


def choose_encoding(text, default):
    """Επιστρέφει (κωδικοποίηση, αιτία) για την εκτέλεση του κώδικα.

    1. δήλωση coding στον κώδικα
    2. Tkinter -> utf-8 (το Tcl ερμηνεύει τα byte strings ως UTF-8)
    3. η προεπιλογή των ρυθμίσεων (συνήθως cp1253)
    """
    enc = declared_encoding(text)
    if enc:
        return enc, 'declared'
    if TK_RE.search(text):
        return 'utf-8', 'tkinter'
    try:
        return codecs.lookup(default).name, 'default'
    except LookupError:
        return 'cp1253', 'default'


def normalize_source(text):
    text = text.replace(u'\r\n', u'\n').replace(u'\r', u'\n')
    if text.startswith(u'﻿'):
        text = text[1:]
    return text


def compile_source(text, filename, enc, mode='exec'):
    """Μεταγλωττίζει unicode κώδικα. Μπορεί να σηκώσει SyntaxError ή
    UnicodeEncodeError (χαρακτήρας που δεν χωρά στην κωδικοποίηση)."""
    data = normalize_source(text).encode(enc)
    if mode == 'exec' and not data.endswith('\n'):
        data += '\n'
    return compile(data, filename, mode, 0, True)


def fs_encode(path):
    """unicode διαδρομή -> bytes (σύμβαση της Python 2 για __file__ κ.λπ.)."""
    if isinstance(path, unicode):
        return path.encode(FS_ENCODING, 'replace')
    return path


def fs_decode(path):
    if isinstance(path, str):
        return path.decode(FS_ENCODING, 'replace')
    return path


def to_u(s, enc='utf-8'):
    if s is None:
        return None
    if isinstance(s, unicode):
        return s
    if not isinstance(s, str):
        try:
            s = str(s)
        except Exception:
            return u'?'
    try:
        return s.decode(enc)
    except (UnicodeError, LookupError):
        return s.decode('cp1253', 'replace')


def decode_file_bytes(raw):
    """Διαβάζει αρχείο πηγαίου κώδικα: δήλωση coding, αλλιώς utf-8, αλλιώς cp1253."""
    if raw.startswith(codecs.BOM_UTF8):
        return raw[3:].decode('utf-8', 'replace')
    head = raw.split('\n', 2)[:2]
    for line in head:
        m = CODING_RE.match(line)
        if m:
            try:
                return raw.decode(m.group(1))
            except (UnicodeError, LookupError):
                break
    try:
        return raw.decode('utf-8')
    except UnicodeError:
        return raw.decode('cp1253', 'replace')


def syntax_error_info(err, text, enc):
    """Πληροφορίες θέσης για SyntaxError: (γραμμή, στήλη 0-based ή None, γραμμή κώδικα)."""
    lineno = err.lineno
    lines = normalize_source(text).split(u'\n') if text is not None else []
    line_u = None
    if lineno and 1 <= lineno <= len(lines):
        line_u = lines[lineno - 1]
    col = None
    if err.offset and err.text:
        # το offset μετριέται σε bytes της γραμμής err.text
        text_enc = 'utf-8' if declared_encoding(text or u'') else enc
        raw = err.text
        if isinstance(raw, unicode):
            col = max(0, err.offset - 1)
        else:
            col = len(raw[:max(0, err.offset - 1)].decode(text_enc, 'replace'))
        if line_u is None:
            line_u = to_u(raw, text_enc).rstrip(u'\n')
    return lineno, col, line_u


def encode_error_info(err, text):
    """Για UnicodeEncodeError κατά την κωδικοποίηση του κώδικα: (γραμμή, στήλη, χαρακτήρας)."""
    src = normalize_source(text)
    start = err.start
    lineno = src.count(u'\n', 0, start) + 1
    col = start - (src.rfind(u'\n', 0, start) + 1)
    return lineno, col, src[start:err.end]
