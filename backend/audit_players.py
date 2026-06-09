import sqlite3

conn = sqlite3.connect('prode.db')
c = conn.cursor()

print("=== ANOMALIAS DETECTADAS ===")
print()

# Jugadores muy caros de equipos debiles/desconocidos
print("-- Jugadores >$80M de equipos NO tier-1 (sospechosos) --")
equipos_tier1 = ('Argentina','France','Brazil','England','Spain','Germany','Netherlands','Portugal','Italy')
c.execute("""
    SELECT nombre, equipo_nacional, posicion, valor_inicial 
    FROM jugadores 
    WHERE valor_inicial > 80 
    ORDER BY valor_inicial DESC
""")
for r in c.fetchall():
    if r[1] not in equipos_tier1:
        try:
            print(f"  ${r[3]}M  {r[1][:22]:<22} {r[2]}  {r[0][:40]}")
        except:
            print(f"  ${r[3]}M  {r[1][:22]:<22} {r[2]}  [encoding error]")

print()
print("-- Jugadores conocidos con precio BAJO (<$20M) --")
conocidos = ['Lionel Messi', 'Luka Modric', 'Cristiano Ronaldo', 'Neymar', 'Robert Lewandowski']
for nombre in conocidos:
    c.execute("SELECT nombre, equipo_nacional, valor_inicial FROM jugadores WHERE nombre LIKE ?", (f'%{nombre[:8]}%',))
    rows = c.fetchall()
    for r in rows:
        try:
            print(f"  ${r[2]}M  {r[0][:35]}")
        except:
            pass

print()
print("-- Distribucion de precios --")
c.execute("SELECT COUNT(*) FROM jugadores WHERE valor_inicial > 100")
print(f"  Jugadores > 100M: {c.fetchone()[0]}")
c.execute("SELECT COUNT(*) FROM jugadores WHERE valor_inicial BETWEEN 50 AND 100")
print(f"  Jugadores 50-100M: {c.fetchone()[0]}")
c.execute("SELECT COUNT(*) FROM jugadores WHERE valor_inicial BETWEEN 20 AND 50")
print(f"  Jugadores 20-50M: {c.fetchone()[0]}")
c.execute("SELECT COUNT(*) FROM jugadores WHERE valor_inicial < 20")
print(f"  Jugadores < 20M: {c.fetchone()[0]}")

print()
print("-- Root cause: BASE_VALUES demasiado altos para FWD --")
print("  FWD base: 28, MID base: 22, DEF base: 15, GK: 12")
print("  Con tier_mult superstar (3.5-5.5x) + age_factor (1.0):")
print("  FWD superstar: 28 * 1.0 * 5.5 = 154M MAX (demasiado alto)")
print("  FWD regular tier1: 28 * 1.0 * 3.5 = 98M (sigue siendo alto)")
print()
print("  PROBLEMA: el multiplicador 'star' (3.5-5.5x) aplica aleatoriamente")
print("  a jugadores tier-1 con 20% de prob, generando precios sin relacion al jugador real")

conn.close()
