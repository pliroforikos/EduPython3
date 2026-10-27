"""Tests για το backend/runner.py. Τρέχουν με Python 3:

    py -3 -m unittest discover -s tests -p "test_*.py"
"""
import os
import sys
import json
import shutil
import tempfile
import unittest
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNNER = os.path.join(ROOT, 'backend', 'runner.py')
CHECKER = os.path.join(ROOT, 'backend', 'checker.py')


class Session:
    def __init__(self):
        env = dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8')
        self.p = subprocess.Popen([sys.executable, '-u', '-B', RUNNER],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, env=env)
        self.messages = []
        ready = self.read()
        assert ready['type'] == 'ready', ready

    def send(self, **cmd):
        data = (json.dumps(cmd, ensure_ascii=False) + '\n').encode('utf-8')
        self.p.stdin.write(data)
        self.p.stdin.flush()

    def read(self):
        line = self.p.stdout.readline()
        if not line:
            err = self.p.stderr.read().decode('utf-8', 'replace')
            raise AssertionError('ο runner τερμάτισε: ' + err)
        msg = json.loads(line.decode('utf-8', 'replace'))
        self.messages.append(msg)
        return msg

    def until_prompt(self, inputs=()):
        inputs = list(inputs)
        while True:
            msg = self.read()
            if msg['type'] == 'input_request':
                self.send(cmd='input', text=inputs.pop(0))
            if msg['type'] == 'prompt':
                return msg

    def output(self, stream='stdout'):
        return ''.join(m['text'] for m in self.messages
                       if m['type'] == 'out' and m['stream'] == stream)

    def errors(self):
        return [m for m in self.messages if m['type'] == 'error']

    def last_globals(self):
        g = [m for m in self.messages if m['type'] == 'globals'][-1]
        return {v['name']: v for v in g['vars']}

    def close(self):
        try:
            if self.p.stdin:
                self.p.stdin.close()
            if self.p.stdout:
                self.p.stdout.close()
            if self.p.stderr:
                self.p.stderr.close()
            self.p.kill()
            self.p.wait()
        except OSError:
            pass


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='edupy3_')
        self.s = Session()

    def tearDown(self):
        self.s.close()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_code(self, source, inputs=(), name='prog.py'):
        path = os.path.join(self.tmp, name)
        self.path = path
        self.s.send(cmd='run', path=path, source=source, encoding='utf-8')
        return self.s.until_prompt(inputs)

    def test_greek_print_and_len(self):
        self.run_code("name = 'Αθήνα'\nprint(name, len(name))\n")
        self.assertEqual(self.s.output(), 'Αθήνα 5\n')
        self.assertEqual(self.s.errors(), [])
        g = self.s.last_globals()
        self.assertEqual(g['name']['repr'], "'Αθήνα'")
        self.assertEqual(g['name']['len'], 5)

    def test_input_and_int_conversion(self):
        self.run_code("x = input('Όνομα: ')\nn = int(input('Αριθμός: '))\n"
                      "print(x.upper(), n * 2)\n", inputs=['Kostas', '21'])
        self.assertEqual(self.s.output(), 'Όνομα: Αριθμός: KOSTAS 42\n')
        req = [m for m in self.s.messages if m['type'] == 'input_request']
        self.assertEqual(len(req), 2)

    def test_input_returns_str(self):
        self.run_code("val = input('Τιμή: ')\nprint(type(val).__name__, repr(val))\n", inputs=['42'])
        self.assertEqual(self.s.output(), "Τιμή: str '42'\n")

    def test_greek_input(self):
        self.run_code("x = input()\nprint(len(x), x)\n", inputs=['Αμυγδαλιά'])
        self.assertEqual(self.s.output(), '9 Αμυγδαλιά\n')

    def test_fstrings(self):
        self.run_code("onoma = 'Μαρία'\nvathmos = 19.5\nprint(f'{onoma}: {vathmos}')\n")
        self.assertEqual(self.s.output(), 'Μαρία: 19.5\n')
        self.assertEqual(self.s.errors(), [])

    def test_greek_names(self):
        self.run_code("μέτρηση = 10\ndef διπλάσιο(χ):\n    return χ * 2\nαποτέλεσμα = διπλάσιο(μέτρηση)\nprint(αποτέλεσμα)\n")
        self.assertEqual(self.s.output(), '20\n')
        self.assertEqual(self.s.errors(), [])
        g = self.s.last_globals()
        self.assertEqual(g['αποτέλεσμα']['repr'], '20')

    def test_syntax_error_location(self):
        self.run_code("x = 1\nif x > 0\n    print(x)\n")
        err = self.s.errors()[0]
        self.assertEqual(err['exc_type'], 'SyntaxError')
        self.assertEqual(err['location']['lineno'], 2)
        self.assertEqual(err['location']['col'], 8)
        self.assertIn('if x > 0', err['traceback'])

    def test_indentation_error(self):
        self.run_code("for i in range(3):\nprint(i)\n")
        err = self.s.errors()[0]
        self.assertEqual(err['exc_type'], 'IndentationError')
        self.assertEqual(err['location']['lineno'], 2)

    def test_runtime_traceback_hides_runner(self):
        self.run_code("def f(a):\n    return 10 / a\n\nprint(f(0))\n")
        err = self.s.errors()[0]
        self.assertEqual(err['exc_type'], 'ZeroDivisionError')
        self.assertEqual([f['lineno'] for f in err['frames']], [4, 2])
        self.assertNotIn('runner.py', err['traceback'])
        self.assertEqual(err['location']['lineno'], 2)
        self.assertTrue(err['traceback'].startswith('Traceback (most recent call last):'))

    def test_name_error_suggestions(self):
        self.run_code("athroisma = 0\nprint(athrisma)\n")
        err = self.s.errors()[0]
        self.assertEqual(err['exc_type'], 'NameError')
        self.assertIn('athroisma', err['names'])

    def test_value_error_greek_message(self):
        self.run_code("x = int(input())\n", inputs=['πέντε'])
        err = self.s.errors()[0]
        self.assertEqual(err['exc_type'], 'ValueError')
        self.assertIn('πέντε', err['message'])

    def test_relative_file_in_program_folder(self):
        self.run_code("f = open('data.txt', 'w', encoding='utf-8')\nf.write('Γεια')\nf.close()\n"
                      "print(open('data.txt', encoding='utf-8').read())\n")
        self.assertEqual(self.s.output(), 'Γεια\n')
        with open(os.path.join(self.tmp, 'data.txt'), 'rb') as f:
            self.assertEqual(f.read(), 'Γεια'.encode('utf-8'))

    def test_repl_after_run(self):
        self.run_code("x = 21\n")
        self.s.send(cmd='repl', line='x * 2')
        self.s.until_prompt()
        self.assertEqual(self.s.output(), '42\n')
        self.s.send(cmd='repl', line='for i in range(2):')
        self.assertTrue(self.s.until_prompt()['more'])
        self.s.send(cmd='repl', line='    print(i)')
        self.assertTrue(self.s.until_prompt()['more'])
        self.s.send(cmd='repl', line='')
        self.s.until_prompt()
        self.assertEqual(self.s.output(), '42\n0\n1\n')
        self.s.send(cmd='repl', line='y = 1 +')
        self.s.until_prompt()
        self.assertEqual(self.s.errors()[-1]['exc_type'], 'SyntaxError')
        self.assertEqual(self.s.errors()[-1]['phase'], 'repl')

    def test_tkinter_detection(self):
        self.run_code("import tkinter\nprint('Αθήνα')\n")
        started = [m for m in self.s.messages if m['type'] == 'started'][0]
        self.assertEqual(started['encoding'], 'utf-8')
        self.assertEqual(self.s.output(), 'Αθήνα\n')

    def test_tkinter_window_mainloop(self):
        self.run_code("from tkinter import *\nroot = Tk()\n"
                      "Label(root, text='Γεια σου').pack()\nroot.after(300, root.destroy)\n"
                      "root.mainloop()\nprint('τέλος')\n")
        self.assertEqual(self.s.errors(), [])
        self.assertEqual(self.s.output(), 'τέλος\n')
        g = self.s.last_globals()
        self.assertIn('root', g)
        self.assertNotIn('Label', g)   # ονόματα του `from tkinter import *` κρύβονται

    def test_declared_coding_respected(self):
        self.run_code("# -*- coding: utf-8 -*-\nprint(len('Αθήνα'))\n")
        self.assertEqual(self.s.output(), '5\n')

    def test_student_module_import(self):
        with open(os.path.join(self.tmp, 'mymod.py'), 'w', encoding='utf-8') as f:
            f.write("def hello():\n    return 'Γεια σου'\n")
        self.run_code("import mymod\nprint(mymod.hello(), len(mymod.hello()))\n")
        self.assertEqual(self.s.errors(), [])
        self.assertEqual(self.s.output(), 'Γεια σου 8\n')

    def test_star_import_hidden_from_variables(self):
        self.run_code("from math import *\nr = 2\nembadon = pi * r ** 2\n")
        g = self.s.last_globals()
        self.assertEqual(sorted(g), ['embadon', 'r'])

    def test_functions_show_signature(self):
        self.run_code("def dequeue(queue):\n    '''Εξαγωγή από ουρά'''\n    return queue.pop(0)\n\n"
                      "def f(a, b=1, *args, **kw):\n    pass\n\ndiplo = lambda x: 2 * x\n"
                      "from math import sqrt\noura = []\n")
        g = self.s.last_globals()
        self.assertEqual(g['dequeue']['repr'], 'dequeue(queue)')
        self.assertEqual(g['dequeue']['kind'], 'function')
        self.assertEqual(g['dequeue']['line'], 1)
        self.assertEqual(g['dequeue']['doc'], 'Εξαγωγή από ουρά')
        self.assertEqual(g['f']['repr'], 'f(a, b=1, *args, **kw)')
        self.assertEqual(g['f']['line'], 5)
        self.assertEqual(g['diplo']['repr'], 'diplo(x)')
        self.assertEqual(g['sqrt']['repr'], 'sqrt(…)')
        self.assertNotIn('kind', g['oura'])

    def test_sys_exit_is_clean(self):
        self.run_code("import sys\nprint(1)\nsys.exit()\nprint(2)\n")
        self.assertEqual(self.s.output(), '1\n')
        done = [m for m in self.s.messages if m['type'] == 'done'][0]
        self.assertTrue(done['ok'])

    def test_os_system_does_not_break_protocol(self):
        self.run_code("import os\nos.system('echo hi')\nprint('after')\n")
        self.assertIn('after', self.s.output())

    def test_output_rate_is_limited_but_complete(self):
        import time
        start = time.time()
        self.run_code("for i in range(5000):\n    print('x' * 99)\n")
        elapsed = time.time() - start
        self.assertEqual(len(self.s.output()), 500000)
        self.assertGreater(elapsed, 1.0)

    # --- εκτέλεση βήμα-βήμα ---------------------------------------------------
    def start_traced(self, source, mode='step', delay=0):
        path = os.path.join(self.tmp, 'prog.py')
        self.s.send(cmd='run', path=path, source=source, encoding='utf-8',
                    trace={'mode': mode, 'delay': delay})

    def next_of(self, *types):
        while True:
            msg = self.s.read()
            if msg['type'] in types:
                return msg

    def test_step_by_step(self):
        self.start_traced("s = 0\nfor i in range(2):\n    s = s + i\nprint('τέλος', s)\n")
        lines = []
        while True:
            msg = self.next_of('step', 'prompt')
            if msg['type'] == 'prompt':
                break
            lines.append(msg['line'])
            self.s.send(cmd='step')
        self.assertEqual(lines, [1, 2, 3, 2, 3, 2, 4])
        self.assertIn('τέλος 1', self.s.output())

    def test_step_waits_for_next(self):
        self.start_traced("x = 1\nx = 2\n")
        self.assertEqual(self.next_of('step')['line'], 1)
        self.s.send(cmd='globals')
        self.s.send(cmd='step')
        msg = self.next_of('step')
        self.assertEqual(msg['line'], 2)
        self.assertEqual([v['repr'] for v in msg['vars'] if v['name'] == 'x'], ["'1'" if isinstance(1, str) else '1'])

    def test_step_shows_function_locals(self):
        self.start_traced("def f(a):\n    b = a * 2\n    return b\ny = f(5)\n", mode='auto')
        steps = []
        while True:
            msg = self.next_of('step', 'prompt')
            if msg['type'] == 'prompt':
                break
            steps.append(msg)
        inside = [m for m in steps if m.get('func') == 'f']
        self.assertEqual([m['line'] for m in inside], [2, 3])
        self.assertEqual({v['name']: v['repr'] for v in inside[-1]['locals']},
                         {'a': '5', 'b': '10'})
        self.assertEqual(self.s.last_globals()['y']['repr'], '10')

    def test_trace_mode_can_change_while_running(self):
        self.start_traced("for i in range(100):\n    pass\nprint('ok')\n")
        self.assertEqual(self.next_of('step')['line'], 1)
        self.s.send(cmd='trace', mode='off')
        self.next_of('prompt')
        self.assertEqual(len([m for m in self.s.messages if m['type'] == 'step']), 1)
        self.assertIn('ok', self.s.output())

    def test_step_with_input(self):
        self.start_traced("x = input('Όνομα: ')\nprint('Γεια', x)\n", mode='auto')
        while True:
            msg = self.next_of('input_request', 'prompt')
            if msg['type'] == 'prompt':
                break
            self.s.send(cmd='input', text='Άννα')
        self.assertEqual([m['line'] for m in self.s.messages if m['type'] == 'step'], [1, 2])
        self.assertIn('Γεια Άννα', self.s.output())


class CheckerTest(unittest.TestCase):
    def setUp(self):
        env = dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8')
        self.p = subprocess.Popen([sys.executable, '-u', '-B', CHECKER],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  env=env)

    def tearDown(self):
        try:
            if self.p.stdin:
                self.p.stdin.close()
            if self.p.stdout:
                self.p.stdout.close()
            self.p.kill()
            self.p.wait()
        except OSError:
            pass

    def check(self, source):
        data = (json.dumps({'id': 1, 'source': source, 'encoding': 'utf-8'}, ensure_ascii=False) + '\n').encode('utf-8')
        self.p.stdin.write(data)
        self.p.stdin.flush()
        line = self.p.stdout.readline()
        return json.loads(line.decode('utf-8'))

    def test_ok(self):
        self.assertTrue(self.check("print('Γεια')\n")['ok'])

    def test_missing_colon(self):
        r = self.check("x = 'α'\nwhile x\n    pass\n")
        self.assertFalse(r['ok'])
        self.assertEqual(r['lineno'], 2)
        self.assertEqual(r['col'], 7)

    def test_greek_identifiers(self):
        self.assertTrue(self.check("πλήθος = 5\nprint(πλήθος)\n")['ok'])


if __name__ == '__main__':
    unittest.main()
