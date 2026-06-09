import sys
sys.path.insert(0, '.')
from app.database import engine, Base
import app.models  # importar todos los modelos

Base.metadata.create_all(bind=engine)
print("Tablas creadas/verificadas exitosamente")

import sqlite3
conn = sqlite3.connect('prode.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tablas = [r[0] for r in c.fetchall()]
print("Tablas en DB:", tablas)
conn.close()
