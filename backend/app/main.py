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
from .sync_service import auto_sync_matches

logger = logging.getLogger(__name__)

# Initialize database tables
Base.metadata.create_all(bind=engine)

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

# Migrate: add posicion_especifica column to jugadores if missing
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE jugadores ADD COLUMN posicion_especifica VARCHAR"))
        conn.commit()
        logger.info("Added posicion_especifica column to jugadores table (migration)")
    except Exception:
        pass  # Column already exists

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

# Seed players from football-data.org
db = SessionLocal()
try:
    seed_players(db)
finally:
    db.close()

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    def sync_job():
        db = SessionLocal()
        try:
            auto_sync_matches(db)
        finally:
            db.close()

    scheduler.add_job(
        sync_job,
        trigger="interval",
        minutes=5,
        id="auto_sync_matches",
        replace_existing=True,
        name="Auto-sync resultados desde football-data.org",
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
