/*
 * Οθόνη «Δεδομένα για την input()»: επεξεργασία του αρχείου δεδομένων ενός προγράμματος,
 * με γεννήτρια τιμών (αριθμοί, ονόματα, ταυτότητες, πόλεις, χώρες) σε τυχαία/αύξουσα/φθίνουσα σειρά.
 * Τα αρχεία (άνοιγμα, αποθήκευση, σύνδεση με το πρόγραμμα) τα χειρίζεται η εφαρμογή μέσω των callbacks.
 */
(function (root) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const G = () => root.DataGen;
  const baseName = (p) => p.split(/[\\/]/).pop();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const DataScreen = {
    opts: null,        // { program, path, text, attached, note, template, onSave, onPick, onDetach }
    path: null,        // το αρχείο που επεξεργαζόμαστε (null: νέο, δεν έχει αποθηκευτεί)
    original: '',      // για την ερώτηση «αποθήκευση;» στο κλείσιμο
    kind: 'int',
    order: 'random',
    ranges: {},        // τα όρια που έδωσε ο χρήστης για κάθε αριθμητικό είδος
    preview: null,     // { values, label } ή { error }
    lastBlock: null,   // η τελευταία ομάδα που προστέθηκε: { labels, groups, text } (για το «Εναλλάξ»)
    wired: false,
    busy: false,

    isOpen() {
      return !!$('#dlg-data') && $('#dlg-data').open;
    },

    open(opts) {
      this.wire();
      this.opts = opts;
      this.path = opts.path || null;
      this.lastBlock = null;
      const text = opts.text != null ? opts.text : opts.template();
      this.setText(text, false);
      this.original = text;
      $('#dd-prog').textContent = `για το πρόγραμμα «${opts.program}»`;
      this.showNote(opts.note || '', opts.note ? 'warn' : '');
      this.renderFile();
      this.renderKind();
      this.roll();
      $('#dlg-data').showModal();
      const ta = $('#dd-text');
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.scrollTop = ta.scrollHeight;
    },

    // ------------------------------------------------------------ σύνδεση με το DOM
    wire() {
      if (this.wired) return;
      this.wired = true;
      const kinds = $('#dd-kinds');
      for (const [key, k] of Object.entries(G().KINDS)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.kind = key;
        b.textContent = k.label;
        b.addEventListener('click', () => { this.kind = key; this.renderKind(); this.roll(); });
        kinds.appendChild(b);
      }
      for (const b of document.querySelectorAll('#dd-order button')) {
        b.addEventListener('click', () => { this.order = b.dataset.order; this.renderKind(); this.roll(); });
      }
      for (const id of ['#dd-count', '#dd-min', '#dd-max', '#dd-dec', '#dd-unique', '#dd-caps']) {
        $(id).addEventListener('input', () => {
          if (id === '#dd-min' || id === '#dd-max') this.ranges[this.kind] = { min: $('#dd-min').value, max: $('#dd-max').value };
          this.roll();
        });
      }
      $('#dd-count').addEventListener('change', () => {
        // το πλήθος περιορίζεται στο 1…50
        const n = Math.floor(Number($('#dd-count').value));
        if (!Number.isFinite(n) || n < 1) $('#dd-count').value = 1;
        else if (n > G().MAX_COUNT) $('#dd-count').value = G().MAX_COUNT;
        this.roll();
      });
      $('#dd-reroll').addEventListener('click', () => this.roll());
      $('#dd-append').addEventListener('click', () => this.append());
      $('#dd-zip').addEventListener('click', () => this.zip());
      $('#dd-ask').addEventListener('click', () => this.insertAsk());
      $('#dd-clear').addEventListener('click', () => this.clearValues());
      $('#dd-text').addEventListener('input', () => this.renderStat());
      $('#dd-open').addEventListener('click', () => this.pick());
      $('#dd-new').addEventListener('click', () => this.newFile());
      $('#dd-detach').addEventListener('click', () => this.detach());
      $('#dd-cancel').addEventListener('click', () => this.close());
      $('#dd-save').addEventListener('click', () => this.save());
      // Esc: ίδια συμπεριφορά με το «Άκυρο» (ερώτηση αν υπάρχουν αλλαγές)
      $('#dlg-data').addEventListener('cancel', (e) => { e.preventDefault(); this.close(); });
    },

    // ------------------------------------------------------------ εμφάνιση
    renderKind() {
      const K = G().KINDS[this.kind];
      for (const b of document.querySelectorAll('#dd-kinds button')) {
        const on = b.dataset.kind === this.kind;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
      }
      for (const b of document.querySelectorAll('#dd-order button')) {
        const on = b.dataset.order === this.order;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
      }
      $('#dd-range').hidden = !K.numeric;
      $('#dd-dec-field').hidden = this.kind !== 'real';
      $('#dd-caps-row').hidden = K.numeric || this.kind === 'id';
      if (K.numeric) {
        const r = this.ranges[this.kind] || { min: K.min, max: K.max };
        $('#dd-min').value = r.min;
        $('#dd-max').value = r.max;
        $('#dd-min').step = this.kind === 'int' ? '1' : 'any';
        $('#dd-max').step = this.kind === 'int' ? '1' : 'any';
      }
    },

    renderFile() {
      const el = $('#dd-file');
      el.textContent = this.path ? `Αρχείο: ${baseName(this.path)}` : 'Νέο αρχείο (θα ζητηθεί όνομα στην αποθήκευση)';
      el.title = this.path || '';
      $('#dd-detach').hidden = !this.opts.attached;
    },

    renderStat() {
      const { values, ask } = G().countLines($('#dd-text').value);
      let s = `Γραμμές με τιμές: ${values}`;
      if (ask) s += ` · από το πληκτρολόγιο («?»): ${ask}`;
      $('#dd-stat').textContent = s;
    },

    showNote(text, cls) {
      const el = $('#dd-note');
      el.hidden = !text;
      el.className = 'dd-note' + (cls ? ' ' + cls : '');
      el.textContent = text;
    },

    /** Νέα κλήρωση με τις τρέχουσες ρυθμίσεις και εμφάνιση στην προεπισκόπηση. */
    roll() {
      const K = G().KINDS[this.kind];
      this.preview = G().generate({
        kind: this.kind,
        count: $('#dd-count').value,
        order: this.order,
        unique: $('#dd-unique').checked,
        caps: $('#dd-caps').checked,
        min: $('#dd-min').value,
        max: $('#dd-max').value,
        decimals: $('#dd-dec').value,
      });
      const box = $('#dd-preview');
      if (this.preview.error) {
        box.innerHTML = '';
        this.showNote(this.preview.error, 'bad');
      } else {
        box.innerHTML = this.preview.values.map((v) => `<span>${esc(v)}</span>`).join('');
        // Ταξινόμηση κειμένων με τόνους: εξήγηση γιατί η σειρά μπορεί να μοιάζει «περίεργη»
        const accentSort = !K.numeric && this.kind !== 'id' && this.order !== 'random' && !$('#dd-caps').checked;
        this.showNote(
          accentSort
            ? 'Η ταξινόμηση γίνεται όπως συγκρίνει η Python (με < και >), χαρακτήρα προς χαρακτήρα. ' +
              'Με πεζά και τόνους η σειρά δεν είναι πάντα η αλφαβητική: π.χ. το «Ά» μπαίνει πριν από το «Α» και το «ά» πριν από το «α». ' +
              'Με «Κεφαλαία χωρίς τόνους» η σειρά είναι η αλφαβητική.'
            : '',
          'info'
        );
      }
      const ok = !this.preview.error;
      $('#dd-append').disabled = !ok;
      $('#dd-zip').disabled = !ok;
    },

    // ------------------------------------------------------------ επεξεργασία του κειμένου
    /** Αντικαθιστά το κείμενο. Με undo=true μέσω execCommand, ώστε να αναιρείται με Ctrl+Z. */
    setText(text, undo = true) {
      const ta = $('#dd-text');
      if (undo) {
        ta.focus();
        ta.setSelectionRange(0, ta.value.length);
        document.execCommand('insertText', false, text);
      } else {
        ta.value = text;
      }
      this.renderStat();
    },

    /** Εισάγει κείμενο στο διάστημα [from, to) με δυνατότητα αναίρεσης (Ctrl+Z). */
    replaceRange(from, to, text) {
      const ta = $('#dd-text');
      ta.focus();
      ta.setSelectionRange(from, to);
      if (!document.execCommand('insertText', false, text)) {
        ta.setRangeText(text, from, to, 'end');
      }
      this.renderStat();
    },

    /** Το σημείο του τέλους όπου μπαίνει νέα ομάδα: νέα γραμμή και μια κενή γραμμή για να ξεχωρίζει. */
    tailPrefix(value) {
      if (!value.trim()) return '';
      if (!value.endsWith('\n')) return '\n\n';
      return /\n[ \t]*\n$/.test(value) ? '' : '\n';
    },

    append() {
      if (!this.preview || this.preview.error) return;
      const ta = $('#dd-text');
      const value = ta.value;
      const block = { labels: [this.preview.label], groups: this.preview.values.map((v) => [v]) };
      block.text = G().blockText(block);
      this.replaceRange(value.length, value.length, this.tailPrefix(value) + block.text);
      this.lastBlock = block;
      ta.scrollTop = ta.scrollHeight;
      this.roll();
      this.showNote(`Προστέθηκαν στο τέλος: ${block.labels[0]}.`, 'ok');
    },

    /** Πλέκει τις νέες τιμές εναλλάξ με την τελευταία ομάδα (για παράλληλους πίνακες). */
    zip() {
      if (!this.preview || this.preview.error) return;
      const ta = $('#dd-text');
      const last = this.lastBlock;
      if (!last) {
        this.showNote(
          'Για το «Εναλλάξ» χρειάζεται πρώτα μια ομάδα τιμών. Π.χ. για ένα for που διαβάζει onoma = input() και vathmos = float(input()): ' +
            'πρόσθεσε πρώτα τα ονόματα με «Πρόσθεσε στο τέλος» και μετά τους βαθμούς με «Εναλλάξ».',
          'bad'
        );
        return;
      }
      if (!ta.value.endsWith(last.text)) {
        this.showNote(
          'Το τέλος του αρχείου άλλαξε μετά την τελευταία προσθήκη, οπότε δεν είναι σίγουρο ποιες γραμμές να πλεχτούν. ' +
            'Πρόσθεσε ξανά την πρώτη ομάδα με «Πρόσθεσε στο τέλος» και αμέσως μετά πάτησε «Εναλλάξ».',
          'bad'
        );
        return;
      }
      const groups = G().interleave(last.groups, this.preview.values);
      if (!groups) {
        this.showNote(
          `Η προηγούμενη ομάδα έχει ${last.groups.length} τιμές και η νέα ${this.preview.values.length}. ` +
            `Για να πλεχτούν εναλλάξ (μία από κάθε ομάδα) πρέπει να έχουν το ίδιο πλήθος: βάλε Πλήθος ${last.groups.length}.`,
          'bad'
        );
        return;
      }
      const block = { labels: last.labels.concat(this.preview.label), groups };
      block.text = G().blockText(block);
      const start = ta.value.length - last.text.length;
      this.replaceRange(start, ta.value.length, block.text);
      this.lastBlock = block;
      ta.scrollTop = ta.scrollHeight;
      this.roll();
      this.showNote(
        `Οι τιμές μπήκαν εναλλάξ ανά ${block.labels.length} γραμμές: κάθε επανάληψη του προγράμματος διαβάζει ` +
          `μία τιμή από κάθε ομάδα, με τη σειρά που τις ζητά η input().`,
        'ok'
      );
    },

    /** Γραμμή «?» στη θέση του κέρσορα: αυτή η τιμή θα δοθεί από το πληκτρολόγιο. */
    insertAsk() {
      const ta = $('#dd-text');
      const pos = ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const after = ta.value.slice(pos);
      const pre = before && !before.endsWith('\n') ? '\n' : '';
      const post = after && !after.startsWith('\n') ? '\n' : after ? '' : '\n';
      this.replaceRange(pos, ta.selectionEnd, `${pre}?${post}`);
      this.showNote('Η γραμμή «?» σημαίνει: αυτή την τιμή ρώτα τη από το πληκτρολόγιο. Μετά συνεχίζει το αρχείο.', 'ok');
    },

    clearValues() {
      this.setText(this.opts.template());
      this.lastBlock = null;
      this.showNote('Οι τιμές σβήστηκαν (Ctrl+Z για αναίρεση).', 'ok');
    },

    get dirty() {
      return $('#dd-text').value !== this.original;
    },

    // ------------------------------------------------------------ αρχεία
    async pick() {
      const r = await this.opts.onPick(this.path);
      if (!r) return;
      this.path = r.path;
      this.setText(r.text);
      this.original = r.text;
      this.lastBlock = null;
      this.renderFile();
      this.showNote(`Φορτώθηκε το «${baseName(r.path)}». Πάτησε «Αποθήκευση και χρήση» για να το παίρνει η input().`, 'ok');
    },

    newFile() {
      this.path = null;
      this.setText(this.opts.template());
      this.lastBlock = null;
      this.renderFile();
      this.showNote('Νέο αρχείο: γράψε ή δημιούργησε τιμές και πάτησε «Αποθήκευση και χρήση» για να του δώσεις όνομα.', 'ok');
    },

    detach() {
      this.opts.onDetach();
      this.finish();
    },

    async save() {
      if (this.busy) return;
      this.busy = true;
      try {
        const text = $('#dd-text').value;
        const p = await this.opts.onSave(text, this.path);
        if (!p) return false;
        this.path = p;
        this.original = text;
        this.finish();
        return true;
      } finally {
        this.busy = false;
      }
    },

    async close() {
      if (this.busy) return;
      if (this.dirty) {
        const { response } = await root.api.dialog.message({
          type: 'question',
          title: 'Δεδομένα για την input()',
          message: 'Να αποθηκευτούν οι αλλαγές στα δεδομένα;',
          detail: 'Αν κλείσεις χωρίς αποθήκευση, οι αλλαγές χάνονται και η input() θα πάρει τις τιμές που ήταν αποθηκευμένες.',
          buttons: ['Αποθήκευση και χρήση', 'Κλείσιμο χωρίς αποθήκευση', 'Άκυρο'],
          defaultId: 0,
          cancelId: 2,
        });
        if (response === 2) return;
        if (response === 0) { await this.save(); return; }
      }
      this.finish();
    },

    finish() {
      $('#dlg-data').close();
      if (this.opts && this.opts.onClose) this.opts.onClose();
    },
  };

  root.DataScreen = DataScreen;
})(window);
