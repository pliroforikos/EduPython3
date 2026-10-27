"""Ζωντανός έλεγχος σύνταξης (Python 3).

Διαβάζει {"id", "source", "encoding"} ανά γραμμή και απαντά
{"id", "ok"} ή {"id", "ok": false, "exc_type", "message", "lineno", "col", "end_col", "line"}.
"""
import io
import json
import os
import sys
import tokenize

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _epal_util as U  # noqa: E402


def _has_greek(s):
    return any(('\u0370' <= c <= '\u03ff') or ('\u1f00' <= c <= '\u1fff') for c in s)


def check_greek_names(source):
    try:
        tokens = tokenize.tokenize(io.BytesIO(source.encode('utf-8')).readline)
        for tok in tokens:
            if tok.type == tokenize.NAME and _has_greek(tok.string):
                return {
                    'ok': False,
                    'exc_type': 'SyntaxError',
                    'lineno': tok.start[0],
                    'col': tok.start[1],
                    'end_col': tok.end[1],
                    'line': tok.line.rstrip('\r\n'),
                    'message': f"invalid character in identifier (ελληνικά στο όνομα '{tok.string}')",
                }
    except Exception:
        pass
    return None


def check(source, default_enc='utf-8', greek_names='warn'):
    if greek_names == 'error':
        err = check_greek_names(source)
        if err:
            return err
    try:
        U.compile_source(source, '<editor>', 'exec')
    except SyntaxError as e:
        lineno, col, end_col, line = U.syntax_error_info(e, source)
        return {'ok': False, 'exc_type': type(e).__name__, 'lineno': lineno, 'col': col,
                'end_col': end_col, 'line': line, 'message': str(e.msg)}
    except (TypeError, ValueError, OverflowError) as e:
        return {'ok': False, 'exc_type': type(e).__name__, 'lineno': 1, 'col': None,
                'message': str(e)}
    return {'ok': True}


def main():
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    out = sys.stdout
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        result = check(msg.get('source', ''), msg.get('encoding') or 'utf-8', msg.get('greekNames') or 'warn')
        result['id'] = msg.get('id')
        out.write(json.dumps(result, ensure_ascii=False) + '\n')
        out.flush()


if __name__ == '__main__':
    main()
