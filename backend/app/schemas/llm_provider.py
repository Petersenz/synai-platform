import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.llm_provider import ProviderType


class LLMProviderBase(BaseModel):
    """Base schema for LLM Provider"""
    provider_type: ProviderType
    provider_name: str = Field(..., min_length=1, max_length=100)
    api_key: str = Field(..., min_length=1)
    api_base_url: Optional[str] = None
    default_model: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    max_requests_per_minute: int = Field(default=60, ge=1, le=1000)
    max_tokens_per_request: int = Field(default=4096, ge=1, le=100000)


class LLMProviderCreate(LLMProviderBase):
    """Schema for creating a new LLM provider"""
    pass


class LLMProviderUpdate(BaseModel):
    """Schema for updating an LLM provider"""
    provider_name: Optional[str] = Field(None, min_length=1, max_length=100)
    api_key: Optional[str] = Field(None, min_length=1)
    api_base_url: Optional[str] = None
    default_model: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    max_requests_per_minute: Optional[int] = Field(None, ge=1, le=1000)
    max_tokens_per_request: Optional[int] = Field(None, ge=1, le=100000)


class LLMProviderResponse(LLMProviderBase):
    """Schema for LLM provider response"""
    id: int
    user_id: uuid.UUID
    available_models: Optional[List[str]] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    
    # Mask API key for security
    api_key_masked: str
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_mask(cls, db_provider):
        """Create response with masked API key"""
        data = {
            **db_provider.__dict__,
            "api_key_masked": f"...{db_provider.api_key[-4:]}" if db_provider.api_key else "****",
            "available_models": db_provider.available_models.split(",") if db_provider.available_models else []
        }
        return cls(**data)


class ModelInfo(BaseModel):
    """Information about an available model"""
    id: str
    name: str
    provider: ProviderType
    context_length: int
    supports_vision: bool = False
    supports_function_calling: bool = False


class ProviderModelsResponse(BaseModel):
    """Response containing available models for a provider"""
    provider_id: int
    provider_type: ProviderType
    models: List[ModelInfo]


class TestConnectionRequest(BaseModel):
    """Request to test API connection"""
    provider_type: ProviderType
    api_key: str
    api_base_url: Optional[str] = None


class TestConnectionResponse(BaseModel):
    """Response from connection test"""
    success: bool
    message: str
    available_models: Optional[List[str]] = None
    error: Optional[str] = None
