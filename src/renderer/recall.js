/* Πάνελ «Θέλω να θυμηθώ»: οι βασικοί αλγόριθμοι και οι εντολές (περιεχόμενο στο recall.md). */
(function (root) {
  'use strict';

  /**
   * Διαβάζει το recall.md (η μορφή περιγράφεται στην αρχή του αρχείου) και επιστρέφει
   * [{ title, topics: [{ id, title, exams, tags, blocks: [{ type, ... }] }] }].
   */
  function parse(md) {
    const cats = [];
    let cat = null;
    let topic = null;
    let open = null;     // παράγραφος, λίστα ή πίνακας που συνεχίζεται στην επόμενη γραμμή
    let code = null;     // μπλοκ ``` σε εξέλιξη
    const lines = md.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
    const push = (b) => { open = null; if (topic) topic.blocks.push(b); return b; };

    for (const line of lines) {
      if (code) {
        if (/^```\s*$/.test(line)) { code.text = code.lines.join('\n'); delete code.lines; push(code); code = null; }
        else code.lines.push(line);
        continue;
      }
      let m;
      if ((m = /^```(\w*)/.exec(line))) {
        open = null;
        code = { type: m[1] === 'output' ? 'output' : 'code', lines: [] };
      } else if ((m = /^#\s+(.+)/.exec(line))) {
        cat = { title: m[1].trim(), topics: [] };
        cats.push(cat);
        topic = null;
        open = null;
      } else if ((m = /^##\s+(.+)/.exec(line))) {
        if (!cat) { cat = { title: '', topics: [] }; cats.push(cat); }
        topic = { id: `${cats.length}-${cat.topics.length + 1}`, title: m[1].trim(), exams: '', tags: '', blocks: [] };
        cat.topics.push(topic);
        open = null;
      } else if (!topic) {
        continue;
      } else if ((m = /^###\s+(.+)/.exec(line))) {
        push({ type: 'h', text: m[1].trim() });
      } else if ((m = /^@(exams|tags):\s*(.*)/.exec(line))) {
        topic[m[1]] = m[2].trim();
      } else if (!line.trim()) {
        open = null;
      } else if ((m = /^-\s+(.+)/.exec(line))) {
        if (!open || open.type !== 'list') open = push({ type: 'list', items: [] });
        open.items.push(m[1]);
      } else if ((m = /^([!>])\s+(.+)/.exec(line))) {
        push({ type: m[1] === '!' ? 'warn' : 'tip', text: m[2] });
      } else if (/^\|/.test(line)) {
        const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (cells.every((c) => /^:?-+:?$/.test(c))) continue;   // γραμμή |---|---| τύπου markdown
        if (!open || open.type !== 'table') open = push({ type: 'table', rows: [] });
        open.rows.push(cells);
      } else if (open && open.type === 'p') {
        open.text += ' ' + line.trim();
      } else {
        open = push({ type: 'p', text: line.trim() });
      }
    }
    return cats.filter((c) => c.topics.length);
  }

  /** Για αναζήτηση: πεζά, χωρίς τόνους, το τελικό ς ως σ. */
  function normalize(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
  }

  function topicText(t) {
    const parts = [t.title, t.tags, t.exams];
    for (const b of t.blocks) {
      if (b.text) parts.push(b.text);
      if (b.items) parts.push(...b.items);
      if (b.rows) parts.push(...b.rows.map((r) => r.join(' ')));
    }
    return normalize(parts.join(' \n '));
  }

  /** handlers: load() → Promise<md>, colorize(code) → Promise<html>, onInsert(code) */
  class RecallView {
    constructor(el, handlers) {
      this.el = el;
      this.h = handlers || {};
      this.cats = null;
      this.loading = null;
    }

    /** Φορτώνει το περιεχόμενο την πρώτη φορά που ανοίγει το πάνελ. */
    show() {
      if (this.cats || this.loading) return this.loading;
      this.el.innerHTML = '<div class="empty">Φόρτωση…</div>';
      this.loading = Promise.resolve(this.h.load()).then((md) => {
        this.cats = parse(md || '');
        this.render();
      }).catch((e) => {
        this.loading = null;
        this.el.innerHTML = `<div class="empty">Δεν ήταν δυνατό να φορτωθεί το περιεχόμενο. ${root.Panels.esc(e && e.message || '')}</div>`;
      });
      return this.loading;
    }

    render() {
      const { esc } = root.Panels;
      const n = this.cats.reduce((a, c) => a + c.topics.length, 0);
      this.el.innerHTML = `<div class="recall">
        <div class="rc-search"><input type="search" spellcheck="false" placeholder="Αναζήτηση σε ${n} θέματα (π.χ. μέγιστο, λίστα, while)…"></div>
        <div class="rc-list">${this.cats.map((c) => `
          <div class="rc-cat">
            <div class="rc-cat-title">${esc(c.title)}</div>
            ${c.topics.map((t) => `<details class="rc-topic" data-id="${t.id}">
              <summary><span class="rc-title">${esc(t.title)}</span>${t.exams ? `<span class="rc-exam-mark" title="Πανελλήνιες ΕΠΑΛ: ${esc(t.exams)}">Π</span>` : ''}</summary>
              <div class="rc-body"></div></details>`).join('')}
          </div>`).join('')}
          <div class="rc-none empty" hidden>Δεν βρέθηκε θέμα. Δοκίμασε άλλη λέξη.</div>
        </div></div>`;
      this.topics = new Map();
      for (const c of this.cats) for (const t of c.topics) this.topics.set(t.id, Object.assign(t, { search: topicText(t) }));

      this.el.querySelectorAll('details.rc-topic').forEach((d) => {
        d.addEventListener('toggle', () => {
          if (!d.open) return;
          this._fill(d);
          // ένα θέμα ανοιχτό κάθε φορά, για να μη χάνεται ο μαθητής σε στενό πάνελ
          this.el.querySelectorAll('details.rc-topic[open]').forEach((o) => { if (o !== d) o.open = false; });
          // ο τίτλος του θέματος στην κορυφή, κάτω από την αναζήτηση
          const search = this.el.querySelector('.rc-search');
          const top = d.getBoundingClientRect().top - this.el.getBoundingClientRect().top;
          this.el.scrollTop += top - search.offsetHeight;
        });
      });
      const input = this.el.querySelector('.rc-search input');
      input.addEventListener('input', () => this.filter(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { input.value = ''; this.filter(''); }
        if (e.key === 'Enter') {
          const first = this.el.querySelector('details.rc-topic:not([hidden])');
          if (first) first.open = true;
        }
      });
    }

    filter(q) {
      const words = normalize(q).split(/\s+/).filter(Boolean);
      let any = false;
      this.el.querySelectorAll('.rc-cat').forEach((c) => {
        let catAny = false;
        c.querySelectorAll('details.rc-topic').forEach((d) => {
          const t = this.topics.get(d.dataset.id);
          const ok = words.every((w) => t.search.includes(w));
          d.hidden = !ok;
          catAny = catAny || ok;
        });
        c.hidden = !catAny;
        any = any || catAny;
      });
      this.el.querySelector('.rc-none').hidden = any;
    }

    _fill(details) {
      const body = details.querySelector('.rc-body');
      if (body.dataset.filled) return;
      body.dataset.filled = '1';
      const t = this.topics.get(details.dataset.id);
      const { esc, mdInline } = root.Panels;
      const codes = [];
      const html = t.blocks.map((b) => {
        switch (b.type) {
          case 'h': return `<h4>${mdInline(b.text)}</h4>`;
          case 'p': return `<p>${mdInline(b.text)}</p>`;
          case 'list': return `<ul>${b.items.map((i) => `<li>${mdInline(i)}</li>`).join('')}</ul>`;
          case 'warn': return `<div class="rc-note warn"><span class="rc-icon">⚠</span><div>${mdInline(b.text)}</div></div>`;
          case 'tip': return `<div class="rc-note tip"><span class="rc-icon">💡</span><div>${mdInline(b.text)}</div></div>`;
          case 'table': {
            const [head, ...rows] = b.rows;
            return `<div class="rc-table"><table><thead><tr>${head.map((c) => `<th>${mdInline(c)}</th>`).join('')}</tr></thead>
              <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
          }
          case 'output': return `<div class="rc-output"><div class="rc-label">Στο Shell εμφανίζεται:</div><pre class="mono">${esc(b.text)}</pre></div>`;
          case 'code':
            codes.push(b.text);
            return `<div class="rc-code" data-i="${codes.length - 1}">
              <pre class="mono">${esc(b.text)}</pre>
              <div class="rc-tools">
                <button data-act="copy" title="Αντιγραφή του κώδικα">Αντιγραφή</button>
                <button data-act="insert" title="Εισαγωγή στον editor, στη θέση του κέρσορα">Στον editor</button>
              </div></div>`;
          default: return '';
        }
      }).join('');
      body.innerHTML = (t.exams ? `<div class="rc-exams">📝 Πανελλήνιες ΕΠΑΛ: <b>${esc(t.exams)}</b></div>` : '') + html;

      body.querySelectorAll('.rc-code').forEach((box) => {
        const text = codes[Number(box.dataset.i)];
        if (this.h.colorize) {
          Promise.resolve(this.h.colorize(text)).then((colored) => {
            if (colored) box.querySelector('pre').innerHTML = colored;
          }).catch(() => { /* μένει χωρίς χρώματα */ });
        }
        box.querySelector('[data-act="copy"]').addEventListener('click', (e) => this._copy(text, e.currentTarget));
        box.querySelector('[data-act="insert"]').addEventListener('click', () => this.h.onInsert && this.h.onInsert(text));
      });
    }

    async _copy(text, btn) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      btn.textContent = '✓ Αντιγράφηκε';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = 'Αντιγραφή'; }, 1500);
    }
  }

  root.Recall = { parse, normalize, RecallView };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Recall;
})(typeof self !== 'undefined' ? self : this);
