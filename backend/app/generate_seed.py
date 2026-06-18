import datetime

groups = {
    "A": ["México", "Sudáfrica", "Corea del Sur", "República Checa"],
    "B": ["Canadá", "Bosnia y Herzegovina", "Qatar", "Suiza"],
    "C": ["Brasil", "Marruecos", "Haití", "Escocia"],
    "D": ["Estados Unidos", "Paraguay", "Australia", "Turquía"],
    "E": ["Alemania", "Ecuador", "Costa de Marfil", "Curazao"],
    "F": ["Países Bajos", "Japón", "Túnez", "Suecia"],
    "G": ["Bélgica", "Irán", "Egipto", "Nueva Zelanda"],
    "H": ["España", "Arabia Saudita", "Uruguay", "Cabo Verde"],
    "I": ["Francia", "Senegal", "Irak", "Noruega"],
    "J": ["Argentina", "Argelia", "Austria", "Jordania"],
    "K": ["Portugal", "Congo", "Uzbekistán", "Colombia"],
    "L": ["Inglaterra", "Croacia", "Ghana", "Panamá"]
}

# Argentina timezone offset: UTC-3 (convert local times to UTC by adding 3 hours)
ARG_TO_UTC = datetime.timedelta(hours=3)
UTC = datetime.timezone.utc

def to_utc(year, month, day, hour, minute):
    """Convert Argentina local time to UTC."""
    return datetime.datetime(year, month, day, hour, minute) + ARG_TO_UTC

# Define the explicit Fecha 1 matches (times are Argentina local, converted to UTC)
fecha_1_matches = [
    (1, to_utc(2026, 6, 11, 16, 0), "Fecha 1", "México", "Sudáfrica"),
    (2, to_utc(2026, 6, 11, 23, 0), "Fecha 1", "Corea del Sur", "República Checa"),
    (3, to_utc(2026, 6, 12, 16, 0), "Fecha 1", "Canadá", "Bosnia y Herzegovina"),
    (4, to_utc(2026, 6, 12, 22, 0), "Fecha 1", "Estados Unidos", "Paraguay"),
    (5, to_utc(2026, 6, 13, 16, 0), "Fecha 1", "Qatar", "Suiza"),
    (6, to_utc(2026, 6, 13, 19, 0), "Fecha 1", "Brasil", "Marruecos"),
    (7, to_utc(2026, 6, 13, 22, 0), "Fecha 1", "Haití", "Escocia"),
    (8, to_utc(2026, 6, 14, 13, 0), "Fecha 1", "Australia", "Turquía"),
    (9, to_utc(2026, 6, 14, 16, 0), "Fecha 1", "Alemania", "Curazao"),
    (10, to_utc(2026, 6, 14, 19, 0), "Fecha 1", "Países Bajos", "Japón"),
    (11, to_utc(2026, 6, 14, 21, 0), "Fecha 1", "Costa de Marfil", "Ecuador"),
    (12, to_utc(2026, 6, 14, 23, 0), "Fecha 1", "Suecia", "Túnez"),
    (13, to_utc(2026, 6, 15, 13, 0), "Fecha 1", "España", "Cabo Verde"),
    (14, to_utc(2026, 6, 15, 16, 0), "Fecha 1", "Bélgica", "Egipto"),
    (15, to_utc(2026, 6, 15, 19, 0), "Fecha 1", "Arabia Saudita", "Uruguay"),
    (16, to_utc(2026, 6, 15, 22, 0), "Fecha 1", "Irán", "Nueva Zelanda"),
    (17, to_utc(2026, 6, 16, 16, 0), "Fecha 1", "Francia", "Senegal"),
    (18, to_utc(2026, 6, 16, 19, 0), "Fecha 1", "Irak", "Noruega"),
    (19, to_utc(2026, 6, 16, 22, 0), "Fecha 1", "Argentina", "Argelia"),
    (20, to_utc(2026, 6, 17, 13, 0), "Fecha 1", "Austria", "Jordania"),
    (21, to_utc(2026, 6, 17, 16, 0), "Fecha 1", "Portugal", "Congo"),
    (22, to_utc(2026, 6, 17, 19, 0), "Fecha 1", "Inglaterra", "Croacia"),
    (23, to_utc(2026, 6, 17, 21, 0), "Fecha 1", "Ghana", "Panamá"),
    (24, to_utc(2026, 6, 17, 23, 0), "Fecha 1", "Uzbekistán", "Colombia"),
]

# Generate Fecha 2 and Fecha 3 programmatically
group_keys = sorted(list(groups.keys()))

fecha_2_matches = []
# Date distribution for Fecha 2 (June 18 to June 22)
# We will do 2 groups per day for the first 4 days, then 4 groups on the last day.
# Day 1: A, B
# Day 2: C, D
# Day 3: E, F
# Day 4: G, H
# Day 5: I, J, K, L
fecha_2_dates = {
    "A": datetime.date(2026, 6, 18),
    "B": datetime.date(2026, 6, 18),
    "C": datetime.date(2026, 6, 19),
    "D": datetime.date(2026, 6, 19),
    "E": datetime.date(2026, 6, 20),
    "F": datetime.date(2026, 6, 20),
    "G": datetime.date(2026, 6, 21),
    "H": datetime.date(2026, 6, 21),
    "I": datetime.date(2026, 6, 22),
    "J": datetime.date(2026, 6, 22),
    "K": datetime.date(2026, 6, 22),
    "L": datetime.date(2026, 6, 22)
}

match_id = 25
for group_name in group_keys:
    teams = groups[group_name]
    t1, t2, t3, t4 = teams
    # Matchup 1: t1 vs t3
    # Matchup 2: t2 vs t4
    d = fecha_2_dates[group_name]
    dt1 = to_utc(d.year, d.month, d.day, 16, 0)
    dt2 = to_utc(d.year, d.month, d.day, 21, 0)
    fecha_2_matches.append((match_id, dt1, "Fecha 2", t1, t3))
    match_id += 1
    fecha_2_matches.append((match_id, dt2, "Fecha 2", t2, t4))
    match_id += 1

fecha_3_matches = []
# Date distribution for Fecha 3 (June 23 to June 27)
# Day 1: A, B
# Day 2: C, D
# Day 3: E, F
# Day 4: G, H
# Day 5: I, J, K, L
fecha_3_dates = {
    "A": datetime.date(2026, 6, 23),
    "B": datetime.date(2026, 6, 23),
    "C": datetime.date(2026, 6, 24),
    "D": datetime.date(2026, 6, 24),
    "E": datetime.date(2026, 6, 25),
    "F": datetime.date(2026, 6, 25),
    "G": datetime.date(2026, 6, 26),
    "H": datetime.date(2026, 6, 26),
    "I": datetime.date(2026, 6, 27),
    "J": datetime.date(2026, 6, 27),
    "K": datetime.date(2026, 6, 27),
    "L": datetime.date(2026, 6, 27)
}

for group_name in group_keys:
    teams = groups[group_name]
    t1, t2, t3, t4 = teams
    # Matchup 1: t4 vs t1
    # Matchup 2: t2 vs t3
    d = fecha_3_dates[group_name]
    
    # Let's adjust so each group's matches are at the same time:
    # A, B: A at 16:00, B at 21:00
    # C, D: C at 16:00, D at 21:00
    # E, F: E at 16:00, F at 21:00
    # G, H: G at 16:00, H at 21:00
    # I, J: I at 16:00, J at 19:00
    # K, L: K at 22:00, L at 13:00
    if group_name == "A":
        dt = to_utc(d.year, d.month, d.day, 16, 0)
    elif group_name == "B":
        dt = to_utc(d.year, d.month, d.day, 21, 0)
    elif group_name == "C":
        dt = to_utc(d.year, d.month, d.day, 16, 0)
    elif group_name == "D":
        dt = to_utc(d.year, d.month, d.day, 21, 0)
    elif group_name == "E":
        dt = to_utc(d.year, d.month, d.day, 16, 0)
    elif group_name == "F":
        dt = to_utc(d.year, d.month, d.day, 21, 0)
    elif group_name == "G":
        dt = to_utc(d.year, d.month, d.day, 16, 0)
    elif group_name == "H":
        dt = to_utc(d.year, d.month, d.day, 21, 0)
    elif group_name == "I":
        dt = to_utc(d.year, d.month, d.day, 16, 0)
    elif group_name == "J":
        dt = to_utc(d.year, d.month, d.day, 19, 0)
    elif group_name == "K":
        dt = to_utc(d.year, d.month, d.day, 22, 0)
    elif group_name == "L":
        dt = to_utc(d.year, d.month, d.day, 13, 0)
        
    fecha_3_matches.append((match_id, dt, "Fecha 3", t4, t1))
    match_id += 1
    fecha_3_matches.append((match_id, dt, "Fecha 3", t2, t3))
    match_id += 1

# Knockouts starting from match_id = 73
knockouts = [
    # Dieciseisavos (73 to 88)
    (73, to_utc(2026, 7, 2, 13, 0), "Dieciseisavos de Final", "1A", "2B"),
    (74, to_utc(2026, 7, 2, 16, 0), "Dieciseisavos de Final", "1C", "2D"),
    (75, to_utc(2026, 7, 2, 19, 0), "Dieciseisavos de Final", "1E", "2F"),
    (76, to_utc(2026, 7, 2, 22, 0), "Dieciseisavos de Final", "1G", "2H"),
    (77, to_utc(2026, 7, 3, 13, 0), "Dieciseisavos de Final", "1I", "2J"),
    (78, to_utc(2026, 7, 3, 16, 0), "Dieciseisavos de Final", "1K", "2L"),
    (79, to_utc(2026, 7, 3, 19, 0), "Dieciseisavos de Final", "1B", "2A"),
    (80, to_utc(2026, 7, 3, 22, 0), "Dieciseisavos de Final", "1D", "2C"),
    (81, to_utc(2026, 7, 4, 13, 0), "Dieciseisavos de Final", "1F", "2E"),
    (82, to_utc(2026, 7, 4, 16, 0), "Dieciseisavos de Final", "1H", "2G"),
    (83, to_utc(2026, 7, 4, 19, 0), "Dieciseisavos de Final", "1J", "2I"),
    (84, to_utc(2026, 7, 4, 22, 0), "Dieciseisavos de Final", "1L", "2K"),
    (85, to_utc(2026, 7, 5, 13, 0), "Dieciseisavos de Final", "Mejor 3ro A/B/C", "Mejor 3ro D/E/F"),
    (86, to_utc(2026, 7, 5, 16, 0), "Dieciseisavos de Final", "Mejor 3ro G/H/I", "Mejor 3ro J/K/L"),
    (87, to_utc(2026, 7, 5, 19, 0), "Dieciseisavos de Final", "Mejor 3ro A/E/I", "Mejor 3ro B/F/J"),
    (88, to_utc(2026, 7, 5, 22, 0), "Dieciseisavos de Final", "Mejor 3ro C/G/K", "Mejor 3ro D/H/L"),

    # Octavos (89 to 96)
    (89, to_utc(2026, 7, 7, 16, 0), "Octavos de Final", "Ganador Partido 73", "Ganador Partido 74"),
    (90, to_utc(2026, 7, 7, 21, 0), "Octavos de Final", "Ganador Partido 75", "Ganador Partido 76"),
    (91, to_utc(2026, 7, 8, 16, 0), "Octavos de Final", "Ganador Partido 77", "Ganador Partido 78"),
    (92, to_utc(2026, 7, 8, 21, 0), "Octavos de Final", "Ganador Partido 79", "Ganador Partido 80"),
    (93, to_utc(2026, 7, 9, 16, 0), "Octavos de Final", "Ganador Partido 81", "Ganador Partido 82"),
    (94, to_utc(2026, 7, 9, 21, 0), "Octavos de Final", "Ganador Partido 83", "Ganador Partido 84"),
    (95, to_utc(2026, 7, 10, 16, 0), "Octavos de Final", "Ganador Partido 85", "Ganador Partido 86"),
    (96, to_utc(2026, 7, 10, 21, 0), "Octavos de Final", "Ganador Partido 87", "Ganador Partido 88"),

    # Cuartos (97 to 100)
    (97, to_utc(2026, 7, 12, 16, 0), "Cuartos de Final", "Ganador Partido 89", "Ganador Partido 90"),
    (98, to_utc(2026, 7, 12, 21, 0), "Cuartos de Final", "Ganador Partido 91", "Ganador Partido 92"),
    (99, to_utc(2026, 7, 13, 16, 0), "Cuartos de Final", "Ganador Partido 93", "Ganador Partido 94"),
    (100, to_utc(2026, 7, 13, 21, 0), "Cuartos de Final", "Ganador Partido 95", "Ganador Partido 96"),

    # Semifinales (101 to 102)
    (101, to_utc(2026, 7, 15, 21, 0), "Semifinal", "Ganador Partido 97", "Ganador Partido 98"),
    (102, to_utc(2026, 7, 16, 21, 0), "Semifinal", "Ganador Partido 99", "Ganador Partido 100"),

    # Final (103)
    (103, to_utc(2026, 7, 19, 16, 0), "Final", "Ganador Partido 101", "Ganador Partido 102"),
]

# Compile list
all_matches = []
all_matches.extend(fecha_1_matches)
all_matches.extend(fecha_2_matches)
all_matches.extend(fecha_3_matches)
all_matches.extend(knockouts)

# Let's write the seed_data.py file
output_path = "c:\\Users\\champ\\OneDrive\\Desktop\\prode_wc26\\backend\\app\\seed_data.py"
with open(output_path, "w", encoding="utf-8") as f:
    f.write("# Autogenerated seed data for FIFA World Cup 2026\n")
    f.write("import datetime\n")
    f.write("from .models import Partido\n\n")
    f.write("seed_matches = [\n")
    for mid, dt, phase, local, visit in all_matches:
        f.write(f"    Partido(id_partido={mid}, fecha=datetime.datetime({dt.year}, {dt.month}, {dt.day}, {dt.hour}, {dt.minute}), fase={repr(phase)}, equipo_local={repr(local)}, equipo_visitante={repr(visit)}),\n")
    f.write("]\n")

print(f"Generated {len(all_matches)} matches in seed_data.py successfully!")
