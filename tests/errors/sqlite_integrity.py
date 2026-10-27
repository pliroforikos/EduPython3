# rule: sqlite_integrity
import sqlite3
con = sqlite3.connect(":memory:")
con.execute("CREATE TABLE t(id INT PRIMARY KEY)")
con.execute("INSERT INTO t VALUES(1)")
con.execute("INSERT INTO t VALUES(1)")
