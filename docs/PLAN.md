# EduPython3: σχέδιο μεταφοράς σε Python 3

## Πλαίσιο

Το «Python 2.7 ΕΠΑΛ» (myPython2) λειτουργεί καλά ως εκπαιδευτικό περιβάλλον. Η **EduPython3** είναι η αδελφή εφαρμογή για **Python 3**, για Γυμνάσιο, Λύκειο, ΕΠΑΛ και αυτοδίδακτους. Τα διδακτικά θέματα μένουν τα ίδια: τα 11 παραδείγματα και τα 45 θέματα του «Θέλω να θυμηθώ».

Περίπου το 70% του κώδικα μεταφέρεται αυτούσιο: Τάξη, IPC/preload, shell, panels, parser του «Θέλω να θυμηθώ», build και installer. Η Python 2.7 είναι δεμένη σε τρία σημεία:
1. το backend (`backend/runner.py`, `_epal_util.py`),
2. τους ελληνικούς πίνακες γνώσης (`errorHelp.js`, `pydocs.js`, μέρη του `editor.js`/`panels.js`),
3. το περιεχόμενο (`recall.md`, `examples/`, βοήθεια).

### Αποφάσεις του χρήστη (δεν αλλάζουν)

| Θέμα | Απόφαση |
|---|---|
| Αποθετήριο | Νέο repo `EduPython3`, αντίγραφο του myPython2 στο `c15b9bb`. Το myPython2 μένει ανέγγιχτο. |
| Python | **Την εγκαθιστά ο χρήστης** (python.org ή διανομή Linux). Δεν ενσωματώνεται στον installer. |
| Ελληνικά ονόματα μεταβλητών | **Ρύθμιση**: ελεύθερα / με υπόδειξη / ως λάθος. Προεπιλογή: με υπόδειξη. |
| «Θέλω να θυμηθώ» | Ίδια θέματα σε Python 3, με **ετικέτα επιπέδου** (Βασικό / Προχωρημένο). Το «Π» των Πανελληνίων μένει. |
| Όνομα | **EduPython3**: `productName` EduPython3, `appId` `gr.edu.python3`, πακέτο `edupython3`. |

### Τεχνικές αποφάσεις του σχεδίου

- **Υποστηριζόμενες εκδόσεις: Python 3.10 έως 3.14.** Η 3.10 είναι το κατώφλι των σύγχρονων μηνυμάτων σφάλματος («Did you mean», «'(' was never closed», «expected ':'»), πάνω στα οποία στηρίζεται ο Βοηθός. Με παλαιότερη έκδοση η εφαρμογή δείχνει μήνυμα «χρειάζεται 3.10+».
- **Τάξη: νέα ports 47810/47811 και νέο αναγνωριστικό `edupython3`.** Έτσι οι δύο εφαρμογές συνυπάρχουν σε μικτό εργαστήριο χωρίς να βλέπει η μία τους μαθητές της άλλης. Το πρωτόκολλο μένει ίδιο.
- **Αρχεία πάντα UTF-8.** Αρχεία cp1253 από την 2.7 ανοίγουν σωστά, γιατί το `encoding.js` κρατά την ανίχνευση. Αποθηκεύονται ως UTF-8 και εμφανίζεται ενημέρωση. Το υπομενού «Κωδικοποίηση ελληνικών» αφαιρείται.

---

## Φάση 0: Rebranding

Το repo έχει ήδη δημιουργηθεί από το myPython2 (`c15b9bb`), χωρίς `.git`, `dist/`, `node_modules/` και `.pyc`.

Αλλαγές ονομάτων:
- **`package.json`**: name, productName, appId, `nsis.shortcutName` «EduPython3», artifactNames, `linux.executableName`, maintainer/synopsis/description, repository/homepage → `pliroforikos/EduPython3`. Αφαιρείται το extraResource `install-python27.sh`.
- **`build/installer.nsh`**: `%ProgramData%\EduPython3` και κανόνας firewall «EduPython3 Classroom».
- **`src/main/classroom.js`**:
  - `APP = 'edupython3'`
  - ports 47810/47811
  - `/etc/edupython3/classroom.json`
  - μεταβλητή περιβάλλοντος `EDUPY_CLASSROOM`
- **`src/main/classroomCert.js`**: όνομα πιστοποιητικού «EduPython3 teacher».
- **`src/main/main.js`**:
  - φάκελος εργασίας `Έγγραφα\EduPython3`
  - τίτλοι παραθύρων
  - AUMID `gr.edu.python3`, με `.dev` όταν δεν είναι packaged (βλ. `GEMINI.md`)
- **Εικονίδια**: νέα `build/icon.ico`, `build/icon.png` και `src/renderer/icon.png` με «Py 3». Σχεδίασέ τα σε SVG και μετάτρεψέ τα σε όλα τα μεγέθη.
- **Καθαρισμός**:
  - διαγραφή `scripts/linux/install-python27.sh`
  - στο deb (`scripts/build-linux.js`): `Depends: python3`, `Recommends: python3-tk`
- `README.md` και `docs/classroom.md`: όνομα, ports, διαδρομές. Το περιεχόμενο για Python 3 έρχεται στη Φάση 4.

## Φάση 1: Εύρεση interpreter (`src/main/pythonProcess.js`)

Μένουν ως έχουν τα `Backend`, `Checker`, `lineReader`, `killTree` και `cleanEnv`. Αλλάζουν μόνο τα `findPython`/`pythonVersion` (γραμμές 17-71).

**Σειρά αναζήτησης στα Windows:**
1. η διαδρομή από τις Ρυθμίσεις
2. ο **py launcher**: `py -0p`, επιλέγεται η νεότερη 3.10+
3. `%LOCALAPPDATA%\Programs\Python\Python3*\python.exe`
4. `C:\Program Files\Python3*\python.exe`
5. `python.exe` στο PATH, **εκτός** από το `…\WindowsApps\python.exe` (stub του Microsoft Store που ανοίγει το Store)

**Σειρά αναζήτησης στο Linux:** `python3` στο PATH, `/usr/bin/python3`, νεότερη 3.x του pyenv.

**Έλεγχος έκδοσης:**
- Επιστρέφει `{version, tk}`. Το `tk` προκύπτει από `import tkinter`, ώστε να βγαίνει υπόδειξη «εγκατάστησε python3-tk».
- Σφάλματα: `notfound`, `notpy3`, `tooold`.
- Στο `cleanEnv` προστίθενται `PYTHONUTF8=1` και `PYTHONIOENCODING=utf-8`. Φεύγει το σχόλιο για «Python 3 που χαλάει την Python 2», αλλά οι μεταβλητές συνεχίζουν να καθαρίζονται.
- Η αποκωδικοποίηση stderr ως windows-1253 (γραμμή ~139) γίνεται utf-8.

**`app.js`, `index.html`:** τα μηνύματα «δεν βρέθηκε Python» δείχνουν οδηγίες για το python.org (με «Add to PATH» προαιρετικό, αφού βρίσκουμε τον py launcher) και κουμπί που ανοίγει τη σελίδα λήψης. Ενημερώνονται και οι διάλογοι ελέγχου Python (`app.js` 197-217, 662-663, 1131).

## Φάση 2: Backend σε Python 3 (`backend/`)

Το `runner.py` (770 γραμμές) κρατά τον σχεδιασμό του:
- πρωτόκολλο JSON ανά γραμμή με τους ίδιους τύπους μηνυμάτων, άρα το renderer δεν αλλάζει
- ιδιωτικά fd 0/1 και περιορισμός ρυθμού εξόδου (`_OutputBuffer`)
- βήμα-βήμα με `sys.settrace` (`_Trace`), `describe_globals`
- απόκρυψη star-import και pumping του Tk

Αλλαγές (οι γραμμές αναφέρονται στο αρχικό αρχείο):
- **Pipes πρωτοκόλλου:** binary, με `json.dumps(...).encode('utf-8')`, γραμμές 47-62.
- **Imports:** `queue`, `builtins`, `importlib`. Φεύγουν τα `imp`, `Queue` και `__builtin__` (24-29).
- **Modules του μαθητή:** το custom importer (260-296) αντικαθίσταται με φάκελο του προγράμματος στο `sys.path` και καταγραφή των πηγών για το traceback. Αν χρειαστεί, χρησιμοποιείται finder με `importlib.util.spec_from_file_location`.
- **Εκτέλεση:**
  - `exec(code, ns)` (292, 687, 737) και `compile(source_str, path, 'exec')` με str (όχι bytes)
  - `inspect.signature` αντί για `getargspec` (516), χωρίς `basestring`/`func_code` (522, 548)
  - `os.getcwd()` αντί για `os.getcwdu()` (396, 448, 670)
  - το `long` φεύγει (692)
  - το Tk pumping ψάχνει το module `tkinter` (198)
- **`input()`:** αντικαθίσταται το `builtins.input`, ώστε να στέλνει `input_request`. Η ανίχνευση `from_input` (431-438) αφαιρείται, γιατί η `input()` δεν αξιολογεί πια κώδικα.
- **Traceback:**
  - ίδια μορφή, όπου ο τύπος της εξαίρεσης δεν έχει πια πρόθεμα `exceptions.` (335)
  - εμφανίζεται μόνο η τελική εξαίρεση της αλυσίδας `__context__`, για απλότητα
  - οι στήλες του `SyntaxError` είναι πλέον σε χαρακτήρες, και χρησιμοποιείται και το `end_offset` για υπογράμμιση εύρους
- **Μεταβλητές:** χωρίς το πρόθεμα `u'…'` (459-465). Το `TYPE_GR` στο `panels.js` ενημερώνεται: φεύγουν τα `long`/`unicode`/`classobj`/`instance`, μπαίνουν `bytes`, `range`, `NoneType`.
- **`_epal_util.py`:** μένουν μόνο η ανίχνευση tkinter (`tkinter`, `tkinter.messagebox`) και τα SyntaxError helpers. Όλη η λογική cp1253/bytes φεύγει (`fs_encode`/`fs_decode`/`to_u`, επιλογή κωδικοποίησης).
- **`checker.py`:** `compile()` σε str, με ρύθμιση για τα ελληνικά ονόματα (βλ. Φάση 3).
- **`main.js`/`menu.js`/`encoding.js`:** default `utf-8` (στο `main.js` γραμμή 16 είναι `cp1253`). Αφαίρεση του υπομενού κωδικοποίησης (`menu.js` 94-102). Ενημέρωση όταν ένα αρχείο cp1253 αποθηκεύεται ως UTF-8.
- **Tests:** `tests/test_runner.py` (28 tests) σε Python 3, με νέα για `input()`, f-strings και ελληνικά ονόματα.

## Φάση 3: Editor, τεκμηρίωση, Βοηθός σφαλμάτων

**`editor.js`:**
- γλώσσα `python3`
- keywords `nonlocal`, `async`/`await`, soft keywords `match`/`case`
- προθέματα f/rb, αριθμοί με `_`, χωρίς επίθημα `L` (68-75)
- `tkinter` στις προτάσεις import (197)
- φεύγει το `IOError` ως ξεχωριστό (7-10)

**Ελληνικά ονόματα:** η ρύθμιση `greekNames: 'allow' | 'warn' | 'error'` εμφανίζεται στον διάλογο Ρυθμίσεων.
- `allow`: τίποτα
- `warn`: marker πληροφορίας στον editor (σήμερα στο `editor.js` 62 τα ελληνικά σημειώνονται invalid) και κάρτα στον Βοηθό («επιτρέπεται, αλλά στις εξετάσεις γράφουμε λατινικά· πρόσεξε α/a, ο/o»)
- `error`: όπως σήμερα στην 2.7
- Σε εργαστήριο, η προεπιλογή μπορεί να οριστεί από το `%ProgramData%\EduPython3\defaults.json` (Linux: `/etc/edupython3/defaults.json`), που διαβάζεται μία φορά κατά το `loadSettings`.

**`pydocs.js`:** ξαναγράφονται τα `print()`, `input()` (επιστρέφει πάντα str), `range`, f-strings, `str.format`, `open(..., encoding=)`, `dict.get`/`items`, `tkinter`/`messagebox`. Φεύγουν τα `raw_input`, `xrange`, `unicode`, `has_key`, `cmp`, `reduce` ως builtin, `decode`/`encode` του str. Ενημερώνονται τα snippets (222-230).

**`errorHelp.js` (το μεγαλύτερο κομμάτι):**
- **Μένει όπως είναι η μηχανή:** `explain()`, levenshtein/`similarNames`, έλεγχος παρενθέσεων, διόρθωση εισαγωγικών PDF/Word, `GENERIC`.
- **Ξαναγράφονται οι `TRANSLATIONS` (215-295) και οι `RULES` (357-1250)** για τα μηνύματα 3.10–3.14. Τα ~80 παραδείγματα με `print x` γίνονται `print(x)`.
- Ενημερώνονται `BUILTINS`, `MODULE_HINTS`, `MODULES`, `TYPE_GR` (183-211).
- Νέοι κανόνες για συχνά λάθη μαθητών στην Python 3:
  - `print x` χωρίς παρενθέσεις («Missing parentheses in call to 'print'»), συχνό από παλιό υλικό
  - `input()` + αριθμητική πράξη: `'<' not supported between instances of 'str' and 'int'`, `can only concatenate str (not "int") to str`, `unsupported operand type(s)`
  - `/` αντί για `//`: δείκτης λίστας float, `list indices must be integers or slices, not float`, `'float' object cannot be interpreted as an integer` στο `range`
  - `expected ':'`, `'(' was never closed`, `unterminated string literal`, `expected an indented block after 'if' statement on line N`
  - `Did you mean …?`, `UnboundLocalError`, `missing 1 required positional argument`
  - λάθη σε f-strings
  - `ModuleNotFoundError: No module named 'tkinter'` (υπόδειξη python3-tk) και `No module named 'Tkinter'` (το όνομα της Python 2)
- Φεύγουν οι κανόνες μόνο για την 2: Python 3 `print(end=)` (393-405), f-strings «δεν υπάρχουν» (406-414), `input()` που αξιολογεί (636-647), Python 3 ονόματα modules (1110-1122), μίξη unicode (1171-1178), bytestrings του sqlite (1180-1192). Ο κανόνας για ελληνικά ονόματα (377-390) εξαρτάται από τη ρύθμιση `greekNames`.
- **Corpus σφαλμάτων:** `tests/errors/*.py`, ένα μικρό πρόγραμμα ανά κανόνα, με πρώτη γραμμή `# rule: <id>`. Το test (βλ. Φάση 6) τα εκτελεί σε **όλες** τις εγκατεστημένες 3.x, ώστε να πιάνεται κάθε αλλαγή διατύπωσης μεταξύ εκδόσεων.
- **`panels.js`:** κείμενο καλωσορίσματος (131) και συμβουλή διαίρεσης (141-142) για Python 3.
- **Tests:** `tests/errorHelp.test.js` με μηνύματα Python 3.

## Φάση 4: Εκπαιδευτικό περιεχόμενο

**«Θέλω να θυμηθώ» (`src/renderer/recall.md`, 1381 γραμμές):**
- **Ίδιες 11 κατηγορίες και 45 θέματα.** Οι 98 κώδικες γράφονται ξανά σε Python 3, με `print(...)` και `int(input(...))`. Οι κώδικες κρατούν τη λογική του βιβλίου ΕΠΑΛ, ώστε να ταιριάζουν και στις Πανελλήνιες.
- Νέο πεδίο `@level: βασικό | προχωρημένο` σε κάθε θέμα. Ενδεικτικά: Είσοδος/Έξοδος, Δομές ελέγχου, απλοί αλγόριθμοι → βασικό· στοίβα/ουρά, αρχεία, κλάσεις, Tkinter, SQLite → προχωρημένο. Τα `@exams:` μένουν ως έχουν.
- **Περιεχόμενο που αλλάζει ουσιαστικά:**
  - Ο πίνακας `7/2` γίνεται `/` και `//`, με το `-7//2 → -4`, και ξαναγράφεται η ενότητα «μέσος όρος χωρίς την παγίδα».
  - Φεύγουν η προειδοποίηση ότι η `input()` αξιολογεί, το `print x,` με κόμμα, η προειδοποίηση ότι το `print(...)` τυπώνει πλειάδα, και η σημείωση για το `(first+last)/2` (γραμμή 924, γίνεται `//`).
  - Φεύγουν οι σημειώσεις για cp1253, `len` ελληνικών, λίστες με `\xa2…` και `upper()`/`isalpha()` μόνο για λατινικά (1130).
  - `from tkinter import *`.
  - Το «Συχνές παγίδες της Python 2» γίνεται **«Συχνές παγίδες»**: η `input` επιστρέφει κείμενο, `/` αντί για `//`, `=` αντί για `==`, ονόματα που κρύβουν builtins (`list`, `sum`, `max`), τροποποίηση λίστας ενώ τη διασχίζεις.
  - Οι f-strings παρουσιάζονται ως επιπλέον τρόπος στο θέμα της εξόδου.
- **`recall.js`:** το `parse()` διαβάζει το `@level`, η κάρτα δείχνει σήμα επιπέδου δίπλα στο «Π», και στην αναζήτηση προστίθεται φίλτρο «Όλα / Βασικά / Προχωρημένα».
- **Έλεγχος από τον χρήστη:** κάθε κατηγορία που ολοκληρώνεται σημειώνεται στο `docs/PROGRESS.md`, για να ελεγχθεί διδακτικά.
- **Tests:** `tests/recall.test.js` εκτελεί κάθε κώδικα με Python 3.

**Παραδείγματα (`examples/`, 11 αρχεία):**
- Μεταφορά σε Python 3 και UTF-8. Το `01_stivos.py` είναι σήμερα cp1253.
- `02_dyadiki_anazitisi.py`: `(first+last)//2`.
- `08_tkinter_zari.py`: `import tkinter`.
- `11_me_lathi.py`: ελέγχεται ότι τα 4 εσκεμμένα λάθη βγάζουν τα αναμενόμενα μηνύματα της Python 3 και ότι ο Βοηθός τα εξηγεί.

**Λοιπά:**
- Οδηγός (`#dlg-help` στο `index.html`, 166-226): αφαιρούνται `raw_input`, cp1253 και φάκελος Python2.
- Πρόγραμμα έναρξης στο `app.js` (8-15).
- `README.md`: πλήρης ενημέρωση για Python 3.

## Φάση 5: Τάξη

Δεν αλλάζει κώδικας πέρα από τα ονόματα της Φάσης 0. Επαλήθευση με το `scripts/classroom-emulator.js`, και ταυτόχρονα με τον καθηγητή του Python 2.7 ΕΠΑΛ ανοιχτό στον ίδιο υπολογιστή: δεν πρέπει να υπάρχει σύγκρουση ports ή να εμφανίζονται μαθητές της άλλης εφαρμογής. Το `tests/classroom.test.js` πρέπει να περνάει.

## Φάση 6: Tests

- **`package.json` → `test`:** `node --test "tests/*.test.js" && node scripts/run-pytests.js`. Το νέο script βρίσκει τον interpreter με την ίδια `findPython` (μεταβλητή `PYTHON3` ή `py -3`) αντί για το hard-coded `C:/Python27`.
- `tests/recall.test.js`: interpreter από τη μεταβλητή `PYTHON3` ή από την `findPython`.
- **Νέο `tests/errorCorpus.test.js`:** για κάθε `tests/errors/*.py` και κάθε εγκατεστημένη 3.x (`py -0p` στα Windows, `python3.1x` στο PATH στο Linux), εκτελεί τον κώδικα, παίρνει το πραγματικό μήνυμα και ελέγχει ότι το `explain()` επιλέγει τον αναμενόμενο κανόνα.
- `classroom.test.js` και `errorHelp.test.js` μένουν, με ενημερωμένα δεδομένα.

## Σειρά υλοποίησης

Κάθε φάση τελειώνει με πράσινα tests, commit και ενημέρωση του `docs/PROGRESS.md`:
1. Φάσεις 0, 1, 2: η εφαρμογή τρέχει προγράμματα Python 3, με shell, input, βήμα-βήμα και μεταβλητές.
2. Φάση 3: editor, τεκμηρίωση και Βοηθός με corpus.
3. Φάση 4: περιεχόμενο, το πιο χρονοβόρο κείμενο.
4. Φάσεις 5, 6: Τάξη, tests, build του installer.

## Επαλήθευση από άκρη σε άκρη

1. `npm test`, με εγκατεστημένες ιδανικά δύο εκδόσεις, π.χ. 3.10 και 3.14, για το corpus.
2. `npm start`, και για κάθε παράδειγμα: F5, βήμα-βήμα (F10), Shell, `input()` με ελληνικά, μεταβλητές. Το Tkinter ζάρι και το SQLite πρέπει να λειτουργούν.
3. Το `11_me_lathi.py` και κάθε αρχείο του corpus δείχνουν τη σωστή ελληνική εξήγηση στον Βοηθό.
4. Άνοιγμα ενός αρχείου cp1253 από την 2.7: σωστά ελληνικά, αποθήκευση σε UTF-8 με ενημέρωση.
5. Ρύθμιση ελληνικών ονομάτων και στις 3 θέσεις, με `βαθμός = 18`.
6. Τάξη: emulator, και ταυτόχρονα ο καθηγητής Python 2.7 ΕΠΑΛ στον ίδιο υπολογιστή.
7. `npm run dist`, εγκατάσταση per-machine: συντόμευση στο μενού Έναρξη με το σωστό εικονίδιο, σωστό εικονίδιο στη γραμμή εργασιών κατά την εκτέλεση, και ταυτόχρονα `npm start` χωρίς ανάμειξη εικονιδίων (AUMID `.dev`).
8. Linux: `npm run dist:linux`, εγκατάσταση `.deb` σε Ubuntu με `python3`, και σωστό μήνυμα αν λείπει το `python3-tk`.
