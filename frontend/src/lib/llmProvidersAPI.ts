import axios from "axios";

// ใช้ Base URL ตัวเดียวกับ lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const API_URL = `${BASE_URL}/api`;

export interface LLMProvider {
    id: number;
    user_id: string; // Changed to string for UUID
    provider_type: "openai" | "anthropic" | "google" | "groq" | "cohere" | "mistral" | "together" | "custom" | "zai";
    provider_name: string;
    api_key: string;
    api_key_masked: string;
    api_base_url?: string;
    default_model?: string;
    available_models?: string[];
    is_active: boolean;
    is_default: boolean;
    max_requests_per_minute: number;
    max_tokens_per_request: number;
    status: string;
    error_message?: string;
    created_at: string;
    updated_at?: string;
    last_used_at?: string;
}

export interface CreateLLMProvider {
    provider_type: string;
    provider_name: string;
    api_key: string;
    api_base_url?: string;
    default_model?: string;
    is_active?: boolean;
    is_default?: boolean;
    max_requests_per_minute?: number;
    max_tokens_per_request?: number;
}

export interface UpdateLLMProvider {
    provider_name?: string;
    api_key?: string;
    api_base_url?: string;
    default_model?: string;
    is_active?: boolean;
    is_default?: boolean;
    max_requests_per_minute?: number;
    max_tokens_per_request?: number;
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    context_length: number;
    supports_vision: boolean;
    supports_function_calling: boolean;
}

export interface TestConnectionRequest {
    provider_type: string;
    api_key: string;
    api_base_url?: string;
}

export interface TestConnectionResponse {
    success: boolean;
    message: string;
    available_models?: string[];
    error?: string;
}

export const llmProvidersAPI = {
    // Get all providers
    getProviders: async (activeOnly: boolean = false): Promise<LLMProvider[]> => {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_URL}/llm-providers`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { active_only: activeOnly }
        });
        return response.data;
    },

    // Get default provider
    getDefaultProvider: async (): Promise<LLMProvider> => {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_URL}/llm-providers/default`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    // Get specific provider
    getProvider: async (providerId: number): Promise<LLMProvider> => {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_URL}/llm-providers/${providerId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    // Create provider
    createProvider: async (data: CreateLLMProvider): Promise<LLMProvider> => {
        const token = localStorage.getItem("token");
        const response = await axios.post(`${API_URL}/llm-providers`, data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    // Update provider
    updateProvider: async (providerId: number, data: UpdateLLMProvider): Promise<LLMProvider> => {
        const token = localStorage.getItem("token");
        const response = await axios.put(`${API_URL}/llm-providers/${providerId}`, data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    // Delete provider
    deleteProvider: async (providerId: number): Promise<void> => {
        const token = localStorage.getItem("token");
        await axios.delete(`${API_URL}/llm-providers/${providerId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
    },

    // Test connection
    testConnection: async (data: TestConnectionRequest): Promise<TestConnectionResponse> => {
        const response = await axios.post(`${API_URL}/llm-providers/test-connection`, data);
        return response.data;
    },

    // Get available models for provider type
    getProviderModels: async (providerType: string): Promise<ModelInfo[]> => {
        const response = await axios.get(`${API_URL}/llm-providers/models/${providerType}`);
        return response.data;
    }
};
