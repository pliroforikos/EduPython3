# -*- coding: cp1253 -*-
# Παράδειγμα: 1. Πρόκριση στο στίβο (κεφ. 4, δομές επανάληψης)
# Από τις Σημειώσεις Μαθητή. Για γρήγορη δοκιμή αγωνίζονται 3 αθλητές
# (στο βιβλίο είναι 20: range(1, 21)).

max_alma = 0
count_athletes = 0
for i in range(1, 4):
    max_epidosi = 0
    prospatheia = 1
    while prospatheia <= 3 and max_epidosi < 4.5:
        print "αγωνίζεται ο", i, "ος αθλητής στην", prospatheia, "η προσπάθεια"
        epidosi = input("Δώσε την επίδοση του αθλητή: ")
        if max_epidosi < epidosi:
            max_epidosi = epidosi
            if epidosi >= 4.5:
                print 'Ο', i, 'ος αθλητής προκρίθηκε με άλμα στα', epidosi, 'μέτρα'
                count_athletes = count_athletes + 1
        prospatheia = prospatheia + 1
    if max_epidosi < 4.5:
        print 'Δεν προκρίθηκε. Το καλύτερο άλμα του ήταν:', max_epidosi
    if max_alma < max_epidosi:
        max_alma = max_epidosi
print 'Τελικά προκρίθηκαν', count_athletes, 'αθλητές'
print 'Η καλύτερη επίδοση που σημειώθηκε ήταν', max_alma, 'μέτρα'
