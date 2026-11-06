'use strict';

/**
 * Γεννήτρια τιμών για τα αρχεία δεδομένων της input() (οθόνη «Δεδομένα»):
 * τυχαίοι ακέραιοι/πραγματικοί, ονόματα, ονοματεπώνυμα, αριθμοί ταυτότητας, πόλεις της Ελλάδας, χώρες,
 * σε τυχαία, αύξουσα ή φθίνουσα σειρά, έως 50 τιμές κάθε φορά.
 *
 * Η ταξινόμηση γίνεται ΑΚΡΙΒΩΣ όπως συγκρίνει η Python (τελεστές < και >): οι αριθμοί αριθμητικά,
 * τα κείμενα χαρακτήρα-χαρακτήρα. Έτσι ένα «ταξινομημένο» αρχείο είναι ταξινομημένο και για το πρόγραμμα
 * του μαθητή (π.χ. για δυαδική αναζήτηση).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DataGen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_COUNT = 50;

  const MALE = [
    'Γιώργος', 'Γιάννης', 'Κώστας', 'Δημήτρης', 'Νίκος', 'Παναγιώτης', 'Βασίλης', 'Χρήστος', 'Θανάσης',
    'Μιχάλης', 'Βαγγέλης', 'Σπύρος', 'Αντώνης', 'Ανδρέας', 'Στέλιος', 'Πέτρος', 'Αλέξανδρος', 'Θοδωρής',
    'Μανώλης', 'Ηλίας', 'Λευτέρης', 'Σταύρος', 'Άγγελος', 'Φώτης', 'Άρης', 'Λεωνίδας', 'Πάνος', 'Τάσος',
    'Μάριος', 'Στέφανος', 'Απόστολος', 'Γρηγόρης', 'Αχιλλέας', 'Οδυσσέας', 'Προκόπης', 'Λέων',
  ];
  const FEMALE = [
    'Μαρία', 'Ελένη', 'Κατερίνα', 'Γεωργία', 'Σοφία', 'Αναστασία', 'Δήμητρα', 'Χριστίνα', 'Εύα', 'Ιωάννα',
    'Αγγελική', 'Δέσποινα', 'Ειρήνη', 'Φωτεινή', 'Παναγιώτα', 'Αθηνά', 'Χαρά', 'Ζωή', 'Νεφέλη', 'Μυρτώ',
    'Δανάη', 'Άννα', 'Αλεξάνδρα', 'Βασιλική', 'Θεοδώρα', 'Στέλλα', 'Ευτυχία', 'Κωνσταντίνα', 'Ολυμπία',
    'Πηνελόπη', 'Ξανθή', 'Μαργαρίτα', 'Αριάδνη', 'Ηλέκτρα', 'Ελπίδα', 'Ραλλού',
  ];
  /** Επώνυμα: [ανδρικό, γυναικείο] */
  const SURNAMES = [
    ['Παπαδόπουλος', 'Παπαδοπούλου'], ['Παπαδάκης', 'Παπαδάκη'], ['Γεωργίου', 'Γεωργίου'], ['Οικονόμου', 'Οικονόμου'],
    ['Νικολάου', 'Νικολάου'], ['Ιωάννου', 'Ιωάννου'], ['Παππάς', 'Παππά'], ['Βασιλείου', 'Βασιλείου'],
    ['Αλεξίου', 'Αλεξίου'], ['Κωνσταντίνου', 'Κωνσταντίνου'], ['Δημητρίου', 'Δημητρίου'], ['Μακρής', 'Μακρή'],
    ['Αντωνίου', 'Αντωνίου'], ['Καραγιάννης', 'Καραγιάννη'], ['Παπαγεωργίου', 'Παπαγεωργίου'],
    ['Θεοδωρόπουλος', 'Θεοδωροπούλου'], ['Πετρόπουλος', 'Πετροπούλου'], ['Κυριακίδης', 'Κυριακίδου'],
    ['Αθανασίου', 'Αθανασίου'], ['Μιχαηλίδης', 'Μιχαηλίδου'], ['Σταματόπουλος', 'Σταματοπούλου'], ['Χατζής', 'Χατζή'],
    ['Αναστασίου', 'Αναστασίου'], ['Ζαχαρίου', 'Ζαχαρίου'], ['Λαμπράκης', 'Λαμπράκη'], ['Κουτσούκος', 'Κουτσούκου'],
    ['Σαββίδης', 'Σαββίδου'], ['Ραφτόπουλος', 'Ραφτοπούλου'], ['Μαυρίδης', 'Μαυρίδου'],
    ['Παναγιωτόπουλος', 'Παναγιωτοπούλου'], ['Τσακίρης', 'Τσακίρη'], ['Δημόπουλος', 'Δημοπούλου'], ['Ξενάκης', 'Ξενάκη'],
    ['Μπακάλης', 'Μπακάλη'], ['Φραγκιαδάκης', 'Φραγκιαδάκη'], ['Λαζαρίδης', 'Λαζαρίδου'], ['Αποστολίδης', 'Αποστολίδου'],
    ['Βλάχος', 'Βλάχου'], ['Καλογεράκης', 'Καλογεράκη'], ['Σπυρόπουλος', 'Σπυροπούλου'],
  ];
  const CITIES = [
    'Αθήνα', 'Θεσσαλονίκη', 'Πάτρα', 'Ηράκλειο', 'Λάρισα', 'Βόλος', 'Ιωάννινα', 'Τρίκαλα', 'Χαλκίδα', 'Σέρρες',
    'Αλεξανδρούπολη', 'Ξάνθη', 'Κατερίνη', 'Καλαμάτα', 'Καβάλα', 'Χανιά', 'Λαμία', 'Κομοτηνή', 'Ρόδος', 'Αγρίνιο',
    'Δράμα', 'Βέροια', 'Κοζάνη', 'Καρδίτσα', 'Ρέθυμνο', 'Τρίπολη', 'Σπάρτη', 'Κόρινθος', 'Πύργος', 'Ναύπλιο',
    'Άργος', 'Άρτα', 'Πρέβεζα', 'Ηγουμενίτσα', 'Κέρκυρα', 'Λευκάδα', 'Αργοστόλι', 'Ζάκυνθος', 'Μεσολόγγι',
    'Ναύπακτος', 'Άμφισσα', 'Λιβαδειά', 'Θήβα', 'Καρπενήσι', 'Φλώρινα', 'Καστοριά', 'Γρεβενά', 'Έδεσσα',
    'Γιαννιτσά', 'Κιλκίς', 'Πολύγυρος', 'Ορεστιάδα', 'Μυτιλήνη', 'Χίος', 'Σάμος', 'Ερμούπολη', 'Άγιος Νικόλαος',
    'Ιεράπετρα', 'Σητεία', 'Αίγιο', 'Πτολεμαΐδα', 'Νάουσα', 'Τύρναβος', 'Ελευσίνα', 'Πειραιάς', 'Μέγαρα', 'Κως',
    'Νάξος', 'Μύρινα', 'Φιλιππιάδα',
  ];
  const COUNTRIES = [
    'Ελλάδα', 'Κύπρος', 'Ιταλία', 'Ισπανία', 'Πορτογαλία', 'Γαλλία', 'Γερμανία', 'Αυστρία', 'Ελβετία', 'Βέλγιο',
    'Ολλανδία', 'Λουξεμβούργο', 'Δανία', 'Σουηδία', 'Νορβηγία', 'Φινλανδία', 'Ισλανδία', 'Ιρλανδία',
    'Ηνωμένο Βασίλειο', 'Πολωνία', 'Τσεχία', 'Σλοβακία', 'Ουγγαρία', 'Ρουμανία', 'Βουλγαρία', 'Σερβία', 'Κροατία',
    'Σλοβενία', 'Αλβανία', 'Βόρεια Μακεδονία', 'Μαυροβούνιο', 'Τουρκία', 'Ουκρανία', 'Ρωσία', 'Λιθουανία',
    'Λετονία', 'Εσθονία', 'Μάλτα', 'Μολδαβία', 'Γεωργία', 'Αρμενία', 'Αίγυπτος', 'Λιβύη', 'Τυνησία', 'Αλγερία',
    'Μαρόκο', 'Νιγηρία', 'Κένυα', 'Αιθιοπία', 'Νότια Αφρική', 'Γκάνα', 'Ισραήλ', 'Λίβανος', 'Ιορδανία',
    'Σαουδική Αραβία', 'Ιράν', 'Ινδία', 'Πακιστάν', 'Κίνα', 'Ιαπωνία', 'Νότια Κορέα', 'Ταϊλάνδη', 'Βιετνάμ',
    'Ινδονησία', 'Φιλιππίνες', 'Μαλαισία', 'Σιγκαπούρη', 'Αυστραλία', 'Νέα Ζηλανδία', 'Καναδάς',
    'Ηνωμένες Πολιτείες', 'Μεξικό', 'Κούβα', 'Βραζιλία', 'Αργεντινή', 'Χιλή', 'Περού', 'Κολομβία', 'Βενεζουέλα',
    'Ουρουγουάη', 'Παραγουάη', 'Βολιβία', 'Ισημερινός',
  ];
  /** Γράμματα των αστυνομικών ταυτοτήτων: όσα είναι ίδια σε ελληνικό και λατινικό αλφάβητο. */
  const ID_LETTERS = 'ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ';

  /** Τα είδη τιμών, με τη σειρά που εμφανίζονται στην οθόνη. */
  const KINDS = {
    int: { label: 'Ακέραιοι', plural: 'ακέραιοι', numeric: true, decimals: 0, min: 1, max: 100 },
    real: { label: 'Πραγματικοί', plural: 'πραγματικοί', numeric: true, decimals: 1, min: 0, max: 20 },
    name: { label: 'Ονόματα', plural: 'ονόματα', pool: () => MALE.concat(FEMALE) },
    fullname: { label: 'Ονοματεπώνυμα', plural: 'ονοματεπώνυμα' },
    id: { label: 'Αριθμοί ταυτότητας', plural: 'αριθμοί ταυτότητας' },
    city: { label: 'Πόλεις της Ελλάδας', plural: 'πόλεις', pool: () => CITIES.slice() },
    country: { label: 'Χώρες', plural: 'χώρες', pool: () => COUNTRIES.slice() },
  };
  const ORDERS = { random: 'τυχαία σειρά', asc: 'αύξουσα σειρά', desc: 'φθίνουσα σειρά' };

  /** Κεφαλαία χωρίς τόνους και διαλυτικά (π.χ. «Πτολεμαΐδα» → «ΠΤΟΛΕΜΑΙΔΑ»). */
  function caps(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toUpperCase();
  }

  /** Σύγκριση όπως οι τελεστές < και > της Python. */
  function comparePython(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  const randInt = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** count τιμές από μια συνάρτηση next(); με unique χωρίς επαναλήψεις (όσο είναι δυνατό). */
  function draw(count, next, unique) {
    const out = [];
    const seen = new Set();
    let tries = 0;
    while (out.length < count && tries < count * 2000) {
      tries++;
      const v = next();
      if (unique) {
        if (seen.has(v)) continue;
        seen.add(v);
      }
      out.push(v);
    }
    return out;
  }

  const fmtNum = (v) => String(v).replace(/^-0$/, '0');

  /**
   * Δημιουργεί τιμές. Επιστρέφει { values: [κείμενα γραμμών], label: περιγραφή για σχόλιο } ή { error }.
   * opts: kind, count, order (random|asc|desc), unique, caps, min, max, decimals, rnd (για τα τεστ).
   */
  function generate(opts) {
    const kind = KINDS[opts.kind] ? opts.kind : 'int';
    const K = KINDS[kind];
    const rnd = opts.rnd || Math.random;
    const order = ORDERS[opts.order] ? opts.order : 'random';
    let count = Math.floor(Number(opts.count));
    if (!Number.isFinite(count) || count < 1) {
      return { error: 'Το πλήθος πρέπει να είναι ακέραιος αριθμός από 1 έως 50.' };
    }
    count = Math.min(count, MAX_COUNT);
    const unique = !!opts.unique;
    let raw;   // τιμές πριν τη μορφοποίηση (αριθμοί ή κείμενα)
    let label;

    if (K.numeric) {
      const decimals = kind === 'int' ? 0 : Math.max(1, Math.min(2, Math.floor(Number(opts.decimals) || 1)));
      const min = Number(opts.min);
      const max = Number(opts.max);
      if (!Number.isFinite(min) || !Number.isFinite(max) || String(opts.min).trim() === '' || String(opts.max).trim() === '') {
        return { error: 'Συμπλήρωσε τα όρια «Από» και «Έως» με αριθμούς.' };
      }
      if (min > max) {
        return { error: `Το «Από» (${fmtNum(min)}) είναι μεγαλύτερο από το «Έως» (${fmtNum(max)}). Άλλαξέ τα, ώστε το «Από» να είναι το μικρότερο όριο.` };
      }
      if (Math.abs(min) > 1e9 || Math.abs(max) > 1e9) {
        return { error: 'Τα όρια πρέπει να είναι από -1000000000 έως 1000000000.' };
      }
      if (kind === 'int' && (!Number.isInteger(min) || !Number.isInteger(max))) {
        return { error: 'Για ακέραιους, τα όρια «Από» και «Έως» πρέπει να είναι ακέραιοι αριθμοί (χωρίς δεκαδικά).' };
      }
      // ακέραια «βήματα» του 1, 0.1 ή 0.01 μέσα στα όρια: έτσι οι τιμές είναι ακριβείς (π.χ. 15.5, όχι 15.4999)
      const scale = 10 ** decimals;
      const lo = Math.ceil(min * scale - 1e-9);
      const hi = Math.floor(max * scale + 1e-9);
      if (lo > hi) {
        return { error: `Δεν υπάρχει αριθμός με ${decimals} δεκαδικό ανάμεσα στο ${fmtNum(min)} και στο ${fmtNum(max)}. Μεγάλωσε το διάστημα.` };
      }
      const size = hi - lo + 1;
      if (unique && size < count) {
        return {
          error:
            `Ζήτησες ${count} διαφορετικές τιμές, αλλά από ${fmtNum(min)} έως ${fmtNum(max)} ` +
            (kind === 'int' ? `υπάρχουν μόνο ${size} ακέραιοι.` : `υπάρχουν μόνο ${size} αριθμοί με ${decimals} δεκαδικό.`) +
            ' Μεγάλωσε το διάστημα, μίκρυνε το πλήθος ή ξετσέκαρε το «Χωρίς επαναλήψεις».',
        };
      }
      const steps = unique && size <= 5000
        ? shuffle(Array.from({ length: size }, (_, i) => lo + i), rnd).slice(0, count)
        : draw(count, () => randInt(rnd, lo, hi), unique);
      raw = steps.map((s) => Number((s / scale).toFixed(decimals)));
      label = `${count} ${K.plural} από ${fmtNum(min)} έως ${fmtNum(max)}` + (kind === 'real' ? ` (${decimals} δεκαδικ${decimals === 1 ? 'ό' : 'ά'})` : '');
    } else {
      let next;
      let poolSize = Infinity;
      if (kind === 'fullname') {
        next = () => {
          const female = rnd() < 0.5;
          const first = female ? FEMALE[randInt(rnd, 0, FEMALE.length - 1)] : MALE[randInt(rnd, 0, MALE.length - 1)];
          const sur = SURNAMES[randInt(rnd, 0, SURNAMES.length - 1)][female ? 1 : 0];
          return `${sur} ${first}`;
        };
      } else if (kind === 'id') {
        next = () =>
          ID_LETTERS[randInt(rnd, 0, ID_LETTERS.length - 1)] +
          ID_LETTERS[randInt(rnd, 0, ID_LETTERS.length - 1)] +
          String(randInt(rnd, 100000, 999999));
      } else {
        const pool = K.pool();
        poolSize = pool.length;
        if (unique) {
          raw = shuffle(pool, rnd).slice(0, count);
        } else {
          next = () => pool[randInt(rnd, 0, pool.length - 1)];
        }
      }
      if (!raw) raw = draw(count, next, unique);
      if (raw.length < count) {
        return { error: `Υπάρχουν μόνο ${Math.min(poolSize, raw.length)} διαφορετικές τιμές αυτού του είδους. Μίκρυνε το πλήθος ή ξετσέκαρε το «Χωρίς επαναλήψεις».` };
      }
      if (opts.caps && kind !== 'id') raw = raw.map(caps);
      label = `${count} ${K.plural}`;
    }

    if (order === 'asc') raw.sort(comparePython);
    else if (order === 'desc') raw.sort((a, b) => comparePython(b, a));
    label += `, ${ORDERS[order]}`;
    return { values: raw.map((v) => (typeof v === 'number' ? fmtNum(v) : v)), label };
  }

  /** Πλέκει εναλλάξ τις ομάδες: [[α1],[α2]] + [β1,β2] → [[α1,β1],[α2,β2]]. */
  function interleave(groups, values) {
    if (groups.length !== values.length) return null;
    return groups.map((g, i) => g.concat(values[i]));
  }

  /** Κείμενο μιας ομάδας τιμών για το αρχείο: σχόλιο με την περιγραφή και μία τιμή σε κάθε γραμμή. */
  function blockText(block) {
    const head = block.labels.length === 1
      ? `# ${block.labels[0]}`
      : `# Εναλλάξ ανά ${block.labels.length} γραμμές: ${block.labels.join(' | ')}`;
    return [head, ...block.groups.map((g) => g.join('\n'))].join('\n') + '\n';
  }

  /** Μέτρηση: πόσες γραμμές τιμών έχει το αρχείο και πόσες από αυτές είναι «?» (από το πληκτρολόγιο). */
  function countLines(text) {
    let values = 0;
    let ask = 0;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (line === '?') ask++;
      else values++;
    }
    return { values, ask };
  }

  return { MAX_COUNT, KINDS, ORDERS, generate, interleave, blockText, countLines, caps, comparePython };
});
