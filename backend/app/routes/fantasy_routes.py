from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import Jugador, EquipoFecha, JugadorEquipoFecha, GrupoUsuario, Usuario
from ..auth import get_current_user

router = APIRouter(prefix="/fantasy", tags=["fantasy"])

# --- Schemas ---

class JugadorResponse(BaseModel):
    id_jugador: int
    nombre: str
    posicion: str
    equipo_nacional: str
    valor_inicial: int
    puntos_totales: int

    class Config:
        from_attributes = True


class EquipoFechaResponse(BaseModel):
    id_equipo: int
    id_grupo: int
    fecha: str
    formacion: str
    presupuesto_restante: int
    puntos_totales: int
    jugadores: List["JugadorEquipoResponse"] = []
    jugadores_no_disponibles: List[int] = []

    class Config:
        from_attributes = True


class JugadorEquipoResponse(BaseModel):
    id: int
    id_jugador: int
    nombre: str
    posicion: str
    posicion_cancha: Optional[str]
    orden: int
    equipo_nacional: str
    valor_inicial: int

    class Config:
        from_attributes = True


class PickPlayerRequest(BaseModel):
    id_grupo: int
    fecha: str
    id_jugador: int
    posicion_cancha: Optional[str] = None

    class Config:
        from_attributes = True


class InitTeamRequest(BaseModel):
    formacion: str = "4-4-2"


class FantasyRankingEntry(BaseModel):
    id_usuario: int
    nombre: str
    puntos_totales: int


FORMATIONS = {
    "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
    "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"],
    "3-5-2": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "CM", "RM", "ST", "ST"],
    "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"],
    "5-3-2": ["GK", "LB", "CB", "CB", "CB", "RB", "CM", "CM", "CM", "ST", "ST"],
    "3-4-3": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
}

POSITION_COUNTS = {
    "4-4-2": {"GK": 1, "DEF": 4, "MID": 4, "FWD": 2},
    "4-3-3": {"GK": 1, "DEF": 4, "MID": 3, "FWD": 3},
    "3-5-2": {"GK": 1, "DEF": 3, "MID": 5, "FWD": 2},
    "4-2-3-1": {"GK": 1, "DEF": 4, "MID": 4, "FWD": 1},
    "5-3-2": {"GK": 1, "DEF": 5, "MID": 3, "FWD": 2},
    "3-4-3": {"GK": 1, "DEF": 3, "MID": 4, "FWD": 3},
}

POS_TO_ROLE = {
    "GK": "GK",
    "LB": "DEF", "CB": "DEF", "RB": "DEF",
    "LM": "MID", "CM": "MID", "RM": "MID", "CDM": "MID", "CAM": "MID",
    "LW": "FWD", "RW": "FWD", "ST": "FWD",
}


def _verify_membership(db: Session, group_id: int, user_id: int):
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id,
        GrupoUsuario.id_usuario == user_id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    return membership


def _get_or_create_team(db: Session, user_id: int, group_id: int, fecha: str, formacion: str = "4-4-2"):
    team = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == user_id,
        EquipoFecha.id_grupo == group_id,
        EquipoFecha.fecha == fecha
    ).first()
    if not team:
        team = EquipoFecha(
            id_usuario=user_id,
            id_grupo=group_id,
            fecha=fecha,
            formacion=formacion,
            presupuesto_restante=200,
            puntos_totales=0,
        )
        db.add(team)
        db.commit()
        db.refresh(team)
    return team


# --- Endpoints ---

@router.get("/players", response_model=List[JugadorResponse])
def list_players(
    posicion: Optional[str] = Query(None, pattern="^(GK|DEF|MID|FWD)$"),
    equipo: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    query = db.query(Jugador)
    if posicion:
        query = query.filter(Jugador.posicion == posicion)
    if equipo:
        query = query.filter(Jugador.equipo_nacional.ilike(f"%{equipo}%"))
    if search:
        query = query.filter(Jugador.nombre.ilike(f"%{search}%"))
    return query.order_by(Jugador.valor_inicial.desc()).all()


@router.post("/team/init/{group_id}", response_model=EquipoFechaResponse)
def init_team(
    group_id: int,
    req: InitTeamRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    # Determine current fecha based on unfinished matches
    from ..models import Partido
    now = __import__("datetime").datetime.utcnow()
    current_fecha = db.query(Partido.fase).filter(
        Partido.fecha <= now,
        Partido.finalizado == False
    ).order_by(Partido.fecha.asc()).first()

    if not current_fecha:
        upcoming = db.query(Partido.fase).order_by(Partido.fecha.asc()).first()
        if upcoming:
            current_fecha = upcoming
        else:
            raise HTTPException(status_code=400, detail="No hay partidos disponibles")

    fecha = current_fecha[0]

    if req.formacion not in FORMATIONS:
        raise HTTPException(status_code=400, detail=f"Formación no válida. Opciones: {', '.join(FORMATIONS.keys())}")

    team = _get_or_create_team(db, current_user.id_usuario, group_id, fecha, req.formacion)
    if team.formacion != req.formacion:
        team.formacion = req.formacion
        db.commit()

    return _load_team_response(db, team)


def _load_team_response(db: Session, team: EquipoFecha):
    picks = db.query(
        JugadorEquipoFecha, Jugador
    ).join(
        Jugador, Jugador.id_jugador == JugadorEquipoFecha.id_jugador
    ).filter(
        JugadorEquipoFecha.id_equipo == team.id_equipo
    ).order_by(JugadorEquipoFecha.orden).all()

    jugadores = []
    for je, j in picks:
        jugadores.append(JugadorEquipoResponse(
            id=je.id,
            id_jugador=j.id_jugador,
            nombre=j.nombre,
            posicion=j.posicion,
            posicion_cancha=je.posicion_cancha,
            orden=je.orden,
            equipo_nacional=j.equipo_nacional,
            valor_inicial=j.valor_inicial,
        ))

    # Players already taken by other users in this group for this fecha
    taken_ids = db.query(JugadorEquipoFecha.id_jugador).join(
        EquipoFecha, JugadorEquipoFecha.id_equipo == EquipoFecha.id_equipo
    ).filter(
        EquipoFecha.id_grupo == team.id_grupo,
        EquipoFecha.fecha == team.fecha,
        EquipoFecha.id_usuario != team.id_usuario
    ).all()

    return EquipoFechaResponse(
        id_equipo=team.id_equipo,
        id_grupo=team.id_grupo,
        fecha=team.fecha,
        formacion=team.formacion,
        presupuesto_restante=team.presupuesto_restante,
        puntos_totales=team.puntos_totales,
        jugadores=jugadores,
        jugadores_no_disponibles=[t[0] for t in taken_ids],
    )


@router.get("/team/{group_id}", response_model=EquipoFechaResponse)
def get_team(
    group_id: int,
    fecha: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    if not fecha:
        from ..models import Partido
        now = __import__("datetime").datetime.utcnow()
        current = db.query(Partido.fase).filter(
            Partido.fecha <= now
        ).order_by(Partido.fecha.desc()).first()
        if current:
            fecha = current[0]
        else:
            upcoming = db.query(Partido.fase).order_by(Partido.fecha.asc()).first()
            if not upcoming:
                raise HTTPException(status_code=400, detail="No hay fechas disponibles")
            fecha = upcoming[0]

    team = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == current_user.id_usuario,
        EquipoFecha.id_grupo == group_id,
        EquipoFecha.fecha == fecha
    ).first()

    if not team:
        raise HTTPException(status_code=404, detail="No has armado equipo para esta fecha")

    return _load_team_response(db, team)


@router.post("/team/pick")
def pick_player(
    req: PickPlayerRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, req.id_grupo, current_user.id_usuario)

    team = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == current_user.id_usuario,
        EquipoFecha.id_grupo == req.id_grupo,
        EquipoFecha.fecha == req.fecha
    ).first()

    if not team:
        raise HTTPException(status_code=400, detail="Primero inicializá tu equipo con POST /fantasy/team/init/{group_id}")

    # Check player exists
    jugador = db.query(Jugador).filter(Jugador.id_jugador == req.id_jugador).first()
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    # Check budget
    if team.presupuesto_restante < jugador.valor_inicial:
        raise HTTPException(status_code=400, detail=f"Presupuesto insuficiente. Tenés ${team.presupuesto_restante}M, el jugador cuesta ${jugador.valor_inicial}M.")

    # Check player not already picked by another user in this group for this fecha
    already_picked = db.query(JugadorEquipoFecha).join(
        EquipoFecha, JugadorEquipoFecha.id_equipo == EquipoFecha.id_equipo
    ).filter(
        EquipoFecha.id_grupo == req.id_grupo,
        EquipoFecha.fecha == req.fecha,
        JugadorEquipoFecha.id_jugador == req.id_jugador,
    ).first()
    if already_picked:
        raise HTTPException(status_code=400, detail="Ese jugador ya fue seleccionado por otro usuario en esta fecha")

    # Check player not already in this user's team for this fecha
    already_mine = db.query(JugadorEquipoFecha).filter(
        JugadorEquipoFecha.id_equipo == team.id_equipo,
        JugadorEquipoFecha.id_jugador == req.id_jugador,
    ).first()
    if already_mine:
        raise HTTPException(status_code=400, detail="Ya tenés ese jugador en tu equipo")

    # Load existing picks (used for country limit, slot count, and role validation)
    existing_picks = db.query(JugadorEquipoFecha, Jugador).join(
        Jugador, Jugador.id_jugador == JugadorEquipoFecha.id_jugador
    ).filter(JugadorEquipoFecha.id_equipo == team.id_equipo).all()

    # Max 3 players from same country
    country_count = sum(1 for _, j in existing_picks if j.equipo_nacional == jugador.equipo_nacional)
    if country_count >= 3:
        raise HTTPException(status_code=400, detail=f"Límite de 3 jugadores de {jugador.equipo_nacional} alcanzado")

    current_picks = len(existing_picks)

    if current_picks >= 11:
        raise HTTPException(status_code=400, detail="Ya tenés 11 jugadores. Dropeá uno antes de agregar otro.")

    # Validate formation position limits
    formation = team.formacion
    expected_counts = POSITION_COUNTS.get(formation, {"GK": 1, "DEF": 4, "MID": 4, "FWD": 2})
    role = POS_TO_ROLE.get(req.posicion_cancha, jugador.posicion) if req.posicion_cancha else jugador.posicion

    # Count by role
    role_counts = {r: 0 for r in ["GK", "DEF", "MID", "FWD"]}
    assigned_role = role

    for je, j in existing_picks:
        pos = POS_TO_ROLE.get(je.posicion_cancha, j.posicion)
        if pos in role_counts:
            role_counts[pos] += 1

    if assigned_role in role_counts and role_counts[assigned_role] >= expected_counts.get(assigned_role, 99):
        raise HTTPException(status_code=400, detail=f"Límite de {assigned_role} alcanzado para formación {formation}")

    # Determine position in formation
    formation_slots = FORMATIONS.get(formation, [])
    slot_idx = None
    for i, slot in enumerate(formation_slots):
        if slot == req.posicion_cancha:
            # Check if this slot is already taken
            taken_positions = set()
            for je, _ in existing_picks:
                taken_positions.add(je.posicion_cancha or "")
            if slot not in taken_positions or req.posicion_cancha is None:
                slot_idx = i
                break

    if slot_idx is None:
        # Assign to first available slot matching the role
        for i, slot in enumerate(formation_slots):
            slot_role = POS_TO_ROLE.get(slot, "")
            taken_positions = set()
            for je, _ in existing_picks:
                taken_positions.add(je.posicion_cancha or "")
            if slot not in taken_positions and slot_role == assigned_role:
                slot_idx = i
                break

    if slot_idx is None:
        slot_idx = current_picks

    pick = JugadorEquipoFecha(
        id_equipo=team.id_equipo,
        id_jugador=req.id_jugador,
        posicion_cancha=req.posicion_cancha or formation_slots[slot_idx] if slot_idx < len(formation_slots) else None,
        orden=slot_idx,
        precio_compra=jugador.valor_inicial,
    )
    db.add(pick)
    team.presupuesto_restante -= jugador.valor_inicial
    db.commit()

    return _load_team_response(db, team)


@router.delete("/team/{group_id}/player/{id_jugador}")
def drop_player(
    group_id: int,
    id_jugador: int,
    fecha: str = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    team = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == current_user.id_usuario,
        EquipoFecha.id_grupo == group_id,
        EquipoFecha.fecha == fecha
    ).first()
    if not team:
        raise HTTPException(status_code=404, detail="No encontraste equipo para esta fecha")

    pick = db.query(JugadorEquipoFecha).join(
        Jugador, Jugador.id_jugador == JugadorEquipoFecha.id_jugador
    ).filter(
        JugadorEquipoFecha.id_equipo == team.id_equipo,
        JugadorEquipoFecha.id_jugador == id_jugador
    ).first()

    if not pick:
        raise HTTPException(status_code=404, detail="Ese jugador no está en tu equipo")

    jugador_valor = pick.precio_compra or pick.jugador.valor_inicial

    db.delete(pick)
    team.presupuesto_restante += jugador_valor
    db.commit()

    return _load_team_response(db, team)


@router.get("/group/{group_id}/teams", response_model=List[EquipoFechaResponse])
def get_group_teams(
    group_id: int,
    fecha: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    if not fecha:
        from ..models import Partido
        now = __import__("datetime").datetime.utcnow()
        current = db.query(Partido.fase).filter(
            Partido.fecha <= now
        ).order_by(Partido.fecha.desc()).first()
        if current:
            fecha = current[0]
        else:
            upcoming = db.query(Partido.fase).order_by(Partido.fecha.asc()).first()
            if not upcoming:
                raise HTTPException(status_code=400, detail="No hay fechas disponibles")
            fecha = upcoming[0]

    teams = db.query(EquipoFecha).filter(
        EquipoFecha.id_grupo == group_id,
        EquipoFecha.fecha == fecha
    ).order_by(EquipoFecha.puntos_totales.desc()).all()

    return [_load_team_response(db, t) for t in teams]


@router.get("/group/{group_id}/ranking", response_model=List[FantasyRankingEntry])
def get_fantasy_ranking(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _verify_membership(db, group_id, current_user.id_usuario)

    results = db.query(
        EquipoFecha.id_usuario,
        Usuario.nombre,
        func.sum(EquipoFecha.puntos_totales).label("total_pts")
    ).join(
        Usuario, Usuario.id_usuario == EquipoFecha.id_usuario
    ).filter(
        EquipoFecha.id_grupo == group_id
    ).group_by(
        EquipoFecha.id_usuario, Usuario.nombre
    ).order_by(
        desc("total_pts")
    ).all()

    return [
        FantasyRankingEntry(id_usuario=uid, nombre=name, puntos_totales=pts or 0)
        for uid, name, pts in results
    ]
