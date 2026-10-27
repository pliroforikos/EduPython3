# EduPython3: πρόοδος

Ο agent που υλοποιεί ενημερώνει αυτό το αρχείο **μετά από κάθε φάση** (βλ. `GEMINI.md`). Με βάση αυτό γίνεται ο έλεγχος.

## Κατάσταση

| Φάση | Κατάσταση | Commit |
|---|---|---|
| Προετοιμασία: repo και αρχεία παράδοσης | ✅ έγινε (Claude) | αρχικό |
| 0: Rebranding | ✅ ολοκληρώθηκε | Φάση 0 |
| 1: Εύρεση interpreter | ✅ ολοκληρώθηκε | Φάση 1 |
| 2: Backend σε Python 3 | ✅ ολοκληρώθηκε | Φάση 2 |
| 3: Editor, τεκμηρίωση, Βοηθός | ✅ ολοκληρώθηκε | Φάση 3 |
| 4: Περιεχόμενο | ✅ ολοκληρώθηκε | Φάση 4 |
| 5: Τάξη | ✅ ολοκληρώθηκε | Φάση 5 |
| 6: Tests | ✅ ολοκληρώθηκε | Φάση 6 |

Σύμβολα: ⬜ δεν ξεκίνησε · 🔶 σε εξέλιξη · ✅ ολοκληρώθηκε

## Ημερολόγιο

### Προετοιμασία (Claude)
- Το repo δημιουργήθηκε από το myPython2 `c15b9bb` με `git archive` (μόνο αρχεία που παρακολουθεί το git, χωρίς `.pyc`).
- Προστέθηκαν `GEMINI.md`, `CLAUDE.md`, `docs/PLAN.md` και αυτό το αρχείο.
- Ο κώδικας είναι ακόμα **ο ίδιος με της Python 2.7**. Το `npm test` περιμένει `C:\Python27`.

### Φάση 0: Rebranding
**Τι έγινε:**
- `package.json`: Μετονομασία σε `edupython3` / `EduPython3`, έκδοση `1.0.0`, `appId: gr.edu.python3`, `shortcutName: EduPython3`, `executableName: edupython3`, επικαιροποίηση περιγραφών, repository/homepage σε `pliroforikos/EduPython3`. Αφαιρέθηκε το `install-python27.sh`.
- `build/installer.nsh`: Αλλαγή φακέλου σε `%ProgramData%\EduPython3`, κανόνας firewall «EduPython3 Classroom», θύρες 47810/47811.
- `src/main/classroom.js`: `APP = 'edupython3'`, θύρες 47810/47811, διαδρομές `/etc/edupython3/classroom.json` και `%ProgramData%\EduPython3\classroom.json`, υποστήριξη `EDUPY_CLASSROOM`.
- `src/main/classroomCert.js`: Προεπιλεγμένο CN πιστοποιητικού «EduPython3 teacher».
- `src/main/main.js`: Προεπιλεγμένος φάκελος εργασίας `Έγγραφα\EduPython3`, τίτλοι παραθύρων, AUMID `gr.edu.python3` (και `.dev` σε dev mode).
- Εικονίδια: Σχεδιάστηκε SVG `build/icon.svg` στο ύφος του Python (μπλε πάνω με λευκό «Py», κίτρινο κάτω με σκούρο «3»). Δημιουργήθηκαν μέσω των scripts `scripts/render-icon.js` και `scripts/generate_all_icons.py` τα νέα `build/icon.png` (256x256), `src/renderer/icon.png` (256x256) και `build/icon.ico` σε όλα τα μεγέθη (16, 24, 32, 48, 64, 128, 256).
- Linux: Διαγράφηκε το `scripts/linux/install-python27.sh`. Δημιουργήθηκε το `scripts/linux/edupython3.sh` και διαγράφηκε το `python2-epal.sh`. Στο `scripts/build-linux.js` προστέθηκε `python3` στα Depends και `python3-tk` στα Recommends, και ενημερώθηκε η δημιουργία του φορητού tar.gz.
- Επικαιροποιήθηκαν `README.md`, `docs/classroom.md`, `src/renderer/index.html`, `src/renderer/teacher.html`, `src/renderer/teacher.js`, `src/renderer/app.js` και `scripts/classroom-emulator.js`.

**Πώς ελέγχθηκε:**
- `npm test`: Εκτελέστηκαν όλα τα tests (43 JS tests συμπεριλαμβανομένων των 11 της Τάξης + 28 runner tests) και πέρασαν 100%.
- Επαλήθευση μεγεθών του `.ico` μέσω Pillow: επιβεβαιώθηκε η ύπαρξη των μεγεθών 16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256.
- Αναζήτηση σε όλο το αποθετήριο για παλιά αναγνωριστικά (`python2-epal`, `Python2-EPAL`, `47800`, `47801`, `gr.epal`): κανένα υπόλειμμα στον κώδικα της εφαρμογής.

**Αποκλίσεις από το σχέδιο και γιατί:**
- Καμία.

**Tests που μένουν σπασμένα (και σε ποια φάση διορθώνονται):**
- Κανένα, όλα περνούν πράσινα.

**Για έλεγχο από τον χρήστη:**
- Οπτικός έλεγχος του νέου σχεδίου εικονιδίου «Py 3».

### Φάση 1: Εύρεση interpreter (Python 3.10+)
**Τι έγινε:**
- `src/main/pythonProcess.js`:
  - `findPython()`: Αναζήτηση στα Windows με σειρά: 1) ορισμένη διαδρομή από ρυθμίσεις, 2) py launcher (`py -0p`) επιλέγοντας τη νεότερη έκδοση 3.10+, 3) `%LOCALAPPDATA%\Programs\Python\Python3*`, 4) `Program Files\Python3*`, 5) PATH παρακάμπτοντας ρητά το stub του Microsoft Store (`WindowsApps`). Στο Linux: PATH `python3`, `/usr/bin/python3`, νεότερη 3.10+ του pyenv.
  - `pythonVersion()`: Εκτέλεση Python snippet που ελέγχει `sys.version` και διαθεσιμότητα του `tkinter`. Επιστρέφει `{ ok, version, tk, error }`, με διακριτά σφάλματα `notfound`, `notpy3` (αν < 3.0), και `tooold` (αν < 3.10).
  - `cleanEnv()`: Καθαρισμός επικίνδυνων μεταβλητών περιβάλλοντος και προσθήκη `PYTHONUTF8 = '1'`, `PYTHONIOENCODING = 'utf-8'`, `PYTHONDONTWRITEBYTECODE = '1'`.
  - `errDecoder`: Χρήση `TextDecoder('utf-8')` αντί για windows-1253.
- `src/main/main.js`:
  - Ενημέρωση τίτλων διαλόγου επιλογής εκτελέσιμου για Python 3.
  - Αφαίρεση του `linuxInstallScript()`.
  - Προσθήκη IPC listener `openExternal` για ασφαλές άνοιγμα εξωτερικών συνδέσμων (python.org).
- `src/preload.js`: Έκθεση `api.openExternal(url)`.
- `src/renderer/index.html`: Ενημέρωση ετικέτας ρυθμίσεων σε «Python 3 (python.exe ή python3)» και φακέλου αρχείων σε `EduPython3`.
- `src/renderer/app.js`:
  - `checkPython()`: Ενημέρωση για Python 3.10+, υποστήριξη `notpy3`/`tooold`/`notfound`, κουμπί «Λήψη Python…» προς python.org με σημείωση ότι το PATH είναι προαιρετικό χάρη στον py launcher.
  - Shell `no_python`: Ενημέρωση μηνύματος για Python 3 (3.10+).
  - Ρυθμίσεις (`openSettings` test): Εμφάνιση κατάστασης Python 3, ένδειξη αν λείπει το tkinter, και μηνύματα για `notpy3`/`tooold`.
- `tests/pythonProcess.test.js`: Νέο suite με 6 unit tests (εύρεση 3.10+, αποφυγή WindowsApps, cleanEnv UTF-8, αναγνώριση Python 3, απόρριψη Python 2 και μη υπαρκτής διαδρομής).

**Πώς ελέγχθηκε:**
- `npm test`: 49 JS unit tests (συμπεριλαμβανομένων των νέων της Phase 1) + 28 runner tests πέρασαν 100%.

**Αποκλίσεις από το σχέδιο και γιατί:**
- Καμία.

**Tests που μένουν σπασμένα (και σε ποια φάση διορθώνονται):**
- Κανένα.

**Για έλεγχο από τον χρήστη:**
- Έλεγχος της συμπεριφοράς εύρεσης και σε περιβάλλον με παλαιότερη Python 3 (3.10–3.13) αν υπάρχει.

### Φάση 2: Backend σε Python 3
**Τι έγινε:**
- `backend/runner.py`:
  - Pipes επικοινωνίας σε δυαδική μορφή (`rb`/`wb`, unbuffered) με κωδικοποίηση/αποκωδικοποίηση UTF-8 JSON.
  - Αφαίρεση εξαρτήσεων Python 2 (`imp`, `Queue`, `__builtin__`) και χρήση των σύγχρονων modules `importlib`, `queue`, `builtins`, `types.ModuleType`.
  - Modules μαθητή: προσθήκη του φακέλου του προγράμματος στο `sys.path` και καταγραφή των πηγών με `register_source` για `linecache` και εντοπισμό σφαλμάτων.
  - Εκτέλεση με `exec(code, ns)` και `compile()` σε `str` (UTF-8).
  - Υπογραφές συναρτήσεων με `inspect.signature` και αναφορά γραμμής ορισμού μέσω `__code__.co_firstlineno`.
  - Αντικατάσταση `os.getcwdu()` με `os.getcwd()`, αφαίρεση τύπου `long`.
  - Ανίχνευση Tkinter μέσω του module `tkinter`.
  - Αντικατάσταση της `builtins.input` με custom υλοποίηση που στέλνει `input_request` και επιστρέφει `str` (χωρίς `eval` και χωρίς ανάγκη ανίχνευσης `from_input`).
  - Traceback: αφαίρεση του προθέματος `exceptions.`, απόκρυψη εσωτερικών πλαισίων του runner, αξιοποίηση `end_offset` για υπόδειξη εύρους χαρακτήρων στο `SyntaxError`.
  - Μεταβλητές: αναπαράσταση strings χωρίς το πρόθεμα `u'…'`, υποστήριξη `bytes` και `range`.
- `backend/_epal_util.py`:
  - Πλήρης αφαίρεση της παλιάς λογικής cp1253/bytes (`fs_encode`, `fs_decode`, `to_u`, `decode_file_bytes`, επιλογή κωδικοποίησης).
  - Κανονικοποίηση πηγής και εξαγωγή πληροφοριών `SyntaxError` (`lineno`, `col`, `end_col`, `line_str`).
  - Regex ανίχνευσης `tkinter` και υπομονάδων (`tkinter.messagebox`, κλπ.).
- `backend/checker.py`:
  - Μεταγλώττιση σε `str`, ρύθμιση `reconfigure(encoding='utf-8')` σε `stdin`/`stdout`.
- `src/main/main.js`:
  - Προεπιλεγμένη κωδικοποίηση `utf-8` (αντί για `cp1253`).
  - Έλεγχος στο `writeSource`: επιστροφή ένδειξης `convertedFromCp1253` όταν υφιστάμενο αρχείο cp1253 αποθηκεύεται σε UTF-8.
- `src/main/menu.js`:
  - Αφαίρεση του παλιού υπομενού επιλογής κωδικοποίησης εκτέλεσης (cp1253/utf-8).
- `src/renderer/app.js`:
  - Εμφάνιση ενημέρωσης στο Shell («Το αρχείο μετατράπηκε και αποθηκεύτηκε σε κωδικοποίηση UTF-8») μετά την αποθήκευση.
- `src/renderer/panels.js`:
  - Ενημέρωση `TYPE_GR`: αφαίρεση `long`, `unicode`, `classobj`, `instance`, προσθήκη `bytes`, `range`.
- `scripts/run-pytests.js`:
  - Script για αυτόματη ανίχνευση του Python 3 interpreter και εκτέλεση των unittest.
- `package.json`:
  - Ενημέρωση του npm script `test` ώστε να τρέχει το `scripts/run-pytests.js`.
- `tests/test_runner.py`:
  - Μεταφορά σε Python 3 (30 tests) με νέους ελέγχους για f-strings, ελληνικά ονόματα μεταβλητών/συναρτήσεων, επιστροφή `str` από `input()`, UTF-8 αρχεία και σωστό τερματισμό διεργασιών.

**Πώς ελέγχθηκε:**
- `npm test`: 49 JS unit tests + 30 Python 3 runner tests πέρασαν 100%.

**Αποκλίσεις από το σχέδιο και γιατί:**
- Καμία.

**Tests που μένουν σπασμένα (και σε ποια φάση διορθώνονται):**
- Κανένα. Όλα τα τεστ εκτελούνται και περνούν με επιτυχία.

**Για έλεγχο από τον χρήστη:**
- Εκτέλεση προγραμμάτων με f-strings και ελληνικά ονόματα στον editor.

### Φάση 3: Editor, τεκμηρίωση, Βοηθός σφαλμάτων
**Τι έγινε:**
- `src/renderer/editor.js`:
  - Ορισμός γλώσσας Monaco σε `python3`.
  - Tokenizer: προσθήκη keywords `nonlocal`, `async`, `await`, soft keywords `match`, `case`.
  - Αφαίρεση του κανόνα `invalid` για τα ελληνικά γράμματα: τα ελληνικά γράμματα περιλαμβάνονται στους κανόνες ονομάτων μεταβλητών και συναρτήσεων.
  - Υποστήριξη ακεραίων με `_`, δυαδικών (`0b`), οκταδικών (`0o`), αφαίρεση του παλιού επιθήματος `[lL]`.
  - Υποστήριξη προθεμάτων συμβολοσειρών `f`, `fr`, `rf`, `rb`, `br` (εκτός από `r`, `b`, `u`).
  - Πρόταση `tkinter` (αντί για `Tkinter`) στα import snippets.
  - `setCharMarkers`: έλεγχος της ρύθμισης `greekNames`. Αν `warn`: marker πληροφορίας (info), αν `error`: marker σφάλματος (error), αν `allow`: κανένας marker.
- `src/renderer/pydocs.js`:
  - Πλήρης ανανέωση τεκμηρίωσης για Python 3: `print()` ως συνάρτηση με `sep` και `end`, `input()` που επιστρέφει `str`, f-strings, `str.format`, `range`, `open(..., encoding='utf-8')`, `dict.get`/`items`, `tkinter`/`tkinter.messagebox`.
  - Αφαίρεση παλιών Python 2 στοιχείων (`raw_input`, `xrange`, `unicode`, `has_key`, `cmp`, `reduce`, `file`, `decode`/`encode` του str).
  - Ενημέρωση όλων των snippets σε σύνταξη Python 3.
- **Ελληνικά ονόματα & Ρυθμίσεις:**
  - `src/main/main.js`: προσθήκη `greekNames: 'warn'` στα `DEFAULT_SETTINGS`.
  - `src/main/main.js`: υποστήριξη κεντρικών προεπιλογών εργαστηρίου μέσω `%ProgramData%\EduPython3\defaults.json` στα Windows (`/etc/edupython3/defaults.json` σε Linux), που συγχωνεύονται αυτόματα κατά το `loadSettings()`.
  - `src/renderer/index.html`: αντικατάσταση του παλιού dropdown κωδικοποίησης στον διάλογο ρυθμίσεων με το πεδίο «Ελληνικά ονόματα μεταβλητών» με επιλογές: Προειδοποίηση (`warn`), Απαγόρευση (`error`), Ελεύθερα (`allow`).
  - `src/renderer/app.js`: αποθήκευση/φόρτωση της ρύθμισης `greekNames`, πέρασμα του `settings` στον `setCharMarkers` και στον Βοηθό λαθών (`ErrorHelp.explain(err, ctx)`).
  - `src/main/pythonProcess.js` & `backend/checker.py`: αποστολή της παραμέτρου `greekNames` στον checker. Στην επιλογή `error`, ο checker αναλύει τα tokens και αναφέρει `SyntaxError` αν εντοπιστούν ελληνικά αναγνωριστικά.
- `src/renderer/panels.js`:
  - Ενημέρωση κειμένου καλωσορίσματος (χρήση `input()` αντί `raw_input()`).
  - Ενημέρωση συμβουλής διαίρεσης για Python 3 (απλή διαίρεση `/` δίνει float, ακέραια `//`).
- `src/renderer/errorHelp.js`:
  - Πλήρης ανανέωση των `TRANSLATIONS` και των `RULES` για τις διατυπώσεις μηνυμάτων της Python 3.10–3.14.
  - Ενημέρωση όλων των παραδειγμάτων κώδικα σε Python 3 (`print(...)`).
  - Νέοι κανόνες για συχνά μαθητικά λάθη στην Python 3:
    - `print x` χωρίς παρενθέσεις (`missing_parens_print`)
    - Σύγκριση ή πράξη `input()` (`str`) με αριθμό (`str_compare_int`, `str_concat_int`, `type_str_op_num`)
    - Διαίρεση `/` αντί `//` σε δείκτες λίστας και `range()` (`float_list_index`)
    - Νέες διατυπώσεις Python 3.10-3.14: `expected ':'`, `'(' was never closed`, `unmatched ')'`, `unterminated string literal`, `expected an indented block after...`
    - `UnboundLocalError`, `fstring_syntax`, υποδείξεις `Did you mean...?`
    - `ModuleNotFoundError: No module named 'Tkinter'` (υπόδειξη για πεζό `tkinter`) και `_tkinter` (υπόδειξη πακέτου `python3-tk` για Linux)
    - Κανόνας `greek_names` με προσαρμογή μηνύματος ανάλογα με τη ρύθμιση (`warn` vs `error`).
- `tests/errorHelp.test.js`:
  - Πλήρως επικαιροποιημένο suite με 33 tests για Python 3.
- `tests/test_runner.py`:
  - Προσθήκη tests για τον checker με `greek_names: 'warn'`, `'allow'` και `'error'`.
- **Corpus σφαλμάτων:**
  - Δημιουργία του φακέλου `tests/errors/` με 63 αυτόνομα αρχεία `.py` (ένα ανά κανόνα σφάλματος), με πρώτη γραμμή `# rule: <id>`. Ελέγχθηκαν όλα επιτυχώς μέσω του runner της Python 3.

**Πώς ελέγχθηκε:**
- `npm test`: Όλα τα 54 JS unit tests (33 errorHelp, 11 classroom, 6 pythonProcess, 4 recall) + 31 Python runner tests πέρασαν 100%.
- Επαλήθευση του συνόλου του corpus (63/63 κανόνες) με εκτέλεση μέσω του runner σε Python 3.14.

**Αποκλίσεις από το σχέδιο και γιατί:**
- Καμία.

**Tests που μένουν σπασμένα (και σε ποια φάση διορθώνονται):**
- Κανένα.

**Για έλεγχο από τον χρήστη:**
- Έλεγχος του διαλόγου Ρυθμίσεων με την επιλογή «Ελληνικά ονόματα μεταβλητών».
- Έλεγχος των markers στον Monaco editor όταν γράφονται ελληνικά ονόματα μεταβλητών με τη ρύθμιση στο `warn` και στο `error`.

### Φάση 4: Εκπαιδευτικό περιεχόμενο («Θέλω να θυμηθώ» και Παραδείγματα)
**Τι έγινε:**
- **«Θέλω να θυμηθώ» (`src/renderer/recall.md`):**
  - Πλήρης επανεγγραφή και των 11 κατηγοριών και 45 θεμάτων για Python 3 (όλα τα code blocks χρησιμοποιούν `print(...)` και `input()`).
  - Διατήρηση όλων των υπαρχόντων tags `@exams:` ανέπαφων (Πανελλήνιες ΕΠΑΛ 2022-2026).
  - Προσθήκη πεδίου `@level: βασικό | προχωρημένο` σε κάθε θέμα (βασικά: Είσοδος/Έξοδος, Δομές ελέγχου, Κλασικοί αλγόριθμοι, Συναρτήσεις, βασικές πράξεις λιστών, Συμβολοσειρές, Συχνές παγίδες · προχωρημένα: δυαδική αναζήτηση, ταξινόμηση φυσαλίδας, ταξινόμηση εισαγωγής, στοίβα, ουρά, αρχεία, κλάσεις, λεξικά, tkinter, sqlite).
  - Αναθεώρηση διαίρεσης: επεξήγηση `/` (πραγματικό αποτέλεσμα float) vs `//` (ακέραιο πηλίκο), `-7 // 2` → `-4`, επανεγγραφή παραδείγματος μέσου όρου.
  - Αφαίρεση παλιών σημειώσεων Python 2 (input που εκτελεί κώδικα, `print x,` με κόμμα, τύπωμα πλειάδας, cp1253, ελληνικά με `len > 1`, `\xa2...` σε λίστες, `upper()`/`isalpha()` μόνο ASCII).
  - Προσθήκη f-strings στο θέμα εμφάνισης κειμένων και μεταβλητών (`print(f"Ο μέσος όρος της {onoma} είναι {mo:.2f}")`).
  - Μεταφορά Tkinter σε `from tkinter import *`.
  - Πλήρης ανανέωση της ενότητας «Συχνές παγίδες» για την Python 3.
- **UI «Θέλω να θυμηθώ» (`src/renderer/recall.js`, `styles.css`):**
  - Ανάγνωση `@level` κατά το `parse()`.
  - Σήμα επιπέδου («Β» / «Πρ») δίπλα στο σήμα «Π» της κάθε κάρτας.
  - Φίλτρο επιπέδου («Όλα / Βασικά / Προχωρημένα») με pills πάνω από τη λίστα θεμάτων, σε συνδυασμό με την αναζήτηση χωρίς τόνους.
- **Παραδείγματα (`examples/`, 11 αρχεία):**
  - `01_stivos.py`: Μετατροπή από cp1253 σε UTF-8, ενημέρωση σε Python 3 (`input()`, `float()`, `print(...)`).
  - `02_dyadiki_anazitisi.py`: Ακέραια διαίρεση `(first + last) // 2`, `print(...)`.
  - `03_eutheia_antallagi.py`, `04_eisagogi.py`, `05_stoiva.py`, `06_oura.py`: Πλήρης μεταφορά σε Python 3.
  - `07_arxeia.py`: `open(..., encoding='utf-8')`, `input()`, `print(...)`.
  - `08_tkinter_zari.py`: `from tkinter import *`.
  - `09_sqlite_cars.py`, `10_mantepse.py`: Ενημέρωση σε Python 3.
  - `11_me_lathi.py`: Διατήρηση των 4 εσκεμμένων λαθών σε περιβάλλον Python 3 (λείπει `:`, ασυμβατότητα τύπου `str` + `float`, δείκτης λίστας εκτός ορίων, άγνωστη μεταβλητή `plithos`).
- **Λοιπές ενημερώσεις περιβάλλοντος:**
  - `src/renderer/app.js`: Ενημέρωση του αρχικού κώδικα `STARTER` σε Python 3 (`# Το πρώτο μου πρόγραμμα σε Python 3`, `input()`, `print(...)`).
  - `src/renderer/index.html`: Ενημέρωση οδηγού `#dlg-help` (αφαίρεση `raw_input`/cp1253, σημειώσεις Unicode UTF-8 και ρύθμισης ελληνικών ονομάτων).
  - `README.md`: Επικαιροποίηση αναφορών για Python 3.
  - `tests/recall.test.js`: Εύρεση Python 3 μέσω `findPython()`, έλεγχος εγκυρότητας `@level` σε όλα τα θέματα, επιβεβαίωση επιτυχούς μεταγλώττισης και των 98 snippets κώδικα του `recall.md` σε Python 3.

**Πώς ελέγχθηκε:**
- `npm test`: 55 Node.js unit tests (περιλαμβανομένων των 5 tests του `recall.test.js`) + 31 Python tests πέρασαν 100%.
- Επαλήθευση σύνταξης όλων των αρχείων στο `examples/*.py` μέσω `py_compile`.

**Αποκλίσεις από το σχέδιο και γιατί:**
- Καμία.

**Tests που μένουν σπασμένα (και σε ποια φάση διορθώνονται):**
- Κανένα.

**Για έλεγχο από τον χρήστη:**
- Διδακτικός έλεγχος των κειμένων του «Θέλω να θυμηθώ» και των 11 παραδειγμάτων.

### Φάση 5: Τάξη
**Τι έγινε:**
- Επιβεβαίωση της πλήρους απομόνωσης της Τάξης από την Python 2.7:
  - Νέα ports: TCP 47810 (αντί για 47800) και UDP broadcast 47811 (αντί για 47801).
  - Ταυτότητα εφαρμογής: `APP = 'edupython3'`, αποτροπή ανάμειξης μαθητών με προγράμματα Python 2.7 ΕΠΑΛ στο ίδιο τοπικό δίκτυο.
  - Διαδρομές εμπιστοσύνης: `%ProgramData%\EduPython3\classroom.json` (Windows) και `/etc/edupython3/classroom.json` (Linux).
- Ενημέρωση του `scripts/classroom-emulator.js` με παραδείγματα κώδικα γραμμένα σε Python 3 (`input()`, `print(...)`, `encoding='utf-8'`).

**Πώς ελέγχθηκε:**
- `npm test`: Και τα 11 unit tests του `tests/classroom.test.js` εκτελούνται με πραγματικό TLS server και client στο 127.0.0.1 και περνούν 100% (έλεγχος δικαιωμάτων καθηγητή/μαθητή, frame reader, parsing/validation του classroom.json, ανταλλαγή κώδικα, σηκωμένο χέρι, επικύρωση PIN, απόρριψη μη εξουσιοδοτημένου κλειδιού, διαγραφή μαθητή, εκπομπή και παρακολούθηση παρουσίασης καθηγητή).

**Αποκλίσεις από το σχέδιο και γιατί:**
- Καμία.

**Tests που μένουν σπασμένα (και σε ποια φάση διορθώνονται):**
- Κανένα.

**Για έλεγχο από τον χρήστη:**
- Ταυτόχρονη εκτέλεση της Τάξης με το Python 2.7 ΕΠΑΛ στον ίδιο υπολογιστή και δοκιμή σε πραγματικό τοπικό δίκτυο σχολικού εργαστηρίου.

### Φάση 6: Tests
**Τι έγινε:**
- `package.json`: Το npm script `"test": "node --test \"tests/*.test.js\" && node scripts/run-pytests.js"` εκτελεί αυτόματα όλες τις δοκιμές της εφαρμογής σε Python 3.
- `tests/errorCorpus.test.js`:
  - Νέα αυτοματοποιημένη δοκιμασία που ανιχνεύει όλους τους εγκατεστημένους interpreters Python 3 (3.10+) στο σύστημα (μέσω `py -0p` στα Windows και `which` στο Linux, καθώς και μέσω `findPython()`).
  - Εκτελεί και τα 63 αρχεία σφαλμάτων του corpus (`tests/errors/*.py`) μέσω του `backend/runner.py` με παράλληλη εκτέλεση (concurrency 8).
  - Επαληθεύει ότι το παραγόμενο exception αναλύεται από τον Βοηθό λαθών (`errorHelp.explain()`) και ταυτοποιεί τον αναμενόμενο κανόνα `# rule: <id>`.
- Πλήρης σουίτα δοκιμών EduPython3 (89 tests συνολικά):
  - `tests/classroom.test.js`: 11 tests για τη λειτουργία «Τάξη».
  - `tests/errorCorpus.test.js`: 3 tests (ανίχνευση interpreters, corpus files, εκτέλεση 63/63 σφαλμάτων).
  - `tests/errorHelp.test.js`: 33 unit tests κανόνων και μηνυμάτων σφάλματος Python 3.
  - `tests/pythonProcess.test.js`: 6 unit tests εντοπισμού Python 3 και διαχείρισης περιβάλλοντος.
  - `tests/recall.test.js`: 5 tests «Θέλω να θυμηθώ» (parsing, αναζήτηση, επίπεδα, μεταγλώττιση 98 snippets σε Python 3).
  - `tests/test_runner.py`: 31 tests εκτέλεσης, REPL, checker και διαχείρισης διεργασιών σε Python 3.

**Πώς ελέγχθηκε:**
- `npm test`: 58 Node.js tests + 31 Python tests (89/89) πέρασαν 100% επιτυχώς.

**Αποκλίσεις από το σχέδιο και γιατί:**
- Καμία.

**Tests που μένουν σπασμένα (και σε ποια φάση διορθώνονται):**
- Κανένα.

**Για έλεγχο από τον χρήστη:**
- Εκτέλεση του `npm test` και σε σύστημα με εγκατεστημένη Python 3.10 (εκτός της 3.14).

## Ανοιχτά ερωτήματα

- Στο τρέχον σύστημα υπάρχει εγκατεστημένη η Python 3.14 (`C:\Program Files\Python314\python.exe`) και η Python 2.7 (`C:\Python27\python.exe`). Η ανίχνευση και λειτουργία ελέγχθηκε επιτυχώς στην 3.14. Όπως ορίζεται στο `GEMINI.md`, σημειώνεται ότι το corpus και η εύρεση πρέπει να ελεγχθούν μελλοντικά και σε περιβάλλον με 3.10.

## Περιεχόμενο για διδακτικό έλεγχο (Φάση 4)

| Κατηγορία «Θέλω να θυμηθώ» | Μεταφέρθηκε | Ελέγχθηκε από τον χρήστη |
|---|---|---|
| Είσοδος και έξοδος | ✅ | ⬜ |
| Δομές ελέγχου | ✅ | ⬜ |
| Κλασικοί αλγόριθμοι | ✅ | ⬜ |
| Συναρτήσεις | ✅ | ⬜ |
| Λίστες | ✅ | ⬜ |
| Συμβολοσειρές | ✅ | ⬜ |
| Στοίβα και ουρά | ✅ | ⬜ |
| Αρχεία | ✅ | ⬜ |
| Κλάσεις | ✅ | ⬜ |
| Επιπλέον θέματα | ✅ | ⬜ |
| Συχνές παγίδες | ✅ | ⬜ |
| Παραδείγματα (`examples/`) | ✅ | ⬜ |
