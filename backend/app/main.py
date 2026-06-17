import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from .database import engine, Base, SessionLocal
from .limiter import limiter
from .models import Partido, Usuario
from .seed_data import seed_matches
from .seed_players import seed_players
from .routes import auth_routes, group_routes, match_routes, prediction_routes, ranking_routes, fantasy_routes, fantasy_h2h_routes, admin_routes, duel_routes
from .sync_manager import run_full_sync
from .sync_service import sync_all_dates

logger = logging.getLogger(__name__)

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Migrate: add status column to partidos if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE partidos ADD COLUMN status VARCHAR DEFAULT 'SCHEDULED'"))
        conn.commit()
        logger.info("Added status column to partidos table (migration)")
    except Exception:
        pass

# Migrate: add minute column to partidos if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE partidos ADD COLUMN minute INTEGER"))
        conn.commit()
        logger.info("Added minute column to partidos table (migration)")
    except Exception:
        pass

# Migrate: add injury_time column to partidos if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE partidos ADD COLUMN injury_time INTEGER DEFAULT 0"))
        conn.commit()
        logger.info("Added injury_time column to partidos table (migration)")
    except Exception:
        pass

# Migrate existing databases: add is_admin column if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE usuarios ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
        conn.commit()
        logger.info("Added is_admin column to usuarios table (migration)")
    except Exception:
        pass  # Column already exists

# Migrate: add session_token column to usuarios if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE usuarios ADD COLUMN session_token VARCHAR"))
        conn.commit()
        logger.info("Added session_token column to usuarios table (migration)")
    except Exception:
        pass  # Column already exists

# Migrate: add secret_phrase_hash column to usuarios if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE usuarios ADD COLUMN secret_phrase_hash VARCHAR"))
        conn.commit()
        logger.info("Added secret_phrase_hash column to usuarios table (migration)")
    except Exception:
        pass  # Column already exists

# Migrate: add ultimo_acceso column to usuarios if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE usuarios ADD COLUMN ultimo_acceso TIMESTAMP"))
        conn.commit()
        logger.info("Added ultimo_acceso column to usuarios table (migration)")
    except Exception:
        pass  # Column already exists

# Migrate: add posicion_especifica column to jugadores if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE jugadores ADD COLUMN posicion_especifica VARCHAR"))
        conn.commit()
        logger.info("Added posicion_especifica column to jugadores table (migration)")
    except Exception:
        pass  # Column already exists

# Fix: reassign duplicate orden values in jugadores_equipo_fecha
from sqlalchemy import text as sql_text
with engine.connect() as conn:
    try:
        result = conn.execute(sql_text("""
            SELECT id_equipo, MIN(orden) as min_orden, MAX(orden) as max_orden, COUNT(*) as total
            FROM jugadores_equipo_fecha
            GROUP BY id_equipo
        """)).fetchall()
        fixed = 0
        for row in result:
            equipo_id = row[0]
            min_o = row[1]
            max_o = row[2]
            cnt = row[3]
            # If orden values are all the same (e.g., all 0) or too similar
            if cnt > 1 and (max_o - min_o < cnt - 1 or max_o >= 11):
                players = conn.execute(sql_text("""
                    SELECT id FROM jugadores_equipo_fecha
                    WHERE id_equipo = :eid
                    ORDER BY id
                """), {"eid": equipo_id}).fetchall()
                for idx, (pid,) in enumerate(players):
                    conn.execute(sql_text("""
                        UPDATE jugadores_equipo_fecha SET orden = :ord WHERE id = :pid
                    """), {"ord": idx, "pid": pid})
                fixed += cnt
        conn.commit()
        if fixed:
            logger.info(f"Fixed {fixed} players with duplicate orden values (migration)")
    except Exception as e:
        logger.warning(f"Orden migration skipped: {e}")

# Auto-promote first registered user to admin (if any user exists but none is admin)
db = SessionLocal()
try:
    admin_exists = db.query(Usuario).filter(Usuario.is_admin == True).first()
    if not admin_exists:
        first_user = db.query(Usuario).order_by(Usuario.id_usuario.asc()).first()
        if first_user:
            first_user.is_admin = True
            db.commit()
            logger.info(f"Auto-promoted user '{first_user.email}' to admin")
finally:
    db.close()

# Seed database with matches if empty
db = SessionLocal()
try:
    if db.query(Partido).count() == 0:
        db.add_all(seed_matches)
        db.commit()
        logger.info("Seeded database with match fixtures.")
finally:
    db.close()

# Migration: force all match dates to seed_data values regardless of existing DB content.
# This fixes deployments where the DB was seeded with wrong Argentina-local times.
db = SessionLocal()
try:
    existing = db.query(Partido).count()
    if existing > 0:
        from sqlalchemy import case
        fixed = 0
        for sm in seed_matches:
            match = db.query(Partido).filter(Partido.id_partido == sm.id_partido).first()
            if match and match.fecha != sm.fecha:
                logger.info(f"Fixed date for {match.equipo_local} vs {match.equipo_visitante}: {match.fecha} -> {sm.fecha}")
                match.fecha = sm.fecha
                fixed += 1
        if fixed > 0:
            db.commit()
            logger.info(f"Forced seed date correction: updated {fixed} match date(s)")
except Exception as e:
    logger.warning(f"Could not force seed date correction: {e}")
finally:
    db.close()

# Sync kickoff times from API at startup to fix any wrong seed dates
# This runs synchronously so times are corrected before the scheduler starts
db = SessionLocal()
try:
    date_sync_result = sync_all_dates(db)
    logger.info(f"Startup date sync: {date_sync_result}")
except Exception as e:
    logger.warning(f"Could not sync match dates at startup: {e}")
finally:
    db.close()

# Migrate: add precio_compra column to jugadores_equipo_fecha if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE jugadores_equipo_fecha ADD COLUMN precio_compra INTEGER DEFAULT 0"))
        conn.commit()
        logger.info("Added precio_compra column to jugadores_equipo_fecha (migration)")
    except Exception:
        pass  # Column already exists

# Migrate: add arquero_nombre column to rondas_duelo if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE rondas_duelo ADD COLUMN arquero_nombre VARCHAR"))
        conn.commit()
        logger.info("Added arquero_nombre column to rondas_duelo (migration)")
    except Exception:
        pass  # Column already exists

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE rondas_duelo ADD COLUMN fuerza INTEGER DEFAULT 50"))
        conn.commit()
        logger.info("Added fuerza column to rondas_duelo (migration)")
    except Exception:
        pass  # Column already exists



# Migrate: convert partido.fecha from Argentina time (UTC-3) to UTC.
# Old seed data stored dates in Argentina local time (e.g., 16:00 for the
# first match slot). In UTC that would be 19:00.  Check whether the first
# match still has the old time and bump all dates by 3 hours if so.
db = SessionLocal()
try:
    first = db.query(Partido).order_by(Partido.id_partido.asc()).first()
    if first and first.fecha and first.fecha.hour == 16:
        dialect = db.bind.dialect.name
        if dialect == "postgresql":
            db.execute(text("UPDATE partidos SET fecha = fecha + INTERVAL '3 hours'"))
        else:
            db.execute(text("UPDATE partidos SET fecha = datetime(fecha, '+3 hours')"))
        db.commit()
        logger.info("Migrated partido.fecha from Argentina time to UTC (+3h)")
except Exception as e:
    logger.warning("Could not migrate partido timezone: %s", e)
finally:
    db.close()

# Migrate: reset champion prediction points to 0 on startup if any user got 50 points by mistake
db = SessionLocal()
try:
    from .models import PrediccionCampeon, Grupo
    from .utils import recalcular_puntos_grupo
    # Check if there are any champion predictions with points > 0
    over_limit = db.query(PrediccionCampeon).filter(PrediccionCampeon.puntos_obtenidos > 0).all()
    if over_limit:
        db.query(PrediccionCampeon).update({PrediccionCampeon.puntos_obtenidos: 0})
        db.commit()
        logger.info("Auto-reset champion prediction points to 0 on startup")
        
        # Recalculate points for all groups
        for group in db.query(Grupo).all():
            recalcular_puntos_grupo(db, group.id_grupo)
            logger.info(f"Recalculated points for group {group.nombre_grupo}")
except Exception as e:
    logger.warning("Could not auto-reset champion points: %s", e)
finally:
    db.close()

# Seed players from football-data.org
db = SessionLocal()
try:
    seed_players(db)
finally:
    db.close()

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        run_full_sync,
        trigger="interval",
        minutes=5,
        id="auto_sync_matches",
        replace_existing=True,
        name="Auto-sync resultados (API gratuita + football-data.org)",
    )
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Prode Mundial API",
    description="Backend para la aplicación de Prode del Mundial",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_routes.router)
app.include_router(group_routes.router)
app.include_router(match_routes.router)
app.include_router(prediction_routes.router)
app.include_router(ranking_routes.router)
app.include_router(fantasy_routes.router)
app.include_router(fantasy_h2h_routes.router)
app.include_router(admin_routes.router)
app.include_router(duel_routes.router)


# WebSocket: Duel endpoint
from fastapi import WebSocket, WebSocketDisconnect, Query as WsQuery
from .duel_manager import handle_duel_ws

@app.websocket("/ws/duel/{duelo_id}")
async def websocket_duel(websocket: WebSocket, duelo_id: int, token: str = WsQuery(...)):
    await handle_duel_ws(websocket, duelo_id, token)


# Serve built frontend in production (catch-all for SPA)
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    from fastapi.responses import FileResponse
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="frontend_assets")
    sounds_path = frontend_dist / "sounds"
    if sounds_path.exists():
        app.mount("/sounds", StaticFiles(directory=str(sounds_path)), name="sounds")
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
    logger.info(f"Serving frontend from {frontend_dist}")
else:
    logger.info("Frontend dist not found, API-only mode")


@app.get("/api/health")
def read_root():
    return {
        "message": "Bienvenido a la API de Prode Mundial",
        "status": "online",
        "version": "1.0.0",
    }
