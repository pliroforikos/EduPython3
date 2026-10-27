@GEMINI.md

# Για τον Claude: έλεγχος της δουλειάς

Την υλοποίηση την κάνει άλλος agent (Gemini) με βάση το `docs/PLAN.md`. Ο ρόλος του Claude εδώ είναι **έλεγχος και παρέμβαση όπου χρειάζεται**.

Όταν ο χρήστης ζητήσει έλεγχο:
1. Διάβασε `docs/PROGRESS.md` και `git log --stat` από το αρχικό commit. Κάθε φάση πρέπει να έχει δικό της commit.
2. Για κάθε φάση, σύγκρινε τον κώδικα με την αντίστοιχη ενότητα του `docs/PLAN.md`. Αποκλίσεις που δεν εξηγούνται στο `PROGRESS.md` είναι ευρήματα.
3. Τρέξε `npm test`.
4. Ψάξε υπολείμματα της Python 2:
   - `raw_input`, `print ` ως statement, `Python27`, `python2`, `cp1253`, `47800`, `47801`, `python2-epal`, `Python2-EPAL`, `__builtin__`, `imp.`
   - εξαίρεση: το `encoding.js`, που πρέπει να διαβάζει αρχεία cp1253, και οι κανόνες του Βοηθού για `print x`/`raw_input`
5. Σημεία υψηλού ρίσκου:
   - `backend/runner.py`: πρωτόκολλο σε bytes, `input()`, traceback, βήμα-βήμα, import modules του μαθητή
   - `src/main/pythonProcess.js`: παράκαμψη του WindowsApps stub
   - `errorHelp.js`: κάλυψη από το corpus
   - `recall.md`: όλοι οι κώδικες τρέχουν
   - AUMID `.dev`
6. Το διδακτικό περιεχόμενο (Φάση 4) ελέγχεται με τον χρήστη. Δεν το εγκρίνεις μόνος σου.
