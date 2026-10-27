# EduPython3: πρόοδος

Ο agent που υλοποιεί ενημερώνει αυτό το αρχείο **μετά από κάθε φάση** (βλ. `GEMINI.md`). Με βάση αυτό γίνεται ο έλεγχος.

## Κατάσταση

| Φάση | Κατάσταση | Commit |
|---|---|---|
| Προετοιμασία: repo και αρχεία παράδοσης | ✅ έγινε (Claude) | αρχικό |
| 0: Rebranding | ✅ ολοκληρώθηκε | Φάση 0 |
| 1: Εύρεση interpreter | ✅ ολοκληρώθηκε | Φάση 1 |
| 2: Backend σε Python 3 | ✅ ολοκληρώθηκε | Φάση 2 |
| 3: Editor, τεκμηρίωση, Βοηθός | ⬜ | |
| 4: Περιεχόμενο | ⬜ | |
| 5: Τάξη | ⬜ | |
| 6: Tests | ⬜ | |

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

## Ανοιχτά ερωτήματα

- Στο τρέχον σύστημα υπάρχει εγκατεστημένη η Python 3.14 (`C:\Program Files\Python314\python.exe`) και η Python 2.7 (`C:\Python27\python.exe`). Η ανίχνευση και λειτουργία ελέγχθηκε επιτυχώς στην 3.14. Όπως ορίζεται στο `GEMINI.md`, σημειώνεται ότι το corpus και η εύρεση πρέπει να ελεγχθούν μελλοντικά και σε περιβάλλον με 3.10.

## Περιεχόμενο για διδακτικό έλεγχο (Φάση 4)

| Κατηγορία «Θέλω να θυμηθώ» | Μεταφέρθηκε | Ελέγχθηκε από τον χρήστη |
|---|---|---|
| Είσοδος και έξοδος | ⬜ | ⬜ |
| Δομές ελέγχου | ⬜ | ⬜ |
| Κλασικοί αλγόριθμοι | ⬜ | ⬜ |
| Συναρτήσεις | ⬜ | ⬜ |
| Λίστες | ⬜ | ⬜ |
| Συμβολοσειρές | ⬜ | ⬜ |
| Στοίβα και ουρά | ⬜ | ⬜ |
| Αρχεία | ⬜ | ⬜ |
| Κλάσεις | ⬜ | ⬜ |
| Επιπλέον θέματα | ⬜ | ⬜ |
| Συχνές παγίδες | ⬜ | ⬜ |
| Παραδείγματα (`examples/`) | ⬜ | ⬜ |
