from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import cast, Date
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict
from ..database import get_db
from ..models import Partido, Prediccion, Usuario
from ..auth import get_current_user
from ..schemas import PartidoCreate, PartidoResponse, PartidoResultUpdate
from ..limiter import limiter
from ..utils import recalcular_puntos_grupo

router = APIRouter(prefix="/matches", tags=["matches"])

@router.get("", response_model=List[PartidoResponse])
def get_matches(
    fase: Optional[str] = None,
    fecha: Optional[str] = None, # Expects format YYYY-MM-DD
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    query = db.query(Partido)
    if fase:
        query = query.filter(Partido.fase == fase)
    if fecha:
        try:
            # Filter by date only, ignoring time
            from datetime import datetime
            dt = datetime.strptime(fecha, "%Y-%m-%d").date()
            query = query.filter(cast(Partido.fecha, Date) == dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD.")
            
    return query.order_by(Partido.fecha.asc()).all()


@router.get("/grouped", response_model=Dict[str, List[PartidoResponse]])
def get_matches_grouped(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    partidos = db.query(Partido).order_by(Partido.fecha.asc()).all()
    grouped = {}
    for p in partidos:
        if p.fase not in grouped:
            grouped[p.fase] = []
        grouped[p.fase].append(p)
    return grouped


@router.post("", response_model=PartidoResponse, status_code=status.HTTP_201_CREATED)
def create_match(partido_in: PartidoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear partidos.")
    db_partido = Partido(
        fecha=partido_in.fecha,
        fase=partido_in.fase,
        equipo_local=partido_in.equipo_local,
        equipo_visitante=partido_in.equipo_visitante,
        finalizado=False
    )
    db.add(db_partido)
    db.commit()
    db.refresh(db_partido)
    return db_partido


def check_and_advance_knockouts(db: Session, match_id: int, equipo_local: str, equipo_visitante: str, goles_local: int, goles_visitante: int):
    # Determine winner (simple local/visitante comparison)
    if goles_local > goles_visitante:
        winner = equipo_local
    elif goles_visitante > goles_local:
        winner = equipo_visitante
    else:
        winner = equipo_local  # Default fallback if draw (e.g. local advances)
        
    placeholder = f"Ganador Partido {match_id}"
    
    # Update any upcoming matches where this winner is expected as local
    next_locals = db.query(Partido).filter(Partido.equipo_local == placeholder).all()
    for m in next_locals:
        m.equipo_local = winner
        
    # Update any upcoming matches where this winner is expected as visitante
    next_visitantes = db.query(Partido).filter(Partido.equipo_visitante == placeholder).all()
    for m in next_visitantes:
        m.equipo_visitante = winner
        
    db.commit()


@router.put("/{match_id}/result", response_model=PartidoResponse)
def update_match_result(
    match_id: int, 
    result_in: PartidoResultUpdate, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar resultados.")
    partido = db.query(Partido).filter(Partido.id_partido == match_id).first()
    if not partido:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
        
    partido.goles_local = result_in.goles_local
    partido.goles_visitante = result_in.goles_visitante
    partido.finalizado = result_in.finalizado
    
    db.commit()
    db.refresh(partido)
    
    # Check if this is a knockout match that should advance teams
    if partido.finalizado:
        check_and_advance_knockouts(
            db, 
            partido.id_partido, 
            partido.equipo_local, 
            partido.equipo_visitante, 
            partido.goles_local, 
            partido.goles_visitante
        )
    
    # Recalculate points for all groups that have predictions for this match
    groups = db.query(Prediccion.id_grupo).filter(Prediccion.id_partido == match_id).distinct().all()
    for (g_id,) in groups:
        recalcular_puntos_grupo(db, g_id)
        
    return partido


class MatchResultEntry(BaseModel):
    id_partido: int
    goles_local: int
    goles_visitante: int
    finalizado: bool = True


class BulkResultsRequest(BaseModel):
    resultados: List[MatchResultEntry]


@router.post("/bulk-results")
def update_bulk_match_results(
    req: BulkResultsRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar resultados.")
    affected_match_ids = []
    for res in req.resultados:
        partido = db.query(Partido).filter(Partido.id_partido == res.id_partido).first()
        if partido:
            partido.goles_local = res.goles_local
            partido.goles_visitante = res.goles_visitante
            partido.finalizado = res.finalizado
            affected_match_ids.append(res.id_partido)
            if partido.finalizado:
                check_and_advance_knockouts(
                    db,
                    partido.id_partido,
                    partido.equipo_local,
                    partido.equipo_visitante,
                    partido.goles_local,
                    partido.goles_visitante
                )
            
    db.commit()
    
    # Find all groups affected by these predictions
    if affected_match_ids:
        groups = db.query(Prediccion.id_grupo).filter(
            Prediccion.id_partido.in_(affected_match_ids)
        ).distinct().all()
        
        for (g_id,) in groups:
            recalcular_puntos_grupo(db, g_id)
            
    return {"detail": f"Se actualizaron {len(affected_match_ids)} partidos y se recalcularon los puntos del prode."}


@router.post("/auto-sync")
@limiter.limit("10/minute")
async def auto_sync_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    from ..sync_service import auto_sync_matches

    result = auto_sync_matches(db)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return {
        "detail": f"Sincronizados {result['updated']} partidos en {result['groups']} grupos.",
        "updated": result["updated"],
        "groups": result["groups"],
    }

