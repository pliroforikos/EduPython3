#!/usr/bin/env node
'use strict';
/*
 * Πακέτα για Ubuntu, Linux Mint, Debian και παρόμοιες διανομές (64-bit):
 *
 *   dist/python2-epal_<έκδοση>_amd64.deb          εγκατάσταση:       sudo apt install ./python2-epal_<έκδοση>_amd64.deb
 *   dist/Python2-EPAL-<έκδοση>-linux-x64.tar.gz   χωρίς εγκατάσταση: αποσυμπίεση και ./python2-epal.sh
 *
 *   npm run dist:linux
 *
 * Το electron-builder ετοιμάζει την εφαρμογή (dist/linux-unpacked), το .desktop, τα εικονίδια και τα σενάρια
 * εγκατάστασης του .deb. Εδώ γίνεται μόνο η τελική συσκευασία (ar, tar.gz), χωρίς τα εργαλεία του Linux
 * (fpm, mksquashfs), ώστε τα πακέτα να χτίζονται και από Windows. Τα δικαιώματα των αρχείων (εκτελέσιμα,
 * root:root) ορίζονται ρητά, γιατί στα Windows δεν υπάρχουν.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { once } = require('events');
const builder = require('electron-builder');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const UNPACKED = path.join(DIST, 'linux-unpacked');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const MTIME = Math.floor(Date.now() / 1000);
// οι εξαρτήσεις που βάζει και το ίδιο το electron-builder στα .deb (FpmTarget.getDefaultDepends)
const DEPENDS = ['libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0',
  'libuuid1', 'libsecret-1-0'];

// ======================================================================= tar (ustar, με pax για μεγάλα ονόματα)
function octal(n, width) {
  return n.toString(8).padStart(width - 1, '0') + '\0';
}

/** Εγγραφή pax: «μήκος key=value\n», όπου το μήκος μετράει και τα δικά του ψηφία. */
function paxRecord(key, value) {
  const rest = ` ${key}=${value}\n`;
  const n = Buffer.byteLength(rest);
  let len = n + String(n).length;
  if (String(len).length > String(n).length) len = n + String(len).length;
  return `${len}${rest}`;
}

function rawHeader(name, { size = 0, mode = 0o644, type = '0', prefix = '' }) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, 'utf-8');
  h.write(octal(mode, 8), 100, 'ascii');
  h.write(octal(0, 8), 108, 'ascii');               // uid
  h.write(octal(0, 8), 116, 'ascii');               // gid
  h.write(octal(size, 12), 124, 'ascii');
  h.write(octal(MTIME, 12), 136, 'ascii');
  h.write('        ', 148, 'ascii');                // checksum: πρώτα κενά
  h.write(type, 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  h.write('root', 265, 'ascii');
  h.write('root', 297, 'ascii');
  h.write(prefix, 345, 155, 'utf-8');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(octal(sum, 7) + ' ', 148, 'ascii');
  return h;
}

/** Επικεφαλίδα(ες) για ένα όνομα: ustar όπου χωράει, αλλιώς pax. */
function headers(name, opts) {
  const ascii = /^[\x20-\x7e]*$/.test(name);
  if (ascii && name.length <= 100) return [rawHeader(name, opts)];
  if (ascii) {
    for (let i = name.indexOf('/'); i > 0; i = name.indexOf('/', i + 1)) {
      if (i <= 155 && name.length - i - 1 <= 100 && name.length - i - 1 > 0) {
        return [rawHeader(name.slice(i + 1), { ...opts, prefix: name.slice(0, i) })];
      }
    }
  }
  const data = Buffer.from(paxRecord('path', name), 'utf-8');
  return [rawHeader('././@PaxHeader', { size: data.length, type: 'x' }), pad(data), rawHeader(name.slice(-100), opts)];
}

function pad(buf) {
  const extra = (512 - (buf.length % 512)) % 512;
  return extra ? Buffer.concat([buf, Buffer.alloc(extra)]) : buf;
}

/** Γράφει tar.gz σε αρχείο. Τα entries: { path, dir } ή { path, src } ή { path, data }, με mode. */
async function writeTarGz(file, entries, onFile) {
  const gz = zlib.createGzip({ level: 9 });
  const out = fs.createWriteStream(file);
  gz.pipe(out);
  const write = async (buf) => { if (!gz.write(buf)) await once(gz, 'drain'); };
  for (const e of entries) {
    if (e.dir) {
      for (const h of headers(e.path, { mode: 0o755, type: '5' })) await write(h);
      continue;
    }
    const size = e.data ? e.data.length : fs.statSync(e.src).size;
    for (const h of headers(e.path, { size, mode: e.mode })) await write(h);
    const md5 = crypto.createHash('md5');
    if (e.data) {
      md5.update(e.data);
      await write(e.data);
    } else {
      for await (const chunk of fs.createReadStream(e.src)) { md5.update(chunk); await write(chunk); }
    }
    if (size % 512) await write(Buffer.alloc(512 - (size % 512)));
    if (onFile) onFile(e, md5.digest('hex'), size);
  }
  await write(Buffer.alloc(1024));
  gz.end();
  await once(out, 'finish');
}

// ======================================================================= αρχεία
function isExecutable(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(4);
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  return head.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || head.subarray(0, 2).toString() === '#!';
}

/** Όλα τα αρχεία ενός φακέλου, με τη θέση τους μέσα στο πακέτο. */
function walk(dir, base, skip = () => false) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const src = path.join(dir, name);
    const rel = `${base}/${name}`;
    if (skip(rel)) continue;
    if (fs.statSync(src).isDirectory()) out.push(...walk(src, rel, skip));
    else out.push({ path: rel, src, mode: isExecutable(src) ? 0o755 : 0o644 });
  }
  return out;
}

/** Οι φάκελοι (με όλους τους γονείς τους) πριν από τα αρχεία, όπως τα θέλει το dpkg. */
function withDirs(files, top) {
  const dirs = new Set();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/') + '/');
  }
  if (top) dirs.add(top);
  return [...dirs].sort().map((d) => ({ path: d, dir: true })).concat(files);
}

/** Σενάρια και αρχεία κειμένου με τέλη γραμμής Unix (από Windows μπορεί να έχουν CRLF). */
const unix = (buf) => Buffer.from(buf.toString('utf-8').replace(/\r\n/g, '\n'), 'utf-8');

// ======================================================================= 1. electron-builder (χωρίς fpm)
async function prepare() {
  let info = null;
  await builder.build({
    targets: builder.Platform.LINUX.createTarget('deb', builder.Arch.x64),
    publish: 'never',
    // Αντί να καλέσει το fpm, το electron-builder δίνει εδώ ό,τι θα του έδινε: αρχεία, θέσεις, σενάρια.
    effectiveOptionComputed: async (computed) => {
      if (!Array.isArray(computed) || !Array.isArray(computed[0])) return false;
      const [args] = computed;
      const meta = {};
      const maps = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) { meta[args[i].slice(2)] = args[++i]; continue; }
        const at = args[i].lastIndexOf('=/');
        maps.push({ src: args[i].slice(0, at), dest: args[i].slice(at + 1) });
      }
      // τα σενάρια και το .desktop είναι προσωρινά αρχεία: διαβάζονται τώρα
      info = {
        meta,
        postinst: unix(fs.readFileSync(meta['after-install'])),
        postrm: unix(fs.readFileSync(meta['after-remove'])),
        app: maps.find((m) => fs.statSync(m.src).isDirectory()),
        // .desktop και εικονίδια (τα αρχεία κειμένου με τέλη γραμμής Unix). Όχι το αρχείο τύπων του
        // electron-builder: θα ξαναόριζε το text/x-python για όλο το σύστημα, με εικονίδιο εγγράφου γραφείου.
        extra: maps.filter((m) => !fs.statSync(m.src).isDirectory() && !m.dest.startsWith('/usr/share/mime/')).map((m) => {
          const data = fs.readFileSync(m.src);
          return { path: '.' + m.dest, data: /\.(desktop|xml)$/.test(m.dest) ? unix(data) : data, mode: 0o644 };
        }),
      };
      return true;
    },
  });
  if (!info || !info.app) throw new Error('Το electron-builder δεν έδωσε τις ρυθμίσεις του .deb');
  return info;
}

// ======================================================================= 2. .deb
function arMember(name, size) {
  const f = (v, n) => String(v).padEnd(n, ' ');
  return Buffer.from(f(name, 16) + f(MTIME, 12) + f(0, 6) + f(0, 6) + f('100644', 8) + f(size, 10) + '`\n', 'ascii');
}

async function buildDeb(info) {
  const m = info.meta;
  const appDir = '.' + info.app.dest;                                    // ./opt/Python2-EPAL
  const files = walk(UNPACKED, appDir).map((f) => (/\.sh$/.test(f.path) ? { ...f, data: unix(fs.readFileSync(f.src)), src: undefined } : f));
  const entries = withDirs(files.concat(info.extra), './');

  const dataFile = path.join(DIST, 'data.tar.gz.tmp');
  const md5sums = [];
  let installedKb = 0;
  await writeTarGz(dataFile, entries, (e, md5, size) => {
    md5sums.push(`${md5}  ${e.path.slice(2)}`);
    installedKb += Math.ceil(size / 1024);
  });

  const description = (m.description || '').split('\n').map((l, i) => (i === 0 ? l : ` ${l.trim() || '.'}`)).join('\n');
  const control = [
    `Package: ${m.name}`,
    `Version: ${m.version}`,
    `Architecture: ${m.architecture}`,
    `Maintainer: ${m.maintainer}`,
    `Installed-Size: ${installedKb}`,
    `Depends: ${DEPENDS.join(', ')}`,
    'Section: devel',
    `Priority: ${m['deb-priority'] || 'optional'}`,
    `Homepage: ${m.url || pkg.homepage}`,
    `Description: ${description}`,
    '',
  ].join('\n');
  const controlFile = path.join(DIST, 'control.tar.gz.tmp');
  await writeTarGz(controlFile, [
    { path: './', dir: true },
    { path: './control', data: Buffer.from(control, 'utf-8'), mode: 0o644 },
    { path: './md5sums', data: Buffer.from(md5sums.join('\n') + '\n', 'utf-8'), mode: 0o644 },
    { path: './postinst', data: info.postinst, mode: 0o755 },
    { path: './postrm', data: info.postrm, mode: 0o755 },
  ]);

  const debFile = path.join(DIST, `${m.name}_${m.version}_${m.architecture}.deb`);
  const out = fs.createWriteStream(debFile);
  const put = async (buf) => { if (!out.write(buf)) await once(out, 'drain'); };
  await put(Buffer.from('!<arch>\n', 'ascii'));
  const member = async (name, src) => {
    const size = Buffer.isBuffer(src) ? src.length : fs.statSync(src).size;
    await put(arMember(name, size));
    if (Buffer.isBuffer(src)) await put(src);
    else for await (const chunk of fs.createReadStream(src)) await put(chunk);
    if (size % 2) await put(Buffer.from('\n'));
  };
  await member('debian-binary', Buffer.from('2.0\n'));
  await member('control.tar.gz', controlFile);
  await member('data.tar.gz', dataFile);
  out.end();
  await once(out, 'finish');
  fs.unlinkSync(dataFile);
  fs.unlinkSync(controlFile);
  return debFile;
}

// ======================================================================= 3. φορητό .tar.gz
async function buildPortable() {
  const top = `Python2-EPAL-${pkg.version}-linux-x64`;
  // χωρίς τα αρχεία που αφορούν μόνο την εγκατάσταση με .deb
  const skip = (rel) => /\/resources\/(apparmor-profile|package-type|app-update\.yml)$/.test(rel);
  const files = walk(UNPACKED, top, skip).map((f) => (/\.sh$/.test(f.path) ? { ...f, data: unix(fs.readFileSync(f.src)), src: undefined } : f));
  files.push({ path: `${top}/python2-epal.sh`, data: unix(fs.readFileSync(path.join(__dirname, 'linux', 'python2-epal.sh'))), mode: 0o755 });
  files.push({ path: `${top}/ΔΙΑΒΑΣΕ-ΜΕ.txt`, data: Buffer.from(README(top), 'utf-8'), mode: 0o644 });
  const file = path.join(DIST, `${top}.tar.gz`);
  await writeTarGz(file, withDirs(files, `${top}/`));
  return file;
}

function README(top) {
  return `Python 2.7 ΕΠΑΛ ${pkg.version} για Linux (64-bit), χωρίς εγκατάσταση
Δημιουργός: Λέων Προκόπης, καθηγητής Πληροφορικής ΠΕ86 · άδεια CC BY-NC-SA 4.0
https://github.com/pliroforikos/myPython2

Εκκίνηση
  cd ${top}
  ./python2-epal.sh

Χρειάζεται εγκατεστημένη την Python 2.7:
  Ubuntu 22.04, Linux Mint 21:          sudo apt install python2
  Ubuntu 24.04, Linux Mint 22, Debian 12 (και για Tkinter παντού):
                                        sudo bash resources/install-python27.sh
Η εφαρμογή βρίσκει μόνη της την Python 2.7· αλλιώς ορίζεται από Αρχείο → Ρυθμίσεις.

Για εγκατάσταση σε όλους τους χρήστες, με εικονίδιο στο μενού εφαρμογών, προτίμησε το πακέτο .deb:
  sudo apt install ./python2-epal_${pkg.version}_amd64.deb
`;
}

// =======================================================================
(async () => {
  const info = await prepare();
  const deb = await buildDeb(info);
  console.log(`  • ${path.relative(ROOT, deb)}  (${(fs.statSync(deb).size / 1048576).toFixed(1)} MB)`);
  const tgz = await buildPortable();
  console.log(`  • ${path.relative(ROOT, tgz)}  (${(fs.statSync(tgz).size / 1048576).toFixed(1)} MB)`);
})().catch((e) => { console.error(e); process.exit(1); });
