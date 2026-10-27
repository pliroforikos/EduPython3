# Παράδειγμα: 4. Ταξινόμηση με εισαγωγή (κεφ. 5.3)

def insertionSort(array):
    for i in range(1, len(array)):
        value = array[i]
        j = i
        while j > 0 and array[j - 1] > value:
            array[j] = array[j - 1]
            j = j - 1
        array[j] = value


onomata = ['Νίκος', 'Άννα', 'Γιώργος', 'Ελένη', 'Βασίλης']
insertionSort(onomata)
for onoma in onomata:
    print onoma

vathmoi = [17.5, 12, 19.25, 15, 20, 9.5]
insertionSort(vathmoi)
print vathmoi
