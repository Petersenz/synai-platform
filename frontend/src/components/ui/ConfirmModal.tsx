"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    isLoading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",
    isLoading = false,
}: ConfirmModalProps) {
    const getVariantStyles = () => {
        switch (variant) {
            case "danger":
                return "bg-brand-red hover:bg-brand-red-dark shadow-brand-red/20";
            case "warning":
                return "bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20";
            default:
                return "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20";
        }
    };

    const getIconColor = () => {
        switch (variant) {
            case "danger":
                return "text-brand-red bg-brand-red/10";
            case "warning":
                return "text-yellow-500 bg-yellow-500/10";
            default:
                return "text-blue-500 bg-blue-500/10";
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-sm bg-app-card border border-app-border rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 text-center">
                            {/* Icon */}
                            <div className={cn(
                                "mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                                getIconColor()
                            )}>
                                <AlertTriangle className="w-8 h-8" />
                            </div>

                            {/* Text */}
                            <h3 className="text-xl font-bold text-app-text mb-2">{title}</h3>
                            <p className="text-app-text-secondary text-sm leading-relaxed mb-8 px-4">
                                {description}
                            </p>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="px-4 py-3 rounded-2xl bg-app-bg border border-app-border text-app-text-secondary font-bold hover:bg-app-card-hover hover:text-app-text transition-all disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className={cn(
                                        "px-4 py-3 rounded-2xl text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50",
                                        getVariantStyles()
                                    )}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        confirmText
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Aesthetic bottom bar */}
                        <div className={cn(
                            "h-1 w-full bg-linear-to-r",
                            variant === "danger" ? "from-brand-red to-brand-red-dark" :
                                variant === "warning" ? "from-yellow-400 to-yellow-500" :
                                    "from-blue-400 to-cyan-400"
                        )} />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
