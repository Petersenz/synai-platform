from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request
from typing import Optional
import uuid

from app.models.log import EventLog, SecurityLog, LLMUsageLog


class LogService:
    @staticmethod
    async def log_event(
        db: AsyncSession,
        user_id: Optional[uuid.UUID],
        event_type: str,
        event_action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[uuid.UUID] = None,
        details: Optional[dict] = None,
        request: Optional[Request] = None
    ):
        log = EventLog(
            user_id=user_id,
            event_type=event_type,
            event_action=event_action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=request.client.host if request and request.client else None,
            user_agent=request.headers.get("user-agent") if request else None
        )
        db.add(log)
        await db.commit()

    @staticmethod
    async def log_security(
        db: AsyncSession,
        user_id: Optional[uuid.UUID],
        event_type: str,
        severity: str,
        details: Optional[dict] = None,
        request: Optional[Request] = None
    ):
        log = SecurityLog(
            user_id=user_id,
            event_type=event_type,
            severity=severity,
            details=details,
            ip_address=request.client.host if request and request.client else None,
            user_agent=request.headers.get("user-agent") if request else None
        )
        db.add(log)
        await db.commit()

    @staticmethod
    async def log_llm_usage(
        db: AsyncSession,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        message_id: uuid.UUID,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: int
    ):
        log = LLMUsageLog(
            user_id=user_id,
            session_id=session_id,
            message_id=message_id,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            latency_ms=latency_ms
        )
        db.add(log)
        await db.commit()