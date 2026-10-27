# Παράδειγμα: 2. Δυαδική αναζήτηση (κεφ. 5.1)

def binarySearch(array, key):
    first = 0
    last = len(array) - 1
    pos = -1
    while first <= last and pos == -1:
        mid = (first + last) / 2
        if array[mid] == key:
            pos = mid
        elif array[mid] < key:
            first = mid + 1
        else:
            last = mid - 1
    return pos


# Η λίστα πρέπει να είναι ταξινομημένη!
arithmoi = [3, 8, 12, 15, 21, 34, 42, 57, 63, 78, 91]
print "Λίστα:", arithmoi

x = int(raw_input("Ποιον αριθμό ψάχνεις; "))
thesi = binarySearch(arithmoi, x)
if thesi >= 0:
    print "Ο", x, "βρέθηκε στη θέση", thesi
else:
    print "Ο", x, "δεν υπάρχει στη λίστα"
