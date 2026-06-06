import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load env variables from parent directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "prode.db"
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Build from individual Railway PG* variables if DATABASE_URL is not set
if not DATABASE_URL:
    pgdatabase = os.getenv("PGDATABASE")
    pghost = os.getenv("PGHOST")
    pgpassword = os.getenv("PGPASSWORD")
    pgport = os.getenv("PGPORT", "5432")
    pguser = os.getenv("PGUSER", "postgres")
    if pgdatabase and pghost and pgpassword:
        DATABASE_URL = f"postgresql://{pguser}:{pgpassword}@{pghost}:{pgport}/{pgdatabase}"
    else:
        DATABASE_URL = f"sqlite:///{DEFAULT_DB_PATH}"
elif DATABASE_URL.startswith("sqlite:///./"):
    rel = DATABASE_URL.replace("sqlite:///./", "")
    DATABASE_URL = f"sqlite:///{BACKEND_DIR / rel}"

# Fallback for old postgres:// uri format
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
