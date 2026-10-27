/* Ρύθμιση του Monaco: γλώσσα Python 2, θέματα τύπου IDLE, autocomplete, hovers, σήμανση λαθών. */
(function (root) {
  'use strict';
  const D = root.PyDocs;
  const LANG = 'python2';

  const EXCEPTIONS = ['Exception', 'ValueError', 'TypeError', 'NameError', 'IndexError', 'KeyError',
    'ZeroDivisionError', 'IOError', 'OSError', 'ImportError', 'AttributeError', 'RuntimeError',
    'StopIteration', 'EOFError', 'KeyboardInterrupt', 'SyntaxError', 'IndentationError', 'AssertionError',
    'OverflowError', 'UnicodeError', 'self'];

  function registerLanguage(monaco) {
    monaco.languages.register({ id: LANG, extensions: ['.py', '.pyw'], aliases: ['Python 2.7'] });

    monaco.languages.setLanguageConfiguration(LANG, {
      comments: { lineComment: '#' },
      brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] }, { open: "'", close: "'", notIn: ['string', 'comment'] },
      ],
      surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
        { open: '"', close: '"' }, { open: "'", close: "'" },
      ],
      onEnterRules: [
        {
          beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except)\b.*:\s*(#.*)?$/,
          action: { indentAction: monaco.languages.IndentAction.Indent },
        },
        {
          beforeText: /^\s+(?:return\b.*|break|continue|pass|raise\b.*)\s*$/,
          action: { indentAction: monaco.languages.IndentAction.Outdent },
        },
      ],
      folding: { offSide: true, markers: { start: /^\s*#\s*region\b/, end: /^\s*#\s*endregion\b/ } },
    });

    monaco.languages.setMonarchTokensProvider(LANG, {
      defaultToken: '',
      tokenPostfix: '.python',
      keywords: D.KEYWORDS,
      constants: D.CONSTANTS,
      builtins: Object.keys(D.BUILTINS).concat(EXCEPTIONS),
      brackets: [
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.bracket' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' },
      ],
      tokenizer: {
        root: [
          [/^(\s*)(def|class)(\s+)([a-zA-Z_]\w*)/, ['white', 'keyword', 'white', 'entity.name.function']],
          { include: '@whitespace' },
          { include: '@numbers' },
          { include: '@strings' },
          [/[,:;.]/, 'delimiter'],
          [/[{}[\]()]/, '@brackets'],
          [/@[a-zA-Z_]\w*/, 'tag'],
          [/[a-zA-Z_]\w*/, {
            cases: { '@keywords': 'keyword', '@constants': 'keyword.constant', '@builtins': 'predefined', '@default': 'identifier' },
          }],
          [/[Ͱ-Ͽἀ-῿]+/, 'invalid'],
          [/[“”‘’–—«»;]/, 'invalid'],
          [/[+\-*/%=<>!&|^~]+/, 'operator'],
        ],
        whitespace: [[/\s+/, 'white'], [/#.*$/, 'comment']],
        numbers: [
          [/0[xX][0-9a-fA-F]+[lL]?/, 'number.hex'],
          [/(\d*\.)?\d+([eE][+-]?\d+)?[jJ]?[lL]?/, 'number'],
        ],
        strings: [
          [/[uUbB]?[rR]?'''/, 'string', '@tripleSingle'],
          [/[uUbB]?[rR]?"""/, 'string', '@tripleDouble'],
          [/[uUbB]?[rR]?'/, 'string', '@single'],
          [/[uUbB]?[rR]?"/, 'string', '@double'],
        ],
        tripleSingle: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'''/, 'string', '@pop'], [/'/, 'string']],
        tripleDouble: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"""/, 'string', '@pop'], [/"/, 'string']],
        single: [[/[^\\']+$/, 'string', '@pop'], [/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string', '@pop'], [/\\$/, 'string']],
        double: [[/[^\\"]+$/, 'string', '@pop'], [/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop'], [/\\$/, 'string']],
      },
    });
  }

  function defineThemes(monaco) {
    // Χρώματα του IDLE, όπως στο βιβλίο
    monaco.editor.defineTheme('idle-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '000000' },
        { token: 'keyword', foreground: 'FF7700' },
        { token: 'keyword.constant', foreground: '900090' },
        { token: 'predefined', foreground: '900090' },
        { token: 'string', foreground: '00AA00' },
        { token: 'string.escape', foreground: '008000' },
        { token: 'comment', foreground: 'DD0000' },
        { token: 'entity.name.function', foreground: '0000FF' },
        { token: 'number', foreground: '000000' },
        { token: 'number.hex', foreground: '000000' },
        { token: 'operator', foreground: '000000' },
        { token: 'delimiter', foreground: '000000' },
        { token: 'invalid', foreground: 'D40000', fontStyle: 'underline bold' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.lineHighlightBackground': '#F4F7FB',
        'editorLineNumber.foreground': '#9AA0A6',
        'editorLineNumber.activeForeground': '#3C4043',
        'editorIndentGuide.background1': '#E8EAED',
        'editorGutter.background': '#FAFBFC',
      },
    });
    monaco.editor.defineTheme('idle-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'E6E6E6' },
        { token: 'keyword', foreground: 'FF9F43' },
        { token: 'keyword.constant', foreground: 'D19AF0' },
        { token: 'predefined', foreground: 'D19AF0' },
        { token: 'string', foreground: '8BD17C' },
        { token: 'string.escape', foreground: '6BBF5C' },
        { token: 'comment', foreground: 'FF7B72' },
        { token: 'entity.name.function', foreground: '79B8FF' },
        { token: 'number', foreground: 'E6E6E6' },
        { token: 'operator', foreground: 'E6E6E6' },
        { token: 'invalid', foreground: 'FF6B6B', fontStyle: 'underline bold' },
      ],
      colors: {
        'editor.background': '#1E1F22',
        'editor.lineHighlightBackground': '#2A2C31',
        'editorLineNumber.foreground': '#6B7079',
        'editorLineNumber.activeForeground': '#C9CCD1',
        'editorGutter.background': '#1E1F22',
      },
    });
  }

  // ------------------------------------------------------------ autocomplete
  function md(sig, doc) {
    return { value: '```python\n' + sig + '\n```\n\n' + doc };
  }

  function documentNames(model) {
    const names = new Set();
    const text = model.getValue();
    const re = /\b(?:def|class)\s+([A-Za-z_]\w*)|^\s*([A-Za-z_]\w*)\s*(?:,\s*[A-Za-z_]\w*\s*)*=(?!=)|\bfor\s+([A-Za-z_]\w*)|\bimport\s+([A-Za-z_]\w*)|def\s+\w+\s*\(([^)]*)\)/gm;
    let m;
    while ((m = re.exec(text))) {
      if (m[5] !== undefined) {
        m[5].split(',').forEach((p) => { const n = p.split('=')[0].trim(); if (/^[A-Za-z_]\w*$/.test(n)) names.add(n); });
      } else {
        const n = m[1] || m[2] || m[3] || m[4];
        if (n) names.add(n);
      }
    }
    // και κάθε άλλο αναγνωριστικό που εμφανίζεται
    (text.replace(/#.*$/gm, '').match(/\b[A-Za-z_]\w{2,}\b/g) || []).forEach((w) => names.add(w));
    return names;
  }

  function registerProviders(monaco) {
    const K = monaco.languages.CompletionItemKind;
    const Rule = monaco.languages.CompletionItemInsertTextRule;

    monaco.languages.registerCompletionItemProvider(LANG, {
      triggerCharacters: ['.'],
      provideCompletionItems(model, position) {
        const line = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        if (/#/.test(line.replace(/(["']).*?\1/g, ''))) return { suggestions: [] };

        // μετά από τελεία: μέλη module ή μέθοδοι
        const dot = /([A-Za-z_][\w.]*)\.(\w*)$/.exec(line);
        if (dot) {
          const mod = D.MODULES[dot[1]];
          if (mod) {
            return {
              suggestions: Object.keys(mod).map((n) => ({
                label: n, kind: /^[A-Z_]+$|^(pi|e|path|argv|version)$/.test(n) ? K.Constant : K.Function,
                insertText: n, range, detail: mod[n][0], documentation: { value: mod[n][1] },
              })),
            };
          }
          return {
            suggestions: Object.keys(D.METHODS).filter((n) => n !== 'title_tk').map((n) => ({
              label: n, kind: K.Method, insertText: n, range,
              detail: D.METHODS[n][0], documentation: { value: D.METHODS[n][1] },
            })),
          };
        }
        // μετά από import / from
        if (/^\s*(import|from)\s+\w*$/.test(line)) {
          return {
            suggestions: Object.keys(D.MODULES).filter((m) => !m.includes('.')).concat(['Tkinter', 'datetime', 'copy'])
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((m) => ({ label: m, kind: K.Module, insertText: m, range })),
          };
        }
        const items = [];
        D.KEYWORDS.forEach((k) => items.push({
          label: k, kind: K.Keyword, insertText: k, range,
          documentation: D.KEYWORD_DOCS[k] ? md(D.KEYWORD_DOCS[k][0], D.KEYWORD_DOCS[k][1]) : undefined,
        }));
        D.CONSTANTS.forEach((k) => items.push({ label: k, kind: K.Constant, insertText: k, range }));
        Object.keys(D.BUILTINS).forEach((b) => items.push({
          label: b, kind: K.Function, insertText: b, range,
          detail: D.BUILTINS[b][0], documentation: { value: D.BUILTINS[b][1] },
        }));
        D.SNIPPETS.forEach(([label, body, desc]) => items.push({
          label, kind: K.Snippet, insertText: body.replace(/\t/g, '    '), insertTextRules: Rule.InsertAsSnippet,
          range, detail: desc, documentation: { value: '```python\n' + body.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\t/g, '    ') + '\n```' },
          sortText: 'zz' + label,
        }));
        const known = new Set(items.map((i) => i.label));
        documentNames(model).forEach((n) => {
          if (!known.has(n) && n !== word.word) items.push({ label: n, kind: K.Variable, insertText: n, range, sortText: '0' + n });
        });
        return { suggestions: items };
      },
    });

    monaco.languages.registerHoverProvider(LANG, {
      provideHover(model, position) {
        const w = model.getWordAtPosition(position);
        if (!w) return null;
        const lineText = model.getLineContent(position.lineNumber);
        const before = lineText.slice(0, w.startColumn - 1);
        const range = new monaco.Range(position.lineNumber, w.startColumn, position.lineNumber, w.endColumn);
        const modm = /([A-Za-z_][\w.]*)\.$/.exec(before);
        let doc = null;
        if (modm && D.MODULES[modm[1]] && D.MODULES[modm[1]][w.word]) doc = D.MODULES[modm[1]][w.word];
        else if (modm && D.METHODS[w.word]) doc = D.METHODS[w.word];
        else if (!modm && D.KEYWORD_DOCS[w.word]) doc = D.KEYWORD_DOCS[w.word];
        else if (!modm && D.BUILTINS[w.word]) doc = D.BUILTINS[w.word];
        else if (!modm && D.MODULES[w.word]) doc = [`import ${w.word}`, `Το module **${w.word}**. Γράψε \`${w.word}.\` για να δεις τι περιέχει.`];
        if (!doc) return null;
        return { range, contents: [md(doc[0], doc[1])] };
      },
    });

    // Γρήγορη διόρθωση ειδικών χαρακτήρων (εισαγωγικά από PDF κ.λπ.)
    monaco.languages.registerCodeActionProvider(LANG, {
      provideCodeActions(model, _range, context) {
        const markers = context.markers.filter((m) => m.source === 'chars');
        if (!markers.length) return { actions: [], dispose() {} };
        const actions = markers.map((m) => ({
          title: `Αντικατάσταση με «${m.code}»`,
          kind: 'quickfix',
          diagnostics: [m],
          isPreferred: true,
          edit: { edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: m, text: m.code } }] },
        }));
        actions.push({
          title: 'Διόρθωση όλων των ειδικών χαρακτήρων του αρχείου',
          kind: 'quickfix',
          edit: { edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: model.getFullModelRange(), text: root.ErrorHelp.fixSuspicious(model.getValue()) } }] },
        });
        return { actions, dispose() {} };
      },
    });
  }

  function editorOptions(settings) {
    return {
      language: LANG,
      theme: settings.theme === 'dark' ? 'idle-dark' : 'idle-light',
      fontSize: settings.fontSize,
      fontFamily: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Ubuntu Mono', 'Liberation Mono', 'Courier New', monospace",
      fontLigatures: false,
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
      minimap: { enabled: !!settings.minimap },
      wordWrap: settings.wordWrap ? 'on' : 'off',
      renderWhitespace: settings.showWhitespace ? 'all' : 'selection',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: 'active', indentation: true },
      glyphMargin: true,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      fixedOverflowWidgets: true,
      wordBasedSuggestions: 'off',
      quickSuggestions: { other: true, comments: false, strings: false },
      suggest: { showWords: false, preview: true },
      stickyScroll: { enabled: false },
      unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: true, nonBasicASCII: false },
      mouseWheelZoom: false,
      dragAndDrop: true,
      links: false,
      contextmenu: true,
      'semanticHighlighting.enabled': false,
    };
  }

  // ------------------------------------------------------------- σήμανση λαθών
  class ErrorMarks {
    constructor(monaco, editor) {
      this.monaco = monaco;
      this.editor = editor;
      this.decorations = editor.createDecorationsCollection();
      this.model = null;
    }

    show(model, lineno, col, message) {
      const m = this.monaco;
      this.clear();
      if (!lineno || lineno > model.getLineCount()) return;
      this.model = model;
      const text = model.getLineContent(lineno);
      const first = text.search(/\S/) + 1 || 1;
      let start = col != null ? col + 1 : first;
      let end = col != null ? col + 2 : model.getLineMaxColumn(lineno);
      if (start >= model.getLineMaxColumn(lineno)) { start = Math.max(1, model.getLineMaxColumn(lineno) - 1); end = model.getLineMaxColumn(lineno); }
      if (this.editor.getModel() === model) {
        this.decorations.set([{
          range: new m.Range(lineno, 1, lineno, 1),
          options: {
            isWholeLine: true, className: 'error-line', glyphMarginClassName: 'error-glyph',
            glyphMarginHoverMessage: { value: message },
            overviewRuler: { color: '#e5484d', position: m.editor.OverviewRulerLane.Full },
          },
        }]);
      }
      m.editor.setModelMarkers(model, 'runtime', [{
        severity: m.MarkerSeverity.Error, message, startLineNumber: lineno, startColumn: start, endLineNumber: lineno, endColumn: end,
      }]);
    }

    clear() {
      this.decorations.clear();
      if (this.model && !this.model.isDisposed()) this.monaco.editor.setModelMarkers(this.model, 'runtime', []);
      this.model = null;
    }
  }

  /** Δείκτες σύνταξης (από τον checker) και ύποπτων χαρακτήρων. */
  function setSyntaxMarkers(monaco, model, result) {
    const markers = [];
    if (result && !result.ok && result.lineno) {
      const ln = Math.min(result.lineno, model.getLineCount());
      const maxCol = model.getLineMaxColumn(ln);
      let start = result.col != null ? result.col + 1 : (model.getLineContent(ln).search(/\S/) + 1 || 1);
      if (start >= maxCol) start = Math.max(1, maxCol - 1);
      const help = root.ErrorHelp.explain({
        exc_type: result.exc_type, message: result.message, char: result.char, encoding: result.encoding, phase: 'compile',
        location: { lineno: ln, col: result.col, line: model.getLineContent(ln) },
      }, { lines: model.getLinesContent() });
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `${help.title}\n(${result.exc_type}: ${result.message})`,
        startLineNumber: ln, startColumn: start, endLineNumber: ln, endColumn: Math.max(start + 1, start === 1 ? maxCol : start + 1),
      });
    }
    monaco.editor.setModelMarkers(model, 'syntax', markers);
  }

  function setCharMarkers(monaco, model) {
    const found = root.ErrorHelp.suspiciousChars(model.getValue());
    monaco.editor.setModelMarkers(model, 'chars', found.slice(0, 200).map((f) => ({
      severity: monaco.MarkerSeverity.Warning,
      message: `Ύποπτος χαρακτήρας: ${f.name}. Η Python χρειάζεται «${f.replacement || '(τίποτα)'}». Πάτησε Ctrl+. για διόρθωση.`,
      source: 'chars',
      code: f.replacement,
      startLineNumber: f.line, startColumn: f.col + 1, endLineNumber: f.line, endColumn: f.col + 2,
    })));
  }

  root.EditorSetup = {
    LANG,
    init(monaco) {
      registerLanguage(monaco);
      defineThemes(monaco);
      registerProviders(monaco);
    },
    editorOptions,
    ErrorMarks,
    setSyntaxMarkers,
    setCharMarkers,
  };
})(typeof self !== 'undefined' ? self : this);
