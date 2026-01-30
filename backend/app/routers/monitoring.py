from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.user import User
from app.models.log import EventLog, SecurityLog, LLMUsageLog
from app.routers.auth import get_current_user

router = APIRouter()

# ============== Pydantic Models ==============

class EventLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    event_type: str
    event_action: str
    resource_type: Optional[str]
    resource_id: Optional[uuid.UUID]
    details: Optional[dict]
    ip_address: Optional[str]
    created_at: datetime

class SecurityLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    event_type: str
    severity: str
    details: Optional[dict]
    ip_address: Optional[str]
    created_at: datetime

class LLMUsageLogResponse(BaseModel):
    id: uuid.UUID
    session_id: Optional[uuid.UUID]
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: Optional[int]
    created_at: datetime

class PaginatedEvents(BaseModel):
    items: List[EventLogResponse]
    total: int
    page: int
    size: int

class PaginatedSecurity(BaseModel):
    items: List[SecurityLogResponse]
    total: int
    page: int
    size: int

class DashboardStats(BaseModel):
    total_events: int
    total_security_events: int
    total_llm_requests: int
    total_tokens_used: int
    events_today: int
    security_alerts: int
    # Health Indicators
    auth_status: str  # secure, warning, critical
    rate_limit_status: str
    scan_status: str

# ============== Event Logs ==============

@router.get("/events", response_model=PaginatedEvents)
async def get_event_logs(
    event_type: Optional[str] = None,
    event_action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get event logs for the current user with pagination"""
    base_query = select(EventLog).where(EventLog.user_id == current_user.id)
    
    if event_type:
        base_query = base_query.where(EventLog.event_type == event_type)
    if event_action:
        base_query = base_query.where(EventLog.event_action == event_action)
    
    # Total count
    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0
    
    # Paginated data
    query = base_query.order_by(desc(EventLog.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    items = [
        EventLogResponse(
            id=log.id,
            user_id=log.user_id,
            event_type=log.event_type,
            event_action=log.event_action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            ip_address=str(log.ip_address) if log.ip_address else None,
            created_at=log.created_at
        )
        for log in logs
    ]
    
    return PaginatedEvents(
        items=items,
        total=total,
        page=(skip // limit) + 1,
        size=limit
    )

# ============== Security Logs ==============

@router.get("/security", response_model=PaginatedSecurity)
async def get_security_logs(
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get security logs for the current user with pagination"""
    base_query = select(SecurityLog).where(SecurityLog.user_id == current_user.id)
    
    if severity:
        base_query = base_query.where(SecurityLog.severity == severity)
    
    # Total count
    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0
    
    # Paginated data
    query = base_query.order_by(desc(SecurityLog.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    items = [
        SecurityLogResponse(
            id=log.id,
            user_id=log.user_id,
            event_type=log.event_type,
            severity=log.severity,
            details=log.details,
            ip_address=str(log.ip_address) if log.ip_address else None,
            created_at=log.created_at
        )
        for log in logs
    ]
    
    return PaginatedSecurity(
        items=items,
        total=total,
        page=(skip // limit) + 1,
        size=limit
    )

# ============== Dashboard ==============

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard statistics and health insights"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total events
    res_total_events = await db.execute(select(func.count(EventLog.id)).where(EventLog.user_id == current_user.id))
    total_events = res_total_events.scalar() or 0
    
    # Events today
    res_events_today = await db.execute(select(func.count(EventLog.id)).where(
        and_(EventLog.user_id == current_user.id, EventLog.created_at >= today_start)
    ))
    events_today = res_events_today.scalar() or 0
    
    # Total security events
    res_total_security = await db.execute(select(func.count(SecurityLog.id)).where(SecurityLog.user_id == current_user.id))
    total_security_events = res_total_security.scalar() or 0
    
    # Security alerts (high/critical in last 7 days)
    seven_days_ago = now - timedelta(days=7)
    res_alerts = await db.execute(select(func.count(SecurityLog.id)).where(
        and_(
            SecurityLog.user_id == current_user.id,
            SecurityLog.severity.in_(["high", "critical"]),
            SecurityLog.created_at >= seven_days_ago
        )
    ))
    security_alerts = res_alerts.scalar() or 0
    
    # Calculate Auth Health
    auth_status = "secure"
    if security_alerts > 0:
        auth_status = "warning"
    if security_alerts > 5:
        auth_status = "critical"
        
    # Total LLM requests
    res_llm = await db.execute(select(func.count(LLMUsageLog.id)).where(LLMUsageLog.user_id == current_user.id))
    total_llm_requests = res_llm.scalar() or 0
    
    # Total tokens used
    res_tokens = await db.execute(select(func.coalesce(func.sum(LLMUsageLog.total_tokens), 0)).where(
        LLMUsageLog.user_id == current_user.id
    ))
    total_tokens_used = res_tokens.scalar() or 0
    
    return DashboardStats(
        total_events=total_events,
        total_security_events=total_security_events,
        total_llm_requests=total_llm_requests,
        total_tokens_used=total_tokens_used,
        events_today=events_today,
        security_alerts=security_alerts,
        auth_status=auth_status,
        rate_limit_status="protected",
        scan_status="passed"
    )

@router.get("/events/types")
async def get_event_types(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all distinct event types"""
    result = await db.execute(
        select(EventLog.event_type, EventLog.event_action, func.count(EventLog.id).label("count"))
        .where(EventLog.user_id == current_user.id)
        .group_by(EventLog.event_type, EventLog.event_action)
    )
    rows = result.all()
    
    return [
        {"event_type": row.event_type, "event_action": row.event_action, "count": row.count}
        for row in rows
    ]