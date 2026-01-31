import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle 401 errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== "undefined") {
                const currentPath = window.location.pathname;
                if (currentPath !== "/login" && currentPath !== "/register") {
                    localStorage.removeItem("token");
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (username: string, password: string) =>
        api.post("/api/auth/login", new URLSearchParams({ username, password }), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }),
    register: (username: string, email: string, password: string) =>
        api.post("/api/auth/register", { username, email, password }),
    me: () => api.get("/api/auth/me"),
    changePassword: (oldPassword: string, newPassword: string) =>
        api.post("/api/auth/change-password", { old_password: oldPassword, new_password: newPassword }),
    // API Keys
    getApiKeys: () => api.get("/api/auth/api-keys"),
    createApiKey: (name: string, expiresDays: number = 30) =>
        api.post("/api/auth/api-keys", { name, expires_in_days: expiresDays }),
    rotateApiKey: (keyId: string) =>
        api.post(`/api/auth/api-keys/${keyId}/rotate`),
    revokeApiKey: (keyId: string, permanent: boolean = false) =>
        api.delete(`/api/auth/api-keys/${keyId}${permanent ? '?permanent=true' : ''}`),
};

// LLM API
export const llmAPI = {
    chat: (message: string, sessionId?: string, fileIds?: string[], providerId?: number, model?: string) =>
        api.post("/api/llm/chat", {
            message,
            session_id: sessionId,
            file_ids: fileIds,
            provider_id: providerId,
            model: model,
            use_rag: true // Explicitly enable RAG
        }),
    chatWithFile: (formData: FormData, onProgress?: (percent: number) => void) =>
        api.post("/api/llm/chat-with-file", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        }),
    getSessions: () => api.get("/api/llm/sessions"),
    getSessionMessages: (sessionId: string) => api.get(`/api/llm/sessions/${sessionId}/messages`),
    deleteSession: (sessionId: string) => api.delete(`/api/llm/sessions/${sessionId}`),
    renameSession: (sessionId: string, title: string) => api.patch(`/api/llm/sessions/${sessionId}`, { title }),
    getUsage: () => api.get("/api/llm/usage"),
    getUsageChart: (hours: number = 24, model?: string) =>
        api.get("/api/llm/usage/chart", { params: { range_hours: hours, model } }),
};

// Files API
export const filesAPI = {
    upload: (file: File, onProgress?: (percent: number) => void) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post("/api/files/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });
    },
    list: () => api.get("/api/files/"),
    download: (fileId: string) => api.get(`/api/files/${fileId}/download`, { responseType: "blob" }),
    view: (fileId: string) => `${API_URL}/api/files/${fileId}/view`,
    delete: (fileId: string) => api.delete(`/api/files/${fileId}`),
};

// Monitoring API
export const monitoringAPI = {
    dashboard: () => api.get("/api/monitoring/dashboard"),
    events: (skip: number = 0, limit: number = 10) => api.get(`/api/monitoring/events?skip=${skip}&limit=${limit}`),
    security: (skip: number = 0, limit: number = 5) => api.get(`/api/monitoring/security?skip=${skip}&limit=${limit}`),
};

export default api;
