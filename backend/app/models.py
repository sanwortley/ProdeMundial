import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    session_token = Column(String, nullable=True)
    secret_phrase_hash = Column(String, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    grupos_unidos = relationship("GrupoUsuario", back_populates="usuario", cascade="all, delete-orphan")
    predicciones = relationship("Prediccion", back_populates="usuario", cascade="all, delete-orphan")
    predicciones_campeon = relationship("PrediccionCampeon", back_populates="usuario", cascade="all, delete-orphan")


class Grupo(Base):
    __tablename__ = "grupos"

    id_grupo = Column(Integer, primary_key=True, index=True)
    nombre_grupo = Column(String, nullable=False)
    codigo_invitacion = Column(String, unique=True, index=True, nullable=False)
    creado_por = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    creador = relationship("Usuario", foreign_keys=[creado_por])
    miembros = relationship("GrupoUsuario", back_populates="grupo", cascade="all, delete-orphan")
    predicciones = relationship("Prediccion", back_populates="grupo", cascade="all, delete-orphan")
    predicciones_campeon = relationship("PrediccionCampeon", back_populates="grupo", cascade="all, delete-orphan")


class GrupoUsuario(Base):
    __tablename__ = "grupo_usuarios"

    id = Column(Integer, primary_key=True, index=True)
    id_grupo = Column(Integer, ForeignKey("grupos.id_grupo", ondelete="CASCADE"), nullable=False)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    rol = Column(String, default="member")  # 'admin' for creator, 'member' for others
    puntos_totales = Column(Integer, default=0)
    cantidad_exactos = Column(Integer, default=0)
    mejor_racha = Column(Integer, default=0)
    fecha_union = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    usuario = relationship("Usuario", back_populates="grupos_unidos")
    grupo = relationship("Grupo", back_populates="miembros")

    __table_args__ = (
        UniqueConstraint("id_grupo", "id_usuario", name="uq_grupo_usuario"),
    )


class Partido(Base):
    __tablename__ = "partidos"

    id_partido = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, nullable=False)
    fase = Column(String, nullable=False)  # e.g., 'Fecha 1', 'Fecha 2', 'Octavos de Final'
    equipo_local = Column(String, nullable=False)
    equipo_visitante = Column(String, nullable=False)
    goles_local = Column(Integer, nullable=True)
    goles_visitante = Column(Integer, nullable=True)
    finalizado = Column(Boolean, default=False)

    # Relationships
    predicciones = relationship("Prediccion", back_populates="partido", cascade="all, delete-orphan")


class Prediccion(Base):
    __tablename__ = "predicciones"

    id_prediccion = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    id_grupo = Column(Integer, ForeignKey("grupos.id_grupo", ondelete="CASCADE"), nullable=False)
    id_partido = Column(Integer, ForeignKey("partidos.id_partido", ondelete="CASCADE"), nullable=False)
    goles_local_predicho = Column(Integer, nullable=False)
    goles_visitante_predicho = Column(Integer, nullable=False)
    puntos_obtenidos = Column(Integer, default=0)
    usa_joker = Column(Boolean, default=False)
    usa_doble = Column(Boolean, default=False)
    fecha_carga = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    usuario = relationship("Usuario", back_populates="predicciones")
    grupo = relationship("Grupo", back_populates="predicciones")
    partido = relationship("Partido", back_populates="predicciones")

    __table_args__ = (
        UniqueConstraint("id_usuario", "id_grupo", "id_partido", name="uq_usuario_grupo_partido"),
    )


class PrediccionCampeon(Base):
    __tablename__ = "predicciones_campeon"

    id = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    id_grupo = Column(Integer, ForeignKey("grupos.id_grupo", ondelete="CASCADE"), nullable=False)
    equipo_campeon = Column(String, nullable=False)
    puntos_obtenidos = Column(Integer, default=0)

    # Relationships
    usuario = relationship("Usuario", back_populates="predicciones_campeon")
    grupo = relationship("Grupo", back_populates="predicciones_campeon")

    __table_args__ = (
        UniqueConstraint("id_usuario", "id_grupo", name="uq_usuario_grupo_campeon"),
    )


class Jugador(Base):
    __tablename__ = "jugadores"

    id_jugador = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    posicion = Column(String, nullable=False)  # GK, DEF, MID, FWD
    posicion_especifica = Column(String, nullable=True)  # CB, LB, RB, CM, CDM, CAM, LM, RM, LW, RW, ST
    equipo_nacional = Column(String, nullable=False)
    fecha_nacimiento = Column(DateTime, nullable=True)
    valor_inicial = Column(Integer, nullable=False)  # in millions
    puntos_totales = Column(Integer, default=0)

    # Relationships
    equipos = relationship("JugadorEquipoFecha", back_populates="jugador", cascade="all, delete-orphan")


class EquipoFecha(Base):
    __tablename__ = "equipos_fecha"

    id_equipo = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    id_grupo = Column(Integer, ForeignKey("grupos.id_grupo", ondelete="CASCADE"), nullable=False)
    fecha = Column(String, nullable=False)  # "Fecha 1", "Fecha 2", etc.
    formacion = Column(String, default="4-4-2")
    presupuesto_restante = Column(Integer, default=300)
    puntos_totales = Column(Integer, default=0)

    # Relationships
    usuario = relationship("Usuario")
    grupo = relationship("Grupo")
    jugadores = relationship("JugadorEquipoFecha", back_populates="equipo", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("id_usuario", "id_grupo", "fecha", name="uq_usuario_grupo_fecha"),
    )


class JugadorEquipoFecha(Base):
    __tablename__ = "jugadores_equipo_fecha"

    id = Column(Integer, primary_key=True, index=True)
    id_equipo = Column(Integer, ForeignKey("equipos_fecha.id_equipo", ondelete="CASCADE"), nullable=False)
    id_jugador = Column(Integer, ForeignKey("jugadores.id_jugador", ondelete="CASCADE"), nullable=False)
    posicion_cancha = Column(String, nullable=True)  # "GK","LB","CB","RB","LM","CM","RM","LW","ST","RW"
    orden = Column(Integer, default=0)
    precio_compra = Column(Integer, default=0)  # Price paid when picked (locks value for budget)

    # Relationships
    equipo = relationship("EquipoFecha", back_populates="jugadores")
    jugador = relationship("Jugador", back_populates="equipos")


class PartidoFantasia(Base):
    __tablename__ = "partidos_fantasia"

    id_partido = Column(Integer, primary_key=True, index=True)
    id_grupo = Column(Integer, ForeignKey("grupos.id_grupo", ondelete="CASCADE"), nullable=False)
    fecha = Column(String, nullable=False)
    ronda = Column(Integer, default=1)
    id_local = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    id_visitante = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    puntos_local = Column(Integer, default=0)
    puntos_visitante = Column(Integer, default=0)
    finalizado = Column(Boolean, default=False)

    # Relationships
    grupo = relationship("Grupo")
    local = relationship("Usuario", foreign_keys=[id_local])
    visitante = relationship("Usuario", foreign_keys=[id_visitante])

    __table_args__ = (
        UniqueConstraint("id_grupo", "fecha", "id_local", name="uq_h2h_fecha_local"),
    )


class Duelo(Base):
    __tablename__ = "duelos"

    id_duelo = Column(Integer, primary_key=True, index=True)
    id_retador = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    id_rival = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    id_grupo = Column(Integer, ForeignKey("grupos.id_grupo", ondelete="CASCADE"), nullable=True)
    estado = Column(String(20), default="pending")  # pending / playing / finished / cancelled
    ronda_actual = Column(Integer, default=1)
    goles_retador = Column(Integer, default=0)
    goles_rival = Column(Integer, default=0)
    ganador_id = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True)
    turno_atacante_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    retador = relationship("Usuario", foreign_keys=[id_retador])
    rival = relationship("Usuario", foreign_keys=[id_rival])
    ganador = relationship("Usuario", foreign_keys=[ganador_id])
    grupo = relationship("Grupo")
    rondas = relationship("RondaDuelo", back_populates="duelo", cascade="all, delete-orphan")


class RondaDuelo(Base):
    __tablename__ = "rondas_duelo"

    id_ronda = Column(Integer, primary_key=True, index=True)
    id_duelo = Column(Integer, ForeignKey("duelos.id_duelo", ondelete="CASCADE"), nullable=False)
    numero = Column(Integer, nullable=False)  # 1-5
    atacante_id = Column(Integer, ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False)
    posicion_atacante = Column(Integer, nullable=True)  # 1-5, null = timeout
    posicion_arquero = Column(Integer, nullable=True)   # 1-5, null = timeout
    es_gol = Column(Boolean, default=False)
    pateador_nombre = Column(String, nullable=True)  # player name for anim

    duelo = relationship("Duelo", back_populates="rondas")
    atacante = relationship("Usuario", foreign_keys=[atacante_id])
