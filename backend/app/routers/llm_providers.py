from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.llm_provider import ProviderType
from app.schemas.llm_provider import (
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderResponse,
    ProviderModelsResponse,
    ModelInfo,
    TestConnectionRequest,
    TestConnectionResponse
)
from app.services.llm_provider_service import LLMProviderService

router = APIRouter(prefix="/llm-providers", tags=["LLM Providers"])


@router.post("/", response_model=LLMProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider_data: LLMProviderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new LLM provider configuration"""
    try:
        db_provider = await LLMProviderService.create_provider(
            db=db,
            user_id=current_user.id,
            provider_data=provider_data
        )
        return LLMProviderResponse.from_orm_with_mask(db_provider)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create provider: {str(e)}"
        )


@router.get("/", response_model=List[LLMProviderResponse])
async def get_providers(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all LLM providers for the current user"""
    providers = await LLMProviderService.get_providers(
        db=db,
        user_id=current_user.id,
        active_only=active_only
    )
    return [LLMProviderResponse.from_orm_with_mask(p) for p in providers]


@router.get("/default", response_model=LLMProviderResponse)
async def get_default_provider(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the default LLM provider"""
    provider = await LLMProviderService.get_default_provider(db=db, user_id=current_user.id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default provider configured"
        )
    return LLMProviderResponse.from_orm_with_mask(provider)


@router.get("/{provider_id}", response_model=LLMProviderResponse)
async def get_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific LLM provider"""
    provider = await LLMProviderService.get_provider(
        db=db,
        provider_id=provider_id,
        user_id=current_user.id
    )
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    return LLMProviderResponse.from_orm_with_mask(provider)


@router.put("/{provider_id}", response_model=LLMProviderResponse)
async def update_provider(
    provider_id: int,
    provider_data: LLMProviderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an LLM provider"""
    provider = await LLMProviderService.update_provider(
        db=db,
        provider_id=provider_id,
        user_id=current_user.id,
        provider_data=provider_data
    )
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    return LLMProviderResponse.from_orm_with_mask(provider)


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an LLM provider"""
    success = await LLMProviderService.delete_provider(
        db=db,
        provider_id=provider_id,
        user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(test_data: TestConnectionRequest):
    """Test connection to an LLM provider"""
    result = await LLMProviderService.test_connection(test_data)
    return TestConnectionResponse(**result)


@router.get("/models/{provider_type}", response_model=List[ModelInfo])
async def get_provider_models(provider_type: ProviderType):
    """Get available models for a provider type"""
    models = LLMProviderService.get_available_models(provider_type)
    return [ModelInfo(**model, provider=provider_type, supports_vision=False, supports_function_calling=True) for model in models]
