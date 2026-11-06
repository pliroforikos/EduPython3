/* Πάνελ «Μεταβλητές» (με πίνακες για τις λίστες) και «Βοηθός». */
(function (root) {
  'use strict';

  const TYPE_GR = {
    int: 'ακέραιος', float: 'πραγματικός', str: 'συμβολοσειρά', bytes: 'δυαδικά δεδομένα',
    list: 'λίστα', tuple: 'πλειάδα', dict: 'λεξικό', bool: 'λογική', NoneType: 'κενή τιμή',
    set: 'σύνολο', range: 'εύρος', function: 'συνάρτηση', type: 'κλάση',
    builtin_function_or_method: 'συνάρτηση', method: 'μέθοδος',
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
  /** Κείμενο κελιού: οι τιμές μεγάλου μήκους κόβονται στην εμφάνιση (ολόκληρη τιμή στο tooltip). */
  const short = (t) => (t.length > 40 ? t.slice(0, 39) + '…' : t);

  /**
   * Εντοπίζει παράλληλες λίστες: λίστες με το ίδιο πλήθος στοιχείων, όπου η θέση i αφορά το ίδιο «αντικείμενο»
   * (π.χ. onomata[i] και vathmoi[i] είναι το όνομα και ο βαθμός του i-οστού μαθητή).
   *  - rows: απλές λίστες με N στοιχεία μαζί με λίστες-από-λίστες (πίνακες) με N γραμμές.
   *  - cols: πίνακας χωρίς παράλληλο στις γραμμές, αλλά με απλή λίστα ίση με τις στήλες του (επικεφαλίδες στηλών).
   */
  function findParallel(list) {
    const seqs = list.filter((v) => v.seq && v.seq.items && !v.seq.more && (v.type === 'list' || v.type === 'tuple'));
    const ones = seqs.filter((v) => !v.seq.grid && v.seq.items.length > 0);
    const twos = seqs.filter((v) => v.seq.grid);
    const groups = [];
    const used = new Set();
    const sizeOf = (v) => v.seq.items.length;
    const sizes = [...new Set([...ones.map(sizeOf), ...twos.map(sizeOf)])];
    for (const N of sizes) {
      const g1 = ones.filter((v) => sizeOf(v) === N);
      const g2 = twos.filter((v) => sizeOf(v) === N);
      if (g1.length + g2.length < 2) continue;
      groups.push({
        kind: 'rows',
        size: N,
        ones: g1,
        twos: g2.map((t) => {
          used.add(t.name);
          const C = t.seq.cols;
          // όταν οι στήλες είναι όσες και οι γραμμές, οι απλές λίστες θεωρούνται παράλληλες με τις γραμμές
          return { v: t, cols: C, colHeads: C === N ? [] : ones.filter((o) => sizeOf(o) === C) };
        }),
      });
    }
    for (const t of twos) {
      if (used.has(t.name)) continue;
      const heads = ones.filter((o) => sizeOf(o) === t.seq.cols);
      if (heads.length) groups.push({ kind: 'cols', v: t, rows: sizeOf(t), cols: t.seq.cols, colHeads: heads });
    }
    return groups;
  }

  class VariablesView {
    /** handlers: onGoto(line) — μετάβαση στη γραμμή ορισμού μιας συνάρτησης · parallelButton: κουμπί «Παράλληλες» */
    constructor(el, handlers) {
      this.el = el;
      this.h = handlers || {};
      this.prev = new Map();
      this.prevCells = new Map();
      this.selected = null;
      this.vars = [];
      this.last = null;
      this.parallel = false;
      try { this.parallel = !!root.localStorage && root.localStorage.getItem('py.varsParallel') === '1'; } catch (_) { /* χωρίς αποθήκευση */ }
      const btn = this.h.parallelButton;
      if (btn) {
        btn.classList.toggle('on', this.parallel);
        btn.addEventListener('click', () => this.setParallel(!this.parallel));
      }
      this.empty('Οι μεταβλητές του προγράμματος θα εμφανιστούν εδώ όταν το εκτελέσεις.');
    }

    /** Κουμπί «Παράλληλες»: οι παράλληλες λίστες η μία δίπλα στην άλλη, σε κάθετη διάταξη. */
    setParallel(on) {
      this.parallel = !!on;
      try { root.localStorage.setItem('py.varsParallel', this.parallel ? '1' : '0'); } catch (_) { /* χωρίς αποθήκευση */ }
      if (this.h.parallelButton) this.h.parallelButton.classList.toggle('on', this.parallel);
      if (this.last) {
        const prev = this.prev;
        this.update(this.last.vars, this.last.locals, this.last.func, true);
        this.prev = prev;
      }
    }

    empty(text) {
      this.vars = [];
      this.last = null;
      this.el.innerHTML = `<div class="empty">${esc(text)}</div>`;
    }

    reset() {
      this.prev = new Map();
      this.prevCells = new Map();
      this.selected = null;
    }

    _row(v) {
      const key = v.key || v.name;
      const changed = this.prev.size && this.prev.get(key) !== v.repr;
      const fn = v.kind === 'function';
      const gr = fn ? 'συνάρτηση' : (TYPE_GR[v.type] || '');
      return `<tr data-name="${esc(key)}" class="${fn ? 'fn' : ''} ${v.seq ? 'is-seq' : ''} ${changed ? 'changed' : ''} ${this.selected === key ? 'selected' : ''}">
          <td class="vname">${esc(v.name)}</td>
          <td class="vval" title="${esc(v.repr.slice(0, 800))}">${esc(v.repr)}</td>
          <td class="vtype" title="${esc(gr)}">${esc(v.type)}${gr ? `<span class="vtype-gr">${esc(gr)}</span>` : ''}</td>
        </tr>`;
    }

    /** locals/func: όσο τρέχει το πρόγραμμα, οι τοπικές μεταβλητές της συνάρτησης που εκτελείται. */
    update(vars, locals, func, redraw = false) {
      this.last = { vars, locals, func };
      const loc = (locals || []).map((v) => ({ ...v, key: `local:${v.name}` }));
      vars = loc.concat(vars);
      this.vars = vars;
      if (!vars.length) {
        const last = this.last;
        this.empty('Δεν υπάρχουν μεταβλητές.');
        this.last = last;
        this.prev = new Map();
        return;
      }
      // πρώτα οι τοπικές (όταν εκτελείται συνάρτηση), μετά τα δεδομένα, μετά οι συναρτήσεις σε δική τους ομάδα
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
      const cells = new Map();
      const par = this.parallel ? this._parallel(cells, redraw) : '';
      this.el.innerHTML = `${par}<table class="vars"><thead><tr><th>Όνομα</th><th>Τιμή</th><th>Τύπος</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="vdetail"></div>`;
      this.prev = new Map(vars.map((v) => [v.key || v.name, v.repr]));
      if (this.parallel) this.prevCells = cells;
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

    // ------------------------------------------------------------ παράλληλες λίστες
    /** Ένα κελί: η τιμή, φωτισμένη αν άλλαξε από το προηγούμενο βήμα. */
    _cell(cells, key, text, redraw) {
      const changed = !redraw && this.prevCells.has(key) && this.prevCells.get(key) !== text;
      cells.set(key, text);
      return `<td class="${changed ? 'chg' : ''}" title="${esc(text.slice(0, 300))}">${esc(short(text))}</td>`;
    }

    /** Ακέραιες μεταβλητές με τιμή μια θέση 0…N-1: δείχνουν σε ποια γραμμή «βρίσκεται» π.χ. το i. */
    _pointers(N) {
      const map = new Map();
      for (const v of this.vars) {
        if (v.kind === 'function' || !/^int$/.test(v.type) || !/^-?\d+$/.test(v.repr)) continue;
        const n = Number(v.repr);
        if (n < 0 || n >= N) continue;
        if (!map.has(n)) map.set(n, []);
        map.get(n).push(v.name);
      }
      return map;
    }

    _parallel(cells, redraw) {
      const lists = this.vars.filter((v) => v.seq);
      if (!lists.length) return '';
      const byName = new Map();
      for (const v of lists) if (!byName.has(v.name) || v.key) byName.set(v.name, v);   // οι τοπικές πάνε πάνω από τις καθολικές
      const groups = findParallel([...byName.values()]);
      if (!groups.length) {
        return `<div class="par-box par-none">Δεν υπάρχουν παράλληλες λίστες. Παράλληλες είναι λίστες με <b>το ίδιο πλήθος στοιχείων</b>,
          όπου η ίδια θέση αφορά το ίδιο στοιχείο: π.χ. <code>onomata</code> και <code>vathmoi</code> με 30 στοιχεία η καθεμία
          (το <code>onomata[i]</code> και το <code>vathmoi[i]</code> είναι του ίδιου μαθητή).</div>`;
      }
      let html = `<div class="par-box"><div class="par-hint">Η ίδια θέση <b>i</b> σε όλες τις λίστες αφορά το ίδιο στοιχείο
        (π.χ. onomata[i] και vathmoi[i]: όνομα και βαθμός του ίδιου μαθητή). Η πρώτη θέση είναι το <b>0</b>.
        Με <span class="par-ptr">← i</span> φαίνεται πού δείχνουν τώρα οι ακέραιες μεταβλητές.</div>`;
      for (const g of groups) html += g.kind === 'rows' ? this._rowsGroup(g, cells, redraw) : this._colsGroup(g, cells, redraw);
      return html + '</div>';
    }

    _rowsGroup(g, cells, redraw) {
      const N = g.size;
      const ptr = this._pointers(N);
      const hasTwo = g.twos.length > 0;
      const title = [...g.ones.map((v) => `${v.name}[${N}]`), ...g.twos.map((t) => `${t.v.name}[${N}][${t.cols}]`)].join(', ');

      // επικεφαλίδες: ονόματα λιστών, αριθμοί στηλών των πινάκων, και τιμές απλών λιστών «πάνω από τις στήλες»
      let head = `<tr><th class="par-idx">θέση i</th>${g.ones.map((v) => `<th>${esc(v.name)}[i]</th>`).join('')}`;
      head += g.twos.map((t) => `<th colspan="${t.cols}" class="par-2d">${esc(t.v.name)}[i][j]</th>`).join('') + '</tr>';
      if (hasTwo) {
        head += `<tr class="par-sub"><th class="par-idx">j</th>${g.ones.map(() => '<th></th>').join('')}`;
        head += g.twos.map((t) => Array.from({ length: t.cols }, (_, j) => `<th class="${j === 0 ? 'par-2d' : ''}">${j}</th>`).join('')).join('') + '</tr>';
        const headNames = [...new Set(g.twos.flatMap((t) => t.colHeads.map((h) => h.name)))];
        for (const hn of headNames) {
          head += `<tr class="par-colhead"><th class="par-idx">${esc(hn)}[j]</th>${g.ones.map(() => '<th></th>').join('')}`;
          head += g.twos.map((t) => {
            const h = t.colHeads.find((x) => x.name === hn);
            return Array.from({ length: t.cols }, (_, j) =>
              `<th class="${j === 0 ? 'par-2d' : ''}">${h ? esc(short(h.seq.items[j])) : ''}</th>`).join('');
          }).join('') + '</tr>';
        }
      }

      let body = '';
      for (let i = 0; i < N; i++) {
        const p = ptr.get(i);
        body += `<tr class="${p ? 'ptr' : ''}"><th class="par-idx">${i}${p ? ` <span class="par-ptr">← ${esc(p.join(', '))}</span>` : ''}</th>`;
        for (const v of g.ones) body += this._cell(cells, `${v.name}|${i}`, v.seq.items[i], redraw);
        for (const t of g.twos) {
          const row = t.v.seq.grid[i] || [];
          for (let j = 0; j < t.cols; j++) {
            body += this._cell(cells, `${t.v.name}|${i}|${j}`, row[j] === undefined ? '' : row[j], redraw)
              .replace('<td class="', j === 0 ? '<td class="par-2d ' : '<td class="');
          }
        }
        body += '</tr>';
      }
      return `<div class="par-group"><div class="par-title">Παράλληλες με ${N} στοιχεία: <b>${esc(title)}</b></div>
        <div class="par-scroll"><table class="par-table"><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
    }

    /** Πίνακας (λίστα από λίστες) με απλές λίστες παράλληλες στις στήλες του (π.χ. mathimata[4] και vathmoi[30][4]). */
    _colsGroup(g, cells, redraw) {
      const ptr = this._pointers(g.rows);
      let head = `<tr><th class="par-idx">i \\ j</th>${Array.from({ length: g.cols }, (_, j) => `<th>${j}</th>`).join('')}</tr>`;
      for (const h of g.colHeads) {
        head += `<tr class="par-colhead"><th class="par-idx">${esc(h.name)}[j]</th>${h.seq.items.map((x) => `<th>${esc(short(x))}</th>`).join('')}</tr>`;
      }
      let body = '';
      for (let i = 0; i < g.rows; i++) {
        const p = ptr.get(i);
        const row = g.v.seq.grid[i] || [];
        body += `<tr class="${p ? 'ptr' : ''}"><th class="par-idx">${i}${p ? ` <span class="par-ptr">← ${esc(p.join(', '))}</span>` : ''}</th>`;
        for (let j = 0; j < g.cols; j++) body += this._cell(cells, `${g.v.name}|${i}|${j}`, row[j] === undefined ? '' : row[j], redraw);
        body += '</tr>';
      }
      return `<div class="par-group"><div class="par-title">Παράλληλες στις στήλες: <b>${esc(g.colHeads.map((h) => `${h.name}[${g.cols}]`).join(', '))}</b> με τις στήλες του <b>${esc(g.v.name)}[${g.rows}][${g.cols}]</b></div>
        <div class="par-scroll"><table class="par-table"><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
    }

    // ------------------------------------------------------------ λεπτομέρεια μιας μεταβλητής
    /** Τα στοιχεία μιας λίστας/πλειάδας/λεξικού/συνόλου ως πίνακας. */
    _seqTable(v) {
      const q = v.seq;
      const shown = (q.items || q.pairs).length;
      const more = q.more ? `<div class="vlen">Εμφανίζονται τα πρώτα ${shown} από ${v.len} στοιχεία.</div>` : '';
      if (q.pairs) {
        const rows = q.pairs.map(([k, x]) => `<tr><td class="arr-idx" title="${esc(k)}">${esc(short(k))}</td><td class="arr-val" title="${esc(x)}">${esc(short(x))}</td></tr>`).join('');
        return `<table class="arr-table"><thead><tr><th>Κλειδί</th><th>Τιμή</th></tr></thead><tbody>${rows}</tbody></table>${more}`;
      }
      if (q.grid) {
        let t = '<div class="par-scroll"><table class="matrix-table"><thead><tr><th>i \\ j</th>';
        for (let j = 0; j < q.cols; j++) t += `<th>${j}</th>`;
        t += '</tr></thead><tbody>';
        q.grid.forEach((row, i) => {
          t += `<tr><th>${i}</th>`;
          for (let j = 0; j < q.cols; j++) {
            t += row[j] === undefined ? '<td class="unset"></td>' : `<td title="${esc(row[j])}">${esc(short(row[j]))}</td>`;
          }
          t += '</tr>';
        });
        return t + `</tbody></table></div>${more}`;
      }
      const isSet = v.type === 'set' || v.type === 'frozenset';
      const items = q.items;
      if (!isSet && items.length <= 12) {
        // λίγα στοιχεία: οριζόντια, όπως στα βιβλία: θέσεις πάνω, τιμές κάτω
        return `<div class="par-scroll"><table class="arr-table arr-h"><tbody>
          <tr><th>θέση</th>${items.map((_, i) => `<td class="arr-idx">${i}</td>`).join('')}</tr>
          <tr><th>τιμή</th>${items.map((x) => `<td class="arr-val" title="${esc(x)}">${esc(short(x))}</td>`).join('')}</tr>
          </tbody></table></div>${more}`;
      }
      const rows = items.map((x, i) => `<tr><td class="arr-idx">${isSet ? '·' : i}</td><td class="arr-val" title="${esc(x)}">${esc(short(x))}</td></tr>`).join('');
      return `<table class="arr-table"><thead><tr><th>${isSet ? '' : 'Θέση'}</th><th>Τιμή</th></tr></thead><tbody>${rows}</tbody></table>${more}`;
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
      const kind = v.seq && v.seq.grid
        ? `πίνακας ${v.len}×${v.seq.cols} (λίστα από λίστες)`
        : `${esc(v.type)}${TYPE_GR[v.type] ? ' · ' + esc(TYPE_GR[v.type]) : ''}`;
      box.innerHTML = `<div class="vdetail-head"><b>${esc(v.name)}</b> <span>${kind}</span> ${len}</div>
        ${v.seq ? this._seqTable(v) : ''}
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
          <li>Όταν το πρόγραμμα ζητά τιμή (<code>input()</code>), γράψ' τη στο Shell και πάτα <kbd>Enter</kbd>.</li>
          <li>Μετά την εκτέλεση μπορείς να γράψεις εντολές στο <code>&gt;&gt;&gt;</code> του Shell.</li>
        </ul></div>`;
    }

    success() {
      this.el.innerHTML = `<div class="assist ok">
        <h3>✅ Το πρόγραμμα ολοκληρώθηκε χωρίς λάθη</h3>
        <p>Έλεγξε ότι τα αποτελέσματα στο Shell είναι αυτά που περίμενες. Ένα πρόγραμμα μπορεί να τρέχει χωρίς λάθη
        αλλά να έχει <b>λογικό λάθος</b>.</p>
        <p class="muted">Συμβουλή: στην Python 3 η διαίρεση <code>/</code> δίνει πάντα δεκαδικό (<code>7 / 2</code> → <code>3.5</code>).
        Για ακέραια διαίρεση χρησιμοποίησε <code>//</code> (<code>7 // 2</code> → <code>3</code>).</p></div>`;
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

  root.Panels = { VariablesView, AssistantView, esc, mdInline, findParallel };
})(typeof self !== 'undefined' ? self : this);
