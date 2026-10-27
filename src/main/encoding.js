'use strict';
// Ανάγνωση/αποθήκευση αρχείων .py με σεβασμό στη δήλωση coding (PEP 263),
// ώστε τα αρχεία να ανοίγουν σωστά και στο IDLE.

const CODING_RE = /^[ \t\f]*#.*?coding[:=][ \t]*([-\w.]+)/;

const ALIASES = {
  'utf-8': 'utf-8', 'utf8': 'utf-8', 'utf_8': 'utf-8', 'u8': 'utf-8',
  'cp1253': 'windows-1253', 'windows-1253': 'windows-1253', 'windows1253': 'windows-1253',
  'iso-8859-7': 'iso-8859-7', 'iso8859-7': 'iso-8859-7', 'iso8859_7': 'iso-8859-7',
  'iso_8859_7': 'iso-8859-7', 'greek': 'iso-8859-7', 'greek8': 'iso-8859-7',
  'latin-1': 'iso-8859-1', 'latin1': 'iso-8859-1', 'iso-8859-1': 'iso-8859-1',
  'iso8859-1': 'iso-8859-1', 'cp1252': 'windows-1252', 'windows-1252': 'windows-1252',
  'ascii': 'utf-8', 'us-ascii': 'utf-8',
};

function declaredEncoding(text) {
  const lines = text.split(/\r\n|\r|\n/, 2);
  for (const line of lines) {
    const m = CODING_RE.exec(line);
    if (m) return ALIASES[m[1].toLowerCase()] || null;
  }
  return null;
}

function declaredEncodingInBytes(buf) {
  // οι δύο πρώτες γραμμές είναι (σχεδόν πάντα) ASCII
  const head = buf.subarray(0, 400).toString('latin1');
  return declaredEncoding(head);
}

function decodeBuffer(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(buf.subarray(3)), encoding: 'utf-8', bom: true };
  }
  const declared = declaredEncodingInBytes(buf);
  if (declared) {
    try {
      return { text: new TextDecoder(declared, { fatal: true }).decode(buf), encoding: declared, bom: false };
    } catch (_) { /* πέφτουμε στους ελέγχους παρακάτω */ }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'utf-8', bom: false };
  } catch (_) {
    // παλιά αρχεία από το IDLE σε ελληνικά Windows
    return { text: new TextDecoder('windows-1253').decode(buf), encoding: 'windows-1253', bom: false };
  }
}

const encoderTables = {};
function singleByteTable(enc) {
  if (!encoderTables[enc]) {
    const dec = new TextDecoder(enc);
    const map = new Map();
    for (let b = 0; b < 256; b++) {
      const ch = dec.decode(Uint8Array.of(b));
      if (ch !== '�' && !map.has(ch)) map.set(ch, b);
    }
    encoderTables[enc] = map;
  }
  return encoderTables[enc];
}

/** Κωδικοποιεί κείμενο. Επιστρέφει {buffer} ή {error, char, line}. */
function encodeText(text, enc) {
  if (!enc || enc === 'utf-8') return { buffer: Buffer.from(text, 'utf-8') };
  const table = singleByteTable(enc);
  const out = Buffer.alloc(text.length);
  let n = 0;
  let line = 1;
  for (const ch of text) {
    if (ch === '\n') line++;
    const b = table.get(ch);
    if (b === undefined) return { error: 'unencodable', char: ch, line };
    out[n++] = b;
  }
  return { buffer: out.subarray(0, n) };
}

/** Αποθήκευση: με την κωδικοποίηση της δήλωσης coding, αλλιώς UTF-8. */
function encodeForSave(text) {
  const enc = declaredEncoding(text) || 'utf-8';
  return { encoding: enc, ...encodeText(text, enc) };
}

module.exports = { declaredEncoding, decodeBuffer, encodeText, encodeForSave };
