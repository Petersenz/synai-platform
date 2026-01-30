from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile, Request
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
import aiofiles
from datetime import datetime

from app.database import get_db
from app.config import settings
from app.models.file import File
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.log_service import LogService

router = APIRouter()

# Pydantic Models
class FileResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    mime_type: Optional[str]
    is_processed: bool
    created_at: datetime

    class Config:
        from_attributes = True

class FileListResponse(BaseModel):
    files: List[FileResponse]
    total: int

# Helper Functions
def get_file_type(mime_type: str) -> str:
    if not mime_type:
        return "other"
    if mime_type.startswith("image/"):
        return "image"
    
    document_mimes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
        "application/msword",  # .doc
        "text/html"
    ]
    
    if mime_type in document_mimes or mime_type.startswith("text/"):
        return "document"
    return "other"

def is_allowed_file(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in settings.ALLOWED_EXTENSIONS.split(",")

# Endpoints
@router.post("/upload", response_model=FileResponse)
async def upload_file(
    request: Request,
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    
    ext = file.filename.rsplit(".", 1)[-1].lower()
    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(file_path, exist_ok=True)
    
    full_path = os.path.join(file_path, unique_filename)
    
    async with aiofiles.open(full_path, 'wb') as f:
        await f.write(content)
    
    file_record = File(
        user_id=current_user.id,
        filename=unique_filename,
        original_filename=file.filename,
        file_type=get_file_type(file.content_type),
        file_size=len(content),
        mime_type=file.content_type,
        storage_path=full_path
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)
    
    # Process for Vector DB if it's a document
    if file_record.file_type == "document":
        try:
            from app.services.vector_service import VectorService
            vector_id = await VectorService.process_document(
                file_path=full_path,
                file_id=str(file_record.id),
                user_id=str(current_user.id)
            )
            file_record.is_processed = True
            file_record.vector_id = vector_id
            await db.commit()
            await db.refresh(file_record)
        except Exception as e:
            print(f"Error processing document {file.filename}: {e}")
            # We don't fail the upload just because vector processing failed

    await LogService.log_event(
        db=db,
        user_id=current_user.id,
        event_type="file",
        event_action="upload",
        resource_type="file",
        resource_id=file_record.id,
        details={"filename": file.filename, "size": len(content), "processed": file_record.is_processed},
        request=request
    )
    
    return file_record

@router.get("/", response_model=FileListResponse)
async def list_files(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(File).where(File.user_id == current_user.id).order_by(File.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    files = result.scalars().all()
    
    count_result = await db.execute(select(File).where(File.user_id == current_user.id))
    total = len(count_result.scalars().all())
    
    return FileListResponse(files=files, total=total)

@router.get("/{file_id}/download")
async def download_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(File).where(File.id == file_id, File.user_id == current_user.id)
    )
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return FastAPIFileResponse(
        path=file.storage_path,
        filename=file.original_filename,
        media_type=file.mime_type
    )

@router.get("/{file_id}/view")
async def view_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(File).where(File.id == file_id, File.user_id == current_user.id)
    )
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return FastAPIFileResponse(
        path=file.storage_path,
        media_type=file.mime_type
    )

@router.delete("/{file_id}")
async def delete_file(
    file_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(File).where(File.id == file_id, File.user_id == current_user.id)
    )
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if os.path.exists(file.storage_path):
        os.remove(file.storage_path)
    
    await db.delete(file)
    await db.commit()
    
    await LogService.log_event(
        db=db,
        user_id=current_user.id,
        event_type="file",
        event_action="delete",
        resource_type="file",
        resource_id=file_id,
        request=request
    )
    
    return {"message": "File deleted successfully"}