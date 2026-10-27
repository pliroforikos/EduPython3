# Παράδειγμα: 3. Ταξινόμηση ευθείας ανταλλαγής - φυσαλίδα (κεφ. 5.2)

def bubbleSort(array):
    N = len(array)
    for i in range(N - 1):
        for j in range(N - 1, i, -1):
            if array[j] < array[j - 1]:
                array[j], array[j - 1] = array[j - 1], array[j]
        print "Πέρασμα", i + 1, ":", array


lista = [45, 12, 98, 3, 27, 64, 9]
print "Αρχική λίστα:   ", lista
bubbleSort(lista)
print "Ταξινομημένη:   ", lista
