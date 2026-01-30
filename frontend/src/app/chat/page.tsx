"use client";

import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { llmAPI } from "@/lib/api";
import { ChatMessage, ChatSession, FileItem } from "@/types";
import { Plus, MessageSquare, Loader2, MoreVertical, Edit2, Trash2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Session management state
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Confirmation modal state
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
        isLoading?: boolean;
    }>({
        isOpen: false,
        title: "",
        description: "",
        onConfirm: () => { },
    });

    useEffect(() => {
        loadSessions();
    }, []);

    // Close session menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        if (activeMenuId) {
            window.addEventListener("click", handleClickOutside);
        }
        return () => window.removeEventListener("click", handleClickOutside);
    }, [activeMenuId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const loadSessions = async () => {
        try {
            const response = await llmAPI.getSessions();
            const data = response.data;
            if (Array.isArray(data)) {
                setSessions(data);
            } else if (data?.sessions && Array.isArray(data.sessions)) {
                setSessions(data.sessions);
            } else {
                setSessions([]);
            }
        } catch (error) {
            console.error("Failed to load sessions:", error);
            setSessions([]);
        }
    };

    const loadSessionMessages = async (sessionId: string) => {
        setIsLoadingMessages(true);
        try {
            const response = await llmAPI.getSessionMessages(sessionId);
            const data = response.data;

            if (Array.isArray(data)) {
                setMessages(
                    data.map((msg: any) => ({
                        id: msg.id,
                        role: msg.role,
                        content: msg.content,
                        tokens_used: msg.tokens_used || 0,
                        citations: msg.citations,
                        created_at: msg.created_at,
                    }))
                );
            } else {
                setMessages([]);
            }
        } catch (error: any) {
            console.error("Failed to load messages:", error);
            toast.error("Failed to load conversation");
            setMessages([]);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // ✅ Helper function สำหรับ API calls ด้วย fetch
    const apiCall = async (url: string, options: RequestInit = {}) => {
        const token = localStorage.getItem("token");
        const response = await fetch(url, {
            ...options,
            headers: {
                "Authorization": `Bearer ${token}`,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: "Request failed" }));
            throw new Error(error.detail || "Request failed");
        }

        return response.json();
    };

    const handleSend = async (
        message: string,
        options?: { selectedFiles?: FileItem[]; uploadedFiles?: File[] }
    ) => {
        const { selectedFiles = [], uploadedFiles = [] } = options || {};
        const fileIds = selectedFiles.map(f => f.id);

        if (!message.trim() && fileIds.length === 0 && uploadedFiles.length === 0) {
            return;
        }

        // สร้าง user message
        let userContent = message;
        if (selectedFiles.length > 0) {
            userContent += `\n\n📎 Attached: ${selectedFiles.map((f) => f.original_filename).join(", ")}`;
        }
        if (uploadedFiles.length > 0) {
            userContent += `\n\n📤 Uploaded: ${uploadedFiles.map((f) => f.name).join(", ")}`;
        }

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: userContent,
            tokens_used: 0,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);
        setUploadProgress(0);
        setLoadingStatus("Initializing...");

        try {
            let data;

            if (uploadedFiles.length > 0) {
                setLoadingStatus(uploadedFiles.length > 1 ? `Uploading ${uploadedFiles.length} files...` : `Uploading ${uploadedFiles[0].name}...`);
                const formData = new FormData();
                formData.append("message", userContent || "Please analyze these files.");

                // Add all files
                uploadedFiles.forEach(file => {
                    formData.append("files", file);
                });

                if (fileIds.length > 0) {
                    formData.append("file_ids", JSON.stringify(fileIds));
                }

                if (currentSessionId) {
                    formData.append("session_id", currentSessionId);
                }
                if (selectedProviderId) {
                    formData.append("provider_id", selectedProviderId.toString());
                }
                if (selectedModel) {
                    formData.append("model", selectedModel);
                }

                const response = await llmAPI.chatWithFile(formData, (percent) => {
                    setUploadProgress(percent);
                    if (percent === 100) {
                        setLoadingStatus(uploadedFiles.length > 1 ? "Processing & indexing documents..." : "Processing & indexing document...");
                    }
                });
                data = response.data;

            } else {
                setLoadingStatus(fileIds.length > 0 ? "Searching relevant documents..." : "AI is thinking...");
                const response = await llmAPI.chat(
                    userContent,
                    currentSessionId || undefined,
                    fileIds.length > 0 ? fileIds : undefined,
                    selectedProviderId || undefined,
                    selectedModel || undefined
                );
                data = response.data;
            }

            setLoadingStatus("Generating response...");

            // Update session
            if (!currentSessionId && data.session_id) {
                setCurrentSessionId(data.session_id);
                loadSessions();
            }

            // Add AI message
            const aiMessage: ChatMessage = {
                id: data.message_id,
                role: "assistant",
                content: data.content,
                tokens_used: data.tokens_used,
                citations: data.citations,
                created_at: data.created_at,
            };
            setMessages((prev) => [...prev, aiMessage]);

        } catch (error: any) {
            console.error("Chat error:", error);
            const errorMsg = error.response?.data?.detail || error.message || "Failed to send message";
            toast.error(errorMsg);
            setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        } finally {
            setIsLoading(false);
            setLoadingStatus(null);
            setUploadProgress(0);
        }
    };

    const startNewChat = () => {
        setMessages([]);
        setCurrentSessionId(null);
    };

    const selectSession = async (sessionId: string) => {
        if (sessionId === currentSessionId) return;
        setCurrentSessionId(sessionId);
        await loadSessionMessages(sessionId);
        setIsSessionSidebarOpen(false); // Close on mobile after selection
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        setActiveMenuId(null);

        setConfirmConfig({
            isOpen: true,
            title: "Delete Chat Submission",
            description: "Are you sure you want to delete this chat? This action cannot be undone and all messages will be lost.",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                try {
                    await llmAPI.deleteSession(sessionId);
                    toast.success("Chat deleted successfully");
                    if (sessionId === currentSessionId) {
                        startNewChat();
                    }
                    loadSessions();
                } catch (error) {
                    toast.error("Failed to delete chat");
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
    };

    const handleRenameSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSessionId || !newTitle.trim()) return;

        setIsRenaming(true);
        try {
            await llmAPI.renameSession(editingSessionId, newTitle);
            toast.success("Chat renamed");
            setEditingSessionId(null);
            loadSessions();
        } catch (error) {
            toast.error("Failed to rename chat");
        } finally {
            setIsRenaming(false);
        }
    };

    const openRenameModal = (e: React.MouseEvent, session: ChatSession) => {
        e.stopPropagation();
        setEditingSessionId(session.id);
        setNewTitle(session.title || "New Chat");
        setActiveMenuId(null);
    };

    const [isSessionSidebarOpen, setIsSessionSidebarOpen] = useState(false);
    const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] = useState(false); // Desktop collapse state

    return (
        <MainLayout>
            <div className="flex h-screen max-h-screen relative overflow-hidden">
                {/* Mobile Overlay */}
                <AnimatePresence>
                    {isSessionSidebarOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSessionSidebarOpen(false)}
                            className="fixed inset-0 bg-black/50 z-20 md:hidden"
                        />
                    )}
                </AnimatePresence>

                {/* Sessions Sidebar */}
                <div
                    className={cn(
                        "border-r border-app-border bg-app-card p-4 flex flex-col",
                        "fixed md:static inset-y-0 left-0 z-30",
                        "transition-all duration-300",
                        // Mobile: conditional
                        isSessionSidebarOpen ? "translate-x-0" : "-translate-x-full",
                        // Desktop: always visible, collapsible width
                        "md:translate-x-0",
                        isSessionSidebarCollapsed ? "md:w-16" : "md:w-64",
                        "w-64" // Mobile width
                    )}
                >
                    {/* Collapse Toggle Button (Desktop Only) */}
                    <button
                        onClick={() => setIsSessionSidebarCollapsed(!isSessionSidebarCollapsed)}
                        className="hidden md:flex absolute -right-3 top-6 w-6 h-6 rounded-full bg-app-card border border-app-border items-center justify-center hover:bg-app-card-hover transition-colors z-10"
                        title={isSessionSidebarCollapsed ? "Expand" : "Collapse"}
                    >
                        {isSessionSidebarCollapsed ? (
                            <svg className="w-3 h-3 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        ) : (
                            <svg className="w-3 h-3 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={startNewChat}
                        className={cn(
                            "w-full flex items-center gap-2 rounded-lg bg-brand-red text-white font-medium hover:bg-brand-red-dark transition-colors mb-4",
                            isSessionSidebarCollapsed ? "justify-center p-3" : "px-4 py-3"
                        )}
                        title="New Chat"
                    >
                        <Plus className="w-5 h-5" />
                        {!isSessionSidebarCollapsed && <span className="hidden sm:inline">New Chat</span>}
                    </button>

                    <div className="flex-1 overflow-y-auto space-y-1">
                        {sessions.length === 0 ? (
                            !isSessionSidebarCollapsed && (
                                <p className="text-gray-500 text-sm text-center py-4">No sessions yet</p>
                            )
                        ) : (
                            sessions.map((session) => (
                                <div key={session.id} className="relative group/item">
                                    <button
                                        onClick={() => selectSession(session.id)}
                                        className={cn(
                                            "w-full flex items-center gap-2 rounded-lg text-left transition-colors",
                                            isSessionSidebarCollapsed ? "justify-center p-2" : "px-3 py-2 pr-10",
                                            currentSessionId === session.id
                                                ? "bg-brand-red/10 text-brand-red"
                                                : "text-app-text-muted hover:bg-app-card-hover hover:text-app-text"
                                        )}
                                        title={isSessionSidebarCollapsed ? (session.title || "New Chat") : undefined}
                                    >
                                        <MessageSquare className="w-4 h-4 shrink-0" />
                                        {!isSessionSidebarCollapsed && (
                                            <span className="truncate text-sm">{session.title || "New Chat"}</span>
                                        )}
                                    </button>

                                    {!isSessionSidebarCollapsed && (
                                        <div className={cn(
                                            "absolute right-1 top-1/2 -translate-y-1/2 transition-opacity z-10",
                                            activeMenuId === session.id ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
                                        )}>
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === session.id ? null : session.id);
                                                    }}
                                                    className="p-1 rounded hover:bg-app-card-hover text-app-text-muted hover:text-app-text"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>

                                                {activeMenuId === session.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-32 bg-app-card border border-app-border rounded-lg shadow-xl z-50 overflow-hidden">
                                                        <button
                                                            onClick={(e) => openRenameModal(e, session)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text-secondary hover:bg-app-card-hover hover:text-app-text"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            Rename
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteSession(e, session.id)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-red hover:bg-brand-red/10"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-app-bg w-full md:w-auto min-h-0">
                    {/* Model Selector & Header */}
                    <div className="p-4 pl-20 md:pl-4 border-b border-app-border flex items-center justify-between bg-app-card/50 backdrop-blur-md sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            {/* Mobile Toggle Button */}
                            <button
                                onClick={() => setIsSessionSidebarOpen(true)}
                                className="p-2 rounded-lg bg-brand-red/10 text-brand-red md:hidden hover:bg-brand-red/20 transition-colors"
                                title="Chat History"
                            >
                                <MessageSquare className="w-5 h-5" />
                            </button>
                            <ModelSelector
                                onModelChange={(providerId, model) => {
                                    setSelectedProviderId(providerId);
                                    setSelectedModel(model);
                                }}
                            />
                        </div>
                        <ThemeToggle />
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 space-y-4 md:space-y-6 min-h-0 scrollbar-thin">
                        {isLoadingMessages ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="flex items-center gap-3 text-app-text-muted">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Loading conversation...</span>
                                </div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-brand-red/10 flex items-center justify-center mx-auto mb-4">
                                        <MessageSquare className="w-8 h-8 text-brand-red" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-app-text mb-2">Start a Conversation</h2>
                                    <p className="text-app-text-muted mb-4">Send a message to begin chatting with AI</p>
                                    <div className="flex flex-wrap justify-center gap-2 text-sm">
                                        <span className="px-3 py-1 bg-app-card border border-app-border rounded-full text-app-text-muted">
                                            💬 Ask questions
                                        </span>
                                        <span className="px-3 py-1 bg-app-card border border-app-border rounded-full text-app-text-muted">
                                            📎 Attach files
                                        </span>
                                        <span className="px-3 py-1 bg-app-card border border-app-border rounded-full text-app-text-muted">
                                            📄 Analyze documents
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            messages.map((message) => <ChatBubble key={message.id} message={message} />)
                        )}

                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col gap-2 max-w-md"
                            >
                                <div className="flex items-center gap-3 text-app-text-secondary bg-app-card/50 px-4 py-3 rounded-2xl border border-app-border">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-brand-red rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-1.5 h-1.5 bg-brand-red rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-1.5 h-1.5 bg-brand-red rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                    <span className="text-sm font-medium">{loadingStatus || "AI is working..."}</span>
                                </div>

                                {uploadProgress > 0 && uploadProgress < 100 && (
                                    <div className="w-full px-2">
                                        <div className="flex justify-between text-[10px] text-app-text-muted mb-1 px-1">
                                            <span>Upload progress</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full bg-app-card border border-app-border rounded-full h-1.5 overflow-hidden shadow-inner">
                                            <motion.div
                                                className="bg-brand-red h-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <ChatInput onSend={handleSend} isLoading={isLoading} />
                </div>
                {/* Rename Modal */}
                <AnimatePresence>
                    {editingSessionId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setEditingSessionId(null)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-md bg-app-card border border-app-border rounded-2xl shadow-2xl p-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-app-text">Rename Chat</h3>
                                    <button
                                        onClick={() => setEditingSessionId(null)}
                                        className="p-1 rounded-lg hover:bg-app-card-hover text-app-text-muted hover:text-app-text transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleRenameSession} className="space-y-4">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:ring-2 focus:ring-brand-red/50 transition-all font-medium"
                                        placeholder="Enter new title..."
                                    />
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setEditingSessionId(null)}
                                            className="px-4 py-2 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-card-hover transition-colors font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isRenaming || !newTitle.trim()}
                                            className="px-6 py-2 rounded-xl bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-2"
                                        >
                                            {isRenaming ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <Check className="w-5 h-5" />
                                                    Save Changes
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Confirmation Modal */}
                <ConfirmModal
                    isOpen={confirmConfig.isOpen}
                    onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={confirmConfig.onConfirm}
                    title={confirmConfig.title}
                    description={confirmConfig.description}
                    isLoading={confirmConfig.isLoading}
                    confirmText="Delete Chat"
                    variant="danger"
                />
            </div>
        </MainLayout>
    );
}
