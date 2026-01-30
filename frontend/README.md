# 🎨 SynAI Frontend Interface

This is the frontend layer of the **SynAI Platform**, built with a focus on high-performance, dark-mode aesthetics, and real-time AI interactions.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16.0.1 (App Router)
- **Styling**: Tailwind CSS v4 (with custom brand themes)
- **Animations**: Framer Motion for smooth transitions and micro-interactions
- **Charts**: Recharts for visualizing LLM usage and token metrics
- **State Management**: React Hooks & Context API
- **Icons**: Lucide React

---

## 🚀 Key Features

- **Real-time Chat Interface**: Built with streaming support and syntax highlighting (Markdown).
- **Interactive Citations**: Visual footnote-style citations with tooltips directly from the RAG engine.
- **FinOps Dashboard**: A comprehensive monitoring view of AI usage across the platform.
- **Dynamic File Picker**: Integration with the backend File Manager for contextual AI chatting.
- **Responsive Management**: Full Dark/Light mode support and mobile-first design.

---

## 📂 Project Structure

- `/src/app`: Routes and Page components
- `/src/components`: Reusable UI components (Shared, Layout, Chat, Settings)
- `/src/lib`: API clients and utility functions
- `/src/hooks`: Custom React hooks for authentication and data fetching

---

## ⚙️ Development

First, install dependencies:

```bash
npm install
```

Run the development server:

```
npm run dev
```

The interface will be available at

http://localhost:3000.

---
