import os
import random
import logging
import urllib.request
import json
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Jugador

logger = logging.getLogger(__name__)

FOOTBALL_DATA_TEAMS_URL = "https://api.football-data.org/v4/competitions/2000/teams"

POSITION_MAP = {
    "Goalkeeper": "GK",
    "Defence": "DEF",
    "Midfield": "MID",
    "Offence": "FWD",
}

# Position base values — más realistas (reducidos ~30%)
BASE_VALUES = {
    "GK":  8,
    "DEF": 10,
    "MID": 14,
    "FWD": 18,
}

def _age_factor(age: int) -> float:
    if age < 21:
        return 0.85
    elif age <= 29:
        return 1.0
    elif age <= 33:
        return 0.85
    else:
        return 0.65

# Team strength tiers for realistic pricing
TEAM_TIERS = {
    "Argentina": 1, "France": 1, "Brazil": 1, "England": 1, "Spain": 1,
    "Germany": 1, "Netherlands": 1, "Portugal": 1, "Italy": 1,
    "Belgium": 2, "Croatia": 2, "Uruguay": 2, "Colombia": 2,
    "Senegal": 2, "Morocco": 2, "Japan": 2, "South Korea": 2,
    "Switzerland": 2, "Denmark": 2, "Mexico": 2, "USA": 2,
    "Nigeria": 2, "Cameroon": 2, "Ghana": 2, "Ivory Coast": 2,
    "Poland": 3, "Serbia": 3, "Sweden": 3, "Norway": 3,
    "Ukraine": 3, "Turkey": 3, "Czech Republic": 3,
    "Chile": 3, "Peru": 3, "Ecuador": 3, "Paraguay": 3,
    "Egypt": 3, "Algeria": 3, "Tunisia": 3, "South Africa": 3,
    "Australia": 3, "Iran": 3, "Saudi Arabia": 3, "Iraq": 3,
    "Costa Rica": 4, "Panama": 4, "Honduras": 4, "Canada": 4,
    "Jamaica": 4, "Bolivia": 4, "Venezuela": 4,
    "New Zealand": 4, "Fiji": 4, "Papua New Guinea": 4,
    "Zambia": 4, "Congo": 4, "Mali": 4, "Burkina Faso": 4,
    "India": 4, "China": 4, "Qatar": 4, "United Arab Emirates": 4,
    "Uzbekistan": 4, "Jordan": 4, "Syria": 4, "Lebanon": 4,
}

def _team_tier(equipo_nacional: str) -> int:
    return TEAM_TIERS.get(equipo_nacional, 3)

# Exact market values for world-class superstars
SUPERSTARS = {
    # Absolute Elite forwards
    "Kylian Mbappé": 150, "Kylian Mbappe": 150, "Erling Haaland": 145, "Erling Braut Haaland": 145,
    "Vinícius Júnior": 140, "Vinicius Junior": 140, "Harry Kane": 110, "Lamine Yamal": 120,
    "Mohamed Salah": 105, "Robert Lewandowski": 75, "Lionel Messi": 85, "Cristiano Ronaldo": 70,
    "Neymar": 75, "Lautaro Martínez": 110, "Lautaro Martinez": 110, "Bukayo Saka": 120,
    "Phil Foden": 115, "Antoine Griezmann": 75, "Rafael Leão": 95, "Rafael Leao": 95,
    "Rodrygo": 100, "Luis Díaz": 85, "Luis Diaz": 85, "Julián Álvarez": 90, "Julian Alvarez": 90,
    # Elite midfielders
    "Jude Bellingham": 135, "Florian Wirtz": 125, "Jamal Musiala": 120, "Rodri": 130, 
    "Rodrigo Hernández": 130, "Kevin De Bruyne": 90, "Federico Valverde": 110, 
    "Declan Rice": 100, "Cole Palmer": 105, "Bruno Fernandes": 85, "Bernardo Silva": 80,
    "Frenkie de Jong": 80, "Martin Ødegaard": 110, "Martin Odegaard": 110, "Pedri": 85,
    "Alexis Mac Allister": 80, "Enzo Fernández": 75, "Enzo Fernandez": 75,
    "Luka Modrić": 55, "Luka Modric": 55, "Paulo Dybala": 60,
    # Elite defenders
    "William Saliba": 95, "Rúben Dias": 85, "Ruben Dias": 85, "Virgil van Dijk": 75,
    "Ronald Araújo": 80, "Ronald Araujo": 80, "Trent Alexander-Arnold": 75,
    "Achraf Hakimi": 70, "Antonio Rüdiger": 70, "Antonio Rudiger": 70,
    # Elite goalkeepers
    "Emiliano Martínez": 65, "Emiliano Martinez": 65, "Thibaut Courtois": 70,
    "Alisson Becker": 60, "Alisson": 60, "Ederson": 60, "Marc-André ter Stegen": 60,
    "Marc-Andre ter Stegen": 60, "Mike Maignan": 60, "Gianluigi Donnarumma": 60,
}

# Famous international stars who command a high market premium
STARS = {
    "Marcus Rashford", "Kai Havertz", "Bruno Guimarães", "Bruno Guimaraes", "Darwin Núñez", "Darwin Nunez",
    "Ousmane Dembélé", "Ousmane Dembele", "Xavi Simons", "Cody Gakpo", "Leroy Sané", "Leroy Sane",
    "Kingsley Coman", "Gabriel Martinelli", "Gabriel Jesus", "Richarlison", "Heung-min Son", "Son Heung-min",
    "Victor Osimhen", "Ademola Lookman", "Alexander Isak", "Dušan Vlahović", "Dusan Vlahovic", "Alvaro Morata",
    "Álvaro Morata", "Joshua Kimmich", "Leon Goretzka", "Ilkay Gündogan", "Ilkay Gundogan", "Aurélien Tchouaméni",
    "Aurelien Tchouameni", "Eduardo Camavinga", "Warren Zaïre-Emery", "Warren Zaire-Emery", "Teun Koopmeiners",
    "James Maddison", "Douglas Luiz", "João Neves", "Joao Neves", "João Palhinha", "Joao Palhinha", "Vitinha",
    "Nicolò Barella", "Nicolo Barella", "Alessandro Bastoni", "Federico Dimarco", "Theo Hernández", "Theo Hernandez",
    "Micky van de Ven", "Josko Gvardiol", "Cristian Romero", "Gabriel Magalhães", "Gabriel Magalhaes", "Éder Militão",
    "Eder Militao", "Bremer", "Manuel Akanji", "Jules Koundé", "Jules Kounde", "Dayot Upamecano", "John Stones",
    "Kyle Walker", "Jeremie Frimpong", "Grimaldo", "Alejandro Grimaldo", "Pedro Porro", "Diogo Costa", "Jan Oblak",
    "Yassine Bounou", "Gregor Kobel", "Guglielmo Vicario", "Jordan Pickford", "Unai Simón", "Unai Simon", "David Raya"
}

def calculate_player_value(name: str, posicion: str, team_name: str, dob: datetime) -> int:
    name_clean = name.strip()
    
    # 1. Direct Superstar check
    if name_clean in SUPERSTARS:
        return SUPERSTARS[name_clean]
        
    # 2. Star check
    is_star = name_clean in STARS
    
    current_year = datetime.utcnow().year
    age = current_year - (dob.year if dob else current_year)
    age_mult = _age_factor(age)
    
    if is_star:
        if posicion == "FWD":
            base_star = random.randint(55, 68)
        elif posicion == "MID":
            base_star = random.randint(50, 62)
        elif posicion == "DEF":
            base_star = random.randint(40, 52)
        else: # GK
            base_star = random.randint(35, 45)
        raw_price = round(base_star * (0.9 + 0.1 * age_mult))
        return max(20, min(80, raw_price))
        
    # 3. Regular player valuation by national team tier and position
    team_tier = _team_tier(team_name)
    tier_position_values = {
        1: {"FWD": (22, 28), "MID": (18, 24), "DEF": (14, 18), "GK": (10, 14)},
        2: {"FWD": (15, 20), "MID": (12, 16), "DEF": (9, 12), "GK": (7, 10)},
        3: {"FWD": (8, 12), "MID": (6, 9), "DEF": (5, 7), "GK": (4, 6)},
        4: {"FWD": (3, 5), "MID": (2.5, 4), "DEF": (2, 3), "GK": (1, 2)},
    }
    
    tier_vals = tier_position_values.get(team_tier, tier_position_values[3])
    pos_range = tier_vals.get(posicion, (6, 9))
    base_val = random.uniform(pos_range[0], pos_range[1])
    
    raw_price = round(base_val * age_mult)
    raw_price += random.choice([-1, 0, 1])
    
    return max(1, raw_price)

SPECIFIC_POSITIONS = {
    "GK": ["GK"],
    "DEF": ["CB", "LB", "RB"],
    "MID": ["CM", "CDM", "CAM", "LM", "RM"],
    "FWD": ["ST", "LW", "RW"],
}

SPECIFIC_WEIGHTS = {
    "GK": [1],
    "DEF": [0.5, 0.25, 0.25],
    "MID": [0.3, 0.2, 0.2, 0.15, 0.15],
    "FWD": [0.4, 0.3, 0.3],
}

def _random_specific_pos(posicion: str) -> str:
    opts = SPECIFIC_POSITIONS.get(posicion, [posicion])
    weights = SPECIFIC_WEIGHTS.get(posicion, [1])
    return random.choices(opts, weights=weights, k=1)[0]

def revalue_all_players(db: Session):
    """Re-calculate prices for all existing players using corrected team-based pricing."""
    players = db.query(Jugador).all()
    if not players:
        return
    for j in players:
        j.valor_inicial = calculate_player_value(j.nombre, j.posicion, j.equipo_nacional, j.fecha_nacimiento)
        j.posicion_especifica = j.posicion_especifica or _random_specific_pos(j.posicion)
    db.commit()
    logger.info(f"Revalued {len(players)} players with corrected pricing")

def seed_players(db: Session):
    existing = db.query(Jugador).count()
    if existing > 0:
        logger.info(f"Revaluing {existing} existing players with new pricing tiers...")
        revalue_all_players(db)
        return

    api_key = os.getenv("FOOTBALL_DATA_KEY")
    if not api_key:
        logger.warning("FOOTBALL_DATA_KEY not set, cannot seed players.")
        return

    req = urllib.request.Request(
        FOOTBALL_DATA_TEAMS_URL,
        headers={"X-Auth-Token": api_key}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to fetch teams from football-data.org: {e}")
        return

    current_year = datetime.utcnow().year
    players_created = 0

    for team in data.get("teams", []):
        team_name = team.get("name", "Unknown")
        squad = team.get("squad", [])
        for player in squad:
            name = player.get("name", "Unknown")
            raw_pos = player.get("position", "Midfield")
            pos = POSITION_MAP.get(raw_pos, "MID")
            dob_str = player.get("dateOfBirth")
            dob = None
            if dob_str:
                try:
                    dob = datetime.strptime(dob_str[:10], "%Y-%m-%d")
                except ValueError:
                    pass
            valor = calculate_player_value(name, pos, team_name, dob)

            db_jugador = Jugador(
                nombre=name,
                posicion=pos,
                posicion_especifica=_random_specific_pos(pos),
                equipo_nacional=team_name,
                fecha_nacimiento=dob,
                valor_inicial=valor,
                puntos_totales=0,
            )
            db.add(db_jugador)
            players_created += 1

    db.commit()
    logger.info(f"Seeded {players_created} players from football-data.org")

