from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    id_usuario: Optional[int] = None

# --- User Schemas ---
class UsuarioBase(BaseModel):
    nombre: str
    email: EmailStr

class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=6)

class UsuarioResponse(UsuarioBase):
    id_usuario: int
    fecha_registro: datetime

    class Config:
        from_attributes = True

# --- Group Member Schemas ---
class GrupoUsuarioResponse(BaseModel):
    id_usuario: int
    nombre: str
    rol: str
    puntos_totales: int
    cantidad_exactos: int
    mejor_racha: int
    fecha_union: datetime

    class Config:
        from_attributes = True

# --- Group Schemas ---
class GrupoBase(BaseModel):
    nombre_grupo: str

class GrupoCreate(GrupoBase):
    pass

class GrupoResponse(GrupoBase):
    id_grupo: int
    codigo_invitacion: str
    creado_por: int
    fecha_creacion: datetime

    class Config:
        from_attributes = True

class GrupoDetalleResponse(GrupoResponse):
    miembros: List[GrupoUsuarioResponse]
    es_creador: bool

# --- Match Schemas ---
class PartidoBase(BaseModel):
    fecha: datetime
    fase: str
    equipo_local: str
    equipo_visitante: str

class PartidoCreate(PartidoBase):
    pass

class PartidoResponse(PartidoBase):
    id_partido: int
    goles_local: Optional[int] = None
    goles_visitante: Optional[int] = None
    finalizado: bool

    class Config:
        from_attributes = True

class PartidoResultUpdate(BaseModel):
    goles_local: int
    goles_visitante: int
    finalizado: bool = True

# --- Prediction Schemas ---
class PrediccionCreate(BaseModel):
    id_grupo: int
    id_partido: int
    goles_local_predicho: int = Field(..., ge=0)
    goles_visitante_predicho: int = Field(..., ge=0)
    usa_joker: bool = False
    usa_doble: bool = False

class PrediccionResponse(BaseModel):
    id_prediccion: int
    id_usuario: int
    id_grupo: int
    id_partido: int
    goles_local_predicho: int
    goles_visitante_predicho: int
    puntos_obtenidos: int
    usa_joker: bool
    usa_doble: bool
    fecha_carga: datetime

    class Config:
        from_attributes = True

class PrediccionCampeonCreate(BaseModel):
    id_grupo: int
    equipo_campeon: str

class PrediccionCampeonResponse(BaseModel):
    id: int
    id_usuario: int
    id_grupo: int
    equipo_campeon: str
    puntos_obtenidos: int

    class Config:
        from_attributes = True

# --- Ranking Schemas ---
class RankingEntry(BaseModel):
    posicion: int
    id_usuario: int
    nombre: str
    puntos_totales: int
    cantidad_exactos: int
    mejor_racha: int

class GrupoRanking(BaseModel):
    id_grupo: int
    nombre_grupo: str
    ranking: List[RankingEntry]
