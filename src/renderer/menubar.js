/*
 * Γραμμή μενού και πτυσσόμενα μενού που σχεδιάζει η ίδια η σελίδα (Windows και Linux), ώστε να παίρνουν τα χρώματα της
 * κεφαλίδας, όπως στο Android Studio. Τα στοιχεία (ετικέτες, συντομεύσεις, ✓) έρχονται έτοιμα από την κύρια διεργασία
 * (src/main/menuData.js)· όταν επιλεγεί κάτι, ζητάμε από εκεί να εκτελεστεί, και έτσι οι εντολές είναι οι ίδιες με το
 * κανονικό μενού.
 *
 * Το πληκτρολόγιο (βέλη, Enter, Esc) δουλεύει όπως στα κανονικά μενού. Τα κλικ στο μενού δεν παίρνουν την εστίαση από τον
 * editor, ώστε οι εντολές Αποκοπή/Αντιγραφή/Επικόλληση να δρουν στο σωστό σημείο.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MenuBar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OPEN_DELAY = 140; // ms πριν ανοίξει υπομενού όταν περνάει το ποντίκι από πάνω

  /** Το επόμενο στοιχείο που μπορεί να επιλεγεί (όχι διαχωριστικό ή ανενεργό), από τη θέση `from` προς `dir` (±1), με κύκλο. */
  function nextSelectable(items, from, dir) {
    const n = items.length;
    if (!n) return -1;
    let i = from;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (items[i].type !== 'separator' && items[i].enabled !== false) return i;
    }
    return -1;
  }

  class MenuBar {
    /**
     * @param {HTMLElement} bar  το στοιχείο που θα γεμίσει με τα κουμπιά της πάνω γραμμής
     * @param {{menu: () => Promise<any[]>, invoke: (path: number[]) => void}} source  η πηγή των στοιχείων
     */
    constructor(bar, source) {
      this.bar = bar;
      this.source = source;
      this.top = [];        // [{label, mnemonic}] της πάνω γραμμής
      this.buttons = [];
      this.data = [];       // πλήρες δέντρο του μενού τη στιγμή που άνοιξε
      this.index = -1;      // ποιο μενού της πάνω γραμμής είναι ανοιχτό
      this.levels = [];     // ανοιχτά επίπεδα: [{ el, path, items, active }]
      this.timer = null;
      this._bound = false;
    }

    async load() {
      let data = [];
      try { data = (await this.source.menu()) || []; } catch (_) { data = []; }
      this.top = data.map((m) => ({ label: m.label, mnemonic: (m.mnemonic || '').toLowerCase() }));
      this.bar.textContent = '';
      this.buttons = this.top.map((t, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = t.label;
        b.setAttribute('aria-haspopup', 'menu');
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => (this.index === i ? this.close() : this.open(i)));
        b.addEventListener('mouseenter', () => { if (this.isOpen && this.index !== i) this.open(i); });
        this.bar.appendChild(b);
        return b;
      });
      this.bind();
    }

    get isOpen() { return this.index >= 0; }

    bind() {
      if (this._bound) return;
      this._bound = true;
      // Κλικ έξω από το μενού το κλείνει
      document.addEventListener('mousedown', (e) => {
        if (!this.isOpen) return;
        if (e.target.closest && (e.target.closest('.menu-pop') || e.target.closest('#menubar'))) return;
        this.close();
      }, true);
      window.addEventListener('blur', () => this.close());
      window.addEventListener('resize', () => this.close());
      document.addEventListener('keydown', (e) => this.onKey(e), true);
    }

    /** Alt + υπογραμμισμένο γράμμα (π.χ. Alt+Α για «Αρχείο»). Επιστρέφει true αν χειρίστηκε το πλήκτρο. */
    handleAlt(e) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
      const key = String(e.key || '').toLowerCase();
      const hit = this.top.findIndex((t) => t.mnemonic && t.mnemonic === key);
      if (hit < 0) return false;
      e.preventDefault();
      e.stopPropagation();
      this.open(hit, true);
      return true;
    }

    async open(index, fromKeyboard) {
      this.close();
      let data;
      try { data = await this.source.menu(); } catch (_) { return; }
      const menu = data && data[index];
      if (!menu || !menu.submenu) return;
      this.data = data;
      this.index = index;
      this.buttons.forEach((b, i) => b.classList.toggle('open', i === index));
      document.body.classList.add('menu-open');
      const r = this.buttons[index].getBoundingClientRect();
      this.showLevel([index], menu.submenu, { left: r.left, top: r.bottom, right: r.left });
      if (fromKeyboard) this.select(0, nextSelectable(menu.submenu, -1, 1));
    }

    close() {
      clearTimeout(this.timer);
      for (const lv of this.levels) lv.el.remove();
      this.levels = [];
      this.index = -1;
      this.buttons.forEach((b) => b.classList.remove('open'));
      document.body.classList.remove('menu-open');
    }

    /** Σχεδιάζει ένα επίπεδο (πτυσσόμενο μενού ή υπομενού) στη θέση `anchor`. */
    showLevel(path, items, anchor) {
      const el = document.createElement('div');
      el.className = 'menu-pop';
      el.setAttribute('role', 'menu');
      el.addEventListener('mousedown', (e) => e.preventDefault()); // η εστίαση μένει στον editor
      const level = { el, path, items, active: -1 };
      const hasMarks = items.some((it) => it.type === 'checkbox' || it.type === 'radio');
      items.forEach((it, i) => {
        if (it.type === 'separator') {
          const s = document.createElement('div');
          s.className = 'mi-sep';
          s.setAttribute('role', 'separator');
          el.appendChild(s);
          return;
        }
        const row = document.createElement('div');
        row.className = 'mi' + (it.enabled === false ? ' disabled' : '') + (hasMarks ? ' has-marks' : '');
        row.setAttribute('role', it.type === 'checkbox' ? 'menuitemcheckbox' : it.type === 'radio' ? 'menuitemradio' : 'menuitem');
        if (it.enabled === false) row.setAttribute('aria-disabled', 'true');
        if (it.type === 'checkbox' || it.type === 'radio') row.setAttribute('aria-checked', it.checked ? 'true' : 'false');
        const mark = document.createElement('span');
        mark.className = 'mi-mark';
        mark.textContent = it.checked ? (it.type === 'radio' ? '●' : '✓') : '';
        const label = document.createElement('span');
        label.className = 'mi-label';
        label.textContent = it.label;
        const acc = document.createElement('span');
        acc.className = 'mi-acc';
        acc.textContent = it.type === 'submenu' ? '▸' : it.accelerator || '';
        if (it.type === 'submenu') acc.classList.add('mi-arrow');
        row.append(mark, label, acc);
        row.addEventListener('mouseenter', () => this.hover(path, i));
        row.addEventListener('click', () => this.activate(path, i));
        el.appendChild(row);
      });
      document.body.appendChild(el);
      this.levels.push(level);
      this.place(el, anchor);
      return level;
    }

    /** Τοποθετεί το επίπεδο στο anchor ({left, top, right}) και το κρατά μέσα στο παράθυρο. */
    place(el, anchor) {
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      el.style.maxHeight = `${Math.max(120, vh - anchor.top - 8)}px`;
      const w = el.offsetWidth;
      let left = anchor.left;
      if (left + w > vw - 4) left = anchor.flipTo != null ? anchor.flipTo - w : Math.max(4, vw - w - 4);
      el.style.left = `${Math.max(4, left)}px`;
      el.style.top = `${anchor.top}px`;
    }

    levelAt(path) { return this.levels.find((lv) => lv.path.length === path.length && lv.path.every((n, k) => n === path[k])); }

    /** Κλείνει τα επίπεδα βαθύτερα από `depth` (πλήθος επιπέδων που μένουν). */
    trim(depth) {
      while (this.levels.length > depth) this.levels.pop().el.remove();
    }

    select(depth, i) {
      const lv = this.levels[depth];
      if (!lv) return;
      lv.active = i;
      [...lv.el.querySelectorAll('.mi')].forEach((row) => row.classList.remove('active'));
      const rows = [...lv.el.children];
      if (rows[i] && rows[i].classList.contains('mi')) {
        rows[i].classList.add('active');
        rows[i].scrollIntoView({ block: 'nearest' });
      }
    }

    hover(path, i) {
      const depth = path.length - 1;
      const lv = this.levels[depth];
      if (!lv || lv.items[i].type === 'separator') return;
      this.select(depth, i);
      clearTimeout(this.timer);
      const it = lv.items[i];
      if (it.type === 'submenu' && it.enabled !== false) {
        this.timer = setTimeout(() => this.openSub(depth, i), OPEN_DELAY);
      } else {
        this.timer = setTimeout(() => this.trim(depth + 1), OPEN_DELAY);
      }
    }

    openSub(depth, i, selectFirst) {
      const lv = this.levels[depth];
      if (!lv) return;
      const it = lv.items[i];
      if (!it || it.type !== 'submenu') return;
      const row = [...lv.el.children][i];
      this.trim(depth + 1);
      const r = row.getBoundingClientRect();
      const sub = this.showLevel([...lv.path, i], it.submenu, { left: r.right - 3, top: Math.max(0, r.top - 5), right: r.right, flipTo: r.left + 3 });
      if (selectFirst) this.select(depth + 1, nextSelectable(it.submenu, -1, 1));
      return sub;
    }

    activate(path, i) {
      const lv = this.levelAt(path);
      const it = lv && lv.items[i];
      if (!it || it.enabled === false) return;
      if (it.type === 'submenu') { this.openSub(path.length - 1, i); return; }
      const full = [...path, i];
      this.close();
      this.source.invoke(full);
    }

    onKey(e) {
      if (e.type !== 'keydown') return;
      if (!this.isOpen) { this.handleAlt(e); return; }
      const depth = this.levels.length - 1;
      const lv = this.levels[depth];
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      switch (e.key) {
        case 'Escape':
          stop();
          if (depth > 0) this.trim(depth); else this.close();
          break;
        case 'ArrowDown':
        case 'ArrowUp': {
          stop();
          const dir = e.key === 'ArrowDown' ? 1 : -1;
          const from = lv.active >= 0 ? lv.active : dir === 1 ? -1 : 0;
          this.select(depth, nextSelectable(lv.items, from, dir));
          break;
        }
        case 'Home':
        case 'End':
          stop();
          this.select(depth, nextSelectable(lv.items, e.key === 'Home' ? -1 : 0, e.key === 'Home' ? 1 : -1));
          break;
        case 'ArrowRight': {
          stop();
          const it = lv.items[lv.active];
          if (it && it.type === 'submenu' && it.enabled !== false) this.openSub(depth, lv.active, true);
          else if (this.top.length) this.open((this.index + 1) % this.top.length, true);
          break;
        }
        case 'ArrowLeft':
          stop();
          if (depth > 0) this.trim(depth);
          else if (this.top.length) this.open((this.index - 1 + this.top.length) % this.top.length, true);
          break;
        case 'Enter':
        case ' ':
          stop();
          if (lv.active >= 0) {
            const it = lv.items[lv.active];
            if (it.type === 'submenu') this.openSub(depth, lv.active, true);
            else this.activate(lv.path, lv.active);
          }
          break;
        case 'Tab':
          stop();
          break;
        default:
          // Alt+γράμμα ενώ είναι ανοιχτό μενού: άνοιγμα του άλλου μενού
          if (this.handleAlt(e)) return;
          // Ένα απλό γράμμα επιλέγει το στοιχείο που ξεκινά από αυτό (όπως στα κανονικά μενού)
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            stop();
            const k = e.key.toLowerCase();
            const n = lv.items.length;
            for (let step = 1; step <= n; step++) {
              const j = (Math.max(lv.active, -1) + step) % n;
              const it = lv.items[j];
              if (it.type !== 'separator' && it.enabled !== false && it.label.toLowerCase().startsWith(k)) { this.select(depth, j); break; }
            }
          }
      }
    }
  }

  MenuBar.nextSelectable = nextSelectable;
  return MenuBar;
});
