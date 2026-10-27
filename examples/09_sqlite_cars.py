# Παράδειγμα: 9. Βάση δεδομένων SQLite - αυτοκίνητα (κεφ. 10)
# Η βάση example.db δημιουργείται στον ίδιο φάκελο με το πρόγραμμα.
import sqlite3

conn = sqlite3.connect('example.db')
curs = conn.cursor()

curs.execute("DROP TABLE IF EXISTS cars")
curs.execute("""CREATE TABLE cars
             (id INTEGER PRIMARY KEY NOT NULL,
              firma TEXT,
              cyear TEXT,
              fuel TEXT,
              cc INTEGER,
              km INTEGER,
              price REAL)""")

cars = [('Fiat Punto', '2010', 'venzini', 1200, 85000, 4500.0),
        ('Toyota Yaris', '2015', 'ybridiko', 1500, 60000, 9800.0),
        ('Opel Corsa', '2012', 'diesel', 1300, 120000, 5200.0)]
curs.executemany("INSERT INTO cars (firma, cyear, fuel, cc, km, price) VALUES (?, ?, ?, ?, ?, ?)", cars)
conn.commit()

print "Αυτοκίνητα κάτω από 6000 ευρώ, ταξινομημένα κατά τιμή:"
curs.execute("SELECT firma, cyear, price FROM cars WHERE price < 6000 ORDER BY price")
for row in curs.fetchall():
    print row[0], "(" + row[1] + "):", row[2], "ευρώ"

curs.close()
conn.close()
