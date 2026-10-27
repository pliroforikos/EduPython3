# -*- coding: utf-8 -*-
"""Ζωντανός έλεγχος σύνταξης (Python 2.7).

Διαβάζει {"id", "source", "encoding"} ανά γραμμή και απαντά
{"id", "ok"} ή {"id", "ok": false, "exc_type", "message", "lineno", "col"}.
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _epal_util as U  # noqa: E402


def check(source, default_enc):
    enc, _ = U.choose_encoding(source, default_enc)
    try:
        U.compile_source(source, '<editor>', enc)
    except UnicodeEncodeError as e:
        lineno, col, ch = U.encode_error_info(e, source)
        return {'ok': False, 'exc_type': 'UnicodeEncodeError', 'lineno': lineno, 'col': col,
                'char': ch, 'encoding': enc,
                'message': u"ο χαρακτήρας '%s' δεν υπάρχει στην κωδικοποίηση %s" % (ch, enc)}
    except SyntaxError as e:
        lineno, col, line = U.syntax_error_info(e, source, enc)
        return {'ok': False, 'exc_type': type(e).__name__, 'lineno': lineno, 'col': col,
                'line': line, 'message': U.to_u(e.msg, enc)}
    except (TypeError, ValueError, OverflowError) as e:
        return {'ok': False, 'exc_type': type(e).__name__, 'lineno': 1, 'col': None,
                'message': U.to_u(str(e), enc)}
    return {'ok': True}


def main():
    out = sys.stdout
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        result = check(msg.get('source', u''), msg.get('encoding') or 'cp1253')
        result['id'] = msg.get('id')
        out.write(json.dumps(result) + '\n')
        out.flush()


if __name__ == '__main__':
    main()
