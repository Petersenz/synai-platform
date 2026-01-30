from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from app.config import settings
from app.database import engine, Base

# Import routers directly (ไม่ผ่าน __init__)
from app.routers.auth import router as auth_router
from app.routers.files import router as files_router
from app.routers.llm import router as llm_router
from app.routers.monitoring import router as monitoring_router
from app.routers.llm_providers import router as llm_providers_router

# Create tables on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Optional: Seed data (e.g., import GOOGLE_API_KEY from .env if table is empty)
    if settings.GOOGLE_API_KEY:
        from app.database import AsyncSessionLocal
        from app.models.llm_provider import LLMProvider, ProviderType
        from app.models.user import User
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as db:
            # Check if any providers exist
            result = await db.execute(select(LLMProvider).limit(1))
            if not result.scalar_one_or_none():
                # Get all users (or just one if you prefer)
                user_result = await db.execute(select(User))
                users = user_result.scalars().all()
                
                for user in users:
                    provider = LLMProvider(
                        user_id=user.id,
                        provider_type=ProviderType.GOOGLE,
                        provider_name="Default Google AI",
                        api_key=settings.GOOGLE_API_KEY,
                        default_model="gemini-2.5-flash",
                        available_models="gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.5-pro,gemini-3-flash-preview,gemini-3-pro-preview",
                        is_active=True,
                        is_default=True
                    )
                    db.add(provider)
                await db.commit()
                print(f"✅ Seeded Google API key for {len(users)} users")

    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title="SynAI Platform API",
    description="SynAI Platform with LLM, RAG, and File Management",
    version="1.0.0",
    lifespan=lifespan
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Include Routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(files_router, prefix="/api/files", tags=["File Management"])
app.include_router(llm_router, prefix="/api/llm", tags=["LLM"])
app.include_router(monitoring_router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(llm_providers_router, prefix="/api", tags=["LLM Providers"])

# Health Check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

# Root
@app.get("/")
async def root():
    return {"message": "AI Platform API", "docs": "/docs"}

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )