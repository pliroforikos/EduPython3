'use strict';
const { spawnSync } = require('child_process');
const { findPython } = require('../src/main/pythonProcess');

const py = process.env.PYTHON3 || findPython() || (process.platform === 'win32' ? 'py' : 'python3');
const args = py === 'py'
  ? ['-3', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']
  : ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'];

const res = spawnSync(py, args, { stdio: 'inherit' });
if (res.status !== 0) {
  process.exit(res.status || 1);
}
