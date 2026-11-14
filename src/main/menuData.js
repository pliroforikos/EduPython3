'use strict';
/**
 * Το μενού της εφαρμογής ως απλά δεδομένα, για να το σχεδιάσει η σελίδα (έγχρωμα πτυσσόμενα μενού, όπως στο
 * Android Studio). Τα κανονικά μενού των Windows δεν παίρνουν χρώμα, γι' αυτό η σελίδα ζωγραφίζει τα ίδια στοιχεία
 * (ετικέτες, συντομεύσεις, σημάδια επιλογής) και ζητά από εδώ να εκτελεστεί το στοιχείο που επιλέχθηκε.
 *
 * Καθαρό module (χωρίς το electron), ώστε να ελέγχεται με τεστ. Δέχεται το Menu του Electron ή απλό πίνακα στοιχείων.
 */

// Συντομεύσεις των ενσωματωμένων εντολών (role), όπως τις δείχνει το κανονικό μενού
const ROLE_ACCELERATORS = { cut: 'Ctrl+X', copy: 'Ctrl+C', paste: 'Ctrl+V', selectAll: 'Ctrl+A', undo: 'Ctrl+Z', redo: 'Ctrl+Y' };

/** Οι ετικέτες γράφουν το πλήκτρο Alt με «&» πριν από το γράμμα. Επιστρέφει { label, mnemonic } (το «&&» είναι ένα «&»). */
function splitLabel(raw) {
  const text = String(raw == null ? '' : raw);
  let label = '';
  let mnemonic = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '&') {
      if (text[i + 1] === '&') { label += '&'; i++; continue; }
      // «&» πριν από κενό ή στο τέλος δεν δείχνει πλήκτρο: είναι απλό σύμβολο (π.χ. «Μεταβλητές & Πίνακες»)
      if (i + 1 >= text.length || /\s/.test(text[i + 1])) { label += '&'; continue; }
      if (!mnemonic) mnemonic = text[i + 1];
      continue;
    }
    label += text[i];
  }
  return { label, mnemonic };
}

/** Η συντόμευση όπως τη βλέπει ο χρήστης (CmdOrCtrl → Ctrl, εκτός από το macOS). */
function acceleratorText(accelerator, platform = process.platform) {
  if (!accelerator) return '';
  const mac = platform === 'darwin';
  return String(accelerator)
    .split('+')
    .map((p) => {
      if (/^(cmdorctrl|commandorcontrol)$/i.test(p)) return mac ? 'Cmd' : 'Ctrl';
      if (/^(cmd|command)$/i.test(p)) return 'Cmd';
      if (/^(ctrl|control)$/i.test(p)) return 'Ctrl';
      if (/^option$/i.test(p)) return 'Alt';
      return p;
    })
    .join('+');
}

const itemsOf = (menuOrArray) => (Array.isArray(menuOrArray) ? menuOrArray : (menuOrArray && menuOrArray.items) || []);

/** Ένα στοιχείο μενού → { type, label, mnemonic, accelerator, enabled, checked, submenu }. */
function serializeItem(item, platform) {
  if (item.type === 'separator') return { type: 'separator' };
  const { label, mnemonic } = splitLabel(item.label);
  const sub = item.submenu ? itemsOf(item.submenu) : null;
  const out = {
    type: sub ? 'submenu' : item.type === 'checkbox' || item.type === 'radio' ? item.type : 'normal',
    label,
    mnemonic,
    enabled: item.enabled !== false,
    checked: !!item.checked,
    accelerator: sub ? '' : acceleratorText(item.accelerator || ROLE_ACCELERATORS[item.role] || '', platform),
  };
  if (sub) out.submenu = sub.filter((it) => it.visible !== false).map((it) => serializeItem(it, platform));
  return out;
}

/** Όλο το μενού: πίνακας των στοιχείων της πάνω γραμμής, καθένα με το υπομενού του. */
function serializeMenu(menu, platform = process.platform) {
  return itemsOf(menu)
    .filter((it) => it.visible !== false)
    .map((it) => serializeItem(it, platform));
}

/**
 * Το στοιχείο στη θέση path (π.χ. [3, 0] = πρώτο στοιχείο του τέταρτου μενού). Οι θέσεις μετρούν όπως η serializeMenu,
 * δηλαδή χωρίς τα κρυφά στοιχεία. Επιστρέφει null αν η θέση δεν υπάρχει.
 */
function findItem(menu, path) {
  if (!Array.isArray(path) || !path.length || !path.every((n) => Number.isInteger(n) && n >= 0)) return null;
  let list = itemsOf(menu).filter((it) => it.visible !== false);
  let item = null;
  for (const n of path) {
    item = list[n];
    if (!item) return null;
    list = item.submenu ? itemsOf(item.submenu).filter((it) => it.visible !== false) : [];
  }
  return item;
}

module.exports = { splitLabel, acceleratorText, serializeItem, serializeMenu, findItem };
