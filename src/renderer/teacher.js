/* Οθόνη καθηγητή: οι μαθητές της τάξης, ο κώδικάς τους ζωντανά και τα σηκωμένα χέρια. */
(function (root) {
  'use strict';
  const api = root.api;
  const $ = (s) => document.querySelector(s);
  const ES = () => root.EditorSetup;
  const PREVIEW_LINES = 12;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function ago(t) {
    if (!t) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 10) return 'τώρα';
    if (s < 60) return `πριν ${s}″`;
    if (s < 3600) return `πριν ${Math.floor(s / 60)}′`;
    return `πριν ${Math.floor(s / 3600)} ώρ.`;
  }

  /** Σύντομος ήχος «ντιν-ντον» όταν σηκώνεται χέρι. */
  function chime() {
    try {
      const ctx = new AudioContext();
      [[880, 0], [660, 0.18]].forEach(([f, at]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.5);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + at);
        o.stop(ctx.currentTime + at + 0.55);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch (_) { /* χωρίς ήχο */ }
  }

  const Teacher = {
    monaco: null,
    students: new Map(),   // id → στοιχεία μαθητή (όπως τα στέλνει ο server)
    cards: new Map(),      // id → { el, ... }
    selected: null,
    info: null,
    present: { on: false, locked: false, copy: true },

    async init(monaco) {
      this.monaco = monaco;
      const settings = await api.settings.get();
      document.body.className = `teacher ${settings.theme === 'dark' ? 'theme-dark' : 'theme-light'}`;
      ES().init(monaco);
      this.theme = settings.theme === 'dark' ? 'idle-dark' : 'idle-light';
      monaco.editor.setTheme(this.theme);   // και για τα χρώματα της προεπισκόπησης στις κάρτες
      this.defaultFont = settings.fontSize;
      // μέγεθος γραμμάτων και αναδίπλωση της προβολής κώδικα: ρυθμίσεις του καθηγητή, θυμούνται την τελευταία επιλογή
      this.fontSize = Number(this.stored('teacher.fontSize')) || settings.fontSize;
      this.wordWrap = this.stored('teacher.wordWrap') === 'on';

      const d = await api.teacher.defaults();
      $('#t-name').value = d.name;
      $('#t-room').value = d.room;
      $('#t-start-form').addEventListener('submit', (e) => { e.preventDefault(); this.start(); });
      $('#t-name').focus();

      api.teacher.onEvent((type, data) => this.onEvent(type, data));
      $('#t-newpin').addEventListener('click', async () => { const pin = await api.teacher.newPin(); if (pin) this.showPin(pin); });
      $('#t-export').addEventListener('click', () => this.exportTrust());
      $('#t-info').addEventListener('click', () => $('#t-dlg-info').showModal());
      $('#t-filter').addEventListener('input', () => this.render());
      $('#t-detail-close').addEventListener('click', () => this.select(null));
      $('#t-detail-lower').addEventListener('click', () => { if (this.selected) api.teacher.lowerHand(this.selected); });
      $('#t-font-down').addEventListener('click', () => this.setFont(this.fontSize - 1));
      $('#t-font-up').addEventListener('click', () => this.setFont(this.fontSize + 1));
      $('#t-font-size').addEventListener('click', () => this.setFont(this.defaultFont));
      $('#t-wrap').addEventListener('click', () => this.setWrap(!this.wordWrap));
      $('#t-present-btn').addEventListener('click', () => api.teacher.present({ on: !this.present.on }));
      $('#t-present-lock').addEventListener('change', (e) => api.teacher.present({ locked: e.target.checked }));
      $('#t-present-copy').addEventListener('change', (e) => api.teacher.present({ copy: e.target.checked }));
      this.showViewSettings();
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.selected && !document.querySelector('dialog[open]')) this.select(null);
        if (!e.ctrlKey || !this.selected) return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); this.setFont(this.fontSize + 1); }
        else if (e.key === '-') { e.preventDefault(); this.setFont(this.fontSize - 1); }
        else if (e.key === '0') { e.preventDefault(); this.setFont(this.defaultFont); }
      }, true);
      $('#t-editor').addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        this.setFont(this.fontSize + (e.deltaY < 0 ? 1 : -1));
      }, { capture: true, passive: false });
      setInterval(() => this.refreshTimes(), 10000);
    },

    async start() {
      $('#t-start-error').textContent = '';
      const r = await api.teacher.start({ name: $('#t-name').value.trim(), room: $('#t-room').value.trim() });
      if (!r || !r.ok) { $('#t-start-error').textContent = (r && r.error) || 'Η τάξη δεν ξεκίνησε.'; return; }
      this.info = r;
      $('#t-start').hidden = true;
      $('#t-class').hidden = false;
      $('#t-title-name').textContent = $('#t-name').value.trim() || 'Τάξη';
      $('#t-title-room').textContent = $('#t-room').value.trim();
      document.title = `Τάξη${$('#t-room').value.trim() ? ` ${$('#t-room').value.trim()}` : ''} – Python 2.7 ΕΠΑΛ`;
      this.showPin(r.pin);
      $('#t-info-ip').textContent = r.addresses.join(', ') || '(καμία σύνδεση δικτύου)';
      $('#t-info-port').textContent = r.port;
      $('#t-info-fp').textContent = r.fingerprint;
      this.render();
    },

    /** Η παρουσίαση (ανοίγει/κλείνει εδώ ή από το μενού Τάξη του κύριου παραθύρου). */
    showPresent(s) {
      this.present = s;
      $('#t-present').classList.toggle('on', s.on);
      $('#t-present-btn').textContent = s.on ? '📺 Παρουσιάζεις · Τέλος' : '📺 Παρουσίαση';
      $('#t-present-lock').checked = s.locked;
      $('#t-present-copy').checked = s.copy;
    },

    showPin(pin) {
      $('#t-pin').textContent = pin;
      document.querySelectorAll('.t-pin-inline').forEach((e) => { e.textContent = pin; });
    },

    async exportTrust() {
      const r = await api.teacher.exportTrust();
      if (!r) return;
      if (!r.ok) {
        await api.dialog.message({ type: 'error', title: 'classroom.json', message: 'Η αποθήκευση απέτυχε.', detail: r.error || '' });
        return;
      }
      await api.dialog.message({
        type: 'info',
        title: 'classroom.json',
        message: `Αποθηκεύτηκε: ${r.path}`,
        detail: `Αντίγραψέ το σε κάθε υπολογιστή μαθητή στη θέση:\n${r.target}\n\n` +
          (r.teachers > 1 ? `Το αρχείο περιέχει ${r.teachers} καθηγητές (κράτησε όσους υπήρχαν ήδη σε αυτό).\n\n` : '') +
          'Στον φάκελο αυτόν γράφει μόνο ο διαχειριστής, ώστε κανένας μαθητής να μην μπορεί να «γίνει» καθηγητής.',
        buttons: ['Εντάξει'],
      });
    },

    onEvent(type, data) {
      switch (type) {
        case 'student': {
          const prev = this.students.get(data.id);
          this.students.set(data.id, data);
          if (!prev) this.render();
          else if (prev.hand !== data.hand || prev.online !== data.online) this.render();
          else this.updateCard(data);
          if (this.selected === data.id) this.updateDetail(data, prev);
          break;
        }
        case 'remove':
          this.students.delete(data.id);
          if (this.selected === data.id) this.select(null);
          this.render();
          break;
        case 'hand':
          chime();
          break;
        case 'select':
          this.select(data);
          break;
        case 'present':
          this.showPresent(data);
          break;
        case 'error':
          api.dialog.message({ type: 'warning', title: 'Τάξη', message: 'Πρόβλημα δικτύου', detail: String(data) });
          break;
        default:
          break;
      }
    },

    sorted() {
      const q = $('#t-filter').value.trim().toLowerCase();
      return [...this.students.values()]
        .filter((s) => !q || `${s.name} ${s.host} ${s.user}`.toLowerCase().includes(q))
        .sort((a, b) => (b.hand - a.hand) || (a.hand && b.hand ? a.handAt - b.handAt : 0) ||
          (b.online - a.online) || a.name.localeCompare(b.name, 'el'));
    },

    render() {
      const grid = $('#t-grid');
      const list = this.sorted();
      // οι κάρτες ξαναχρησιμοποιούνται: μόνο η σειρά αλλάζει
      for (const [id, card] of this.cards) {
        if (!this.students.has(id)) { card.el.remove(); this.cards.delete(id); }
      }
      list.forEach((s) => {
        let card = this.cards.get(s.id);
        if (!card) { card = this.makeCard(s); this.cards.set(s.id, card); }
        grid.appendChild(card.el);
        this.updateCard(s);
      });
      for (const [id, card] of this.cards) card.el.hidden = !list.some((s) => s.id === id);
      $('#t-empty').hidden = this.students.size > 0;
      const all = [...this.students.values()];
      const online = all.filter((s) => s.online).length;
      const hands = all.filter((s) => s.hand).length;
      $('#t-counts').innerHTML = '';
      $('#t-counts').append(el('span', '', `Συνδεδεμένοι: ${online}${all.length > online ? ` / ${all.length}` : ''}`));
      if (hands) $('#t-counts').append(el('span', 'hands', `✋ ${hands}`));
      document.title = `${hands ? `(✋ ${hands}) ` : ''}Τάξη – Python 2.7 ΕΠΑΛ`;
    },

    makeCard(s) {
      const card = { el: el('div', 'card') };
      card.el.tabIndex = 0;
      const head = el('div', 'card-head');
      card.dot = el('span', 'dot');
      card.name = el('span', 'card-name');
      card.host = el('span', 'card-host muted');
      card.hand = el('button', 'hand-btn', '✋');
      card.hand.title = 'Ζητά βοήθεια. Κλικ για να κατεβάσεις το χέρι.';
      card.hand.addEventListener('click', (e) => { e.stopPropagation(); api.teacher.lowerHand(s.id); });
      const remove = el('button', 'mini remove', '×');
      remove.title = 'Αφαίρεση από την τάξη (αποσύνδεση)';
      remove.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cur = this.students.get(s.id);
        const r = await api.dialog.message({
          type: 'question', title: 'Τάξη', message: `Αφαίρεση του/της «${cur ? cur.name : ''}» από την τάξη;`,
          detail: 'Αν ήταν συνδεδεμένος, αποσυνδέεται. Μπορεί να ξανασυνδεθεί με το PIN.', buttons: ['Αφαίρεση', 'Άκυρο'], defaultId: 1, cancelId: 1,
        });
        if (r.response === 0) api.teacher.remove(s.id);
      });
      head.append(card.dot, card.name, card.host, el('span', 'spacer'), card.hand, remove);
      card.meta = el('div', 'card-meta muted');
      card.code = el('pre', 'card-code mono');
      card.err = el('div', 'card-err');
      card.el.append(head, card.meta, card.code, card.err);
      card.el.addEventListener('click', () => this.select(s.id));
      card.el.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.select(s.id); });
      return card;
    },

    updateCard(s) {
      const card = this.cards.get(s.id);
      if (!card) return;
      card.el.classList.toggle('offline', !s.online);
      card.el.classList.toggle('raised', !!s.hand);
      card.el.classList.toggle('selected', this.selected === s.id);
      card.el.classList.toggle('has-error', s.errors.length > 0);
      card.dot.title = s.online ? 'Συνδεδεμένος' : 'Αποσυνδέθηκε';
      card.name.textContent = s.name;
      card.host.textContent = s.host;
      card.hand.hidden = !s.hand;
      card.meta.textContent = `${s.file || '—'} · ${s.text ? `${s.text.split('\n').length} γρ.` : 'κενό'}` +
        (s.updatedAt ? ` · ${ago(s.updatedAt)}` : '') + (s.hand ? ` · ✋ ${ago(s.handAt)}` : '');
      card.err.textContent = s.errors.length ? `✖ Γρ. ${s.errors[0].line}: ${s.errors[0].message.split('\n')[0]}` : '';
      this.renderPreview(s, card);
    },

    /** Οι γραμμές γύρω από τον κέρσορα, με χρώματα (όπως στον editor του μαθητή). */
    renderPreview(s, card) {
      const lines = s.text.split('\n');
      const cur = s.cursor ? s.cursor.line : lines.length;
      const start = Math.max(0, Math.min(cur - Math.ceil(PREVIEW_LINES / 2), lines.length - PREVIEW_LINES));
      const slice = lines.slice(start, start + PREVIEW_LINES);
      const key = `${start}|${cur}|${s.errors.map((e) => e.line).join(',')}|${slice.join('\n')}`;
      if (card.previewKey === key) return;
      card.previewKey = key;
      const token = (card.previewToken || 0) + 1;
      card.previewToken = token;
      this.monaco.editor.colorize(slice.join('\n'), ES().LANG, { tabSize: 4 }).then((html) => {
        if (card.previewToken !== token) return;
        card.code.innerHTML = html;
        // αριθμοί γραμμών και η γραμμή του κέρσορα
        const rows = card.code.querySelectorAll(':scope > div > span, :scope > span');
        rows.forEach((row, i) => {
          row.dataset.line = start + i + 1;
          row.classList.toggle('cur', start + i + 1 === cur);
          row.classList.toggle('err', s.errors.some((e) => e.line === start + i + 1));
        });
      });
    },

    refreshTimes() {
      for (const s of this.students.values()) this.updateCard(s);   // η προεπισκόπηση δεν ξαναχρωματίζεται αν δεν άλλαξε
    },

    // ------------------------------------------------------------ λεπτομέρειες
    stored(key) {
      try { return localStorage.getItem(key); } catch (_) { return null; }
    },

    store(key, value) {
      try { localStorage.setItem(key, String(value)); } catch (_) { /* χωρίς αποθήκευση */ }
    },

    setFont(size) {
      this.fontSize = Math.max(10, Math.min(40, size));
      this.store('teacher.fontSize', this.fontSize);
      if (this.editor) this.editor.updateOptions({ fontSize: this.fontSize });
      this.showViewSettings();
    },

    setWrap(on) {
      this.wordWrap = on;
      this.store('teacher.wordWrap', on ? 'on' : 'off');
      if (this.editor) this.editor.updateOptions({ wordWrap: on ? 'on' : 'off' });
      this.showViewSettings();
    },

    showViewSettings() {
      $('#t-font-size').textContent = String(this.fontSize);
      $('#t-wrap').classList.toggle('on', this.wordWrap);
    },

    select(id) {
      this.selected = id;
      const s = id != null ? this.students.get(id) : null;
      $('#t-detail').hidden = !s;
      document.body.classList.toggle('detail-open', !!s);
      for (const [cid, card] of this.cards) card.el.classList.toggle('selected', cid === id);
      if (!s) return;
      if (!this.editor) {
        this.editor = this.monaco.editor.create($('#t-editor'), {
          ...ES().editorOptions({ theme: document.body.classList.contains('theme-dark') ? 'dark' : 'light', fontSize: this.fontSize, minimap: true, wordWrap: this.wordWrap }),
          readOnly: true,
          domReadOnly: true,
          model: this.monaco.editor.createModel('', ES().LANG),
        });
        this.deco = this.editor.createDecorationsCollection();
      }
      this.updateDetail(s, null, true);
    },

    updateDetail(s, prev, fresh) {
      $('#t-detail-name').textContent = `${s.name} · ${s.host}${s.online ? '' : ' (αποσυνδέθηκε)'}`;
      $('#t-detail-file').textContent = s.file || '';
      $('#t-detail-lower').hidden = !s.hand;
      const errs = $('#t-detail-errors');
      errs.textContent = '';
      for (const e of s.errors) errs.append(el('div', '', `✖ Γραμμή ${e.line}: ${e.message}`));
      const model = this.editor.getModel();
      if (model.getValue() !== s.text) {
        const top = this.editor.getScrollTop();
        model.setValue(s.text);
        if (!fresh) this.editor.setScrollTop(top);
      }
      const m = this.monaco;
      const decos = s.errors.filter((e) => e.line >= 1 && e.line <= model.getLineCount()).map((e) => ({
        range: new m.Range(e.line, 1, e.line, 1),
        options: { isWholeLine: true, className: 'error-line', glyphMarginClassName: 'error-glyph', glyphMarginHoverMessage: { value: e.message } },
      }));
      if (s.cursor && s.cursor.line <= model.getLineCount()) {
        const col = Math.min(s.cursor.column, model.getLineMaxColumn(s.cursor.line));
        decos.push({
          range: new m.Range(s.cursor.line, 1, s.cursor.line, 1),
          options: { isWholeLine: true, className: 'student-line' },
        }, {
          range: new m.Range(s.cursor.line, col, s.cursor.line, col),
          options: { beforeContentClassName: 'student-caret' },
        });
        // ακολουθεί τον μαθητή όταν αλλάζει γραμμή
        if (fresh || !prev || !prev.cursor || prev.cursor.line !== s.cursor.line) this.editor.revealLineInCenterIfOutsideViewport(s.cursor.line);
      }
      this.deco.set(decos);
    },
  };

  root.Teacher = Teacher;
})(typeof self !== 'undefined' ? self : this);
