# Παράδειγμα: 10. Μάντεψε τον αριθμό (random, while)
import random

mystiko = random.randint(1, 100)
prospatheies = 0
vrethike = False

print "Σκέφτηκα έναν αριθμό από το 1 έως το 100."
while not vrethike:
    x = int(raw_input("Μάντεψε: "))
    prospatheies = prospatheies + 1
    if x < mystiko:
        print "Πιο μεγάλο!"
    elif x > mystiko:
        print "Πιο μικρό!"
    else:
        vrethike = True

print "Μπράβο! Το βρήκες σε", prospatheies, "προσπάθειες."
