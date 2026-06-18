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
    "ecuador": "Ecuador",
    "ivory coast": "Costa de Marfil",
    "cote d'ivoire": "Costa de Marfil",
    "curacao": "Curazao",
    # Group F
    "netherlands": "Países Bajos",
    "japan": "Japón",
    "tunisia": "Túnez",
    "sweden": "Suecia",
    # Group G
    "belgium": "Bélgica",
    "iran": "Irán",
    "egypt": "Egipto",
    "new zealand": "Nueva Zelanda",
    # Group H
    "spain": "España",
    "saudi arabia": "Arabia Saudita",
    "uruguay": "Uruguay",
    "cape verde": "Cabo Verde",
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
    "democratic republic of the congo": "Congo",
    "dr congo": "Congo",
    "uzbekistan": "Uzbekistán",
    "colombia": "Colombia",
    # Group L
    "england": "Inglaterra",
    "croatia": "Croacia",
    "ghana": "Ghana",
    "panama": "Panamá",
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
    Main sync function. Fetches live and finished games from the API and updates local DB.
    - Updates status, minute, injury_time and partial scores for IN_PLAY matches.
    - Finalizes matches and recalculates points when games finish.
    Called every 5 minutes by the APScheduler.
    """
    logger.info(f"[AutoSync] Iniciando sincronización... ({datetime.now().strftime('%H:%M:%S')})")
    db = SessionLocal()
    updated_count = 0

    try:
        games = fetch_api_games()
        now_utc = datetime.now(timezone.utc)

        from datetime import timedelta
        pending_matches = db.query(Partido).filter(Partido.finalizado == False).all()

        # Build lookup: (normalized_local, normalized_visitante) → Partido
        local_match_map: dict[tuple, Partido] = {}
        for p in pending_matches:
            key = (normalize(p.equipo_local), normalize(p.equipo_visitante))
            local_match_map[key] = p

        affected_match_ids = []
        affected_group_ids = set()
        any_live_changed = False   # tracks live score/status changes (non-final)

        for game in games:
            home_en = game.get("home_team_name_en", "")
            away_en = game.get("away_team_name_en", "")
            home_score = game.get("home_score")
            away_score = game.get("away_score")

            # Translate team names to Spanish
            home_es = translate_team(home_en)
            away_es = translate_team(away_en)

            if not home_es or not away_es:
                home_es = home_en
                away_es = away_en

            # Look up in our local DB by Spanish name
            key = (normalize(home_es), normalize(away_es))
            partido = local_match_map.get(key)

            if not partido:
                key2 = (normalize(home_en), normalize(away_en))
                partido = local_match_map.get(key2)

            if partido:
                finished_flag = str(game.get("finished", "FALSE")).upper()

                # Determine status
                if finished_flag == "TRUE":
                    new_status = "FINISHED"
                elif finished_flag in ("PAUSED", "HT", "HALFTIME"):
                    new_status = "PAUSED"
                elif finished_flag in ("LIVE", "IN_PLAY") or (
                    partido.fecha and now_utc > partido.fecha.replace(tzinfo=timezone.utc)
                ):
                    new_status = "IN_PLAY"
                else:
                    new_status = "SCHEDULED"

                new_minute = game.get("minute")
                new_injury = game.get("injury_time") or game.get("injuryTime") or 0

                try:
                    g_local = int(home_score) if home_score is not None else None
                    g_visit = int(away_score) if away_score is not None else None
                except (ValueError, TypeError):
                    g_local = None
                    g_visit = None

                # --- Update live data (status, minute, partial score) ---
                if (partido.status != new_status or
                        partido.minute != new_minute or
                        partido.injury_time != new_injury):
                    partido.status = new_status
                    partido.minute = new_minute
                    partido.injury_time = new_injury
                    any_live_changed = True

                # Update partial score for in-progress matches
                if g_local is not None and g_visit is not None and not partido.finalizado:
                    if partido.goles_local != g_local or partido.goles_visitante != g_visit:
                        partido.goles_local = g_local
                        partido.goles_visitante = g_visit
                        any_live_changed = True
                        logger.info(
                            f"  🔴 {partido.equipo_local} {g_local}-{g_visit} "
                            f"{partido.equipo_visitante} ({new_status} {new_minute}')"
                        )

                # --- Finalize match ---
                if finished_flag == "TRUE" and not partido.finalizado:
                    if g_local is not None and g_visit is not None:
                        partido.goles_local = g_local
                        partido.goles_visitante = g_visit
                        partido.finalizado = True
                        affected_match_ids.append(partido.id_partido)
                        updated_count += 1
                        logger.info(
                            f"  ✓ {partido.equipo_local} {g_local}-{g_visit} "
                            f"{partido.equipo_visitante} (Finalizado)"
                        )

                        is_knockout = partido.fase not in ["Fecha 1", "Fecha 2", "Fecha 3"]
                        if is_knockout:
                            check_and_advance_knockouts(
                                db, partido.id_partido,
                                partido.equipo_local, partido.equipo_visitante,
                                g_local, g_visit
                            )

                        if partido.fase == 'Final':
                            winner = partido.equipo_local if g_local >= g_visit else partido.equipo_visitante
                            from .utils import resolver_campeon_grupo_automatico
                            resolver_campeon_grupo_automatico(db, winner)

        # Commit all changes (live and/or finalized)
        if affected_match_ids or any_live_changed:
            db.commit()

            if affected_match_ids:
                groups = (
                    db.query(Prediccion.id_grupo)
                    .filter(Prediccion.id_partido.in_(affected_match_ids))
                    .distinct()
                    .all()
                )
                for (g_id,) in groups:
                    recalcular_puntos_grupo(db, g_id)
                logger.info(f"[AutoSync] ✅ {updated_count} partido(s) finalizado(s). Puntos recalculados.")
            if any_live_changed:
                logger.info("[AutoSync] 🔴 Datos en vivo actualizados en BD.")
        else:
            logger.info("[AutoSync] ⏳ Sin cambios nuevos.")

    except Exception as e:
        logger.warning(f"[AutoSync] ⏳ API externa worldcup26.ir no disponible temporalmente: {e}")
        db.rollback()
    finally:
        db.close()

    return updated_count

