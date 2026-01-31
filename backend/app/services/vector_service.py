import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Optional
import os
import re
try:
    from pythainlp.tokenize import word_tokenize, sent_tokenize
    HAS_PYTHAINLP = True
except ImportError:
    HAS_PYTHAINLP = False
    print(">>> [VECTOR-SERVICE] ⚠️ pythainlp not found. Falling back to basic splitting.")

from app.config import settings

class VectorService:
    _client = None
    
    @classmethod
    def get_client(cls):
        """Get or create a ChromaDB client (HttpClient for Docker, Persistent for Local)"""
        if cls._client is not None:
            return cls._client

        # Prefer HttpClient if CHROMA_HOST is set (for Docker/Production)
        chroma_host = os.getenv("CHROMA_HOST")
        chroma_port = os.getenv("CHROMA_PORT", "8000")
        
        if chroma_host and chroma_host != "localhost":
            print(f"\n>>> [CHROMA-CLIENT] 🚀 Connecting to Remote Server at {chroma_host}:{chroma_port}", flush=True)
            try:
                cls._client = chromadb.HttpClient(
                    host=chroma_host,
                    port=int(chroma_port),
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
                print(f">>> [CHROMA-CLIENT] ✅ SUCCESS: Connected to ChromaDB Server.", flush=True)
                return cls._client
            except Exception as e:
                print(f">>> [CHROMA-CLIENT] ⚠️ Connection failed: {str(e)}. Falling back to local.", flush=True)

        # Fallback/Local: PersistentClient reads/writes directly to the disk path
        chroma_path = os.getenv("CHROMA_PATH", "chroma_data")
        print(f"\n>>> [CHROMA-LOCAL] 🏠 Initializing Persistent Client at: {chroma_path}", flush=True)
        
        try:
            cls._client = chromadb.PersistentClient(
                path=chroma_path,
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            print(f">>> [CHROMA-LOCAL] ✅ SUCCESS: Local database is ready.", flush=True)
            return cls._client
        except Exception as e:
            print(f">>> [CHROMA-LOCAL] ❌ FATAL ERROR: Could not initialize local DB: {str(e)}", flush=True)
            return None
    
    @classmethod
    async def process_document(
        cls,
        file_path: str,
        file_id: str,
        user_id: str
    ) -> str:
        """Process a document and store in ChromaDB"""
        client = cls.get_client()
        
        if client is None:
            raise ValueError("ChromaDB is not available")
        
        # Extract text from document with metadata (e.g., page numbers)
        content_objects = cls._extract_with_metadata(file_path)
        
        if not content_objects:
            print(f">>> [VECTOR-SERVICE] ⚠️ Skipping vectorization for {file_path} (No text extracted)")
            return None
        
        # Split into chunks while preserving metadata
        chunks = []
        metadatas = []
        
        for obj in content_objects:
            text_part = obj["text"]
            page_no = obj.get("page")
            
            sub_chunks = cls._split_text(text_part)
            for i, chunk in enumerate(sub_chunks):
                chunks.append(chunk)
                metadatas.append({
                    "file_id": file_id,
                    "page": page_label if (page_label := obj.get("page_label")) else (f"Page {page_no}" if page_no else "General"),
                    "user_id": user_id,
                    "chunk_index": len(chunks) - 1
                })
        
        # Get or create collection
        collection_name = f"user_{user_id.replace('-', '_')}"
        
        try:
            collection = client.get_or_create_collection(
                name=collection_name,
                metadata={"user_id": user_id}
            )
            
            # Add documents
            ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
            
            collection.add(
                documents=chunks,
                ids=ids,
                metadatas=metadatas
            )
            
            return f"{collection_name}:{file_id}"
        except Exception as e:
            raise ValueError(f"Failed to process document: {e}")
    
    @classmethod
    def _extract_with_metadata(cls, file_path: str) -> List[dict]:
        """Extract text and metadata (like pages) from various document types"""
        ext = file_path.rsplit(".", 1)[-1].lower()
        
        try:
            if ext == "pdf":
                return cls._extract_pdf_pages(file_path)
            elif ext == "docx":
                return [{"text": cls._extract_docx(file_path), "page": None}]
            else:
                # Attempt to read as plain text
                for encoding in ["utf-8", "latin-1", "cp1252"]:
                    try:
                        with open(file_path, "r", encoding=encoding) as f:
                            content = f.read()
                            if "\0" in content[:1024]:
                                continue
                            return [{"text": content, "page": None}]
                    except (UnicodeDecodeError, Exception):
                        continue
                return []
        except Exception as e:
            print(f"Error extracting content from {file_path}: {e}")
            return []

    @classmethod
    def _extract_pdf_pages(cls, file_path: str) -> List[dict]:
        """Extract text from PDF page by page"""
        pages = []
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text and text.strip():
                    pages.append({
                        "text": text,
                        "page": i + 1,
                        "page_label": f"Page {i + 1}"
                    })
            return pages
        except Exception as e:
            print(f"PDF page extraction error: {e}")
            return []
    
    @classmethod
    def _extract_docx(cls, file_path: str) -> str:
        """Extract text from DOCX"""
        try:
            from docx import Document
            doc = Document(file_path)
            text = ""
            for para in doc.paragraphs:
                text += para.text + "\n"
            return text
        except Exception as e:
            print(f"DOCX extraction error: {e}")
            return ""
    
    @classmethod
    def _split_text(cls, text: str, chunk_size: int = 600, overlap: int = 120) -> List[str]:
        """Split text into chunks with overlap - optimized with pythainlp for Thai"""
        if not text:
            return []
        
        # Detect if text contains Thai characters
        has_thai = bool(re.search('[\u0e00-\u0e7f]', text))
        
        if has_thai and HAS_PYTHAINLP:
            # Thai-optimized splitting using sent_tokenize
            sentences = sent_tokenize(text, engine="whitespace+newline")
            chunks = []
            current_chunk = ""
            
            for sent in sentences:
                if len(current_chunk) + len(sent) <= chunk_size:
                    current_chunk += sent + " "
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = sent + " "
            
            if current_chunk:
                chunks.append(current_chunk.strip())
            return chunks
        else:
            # English-optimized splitting
            chunks = []
            text = " ".join(text.split())
            start = 0
            while start < len(text):
                end = start + chunk_size
                if end < len(text):
                    last_space = text.rfind(" ", start, end)
                    if last_space != -1 and last_space > start + (chunk_size // 2):
                        end = last_space
                chunk = text[start:end]
                if chunk.strip():
                    chunks.append(chunk)
                start = end - overlap
            return chunks
    
    @classmethod
    async def search(
        cls,
        user_id: str,
        query: str,
        n_results: int = 10,
        file_ids: Optional[List[str]] = None
    ) -> List[dict]:
        """Search for relevant documents with multiple fallback levels"""
        client = cls.get_client()
        
        if client is None:
            print("[RAG-SYSTEM] ❌ ERROR: ChromaDB connection failed.")
            return []
        
        collection_name = f"user_{user_id.replace('-', '_')}"
        
        try:
            collection = client.get_collection(collection_name)
        except Exception as e:
            print(f"[RAG-SYSTEM] ⚠️ Collection {collection_name} not found. Skipping search.")
            return []
        
        # Build where filter
        where_filter = None
        if file_ids:
            if len(file_ids) == 1:
                where_filter = {"file_id": file_ids[0]}
            else:
                where_filter = {"file_id": {"$in": file_ids}}
        
        try:
            print(f"[RAG-SYSTEM] 🔍 Searching '{query}' in {collection_name} (Filter: {where_filter})")
            
            # STAGE 1: Semantic Search
            results = collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where_filter
            )
            
            documents = []
            if results and results.get("documents") and len(results["documents"]) > 0:
                for i, doc in enumerate(results["documents"][0]):
                    dist = results["distances"][0][i]
                    
                    # STAGE 1.5: Advanced Keyword Boosting (Thai-specific)
                    # We use pythainlp word_tokenize for precise keyword matching if available
                    if HAS_PYTHAINLP:
                        target_words = set(word_tokenize(query.lower(), keep_whitespace=False))
                        # Filter out stop words or tiny words
                        target_words = {w for w in target_words if len(w) > 1}
                        
                        doc_words = set(word_tokenize(doc.lower(), keep_whitespace=False))
                        matches = target_words.intersection(doc_words)
                        
                        if target_words:
                            match_ratio = len(matches) / len(target_words)
                            if match_ratio > 0:
                                # Stronger Thai Boost: dist 0.0 means 100% relevance
                                boost = min(dist, match_ratio * 0.9)
                                dist = max(0.01, dist - boost)
                                print(f"[RAG-SYSTEM] 🔥 Thai Boost: Match ratio {match_ratio:.2f}. Dist {results['distances'][0][i]:.4f} -> {dist:.4f}")
                    else:
                        # Simple keyword matching fallback
                        query_words = [w for w in query.lower().split() if len(w) > 1]
                        foundCount = sum(1 for w in query_words if w in doc.lower())
                        if foundCount > 0:
                            boost = min(0.5, foundCount / len(query_words) * 0.6) if query_words else 0
                            dist = max(0.01, dist - boost)

                    if dist < 1.8: # Even more generous for user-selected files
                        documents.append({
                            "content": doc,
                            "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                            "distance": dist
                        })
            
            # STAGE 2: Keyword Fallback (Manual check if semantic failed)
            if not documents and query:
                print(f"[RAG-SYSTEM] ⚠️ Semantic search weak for '{query}'. Trying keyword fallback...")
                all_chunks = collection.get(where=where_filter, limit=50) # Get a pool
                query_words = set(query.lower().split())
                for i, doc in enumerate(all_chunks.get("documents", [])):
                    doc_lower = doc.lower()
                    if any(word in doc_lower for word in query_words if len(word) > 2):
                        documents.append({
                            "content": doc,
                            "metadata": all_chunks["metadatas"][i],
                            "distance": 0.4 # Higher score for keyword match (maps to ~85%)
                        })
                        if len(documents) >= n_results: break
            
            # STAGE 3: Absolute Fallback - Just give some context if we REALLY have nothing
            if not documents:
                print(f"[RAG-SYSTEM] 🆘 All searches failed. Pulling introductory chunks as fallback.")
                intro_chunks = collection.get(where=where_filter, limit=5)
                for i, doc in enumerate(intro_chunks.get("documents", [])):
                    documents.append({
                        "content": doc,
                        "metadata": intro_chunks["metadatas"][i],
                        "distance": 0.6 # Moderate score for "best effort" context
                    })
            
            print(f"[RAG-SYSTEM] ✅ Successfully retrieved {len(documents)} context chunks.")
            return documents
        except Exception as e:
            print(f"[RAG-SYSTEM] ❌ Vector search error: {e}")
            return []
    
    @classmethod
    async def delete_document(cls, vector_id: str):
        """Delete a document from ChromaDB"""
        if not vector_id or ":" not in vector_id:
            return
        
        client = cls.get_client()
        if client is None:
            return
        
        collection_name, file_id = vector_id.split(":", 1)
        
        try:
            collection = client.get_collection(collection_name)
            collection.delete(where={"file_id": file_id})
        except Exception as e:
            print(f"Delete error: {e}")