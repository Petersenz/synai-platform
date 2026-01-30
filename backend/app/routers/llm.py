from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import time
import io
import os
import json
import aiofiles
import asyncio

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.file import File
from app.models.chat import ChatSession, ChatMessage
from app.models.log import LLMUsageLog
from app.routers.auth import get_current_user, get_authenticated_user
from app.services.llm_service import LLMService
from app.services.vector_service import VectorService
from app.services.memory_service import MemoryService
from app.services.log_service import LogService

router = APIRouter()

# ============== Pydantic Models ==============

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[uuid.UUID] = None
    file_ids: Optional[List[uuid.UUID]] = None
    use_rag: bool = True
    provider_id: Optional[int] = None
    model: Optional[str] = None

class Citation(BaseModel):
    source: str
    file_id: Optional[str] = None
    page: Optional[str] = None
    content: str
    relevance_score: float

class ChatResponse(BaseModel):
    message_id: uuid.UUID
    session_id: uuid.UUID
    content: str
    citations: List[Citation]
    tokens_used: int
    created_at: datetime

class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    tokens_used: int
    citations: Optional[List[dict]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]
    total: int

class TokenUsageResponse(BaseModel):
    period: str
    start_date: datetime
    end_date: datetime
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    request_count: int

class TokenUsageSummary(BaseModel):
    last_message: Optional[int] = None
    daily: TokenUsageResponse
    weekly: TokenUsageResponse
    monthly: TokenUsageResponse

class RenameSessionRequest(BaseModel):
    title: str

# ============== Chat Endpoints ==============
@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    chat_request: ChatRequest,
    current_user: User = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message to the LLM"""
    start_time = time.time()
    
    # Get or create session
    if chat_request.session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == chat_request.session_id,
                ChatSession.user_id == current_user.id
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(
            user_id=current_user.id,
            title=chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message
        )
        db.add(session)
    # Get context from RAG if files are specified
    rag_context = []
    images_from_files = []
    citations = []
    file_names = {}
    
    # Aggregate file IDs from session history for continuous context
    session_file_ids = set()
    if chat_request.session_id:
        try:
            hist_result = await db.execute(
                select(ChatMessage.file_ids).where(ChatMessage.session_id == chat_request.session_id)
            )
            for row in hist_result.scalars().all():
                if row:
                    for fid in row:
                        session_file_ids.add(str(fid))
        except Exception as e:
            print(f"DEBUG: Error aggregating session files: {e}")

    # Combine request files with session history files
    request_file_ids = [str(fid) for fid in (chat_request.file_ids or [])]
    total_file_ids = list(set(request_file_ids) | session_file_ids)

    if chat_request.use_rag and total_file_ids:
        try:
            # Batch fetch all relevant files for performance
            all_uuids = [uuid.UUID(fid) for fid in total_file_ids]
            res_f = await db.execute(select(File).where(File.id.in_(all_uuids)))
            fetched_files = res_f.scalars().all()
            
            file_ids_str = []
            for f in fetched_files:
                fid = str(f.id)
                file_names[fid] = f.original_filename
                
                # Auto-index if needed
                if not f.is_processed:
                    print(f"INFO: Processing file {f.original_filename}...")
                    try:
                        v_id = await VectorService.process_document(
                            file_path=f.storage_path,
                            file_id=fid,
                            user_id=str(current_user.id)
                        )
                        f.is_processed = True
                        f.vector_id = v_id
                        db.add(f)
                        await db.commit()
                    except Exception as e:
                        print(f"ERROR: Indexing failed for {f.original_filename}: {e}")
                
                # Multimodal support: Read images
                if f.file_type.lower() in ["image", "png", "jpg", "jpeg", "webp"] or (f.mime_type and f.mime_type.startswith("image/")):
                    try:
                        if os.path.exists(f.storage_path):
                            with open(f.storage_path, "rb") as image_file:
                                images_from_files.append({
                                    "data": image_file.read(),
                                    "mime_type": f.mime_type or f"image/{f.file_type.lower()}"
                                })
                    except Exception as e:
                        print(f"ERROR: Failed to read image file {f.original_filename}: {e}")
                
                if f.is_processed:
                    file_ids_str.append(fid)

            # Clean query for RAG (remove attachment markers)
            clean_query = chat_request.message.split("\n\n📎 Attached:")[0].split("\n\n📤 Uploaded:")[0].strip() or chat_request.message

            # Perform Search in Parallel for performance
            search_tasks = []
            results_per_file = max(5, 20 // len(file_ids_str))
            
            for fid in file_ids_str:
                search_tasks.append(VectorService.search(
                    user_id=str(current_user.id),
                    query=clean_query,
                    n_results=results_per_file,
                    file_ids=[fid]
                ))
            
            # Execute all searches concurrently
            all_search_results = await asyncio.gather(*search_tasks)
            
            all_results = []
            for res_list in all_search_results:
                all_results.extend(res_list)
            
            # Sort all results by distance and pick top 20
            all_results.sort(key=lambda x: x.get("distance", 1.0))
            search_results = all_results[:20]
            
            # Map to keep unique citations by file_id
            unique_citations = {}
            
            for result in search_results:
                chunk = result.get("content", "")
                if chunk.strip():
                    meta = result.get("metadata", {})
                    fid = str(meta.get("file_id", "unknown"))
                    fname = file_names.get(fid, fid)
                    page = meta.get("page", "Unknown")
                    
                    # Add formatted context with source info for the AI to cite
                    rag_context.append(f"[SOURCE: {fname}, PAGE: {page}]\n{chunk}")
                    
                    dist = result.get("distance", 1.0)
                    
                    # Detect if it's a broad command (summary/overview) to boost baseline perception
                    is_broad_query = any(word in clean_query.lower() for word in ["summarize", "summary", "overview", "สรุป", "ภาพรวม"])
                    
                    # Optimized Perception Scoring: Non-linear scaling for better user experience
                    # 0.0 distance -> ~99%
                    # 1.0 distance -> ~75%
                    # 1.5 distance -> ~60%
                    score = 1.0 / (1.0 + (dist * 0.35))
                    
                    # Apply broad query boost or floor
                    if is_broad_query:
                        score = max(0.70, score + 0.1) # Summaries feel more "Confident"
                    else:
                        score = max(0.45, score) # Higher baseline
                        
                    # Confident Top-Match Boost: If it's a very close match, push it higher
                    if dist < 0.4: 
                        score = min(0.99, score * 1.1)
                    
                    current_score = round(score, 3)
                    
                    # Only add or update if it's a better match for this file
                    if fid not in unique_citations or current_score > unique_citations[fid].relevance_score:
                        unique_citations[fid] = Citation(
                            source=fname,
                            file_id=fid,
                            page=str(page),
                            content=chunk[:200] + "...",
                            relevance_score=current_score
                        )
            
            citations = list(unique_citations.values())
            # Sort by relevance
            citations.sort(key=lambda x: x.relevance_score, reverse=True)
        except Exception as e:
            print(f"ERROR: RAG process failed: {e}")
    
    # Get memory context
    memory_context = await MemoryService.get_context(db=db, session_id=session.id, limit=10)
    
    # Get provider and model
    from app.services.llm_provider_service import LLMProviderService
    
    if chat_request.provider_id:
        provider = await LLMProviderService.get_provider(db, chat_request.provider_id, current_user.id)
    else:
        provider = await LLMProviderService.get_default_provider(db, current_user.id)
        
    if not provider:
        raise HTTPException(status_code=400, detail="No LLM provider configured. Please add one in settings.")
        
    model_to_use = chat_request.model or provider.default_model or "gemini-2.0-flash"

    # Generate response
    llm_response = await LLMService.generate_response(
        message=chat_request.message,
        provider=provider,
        model=model_to_use,
        context=rag_context if rag_context else None,
        history=memory_context,
        images=images_from_files if images_from_files else None
    )
    
    # Save messages
    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=chat_request.message,
        file_ids=[str(fid) for fid in chat_request.file_ids] if chat_request.file_ids else None
    )
    db.add(user_message)
    
    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=llm_response["content"],
        tokens_used=llm_response["total_tokens"],
        citations=[c.model_dump() for c in citations] if citations else None
    )
    db.add(assistant_message)
    await db.commit()
    await db.refresh(assistant_message)
    
    # Update session
    session.updated_at = datetime.utcnow()
    await db.commit()
    
    # Log usage
    latency_ms = int((time.time() - start_time) * 1000)
    await LogService.log_llm_usage(
        db=db,
        user_id=current_user.id,
        session_id=session.id,
        message_id=assistant_message.id,
        model=llm_response["model"],
        prompt_tokens=llm_response["prompt_tokens"],
        completion_tokens=llm_response["completion_tokens"],
        latency_ms=latency_ms
    )
    
    return ChatResponse(
        message_id=assistant_message.id,
        session_id=session.id,
        content=llm_response["content"],
        citations=citations,
        tokens_used=llm_response["total_tokens"],
        created_at=assistant_message.created_at
    )

@router.post("/chat-with-file")
async def chat_with_file(
    request: Request,
    message: str = Form(...),
    files: List[UploadFile] = FastAPIFile(...),
    session_id: Optional[str] = Form(None),
    file_ids: Optional[str] = Form(None), # JSON string of list
    provider_id: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a file, save it to library, and chat with combined context from session"""
    start_time = time.time()
    
    async def process_one(f: UploadFile):
        content = await f.read()
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else "txt"
        unique_name = f"{uuid.uuid4()}.{ext}"
        user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
        os.makedirs(user_dir, exist_ok=True)
        path = os.path.join(user_dir, unique_name)
        async with aiofiles.open(path, 'wb') as out: await out.write(content)
        from app.routers.files import get_file_type
        file_obj = File(user_id=current_user.id, filename=unique_name, original_filename=f.filename,
                        file_type=get_file_type(f.content_type), file_size=len(content),
                        mime_type=f.content_type, storage_path=path)
        db.add(file_obj)
        await db.commit()
        await db.refresh(file_obj)
        
        txt = await LLMService.extract_file_content(content, f.filename, f.content_type)
        v_id = await VectorService.process_document(path, str(file_obj.id), str(current_user.id))
        file_obj.is_processed = True
        file_obj.vector_id = v_id
        await db.commit()
        return file_obj, txt, content

    # 1. Save and Process all uploads in parallel
    results = await asyncio.gather(*[process_one(f) for f in files])
    new_files = [r[0] for r in results]

    # Get active session
    active_session_id = None
    if session_id:
        active_session_id = uuid.UUID(session_id)
        result = await db.execute(select(ChatSession).where(ChatSession.id == active_session_id, ChatSession.user_id == current_user.id))
        session = result.scalar_one_or_none()
    else:
        session = ChatSession(user_id=current_user.id, title=f"Analysis of {file.filename}"[:50])
        db.add(session)
        await db.commit()
        await db.refresh(session)
        active_session_id = session.id
        
    # Aggregate candidates (New + History + Selected)
    cand_ids = {str(f.id) for f in new_files}
    if active_session_id:
        h_res = await db.execute(select(ChatMessage.file_ids).where(ChatMessage.session_id == active_session_id))
        for row in h_res.scalars().all():
            if row:
                for fid in row: cand_ids.add(str(fid))
    if file_ids:
        try:
            for fid in json.loads(file_ids): cand_ids.add(str(fid))
        except: pass

    # VALIDATION (Edge case: Deletion)
    uuids_to_check = [uuid.UUID(fid) for fid in cand_ids]
    v_res = await db.execute(select(File).where(File.id.in_(uuids_to_check)))
    v_files = v_res.scalars().all()
    file_map = {str(f.id): f for f in v_files}
    final_fids = set(file_map.keys())
    new_fids_set = {str(f.id) for f in new_files}

    clean_query = message.split("\n\n📎 Attached:")[0].split("\n\n📤 Uploaded:")[0].strip() or message
    rag_context = []
    unique_citations = {}

    # Context from New Uploads
    images = []
    for f_obj, txt, raw_content in results:
        rag_context.append(f"[SOURCE: {f_obj.original_filename}, PAGE: 1]\n{txt[:10000]}")
        unique_citations[str(f_obj.id)] = Citation(source=f_obj.original_filename, file_id=str(f_obj.id), page="1", content=txt[:200]+"...", relevance_score=0.99)
        if f_obj.mime_type and f_obj.mime_type.startswith("image/"):
            images.append({"data": raw_content, "mime_type": f_obj.mime_type})

    # Search in other session files
    other_list = [fid for fid in final_fids if fid not in new_fids_set]
    s_tasks = [VectorService.search(str(current_user.id), clean_query, 5, [fid]) for fid in other_list]
    s_results = await asyncio.gather(*s_tasks)

    for i, r_list in enumerate(s_results):
        fid = other_list[i]
        f = file_map.get(fid)
        if not f: continue
        for res in r_list:
            chunk = res.get("content", "").strip()
            if chunk:
                p = str(res.get("metadata", {}).get("page", "1"))
                rag_context.append(f"[SOURCE: {f.original_filename}, PAGE: {p}]\n{chunk}")
                dist = res.get("distance", 1.0)
                score = max(0.65, round(1.0 / (1.0 + (dist * 0.35)), 3))
                if fid not in unique_citations or score > unique_citations[fid].relevance_score:
                    unique_citations[fid] = Citation(source=f.original_filename, file_id=fid, page=p, content=chunk[:200]+"...", relevance_score=score)

    from app.services.llm_provider_service import LLMProviderService
    provider = await LLMProviderService.get_provider(db, int(provider_id), current_user.id) if (provider_id and provider_id.lower() != "none") else await LLMProviderService.get_default_provider(db, current_user.id)
    model_to_use = model or provider.default_model or "gemini-2.0-flash"
    
    ll_resp = await LLMService.generate_response(
        message=message, provider=provider, model=model_to_use, context=rag_context,
        history=await MemoryService.get_context(db, session.id),
        file_name=", ".join(f.original_filename for f in new_files),
        images=images if images else None
    )
    
    c_list = sorted(unique_citations.values(), key=lambda x: x.relevance_score, reverse=True)
    db.add(ChatMessage(session_id=session.id, role="user", content=f"[Uploaded: {', '.join(f.original_filename for f in new_files)}]\n\n{message}", file_ids=[uuid.UUID(fid) for fid in final_fids]))
    ai_msg = ChatMessage(session_id=session.id, role="assistant", content=ll_resp["content"], tokens_used=ll_resp["total_tokens"], citations=[c.model_dump() for c in c_list])
    db.add(ai_msg)
    await db.commit()

    return {
        "message_id": str(ai_msg.id), "session_id": str(session.id), "content": ll_resp["content"],
        "citations": c_list, "tokens_used": ll_resp["total_tokens"], "created_at": ai_msg.created_at.isoformat(),
        "new_files": [{"id": str(f.id), "filename": f.filename, "original_filename": f.original_filename} for f in new_files]
    }

# ============== Session Endpoints ==============

@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all chat sessions"""
    query = select(ChatSession).where(
        ChatSession.user_id == current_user.id
    ).order_by(ChatSession.updated_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    # Get message counts
    session_responses = []
    for session in sessions:
        count_result = await db.execute(
            select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session.id)
        )
        message_count = count_result.scalar() or 0
        
        session_responses.append(SessionResponse(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=message_count
        ))
    
    # Total count
    total_result = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == current_user.id)
    )
    total = total_result.scalar() or 0
    
    return SessionListResponse(sessions=session_responses, total=total)

@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_session_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all messages in a session"""
    # Verify session ownership
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get messages
    result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    
    return [MessageResponse.model_validate(m) for m in messages]

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat session"""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    await db.commit()
    
    # Log event
    await LogService.log_event(
        db=db,
        user_id=current_user.id,
        event_type="llm",
        event_action="delete_session",
        resource_type="session",
        resource_id=session_id,
        request=request
    )
    
    return {"message": "Session deleted successfully"}

@router.patch("/sessions/{session_id}")
async def rename_session(
    session_id: uuid.UUID,
    rename_request: RenameSessionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rename a chat session"""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.title = rename_request.title
    await db.commit()
    
    # Log event
    await LogService.log_event(
        db=db,
        user_id=current_user.id,
        event_type="llm",
        event_action="rename_session",
        resource_type="session",
        resource_id=session_id,
        details={"new_title": rename_request.title},
        request=request
    )
    
    return {"message": "Session renamed successfully", "title": session.title}

@router.get("/usage/chart")
async def get_token_usage_chart(
    range_hours: float = 24,
    model: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get token usage data points for charts"""
    start_time = datetime.utcnow() - timedelta(hours=range_hours)
    
    query = select(LLMUsageLog).where(
        LLMUsageLog.user_id == current_user.id,
        LLMUsageLog.created_at >= start_time
    )
    
    if model and model != "all":
        query = query.where(LLMUsageLog.model == model)
        
    query = query.order_by(LLMUsageLog.created_at.asc())
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # Format for chart
    chart_data = []
    for log in logs:
        chart_data.append({
            "timestamp": log.created_at.isoformat(),
            "total_tokens": log.total_tokens,
            "prompt_tokens": log.prompt_tokens,
            "completion_tokens": log.completion_tokens,
            "model": log.model
        })
        
    return chart_data

# ============== Token Usage Endpoints ==============

@router.get("/usage", response_model=TokenUsageSummary)
async def get_token_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get token usage statistics (per message, daily, weekly, monthly)"""
    now = datetime.utcnow()
    
    # Get last message tokens
    last_message_result = await db.execute(
        select(LLMUsageLog).where(
            LLMUsageLog.user_id == current_user.id
        ).order_by(LLMUsageLog.created_at.desc()).limit(1)
    )
    last_log = last_message_result.scalar_one_or_none()
    last_message_tokens = last_log.total_tokens if last_log else None
    
    # Daily usage (today)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    daily = await _get_usage_stats(db, current_user.id, today_start, now)
    
    # Weekly usage (last 7 days)
    week_start = today_start - timedelta(days=7)
    weekly = await _get_usage_stats(db, current_user.id, week_start, now)
    
    # Monthly usage (last 30 days)
    month_start = today_start - timedelta(days=30)
    monthly = await _get_usage_stats(db, current_user.id, month_start, now)
    
    return TokenUsageSummary(
        last_message=last_message_tokens,
        daily=TokenUsageResponse(
            period="daily",
            start_date=today_start,
            end_date=now,
            **daily
        ),
        weekly=TokenUsageResponse(
            period="weekly",
            start_date=week_start,
            end_date=now,
            **weekly
        ),
        monthly=TokenUsageResponse(
            period="monthly",
            start_date=month_start,
            end_date=now,
            **monthly
        )
    )

async def _get_usage_stats(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: datetime,
    end_date: datetime
) -> dict:
    """Helper function to get usage stats for a date range"""
    result = await db.execute(
        select(
            func.coalesce(func.sum(LLMUsageLog.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LLMUsageLog.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(LLMUsageLog.completion_tokens), 0).label("completion_tokens"),
            func.count(LLMUsageLog.id).label("request_count")
        ).where(
            and_(
                LLMUsageLog.user_id == user_id,
                LLMUsageLog.created_at >= start_date,
                LLMUsageLog.created_at <= end_date
            )
        )
    )
    row = result.one()
    
    return {
        "total_tokens": row.total_tokens or 0,
        "prompt_tokens": row.prompt_tokens or 0,
        "completion_tokens": row.completion_tokens or 0,
        "request_count": row.request_count or 0
    }

@router.get("/usage/details")
async def get_usage_details(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed token usage logs"""
    query = select(LLMUsageLog).where(LLMUsageLog.user_id == current_user.id)
    
    if start_date:
        query = query.where(LLMUsageLog.created_at >= start_date)
    if end_date:
        query = query.where(LLMUsageLog.created_at <= end_date)
    
    query = query.order_by(LLMUsageLog.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "logs": [
            {
                "id": str(log.id),
                "session_id": str(log.session_id) if log.session_id else None,
                "model": log.model,
                "prompt_tokens": log.prompt_tokens,
                "completion_tokens": log.completion_tokens,
                "total_tokens": log.total_tokens,
                "latency_ms": log.latency_ms,
                "created_at": log.created_at
            }
            for log in logs
        ],
        "count": len(logs)
    }