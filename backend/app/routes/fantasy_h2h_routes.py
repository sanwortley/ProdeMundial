from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import PartidoFantasia, EquipoFecha, GrupoUsuario, Usuario, Partido
from ..auth import get_current_user

router = APIRouter(prefix="/fantasy/h2h", tags=["fantasy-h2h"])


class H2HMatchResponse(BaseModel):
    id_partido: int
    fecha: str
    ronda: int
    id_local: int
    local: str
    id_visitante: int
    visitante: str
    puntos_local: int
    puntos_visitante: int
    finalizado: bool
    ganador: Optional[int] = None

    class Config:
        from_attributes = True


class H2HStandingEntry(BaseModel):
    id_usuario: int
    nombre: str
    pj: int
    pg: int
    pe: int
    pp: int
    gf: int
    gc: int
    dg: int
    pts: int

    class Config:
        from_attributes = True


def _verify_membership(db: Session, group_id: int, user_id: int):
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id,
        GrupoUsuario.id_usuario == user_id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    return membership


def _generate_round_robin_schedule(member_ids: List[int]):
    """Generates single round-robin (each pair plays once). Returns list of rounds, each round is list of (home, away)."""
    teams = list(member_ids)
    if len(teams) < 2:
        return []

    if len(teams) % 2 == 1:
        teams.append(None)  # bye

    n = len(teams)
    schedule = []
    for r in range(n - 1):
        round_matches = []
        for i in range(n // 2):
            home = teams[i]
            away = teams[n - 1 - i]
            if home is not None and away is not None:
                round_matches.append((home, away))
        if round_matches:
            schedule.append(round_matches)
        # Rotate: keep first fixed, rotate rest clockwise
        teams = [teams[0]] + [teams[-1]] + teams[1:-1]

    return schedule


@router.post("/init/{group_id}")
def init_h2h_fixture(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    existing = db.query(PartidoFantasia).filter(
        PartidoFantasia.id_grupo == group_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El fixture ya fue generado. Usá DELETE /fantasy/h2h/reset/{group_id} para regenerar.")

    members = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id
    ).all()

    if len(members) < 2:
        raise HTTPException(status_code=400, detail="Se necesitan al menos 2 miembros en el grupo")

    member_ids = [m.id_usuario for m in members]
    schedule = _generate_round_robin_schedule(member_ids)
    if not schedule:
        raise HTTPException(status_code=400, detail="No se pudo generar el fixture")

    # Get available fechas from Partido table
    fechas = db.query(Partido.fase, Partido.fecha).distinct().order_by(Partido.fecha.asc()).all()
    fechas_list = [f[0] for f in fechas]

    created = 0
    for r_idx, round_matches in enumerate(schedule):
        fecha = fechas_list[r_idx] if r_idx < len(fechas_list) else f"Jornada {r_idx + 1}"
        for local_id, visit_id in round_matches:
            partido = PartidoFantasia(
                id_grupo=group_id,
                fecha=fecha,
                ronda=r_idx + 1,
                id_local=local_id,
                id_visitante=visit_id,
                puntos_local=0,
                puntos_visitante=0,
                finalizado=False,
            )
            db.add(partido)
            created += 1

    db.commit()
    return {"message": f"Fixture generado: {len(schedule)} rondas, {created} partidos"}


@router.get("/matches/{group_id}", response_model=List[H2HMatchResponse])
def get_h2h_matches(
    group_id: int,
    fecha: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    query = db.query(PartidoFantasia).filter(
        PartidoFantasia.id_grupo == group_id
    )
    if fecha:
        query = query.filter(PartidoFantasia.fecha == fecha)

    matches = query.order_by(PartidoFantasia.ronda, PartidoFantasia.id_partido).all()

    result = []
    for m in matches:
        ganador = None
        if m.finalizado:
            if m.puntos_local > m.puntos_visitante:
                ganador = m.id_local
            elif m.puntos_visitante > m.puntos_local:
                ganador = m.id_visitante

        result.append(H2HMatchResponse(
            id_partido=m.id_partido,
            fecha=m.fecha,
            ronda=m.ronda,
            id_local=m.id_local,
            local=m.local.nombre,
            id_visitante=m.id_visitante,
            visitante=m.visitante.nombre,
            puntos_local=m.puntos_local,
            puntos_visitante=m.puntos_visitante,
            finalizado=m.finalizado,
            ganador=ganador,
        ))

    return result


@router.get("/standings/{group_id}", response_model=List[H2HStandingEntry])
def get_h2h_standings(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    members = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id
    ).all()

    matches = db.query(PartidoFantasia).filter(
        PartidoFantasia.id_grupo == group_id,
        PartidoFantasia.finalizado == True
    ).all()

    # Aggregate per user
    stats = {}
    for m in members:
        stats[m.id_usuario] = {
            "nombre": m.usuario.nombre,
            "pj": 0, "pg": 0, "pe": 0, "pp": 0,
            "gf": 0, "gc": 0, "pts": 0,
        }

    for m in matches:
        if m.id_local in stats and m.id_visitante in stats:
            stats[m.id_local]["pj"] += 1
            stats[m.id_visitante]["pj"] += 1
            stats[m.id_local]["gf"] += m.puntos_local
            stats[m.id_local]["gc"] += m.puntos_visitante
            stats[m.id_visitante]["gf"] += m.puntos_visitante
            stats[m.id_visitante]["gc"] += m.puntos_local

            if m.puntos_local > m.puntos_visitante:
                stats[m.id_local]["pg"] += 1
                stats[m.id_visitante]["pp"] += 1
                stats[m.id_local]["pts"] += 3
            elif m.puntos_visitante > m.puntos_local:
                stats[m.id_visitante]["pg"] += 1
                stats[m.id_local]["pp"] += 1
                stats[m.id_visitante]["pts"] += 3
            else:
                stats[m.id_local]["pe"] += 1
                stats[m.id_visitante]["pe"] += 1
                stats[m.id_local]["pts"] += 1
                stats[m.id_visitante]["pts"] += 1

    result = []
    for uid, s in stats.items():
        result.append(H2HStandingEntry(
            id_usuario=uid,
            nombre=s["nombre"],
            pj=s["pj"],
            pg=s["pg"],
            pe=s["pe"],
            pp=s["pp"],
            gf=s["gf"],
            gc=s["gc"],
            dg=s["gf"] - s["gc"],
            pts=s["pts"],
        ))

    result.sort(key=lambda x: (-x.pts, -x.dg, -x.gf))
    return result


def resolve_h2h_for_fecha(db: Session, group_id: int, fecha: str):
    """Called from sync_service after fantasy points are updated."""
    matches = db.query(PartidoFantasia).filter(
        PartidoFantasia.id_grupo == group_id,
        PartidoFantasia.fecha == fecha,
        PartidoFantasia.finalizado == False
    ).all()

    for m in matches:
        team_local = db.query(EquipoFecha).filter(
            EquipoFecha.id_usuario == m.id_local,
            EquipoFecha.id_grupo == group_id,
            EquipoFecha.fecha == fecha
        ).first()
        team_visit = db.query(EquipoFecha).filter(
            EquipoFecha.id_usuario == m.id_visitante,
            EquipoFecha.id_grupo == group_id,
            EquipoFecha.fecha == fecha
        ).first()

        pts_local = team_local.puntos_totales if team_local else 0
        pts_visit = team_visit.puntos_totales if team_visit else 0

        m.puntos_local = pts_local
        m.puntos_visitante = pts_visit
        m.finalizado = True

    if matches:
        db.commit()

    return len(matches)
