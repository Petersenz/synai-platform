from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Optional
import uuid
import json
import redis.asyncio as redis

from app.config import settings
from app.models.chat import ChatMessage, ChatSession

class MemoryService:
    """
    Memory Layer สำหรับ LLM
    - Short-term: Conversation history ใน session
    - Long-term: Cached summaries in Redis
    """
    
    _redis_client = None
    
    @classmethod
    async def get_redis(cls):
        if cls._redis_client is None:
            cls._redis_client = redis.from_url(settings.REDIS_URL)
        return cls._redis_client
    
    @classmethod
    async def get_context(
        cls,
        db: AsyncSession,
        session_id: uuid.UUID,
        limit: int = 10
    ) -> List[Dict[str, str]]:
        """Get conversation history for context"""
        
        # Try to get cached summary first
        cached = await cls._get_cached_summary(session_id)
        if cached:
            return cached
        
        # Get recent messages from database
        result = await db.execute(
            select(ChatMessage).where(
                ChatMessage.session_id == session_id
            ).order_by(ChatMessage.created_at.desc()).limit(limit)
        )
        messages = result.scalars().all()
        
        # Reverse to get chronological order
        messages = list(reversed(messages))
        
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        return history
    
    @classmethod
    async def add_to_memory(
        cls,
        session_id: uuid.UUID,
        role: str,
        content: str
    ):
        """Add a message to the memory cache"""
        redis_client = await cls.get_redis()
        key = f"memory:{session_id}"
        
        # Get existing memory
        existing = await redis_client.get(key)
        if existing:
            memory = json.loads(existing)
        else:
            memory = []
        
        # Add new message
        memory.append({"role": role, "content": content})
        
        # Keep only last 20 messages
        if len(memory) > 20:
            memory = memory[-20:]
        
        # Save with expiration (24 hours)
        await redis_client.setex(
            key,
            86400,  # 24 hours
            json.dumps(memory)
        )
    
    @classmethod
    async def _get_cached_summary(
        cls,
        session_id: uuid.UUID
    ) -> Optional[List[Dict[str, str]]]:
        """Get cached conversation summary"""
        try:
            redis_client = await cls.get_redis()
            key = f"memory:{session_id}"
            cached = await redis_client.get(key)
            if cached:
                return json.loads(cached)
        except:
            pass
        return None
    
    @classmethod
    async def clear_memory(cls, session_id: uuid.UUID):
        """Clear memory for a session"""
        try:
            redis_client = await cls.get_redis()
            await redis_client.delete(f"memory:{session_id}")
        except:
            pass
    
    @classmethod
    async def get_session_summary(
        cls,
        db: AsyncSession,
        session_id: uuid.UUID
    ) -> str:
        """Generate a summary of the conversation (for long-term memory)"""
        result = await db.execute(
            select(ChatMessage).where(
                ChatMessage.session_id == session_id
            ).order_by(ChatMessage.created_at.asc())
        )
        messages = result.scalars().all()
        
        if not messages:
            return ""
        
        # Simple summary: first and last few messages
        summary_parts = []
        
        if len(messages) <= 6:
            for msg in messages:
                summary_parts.append(f"{msg.role}: {msg.content[:100]}...")
        else:
            # First 3
            for msg in messages[:3]:
                summary_parts.append(f"{msg.role}: {msg.content[:100]}...")
            summary_parts.append("... (conversation continued) ...")
            # Last 3
            for msg in messages[-3:]:
                summary_parts.append(f"{msg.role}: {msg.content[:100]}...")
        
        return "\n".join(summary_parts)