# rule: sqlite_table_exists
import sqlite3
con = sqlite3.connect(":memory:")
con.execute("CREATE TABLE t(val INT)")
con.execute("CREATE TABLE t(val INT)")
