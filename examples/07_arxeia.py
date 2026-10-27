# Παράδειγμα: 7. Εγγραφή και ανάγνωση αρχείου (κεφ. 6)
# Το αρχείο vathmoi.txt δημιουργείται στον ίδιο φάκελο με το πρόγραμμα.

f = open("vathmoi.txt", "w")
for i in range(3):
    onoma = raw_input("Όνομα μαθητή: ")
    vathmos = raw_input("Βαθμός: ")
    f.write(onoma + "," + vathmos + "\n")
f.close()

print
print "Περιεχόμενα του αρχείου:"
athroisma = 0
plithos = 0
f = open("vathmoi.txt", "r")
for grammi in f:
    stoixeia = grammi.rstrip().split(",")
    print stoixeia[0], "->", stoixeia[1]
    athroisma = athroisma + float(stoixeia[1])
    plithos = plithos + 1
f.close()

if plithos > 0:
    print "Μέσος όρος: %.2f" % (athroisma / plithos)
