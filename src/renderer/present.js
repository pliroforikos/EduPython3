/* Παρουσίαση του καθηγητή στον υπολογιστή του μαθητή: ο κώδικάς του ζωντανά και η έξοδος του Shell του. */
(function (root) {
  'use strict';

  function stored(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function store(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* χωρίς αποθήκευση */ }
  }

  class PresentView {
    /**
     * el: το #present-panel.
     * opts: monaco, editorOptions() (οι επιλογές του editor της εφαρμογής), baseFont() (το μέγεθος γραμμάτων των ρυθμίσεων),
     *       onCopy(text, file), onChange({ on, visible, locked, copy, file })
     */
    constructor(el, opts) {
      this.el = el;
      this.o = opts;
      this.monaco = opts.monaco;
      this.state = { on: false };
      this.visible = false;
      this.editor = null;
      this.lastView = null;
      this.q = (s) => el.querySelector(s);
      this.shell = new root.Shell(this.q('#pr-shell'), {});
      this.fontSize = Number(stored('present.fontSize')) || 0;   // 0: όπως ο editor της εφαρμογής

      this.q('#pr-hide').addEventListener('click', () => this.show(false));
      this.q('#pr-copy').addEventListener('click', () => this.copyToTab());
      this.q('#pr-font-down').addEventListener('click', () => this.setFont(this.font() - 1));
      this.q('#pr-font-up').addEventListener('click', () => this.setFont(this.font() + 1));
      this.q('#pr-font-size').addEventListener('click', () => this.setFont(0));
      this.q('#pr-editor').addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        this.setFont(this.font() + (e.deltaY < 0 ? 1 : -1));
      }, { capture: true, passive: false });
      // Όταν ο καθηγητής δεν επιτρέπει την αντιγραφή: τίποτα από το πάνελ στο πρόχειρο.
      for (const ev of ['copy', 'cut']) {
        el.addEventListener(ev, (e) => {
          if (this.state.copy !== false) return;
          e.preventDefault();
          e.stopPropagation();
        }, true);
      }
      el.addEventListener('contextmenu', (e) => { if (this.state.copy === false) e.preventDefault(); }, true);
      this.showFont();
    }

    font() { return this.fontSize || this.o.baseFont(); }

    ensureEditor() {
      if (this.editor) return;
      const m = this.monaco;
      this.model = m.editor.createModel('', root.EditorSetup.LANG, m.Uri.parse('inmemory://present/teacher.py'));
      this.editor = m.editor.create(this.q('#pr-editor'), {
        ...this.o.editorOptions(),
        fontSize: this.font(),
        model: this.model,
        readOnly: true,
        domReadOnly: true,
        dragAndDrop: false,
        minimap: { enabled: false },
        renderLineHighlight: 'none',
        occurrencesHighlight: 'off',
        selectionHighlight: false,
      });
      this.deco = this.editor.createDecorationsCollection();
      // Ctrl+C / Ctrl+X / Ctrl+Insert χωρίς αποτέλεσμα όσο η αντιγραφή δεν επιτρέπεται
      this.noCopy = this.editor.createContextKey('presentNoCopy', false);
      const K = m.KeyCode;
      const C = m.KeyMod.CtrlCmd;
      for (const kb of [C | K.KeyC, C | K.KeyX, C | K.Insert]) this.editor.addCommand(kb, () => {}, 'presentNoCopy');
    }

    /** Μήνυμα present του καθηγητή (μερική ενημέρωση: ό,τι λείπει δεν άλλαξε). */
    update(p) {
      if (!p.on) { this.end(); return; }
      const starting = !this.state.on;
      if (starting) {
        this.state = { on: true, file: '', locked: false, copy: true };
        this.lastView = null;
        this.shell.clear();
      }
      const wasLocked = this.state.locked;
      if ('file' in p) this.state.file = p.file;
      if ('locked' in p) this.state.locked = p.locked;
      if ('copy' in p) this.state.copy = p.copy;
      this.ensureEditor();
      const textChanged = typeof p.text === 'string' && this.model.getValue() !== p.text;
      if (textChanged) this.model.setValue(p.text);
      if (p.view || textChanged) this.renderView(p.view || this.lastView, textChanged);

      this.q('#pr-file').textContent = this.state.file || '';
      this.q('#pr-lock').hidden = !this.state.locked;
      this.q('#pr-hide').disabled = this.state.locked;
      this.q('#pr-copy').hidden = !this.state.copy;
      this.noCopy.set(!this.state.copy);
      this.editor.updateOptions({ contextmenu: this.state.copy });
      if (starting || (this.state.locked && !wasLocked)) this.show(true);
      else this.changed();
    }

    /** Κέρσορας, επιλογές και γραμμή εκτέλεσης του καθηγητή· η προβολή ακολουθεί τη δική του κύλιση. */
    renderView(view, textChanged) {
      if (!view) return;
      const m = this.monaco;
      const n = this.model.getLineCount();
      const ok = (line) => line >= 1 && line <= n;
      const decos = [];
      for (const [sl, sc, el, ec] of view.sel || []) {
        if (ok(sl) && ok(el)) decos.push({ range: new m.Range(sl, sc, el, ec), options: { className: 'present-sel' } });
      }
      if (view.exec && ok(view.exec)) {
        decos.push({ range: new m.Range(view.exec, 1, view.exec, 1), options: { isWholeLine: true, className: 'exec-line', glyphMarginClassName: 'exec-glyph' } });
      }
      const cur = view.cursor;
      if (cur && ok(cur.line)) {
        const col = Math.min(cur.column, this.model.getLineMaxColumn(cur.line));
        decos.push(
          { range: new m.Range(cur.line, 1, cur.line, 1), options: { isWholeLine: true, className: 'present-line' } },
          { range: new m.Range(cur.line, col, cur.line, col), options: { beforeContentClassName: 'present-caret' } },
        );
      }
      this.deco.set(decos);

      const prev = this.lastView;
      this.lastView = view;
      if (textChanged || !prev || prev.top !== view.top) this.editor.setScrollTop(this.editor.getTopForLineNumber(view.top || 1));
      // το παράθυρο του μαθητή μπορεί να είναι μικρότερο από του καθηγητή
      const focus = view.exec || (cur && cur.line);
      if (focus && ok(focus)) this.editor.revealLineInCenterIfOutsideViewport(focus);
    }

    /** Έξοδος του Shell του καθηγητή. */
    output(o) {
      if (!this.state.on) return;
      if (o.clear) { this.shell.clear(); return; }
      for (const [cls, text] of o.chunks || []) this.shell.write(text, cls);
    }

    end() {
      if (!this.state.on) return;
      this.state = { on: false };
      this.lastView = null;
      this.q('#pr-lock').hidden = true;
      this.q('#pr-hide').disabled = false;
      this.show(false);
    }

    show(visible) {
      if (!visible && this.state.locked) return;
      this.visible = !!visible && this.state.on;
      this.el.hidden = !this.visible;
      if (this.visible) {
        this.ensureEditor();
        this.editor.layout();
        if (this.state.locked) this.editor.focus();
      }
      this.changed();
    }

    status() {
      return { on: !!this.state.on, visible: this.visible, locked: !!this.state.locked, copy: this.state.copy !== false, file: this.state.file || '' };
    }

    changed() { this.o.onChange(this.status()); }

    copyToTab() {
      if (!this.state.on || !this.state.copy || !this.model) return;
      this.o.onCopy(this.model.getValue(), this.state.file);
    }

    /** 0: το μέγεθος των ρυθμίσεων. */
    setFont(size) {
      const base = this.o.baseFont();
      this.fontSize = size ? Math.max(10, Math.min(40, size)) : 0;
      if (this.fontSize === base) this.fontSize = 0;
      store('present.fontSize', this.fontSize);
      this.showFont();
    }

    showFont() {
      const size = this.font();
      this.q('#pr-font-size').textContent = String(size);
      this.q('#pr-shell').style.fontSize = `${Math.max(10, size - 1)}px`;
      if (this.editor) this.editor.updateOptions({ fontSize: size });
    }
  }

  root.Present = { PresentView };
})(typeof self !== 'undefined' ? self : this);
