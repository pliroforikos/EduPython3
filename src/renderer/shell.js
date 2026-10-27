/* Shell τύπου Thonny: έξοδος προγράμματος, είσοδος μέσα στη ροή, REPL (>>>), links στα λάθη. */
(function (root) {
  'use strict';

  const MAX_NODES = 4000;
  // Όριο κειμένου στο Shell (≈ 3000 γραμμές). Με ατέρμονο print το Shell μάζευε δεκάδες εκατομμύρια
  // χαρακτήρες και όλη η εφαρμογή «κολλούσε», μαζί και η πληκτρολόγηση στον editor.
  const MAX_CHARS = 200000;
  const TB_LINE_RE = /^(\s*File ")(.+)(", line )(\d+)(.*)$/;

  class Shell {
    /**
     * handlers: onInput(text), onRepl(line), onLink(file, line), onInterrupt(), onHelp()
     */
    constructor(el, handlers) {
      this.el = el;
      this.h = handlers;
      this.edit = null;
      this.mode = 'idle';          // idle | running | repl
      this.waiting = false;        // το πρόγραμμα περιμένει τιμή (raw_input/input)
      this.atPrompt = false;
      this.lastChar = '\n';
      this.history = [];
      this.histIdx = 0;
      this.pasteQueue = [];
      this.chars = 0;              // χαρακτήρες εξόδου στο Shell (για το MAX_CHARS)
      this.trimNote = null;        // «… η παλαιότερη έξοδος αφαιρέθηκε»
      this.refocus = false;        // το Shell είχε το focus πριν σταματήσει το πρόγραμμα
      this.tap = null;             // tap(text, cls): ό,τι γράφεται στο Shell (null: καθάρισμα), για την παρουσίαση

      el.addEventListener('mouseup', () => {
        const sel = window.getSelection();
        if (this.edit && sel && sel.isCollapsed) this.focus();
      });
      el.addEventListener('keydown', (e) => {
        // πληκτρολόγηση οπουδήποτε στο Shell πηγαίνει στη γραμμή εισόδου
        if (this.edit && e.target !== this.edit && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
          this.focus();
        }
      });
    }

    // ------------------------------------------------------------- έξοδος
    _append(node) {
      if (this.edit && this.edit.parentNode === this.el) this.el.insertBefore(node, this.edit);
      else this.el.appendChild(node);
      this.chars += node.textContent.length;
    }

    /** Η παλαιότερη έξοδος φεύγει όταν ξεπεραστεί το όριο κόμβων ή χαρακτήρων. */
    _trim() {
      if (this.el.childNodes.length <= MAX_NODES && this.chars <= MAX_CHARS) return;
      if (!this.trimNote) {
        this.trimNote = document.createElement('span');
        this.trimNote.className = 'info';
        this.trimNote.textContent = '… η παλαιότερη έξοδος αφαιρέθηκε, για να μη βαραίνει το Shell\n';
        this.el.insertBefore(this.trimNote, this.el.firstChild);
      }
      while (this.el.childNodes.length > MAX_NODES || this.chars > MAX_CHARS) {
        const first = this.trimNote.nextSibling;
        if (!first || first === this.edit) break;
        const len = first.textContent.length;
        const excess = this.chars - MAX_CHARS / 2;
        if (this.chars > MAX_CHARS && len > excess && first.nodeType === 1 && !first.dataset.fixed) {
          // ένας μεγάλος κόμβος: κρατάμε μόνο το τέλος του
          first.textContent = first.textContent.slice(excess);
          this.chars -= excess;
          break;
        }
        this.el.removeChild(first);
        this.chars -= len;
      }
    }

    _scroll() {
      // μία κύλιση ανά καρέ, όσα μηνύματα κι αν έρθουν
      if (this.scrollPending) return;
      this.scrollPending = true;
      requestAnimationFrame(() => {
        this.scrollPending = false;
        this.el.scrollTop = this.el.scrollHeight;
      });
    }

    write(text, cls) {
      if (!text) return;
      cls = cls || 'out';
      if (text.length > MAX_CHARS) text = text.slice(-MAX_CHARS);
      const before = this.edit && this.edit.parentNode === this.el ? this.edit.previousSibling : this.el.lastChild;
      if (before && before.nodeType === 1 && before.className === cls && before !== this.trimNote &&
          !before.dataset.fixed && before.textContent.length < 20000) {
        before.textContent += text;
        this.chars += text.length;
      } else {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        this._append(span);
      }
      this.lastChar = text[text.length - 1];
      this.atPrompt = false;
      this._trim();
      this._scroll();
      if (this.tap) this.tap(text, cls);
    }

    _ensureNewline() {
      if (this.lastChar !== '\n') this.write('\n', 'out');
    }

    // ------------------------------------------------------------- είσοδος
    _ensureEdit() {
      if (this.edit) return;
      const ed = document.createElement('span');
      ed.className = 'shell-edit';
      ed.contentEditable = 'plaintext-only';
      ed.spellcheck = false;
      if (this.waiting) ed.classList.add('waiting');
      ed.addEventListener('keydown', (e) => this._onKey(e));
      ed.addEventListener('paste', (e) => this._onPaste(e));
      this.el.appendChild(ed);
      this.edit = ed;
    }

    _removeEdit() {
      if (this.edit) {
        this.edit.remove();
        this.edit = null;
      }
    }

    focus() {
      if (!this.edit) return;
      this.edit.focus();
      const range = document.createRange();
      range.selectNodeContents(this.edit);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    hasFocus() {
      return this.el.contains(document.activeElement);
    }

    _onKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._submit(this.edit.textContent);
        return;
      }
      if ((e.key === 'c' || e.key === 'C') && e.ctrlKey && !e.shiftKey) {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && this.mode === 'running') {
          e.preventDefault();
          this.h.onInterrupt();
        }
        return;
      }
      if (this.mode === 'repl' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (!this.history.length) return;
        e.preventDefault();
        this.histIdx += e.key === 'ArrowUp' ? -1 : 1;
        this.histIdx = Math.max(0, Math.min(this.history.length, this.histIdx));
        this.edit.textContent = this.history[this.histIdx] || '';
        this.focus();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '    ');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.edit.textContent = '';
      }
    }

    _onPaste(e) {
      e.preventDefault();
      const text = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n');
      const lines = text.split('\n');
      if (lines.length === 1) {
        document.execCommand('insertText', false, text);
        return;
      }
      if (lines[lines.length - 1] === '') lines.pop();
      const first = this.edit.textContent + lines.shift();
      this.pasteQueue.push(...lines);
      this._submit(first);
    }

    _submit(text) {
      const mode = this.mode;
      this._removeEdit();
      if (mode === 'repl') {
        this.write(text + '\n', 'repl-input');
        if (text.trim()) {
          if (this.history[this.history.length - 1] !== text) this.history.push(text);
        }
        this.histIdx = this.history.length;
        this.mode = 'running';
        this._ensureEdit();
        this.h.onRepl(text);
      } else if (mode === 'running') {
        this.waiting = false;
        this.write(text + '\n', 'user-input');
        this._ensureEdit();
        this.focus();
        this.h.onInput(text);
      }
    }

    _drainPaste(asMode) {
      if (!this.pasteQueue.length) return false;
      const line = this.pasteQueue.shift();
      this.mode = asMode;
      this._submit(line);
      return true;
    }

    // ------------------------------------------------------------- καταστάσεις
    beginRun(name) {
      const hadFocus = this.hasFocus() || this.refocus;
      this.refocus = false;
      this._removeEdit();
      this.pasteQueue = [];
      this.waiting = false;
      if (this.atPrompt) {
        this.write(`%Run ${name}\n`, 'command');
      } else {
        this._ensureNewline();
        this.write('>>> ', 'prompt');
        this.write(`%Run ${name}\n`, 'command');
      }
      this.mode = 'running';
      this._ensureEdit();
      if (hadFocus) this.focus();
    }

    requestInput() {
      this.mode = 'running';
      this.waiting = true;
      this.refocus = false;
      this._ensureEdit();
      this.edit.classList.add('waiting');
      if (this._drainPaste('running')) return;
      this.focus();
    }

    showPrompt(more) {
      const hadFocus = this.hasFocus() || this.refocus;
      this.refocus = false;
      this.waiting = false;
      this._removeEdit();
      this._ensureNewline();
      this.write(more ? '... ' : '>>> ', 'prompt');
      this.atPrompt = !more;
      this.mode = 'repl';
      this._ensureEdit();
      if (this._drainPaste('repl')) return;
      if (hadFocus) this.focus();
    }

    stopped(message) {
      // αν ο μαθητής έγραφε στο Shell, το focus ξαναγυρίζει εκεί μόλις εμφανιστεί το νέο >>>
      this.refocus = this.refocus || this.hasFocus();
      this.waiting = false;
      this._removeEdit();
      this.pasteQueue = [];
      this._ensureNewline();
      this.write(message + '\n', 'info');
      this.mode = 'idle';
    }

    info(message) {
      this._ensureNewline();
      this.write(message + '\n', 'info');
    }

    writeError(err, helpTitle) {
      this._ensureNewline();
      const lines = (err.traceback || `${err.exc_type}: ${err.message}`).split('\n');
      lines.forEach((line) => {
        const m = TB_LINE_RE.exec(line);
        if (m && !/^<.*>$/.test(m[2])) {
          const span = document.createElement('span');
          span.className = 'err';
          span.dataset.fixed = '1';
          span.appendChild(document.createTextNode(m[1]));
          const link = document.createElement('a');
          link.className = 'tb-link';
          link.textContent = m[2];
          link.title = 'Μετάβαση στη γραμμή ' + m[4];
          link.addEventListener('click', () => this.h.onLink(m[2], Number(m[4])));
          span.appendChild(link);
          span.appendChild(document.createTextNode(m[3]));
          const ln = document.createElement('a');
          ln.className = 'tb-link';
          ln.textContent = m[4];
          ln.addEventListener('click', () => this.h.onLink(m[2], Number(m[4])));
          span.appendChild(ln);
          span.appendChild(document.createTextNode(m[5] + '\n'));
          this._append(span);
          if (this.tap) this.tap(span.textContent, 'err');
        } else {
          this.write(line + '\n', 'err');
        }
      });
      if (helpTitle) {
        const hint = document.createElement('span');
        hint.className = 'hint';
        hint.dataset.fixed = '1';
        hint.textContent = `💡 ${helpTitle}`;
        hint.title = 'Δες την εξήγηση στον Βοηθό';
        hint.addEventListener('click', () => this.h.onHelp());
        this._append(hint);
        if (this.tap) this.tap(hint.textContent, 'hint');
        this.write('\n', 'out');
      }
      this.lastChar = '\n';
      this._scroll();
    }

    clear() {
      const prompt = this.atPrompt || this.mode === 'repl';
      const mode = this.mode;
      const hadFocus = this.hasFocus();
      if (this.tap) this.tap(null);
      this.el.textContent = '';
      this.edit = null;
      this.chars = 0;
      this.trimNote = null;
      this.lastChar = '\n';
      if (prompt && mode === 'repl') {
        this.showPrompt(false);
      } else if (mode === 'running') {
        this._ensureEdit();
      }
      if (hadFocus) this.focus();
    }
  }

  root.Shell = Shell;
})(typeof self !== 'undefined' ? self : this);
