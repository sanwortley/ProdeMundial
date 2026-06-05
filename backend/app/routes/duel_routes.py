from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from ..database import get_db
from ..models import (
    Duelo, RondaDuelo, GrupoUsuario, EquipoFecha,
    JugadorEquipoFecha, Jugador, Usuario
)
from ..auth import get_current_user

router = APIRouter(prefix="/fantasy/duel", tags=["fantasy_duel"])


# --- Schemas ---

class UsuarioDisponibleResponse(BaseModel):
    id_usuario: int
    nombre: str

    class Config:
        from_attributes = True


class RondaResponse(BaseModel):
    id_ronda: int
    numero: int
    atacante_id: int
    posicion_atacante: Optional[int] = None
    posicion_arquero: Optional[int] = None
    es_gol: Optional[bool] = None
    pateador_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class DueloResponse(BaseModel):
    id_duelo: int
    id_retador: int
    retador_nombre: str
    id_rival: int
    rival_nombre: str
    id_grupo: Optional[int] = None
    estado: str
    ronda_actual: int
    goles_retador: int
    goles_rival: int
    ganador_id: Optional[int] = None
    turno_atacante_id: Optional[int] = None
    rondas: List[RondaResponse] = []

    class Config:
        from_attributes = True


class DueloListResponse(BaseModel):
    id_duelo: int
    id_retador: int
    retador_nombre: str
    id_rival: int
    rival_nombre: str
    estado: str
    goles_retador: int
    goles_rival: int
    ganador_id: Optional[int] = None

    class Config:
        from_attributes = True


# --- Helpers ---

def _get_user_team_count(db: Session, user_id: int, grupo_id: int) -> int:
    ef = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == user_id,
        EquipoFecha.id_grupo == grupo_id,
    ).first()
    if not ef:
        return 0
    return db.query(JugadorEquipoFecha).filter(
        JugadorEquipoFecha.id_equipo == ef.id_equipo
    ).count()


# --- Endpoints ---

@router.get("/disponibles", response_model=List[UsuarioDisponibleResponse])
def duelos_disponibles(
    grupo_id: int = Query(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    miembros = db.query(GrupoUsuario).filter(GrupoUsuario.id_grupo == grupo_id).all()
    disponibles = []
    for m in miembros:
        if m.id_usuario == user.id_usuario:
            continue
        if _get_user_team_count(db, m.id_usuario, grupo_id) < 11:
            continue
        tiene_duelo_activo = db.query(Duelo).filter(
            Duelo.estado.in_(["pending", "playing"]),
            (
                (Duelo.id_retador == m.id_usuario) |
                (Duelo.id_rival == m.id_usuario)
            ),
        ).first()
        if tiene_duelo_activo:
            continue
        u = db.query(Usuario).filter(Usuario.id_usuario == m.id_usuario).first()
        if u:
            disponibles.append(u)
    return disponibles


@router.post("/challenge/{rival_id}", response_model=DueloResponse)
def crear_duelo(
    rival_id: int,
    grupo_id: int = Query(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    if user.id_usuario == rival_id:
        raise HTTPException(400, "No podés retarte a vos mismo")
    rival = db.query(Usuario).filter(Usuario.id_usuario == rival_id).first()
    if not rival:
        raise HTTPException(404, "Usuario no encontrado")
    if _get_user_team_count(db, user.id_usuario, grupo_id) < 11:
        raise HTTPException(400, "Necesitás 11 jugadores en tu equipo")
    if _get_user_team_count(db, rival_id, grupo_id) < 11:
        raise HTTPException(400, "El rival no tiene 11 jugadores todavía")
    duelo_activo = db.query(Duelo).filter(
        Duelo.estado.in_(["pending", "playing"]),
        (
            (Duelo.id_retador == user.id_usuario) |
            (Duelo.id_rival == user.id_usuario) |
            (Duelo.id_retador == rival_id) |
            (Duelo.id_rival == rival_id)
        ),
    ).first()
    if duelo_activo:
        raise HTTPException(400, "Uno de los dos ya tiene un duelo activo")
    duelo = Duelo(
        id_retador=user.id_usuario,
        id_rival=rival_id,
        id_grupo=grupo_id,
        estado="pending",
        ronda_actual=1,
    )
    db.add(duelo)
    db.commit()
    db.refresh(duelo)
    return _duelo_to_response(duelo, db)


@router.get("/mis-duelos", response_model=List[DueloListResponse])
def mis_duelos(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    duelos = db.query(Duelo).filter(
        (Duelo.id_retador == user.id_usuario) |
        (Duelo.id_rival == user.id_usuario)
    ).order_by(Duelo.created_at.desc()).limit(20).all()
    result = []
    for d in duelos:
        ret = db.query(Usuario).filter(Usuario.id_usuario == d.id_retador).first()
        riv = db.query(Usuario).filter(Usuario.id_usuario == d.id_rival).first()
        result.append(DueloListResponse(
            id_duelo=d.id_duelo,
            id_retador=d.id_retador,
            retador_nombre=ret.nombre if ret else "?",
            id_rival=d.id_rival,
            rival_nombre=riv.nombre if riv else "?",
            estado=d.estado,
            goles_retador=d.goles_retador,
            goles_rival=d.goles_rival,
            ganador_id=d.ganador_id,
        ))
    return result


@router.post("/{duelo_id}/accept", response_model=DueloResponse)
def aceptar_duelo(
    duelo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    duelo = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
    if not duelo:
        raise HTTPException(404, "Duelo no encontrado")
    if duelo.id_rival != user.id_usuario:
        raise HTTPException(403, "No sos el rival de este duelo")
    if duelo.estado != "pending":
        raise HTTPException(400, "El duelo ya fue aceptado o cancelado")
    duelo.estado = "playing"
    db.commit()
    db.refresh(duelo)
    return _duelo_to_response(duelo, db)


@router.post("/{duelo_id}/reject", response_model=DueloResponse)
def rechazar_duelo(
    duelo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    duelo = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
    if not duelo:
        raise HTTPException(404, "Duelo no encontrado")
    if duelo.id_rival != user.id_usuario:
        raise HTTPException(403, "No sos el rival de este duelo")
    if duelo.estado != "pending":
        raise HTTPException(400, "El duelo ya fue procesado")
    duelo.estado = "cancelled"
    db.commit()
    db.refresh(duelo)
    return _duelo_to_response(duelo, db)


@router.post("/{duelo_id}/cancel", response_model=DueloResponse)
def cancelar_duelo(
    duelo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    duelo = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
    if not duelo:
        raise HTTPException(404, "Duelo no encontrado")
    if user.id_usuario not in (duelo.id_retador, duelo.id_rival):
        raise HTTPException(403, "No participás en este duelo")
    if duelo.estado in ("finished", "cancelled"):
        raise HTTPException(400, "El duelo ya terminó o fue cancelado")
    duelo.estado = "cancelled"
    db.commit()
    db.refresh(duelo)
    return _duelo_to_response(duelo, db)


@router.get("/{duelo_id}", response_model=DueloResponse)
def obtener_duelo(
    duelo_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    duelo = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
    if not duelo:
        raise HTTPException(404, "Duelo no encontrado")
    if user.id_usuario not in (duelo.id_retador, duelo.id_rival):
        raise HTTPException(403, "No participás en este duelo")
    return _duelo_to_response(duelo, db)


def _duelo_to_response(duelo: Duelo, db: Session) -> DueloResponse:
    ret = db.query(Usuario).filter(Usuario.id_usuario == duelo.id_retador).first()
    riv = db.query(Usuario).filter(Usuario.id_usuario == duelo.id_rival).first()
    rondas = db.query(RondaDuelo).filter(
        RondaDuelo.id_duelo == duelo.id_duelo
    ).order_by(RondaDuelo.numero).all()
    return DueloResponse(
        id_duelo=duelo.id_duelo,
        id_retador=duelo.id_retador,
        retador_nombre=ret.nombre if ret else "?",
        id_rival=duelo.id_rival,
        rival_nombre=riv.nombre if riv else "?",
        id_grupo=duelo.id_grupo,
        estado=duelo.estado,
        ronda_actual=duelo.ronda_actual,
        goles_retador=duelo.goles_retador,
        goles_rival=duelo.goles_rival,
        ganador_id=duelo.ganador_id,
        turno_atacante_id=duelo.turno_atacante_id,
        rondas=[RondaResponse(
            id_ronda=r.id_ronda,
            numero=r.numero,
            atacante_id=r.atacante_id,
            posicion_atacante=r.posicion_atacante,
            posicion_arquero=r.posicion_arquero,
            es_gol=r.es_gol,
            pateador_nombre=r.pateador_nombre,
        ) for r in rondas],
    )
