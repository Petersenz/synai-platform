from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from typing import Set
import re

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware implementing OWASP recommendations
    """
    
    # Simple rate limiting (in production use Redis)
    request_counts: dict = {}
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Security Headers
        response = await call_next(request)
        
        # OWASP Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # 2. Remove sensitive headers
        if "Server" in response.headers:
            del response.headers["Server"]
        
        return response
    
    def _is_sql_injection(self, value: str) -> bool:
        """Simple SQL injection detection"""
        patterns = [
            r"(\%27)|(\')|(\-\-)|(\%23)|(#)",
            r"((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))",
            r"\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))",
            r"((\%27)|(\'))union",
        ]
        for pattern in patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    def _is_xss(self, value: str) -> bool:
        """Simple XSS detection"""
        patterns = [
            r"<script[^>]*>",
            r"javascript:",
            r"on\w+\s*=",
            r"<iframe",
            r"<object",
        ]
        for pattern in patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False