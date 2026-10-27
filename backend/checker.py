"""Ζωντανός έλεγχος σύνταξης (Python 3).

Διαβάζει {"id", "source", "encoding"} ανά γραμμή και απαντά
{"id", "ok"} ή {"id", "ok": false, "exc_type", "message", "lineno", "col", "end_col", "line"}.
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _epal_util as U  # noqa: E402


def check(source, default_enc='utf-8'):
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
        result = check(msg.get('source', ''), msg.get('encoding') or 'utf-8')
        result['id'] = msg.get('id')
        out.write(json.dumps(result, ensure_ascii=False) + '\n')
        out.flush()


if __name__ == '__main__':
    main()
