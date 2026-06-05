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

def _tier_mult() -> float:
    """Random quality tier: 5% stars, 15% good, 40% regular, 40% filler."""
    r = random.random()
    if r < 0.05:
        return random.uniform(3.5, 5.5)    # World-class
    elif r < 0.20:
        return random.uniform(2.0, 3.5)    # Good
    elif r < 0.60:
        return random.uniform(0.8, 2.0)    # Regular
    else:
        return random.uniform(0.2, 0.8)    # Filler

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
    """Re-calculate prices for all existing players using new pricing tiers.
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
        tier = _tier_mult()
        j.valor_inicial = max(3, min(60, round(base * age_mult * tier)))
        j.posicion_especifica = j.posicion_especifica or _random_specific_pos(j.posicion)
    db.commit()
    logger.info(f"Revalued {len(players)} players with new pricing tiers")

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
            tier = _tier_mult()
            valor = max(3, min(60, round(base * age_mult * tier)))

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
