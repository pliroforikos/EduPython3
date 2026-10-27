'use strict';
// Ταυτότητα του καθηγητή για τη λειτουργία «Τάξη»: ζεύγος κλειδιών ECDSA P-256 και αυτο-υπογεγραμμένο
// πιστοποιητικό X.509 για τον TLS server. Το Node δεν φτιάχνει πιστοποιητικά, οπότε το DER γράφεται εδώ.
// Οι μαθητές δεν εμπιστεύονται το πιστοποιητικό αλλά το αποτύπωμα (SHA-256) του δημόσιου κλειδιού του.

const crypto = require('crypto');

function derLength(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

const der = (tag, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
};
const seq = (...parts) => der(0x30, ...parts);
const set = (...parts) => der(0x31, ...parts);

function oid(dotted) {
  const nums = dotted.split('.').map(Number);
  const out = [40 * nums[0] + nums[1]];
  for (const n of nums.slice(2)) {
    const groups = [];
    let v = n;
    do { groups.unshift(v & 0x7f); v = Math.floor(v / 128); } while (v > 0);
    groups.forEach((g, i) => out.push(i < groups.length - 1 ? g | 0x80 : g));
  }
  return der(0x06, Buffer.from(out));
}

function utcTime(d) {
  const p = (n) => String(n).padStart(2, '0');
  const s = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return der(0x17, Buffer.from(s, 'ascii'));
}

const ECDSA_SHA256 = seq(oid('1.2.840.10045.4.3.2'));
const commonName = (cn) => seq(set(seq(oid('2.5.4.3'), der(0x0c, Buffer.from(cn, 'utf-8')))));

/** SHA-256 του δημόσιου κλειδιού (SubjectPublicKeyInfo, DER), σε hex με «:» ανά byte. */
function fingerprint(publicKey) {
  const key = publicKey instanceof crypto.KeyObject && publicKey.type === 'public' ? publicKey : crypto.createPublicKey(publicKey);
  const spki = key.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(spki).digest('hex').match(/../g).join(':');
}

/** Νέα ταυτότητα: { keyPem, certPem, fingerprint }. */
function generateIdentity(cn = 'Python2-EPAL teacher') {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const serial = crypto.randomBytes(16);
  serial[0] &= 0x7f;   // θετικός ακέραιος
  const notBefore = new Date(Date.now() - 24 * 3600 * 1000);
  const notAfter = new Date(Date.UTC(2049, 11, 31, 23, 59, 59));   // UTCTime: μέχρι το 2049
  const name = commonName(cn);
  const tbs = seq(
    der(0xa0, der(0x02, Buffer.from([2]))),   // έκδοση v3
    der(0x02, serial),
    ECDSA_SHA256,
    name,
    seq(utcTime(notBefore), utcTime(notAfter)),
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
  );
  const signature = crypto.sign('sha256', tbs, privateKey);
  const cert = seq(tbs, ECDSA_SHA256, der(0x03, Buffer.from([0]), signature));
  const certPem = `-----BEGIN CERTIFICATE-----\n${cert.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
  return {
    keyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    certPem,
    fingerprint: fingerprint(publicKey),
  };
}

/** Κανονική μορφή αποτυπώματος για σύγκριση: πεζά hex χωρίς διαχωριστικά. */
const normalizeFingerprint = (fp) => String(fp || '').toLowerCase().replace(/[^0-9a-f]/g, '');

module.exports = { generateIdentity, fingerprint, normalizeFingerprint };
