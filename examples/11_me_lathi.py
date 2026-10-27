# Παράδειγμα: 11. Πρόγραμμα με λάθη (για να δεις τον Βοηθό)
# Τρέξε το πρόγραμμα, διόρθωσε το λάθος που σου δείχνει ο Βοηθός
# και ξανατρέξε το, μέχρι να μη μείνει κανένα λάθος (είναι 4).

vathmoi = []
for i in range(3)
    v = float(raw_input("Βαθμός: "))
    vathmoi.append(v)

athroisma = 0
for v in vathmoi:
    athroisma = athroisma + v

mesos_oros = athroisma / len(vathmoi)
print "Μέσος όρος: " + mesos_oros
print "Μέγιστος βαθμός:", vathmoi[len(vathmoi)]
print "Πλήθος βαθμών:", plithos
