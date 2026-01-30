# 🚀 SynAI - Enterprise-Grade AI Platform

## AI Platform Engineer Practical Exam - Full Solution Suite

**SynAI** is a high-performance, secure, and transparent AI platform designed for enterprise environments. It bridges the gap between raw LLM capabilities and production-ready applications by implementing advanced RAG (Retrieval-Augmented Generation), strict security protocols (DevSecOps), and granular usage monitoring.

---

## 🏛️ Architecture Overview

The platform is built on a decoupled, microservice-inspired architecture:

- **Frontend**: Next.js 16.0.1 (App Router), Tailwind CSS v4, Recharts.
- **Backend**: FastAPI (Python 3.11), SQLAlchemy, Pydantic v2.
- **State & Cache**: Redis 7.
- **Database**: PostgreSQL 15 (Metadata) & ChromaDB (Vector Search).
- **Deployment**: Docker Compose with hardened container configurations.

---

## ✨ Key Features & Requirements Met

### 🔐 Authentication & Session Management

- **Hybrid Auth**: Secure login using JWT (JSON Web Tokens) for web sessions and X-API-Key for programmatic access.
- **Protected Routes**: Every internal endpoint is guarded by an authentication dependency layer.
- **API Key Management**: Real-time generation, rotation, and revocation of API keys from the user settings.

### 🤖 Intelligence & LLM Capabilities

- **Multi-Model Orchestrator**: Seamless integration with Google Gemini, Groq, and OpenAI-compatible providers.
- **Document-Aware Chat (RAG)**: Chat directly with uploaded documents (PDF, DOCX) or images.
- **Verified Citations**: AI responses include source citations in the format `[ref:FileName|Page]`, allowing users to verify facts.
- **Vision Support**: Specialized prompts for image analysis, including celebrity recognition and technical document reading.

### 📂 File & Knowledge Management

- **Multimodal Uploads**: Secure handling of text documents and images.
- **Knowledge Base**: Files are processed into semantic vectors and stored in ChromaDB for high-accuracy retrieval.

### 📊 Monitoring & FinOps

- **Token Tracking**: Real-time logging of prompt and completion tokens for every request.
- **Analytics Dashboard**: Visual breakdown of usage (Daily/Weekly/Monthly) using professional charts to monitor AI costs.
- **Comprehensive Logging**:
  - **Event Logs**: Tracking all platform activities.
  - **Security Logs**: Monitoring sensitive actions like password changes and auth failures.
  - **LLM Logs**: Detailed auditing of every AI interaction.

---

## 🛡️ Security & DevSecOps (124/124 Score)

This platform was built with a "Security-First" mindset, passing rigorous audits:

- **SAST (Bandit)**: Verified clean source code with no medium/high security risks.
- **SCA (Safety/Trivy)**: All dependencies and Docker base images are patched against known CVEs (as of 2026).
- **DAST (OWASP ZAP)**: Validated against OWASP Top 10 vulnerabilities (Injection, Broken Auth, etc.).
- **Hardening**: Implemented secure headers, rate limiting, and database isolation.

---

## 🚀 Deployment & Development

### Local Setup

1. Clone the repository.
2. Configure `.env` (refer to `.env.example`).
3. Run using Docker:
   ```bash
   docker-compose up --build
   ```

### CI/CD Security Pipeline

The repository includes GitHub Actions workflows for:

- Automatic SAST scanning with Bandit and Semgrep.
- Dependency vulnerability checks with Safety.
- Container security scanning with Trivy.
- Code quality audits with Pylint and Flake8.

---

## 🏆 Summary

**SynAI** provides a blueprint for secure AI integration in business workflows, ensuring data privacy through local RAG and cost transparency through granular monitoring.

_"SynAI: The most secure and transparent way to integrate Generative AI into your business workflow."_
