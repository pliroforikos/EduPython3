'use strict';
/**
 * Έλεγχος για νέα έκδοση: καθαρή λογική, χωρίς Electron (δοκιμάζεται με `npm test`).
 * Ρωτά το GitHub για την τελευταία δημοσιευμένη έκδοση (release) του αποθετηρίου.
 */
const https = require('https');
const http = require('http');

/** Αριθμοί μιας έκδοσης: «v1.6.1» → [1, 6, 1]. Επιστρέφει null αν δεν μοιάζει με έκδοση. */
function parseVersion(v) {
  const m = /^v?(\d+(?:\.\d+)*)/.exec(String(v || '').trim());
  return m ? m[1].split('.').map(Number) : null;
}

/** 1 αν a > b, -1 αν a < b, 0 αν ίσες (ή αν κάποια δεν είναι έκδοση). */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Από την απάντηση του GitHub (releases/latest) κρατά ό,τι χρειάζεται η εφαρμογή. */
function parseRelease(json) {
  if (!json || typeof json !== 'object' || json.draft || json.prerelease || !parseVersion(json.tag_name)) return null;
  const notes = String(json.body || '').replace(/\r/g, '').trim();
  return {
    version: parseVersion(json.tag_name).join('.'),
    name: json.name || json.tag_name,
    notes: notes.length > 700 ? notes.slice(0, 700).trimEnd() + '…' : notes,
    url: json.html_url || '',
    assets: (json.assets || []).map((a) => a.name),
  };
}

/** GET με JSON απάντηση. Απορρίπτεται με σφάλμα αν δεν υπάρχει σύνδεση ή η απάντηση δεν είναι 200. */
function getJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'epal-updater', Accept: 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        getJson(res.headers.location, timeoutMs).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/**
 * Η τελευταία έκδοση του αποθετηρίου owner/repo, ή null αν δεν υπάρχει δημοσιευμένη.
 * baseUrl: μόνο για τα τεστ (τοπικός διακομιστής).
 */
async function fetchLatest(owner, repo, baseUrl = 'https://api.github.com') {
  return parseRelease(await getJson(`${baseUrl}/repos/${owner}/${repo}/releases/latest`));
}

module.exports = { parseVersion, compareVersions, parseRelease, fetchLatest };
