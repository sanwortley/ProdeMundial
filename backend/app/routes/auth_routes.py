import os
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models import Usuario
from ..schemas import UsuarioCreate, UsuarioResponse, Token
from ..auth import get_password_hash, verify_password, create_access_token, get_current_user
from ..limiter import limiter
from ..email_utils import send_email

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UpdateProfileRequest(BaseModel):
    nombre: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

@router.post("/register", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user_in: UsuarioCreate, db: Session = Depends(get_db)):
    # Check if email is unique
    existing_user = db.query(Usuario).filter(Usuario.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya está registrado."
        )
    
    # Create new user
    hashed_password = get_password_hash(user_in.password)
    
    # Auto-promote to admin if no admin exists yet
    is_admin = db.query(Usuario).filter(Usuario.is_admin == True).first() is None
    
    db_user = Usuario(
        nombre=user_in.nombre,
        email=user_in.email,
        password_hash=hashed_password,
        is_admin=is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/profile", response_model=UsuarioResponse)
def update_profile(
    data: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if not data.nombre.strip():
        raise HTTPException(400, "El nombre no puede estar vacío")
    current_user.nombre = data.nombre.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/login")
@limiter.limit("15/minute")
async def login(request: Request, login_in: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Correo o contraseña incorrectos."
        )
    
    # Generate new session token (invalidates any other session for this user)
    user.session_token = secrets.token_urlsafe(32)
    db.commit()
    
    # Create JWT token with session_token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "id_usuario": user.id_usuario,
            "session_token": user.session_token,
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": {
            "id_usuario": user.id_usuario,
            "nombre": user.nombre,
            "email": user.email
        }
    }


@router.get("/me", response_model=UsuarioResponse)
def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == data.email).first()
    if not user:
        return {"message": "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña."}

    reset_token = create_access_token(
        data={"sub": user.email, "id_usuario": user.id_usuario, "purpose": "password_reset"},
        expires_delta=timedelta(minutes=15),
    )

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;border-radius:16px;color:#e2e8f0;">
        <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:40px;margin-bottom:8px;">⚽</div>
            <h1 style="color:#10b981;margin:0;font-size:20px;">Prode Mundial 2026</h1>
        </div>
        <h2 style="color:#f1f5f9;font-size:18px;margin-bottom:16px;">Restablece tu contraseña</h2>
        <p style="color:#94a3b8;font-size:14px;margin-bottom:20px;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta.
            Hacé clic en el botón de abajo para crear una nueva contraseña.
        </p>
        <div style="text-align:center;margin-bottom:24px;">
            <a href="{reset_link}"
               style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:16px;font-weight:bold;">
                Restablecer contraseña
            </a>
        </div>
        <p style="color:#64748b;font-size:12px;">
            Este enlace expira en 15 minutos. Si no solicitaste este cambio, ignorá este correo.
        </p>
    </div>
    """

    success = send_email(user.email, "Restablecés tu contraseña - Prode Mundial 2026", body_html)
    if not success:
        logger = __import__('logging').getLogger(__name__)
        logger.warning(f"Password reset email failed to send to {user.email}, but pretending it worked")

    return {"message": "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    from jose import JWTError, jwt
    from ..auth import SECRET_KEY, ALGORITHM
    try:
        payload = jwt.decode(data.token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        id_usuario = payload.get("id_usuario")
        purpose = payload.get("purpose")
        if email is None or id_usuario is None or purpose != "password_reset":
            raise HTTPException(status_code=400, detail="Token inválido.")
    except JWTError:
        raise HTTPException(status_code=400, detail="Token inválido o expirado.")

    user = db.query(Usuario).filter(Usuario.id_usuario == id_usuario, Usuario.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Usuario no encontrado.")

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")

    user.password_hash = get_password_hash(data.password)
    user.session_token = secrets.token_urlsafe(32)
    db.commit()

    return {"message": "Contraseña actualizada correctamente."}
