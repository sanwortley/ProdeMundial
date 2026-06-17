import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..database import get_db
from ..models import Partido, Usuario
from ..auth import get_current_user
from ..utils import recalcular_puntos_grupo

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


@router.post("/admin/ajustar-puntos")
def ajustar_puntos(
    req: UserPointAdjustment,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(_require_admin),
):
    """Add/remove points from a user in ALL groups. Admin only."""
    from ..models import GrupoUsuario

    usuarios = db.query(Usuario).filter(Usuario.nombre == req.nombre).all()
    if not usuarios:
        raise HTTPException(status_code=404, detail=f"Usuario '{req.nombre}' no encontrado")

    total_updated = 0
    for user in usuarios:
        member_entries = db.query(GrupoUsuario).filter(GrupoUsuario.id_usuario == user.id_usuario).all()
        for entry in member_entries:
            entry.puntos_totales = (entry.puntos_totales or 0) + req.puntos
            total_updated += 1

    db.commit()
    return {
        "detail": f"Se ajustaron {req.puntos} puntos a '{req.nombre}' en {total_updated} grupo(s)",
        "usuario": req.nombre,
        "puntos_ajuste": req.puntos,
        "grupos_afectados": total_updated,
    }
