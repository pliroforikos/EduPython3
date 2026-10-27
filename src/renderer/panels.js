/* Πάνελ «Μεταβλητές» και «Βοηθός». */
(function (root) {
  'use strict';

  const TYPE_GR = {
    int: 'ακέραιος', long: 'ακέραιος', float: 'πραγματικός', str: 'συμβολοσειρά', unicode: 'συμβολοσειρά',
    list: 'λίστα', tuple: 'πλειάδα', dict: 'λεξικό', bool: 'λογική', NoneType: 'κενή τιμή', set: 'σύνολο',
    function: 'συνάρτηση', classobj: 'κλάση', type: 'κλάση', instance: 'αντικείμενο', file: 'αρχείο',
    builtin_function_or_method: 'συνάρτηση', instancemethod: 'μέθοδος',
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Μικρό markdown: `κώδικας`, **έντονα**, αλλαγές γραμμής. */
  function mdInline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ------------------------------------------------------------------ Μεταβλητές
  class VariablesView {
    /** handlers: onGoto(line) — μετάβαση στη γραμμή ορισμού μιας συνάρτησης */
    constructor(el, handlers) {
      this.el = el;
      this.h = handlers || {};
      this.prev = new Map();
      this.selected = null;
      this.vars = [];
      this.empty('Οι μεταβλητές του προγράμματος θα εμφανιστούν εδώ μετά την εκτέλεση.');
    }

    empty(text) {
      this.vars = [];
      this.el.innerHTML = `<div class="empty">${esc(text)}</div>`;
    }

    reset() {
      this.prev = new Map();
      this.selected = null;
    }

    _row(v) {
      const key = v.key || v.name;
      const changed = this.prev.size && this.prev.get(key) !== v.repr;
      const fn = v.kind === 'function';
      const gr = fn ? 'συνάρτηση' : (TYPE_GR[v.type] || '');
      return `<tr data-name="${esc(key)}" class="${fn ? 'fn' : ''} ${changed ? 'changed' : ''} ${this.selected === key ? 'selected' : ''}">
          <td class="vname">${esc(v.name)}</td>
          <td class="vval" title="${esc(v.repr.slice(0, 800))}">${esc(v.repr)}</td>
          <td class="vtype" title="${esc(gr)}">${esc(v.type)}${gr ? `<span class="vtype-gr">${esc(gr)}</span>` : ''}</td>
        </tr>`;
    }

    /** locals/func: κατά την εκτέλεση βήμα-βήμα, οι τοπικές μεταβλητές της συνάρτησης που εκτελείται. */
    update(vars, locals, func) {
      const loc = (locals || []).map((v) => ({ ...v, key: `local:${v.name}` }));
      vars = loc.concat(vars);
      this.vars = vars;
      if (!vars.length) {
        this.empty('Δεν υπάρχουν μεταβλητές.');
        this.prev = new Map();
        return;
      }
      // πρώτα οι τοπικές (βήμα-βήμα), μετά τα δεδομένα, μετά οι συναρτήσεις σε δική τους ομάδα
      const glob = vars.filter((v) => !v.key);
      const data = glob.filter((v) => v.kind !== 'function');
      const funcs = glob.filter((v) => v.kind === 'function');
      let rows = '';
      if (locals) {
        rows += `<tr class="group local"><td colspan="3">Μέσα στη συνάρτηση ${esc(func || '')}()</td></tr>` +
          (loc.length ? loc.map((v) => this._row(v)).join('') : '<tr class="group"><td colspan="3">(καμία τοπική μεταβλητή)</td></tr>');
        rows += `<tr class="group"><td colspan="3">Καθολικές μεταβλητές</td></tr>`;
      }
      rows += data.map((v) => this._row(v)).join('');
      if (funcs.length) {
        rows += `<tr class="group"><td colspan="3">Συναρτήσεις</td></tr>` + funcs.map((v) => this._row(v)).join('');
      }
      this.el.innerHTML = `<table class="vars"><thead><tr><th>Όνομα</th><th>Τιμή</th><th>Τύπος</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="vdetail"></div>`;
      this.prev = new Map(vars.map((v) => [v.key || v.name, v.repr]));
      this.el.querySelectorAll('tbody tr[data-name]').forEach((tr) => {
        tr.addEventListener('click', () => {
          this.selected = tr.dataset.name;
          this.el.querySelectorAll('tr.selected').forEach((x) => x.classList.remove('selected'));
          tr.classList.add('selected');
          this._detail();
        });
      });
      this._detail();
    }

    _detail() {
      const box = this.el.querySelector('.vdetail');
      const v = this.vars.find((x) => (x.key || x.name) === this.selected);
      if (!box) return;
      if (!v) { box.innerHTML = ''; return; }
      if (v.kind === 'function') {
        box.innerHTML = `<div class="vdetail-head"><b>${esc(v.name)}</b> <span>συνάρτηση</span></div>
          <div class="vfn-label">Καλείται έτσι:</div><pre>${esc(v.repr)}</pre>
          ${v.doc ? `<div class="vfn-doc">${esc(v.doc)}</div>` : ''}
          ${v.line ? `<button class="vfn-goto" data-line="${v.line}">↪ Ορίζεται στη γραμμή ${v.line}</button>` : ''}`;
        const btn = box.querySelector('.vfn-goto');
        if (btn && this.h.onGoto) btn.addEventListener('click', () => this.h.onGoto(Number(btn.dataset.line)));
        return;
      }
      const len = v.len != null ? `<span class="vlen">πλήθος στοιχείων: ${v.len}</span>` : '';
      box.innerHTML = `<div class="vdetail-head"><b>${esc(v.name)}</b> <span>${esc(v.type)}${TYPE_GR[v.type] ? ' · ' + esc(TYPE_GR[v.type]) : ''}</span> ${len}</div>
        <pre>${esc(v.repr)}</pre>`;
    }
  }

  // ------------------------------------------------------------------ Βοηθός
  class AssistantView {
    constructor(el, handlers) {
      this.el = el;
      this.h = handlers;
      this.welcome();
    }

    welcome() {
      this.el.innerHTML = `<div class="assist welcome">
        <h3>👋 Καλώς ήρθες!</h3>
        <p>Γράψε το πρόγραμμά σου στον editor και πάτησε <kbd>F5</kbd> ή το πράσινο κουμπί <b>Εκτέλεση</b>.</p>
        <p>Αν κάτι πάει στραβά, εδώ θα δεις <b>τι σημαίνει το λάθος</b> και <b>πώς να το διορθώσεις</b>.</p>
        <ul>
          <li>Η έξοδος και η είσοδος του προγράμματος εμφανίζονται στο <b>Shell</b> (κάτω).</li>
          <li>Όταν το πρόγραμμα ζητά τιμή (<code>raw_input</code>), γράψ' τη στο Shell και πάτα <kbd>Enter</kbd>.</li>
          <li>Μετά την εκτέλεση μπορείς να γράψεις εντολές στο <code>&gt;&gt;&gt;</code> του Shell.</li>
        </ul></div>`;
    }

    success() {
      this.el.innerHTML = `<div class="assist ok">
        <h3>✅ Το πρόγραμμα ολοκληρώθηκε χωρίς λάθη</h3>
        <p>Έλεγξε ότι τα αποτελέσματα στο Shell είναι αυτά που περίμενες. Ένα πρόγραμμα μπορεί να τρέχει χωρίς λάθη
        αλλά να έχει <b>λογικό λάθος</b>.</p>
        <p class="muted">Συμβουλή: στην Python 2 η διαίρεση ακεραίων δίνει ακέραιο: <code>7 / 2</code> → <code>3</code>.
        Για δεκαδικό αποτέλεσμα γράψε <code>7 / 2.0</code> ή <code>float(7) / 2</code>.</p></div>`;
    }

    _example(ex) {
      if (!ex) return '';
      return `<div class="ex">
        <div class="ex-col bad"><div class="ex-label">✗ Λάθος</div><pre>${esc(ex.bad)}</pre></div>
        <div class="ex-col good"><div class="ex-label">✓ Σωστό</div><pre>${esc(ex.good)}</pre></div></div>`;
    }

    show(help, err) {
      const kind = help.kind || 'error';
      const lineNo = help.line || (err && err.location && err.location.lineno);
      const original = err ? `${err.exc_type}${err.message ? ': ' + err.message : ''}` : '';
      this.el.innerHTML = `<div class="assist ${kind}">
        <h3>${kind === 'error' ? '❗' : 'ℹ️'} ${mdInline(help.title)}</h3>
        ${original ? `<div class="orig"><code>${esc(original)}</code>${help.translation ? `<div class="tr">≈ ${esc(help.translation)}</div>` : ''}</div>` : ''}
        ${lineNo && err ? `<button class="goto" data-line="${lineNo}">↪ Πήγαινε στη γραμμή ${lineNo}</button>` : ''}
        <h4>Τι σημαίνει</h4><p>${mdInline(help.what)}</p>
        ${help.tips && help.tips.length ? `<h4>Τι να δοκιμάσεις</h4><ul>${help.tips.map((t) => `<li>${mdInline(t)}</li>`).join('')}</ul>` : ''}
        ${this._example(help.example)}
      </div>`;
      const btn = this.el.querySelector('.goto');
      if (btn) btn.addEventListener('click', () => this.h.onGoto(Number(btn.dataset.line), err));
    }
  }

  root.Panels = { VariablesView, AssistantView, esc, mdInline };
})(typeof self !== 'undefined' ? self : this);
