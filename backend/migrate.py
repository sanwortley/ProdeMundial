import sys
sys.path.insert(0, '.')
from app.database import engine, Base
import app.models  # importar todos los modelos

Base.metadata.create_all(bind=engine)
print("Tablas creadas/verificadas exitosamente")

import sqlite3
conn = sqlite3.connect('prode.db')
c = conn.cursor()
c.execute("PRAGMA table_info(usuarios)")
cols = [r[1] for r in c.fetchall()]
if 'ultimo_acceso' not in cols:
    c.execute("ALTER TABLE usuarios ADD COLUMN ultimo_acceso TIMESTAMP")
    conn.commit()
    print("Columna 'ultimo_acceso' agregada exitosamente a la tabla 'usuarios'")

c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tablas = [r[0] for r in c.fetchall()]
print("Tablas en DB:", tablas)
conn.close()
