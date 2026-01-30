from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres123@localhost:5432/ai_platform"
    
    # Redis
    REDIS_URL: str = "redis://:redis123@localhost:6379/0"
    
    # JWT
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Google AI
    GOOGLE_API_KEY: str = ""
    
    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000
    
    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: str = "pdf,docx,txt,png,jpg,jpeg,gif"
    
    # Security
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080"
    API_KEY_SECRET: str = ""
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # เพิ่มบรรทัดนี้เพื่อ ignore extra env vars

settings = Settings()