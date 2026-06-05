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

# Position base values (multiplied by age and tier to get final price in $M)
BASE_VALUES = {
    "GK": 12,
    "DEF": 15,
    "MID": 22,
    "FWD": 28,
}

def _age_factor(age: int) -> float:
    if age < 20:
        return 0.55
    elif age < 23:
        return 0.75
    elif age < 26:
        return 0.9
    elif age < 30:
        return 1.0
    elif age < 33:
        return 0.8
    else:
        return 0.55

# Team strength tiers for realistic pricing
# Tier 1: Elite contenders, Tier 2: Strong, Tier 3: Decent, Tier 4: Underdogs
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

# Price multiplier ranges per tier: (min_star, max_star, star_chance, good_chance, filler_chance)
# Tiers: star (3.5-5.5x), good (2.0-3.5x), regular (0.8-2.0x), filler (0.2-0.8x)
TIER_CONFIG = {
    1: {"star": 0.20, "good": 0.35, "regular": 0.35, "filler": 0.10},
    2: {"star": 0.08, "good": 0.25, "regular": 0.42, "filler": 0.25},
    3: {"star": 0.03, "good": 0.12, "regular": 0.40, "filler": 0.45},
    4: {"star": 0.01, "good": 0.05, "regular": 0.30, "filler": 0.64},
}

def _team_tier(equipo_nacional: str) -> int:
    return TEAM_TIERS.get(equipo_nacional, 3)

# Known global superstars who should be expensive regardless of national team strength
SUPERSTARS = {
    "Kylian Mbappé", "Kylian Mbappe", "Erling Haaland", "Erling Braut Haaland",
    "Vinícius Júnior", "Vinicius Junior", "Jude Bellingham",
    "Harry Kane", "Jamal Musiala", "Florian Wirtz",
    "Kevin De Bruyne", "Mohamed Salah", "Robert Lewandowski",
    "Antoine Griezmann", "Bukayo Saka", "Phil Foden", "Declan Rice",
    "Federico Valverde", "Rodri", "Rodrigo Hernández",
    "Lamine Yamal", "Nico Williams", "Pedri", "Pablo Gavi",
    "William Saliba", "Aurélien Tchouaméni", "Eduardo Camavinga",
    "Randal Kolo Muani", "Ousmane Dembélé",
    "Jamie Gittens", "Karim Adeyemi",
    "Joshua Kimmich", "Antonio Rüdiger", "Kai Havertz",
    "Thibaut Courtois", "Rodrygo", "Endrick", "Raphinha",
    "Gabriel Martinelli", "Marquinhos", "Alisson", "Alisson Becker",
    "Ederson", "Victor Osimhen", "Ademola Lookman",
    "Achraf Hakimi", "Hakim Ziyech", "Youssef En-Nesyri",
    "Rasmus Højlund", "Rasmus Hojlund", "Christian Eriksen",
    "Khvicha Kvaratskhelia", "Lautaro Martínez", "Lautaro Martinez",
    "Lionel Messi", "Paulo Dybala", "Neymar", "Richarlison",
    "Bruno Fernandes", "Bernardo Silva", "Diogo Jota",
    "Rúben Dias", "Ruben Dias", "João Cancelo", "Joao Cancelo",
    "Rafael Leão", "Rafael Leao", "Virgil van Dijk", "Frenkie de Jong",
    "Memphis Depay", "Xavi Simons", "Cody Gakpo",
    "Mike Maignan", "Gianluigi Donnarumma",
    "Trent Alexander-Arnold", "Cole Palmer", "Marcus Rashford",
    "Darwin Núñez", "Darwin Nunez", "Ronald Araújo", "Ronald Araujo",
    "Gabriel Jesus", "Bruno Guimarães", "Lucas Paquetá",
    "James Rodríguez", "James Rodriguez", "Luis Díaz", "Luis Diaz",
    "Sadio Mané", "Sadio Mane", "Sergei Milinković-Savić",
    "Sergej Milinkovic-Savic", "Dusan Vlahović", "Dusan Vlahovic",
    "Luka Modrić", "Luka Modric", "Mateo Kovačić", "Mateo Kovacic",
}

def _is_superstar(nombre: str) -> bool:
    return nombre.strip() in SUPERSTARS

def _tier_mult(team_tier: int = 3, superstar: bool = False) -> float:
    if superstar:
        return random.uniform(3.5, 5.5)
    weights = TIER_CONFIG.get(team_tier, TIER_CONFIG[3])
    r = random.random()
    acc = 0
    for label, prob in [("star", weights["star"]), ("good", weights["good"]),
                         ("regular", weights["regular"]), ("filler", weights["filler"])]:
        acc += prob
        if r < acc:
            if label == "star":
                return random.uniform(3.5, 5.5)
            elif label == "good":
                return random.uniform(2.0, 3.5)
            elif label == "regular":
                return random.uniform(0.8, 2.0)
            else:
                return random.uniform(0.2, 0.8)
    return random.uniform(0.2, 0.8)

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
    """Re-calculate prices for all existing players using team-based pricing tiers.
    Note: this changes values of players already in fantasy teams, which may
    affect budget consistency. Recommended: delete prode.db and let it re-seed."""
    players = db.query(Jugador).all()
    if not players:
        return
    current_year = datetime.utcnow().year
    for j in players:
        age = current_year - (j.fecha_nacimiento.year if j.fecha_nacimiento else current_year)
        base = BASE_VALUES.get(j.posicion, 10)
        age_mult = _age_factor(age)
        team_tier = _team_tier(j.equipo_nacional)
        superstar = _is_superstar(j.nombre)
        tier = _tier_mult(team_tier, superstar)
        j.valor_inicial = max(1, min(160, round(base * age_mult * tier)))
        j.posicion_especifica = j.posicion_especifica or _random_specific_pos(j.posicion)
    db.commit()
    logger.info(f"Revalued {len(players)} players with new team-based pricing tiers")

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
            age = current_year - (dob.year if dob else current_year)
            base = BASE_VALUES.get(pos, 10)
            age_mult = _age_factor(age)
            team_tier = _team_tier(team_name)
            superstar = _is_superstar(name)
            tier = _tier_mult(team_tier, superstar)
            valor = max(1, min(160, round(base * age_mult * tier)))

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
