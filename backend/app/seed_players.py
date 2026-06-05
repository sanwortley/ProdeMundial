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

BASE_VALUES = {
    "GK": 7,
    "DEF": 8,
    "MID": 12,
    "FWD": 16,
}

def _age_factor(age: int) -> float:
    if age < 22:
        return 0.7
    elif age < 25:
        return 0.9
    elif age < 30:
        return 1.0
    elif age < 34:
        return 0.85
    else:
        return 0.6

def seed_players(db: Session):
    existing = db.query(Jugador).count()
    if existing > 0:
        logger.info(f"Players table already has {existing} players, skipping seed.")
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
            random_mult = random.uniform(0.85, 1.15)
            valor = max(3, round(base * age_mult * random_mult))

            db_jugador = Jugador(
                nombre=name,
                posicion=pos,
                equipo_nacional=team_name,
                fecha_nacimiento=dob,
                valor_inicial=valor,
                puntos_totales=0,
            )
            db.add(db_jugador)
            players_created += 1

    db.commit()
    logger.info(f"Seeded {players_created} players from football-data.org")
