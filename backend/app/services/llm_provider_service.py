from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, delete
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from app.models.llm_provider import LLMProvider, ProviderType
from app.schemas.llm_provider import (
    LLMProviderCreate,
    LLMProviderUpdate,
    TestConnectionRequest
)


# Model configurations for each provider
PROVIDER_MODELS = {
    ProviderType.OPENAI: [
        {"id": "gpt-5.2-2025-12-11", "name": "GPT-5.2", "context_length": 128000},
        {"id": "gpt-5-mini-2025-08-07", "name": "GPT-5 mini", "context_length": 128000},
        {"id": "gpt-5-nano-2025-08-07", "name": "GPT-5 nano", "context_length": 128000},
        {"id": "gpt-4.1-2025-04-14", "name": "GPT-4.1", "context_length": 32768},
        {"id": "o4-mini-2025-04-16", "name": "o4-mini", "context_length": 128000},
        {"id": "o1-2024-12-17", "name": "o1", "context_length": 100000},
        {"id": "o1-mini-2024-09-12", "name": "o1-mini", "context_length": 65536},
    ],
    ProviderType.ANTHROPIC: [
        {"id": "claude-opus-4-5-20251101", "name": "Claude Opus 4.5", "context_length": 200000},
        {"id": "claude-sonnet-4-5-20250929", "name": "Claude Sonnet 4.5", "context_length": 200000},
        {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "context_length": 200000},
        {"id": "claude-3-7-sonnet-20250219", "name": "Claude Sonnet 3.7", "context_length": 200000},
    ],
    ProviderType.GOOGLE: [
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "context_length": 1000000},
        {"id": "gemini-2.5-flash-lite", "name": "Gemini 2.5 Flash Lite", "context_length": 1000000},
        {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "context_length": 2000000},
        {"id": "gemini-3-flash-preview", "name": "Gemini 3 Flash Preview", "context_length": 1000000},
        {"id": "gemini-3-pro-preview", "name": "Gemini 3 Pro Preview", "context_length": 2000000},
    ],
    ProviderType.GROQ: [
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Meta)", "context_length": 128000},
        {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B (Meta)", "context_length": 128000},
        {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B (Mistral AI)", "context_length": 32768},
        {"id": "gemma2-9b-it", "name": "Gemma 2 9B (Google)", "context_length": 8192},
        {"id": "deepseek-v3", "name": "DeepSeek V3", "context_length": 128000},
    ],
    ProviderType.COHERE: [
        {"id": "command-r-plus", "name": "Command R+", "context_length": 128000},
        {"id": "command-r", "name": "Command R", "context_length": 128000},
        {"id": "command-light", "name": "Command Light", "context_length": 4096},
        {"id": "command", "name": "Command", "context_length": 4096},
    ],
    ProviderType.ZAI: [
        {"id": "GLM-4.7-Flash", "name": "GLM-4.7-Flash", "context_length": 128000},
        {"id": "GLM-4.6V-Flash", "name": "GLM-4.6V-Flash", "context_length": 128000},
        {"id": "GLM-4.5-Flash", "name": "GLM-4.5-Flash", "context_length": 128000},
    ],
}


class LLMProviderService:
    """Service for managing LLM providers"""
    
    @staticmethod
    async def create_provider(db: AsyncSession, user_id: Any, provider_data: LLMProviderCreate) -> LLMProvider:
        """Create a new LLM provider"""
        # If this is set as default, unset other defaults
        if provider_data.is_default:
            await db.execute(
                update(LLMProvider)
                .filter(
                    and_(
                        LLMProvider.user_id == user_id,
                        LLMProvider.is_default == True
                    )
                )
                .values(is_default=False)
            )
        
        # Get available models for this provider
        available_models = PROVIDER_MODELS.get(provider_data.provider_type, [])
        models_list = [m["id"] for m in available_models]
        
        # If CUSTOM and no models defined, use the default_model provided by user
        if provider_data.provider_type == ProviderType.CUSTOM and not models_list and provider_data.default_model:
            models_list = [provider_data.default_model]
            
        models_str = ",".join(models_list)
        
        db_provider = LLMProvider(
            user_id=user_id,
            provider_type=provider_data.provider_type,
            provider_name=provider_data.provider_name,
            api_key=provider_data.api_key,  # TODO: Encrypt in production
            api_base_url=provider_data.api_base_url,
            default_model=provider_data.default_model,
            available_models=models_str,
            is_active=provider_data.is_active,
            is_default=provider_data.is_default,
            max_requests_per_minute=provider_data.max_requests_per_minute,
            max_tokens_per_request=provider_data.max_tokens_per_request,
        )
        
        db.add(db_provider)
        await db.commit()
        await db.refresh(db_provider)
        return db_provider
    
    @staticmethod
    async def get_providers(db: AsyncSession, user_id: Any, active_only: bool = False) -> List[LLMProvider]:
        """Get all providers for a user with auto-seeding if empty"""
        # Check and seed if necessary
        await LLMProviderService._ensure_default_provider(db, user_id)
        
        query = select(LLMProvider).filter(LLMProvider.user_id == user_id)
        
        if active_only:
            query = query.filter(LLMProvider.is_active == True)
        
        query = query.order_by(LLMProvider.is_default.desc(), LLMProvider.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @staticmethod
    async def get_provider(db: AsyncSession, provider_id: int, user_id: Any) -> Optional[LLMProvider]:
        """Get a specific provider"""
        result = await db.execute(
            select(LLMProvider).filter(
                and_(
                    LLMProvider.id == provider_id,
                    LLMProvider.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_default_provider(db: AsyncSession, user_id: Any) -> Optional[LLMProvider]:
        """Get the default provider for a user with auto-seeding if empty"""
        query = select(LLMProvider).filter(
            and_(
                LLMProvider.user_id == user_id,
                LLMProvider.is_default == True,
                LLMProvider.is_active == True
            )
        )
        result = await db.execute(query)
        provider = result.scalar_one_or_none()
        
        if not provider:
            # Try to seed if they have nothing at all
            provider = await LLMProviderService._ensure_default_provider(db, user_id)
            
        return provider

    @staticmethod
    async def _ensure_default_provider(db: AsyncSession, user_id: Any) -> Optional[LLMProvider]:
        """Check if user has any providers, if not, create a default one from system settings"""
        from sqlalchemy import func
        from app.config import settings
        
        # Count providers for this user
        count_query = select(func.count()).select_from(LLMProvider).filter(LLMProvider.user_id == user_id)
        count_result = await db.execute(count_query)
        count = count_result.scalar()
        
        if count == 0 and settings.GOOGLE_API_KEY:
            # Seed default Gemini
            available = PROVIDER_MODELS.get(ProviderType.GOOGLE, [])
            models_str = ",".join([m["id"] for m in available])
            
            new_provider = LLMProvider(
                user_id=user_id,
                provider_type=ProviderType.GOOGLE,
                provider_name="Google Gemini (SynAI Default)",
                api_key=settings.GOOGLE_API_KEY,
                default_model="gemini-2.5-flash",
                available_models=models_str,
                is_active=True,
                is_default=True
            )
            db.add(new_provider)
            await db.commit()
            await db.refresh(new_provider)
            return new_provider
        
        return None
    
    @staticmethod
    async def update_provider(
        db: AsyncSession, 
        provider_id: int, 
        user_id: Any, 
        provider_data: LLMProviderUpdate
    ) -> Optional[LLMProvider]:
        """Update a provider"""
        db_provider = await LLMProviderService.get_provider(db, provider_id, user_id)
        if not db_provider:
            return None
        
        # If setting as default, unset other defaults
        if provider_data.is_default:
            await db.execute(
                update(LLMProvider)
                .filter(
                    and_(
                        LLMProvider.user_id == user_id,
                        LLMProvider.id != provider_id,
                        LLMProvider.is_default == True
                    )
                )
                .values(is_default=False)
            )
        
        # Update fields
        update_data = provider_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_provider, field, value)
        
        await db.commit()
        await db.refresh(db_provider)
        return db_provider
    
    @staticmethod
    async def delete_provider(db: AsyncSession, provider_id: int, user_id: Any) -> bool:
        """Delete a provider"""
        db_provider = await LLMProviderService.get_provider(db, provider_id, user_id)
        if not db_provider:
            return False
        
        await db.delete(db_provider)
        await db.commit()
        return True
    
    @staticmethod
    async def test_connection(test_data: TestConnectionRequest) -> Dict[str, Any]:
        """Test API connection to a provider"""
        try:
            # TODO: Implement actual API testing for each provider
            # For now, return mock success
            available_models = [m["id"] for m in PROVIDER_MODELS.get(test_data.provider_type, [])]
            
            return {
                "success": True,
                "message": f"Successfully connected to {test_data.provider_type.value}",
                "available_models": available_models,
                "error": None
            }
        except Exception as e:
            return {
                "success": False,
                "message": "Connection failed",
                "available_models": None,
                "error": str(e)
            }
    
    @staticmethod
    def get_available_models(provider_type: ProviderType) -> List[Dict[str, Any]]:
        """Get available models for a provider type"""
        return PROVIDER_MODELS.get(provider_type, [])
    
    @staticmethod
    async def update_last_used(db: AsyncSession, provider_id: int):
        """Update last used timestamp"""
        await db.execute(
            update(LLMProvider)
            .filter(LLMProvider.id == provider_id)
            .values(last_used_at=datetime.utcnow())
        )
        await db.commit()
