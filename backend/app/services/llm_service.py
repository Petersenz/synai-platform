import io
import json
import httpx
from typing import List, Dict, Any, Optional
from app.config import settings
from google import genai
from app.models.llm_provider import ProviderType


class LLMService:
    @classmethod
    async def generate_response(
        cls,
        message: str,
        provider: Any,  # LLMProvider model instance
        model: str,
        context: List[str] = None,
        history: List[Dict[str, str]] = None,
        file_name: str = None,
        images: List[Dict[str, Any]] = None # List of {"data": bytes, "mime_type": str}
    ) -> Dict[str, Any]:
        """Generate response using the specified provider and model"""
        
        # Build prompt
        system_prompt = f"""You are SynAI, a versatile and highly capable AI assistant designed to help with any task—from coding and creative writing to analyzing complex documents.

        CORE OPERATING PRINCIPLES:
        1. VERSATILITY & CLARITY: Be a helpful companion. Provide well-structured, logical, and easy-to-read answers. Use Markdown to enhance readability:
           - Use BOLD headings (###) for sections.
           - Use bullet points or numbered lists.
           - Use BOLD text for key terms.
           - Use tables for comparisons.
           - Use blockquotes (>) for emphasis.
           - Add double line breaks for a clean layout.
        2. CONTEXT ADHERENCE: If 'DOCUMENT CONTEXT' is provided, use it as your primary source for specific questions.
        3. CITATION PROTOCOL (STRICT): 
           - Every factual reference from documents must be cited using: [ref:FileName|Page]
           - Use '|' to separate file and page. 
           - NEVER mention page numbers in plain text like "(Page 1)".
        4. TONE & PERSONA:
           - Maintain a helpful, professional yet friendly persona.
           - For THAI: Use natural language. CRITICAL: Use "ผม" and "ครับ" only. 
             NEVER use slashes like "ครับ/ค่ะ" or "ผม/ดิฉัน".
        5. LANGUAGE PARITY: Always respond in the exact same language used by the user.
        
        """
        
        # Add context from RAG or files
        context_section = ""
        if context:
            print(f">>> [LLM-SERVICE] 🧩 Injecting {len(context)} context chunks into prompt.", flush=True)
            context_section = "\n\n=== DOCUMENT CONTEXT ===\n"
            context_section += "\n---\n".join(context)
            context_section += "\n========================\n"
        else:
            print(">>> [LLM-SERVICE] ⚠️ WARNING: No document context received in generate_response.", flush=True)
        
        # Add history
        history_section = ""
        if history:
            history_section = "\n\n=== RECENT CONVERSATION HISTORY ===\n"
            for msg in history[-8:]: # Increased history window
                role = "User" if msg["role"] == "user" else "Assistant"
                history_section += f"{role}: {msg['content']}\n"
            history_section += "==================================\n"
        
        full_prompt = f"{system_prompt}{context_section}{history_section}\n\nUSER QUESTION: {message}\n\nSYNAI ASSISTANT:"
        
        # Estimate tokens (rough estimate)
        prompt_tokens = len(full_prompt) // 4
        
        try:
            if provider.provider_type == ProviderType.GOOGLE:
                return await cls._generate_google(provider.api_key, model, full_prompt, prompt_tokens, images)
            
            elif provider.provider_type in [ProviderType.OPENAI, ProviderType.GROQ, ProviderType.TOGETHER, ProviderType.MISTRAL, ProviderType.CUSTOM, ProviderType.ZAI]:
                # Many providers use OpenAI-compatible API
                # For CUSTOM type, we strictly use the user's provided api_base_url
                base_url = provider.api_base_url or cls._get_default_base_url(provider.provider_type)
                
                if not base_url and provider.provider_type == ProviderType.CUSTOM:
                    raise Exception("Custom provider requires a Base URL")
                    
                return await cls._generate_openai_compatible(
                    api_key=provider.api_key,
                    base_url=base_url,
                    model=model,
                    prompt=full_prompt,
                    prompt_tokens=prompt_tokens,
                    images=images
                )
            
            elif provider.provider_type == ProviderType.ANTHROPIC:
                return await cls._generate_anthropic(provider.api_key, model, full_prompt, prompt_tokens, images)
            
            else:
                raise Exception(f"Provider {provider.provider_type} is not yet implemented in LLMService")

        except Exception as e:
            error_text = str(e)
            return {
                "content": f"❌ **Error**: {error_text}",
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": 0,
                "total_tokens": prompt_tokens
            }

    @staticmethod
    def _get_default_base_url(provider_type: ProviderType) -> str:
        urls = {
            ProviderType.OPENAI: "https://api.openai.com/v1",
            ProviderType.GROQ: "https://api.groq.com/openai/v1",
            ProviderType.TOGETHER: "https://api.together.xyz/v1",
            ProviderType.MISTRAL: "https://api.mistral.ai/v1",
            ProviderType.ZAI: "https://api.z.ai/api/paas/v4",
        }
        return urls.get(provider_type, "")

    @staticmethod
    async def _generate_google(api_key: str, model: str, prompt: str, prompt_tokens: int, images: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate content using Google Gemini"""
        try:
            client = genai.Client(api_key=api_key)
            
            contents = [prompt]
            if images:
                for img in images:
                    from google.genai import types
                    contents.append(types.Part.from_bytes(data=img["data"], mime_type=img["mime_type"]))
            
            response = client.models.generate_content(
                model=model,
                contents=contents
            )
            response_text = response.text
            completion_tokens = len(response_text) // 4
            return {
                "content": response_text,
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            }
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                # Format to a nicer message
                return {
                    "content": "⚠️ **Quota Exceeded (Google AI)**: ขออภัยครับ โควตาการใช้งานฟรีของ Google AI ของคุณเต็มแล้วในขณะนี้ โปรดรอสักครู่ (ประมาณ 1 นาที) หรือลองเปลี่ยนไปใช้ Provider รายอื่นในเมนูเลือก Model ด้านบนครับ",
                    "model": model,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": 0,
                    "total_tokens": prompt_tokens,
                    "error_type": "quota_exceeded"
                }
            raise e

    @staticmethod
    async def _generate_openai_compatible(api_key: str, base_url: str, model: str, prompt: str, prompt_tokens: int, images: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate content using OpenAI-compatible APIs"""
        async with httpx.AsyncClient() as client:
            
            messages_content = [{"type": "text", "text": prompt}]
            
            if images:
                import base64
                for img in images:
                    base64_image = base64.b64encode(img["data"]).decode('utf-8')
                    messages_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{img['mime_type']};base64,{base64_image}"
                        }
                    })

            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": messages_content}],
                    "temperature": 0.7
                },
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            
            return {
                "content": content,
                "model": model,
                "prompt_tokens": usage.get("prompt_tokens", prompt_tokens),
                "completion_tokens": usage.get("completion_tokens", len(content) // 4),
                "total_tokens": usage.get("total_tokens", prompt_tokens + (len(content) // 4))
            }

    @staticmethod
    async def _generate_anthropic(api_key: str, model: str, prompt: str, prompt_tokens: int, images: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate content using Anthropic Claude"""
        async with httpx.AsyncClient() as client:
            
            messages_content = [{"type": "text", "text": prompt}]
            
            if images:
                import base64
                for img in images:
                    base64_image = base64.b64encode(img["data"]).decode('utf-8')
                    # Anthropic uses a specific media type mapping
                    media_type = img["mime_type"]
                    if media_type == "image/jpg": media_type = "image/jpeg"
                    
                    messages_content.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64_image
                        }
                    })

            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": model,
                    "max_tokens": 4096,
                    "messages": [{"role": "user", "content": messages_content}]
                },
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()
            
            content = data["content"][0]["text"]
            usage = data.get("usage", {})
            
            return {
                "content": content,
                "model": model,
                "prompt_tokens": usage.get("input_tokens", prompt_tokens),
                "completion_tokens": usage.get("output_tokens", len(content) // 4),
                "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
            }

    @classmethod
    async def extract_file_content(
        cls,
        content: bytes,
        filename: str,
        mime_type: str
    ) -> Optional[str]:
        """Extract text content from uploaded file"""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        try:
            if mime_type and mime_type.startswith("text/"):
                return content.decode("utf-8")
            if ext == "txt":
                return content.decode("utf-8")
            
            if ext == "pdf" or (mime_type and "pdf" in mime_type):
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
            
            if ext == "docx":
                from docx import Document
                doc = Document(io.BytesIO(content))
                text = ""
                for para in doc.paragraphs:
                    text += para.text + "\n"
                return text
            
            if ext in ["png", "jpg", "jpeg", "webp"] or (mime_type and mime_type.startswith("image/")):
                return f"[Image File: {filename}] - Image analysis is processed multi-modally."

            return f"[File: {filename}] - Unsupported file type"
        except Exception as e:
            return f"[File: {filename}] - Error: {str(e)}"