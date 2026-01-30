from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
import uuid

from app.database import get_db
from app.config import settings
from app.models.user import User, APIKey
from app.services.log_service import LogService

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse

class TokenData(BaseModel):
    user_id: str | None = None

class APIKeyCreate(BaseModel):
    name: str
    expires_in_days: int = 30

class APIKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key: str | None = None  # Only shown once on creation
    is_active: bool = True
    expires_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# Helper Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=settings.JWT_EXPIRATION_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User | None:
    if not token:
        return None
        
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        return None
    return user

# "Hard" version for routes that ONLY accept JWT
async def get_current_user_strict(user: User = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid access token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_api_key_user(
    api_key: str = Depends(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not api_key:
        return None
    
    # API Keys are prefixed with ak_ for identification
    if not api_key.startswith("ak_"):
        return None
        
    raw_key = api_key[3:]
    
    # We need to find the key by comparing hashes (constant time is handled by passlib)
    # For performance in a real app, you might use a prefix as a database lookup key
    # but here we'll iterate or use a specific lookup strategy if available.
    
    # Efficiency: Get all active keys (usually not many per user, but let's be careful)
    result = await db.execute(select(APIKey).where(APIKey.is_active == True))
    keys = result.scalars().all()
    
    for key_obj in keys:
        if verify_password(raw_key, key_obj.key_hash):
            if key_obj.expires_at and key_obj.expires_at < datetime.now(timezone.utc):
                continue # Expired
            
            # Update last used
            key_obj.last_used_at = datetime.now(timezone.utc)
            await db.commit()
            
            # Return user
            user_res = await db.execute(select(User).where(User.id == key_obj.user_id))
            return user_res.scalar_one_or_none()
            
    return None

async def get_authenticated_user(
    user_jwt: User = Depends(get_current_user),
    user_api: User = Depends(get_api_key_user)
) -> User:
    user = user_jwt or user_api
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required (JWT or API Key)",
            headers={"WWW-Authenticate": "Bearer or X-API-Key"},
        )
    return user

# Endpoints
@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Check if user exists
    result = await db.execute(
        select(User).where(
            (User.username == user_data.username) | (User.email == user_data.email)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Log event
    await LogService.log_event(
        db=db,
        user_id=user.id,
        event_type="auth",
        event_action="register",
        resource_type="user",
        resource_id=user.id,
        details={"username": user.username},
        request=request
    )
    
    # Log security event
    await LogService.log_security(
        db=db,
        user_id=user.id,
        event_type="user_registered",
        severity="low",
        details={"username": user.username, "email": user.email},
        request=request
    )
    
    return user

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    # Find user
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        # Log failed attempt
        await LogService.log_security(
            db=db,
            user_id=user.id if user else None,
            event_type="login_failed",
            severity="medium",
            details={"username": form_data.username, "reason": "invalid_credentials"},
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is disabled")
    
    # Create token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # Log success
    await LogService.log_event(
        db=db,
        user_id=user.id,
        event_type="auth",
        event_action="login",
        resource_type="user",
        resource_id=user.id,
        request=request
    )
    
    await LogService.log_security(
        db=db,
        user_id=user.id,
        event_type="login_success",
        severity="low",
        details={"username": user.username},
        request=request
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRATION_HOURS * 3600,
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/verify-key", response_model=UserResponse)
async def verify_api_key(current_user: User = Depends(get_authenticated_user)):
    """Verify an API key or JWT and return the user info"""
    return current_user

@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change the current user's password"""
    if not verify_password(password_data.old_password, current_user.password_hash):
        # Log failed attempt
        await LogService.log_security(
            db=db,
            user_id=current_user.id,
            event_type="password_change_failed",
            severity="medium",
            details={"reason": "invalid_old_password"},
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # Update password
    current_user.password_hash = get_password_hash(password_data.new_password)
    await db.commit()
    
    # Log success
    await LogService.log_security(
        db=db,
        user_id=current_user.id,
        event_type="password_changed",
        severity="medium",
        request=request
    )
    
    return {"message": "Password updated successfully"}

@router.get("/api-keys", response_model=list[APIKeyResponse])
async def get_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all API keys for the current user"""
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == current_user.id).order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    return keys

@router.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    key_data: APIKeyCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new API key for the user"""
    import secrets
    
    # Generate API key
    raw_key = secrets.token_urlsafe(32)
    key_hash = get_password_hash(raw_key)
    expires_at = datetime.utcnow() + timedelta(days=key_data.expires_in_days) if key_data.expires_in_days > 0 else None
    
    api_key = APIKey(
        user_id=current_user.id,
        key_hash=key_hash,
        name=key_data.name,
        expires_at=expires_at
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    # Log event
    await LogService.log_security(
        db=db,
        user_id=current_user.id,
        event_type="api_key_created",
        severity="medium",
        details={"key_name": key_data.name, "expires_at": str(expires_at)},
        request=request
    )
    
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key=f"ak_{raw_key}",  # Only shown once!
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at
    )

@router.post("/api-keys/{key_id}/rotate", response_model=APIKeyResponse)
async def rotate_api_key(
    key_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rotate (regenerate) an existing API key"""
    import secrets
    
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Generate new key
    raw_key = secrets.token_urlsafe(32)
    api_key.key_hash = get_password_hash(raw_key)
    api_key.expires_at = datetime.utcnow() + timedelta(days=30)
    
    await db.commit()
    await db.refresh(api_key)
    
    # Log rotation
    await LogService.log_security(
        db=db,
        user_id=current_user.id,
        event_type="api_key_rotated",
        severity="medium",
        details={"key_id": str(key_id), "key_name": api_key.name},
        request=request
    )
    
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key=f"ak_{raw_key}",
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at
    )

@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: uuid.UUID,
    request: Request,
    permanent: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke an API key"""
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    if permanent:
        await db.delete(api_key)
        action = "api_key_deleted_permanently"
        msg = "API key deleted permanently"
    else:
        api_key.is_active = False
        action = "api_key_revoked"
        msg = "API key revoked successfully"
    await db.commit()
    
    await LogService.log_security(
        db=db,
        user_id=current_user.id,
        event_type="api_key_revoked",
        severity="medium",
        details={"key_id": str(key_id)},
        request=request
    )
    
    return {"message": "API key revoked successfully"}