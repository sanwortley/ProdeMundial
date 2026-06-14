import os
import unicodedata
import urllib.request
import json
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Partido, Prediccion, Jugador, EquipoFecha, JugadorEquipoFecha
from .utils import recalcular_puntos_grupo

FOOTBALL_DATA_URL = "https://api.football-data.org/v4/competitions/2000/matches"

ENGLISH_TO_SPANISH_MAP = {
    "mexico": "México",
    "south africa": "Sudáfrica",
    "south korea": "Corea del Sur",
    "czechia": "República Checa",
    "czech republic": "República Checa",
    "canada": "Canadá",
    "bosnia-herzegovina": "Bosnia y Herzegovina",
    "bosnia and herzegovina": "Bosnia y Herzegovina",
    "qatar": "Qatar",
    "switzerland": "Suiza",
    "brazil": "Brasil",
    "morocco": "Marruecos",
    "haiti": "Haití",
    "scotland": "Escocia",
    "united states": "Estados Unidos",
    "usa": "Estados Unidos",
    "paraguay": "Paraguay",
    "australia": "Australia",
    "turkey": "Turquía",
    "germany": "Alemania",
    "curacao": "Curazao",
    "curaçao": "Curazao",
    "netherlands": "Países Bajos",
    "japan": "Japón",
    "ivory coast": "Costa de Marfil",
    "cote d'ivoire": "Costa de Marfil",
    "ecuador": "Ecuador",
    "sweden": "Suecia",
    "tunisia": "Túnez",
    "spain": "España",
    "cape verde": "Cabo Verde",
    "cape verde islands": "Cabo Verde",
    "belgium": "Bélgica",
    "egypt": "Egipto",
    "saudi arabia": "Arabia Saudita",
    "uruguay": "Uruguay",
    "iran": "Irán",
    "new zealand": "Nueva Zelanda",
    "france": "Francia",
    "senegal": "Senegal",
    "iraq": "Irak",
    "norway": "Noruega",
    "argentina": "Argentina",
    "algeria": "Argelia",
    "austria": "Austria",
    "jordan": "Jordania",
    "portugal": "Portugal",
    "congo": "Congo",
    "england": "Inglaterra",
    "croatia": "Croacia",
    "ghana": "Ghana",
    "panama": "Panamá",
    "uzbekistan": "Uzbekistán",
    "colombia": "Colombia",
}

SPANISH_TO_ENGLISH_MAP = {
    "mexico": "Mexico",
    "sudafrica": "South Africa",
    "corea del sur": "South Korea",
    "republica checa": "Czech Republic",
    "canada": "Canada",
    "bosnia y herzegovina": "Bosnia and Herzegovina",
    "qatar": "Qatar",
    "suiza": "Switzerland",
    "brasil": "Brazil",
    "marruecos": "Morocco",
    "haiti": "Haiti",
    "escocia": "Scotland",
    "estados unidos": "USA",
    "paraguay": "Paraguay",
    "australia": "Australia",
    "turquia": "Turkey",
    "alemania": "Germany",
    "curazao": "Curacao",
    "costa de marfil": "Ivory Coast",
    "ecuador": "Ecuador",
    "espana": "Spain",
    "cabo verde": "Cape Verde Islands",
    "belgica": "Belgium",
    "egipto": "Egypt",
    "arabia saudita": "Saudi Arabia",
    "uruguay": "Uruguay",
    "iran": "Iran",
    "nueva zelanda": "New Zealand",
    "francia": "France",
    "senegal": "Senegal",
    "irak": "Iraq",
    "noruega": "Norway",
    "argentina": "Argentina",
    "argelia": "Algeria",
    "austria": "Austria",
    "jordania": "Jordan",
    "portugal": "Portugal",
    "congo": "Congo",
    "inglaterra": "England",
    "croacia": "Croatia",
    "ghana": "Ghana",
    "panama": "Panama",
    "uzbekistan": "Uzbekistan",
    "colombia": "Colombia",
    "paises bajos": "Netherlands",
    "japon": "Japan",
    "suecia": "Sweden",
    "tunez": "Tunisia",
}


def normalize_name(name: str) -> str:
    if name is None:
        return ""
    n = name.lower().strip()
    n = "".join(c for c in unicodedata.normalize("NFD", n) if unicodedata.category(c) != "Mn")
    return n


def map_team_name(name: str) -> str:
    if name is None:
        return ""
    # Maps Spanish team name to English for Player queries (used in fantasy points calculation)
    n = normalize_name(name)
    mapped = SPANISH_TO_ENGLISH_MAP.get(n)
    if mapped:
        return mapped
    return name


def map_english_to_spanish(name: str) -> str:
    if name is None:
        return ""
    # Maps English team name from the API to Spanish for Partido queries
    n = normalize_name(name)
    mapped = ENGLISH_TO_SPANISH_MAP.get(n)
    if mapped:
        return mapped
    return name


def check_and_advance_knockouts(db: Session, match_id: int, equipo_local: str, equipo_visitante: str, goles_local: int, goles_visitante: int):
    if goles_local > goles_visitante:
        winner = equipo_local
    elif goles_visitante > goles_local:
        winner = equipo_visitante
    else:
        winner = equipo_local
    placeholder = f"Ganador Partido {match_id}"
    for m in db.query(Partido).filter(Partido.equipo_local == placeholder).all():
        m.equipo_local = winner
    for m in db.query(Partido).filter(Partido.equipo_visitante == placeholder).all():
        m.equipo_visitante = winner
    db.commit()


def auto_sync_matches(db: Session) -> dict:
    api_key = os.getenv("FOOTBALL_DATA_KEY")
    if not api_key:
        return {"updated": 0, "groups": 0, "error": "FOOTBALL_DATA_KEY no configurada"}

    # Query all non-finished matches (ignore date filters so that early matches or matches with wrong scheduled time are updated too!)
    partidos_pendientes = db.query(Partido).filter(
        Partido.finalizado == False
    ).order_by(Partido.fecha.asc()).all()

    if not partidos_pendientes:
        return {"updated": 0, "groups": 0, "reason": "Sin partidos pendientes"}

    req = urllib.request.Request(FOOTBALL_DATA_URL)
    req.add_header("X-Auth-Token", api_key)

    try:
        with urllib.request.urlopen(req, timeout=10.0) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {"updated": 0, "groups": 0, "error": f"Error llamando a football-data.org: {e}"}

    fixtures = data.get("matches", [])
    fixtures_map = {}
    for f in fixtures:
        home = map_english_to_spanish(f.get("homeTeam", {}).get("name", ""))
        away = map_english_to_spanish(f.get("awayTeam", {}).get("name", ""))
        
        utc_date_str = f.get("utcDate", "")
        match_date = None
        if utc_date_str:
            try:
                match_date = datetime.strptime(utc_date_str.replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                pass
                
        status = f.get("status")
        score = f.get("score", {}).get("fullTime", {})
        h_goals = score.get("home")
        a_goals = score.get("away")
        
        fixtures_map[(normalize_name(home), normalize_name(away))] = {
            "goles_local": h_goals,
            "goles_visitante": a_goals,
            "finalizado": status == "FINISHED",
            "fecha": match_date
        }

    updated_ids = []
    any_changed = False
    for p in partidos_pendientes:
        p_local = normalize_name(p.equipo_local)
        p_visit = normalize_name(p.equipo_visitante)
        if (p_local, p_visit) in fixtures_map:
            api_match = fixtures_map[(p_local, p_visit)]
            
            # Sync date/time if it changed and is valid
            if api_match["fecha"] and p.fecha != api_match["fecha"]:
                p.fecha = api_match["fecha"]
                any_changed = True
                
            if api_match["finalizado"]:
                g_l = api_match["goles_local"]
                g_v = api_match["goles_visitante"]
                if g_l is not None and g_v is not None:
                    p.goles_local = g_l
                    p.goles_visitante = g_v
                    p.finalizado = True
                    any_changed = True
                    updated_ids.append(p.id_partido)
                    check_and_advance_knockouts(db, p.id_partido, p.equipo_local, p.equipo_visitante, g_l, g_v)

    if any_changed:
        db.commit()

    if not updated_ids:
        # Commit any date corrections that occurred even if no matches finished
        return {"updated": 0, "groups": 0, "reason": "No se encontraron nuevos resultados finalizados en la API."}

    groups = db.query(Prediccion.id_grupo).filter(
        Prediccion.id_partido.in_(updated_ids)
    ).distinct().all()
    affected_group_ids = list(set(g_id for (g_id,) in groups))
    for g_id in affected_group_ids:
        recalcular_puntos_grupo(db, g_id)

    # Recalculate fantasy points for affected matches
    resolved_fechas = set()
    for p in partidos_pendientes:
        if p.id_partido in updated_ids and p.goles_local is not None and p.goles_visitante is not None:
            _update_fantasy_points(db, p)
            resolved_fechas.add(p.fase)

    # Resolve H2H matches for affected fechas
    if resolved_fechas:
        try:
            from .routes.fantasy_h2h_routes import resolve_h2h_for_fecha
            from .models import PartidoFantasia
            for fecha in resolved_fechas:
                groups = db.query(PartidoFantasia.id_grupo).filter(
                    PartidoFantasia.fecha == fecha,
                    PartidoFantasia.finalizado == False
                ).distinct().all()
                for (g_id,) in groups:
                    resolve_h2h_for_fecha(db, g_id, fecha)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error resolving H2H: {e}")

    return {"updated": len(updated_ids), "groups": len(affected_group_ids)}



def _update_fantasy_points(db: Session, partido: Partido):
    home_en = map_team_name(partido.equipo_local)
    away_en = map_team_name(partido.equipo_visitante)
    g_h = partido.goles_local
    g_a = partido.goles_visitante

    # Points by match outcome
    win_pts = 3
    draw_pts = 1
    goal_pts = 1  # per goal for MID/FWD

    for team_name, scored, conceded in [(home_en, g_h, g_a), (away_en, g_a, g_h)]:
        if not team_name:
            continue

        # Find players on this national team
        jugadores = db.query(Jugador).filter(Jugador.equipo_nacional == team_name).all()
        jugador_ids = [j.id_jugador for j in jugadores]
        if not jugador_ids:
            continue

        # Find fantasy team picks that own these players for this match's fecha
        picks = db.query(JugadorEquipoFecha).join(
            EquipoFecha, JugadorEquipoFecha.id_equipo == EquipoFecha.id_equipo
        ).filter(
            JugadorEquipoFecha.id_jugador.in_(jugador_ids),
            EquipoFecha.fecha == partido.fase,
        ).all()

        if not picks:
            continue

        # Calculate points for each player
        team_pts_by_player = {}
        for j in jugadores:
            pts = 0
            if scored > conceded:
                pts += win_pts
            elif scored == conceded:
                pts += draw_pts
            if conceded == 0 and j.posicion in ("GK", "DEF"):
                pts += 4
            if j.posicion in ("MID", "FWD"):
                pts += scored * goal_pts
            team_pts_by_player[j.id_jugador] = pts

        # Award points to fantasy teams
        fantasy_pts_by_team = {}
        for pick in picks:
            team_id = pick.id_equipo
            player_pts = team_pts_by_player.get(pick.id_jugador, 0)
            if team_id not in fantasy_pts_by_team:
                fantasy_pts_by_team[team_id] = 0
            fantasy_pts_by_team[team_id] += player_pts
            # Update individual player total
            jug = db.query(Jugador).filter(Jugador.id_jugador == pick.id_jugador).first()
            if jug:
                jug.puntos_totales = (jug.puntos_totales or 0) + player_pts

        # Update fantasy team totals
        for team_id, pts in fantasy_pts_by_team.items():
            team = db.query(EquipoFecha).filter(EquipoFecha.id_equipo == team_id).first()
            if team:
                team.puntos_totales = (team.puntos_totales or 0) + pts

    db.commit()
