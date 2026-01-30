export interface User {
    id: string;
    username: string;
    email: string;
    is_active: boolean;
    created_at: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    tokens_used: number;
    citations?: Citation[];
    created_at: string;
}

export interface Citation {
    source: string;
    file_id?: string;
    page?: string;
    content: string;
    relevance_score: number;
}

export interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
}

export interface FileItem {
    id: string;
    filename: string;
    original_filename: string;
    file_type: string;
    file_size: number;
    mime_type: string;
    is_processed: boolean;
    created_at: string;
}

export interface TokenUsage {
    period: string;
    start_date: string;
    end_date: string;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    request_count: number;
}

export interface DashboardStats {
    total_events: number;
    total_security_events: number;
    total_llm_requests: number;
    total_tokens_used: number;
    events_today: number;
    security_alerts: number;
    auth_status: string;
    rate_limit_status: string;
    scan_status: string;
}
