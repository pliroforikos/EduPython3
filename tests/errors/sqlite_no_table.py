# rule: sqlite_no_table
import sqlite3
con = sqlite3.connect(":memory:")
con.execute("SELECT * FROM nosuchtable")
