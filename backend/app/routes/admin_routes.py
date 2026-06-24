import datetime
import logging
import random
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..database import get_db
from ..models import Partido, Prediccion, Grupo, GrupoUsuario, Usuario
from ..auth import get_current_user
from ..utils import recalcular_puntos_grupo

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin"])


class FechaInfo(BaseModel):
    fase: str
    total: int
    finalizados: int
    pendientes: int


class SimulateResult(BaseModel):
    fecha: str
    partidos_actualizados: int
    grupos_afectados: int


def _require_admin(current_user: Usuario = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Se requiere ser administrador")
    return current_user


@router.get("/fantasy/fechas", response_model=List[FechaInfo])
def list_fechas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """List all available fechas with match counts."""
    fechas = db.query(Partido.fase, Partido.fecha).distinct().order_by(Partido.fecha.asc()).all()
    result = []
    for (fase, _) in fechas:
        total = db.query(Partido).filter(Partido.fase == fase).count()
        finalizados = db.query(Partido).filter(Partido.fase == fase, Partido.finalizado == True).count()
        result.append(FechaInfo(
            fase=fase,
            total=total,
            finalizados=finalizados,
            pendientes=total - finalizados,
        ))
    return result


@router.post("/admin/simulate-fecha/{fecha}", response_model=SimulateResult)
def simulate_fecha(
    fecha: str,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(_require_admin),
):
    """Set random scores for all unfinished matches in a fecha. Admin only."""
    partidos = db.query(Partido).filter(
        Partido.fase == fecha,
        Partido.finalizado == False
    ).all()

    if not partidos:
        raise HTTPException(status_code=400, detail=f"No hay partidos pendientes en {fecha}")

    for p in partidos:
        p.goles_local = random.randint(0, 5)
        p.goles_visitante = random.randint(0, 5)
        p.finalizado = True

    db.commit()

    # Recalculate prediction points (Prode) for affected groups
    from ..models import Prediccion
    groups = db.query(Prediccion.id_grupo).filter(
        Prediccion.id_partido.in_([p.id_partido for p in partidos])
    ).distinct().all()
    affected_groups = list(set(g_id for (g_id,) in groups))

    for g_id in affected_groups:
        recalcular_puntos_grupo(db, g_id)

    # Fantasy: NO se actualizan puntos aquí — el Fantasy solo funciona para Duelos

    return SimulateResult(
        fecha=fecha,
        partidos_actualizados=len(partidos),
        grupos_afectados=len(affected_groups),
    )


class UserPointAdjustment(BaseModel):
    nombre: str
    puntos: int
    grupo: str | None = None


@router.post("/admin/ajustar-puntos")
def ajustar_puntos(
    req: UserPointAdjustment,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(_require_admin),
):
    """Add/remove points from a user. Admin only.
    Searches by partial name match. If exactly one user matches, adjusts points.
    If multiple match, returns the list without modifying anything.
    If `grupo` is provided, only adjusts in that group (partial name match)."""
    from ..models import Grupo, GrupoUsuario

    usuarios = db.query(Usuario).filter(Usuario.nombre.ilike(f"%{req.nombre}%")).all()

    if len(usuarios) == 0:
        return {"detail": f"Ningún usuario coincide con '{req.nombre}'", "coincidencias": []}

    if len(usuarios) > 1:
        return {
            "detail": f"Varios usuarios coinciden con '{req.nombre}', especificá más",
            "coincidencias": [{"id_usuario": u.id_usuario, "nombre": u.nombre, "email": u.email} for u in usuarios],
        }

    user = usuarios[0]

    query = db.query(GrupoUsuario).filter(GrupoUsuario.id_usuario == user.id_usuario)

    if req.grupo:
        grupo = db.query(Grupo).filter(Grupo.nombre_grupo.ilike(f"%{req.grupo}%")).first()
        if not grupo:
            return {"detail": f"No se encontró el grupo '{req.grupo}'"}
        query = query.filter(GrupoUsuario.id_grupo == grupo.id_grupo)

    member_entries = query.all()
    for entry in member_entries:
        entry.puntos_extra = (entry.puntos_extra or 0) + req.puntos
        entry.puntos_totales = (entry.puntos_totales or 0) + req.puntos

    db.commit()
    return {
        "detail": f"Se ajustaron {req.puntos} puntos a '{user.nombre}' en {len(member_entries)} grupo(s)",
        "usuario": user.nombre,
        "puntos_ajuste": req.puntos,
        "grupos_afectados": len(member_entries),
    }


class MatchTeamsUpdate(BaseModel):
    equipo_local: str
    equipo_visitante: str


@router.put("/admin/matches/{match_id}/teams")
def update_match_teams(
    match_id: int,
    req: MatchTeamsUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(_require_admin),
):
    """Update team names for a match (useful for setting qualified teams in knockouts). Admin only."""
    partido = db.query(Partido).filter(Partido.id_partido == match_id).first()
    if not partido:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    
    old_local = partido.equipo_local
    old_visitante = partido.equipo_visitante
    
    partido.equipo_local = req.equipo_local.strip()
    partido.equipo_visitante = req.equipo_visitante.strip()
    
    db.commit()
    db.refresh(partido)
    
    return {
        "detail": f"Partido {match_id} actualizado: {old_local} vs {old_visitante} -> {partido.equipo_local} vs {partido.equipo_visitante}",
        "partido": {
            "id_partido": partido.id_partido,
            "fase": partido.fase,
            "equipo_local": partido.equipo_local,
            "equipo_visitante": partido.equipo_visitante
        }
    }


FECHA2_IDS = list(range(25, 49))


def _build_team_confidence(db):
    fecha1_matches = db.query(Partido).filter(Partido.fase == "Fecha 1").all()
    fecha1_ids = {m.id_partido for m in fecha1_matches}
    preds = db.query(Prediccion).filter(Prediccion.id_partido.in_(fecha1_ids)).all()
    confianza = defaultdict(lambda: defaultdict(lambda: {"favor": 0, "contra": 0, "count": 0}))
    match_map = {m.id_partido: m for m in fecha1_matches}
    for p in preds:
        m = match_map.get(p.id_partido)
        if not m:
            continue
        loc = confianza[p.id_usuario][m.equipo_local]
        loc["favor"] += p.goles_local_predicho
        loc["contra"] += p.goles_visitante_predicho
        loc["count"] += 1
        vis = confianza[p.id_usuario][m.equipo_visitante]
        vis["favor"] += p.goles_visitante_predicho
        vis["contra"] += p.goles_local_predicho
        vis["count"] += 1
    return confianza


def _build_user_profile(db):
    fecha1_matches = db.query(Partido).filter(Partido.fase == "Fecha 1").all()
    fecha1_ids = {m.id_partido for m in fecha1_matches}
    preds = db.query(Prediccion).filter(Prediccion.id_partido.in_(fecha1_ids)).all()
    perfiles = defaultdict(lambda: {"total_local": 0, "total_visit": 0, "total_matches": 0})
    for p in preds:
        pr = perfiles[p.id_usuario]
        pr["total_local"] += p.goles_local_predicho
        pr["total_visit"] += p.goles_visitante_predicho
        pr["total_matches"] += 1
    return perfiles


def _generar_prediccion(equipo_local, equipo_visitante, confianza_equipos, perfil):
    c_local = confianza_equipos.get(equipo_local, {"favor": 0, "contra": 0, "count": 0})
    c_visit = confianza_equipos.get(equipo_visitante, {"favor": 0, "contra": 0, "count": 0})
    def _net(c):
        return (c["favor"] - c["contra"]) / max(c["count"], 1)
    diff = _net(c_local) - _net(c_visit)
    avg_local = round(perfil["total_local"] / max(perfil["total_matches"], 1))
    avg_visit = round(perfil["total_visit"] / max(perfil["total_matches"], 1))
    avg_total = avg_local + avg_visit
    THRESHOLD = 0.5
    if diff > THRESHOLD:
        gd = min(round(abs(diff)), 3)
        p_local = avg_local + gd
        p_visit = max(avg_visit - max(gd - 1, 0), 0)
    elif diff < -THRESHOLD:
        gd = min(round(abs(diff)), 3)
        p_local = max(avg_local - max(gd - 1, 0), 0)
        p_visit = avg_visit + gd
    else:
        mitad = round(avg_total / 2)
        p_local = mitad
        p_visit = mitad
    return min(max(p_local, 0), 10), min(max(p_visit, 0), 10)


class RecoverResult(BaseModel):
    total_generated: int
    total_skipped: int
    total_inserted: int
    grupos_afectados: int
    usuarios_con_perfil: int


@router.post("/admin/recover-fecha2")
def recover_fecha2(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(_require_admin),
):
    """Recupera predicciones de Fecha 2 perdidas. Admin only."""
    fecha2_matches = db.query(Partido).filter(Partido.id_partido.in_(FECHA2_IDS)).order_by(Partido.id_partido).all()
    if not fecha2_matches:
        raise HTTPException(status_code=400, detail="No se encontraron partidos de Fecha 2")

    confianza = _build_team_confidence(db)
    perfiles = _build_user_profile(db)
    grupos = db.query(Grupo).all()
    match_map = {m.id_partido: m for m in fecha2_matches}

    total_generated = 0
    total_skipped = 0
    total_inserted = 0

    for grupo in grupos:
        miembros = db.query(GrupoUsuario).filter(GrupoUsuario.id_grupo == grupo.id_grupo).all()
        for miembro in miembros:
            uid = miembro.id_usuario
            existentes = {
                p.id_partido
                for p in db.query(Prediccion).filter(
                    Prediccion.id_grupo == grupo.id_grupo,
                    Prediccion.id_usuario == uid,
                    Prediccion.id_partido.in_(FECHA2_IDS),
                ).all()
            }
            conf_usr = confianza.get(uid, {})
            perfil_usr = perfiles.get(uid, {"total_local": 1, "total_visit": 1, "total_matches": 1})

            for pid in FECHA2_IDS:
                if pid in existentes:
                    total_skipped += 1
                    continue
                match = match_map.get(pid)
                if not match:
                    continue
                p_local, p_visit = _generar_prediccion(
                    match.equipo_local, match.equipo_visitante, conf_usr, perfil_usr,
                )
                total_generated += 1
                pred = Prediccion(
                    id_usuario=uid,
                    id_grupo=grupo.id_grupo,
                    id_partido=pid,
                    goles_local_predicho=p_local,
                    goles_visitante_predicho=p_visit,
                    puntos_obtenidos=0,
                    usa_joker=False,
                    usa_doble=False,
                    fecha_carga=datetime.datetime.utcnow(),
                )
                db.add(pred)
                total_inserted += 1

    db.commit()
    logger.info(f"Recover Fecha2: {total_inserted} predicciones insertadas")

    for grupo in grupos:
        recalcular_puntos_grupo(db, grupo.id_grupo)

    return RecoverResult(
        total_generated=total_generated,
        total_skipped=total_skipped,
        total_inserted=total_inserted,
        grupos_afectados=len(grupos),
        usuarios_con_perfil=len(perfiles),
    )

