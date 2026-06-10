import bcrypt
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import Usuario
from dotenv import load_dotenv

# Load env variables from parent directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "9a8b7c6d5e4f3g2h1i0j_prodemundial_secret_key_2026")
if SECRET_KEY == "9a8b7c6d5e4f3g2h1i0j_prodemundial_secret_key_2026":
    logger.warning("Using default SECRET_KEY — set a strong SECRET_KEY in .env for production.")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token de autenticación",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        id_usuario: int = payload.get("id_usuario")
        session_token: str = payload.get("session_token")
        if email is None or id_usuario is None or session_token is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if user is None or user.session_token != session_token:
        raise credentials_exception

    # Update last active timestamp if older than 1 minute or None
    now = datetime.utcnow()
    if not user.ultimo_acceso or (now - user.ultimo_acceso) > timedelta(minutes=1):
        user.ultimo_acceso = now
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to update ultimo_acceso for user {user.id_usuario}: {e}")

    return user
