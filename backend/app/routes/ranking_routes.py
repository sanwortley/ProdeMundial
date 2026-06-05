from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Grupo, GrupoUsuario, Usuario
from ..auth import get_current_user
from ..schemas import GrupoRanking, RankingEntry

router = APIRouter(prefix="/ranking", tags=["ranking"])

@router.get("/{group_id}", response_model=GrupoRanking)
def get_group_ranking(
    group_id: int, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(get_current_user)
):
    # Check if group exists
    group = db.query(Grupo).filter(Grupo.id_grupo == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    # Check if current user belongs to the group
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id,
        GrupoUsuario.id_usuario == current_user.id_usuario
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
        
    # Fetch all members of the group ordered by points
    members_query = db.query(GrupoUsuario, Usuario.nombre).join(
        Usuario, GrupoUsuario.id_usuario == Usuario.id_usuario
    ).filter(
        GrupoUsuario.id_grupo == group_id
    ).order_by(
        GrupoUsuario.puntos_totales.desc(),
        GrupoUsuario.cantidad_exactos.desc(),
        GrupoUsuario.mejor_racha.desc(),
        GrupoUsuario.id.asc()
    ).all()
    
    ranking_entries = []
    for idx, (gu, name) in enumerate(members_query):
        ranking_entries.append(RankingEntry(
            posicion=idx + 1,
            id_usuario=gu.id_usuario,
            nombre=name,
            puntos_totales=gu.puntos_totales,
            cantidad_exactos=gu.cantidad_exactos,
            mejor_racha=gu.mejor_racha
        ))
        
    return GrupoRanking(
        id_grupo=group.id_grupo,
        nombre_grupo=group.nombre_grupo,
        ranking=ranking_entries
    )
