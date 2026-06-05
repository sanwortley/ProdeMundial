from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models import Usuario
from ..schemas import UsuarioCreate, UsuarioResponse, Token
from ..auth import get_password_hash, verify_password, create_access_token, get_current_user
from ..limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UpdateProfileRequest(BaseModel):
    nombre: str

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
    
    # Create JWT token
    access_token = create_access_token(
        data={"sub": user.email, "id_usuario": user.id_usuario}
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
