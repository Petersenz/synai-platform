"use client";

import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, checkAuth } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-app-bg">
                <div className="animate-spin w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full" />
            </div>
        );
    }

    const variants = {
        primary: "bg-brand-red hover:bg-brand-red-dark text-white shadow-lg shadow-brand-red/10",
        secondary: "bg-app-card hover:bg-app-card-hover text-app-text border border-app-border",
        ghost: "bg-transparent hover:bg-app-card text-app-text-secondary hover:text-app-text",
        danger: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/10",
    };

    return (
        <div className="flex bg-app-bg h-screen overflow-hidden transition-colors duration-300">
            <Sidebar />
            <main className="flex-1 w-full md:pl-64 h-full overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
