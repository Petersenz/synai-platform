"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare,
    FolderOpen,
    LayoutDashboard,
    Settings,
    LogOut,
    Sparkles,
    Menu,
    X,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useState, useEffect } from "react";
import Image from "next/image";

const menuItems = [
    { icon: MessageSquare, label: "Chat", href: "/chat" },
    { icon: FolderOpen, label: "Files", href: "/files" },
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuthStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={toggleMobileMenu}
                className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-app-card border border-app-border md:hidden"
            >
                {isMobileMenuOpen ? (
                    <X className="w-6 h-6 text-app-text" />
                ) : (
                    <Menu className="w-6 h-6 text-app-text" />
                )}
            </button>

            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeMobileMenu}
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 h-screen w-64 bg-app-card border-r border-app-border flex flex-col z-40",
                    "transition-transform duration-300",
                    // Mobile: slide in/out
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
                    // Desktop: always visible
                    "md:translate-x-0"
                )}
            >
                {/* Logo */}
                <div className="p-6 pl-14 md:pl-6 border-b border-app-border">
                    <Link href="/chat" className="flex items-center gap-3" onClick={closeMobileMenu}>
                        <div className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-lg flex items-center justify-center overflow-hidden shadow-sm border">
                            <Image
                                src="/logo.png"
                                alt="Logo"
                                width={40}
                                height={40}
                                className="object-cover"
                            />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-app-text">SynAI</h1>
                            <p className="text-xs text-app-text-muted">AI Platform</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href} onClick={closeMobileMenu}>
                                <motion.div
                                    whileHover={{ x: 4 }}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                                        isActive
                                            ? "bg-brand-red/10 text-brand-red border border-brand-red/20"
                                            : "text-app-text-secondary hover:bg-app-card-hover hover:text-app-text"
                                    )}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </motion.div>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-app-border">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-app-bg">
                        <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center shrink-0">
                            <span className="text-brand-red font-bold">
                                {user?.username?.charAt(0).toUpperCase() || "U"}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-app-text truncate">{user?.username}</p>
                            <p className="text-xs text-app-text-muted truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 rounded-lg hover:bg-app-card-hover text-app-text-muted hover:text-red-500 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
