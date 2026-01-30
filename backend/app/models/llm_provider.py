from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base
import enum


class ProviderType(str, enum.Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    GROQ = "groq"
    COHERE = "cohere"
    MISTRAL = "mistral"
    TOGETHER = "together"
    CUSTOM = "custom"
    ZAI = "zai"


class LLMProvider(Base):
    """LLM Provider API Key Storage"""
    __tablename__ = "llm_providers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Provider info
    provider_type = Column(SQLEnum(ProviderType), nullable=False)
    provider_name = Column(String(100), nullable=False)  # Custom name
    
    # API credentials (encrypted in production)
    api_key = Column(Text, nullable=False)
    api_base_url = Column(String(500), nullable=True)  # For custom endpoints
    
    # Model configuration
    default_model = Column(String(100), nullable=True)
    available_models = Column(Text, nullable=True)  # JSON string of available models
    
    # Settings
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default provider for user
    
    # Rate limiting
    max_requests_per_minute = Column(Integer, default=60)
    max_tokens_per_request = Column(Integer, default=4096)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(String(50), default="active")  # active, inactive, error
    error_message = Column(Text, nullable=True)

    def __repr__(self):
        return f"<LLMProvider {self.provider_name} ({self.provider_type})>"
