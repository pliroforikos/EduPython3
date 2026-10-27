/* Κεντρική λογική της εφαρμογής. */
(function (root) {
  'use strict';
  const api = root.api;
  const $ = (s) => document.querySelector(s);
  const ES = () => root.EditorSetup;

  const STARTER = [
    '# Το πρώτο μου πρόγραμμα σε Python 2.7',
    '# Πάτησε F5 ή το πράσινο κουμπί «Εκτέλεση».',
    '',
    'onoma = raw_input("Πώς σε λένε; ")',
    'print "Γεια σου,", onoma',
    '',
  ].join('\n');

  /** Φόρμα σχολίων με την οποία ξεκινά κάθε νέο αρχείο (η ημερομηνία συμπληρώνεται αυτόματα). */
  const HEADER_LINE = '#'.repeat(59);
  const HEADER_CURSOR_LINE = 3;   // η γραμμή «Άσκηση:», όπου πηγαίνει ο κέρσορας
  function newFileHeader() {
    const d = new Date();
    return [
      HEADER_LINE,
      `# Ημερομηνία: ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
      '# Άσκηση: ',
      '# Ονοματεπώνυμο: ',
      HEADER_LINE,
      '',
      '',
    ].join('\n');
  }

  /** Ταχύτητες εκτέλεσης: τι στέλνεται στον runner (null = κανονική εκτέλεση, χωρίς παρακολούθηση). */
  const SPEEDS = {
    step: { mode: 'step' },
    slow: { mode: 'auto', delay: 1000 },
    medium: { mode: 'auto', delay: 400 },
    normal: null,
  };
  const SPEED_NAMES = { step: 'Γραμμή γραμμή', slow: 'Αργή', medium: 'Μέτρια', normal: 'Κανονική' };
  const SPEED_ORDER = ['step', 'slow', 'medium', 'normal'];   // θέσεις του slider, από αριστερά
  const PRESENT_OUT_MAX = 8 * 1024;   // έξοδος της παρουσίασης ανά 100 ms (ατέρμονο print με 30 μαθητές)

  const samePath =(a, b) => !!a && !!b && a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase();
  const baseName = (p) => p.split(/[\\/]/).pop();

  const App = {
    monaco: null,
    editor: null,
    settings: null,
    tabs: [],
    active: null,
    untitledCount: 0,
    nextId: 1,
    running: false,
    runTab: null,
    runHadError: false,
    traced: false,       // η τρέχουσα εκτέλεση γίνεται βήμα-βήμα (με παρακολούθηση γραμμών)
    execIds: [],         // φωτισμός της γραμμής που εκτελείται
    pythonVersion: null,
    classroom: { state: 'off', hand: false },   // σύνδεση με τον καθηγητή (μενού Τάξη)
    presenting: false,   // καθηγητής: οι μαθητές βλέπουν την ενεργή καρτέλα και το Shell
    watching: { on: false, visible: false, locked: false },   // μαθητής: ο καθηγητής παρουσιάζει

    // ================================================================ εκκίνηση
    async init(monaco) {
      this.monaco = monaco;
      this.settings = await api.settings.get();
      ES().init(monaco);
      document.body.className = this.settings.theme === 'dark' ? 'theme-dark' : 'theme-light';

      this.editor = monaco.editor.create($('#editor-host'), { ...ES().editorOptions(this.settings), model: null });
      this.marks = new (ES().ErrorMarks)(monaco, this.editor);
      this.editor.onDidChangeCursorPosition((e) => {
        $('#st-pos').textContent = `Γρ ${e.position.lineNumber}, Στ ${e.position.column}`;
        this.scheduleShare();
      });
      this.editor.onDidChangeCursorSelection(() => this.schedulePresent());
      this.editor.onDidScrollChange((e) => { if (e.scrollTopChanged) this.schedulePresent(); });
      // Μέσα στον editor ο Monaco «πιάνει» κάποια πλήκτρα πριν από το μενού: F1 (παλέτα εντολών), F7/F8
      // (μετάβαση σε επισήμανση/λάθος), Ctrl+F2 (αλλαγή όλων των εμφανίσεων). Εδώ πηγαίνουν στις δικές μας εντολές.
      const K = monaco.KeyCode;
      const keys = [[K.F1, 'help'], [K.F5, 'run'], [K.F6, 'toggleVariables'], [K.F7, 'toggleAssistant'],
        [K.F8, 'toggleRecall'], [K.F9, 'raiseHand'], [K.F10, 'step'], [monaco.KeyMod.CtrlCmd | K.F2, 'stop']];
      for (const [kb, cmd] of keys) this.editor.addCommand(kb, () => this.onMenu(cmd));
      // Ctrl+M: στον Monaco κάνει το Tab να βγάζει το focus από τον editor αντί να βάζει εσοχή
      this.editor.addCommand(monaco.KeyMod.CtrlCmd | K.KeyM, () => {});

      this.shell = new root.Shell($('#shell'), {
        onInput: (text) => api.backend.input(text),
        onRepl: (line) => { this.setState('running', 'Εκτελείται εντολή…'); api.backend.repl(line); },
        onLink: (file, line) => this.gotoFileLine(file, line),
        onInterrupt: () => this.stop(),
        onHelp: () => this.showAssistant(),
      });
      this.shell.tap = (text, cls) => this.presentOutput(text, cls);
      this.presentView = new root.Present.PresentView($('#present-panel'), {
        monaco,
        editorOptions: () => ES().editorOptions(this.settings),
        baseFont: () => this.settings.fontSize,
        onCopy: (text, file) => this.copyPresented(text, file),
        onChange: (s) => this.onWatching(s),
      });
      this.vars = new root.Panels.VariablesView($('#vars'), {
        onGoto: (line) => {
          const tab = this.runTab || this.active;
          if (tab && !tab.model.isDisposed()) { this.activate(tab); this.reveal(line); }
        },
      });
      this.assistant = new root.Panels.AssistantView($('#assistant'), {
        onGoto: (line, err) => {
          const tab = (err && this.tabForFile(err.location && err.location.filename)) || this.runTab || this.active;
          if (tab) { this.activate(tab); this.reveal(line); }
        },
      });
      this.recall = new root.Recall.RecallView($('#recall'), {
        load: () => api.recall(),
        colorize: (code) => monaco.editor.colorize(code, ES().LANG, { tabSize: 4 }),
        onInsert: (code) => this.insertSnippet(code),
      });

      this.applyLayout();
      this.applyFont();
      this.applyPanels();
      this.applySpeed();
      this.bindToolbar();
      this.bindSplitters();
      this.bindDrop();
      // Στα Windows, όταν αφήνεται σκέτο το Alt (π.χ. μετά από Alt+κλικ για πολλαπλούς κέρσορες), το Electron
      // δίνει το πληκτρολόγιο στη γραμμή μενού και ο editor «κολλάει»: δεν γράφει, ενώ ο κέρσορας φαίνεται ενεργός.
      // Τα Alt+γράμμα για τα μενού δουλεύουν κανονικά (ενεργοποιούνται με το πάτημα του γράμματος).
      window.addEventListener('keyup', (e) => { if (e.key === 'Alt' || e.key === 'AltGraph') e.preventDefault(); }, true);
      window.addEventListener('keydown', (e) => this.redirectTyping(e), true);
      // Τα κουμπιά δεν κρατούν το focus: μετά από κλικ στο «A+» ή στο «Μεταβλητές» η πληκτρολόγηση συνεχίζει στον editor.
      document.addEventListener('mousedown', (e) => {
        const b = e.target.closest('button');
        if (b && !b.closest('dialog, .monaco-editor')) e.preventDefault();
      }, true);
      api.onMenu((id, arg) => this.onMenu(id, arg));
      api.backend.onMessage((msg) => this.onBackend(msg));
      api.classroom.onStatus((s) => this.onClassroom(s));
      api.classroom.onPresent((p) => this.presentView.update(p));
      api.classroom.onPresentOut((o) => this.presentView.output(o));
      api.present.onState((s) => this.onPresentState(s));
      this.bindClassroom();

      await this.restoreSession();
      this.startShell();
      this.checkPython();
    },

    /**
     * «Πληκτρολόγηση οπουδήποτε»: αν το focus δεν είναι σε πεδίο κειμένου (π.χ. μετά από κλικ στον Βοηθό ή στη
     * γραμμή κατάστασης), τα πλήκτρα πηγαίνουν στον editor, ή στο Shell όταν το πρόγραμμα περιμένει τιμή.
     * Αλλιώς ο μαθητής γράφει και δεν γίνεται τίποτα.
     */
    redirectTyping(e) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing || document.querySelector('dialog[open]')) return;
      if (this.watching.locked) return;   // «Όλοι εδώ»: ο καθηγητής παρουσιάζει
      const a = document.activeElement;
      const onBody = !a || a === document.body || a === document.documentElement;
      if (!onBody) {
        if (a.isContentEditable || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' ||
            (a.tagName === 'INPUT' && a.type !== 'range')) return;
        if (a.closest('#shell')) return;   // το Shell στέλνει μόνο του τα πλήκτρα στη γραμμή εισόδου του
        if (e.key === ' ' || e.key === 'Enter') return;   // ενεργοποίηση κουμπιού/στοιχείου από το πληκτρολόγιο
      }
      const typing = e.key.length === 1 || e.key === 'Dead' ||
        (onBody && (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete'));
      if (!typing || !this.editor || !this.editor.getModel()) return;
      if (this.shell.waiting) this.shell.focus();
      else this.editor.focus();
    },

    async restoreSession() {
      const files = this.settings.openFiles || [];
      for (const p of files) {
        if (await api.file.exists(p)) {
          const r = await api.file.read(p);
          if (!r.error) this.addTab({ path: r.path, content: r.content }, false);
        }
      }
      if (!this.tabs.length) {
        const first = !(this.settings.recentFiles || []).length;
        this.addTab({ content: newFileHeader() + (first ? STARTER : '') }, true);
        this.cursorToHeader();
      }
      const act = this.tabs.find((t) => samePath(t.path, this.settings.activeFile)) || this.tabs[0];
      this.activate(act);
    },

    async checkPython() {
      const info = await api.python.info();
      const st = $('#st-py');
      if (info.ok) {
        this.pythonVersion = info.version;
        st.textContent = `Python ${info.version}`;
        st.className = '';
        st.title = info.path;
        st.onclick = null;
      } else {
        st.textContent = info.error === 'notpy2' ? `⚠ Python ${info.version}: χρειάζεται 2.7` : '⚠ Δεν βρέθηκε Python 2.7';
        st.className = 'bad';
        st.title = 'Κλικ για ρυθμίσεις';
        st.onclick = () => this.openSettings();
        const r = await api.dialog.message({
          type: 'warning',
          title: 'Python 2.7',
          message: info.error === 'notpy2'
            ? `Η διαδρομή που έχει οριστεί είναι Python ${info.version}, όχι Python 2.7.`
            : 'Δεν βρέθηκε η Python 2.7 στον υπολογιστή.',
          detail: api.platform === 'win32'
            ? 'Η εφαρμογή χρειάζεται την Python 2.7 (συνήθως στο C:\\Python27\\python.exe). Όρισε τη διαδρομή από τις Ρυθμίσεις.'
            : info.installScript
              ? `Η εφαρμογή χρειάζεται την Python 2.7. Για να την εγκαταστήσεις, άνοιξε ένα τερματικό και γράψε:\n\nsudo bash "${info.installScript}"\n\nΜετά ξεκίνα ξανά την εφαρμογή.`
              : 'Η εφαρμογή χρειάζεται την Python 2.7 (συνήθως /usr/bin/python2.7). Σε Ubuntu 22.04: sudo apt install python2. ' +
                'Σε νεότερες διανομές δες τις οδηγίες για Linux στο github.com/pliroforikos/myPython2. Όρισε τη διαδρομή από τις Ρυθμίσεις.',
          buttons: ['Ρυθμίσεις…', 'Αργότερα'],
          defaultId: 0,
        });
        if (r.response === 0) this.openSettings();
      }
    },

    // ================================================================ καρτέλες
    addTab({ path, content }, activate = true) {
      const monaco = this.monaco;
      if (!path) this.untitledCount++;
      const id = this.nextId++;
      // Κάθε καρτέλα έχει δικό της μοντέλο, με URI που δεν εξαρτάται από το όνομα του αρχείου. Με URI το όνομα,
      // μετά από «Αποθήκευση ως» και ξανά-άνοιγμα του αρχικού, δύο καρτέλες μοιράζονταν το ίδιο μοντέλο: η μία
      // έχανε το περιεχόμενό της και, όταν έκλεινε η άλλη, ο editor έμενε με μοντέλο που είχε καταστραφεί.
      const model = monaco.editor.createModel(content, ES().LANG, monaco.Uri.parse(`inmemory://tab/${id}.py`));
      model.updateOptions({ tabSize: 4, insertSpaces: true });
      const tab = {
        id,
        path: path || null,
        title: path ? baseName(path) : (this.untitledCount === 1 ? 'χωρίς τίτλο' : `χωρίς τίτλο ${this.untitledCount}`),
        model,
        savedVersion: model.getAlternativeVersionId(),
        viewState: null,
      };
      model.onDidChangeContent(() => this.onContentChange(tab));
      this.tabs.push(tab);
      if (activate) this.activate(tab);
      else this.renderTabs();
      this.scheduleCheck(tab, 50);
      this.persistSession();
      return tab;
    },

    activate(tab) {
      if (!tab) return;
      if (this.active && this.active !== tab) this.active.viewState = this.editor.saveViewState();
      this.active = tab;
      this.editor.setModel(tab.model);
      if (tab.viewState) this.editor.restoreViewState(tab.viewState);
      this.editor.focus();
      this.renderTabs();
      this.updateTitle();
      this.persistSession();
      this.scheduleShare();
    },

    isDirty(tab) { return tab.model.getAlternativeVersionId() !== tab.savedVersion; },

    renderTabs() {
      const box = $('#tabs');
      box.textContent = '';
      for (const tab of this.tabs) {
        const el = document.createElement('div');
        el.className = 'tab' + (tab === this.active ? ' active' : '') + (this.isDirty(tab) ? ' dirty' : '') +
          (this.running && tab === this.runTab ? ' running' : '');
        el.title = tab.path || 'Δεν έχει αποθηκευτεί ακόμα';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = tab.title;
        const close = document.createElement('button');
        close.className = 'close';
        close.title = 'Κλείσιμο (Ctrl+W)';
        close.innerHTML = '<span>×</span>';
        close.addEventListener('click', (e) => { e.stopPropagation(); this.closeTab(tab); });
        el.append(name, close);
        el.addEventListener('mousedown', (e) => {
          if (e.button === 1) { e.preventDefault(); this.closeTab(tab); return; }
          // Πάτημα στο ×: όχι ενεργοποίηση εδώ. Η activate() ξαναζωγραφίζει τις καρτέλες
          // και το × θα αντικαθίστατο πριν ολοκληρωθεί το click του.
          if (e.button === 0 && !e.target.closest('.close')) this.activate(tab);
        });
        box.appendChild(el);
      }
      box.ondblclick = (e) => { if (e.target === box) this.newFile(); };
    },

    updateTitle() {
      const t = this.active;
      if (!t) return;
      document.title = `${t.title}${this.isDirty(t) ? ' ●' : ''} – Python 2.7 ΕΠΑΛ`;
      $('#st-file').textContent = t.path || '(δεν έχει αποθηκευτεί)';
    },

    async closeTab(tab) {
      if (this.isDirty(tab)) {
        this.activate(tab);
        const r = await api.dialog.unsaved([tab.title]);
        if (r === 'cancel') return;
        if (r === 'save' && !(await this.save(tab))) return;
      }
      const i = this.tabs.indexOf(tab);
      this.tabs.splice(i, 1);
      if (this.marks.model === tab.model) this.marks.clear();
      if (!this.tabs.length) this.addTab({ content: newFileHeader() }, false);
      if (this.active === tab) {
        this.active = null;
        this.activate(this.tabs[Math.min(i, this.tabs.length - 1)]);
      } else {
        this.renderTabs();
      }
      tab.model.dispose();
      this.persistSession();
    },

    tabForFile(file) {
      if (!file) return null;
      return this.tabs.find((t) => samePath(t.path, file)) || null;
    },

    persistSession() {
      clearTimeout(this.persistTimer);
      this.persistTimer = setTimeout(() => {
        api.settings.set({
          openFiles: this.tabs.filter((t) => t.path).map((t) => t.path),
          activeFile: this.active && this.active.path,
        });
      }, 400);
    },

    onContentChange(tab) {
      if (this.marks.model === tab.model) this.marks.clear();
      this.renderTabsLazy();
      this.scheduleCheck(tab, 600);
      if (tab === this.active) this.scheduleShare();
    },

    renderTabsLazy() {
      if (this.tabsFrame) return;
      this.tabsFrame = requestAnimationFrame(() => {
        this.tabsFrame = null;
        this.renderTabs();
        this.updateTitle();
      });
    },

    scheduleCheck(tab, delay) {
      clearTimeout(tab.checkTimer);
      tab.checkTimer = setTimeout(async () => {
        if (tab.model.isDisposed()) return;
        ES().setCharMarkers(this.monaco, tab.model);
        if (!this.settings.liveCheck) { ES().setSyntaxMarkers(this.monaco, tab.model, null); return; }
        const version = tab.model.getVersionId();
        const res = await api.check(tab.model.getValue());
        if (tab.model.isDisposed() || tab.model.getVersionId() !== version) return;
        ES().setSyntaxMarkers(this.monaco, tab.model, res);
        if (tab === this.active) this.scheduleShare();   // ο καθηγητής βλέπει και το λάθος σύνταξης
      }, delay);
    },

    // ================================================================ αρχεία
    newFile() {
      this.addTab({ content: newFileHeader() }, true);
      this.cursorToHeader();
    },

    /** Ο κέρσορας στο τέλος της γραμμής «Άσκηση:» της φόρμας. */
    cursorToHeader() {
      const model = this.editor.getModel();
      if (!model || model.getLineContent(HEADER_CURSOR_LINE) !== '# Άσκηση: ') return;
      this.editor.setPosition({ lineNumber: HEADER_CURSOR_LINE, column: model.getLineMaxColumn(HEADER_CURSOR_LINE) });
      this.editor.focus();
    },

    async open() {
      const files = await api.file.open();
      for (const f of files) this.openLoaded(f);
    },

    openLoaded(f) {
      const existing = this.tabForFile(f.path);
      if (existing) { this.activate(existing); return existing; }
      // αντικατάσταση μιας άδειας, ανέγγιχτης καρτέλας «χωρίς τίτλο»
      // (περιέχει μόνο τη φόρμα σχολίων που μπήκε αυτόματα)
      const blank = this.tabs.length === 1 && !this.tabs[0].path && !this.isDirty(this.tabs[0]) ? this.tabs[0] : null;
      const tab = this.addTab({ path: f.path, content: f.content }, true);
      if (blank) this.closeTab(blank);
      return tab;
    },

    async openPath(p) {
      const r = await api.file.read(p);
      if (r.error) {
        api.dialog.message({ type: 'error', title: 'Άνοιγμα', message: `Δεν ήταν δυνατό να ανοίξει το αρχείο:\n${p}`, detail: r.error });
        return null;
      }
      return this.openLoaded(r);
    },

    async save(tab) {
      tab = tab || this.active;
      if (!tab.path) return this.saveAs(tab);
      const r = await api.file.save(tab.path, tab.model.getValue());
      return this.afterSave(tab, r);
    },

    async saveAs(tab) {
      tab = tab || this.active;
      const suggested = tab.path || 'programma.py';
      const r = await api.file.saveAs(tab.model.getValue(), suggested);
      if (!r) return false;
      if (r.ok) {
        const other = this.tabs.find((t) => t !== tab && samePath(t.path, r.path));
        if (other) this.closeTab(other);
        tab.path = r.path;
        tab.title = baseName(r.path);
      }
      return this.afterSave(tab, r);
    },

    afterSave(tab, r) {
      if (!r.ok) {
        api.dialog.message({ type: 'error', title: 'Αποθήκευση', message: 'Η αποθήκευση απέτυχε.', detail: r.error || '' });
        return false;
      }
      tab.savedVersion = tab.model.getAlternativeVersionId();
      this.renderTabs();
      this.updateTitle();
      this.persistSession();
      return true;
    },

    gotoFileLine(file, line) {
      const tab = this.tabForFile(file);
      if (tab) { this.activate(tab); this.reveal(line); return; }
      api.file.exists(file).then(async (ok) => {
        if (!ok) return;
        const t = await this.openPath(file);
        if (t) this.reveal(line);
      });
    },

    reveal(line) {
      this.editor.revealLineInCenter(line);
      this.editor.setPosition({ lineNumber: line, column: 1 });
      const model = this.editor.getModel();
      const first = model.getLineContent(line).search(/\S/);
      this.editor.setPosition({ lineNumber: line, column: first >= 0 ? first + 1 : 1 });
      this.editor.focus();
    },

    // ================================================================ εκτέλεση
    setState(kind, text) {
      const el = $('#st-state');
      el.className = 'st-state ' + kind;
      el.textContent = {
        idle: '● Έτοιμο', running: '▶ Εκτελείται…', input: '⌨ Περιμένει είσοδο στο Shell', error: '✖ Λάθος',
      }[kind];
      if (text) el.textContent = (kind === 'error' ? '✖ ' : kind === 'running' ? '▶ ' : '● ') + text;
      document.body.classList.toggle('running', kind === 'running' || kind === 'input');
    },

    startShell() {
      this.running = false;
      this.awaitingReady = true;
      api.backend.shell();
    },

    async run() {
      const tab = this.active;
      if (!tab || this.lockedByTeacher()) return;
      if (!tab.path || (this.settings.saveBeforeRun && this.isDirty(tab))) {
        if (!tab.path) {
          await api.dialog.message({
            type: 'info', title: 'Αποθήκευση', message: 'Πριν από την πρώτη εκτέλεση, δώσε ένα όνομα στο πρόγραμμα.',
            detail: 'Χρησιμοποίησε λατινικούς χαρακτήρες και κατάληξη .py, π.χ. askisi1.py', buttons: ['Εντάξει'],
          });
        }
        if (!(await this.save(tab))) return;
      }
      this.marks.clear();
      this.clearExecLine();
      const speed = this.settings.runSpeed || 'normal';
      this.running = true;
      this.runTab = tab;
      this.runHadError = false;
      this.traced = !!SPEEDS[speed];
      this.vars.reset();
      this.vars.empty('Το πρόγραμμα εκτελείται…');
      this.shell.beginRun(tab.title);
      this.setState('running', this.traced ? `Εκτελείται (${SPEED_NAMES[speed]})…` : null);
      $('#shell-sub').textContent = '';
      this.renderTabs();
      this.updateStepButton();
      this.awaitingReady = true;
      api.backend.run(tab.path, tab.model.getValue(), SPEEDS[speed]);
    },

    // ================================================================ βήμα-βήμα
    setSpeed(speed) {
      if (!(speed in SPEEDS) || speed === this.settings.runSpeed) { this.applySpeed(); return; }
      this.updateSettings({ runSpeed: speed });
      if (!this.running) return;
      if (this.traced) {
        api.backend.trace(SPEEDS[speed] || { mode: 'off' });
        if (!SPEEDS[speed]) this.clearExecLine();
        this.setState('running', `Εκτελείται (${SPEED_NAMES[speed]})…`);
      } else if (SPEEDS[speed]) {
        // ένα πρόγραμμα που ξεκίνησε κανονικά δεν παρακολουθείται γραμμή-γραμμή
        this.setState('running', `Η ταχύτητα «${SPEED_NAMES[speed]}» θα ισχύσει στην επόμενη εκτέλεση (F5)`);
      }
    },

    applySpeed() {
      const speed = this.settings.runSpeed || 'normal';
      this.showSpeed(SPEED_ORDER.indexOf(speed));
      document.body.classList.toggle('speed-step', speed === 'step');
      this.updateStepButton();
      this.fitToolbar();
    },

    /** Θέση του slider, όνομα και χρώμα (και κατά το σύρσιμο, πριν εφαρμοστεί η ταχύτητα). */
    showSpeed(i) {
      const speed = SPEED_ORDER[i] || 'normal';
      const range = $('#speed');
      range.value = SPEED_ORDER.indexOf(speed);
      range.style.setProperty('--fill', `${(range.value / 3) * 100}%`);
      range.title = SPEED_NAMES[speed];
      $('#speed-label').textContent = SPEED_NAMES[speed];
      range.closest('.speed').querySelectorAll('.speed-ticks i').forEach((t, k) => {
        t.classList.toggle('done', k < range.value);
        t.classList.toggle('cur', k === Number(range.value));
      });
      range.closest('.speed').classList.toggle('on', speed !== 'normal');
    },

    updateStepButton() {
      $('#btn-step').disabled = !(this.running && this.traced && this.settings.runSpeed === 'step');
    },

    step() {
      if (this.lockedByTeacher()) return;
      if (this.running && this.traced && this.settings.runSpeed === 'step') api.backend.step();
    },

    onStep(msg) {
      const tab = this.runTab;
      if (!this.running || !tab || tab.model.isDisposed()) return;
      // χωρίς activate(): αν ο μαθητής πήγε σε άλλη καρτέλα, μένει εκεί και γράφει κανονικά
      this.showExecLine(tab.model, msg.line);
      this.vars.update(msg.vars || [], msg.locals, msg.func);
      const speed = this.settings.runSpeed;
      if (speed === 'step') this.setState('running', `Γραμμή ${msg.line}: πάτα «Επόμενη» ή F10`);
      else if (SPEEDS[speed]) this.setState('running', `Γραμμή ${msg.line} (${SPEED_NAMES[speed]})`);
    },

    showExecLine(model, line) {
      if (line > model.getLineCount()) return;
      this.execIds = model.deltaDecorations(this.execIds, [{
        range: new this.monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true, className: 'exec-line', glyphMarginClassName: 'exec-glyph',
          overviewRuler: { color: '#e0a800', position: this.monaco.editor.OverviewRulerLane.Full },
        },
      }]);
      this.execModel = model;
      this.execLine = line;
      if (this.editor.getModel() === model) this.editor.revealLineInCenterIfOutsideViewport(line);
      this.schedulePresent();
    },

    clearExecLine() {
      if (this.execModel && !this.execModel.isDisposed()) this.execModel.deltaDecorations(this.execIds, []);
      this.execIds = [];
      if (this.execModel) this.schedulePresent();
      this.execModel = null;
      this.execLine = 0;
    },

    stop() {
      const wasRunning = this.running;
      this.awaitingReady = true;
      api.backend.stop();
      this.running = false;
      this.clearExecLine();
      this.updateStepButton();
      this.renderTabs();
      if (wasRunning) {
        this.shell.stopped('Το πρόγραμμα διακόπηκε από τον χρήστη.');
        this.assistant.show(root.ErrorHelp.explainStop());
        this.vars.empty('Το πρόγραμμα διακόπηκε· οι μεταβλητές του χάθηκαν.');
      } else {
        this.shell.stopped('Επανεκκίνηση του Shell.');
        this.vars.empty('Οι μεταβλητές του προγράμματος θα εμφανιστούν εδώ μετά την εκτέλεση.');
      }
      this.setState('idle');
      this.startShell();
    },

    onBackend(msg) {
      // μηνύματα που ήταν «καθ' οδόν» από μια διεργασία που μόλις σταμάτησε
      if (this.awaitingReady && msg.type !== 'ready' && msg.type !== 'no_python') return;
      if (msg.type === 'ready') this.awaitingReady = false;
      switch (msg.type) {
        case 'ready':
          this.pythonVersion = msg.version;
          break;
        case 'started': {
          const reason = { declared: ' (από τη δήλωση coding)', tkinter: ' (λόγω Tkinter)', default: '' }[msg.reason] || '';
          $('#st-enc').textContent = `Ελληνικά: ${msg.encoding}${reason}`;
          break;
        }
        case 'out':
          this.shell.write(msg.text, msg.stream === 'stderr' ? 'stderr' : 'out');
          break;
        case 'input_request':
          this.setState('input');
          this.shell.requestInput();
          break;
        case 'error':
          this.onError(msg);
          break;
        case 'done':
          this.running = false;
          this.clearExecLine();
          this.updateStepButton();
          this.renderTabs();
          if (!this.runHadError) {
            this.setState('idle', 'Ολοκληρώθηκε');
            if (msg.ok) this.assistant.success();
          }
          break;
        case 'globals':
          this.vars.update(msg.vars || []);
          break;
        case 'step':
          this.onStep(msg);
          break;
        case 'prompt':
          if (!this.running && !$('#st-state').classList.contains('error')) this.setState('idle');
          this.shell.showPrompt(msg.more);
          break;
        case 'exit':
          this.running = false;
          this.clearExecLine();
          this.updateStepButton();
          this.renderTabs();
          this.shell.stopped(`Η διεργασία της Python τερμάτισε${msg.code ? ` (κωδικός ${msg.code})` : ''}. Νέο Shell…`);
          this.setState('idle');
          setTimeout(() => this.startShell(), 300);
          break;
        case 'no_python':
          this.running = false;
          this.renderTabs();
          this.shell.stopped('Δεν βρέθηκε η Python 2.7. Όρισε τη διαδρομή της από Αρχείο → Ρυθμίσεις.');
          this.setState('error', 'Δεν βρέθηκε Python 2.7');
          break;
        default:
          break;
      }
    },

    onError(err) {
      const repl = err.phase === 'repl';
      if (!repl) this.clearExecLine();
      if (!repl) this.runHadError = true;
      const loc = err.location || {};
      const tab = repl ? null : (this.tabForFile(loc.filename) || (samePath(loc.filename, this.runTab && this.runTab.path) ? this.runTab : null));
      const ctx = { lines: tab ? tab.model.getLinesContent() : (repl && loc.line ? [loc.line] : []) };
      const help = root.ErrorHelp.explain(err, ctx);
      this.shell.writeError(err, help.title);
      this.assistant.show(help, repl ? null : err);
      if (tab && loc.lineno) {
        if (this.active !== tab) this.activate(tab);
        const line = help.line || loc.lineno;
        this.marks.show(tab.model, line, help.line ? null : loc.col, `${help.title}\n${err.exc_type}: ${err.message}`);
        this.editor.revealLineInCenterIfOutsideViewport(line);
      }
      if (!repl) this.setState('error', loc.lineno ? `Λάθος στη γραμμή ${help.line || loc.lineno}: ${help.title}` : help.title);
      if (!this.settings.showAssistant) {
        $('#shell-sub').textContent = '💡 Άνοιξε τον Βοηθό (F7) για εξήγηση';
      }
    },

    // ================================================================ μενού / toolbar
    bindToolbar() {
      document.querySelectorAll('[data-cmd]').forEach((b) => {
        b.addEventListener('click', () => this.onMenu(b.dataset.cmd));
      });
      $('#st-enc').textContent = `Ελληνικά: ${this.settings.stringEncoding}`;
      const range = $('#speed');
      range.addEventListener('input', () => this.showSpeed(Number(range.value)));
      range.addEventListener('change', () => { this.setSpeed(SPEED_ORDER[Number(range.value)]); this.editor.focus(); });
      new ResizeObserver(() => this.fitToolbar()).observe($('#toolbar'));
    },

    /** Αν τα κουμπιά δεν χωρούν, κρύβει σταδιακά τα κείμενα κάποιων (μένουν τα εικονίδια, με tooltip). */
    fitToolbar() {
      const tb = $('#toolbar');
      tb.classList.remove('compact-1', 'compact-2');
      for (const c of ['compact-1', 'compact-2']) {
        if (tb.scrollWidth <= tb.clientWidth) break;
        tb.classList.add(c);
      }
    },

    editorAction(id) {
      this.editor.focus();
      this.editor.trigger('menu', id, null);
    },

    async onMenu(id, arg) {
      const ed = {
        undo: 'undo', redo: 'redo', selectAll: 'editor.action.selectAll', find: 'actions.find',
        replace: 'editor.action.startFindReplaceAction', gotoLine: 'editor.action.gotoLine',
        toggleComment: 'editor.action.commentLine', indent: 'editor.action.indentLines', outdent: 'editor.action.outdentLines',
      };
      if (ed[id]) { this.editorAction(ed[id]); return; }
      switch (id) {
        case 'new': this.newFile(); break;
        case 'open': this.open(); break;
        case 'openPath': this.openPath(arg); break;
        case 'save': this.save(); break;
        case 'saveAs': this.saveAs(); break;
        case 'closeTab': if (this.active) this.closeTab(this.active); break;
        case 'run': this.run(); break;
        case 'stop': this.stop(); break;
        case 'step': this.step(); break;
        case 'speed:step': case 'speed:slow': case 'speed:medium': case 'speed:normal': this.setSpeed(id.split(':')[1]); break;
        case 'clearShell': this.shell.clear(); break;
        case 'fixQuotes': this.fixQuotes(); break;
        case 'zoomIn': this.setFont(this.settings.fontSize + 1); break;
        case 'zoomOut': this.setFont(this.settings.fontSize - 1); break;
        case 'zoomReset': this.setFont(16); break;
        case 'toggleTheme': this.updateSettings({ theme: this.settings.theme === 'dark' ? 'light' : 'dark' }); break;
        case 'toggleMinimap': this.updateSettings({ minimap: !this.settings.minimap }); break;
        case 'toggleWrap': this.updateSettings({ wordWrap: !this.settings.wordWrap }); break;
        case 'toggleWhitespace': this.updateSettings({ showWhitespace: !this.settings.showWhitespace }); break;
        case 'toggleVariables': this.updateSettings({ showVariables: !this.settings.showVariables }); break;
        case 'toggleAssistant': this.updateSettings({ showAssistant: !this.settings.showAssistant }); break;
        case 'toggleRecall': this.updateSettings({ showRecall: !this.settings.showRecall }); break;
        case 'encoding:cp1253': case 'encoding:utf-8': this.setEncoding(id.split(':')[1]); break;
        case 'example': { const r = await api.openExample(arg); if (r && !r.error) this.openLoaded(r); break; }
        case 'settings': this.openSettings(); break;
        case 'help': case 'shortcuts': $('#dlg-help').showModal(); break;
        case 'about':
          $('#about-info').textContent = `Python: ${this.pythonVersion || '—'} · ${this.settings.pythonPath || ''}`;
          $('#dlg-about').showModal();
          break;
        case 'requestClose': this.requestClose(); break;
        case 'classroomJoin': this.joinClassroom(); break;
        case 'classroomLeave': this.leaveClassroom(); break;
        case 'raiseHand': this.toggleHand(); break;
        case 'teacherMode': api.classroom.openTeacher(); break;
        default: break;
      }
    },

    fixQuotes() {
      const model = this.editor.getModel();
      const text = model.getValue();
      const fixed = root.ErrorHelp.fixSuspicious(text);
      if (fixed === text) {
        api.dialog.message({ type: 'info', title: 'Διόρθωση εισαγωγικών', message: 'Δεν βρέθηκαν ειδικοί χαρακτήρες για διόρθωση.', buttons: ['Εντάξει'] });
        return;
      }
      this.editor.pushUndoStop();
      this.editor.executeEdits('fixQuotes', [{ range: model.getFullModelRange(), text: fixed }]);
      this.editor.pushUndoStop();
    },

    /** Κώδικας από το «Θέλω να θυμηθώ» στη θέση του κέρσορα, με την εσοχή της γραμμής. */
    insertSnippet(code) {
      const ed = this.editor;
      const model = ed.getModel();
      if (!model) return;
      const sel = ed.getSelection();
      const pos = sel.getStartPosition();
      const line = model.getLineContent(pos.lineNumber);
      const before = line.slice(0, pos.column - 1);
      const atIndent = !before.trim();
      const indent = atIndent ? before : /^\s*/.exec(line)[0];
      const indented = (first) => code.split('\n').map((l, i) => (i === 0 ? first + l : l ? indent + l : l)).join('\n');
      let range;
      let text;
      if (!sel.isEmpty() || atIndent) {
        // σε κενό σημείο της γραμμής (ή πάνω σε επιλογή): εκεί που είναι ο κέρσορας
        range = sel;
        text = indented('');
        if (sel.isEmpty() && line.slice(pos.column - 1).trim()) text += '\n' + indent;
      } else {
        // η γραμμή έχει ήδη κώδικα: στην επόμενη γραμμή
        const end = model.getLineMaxColumn(pos.lineNumber);
        range = new this.monaco.Range(pos.lineNumber, end, pos.lineNumber, end);
        text = '\n' + indented(indent);
      }
      ed.pushUndoStop();
      ed.executeEdits('recall', [{ range, text, forceMoveMarkers: true }]);
      ed.pushUndoStop();
      ed.revealPositionInCenterIfOutsideViewport(ed.getPosition());
      ed.focus();
    },

    async requestClose() {
      const dirty = this.tabs.filter((t) => this.isDirty(t) && (t.path || t.model.getValue().trim()));
      if (dirty.length) {
        const r = await api.dialog.unsaved(dirty.map((t) => t.title));
        if (r === 'cancel') return;
        if (r === 'save') {
          for (const t of dirty) {
            this.activate(t);
            if (!(await this.save(t))) return;
          }
        }
      }
      clearTimeout(this.persistTimer);
      await api.settings.set({
        openFiles: this.tabs.filter((t) => t.path).map((t) => t.path),
        activeFile: this.active && this.active.path,
      });
      api.closeNow();
    },

    // ================================================================ τάξη
    classroomActive() { return ['searching', 'connecting', 'connected'].includes(this.classroom.state); },

    bindClassroom() {
      const pin = $('#cls-pin');
      pin.addEventListener('input', () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 4); });
      $('#dlg-classroom form').addEventListener('submit', (e) => {
        if (!e.submitter || e.submitter.value !== 'ok') return;
        if (!/^\d{4}$/.test(pin.value)) {
          e.preventDefault();
          $('#cls-error').textContent = 'Γράψε το PIN: 4 ψηφία.';
          pin.focus();
        }
      });
      $('#st-class').addEventListener('click', () => {
        if (this.classroomActive()) this.leaveClassroom();
        else this.joinClassroom();
      });
    },

    async joinClassroom() {
      const info = await api.classroom.info();
      const dlg = $('#dlg-classroom');
      dlg.classList.toggle('no-trust', !info.ok);
      $('#cls-cancel').textContent = info.ok ? 'Άκυρο' : 'Εντάξει';
      $('#cls-teachers').textContent = info.ok
        ? `${info.teachers.length > 1 ? 'Καθηγητές' : 'Καθηγητής'}: ${info.teachers.map((t) => (t.room ? `${t.name} (${t.room})` : t.name)).join(', ')}`
        : '';
      $('#cls-missing').textContent = info.ok ? '' : info.error === 'missing'
        ? 'Αυτός ο υπολογιστής δεν έχει ρυθμιστεί ακόμα για τη λειτουργία «Τάξη».\n\n' +
          `Ο καθηγητής ή ο διαχειριστής του εργαστηρίου πρέπει να αντιγράψει το αρχείο classroom.json εδώ:\n${info.file}`
        : `Το αρχείο ${info.file} δεν είναι σωστό.\n${info.detail || ''}`;
      $('#cls-name').value = info.name || '';
      $('#cls-pin').value = '';
      $('#cls-error').textContent = '';
      dlg.returnValue = '';
      dlg.showModal();
      if (info.ok) $('#cls-pin').focus();
      dlg.onclose = async () => {
        if (dlg.returnValue !== 'ok' || !info.ok) return;
        const r = await api.classroom.join($('#cls-name').value, $('#cls-pin').value);
        if (!r.ok) this.joinClassroom();
      };
    },

    async leaveClassroom() {
      const r = await api.dialog.message({
        type: 'question', title: 'Τάξη', message: 'Αποσύνδεση από την τάξη;',
        detail: 'Ο καθηγητής δεν θα βλέπει πια τον κώδικά σου.', buttons: ['Αποσύνδεση', 'Άκυρο'], defaultId: 1, cancelId: 1,
      });
      if (r.response === 0) api.classroom.leave();
    },

    toggleHand() {
      if (this.classroom.state === 'connected') api.classroom.hand(!this.classroom.hand);
      else if (!this.classroomActive()) this.joinClassroom();
    },

    onClassroom(s) {
      const was = this.classroom.state;
      this.classroom = s;
      document.body.classList.toggle('classroom-on', s.state === 'connected');
      document.body.classList.toggle('hand-up', s.state === 'connected' && !!s.hand);
      $('#btn-hand').title = s.hand ? 'Το χέρι σου είναι σηκωμένο. Πάτα για να το κατεβάσεις (F9)' : 'Σηκώνω χέρι: ζητώ βοήθεια από τον καθηγητή (F9)';
      this.fitToolbar();
      const st = $('#st-class');
      st.hidden = !this.classroomActive();
      st.className = 'st-class ' + (s.state === 'connected' ? 'connected' : 'searching');
      if (s.state === 'connected') {
        st.textContent = `👁 ${s.teacher ? s.teacher.name : 'Ο καθηγητής'} βλέπει τον κώδικά σου${s.hand ? ' · ✋' : ''}`;
        st.title = `Συνδεδεμένος με την τάξη${s.teacher && s.teacher.room ? ` (${s.teacher.room})` : ''}. Κλικ για αποσύνδεση.`;
      } else if (this.classroomActive()) {
        st.textContent = '👁 Τάξη: αναζήτηση καθηγητή…';
        st.title = 'Κλικ για αποσύνδεση';
      }
      if (s.state === 'connected' && was !== 'connected') this.shareCode();
      if (s.lowered) {
        st.textContent = '✋ Ο καθηγητής είδε ότι ζήτησες βοήθεια';
        st.className = 'st-class note';
        clearTimeout(this.noteTimer);
        this.noteTimer = setTimeout(() => { if (this.classroomActive()) this.onClassroom({ ...this.classroom, lowered: false }); }, 6000);
      }
      const why = {
        pin: 'Λάθος PIN. Δες ξανά τα 4 ψηφία στην οθόνη του καθηγητή.',
        blocked: 'Πολλές λάθος προσπάθειες. Περίμενε ένα λεπτό και ξαναδοκίμασε.',
        version: 'Ο καθηγητής έχει διαφορετική έκδοση της εφαρμογής.',
      };
      if (s.state === 'rejected') {
        api.dialog.message({ type: 'warning', title: 'Τάξη', message: 'Ο καθηγητής δεν δέχτηκε τη σύνδεση.', detail: why[s.reason] || '', buttons: ['Εντάξει'] })
          .then(() => { if (s.reason === 'pin') this.joinClassroom(); });
      } else if (s.state === 'kicked') {
        api.dialog.message({ type: 'info', title: 'Τάξη', message: 'Ο καθηγητής σε αποσύνδεσε από την τάξη.', buttons: ['Εντάξει'] });
      }
    },

    scheduleShare() {
      this.schedulePresent();   // ό,τι αλλάζει στον editor αλλάζει και στην παρουσίαση
      if (!this.classroomActive()) return;
      clearTimeout(this.shareTimer);
      this.shareTimer = setTimeout(() => this.shareCode(), 500);
    },

    /** Ο κώδικας της ενεργής καρτέλας, η θέση του κέρσορα και τα λάθη της, προς τον καθηγητή. */
    shareCode() {
      const tab = this.active;
      if (!this.classroomActive() || !tab || tab.model.isDisposed()) return;
      const m = this.monaco;
      const errors = m.editor.getModelMarkers({ resource: tab.model.uri })
        .filter((x) => x.severity === m.MarkerSeverity.Error)
        .slice(0, 10)
        .map((x) => ({ line: x.startLineNumber, message: x.message }));
      api.classroom.code({ file: tab.title, text: tab.model.getValue(), cursor: this.cursorOf(tab), errors });
    },

    cursorOf(tab) {
      const pos = this.editor.getModel() === tab.model ? this.editor.getPosition() : null;
      return pos ? { line: pos.lineNumber, column: pos.column } : null;
    },

    // ================================================================ παρουσίαση (καθηγητής)
    /** Η παρουσίαση άνοιξε ή έκλεισε (από το παράθυρο Τάξης ή το μενού Τάξη). */
    onPresentState(s) {
      this.presenting = s.on;
      const st = $('#st-present');
      st.hidden = !s.on;
      st.textContent = `📺 Παρουσιάζεις στην τάξη${s.locked ? ' · 🔒 Όλοι εδώ' : ''}${s.copy ? '' : ' · χωρίς αντιγραφή'}`;
      st.title = 'Οι μαθητές βλέπουν την ενεργή καρτέλα και το Shell. Κλικ για τέλος της παρουσίασης.';
      st.onclick = () => api.present.set({ on: false });
      clearTimeout(this.presentTimer);
      this.presentTimer = null;
      this.presentOutBuf = [];
      if (s.started) {
        this.presented = null;
        this.presentedFile = null;
        this.presentCode();
      }
    },

    schedulePresent() {
      if (!this.presenting || this.presentTimer) return;
      // το πολύ μία ενημέρωση ανά 120 ms, όσο γρήγορα κι αν γράφει ο καθηγητής
      this.presentTimer = setTimeout(() => { this.presentTimer = null; this.presentCode(); }, 120);
    },

    /** Η ενεργή καρτέλα προς τους μαθητές: το κείμενο μόνο όταν άλλαξε, πάντα η θέση του καθηγητή. */
    presentCode() {
      const tab = this.active;
      if (!this.presenting || !tab || tab.model.isDisposed()) return;
      const ed = this.editor;
      const own = ed.getModel() === tab.model;
      const visible = own ? ed.getVisibleRanges() : [];
      const payload = {
        view: {
          cursor: this.cursorOf(tab),
          sel: own ? ed.getSelections().filter((r) => !r.isEmpty())
            .map((r) => [r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn]) : [],
          top: visible.length ? visible[0].startLineNumber : 1,
          exec: this.execModel === tab.model ? this.execLine || 0 : 0,
        },
      };
      const version = `${tab.id}:${tab.model.getVersionId()}`;
      if (this.presented !== version) { payload.text = tab.model.getValue(); this.presented = version; }
      if (this.presentedFile !== tab.title) { payload.file = tab.title; this.presentedFile = tab.title; }
      api.present.code(payload);
    },

    /** Ό,τι γράφεται στο Shell (null: καθάρισμα), μαζεμένο ανά 100 ms. */
    presentOutput(text, cls) {
      if (!this.presenting) return;
      if (text === null) {
        this.presentOutBuf = [];
        api.present.out({ clear: true });
        return;
      }
      const buf = this.presentOutBuf || (this.presentOutBuf = []);
      const last = buf[buf.length - 1];
      if (last && last[0] === cls) last[1] += text;
      else buf.push([cls, text]);
      if (this.presentOutTimer) return;
      this.presentOutTimer = setTimeout(() => {
        this.presentOutTimer = null;
        let chunks = this.presentOutBuf || [];
        this.presentOutBuf = [];
        // ατέρμονο print: οι μαθητές παίρνουν μόνο το τέλος κάθε δέσμης (ως 8 KB ανά 100 ms)
        let size = chunks.reduce((n, c) => n + c[1].length, 0);
        while (size > PRESENT_OUT_MAX && chunks.length) {
          const extra = size - PRESENT_OUT_MAX;
          if (chunks[0][1].length > extra) { chunks[0][1] = chunks[0][1].slice(extra); size -= extra; }
          else { size -= chunks[0][1].length; chunks = chunks.slice(1); }
        }
        if (chunks.length && this.presenting) api.present.out(chunks);
      }, 100);
    },

    // ================================================================ παρουσίαση (μαθητής)
    /** Το πάνελ της παρουσίασης άλλαξε: ένδειξη στη γραμμή κατάστασης και κλείδωμα του editor («Όλοι εδώ»). */
    onWatching(s) {
      const wasLocked = this.watching.locked;
      this.watching = s;
      const teacher = this.classroom.teacher ? this.classroom.teacher.name : 'Ο καθηγητής';
      $('#present-panel .present-title').textContent = `📺 ${teacher} παρουσιάζει`;
      const st = $('#st-watch');
      st.hidden = !s.on || s.visible;
      st.textContent = `📺 ${teacher} παρουσιάζει: κλικ για προβολή`;
      st.onclick = () => this.presentView.show(true);
      const locked = s.on && s.locked;
      document.body.classList.toggle('present-locked', locked);
      this.editor.updateOptions({ readOnly: locked });
      if (locked && !wasLocked) {
        // και το Shell: η πληκτρολόγηση δεν πηγαίνει στο πρόγραμμα του μαθητή όσο κοιτάμε όλοι τον καθηγητή
        if (document.activeElement && document.activeElement.closest('#shell')) document.activeElement.blur();
      } else if (!locked && wasLocked) {
        if (!this.running && $('#st-state').textContent.includes('🔒')) this.setState('idle');
        this.editor.focus();
      }
    },

    lockedByTeacher() {
      if (!this.watching.locked) return false;
      this.presentView.show(true);
      this.setState('idle', '🔒 Ο καθηγητής παρουσιάζει: «Όλοι εδώ»');
      return true;
    },

    /** «Αντιγραφή σε νέα καρτέλα»: ο κώδικας του καθηγητή ως νέο, μη αποθηκευμένο πρόγραμμα του μαθητή. */
    copyPresented(text, file) {
      const tab = this.addTab({ content: text }, false);
      tab.title = `${(file || 'κώδικας').replace(/\.py$/i, '')} (καθηγητής)`;
      tab.savedVersion = -1;   // ζητά αποθήκευση στο κλείσιμο
      this.presentView.show(false);
      this.activate(tab);
    },

    // ================================================================ ρυθμίσεις
    async updateSettings(patch) {
      Object.assign(this.settings, patch);
      await api.settings.set(patch);
      if ('theme' in patch) {
        document.body.className = this.settings.theme === 'dark' ? 'theme-dark' : 'theme-light';
        this.applyPanels();
      }
      this.editor.updateOptions(ES().editorOptions(this.settings));
      this.monaco.editor.setTheme(this.settings.theme === 'dark' ? 'idle-dark' : 'idle-light');
      if ('showVariables' in patch || 'showAssistant' in patch || 'showRecall' in patch) this.applyPanels();
      if ('fontSize' in patch) this.applyFont();
      if ('runSpeed' in patch) this.applySpeed();
      if ('liveCheck' in patch) this.tabs.forEach((t) => this.scheduleCheck(t, 10));
    },

    setFont(size) {
      size = Math.max(10, Math.min(32, size));
      this.updateSettings({ fontSize: size });
    },

    applyFont() {
      $('#shell').style.fontSize = `${Math.max(10, this.settings.fontSize - 1)}px`;
      if (this.presentView) this.presentView.showFont();
    },

    async setEncoding(enc) {
      await this.updateSettings({ stringEncoding: enc });
      $('#st-enc').textContent = `Ελληνικά: ${enc}`;
      this.tabs.forEach((t) => this.scheduleCheck(t, 10));
      if (!this.running) {
        this.shell.info(`Κωδικοποίηση ελληνικών: ${enc}. Επανεκκίνηση Shell.`);
        this.startShell();
      }
    },

    applyPanels() {
      document.body.classList.toggle('no-vars', !this.settings.showVariables);
      document.body.classList.toggle('no-assist', !this.settings.showAssistant);
      document.body.classList.toggle('no-recall', !this.settings.showRecall);
      $('#btn-vars').classList.toggle('on', !!this.settings.showVariables);
      $('#btn-assist').classList.toggle('on', !!this.settings.showAssistant);
      $('#btn-recall').classList.toggle('on', !!this.settings.showRecall);
      if (this.settings.showRecall) this.recall.show();
      if (this.settings.showAssistant) $('#shell-sub').textContent = '';
    },

    showAssistant() {
      if (!this.settings.showAssistant) this.updateSettings({ showAssistant: true });
    },

    async openSettings() {
      const s = await api.settings.get();
      $('#set-python').value = s.pythonPath || '';
      $('#set-font').value = s.fontSize;
      $('#set-theme').value = s.theme;
      $('#set-encoding').value = s.stringEncoding;
      $('#set-save').checked = !!s.saveBeforeRun;
      $('#set-live').checked = !!s.liveCheck;
      const status = $('#set-python-status');
      status.textContent = '';
      status.className = '';
      const test = async () => {
        status.textContent = 'Έλεγχος…';
        status.className = '';
        const r = await api.python.test($('#set-python').value.trim());
        if (r.ok) { status.textContent = `✓ Python ${r.version}`; status.className = 'ok-text'; }
        else if (r.error === 'notpy2') { status.textContent = `✗ Αυτή είναι η Python ${r.version}· χρειάζεται η 2.7`; status.className = 'bad-text'; }
        else { status.textContent = '✗ Δεν βρέθηκε ή δεν εκτελείται'; status.className = 'bad-text'; }
      };
      $('#set-python-test').onclick = test;
      $('#set-python-browse').onclick = async () => {
        const p = await api.dialog.choosePython();
        if (p) { $('#set-python').value = p; test(); }
      };
      const dlg = $('#dlg-settings');
      dlg.returnValue = '';
      dlg.showModal();
      dlg.onclose = async () => {
        if (dlg.returnValue !== 'ok') return;
        const patch = {
          pythonPath: $('#set-python').value.trim(),
          fontSize: Math.max(10, Math.min(32, Number($('#set-font').value) || 16)),
          theme: $('#set-theme').value,
          saveBeforeRun: $('#set-save').checked,
          liveCheck: $('#set-live').checked,
        };
        const pyChanged = patch.pythonPath !== this.settings.pythonPath;
        const enc = $('#set-encoding').value;
        await this.updateSettings(patch);
        if (enc !== this.settings.stringEncoding) await this.setEncoding(enc);
        else if (pyChanged && !this.running) this.startShell();
        if (pyChanged) this.checkPython();
      };
    },

    // ================================================================ διάταξη
    applyLayout() {
      const L = this.settings.layout || {};
      if (L.shell) $('#shell-panel').style.height = `${L.shell}px`;
      if (L.side) $('#side').style.width = `${L.side}px`;
      if (L.vars) $('#vars-panel').style.height = `${L.vars}px`;
      if (L.recall) $('#recall-panel').style.flexGrow = L.recall / 100;
    },

    bindSplitters() {
      const drag = (splitter, dir, onMove, key) => {
        splitter.addEventListener('mousedown', (e) => {
          e.preventDefault();
          splitter.classList.add('dragging');
          document.body.classList.add(dir === 'h' ? 'dragging-h' : 'dragging-v');
          let last = null;
          // Αν το mouseup χαθεί (π.χ. Alt+Tab στη μέση του συρσίματος), το σύρσιμο τελειώνει με την επόμενη
          // κίνηση χωρίς πατημένο κουμπί ή όταν το παράθυρο χάσει το focus. Αλλιώς έμενε το pointer-events: none
          // σε όλη τη σελίδα και κανένα κλικ δεν λειτουργούσε.
          const move = (ev) => { if (!(ev.buttons & 1)) { up(); return; } last = onMove(ev); };
          const up = () => {
            splitter.classList.remove('dragging');
            document.body.classList.remove('dragging-h', 'dragging-v');
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('blur', up);
            if (last != null) {
              this.settings.layout = { ...(this.settings.layout || {}), [key]: Math.round(last) };
              api.settings.set({ layout: this.settings.layout });
            }
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
          window.addEventListener('blur', up);
        });
      };
      drag($('#split-shell'), 'h', (e) => {
        const r = $('#center').getBoundingClientRect();
        const h = Math.max(70, Math.min(r.height - 140, r.bottom - e.clientY));
        $('#shell-panel').style.height = `${h}px`;
        return h;
      }, 'shell');
      drag($('#split-side'), 'v', (e) => {
        const r = $('#main').getBoundingClientRect();
        const w = Math.max(200, Math.min(r.width - 360, r.right - e.clientX));
        $('#side').style.width = `${w}px`;
        return w;
      }, 'side');
      drag($('#split-assist'), 'h', (e) => {
        const r = $('#side').getBoundingClientRect();
        const h = Math.max(60, Math.min(r.height - 90, e.clientY - r.top));
        $('#vars-panel').style.height = `${h}px`;
        return h;
      }, 'vars');
      // Βοηθός / Θέλω να θυμηθώ: μοιράζονται τον χώρο τους με αναλογία (flex-grow, ×100 στις ρυθμίσεις)
      drag($('#split-recall'), 'h', (e) => {
        const a = $('#assist-panel').getBoundingClientRect();
        const r = $('#recall-panel').getBoundingClientRect();
        const total = a.height + r.height;
        const h = Math.max(60, Math.min(total - 60, r.bottom - e.clientY));
        const grow = h / (total - h);
        $('#recall-panel').style.flexGrow = grow;
        return grow * 100;
      }, 'recall');
    },

    bindDrop() {
      document.addEventListener('dragover', (e) => { e.preventDefault(); });
      document.addEventListener('drop', async (e) => {
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files || [])) {
          const p = api.pathForFile(f);
          if (p) await this.openPath(p);
        }
      });
    },
  };

  root.App = App;
})(typeof self !== 'undefined' ? self : this);
