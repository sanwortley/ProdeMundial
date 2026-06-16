"""
Auto-sync module for Prode Mundial 2026.
Fetches live match results from worldcup26.ir every 5 minutes and updates the DB.
No API key required — completely free and open.
"""
import urllib.request
import json
import unicodedata
import logging
from datetime import datetime, timezone
from .database import SessionLocal
from .models import Partido, Prediccion
from .utils import recalcular_puntos_grupo

logger = logging.getLogger("prode.sync")

# ─────────────────────────────────────────────
# Team name mapping: API (English) → Local (Spanish)
# ─────────────────────────────────────────────
TEAM_NAME_MAP = {
    # Group A
    "mexico": "México",
    "south africa": "Sudáfrica",
    "south korea": "Corea del Sur",
    "czech republic": "República Checa",
    # Group B
    "canada": "Canadá",
    "bosnia and herzegovina": "Bosnia y Herzegovina",
    "qatar": "Qatar",
    "switzerland": "Suiza",
    # Group C
    "brazil": "Brasil",
    "morocco": "Marruecos",
    "haiti": "Haití",
    "scotland": "Escocia",
    # Group D
    "united states": "Estados Unidos",
    "usa": "Estados Unidos",
    "paraguay": "Paraguay",
    "australia": "Australia",
    "turkey": "Turquía",
    # Group E
    "germany": "Alemania",
    "curacao": "Curazao",
    "netherlands": "Países Bajos",
    "japan": "Japón",
    # Group F
    "ivory coast": "Costa de Marfil",
    "cote d'ivoire": "Costa de Marfil",
    "ecuador": "Ecuador",
    "sweden": "Suecia",
    "tunisia": "Túnez",
    # Group G
    "spain": "España",
    "cape verde": "Cabo Verde",
    "belgium": "Bélgica",
    "egypt": "Egipto",
    # Group H
    "saudi arabia": "Arabia Saudita",
    "uruguay": "Uruguay",
    "iran": "Irán",
    "new zealand": "Nueva Zelanda",
    # Group I
    "france": "Francia",
    "senegal": "Senegal",
    "iraq": "Irak",
    "norway": "Noruega",
    # Group J
    "argentina": "Argentina",
    "algeria": "Argelia",
    "austria": "Austria",
    "jordan": "Jordania",
    # Group K
    "portugal": "Portugal",
    "congo": "Congo",
    "england": "Inglaterra",
    "croatia": "Croacia",
    # Group L
    "ghana": "Ghana",
    "panama": "Panamá",
    "uzbekistan": "Uzbekistán",
    "colombia": "Colombia",
}


def normalize(name: str) -> str:
    """Lowercase, strip accents for fuzzy matching."""
    n = name.lower().strip()
    n = "".join(
        c for c in unicodedata.normalize("NFD", n)
        if unicodedata.category(c) != "Mn"
    )
    return n


def translate_team(api_name: str) -> str | None:
    """Translate API team name (English) to local Spanish name."""
    key = normalize(api_name)
    # Direct lookup
    if key in TEAM_NAME_MAP:
        return TEAM_NAME_MAP[key]
    # Try partial match
    for en_key, es_val in TEAM_NAME_MAP.items():
        if en_key in key or key in en_key:
            return es_val
    return None


def check_and_advance_knockouts(db, match_id: int, equipo_local: str, equipo_visitante: str, goles_local: int, goles_visitante: int):
    """Advance winner to next knockout match."""
    winner = equipo_local if goles_local >= goles_visitante else equipo_visitante
    placeholder = f"Ganador Partido {match_id}"
    for m in db.query(Partido).filter(Partido.equipo_local == placeholder).all():
        m.equipo_local = winner
    for m in db.query(Partido).filter(Partido.equipo_visitante == placeholder).all():
        m.equipo_visitante = winner
    db.commit()


def fetch_api_games() -> list:
    """Fetch all games from worldcup26.ir API."""
    url = "https://worldcup26.ir/get/games"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "ProdeWC26-AutoSync/1.0")
    req.add_header("Accept", "application/json")
    
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    last_err = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=15.0, context=ctx) as response:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("games", [])
        except Exception as e:
            last_err = e
            import time
            time.sleep(1)
    raise last_err


def sync_results():
    """
    Main sync function. Fetches finished games from the API and updates local DB.
    Called every 5 minutes by the APScheduler.
    """
    logger.info(f"[AutoSync] Iniciando sincronización de resultados... ({datetime.now().strftime('%H:%M:%S')})")
    db = SessionLocal()
    updated_count = 0
    
    try:
        games = fetch_api_games()
        now_utc = datetime.now(timezone.utc)

        # Get all non-finished local matches whose scheduled time has passed
        # (give 2.5 hours buffer for match to finish)
        from datetime import timedelta
        pending_matches = db.query(Partido).filter(Partido.finalizado == False).all()
        
        # Build lookup: (normalized_local, normalized_visitante) → Partido
        local_match_map: dict[tuple, Partido] = {}
        for p in pending_matches:
            key = (normalize(p.equipo_local), normalize(p.equipo_visitante))
            local_match_map[key] = p

        affected_match_ids = []
        affected_group_ids = set()

        for game in games:
            home_en = game.get("home_team_name_en", "")
            away_en = game.get("away_team_name_en", "")
            home_score = game.get("home_score")
            away_score = game.get("away_score")

            # Translate team names to Spanish
            home_es = translate_team(home_en)
            away_es = translate_team(away_en)

            if not home_es or not away_es:
                # Try normalized direct match against DB
                home_es = home_en
                away_es = away_en

            # Look up in our local DB by Spanish name
            key = (normalize(home_es), normalize(away_es))
            partido = local_match_map.get(key)

            if not partido:
                # Try alternate keys if translation gave different result
                key2 = (normalize(home_en), normalize(away_en))
                partido = local_match_map.get(key2)

            if partido:
                finished_flag = str(game.get("finished", "FALSE")).upper()
                
                # Determine status
                if finished_flag == "TRUE":
                    status = "FINISHED"
                elif finished_flag in ("LIVE", "IN_PLAY") or (partido.fecha and datetime.now(timezone.utc) > partido.fecha.replace(tzinfo=timezone.utc)):
                    status = "IN_PLAY"
                else:
                    status = "SCHEDULED"

                partido.status = status
                partido.minute = game.get("minute") # Get minute if available in API

                try:
                    g_local = int(home_score) if home_score is not None else None
                    g_visit = int(away_score) if away_score is not None else None
                except (ValueError, TypeError):
                    g_local = None
                    g_visit = None

                if g_local is not None and g_visit is not None:
                    # Update live score for matches in progress
                    if not partido.finalizado:
                        if partido.goles_local != g_local or partido.goles_visitante != g_visit:
                            partido.goles_local = g_local
                            partido.goles_visitante = g_visit
                            # Note: we don't add to affected_match_ids since those are only for finalized score recalculation

                    if finished_flag == "TRUE" and not partido.finalizado:
                        partido.goles_local = g_local
                        partido.goles_visitante = g_visit
                        partido.finalizado = True
                        affected_match_ids.append(partido.id_partido)
                        updated_count += 1
                        logger.info(f"  ✓ {partido.equipo_local} {g_local}-{g_visit} {partido.equipo_visitante} (Finalizado)")

                        # Advance knockout bracket if needed
                        is_knockout = partido.fase not in ["Fecha 1", "Fecha 2", "Fecha 3"]
                        if is_knockout:
                            check_and_advance_knockouts(
                                db, partido.id_partido,
                                partido.equipo_local, partido.equipo_visitante,
                                g_local, g_visit
                            )

        if affected_match_ids:
            db.commit()

            # Recalculate points for all groups with predictions on these matches
            groups = (
                db.query(Prediccion.id_grupo)
                .filter(Prediccion.id_partido.in_(affected_match_ids))
                .distinct()
                .all()
            )
            for (g_id,) in groups:
                recalcular_puntos_grupo(db, g_id)

            logger.info(f"[AutoSync] ✅ {updated_count} partido(s) actualizado(s). Puntos recalculados.")
        else:
            logger.info("[AutoSync] ⏳ Sin partidos finalizados nuevos.")

    except Exception as e:
        logger.warning(f"[AutoSync] ⏳ API externa worldcup26.ir no disponible temporalmente: {e}")
        db.rollback()
    finally:
        db.close()

    return updated_count
