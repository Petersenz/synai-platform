import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/types";
import { authAPI } from "@/lib/api";

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

// Helper to set cookie
const setCookie = (name: string, value: string, days: number = 7) => {
    if (typeof document !== "undefined") {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
    }
};

// Helper to delete cookie
const deleteCookie = (name: string) => {
    if (typeof document !== "undefined") {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,

            login: async (username: string, password: string) => {
                set({ isLoading: true });
                try {
                    const response = await authAPI.login(username, password);
                    const { access_token, user } = response.data;

                    // Save to localStorage และ Cookie
                    localStorage.setItem("token", access_token);
                    setCookie("token", access_token);

                    set({ token: access_token, user, isAuthenticated: true, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            register: async (username: string, email: string, password: string) => {
                set({ isLoading: true });
                try {
                    await authAPI.register(username, email, password);
                    set({ isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                localStorage.removeItem("token");
                deleteCookie("token");
                set({ user: null, token: null, isAuthenticated: false });
                window.location.href = "/login";
            },

            checkAuth: async () => {
                const token = localStorage.getItem("token");
                if (!token) {
                    set({ isAuthenticated: false });
                    return;
                }
                try {
                    const response = await authAPI.me();
                    setCookie("token", token); // Refresh cookie
                    set({ user: response.data, token, isAuthenticated: true });
                } catch {
                    localStorage.removeItem("token");
                    deleteCookie("token");
                    set({ user: null, token: null, isAuthenticated: false });
                }
            },
        }),
        {
            name: "auth-storage",
            partialize: (state) => ({ token: state.token }),
        }
    )
);
