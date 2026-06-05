import string
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..database import get_db
from ..models import Grupo, GrupoUsuario, Usuario, PrediccionCampeon
from ..auth import get_current_user
from ..schemas import GrupoCreate, GrupoResponse, GrupoDetalleResponse, GrupoUsuarioResponse
from ..utils import recalcular_puntos_grupo

router = APIRouter(prefix="/groups", tags=["groups"])

# Helper to generate unique invite code
def generate_invite_code(db: Session) -> str:
    while True:
        chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        code = f"MUNDIAL-{chars}"
        # Verify unique
        exists = db.query(Grupo).filter(Grupo.codigo_invitacion == code).first()
        if not exists:
            return code


class MyGroupResponse(BaseModel):
    id_grupo: int
    nombre_grupo: str
    codigo_invitacion: str
    creado_por: int
    rol: str
    puntos_totales: int
    cantidad_exactos: int
    mejor_racha: int
    posicion_ranking: int


@router.post("", response_model=GrupoResponse, status_code=status.HTTP_201_CREATED)
def create_group(group_in: GrupoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    code = generate_invite_code(db)
    
    # Create group
    db_group = Grupo(
        nombre_grupo=group_in.nombre_grupo,
        codigo_invitacion=code,
        creado_por=current_user.id_usuario
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    
    # Add creator as admin member
    db_member = GrupoUsuario(
        id_grupo=db_group.id_grupo,
        id_usuario=current_user.id_usuario,
        rol="admin"
    )
    db.add(db_member)
    db.commit()
    
    return db_group


@router.get("/my", response_model=List[MyGroupResponse])
def get_my_groups(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    user_memberships = db.query(GrupoUsuario).filter(GrupoUsuario.id_usuario == current_user.id_usuario).all()
    
    response = []
    for membership in user_memberships:
        group = membership.grupo
        
        # Calculate ranking position
        all_members = db.query(GrupoUsuario).filter(
            GrupoUsuario.id_grupo == group.id_grupo
        ).order_by(
            GrupoUsuario.puntos_totales.desc(),
            GrupoUsuario.cantidad_exactos.desc(),
            GrupoUsuario.id.asc()
        ).all()
        
        posicion = 1
        for idx, m in enumerate(all_members):
            if m.id_usuario == current_user.id_usuario:
                posicion = idx + 1
                break
                
        response.append(MyGroupResponse(
            id_grupo=group.id_grupo,
            nombre_grupo=group.nombre_grupo,
            codigo_invitacion=group.codigo_invitacion,
            creado_por=group.creado_por,
            rol=membership.rol,
            puntos_totales=membership.puntos_totales,
            cantidad_exactos=membership.cantidad_exactos,
            mejor_racha=membership.mejor_racha,
            posicion_ranking=posicion
        ))
        
    return response


@router.get("/{group_id}", response_model=GrupoDetalleResponse)
def get_group_details(group_id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    # Check if group exists
    group = db.query(Grupo).filter(Grupo.id_grupo == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    # Check if current user is member
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id,
        GrupoUsuario.id_usuario == current_user.id_usuario
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
        
    # Get all members with their names
    members_query = db.query(GrupoUsuario, Usuario.nombre).join(
        Usuario, GrupoUsuario.id_usuario == Usuario.id_usuario
    ).filter(
        GrupoUsuario.id_grupo == group_id
    ).all()
    
    miembros_list = []
    for gu, name in members_query:
        miembros_list.append(GrupoUsuarioResponse(
            id_usuario=gu.id_usuario,
            nombre=name,
            rol=gu.rol,
            puntos_totales=gu.puntos_totales,
            cantidad_exactos=gu.cantidad_exactos,
            mejor_racha=gu.mejor_racha,
            fecha_union=gu.fecha_union
        ))
        
    return GrupoDetalleResponse(
        id_grupo=group.id_grupo,
        nombre_grupo=group.nombre_grupo,
        codigo_invitacion=group.codigo_invitacion,
        creado_por=group.creado_por,
        fecha_creacion=group.fecha_creacion,
        miembros=miembros_list,
        es_creador=(group.creado_por == current_user.id_usuario)
    )


@router.post("/join/{code}", response_model=GrupoResponse)
def join_group(code: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    # Find group
    group = db.query(Grupo).filter(Grupo.codigo_invitacion == code).first()
    if not group:
        raise HTTPException(status_code=404, detail="El código de invitación no existe")
        
    # Check if already joined
    exists = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group.id_grupo,
        GrupoUsuario.id_usuario == current_user.id_usuario
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Ya perteneces a este grupo")
        
    # Add member
    db_member = GrupoUsuario(
        id_grupo=group.id_grupo,
        id_usuario=current_user.id_usuario,
        rol="member"
    )
    db.add(db_member)
    db.commit()
    db.refresh(group)
    
    return group


@router.get("/{group_id}/settings", response_model=GrupoDetalleResponse)
def get_group_settings(group_id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return get_group_details(group_id, db, current_user)


@router.put("/{group_id}", response_model=GrupoResponse)
def update_group(group_id: int, group_in: GrupoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    group = db.query(Grupo).filter(Grupo.id_grupo == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    # Only creator can update
    if group.creado_por != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="Solo el creador del grupo puede editarlo")
        
    group.nombre_grupo = group_in.nombre_grupo
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_200_OK)
def delete_group(group_id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    group = db.query(Grupo).filter(Grupo.id_grupo == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    # Check if current user is an admin of this group
    membership = db.query(GrupoUsuario).filter(
        GrupoUsuario.id_grupo == group_id,
        GrupoUsuario.id_usuario == current_user.id_usuario
    ).first()
    if not membership or membership.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores del grupo pueden eliminarlo")
        
    db.delete(group)
    db.commit()
    return {"detail": "Grupo eliminado exitosamente"}


class SetChampionRequest(BaseModel):
    equipo_campeon: str


@router.post("/{group_id}/set-champion")
def set_group_champion(
    group_id: int,
    req: SetChampionRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    group = db.query(Grupo).filter(Grupo.id_grupo == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    # Only creator can set champion
    if group.creado_por != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="Solo el creador del grupo puede decidir el campeón")
        
    # Update points for PrediccionCampeon in this group
    predicciones = db.query(PrediccionCampeon).filter(PrediccionCampeon.id_grupo == group_id).all()
    for pred in predicciones:
        if pred.equipo_campeon.strip().lower() == req.equipo_campeon.strip().lower():
            pred.puntos_obtenidos = 50
        else:
            pred.puntos_obtenidos = 0
            
    db.commit()
    
    # Recalculate group rankings
    recalcular_puntos_grupo(db, group_id)
    
    return {"detail": f"Campeón '{req.equipo_campeon}' definido para el grupo y puntos recalculados."}

