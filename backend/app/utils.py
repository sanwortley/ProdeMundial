from sqlalchemy.orm import Session
from .models import Prediccion, Partido, GrupoUsuario, PrediccionCampeon

KNOCKOUT_PHASES = {
    "Dieciseisavos de Final", "Octavos de Final",
    "Cuartos de Final", "Semifinal", "Final"
}

def calcular_puntos_prediccion(
    r_l: int, r_v: int, p_l: int, p_v: int,
    joker: bool = False, doble: bool = False,
    ganador_real: str = None, ganador_predicho: str = None,
    is_knockout: bool = False
) -> int:
    is_exact = (r_l == p_l) and (r_v == p_v)
    real_outcome = 1 if r_l > r_v else (-1 if r_l < r_v else 0)
    pred_outcome = 1 if p_l > p_v else (-1 if p_l < p_v else 0)
    correct_outcome = (real_outcome == pred_outcome)

    if joker:
        base = 30 if is_exact else -10
    elif doble:
        base = 20 if is_exact else 0
    else:
        if is_exact:
            base = 10
        elif correct_outcome:
            base = 5
        else:
            base = 0

    # +5 for correct winner prediction: only when BOTH the predicted score
    # AND the actual result were draws (i.e., went to ET/penalties)
    winner_bonus = 0
    if is_knockout and ganador_real and ganador_predicho:
        predicted_draw = (p_l == p_v)
        actual_draw = (r_l == r_v)
        if predicted_draw and actual_draw:
            if ganador_real.strip().lower() == ganador_predicho.strip().lower():
                winner_bonus = 5

    return base + winner_bonus


def recalcular_puntos_grupo(db: Session, id_grupo: int):
    """
    Recalculates points, exact hits, streaks, and updates group rankings for all members in a group.
    Called whenever a match result is updated, or champion is set.
    """
    # Get all members of the group
    miembros = db.query(GrupoUsuario).filter(GrupoUsuario.id_grupo == id_grupo).all()
    
    # Get all finished matches
    partidos_finalizados = db.query(Partido).filter(Partido.finalizado == True).all()
    partidos_dict = {p.id_partido: p for p in partidos_finalizados}
    finished_match_ids = set(partidos_dict.keys())
    
    for miembro in miembros:
        id_usuario = miembro.id_usuario
        
        # 1. Update points for predictions of finished matches
        predicciones = db.query(Prediccion).filter(
            Prediccion.id_grupo == id_grupo,
            Prediccion.id_usuario == id_usuario
        ).all()
        
        for pred in predicciones:
            if pred.id_partido in finished_match_ids:
                partido = partidos_dict[pred.id_partido]
                is_ko = partido.fase in KNOCKOUT_PHASES
                pred.puntos_obtenidos = calcular_puntos_prediccion(
                    partido.goles_local,
                    partido.goles_visitante,
                    pred.goles_local_predicho,
                    pred.goles_visitante_predicho,
                    joker=pred.usa_joker,
                    doble=pred.usa_doble,
                    ganador_real=partido.ganador if is_ko else None,
                    ganador_predicho=pred.ganador_predicho if is_ko else None,
                    is_knockout=is_ko,
                )
            else:
                pred.puntos_obtenidos = 0
                
        # Commit the individual prediction updates
        db.flush()
        
        # 2. Sort finished predictions chronologically to compute streaks
        # We join with Partido to order by match date
        predicciones_finalizadas = db.query(Prediccion).join(Partido).filter(
            Prediccion.id_grupo == id_grupo,
            Prediccion.id_usuario == id_usuario,
            Partido.finalizado == True
        ).order_by(Partido.fecha.asc()).all()
        
        exact_hits = 0
        puntos_base = 0
        
        # Streak calculations
        streaks = []
        current_streak = 0
        
        for pred in predicciones_finalizadas:
            partido = partidos_dict[pred.id_partido]
            is_exact = (partido.goles_local == pred.goles_local_predicho) and (partido.goles_visitante == pred.goles_visitante_predicho)
            if is_exact:
                exact_hits += 1
                
            puntos_base += pred.puntos_obtenidos
            
            # A prediction is "successful" (acierta) if points_obtained > 0.
            # (Note: incorrect Joker results in -10, wrong double results in 0, so points_obtained must be > 0 to be successful)
            if pred.puntos_obtenidos > 0:
                current_streak += 1
            else:
                if current_streak > 0:
                    streaks.append(current_streak)
                    current_streak = 0
                    
        if current_streak > 0:
            streaks.append(current_streak)
            
        mejor_racha = max(streaks) if streaks else 0
        
        # Bonus calculation: +15 points for every block of 5 consecutive successful predictions
        streak_bonus = sum((streak // 5) * 15 for streak in streaks)
        
        # 3. Add Champion Prediction Points if applicable
        pred_campeon = db.query(PrediccionCampeon).filter(
            PrediccionCampeon.id_grupo == id_grupo,
            PrediccionCampeon.id_usuario == id_usuario
        ).first()
        
        puntos_campeon = 0
        if pred_campeon:
            puntos_campeon = pred_campeon.puntos_obtenidos
            
        # Total points (including manual extra adjustments)
        puntos_extra = miembro.puntos_extra or 0
        miembro.puntos_totales = puntos_base + streak_bonus + puntos_campeon + puntos_extra
        miembro.cantidad_exactos = exact_hits
        miembro.mejor_racha = mejor_racha
        
    db.commit()


def resolver_campeon_grupo_automatico(db, equipo_campeon: str):
    """
    Sets the champion prediction points for all users across all groups
    and recalculates points for all groups.
    """
    from .models import PrediccionCampeon, Grupo
    import logging
    logger = logging.getLogger(__name__)

    # Update points for PrediccionCampeon in all groups
    predicciones = db.query(PrediccionCampeon).all()
    for pred in predicciones:
        if pred.equipo_campeon.strip().lower() == equipo_campeon.strip().lower():
            pred.puntos_obtenidos = 50
        else:
            pred.puntos_obtenidos = 0
            
    db.commit()
    logger.info(f"[AutoChampion] Campeón '{equipo_campeon}' asignado. Recalculando todos los grupos...")
    
    # Recalculate rankings for all groups
    grupos = db.query(Grupo).all()
    for group in grupos:
        recalcular_puntos_grupo(db, group.id_grupo)
