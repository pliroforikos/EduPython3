"""Κοινά βοηθήματα για runner.py και checker.py (Python 3).

Ο κώδικας μεταγλωττίζεται απευθείας ως str σε UTF-8.
"""
import re

TK_RE = re.compile(
    r'^[ \t]*(?:from|import)[ \t]+'
    r'(?:tkinter|tkinter\.messagebox|tkinter\.filedialog|tkinter\.simpledialog|'
    r'tkinter\.ttk|tkinter\.font|tkinter\.scrolledtext)\b',
    re.M)


def is_tkinter(text):
    """Ελέγχει αν ο κώδικας κάνει import το Tkinter."""
    return bool(TK_RE.search(text))


def normalize_source(text):
    """Κανονικοποίηση αλλαγών γραμμής και αφαίρεση τυχόν UTF-8 BOM."""
    if not text:
        return ''
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    if text.startswith('\ufeff'):
        text = text[1:]
    return text


def compile_source(text, filename, mode='exec'):
    """Μεταγλωττίζει πηγαίο κώδικα str. Μπορεί να σηκώσει SyntaxError."""
    data = normalize_source(text)
    if mode == 'exec' and not data.endswith('\n'):
        data += '\n'
    return compile(data, filename, mode)


def syntax_error_info(err, text):
    """Πληροφορίες θέσης για SyntaxError: (lineno, col, end_col, line_str)."""
    lineno = err.lineno
    lines = normalize_source(text).split('\n') if text is not None else []
    line_str = None
    if lineno and 1 <= lineno <= len(lines):
        line_str = lines[lineno - 1]
    col = max(0, err.offset - 1) if err.offset else None
    end_col = max(0, err.end_offset - 1) if getattr(err, 'end_offset', None) else None
    if line_str is None and err.text:
        line_str = err.text.rstrip('\r\n')
    return lineno, col, end_col, line_str
