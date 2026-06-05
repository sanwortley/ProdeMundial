import threading
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import Prediccion, Partido, GrupoUsuario, PrediccionCampeon, Usuario
from ..auth import get_current_user
from ..schemas import PrediccionCreate, PrediccionResponse, PrediccionCampeonCreate, PrediccionCampeonResponse

router = APIRouter(prefix="/predictions", tags=["predictions"])

# Per-user-per-group lock to prevent race conditions on joker/doble unique checks
_prediction_locks: dict[tuple[int, int], threading.Lock] = {}
_prediction_locks_guard = threading.Lock()

def _get_prediction_lock(user_id: int, group_id: int) -> threading.Lock:
    with _prediction_locks_guard:
        key = (user_id, group_id)
        if key not in _prediction_locks:
            _prediction_locks[key] = threading.Lock()
        return _prediction_locks[key]

@router.post("", response_model=PrediccionResponse)
def upsert_prediction(
    pred_in: PrediccionCreate, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(get_current_user)
):
    # Check if match exists
    partido = db.query(Partido).filter(Partido.id_partido == pred_in.id_partido).first()
    if not partido:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
        
    # Validation: cannot predict if match has already started
    if datetime.utcnow() >= partido.fecha:
        raise HTTPException(
            status_code=400, 
            detail="El partido ya ha comenzado. No se pueden cargar o modificar predicciones."
        )
        
    # Check if user is in group
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == pred_in.id_grupo,
        GrupoUsuario.id_usuario == current_user.id_usuario
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
        
    # Serialize joker/doble checks to prevent race conditions
    lock = _get_prediction_lock(current_user.id_usuario, pred_in.id_grupo)
    with lock:
        # Re-check membership inside the lock to ensure consistency
        membership = db.query(GrupoUsuario).filter(
            GrupoUsuario.id_grupo == pred_in.id_grupo,
            GrupoUsuario.id_usuario == current_user.id_usuario
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="No perteneces a este grupo")

        # Check unique constraints for Joker: Only 1 joker per group for the entire tournament
        if pred_in.usa_joker:
            existing_joker = db.query(Prediccion).filter(
                Prediccion.id_grupo == pred_in.id_grupo,
                Prediccion.id_usuario == current_user.id_usuario,
                Prediccion.usa_joker == True,
                Prediccion.id_partido != pred_in.id_partido
            ).first()
            if existing_joker:
                raise HTTPException(
                    status_code=400, 
                    detail="Ya has utilizado el Joker único del torneo en otro partido de este grupo."
                )
                
        # Check unique constraints for Double Match: Only 1 double match per group per stage/fase
        if pred_in.usa_doble:
            # Get all matches in the same fase
            fase_matches = db.query(Partido.id_partido).filter(Partido.fase == partido.fase).all()
            fase_match_ids = [m[0] for m in fase_matches]
            
            existing_doble = db.query(Prediccion).filter(
                Prediccion.id_grupo == pred_in.id_grupo,
                Prediccion.id_usuario == current_user.id_usuario,
                Prediccion.usa_doble == True,
                Prediccion.id_partido.in_(fase_match_ids),
                Prediccion.id_partido != pred_in.id_partido
            ).first()
            if existing_doble:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Ya has utilizado el Partido Doble para la fase '{partido.fase}' en este grupo."
                )
                
        # Find existing prediction
        db_pred = db.query(Prediccion).filter(
            Prediccion.id_grupo == pred_in.id_grupo,
            Prediccion.id_usuario == current_user.id_usuario,
            Prediccion.id_partido == pred_in.id_partido
        ).first()
        
        if db_pred:
            db_pred.goles_local_predicho = pred_in.goles_local_predicho
            db_pred.goles_visitante_predicho = pred_in.goles_visitante_predicho
            db_pred.usa_joker = pred_in.usa_joker
            db_pred.usa_doble = pred_in.usa_doble
            db_pred.fecha_carga = datetime.utcnow()
        else:
            db_pred = Prediccion(
                id_usuario=current_user.id_usuario,
                id_grupo=pred_in.id_grupo,
                id_partido=pred_in.id_partido,
                goles_local_predicho=pred_in.goles_local_predicho,
                goles_visitante_predicho=pred_in.goles_visitante_predicho,
                usa_joker=pred_in.usa_joker,
                usa_doble=pred_in.usa_doble
            )
            db.add(db_pred)
            
        db.commit()
        db.refresh(db_pred)
    
    return db_pred


@router.get("/group/{group_id}", response_model=List[PrediccionResponse])
def get_user_predictions_in_group(
    group_id: int, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(get_current_user)
):
    # Verify membership
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id,
        GrupoUsuario.id_usuario == current_user.id_usuario
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
        
    preds = db.query(Prediccion).filter(
        Prediccion.id_grupo == group_id,
        Prediccion.id_usuario == current_user.id_usuario
    ).all()
    return preds


@router.get("/group/{group_id}/match/{match_id}", response_model=Optional[PrediccionResponse])
def get_prediction_for_match(
    group_id: int,
    match_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    pred = db.query(Prediccion).filter(
        Prediccion.id_grupo == group_id,
        Prediccion.id_usuario == current_user.id_usuario,
        Prediccion.id_partido == match_id
    ).first()
    return pred


# --- Champion Predictions ---

@router.post("/champion", response_model=PrediccionCampeonResponse)
def upsert_champion_prediction(
    pred_in: PrediccionCampeonCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Check if user is in group
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == pred_in.id_grupo,
        GrupoUsuario.id_usuario == current_user.id_usuario
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
        
    # Check if the last match of Fecha 3 has already started
    last_group_match = db.query(Partido).filter(Partido.fase == "Fecha 3").order_by(Partido.fecha.desc()).first()
    if last_group_match and datetime.utcnow() >= last_group_match.fecha:
        raise HTTPException(
            status_code=400,
            detail="El último partido de la Fecha 3 ya ha comenzado. No se pueden crear o modificar predicciones de campeón."
        )
        
    db_pred = db.query(PrediccionCampeon).filter(
        PrediccionCampeon.id_grupo == pred_in.id_grupo,
        PrediccionCampeon.id_usuario == current_user.id_usuario
    ).first()
    
    if db_pred:
        db_pred.equipo_campeon = pred_in.equipo_campeon
    else:
        db_pred = PrediccionCampeon(
            id_usuario=current_user.id_usuario,
            id_grupo=pred_in.id_grupo,
            equipo_campeon=pred_in.equipo_campeon
        )
        db.add(db_pred)
        
    db.commit()
    db.refresh(db_pred)
    return db_pred


@router.get("/group/{group_id}/champion", response_model=Optional[PrediccionCampeonResponse])
def get_champion_prediction(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    pred = db.query(PrediccionCampeon).filter(
        PrediccionCampeon.id_grupo == group_id,
        PrediccionCampeon.id_usuario == current_user.id_usuario
    ).first()
    return pred
