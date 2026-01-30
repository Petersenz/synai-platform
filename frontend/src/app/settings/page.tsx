"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { User, Key, Shield, LogOut, Plus, Trash2, Edit2, Check, X, Loader2, Sparkles, Cpu, Copy, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { llmProvidersAPI, LLMProvider, CreateLLMProvider } from "@/lib/llmProvidersAPI";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
    SiOpenai,
    SiAnthropic,
    SiGooglegemini,
    SiZhihu,
} from "react-icons/si";
import {
    RiTeamLine,
    RiNodeTree,
} from "react-icons/ri";
import { TbTornado, TbActivity } from "react-icons/tb";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";

const PROVIDER_TYPES = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "google", label: "Google (Gemini)" },
    { value: "groq", label: "Groq" },
    { value: "cohere", label: "Cohere" },
    { value: "mistral", label: "Mistral" },
    { value: "together", label: "Together AI" },
    { value: "zai", label: "Z.AI (Zhipu)" },
    { value: "custom", label: "Custom (OpenAI Compatible)" },
];

function SettingsContent() {
    const { user, logout } = useAuthStore();
    const searchParams = useSearchParams();
    const action = searchParams.get("action");
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState<CreateLLMProvider>({
        provider_type: "openai",
        provider_name: "",
        api_key: "",
        api_base_url: "",
        default_model: "",
        is_default: false,
        is_active: true,
    });

    // Password Change State
    const [passwordData, setPasswordData] = useState({
        old_password: "",
        new_password: "",
        confirm_password: "",
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Platform API Keys State
    const [platformKeys, setPlatformKeys] = useState<any[]>([]);
    const [isKeysLoading, setIsKeysLoading] = useState(false);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [newKeyExpires, setNewKeyExpires] = useState(30);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    useEffect(() => {
        loadProviders();
        loadPlatformKeys();
        if (action === "add") {
            setShowAddModal(true);
        }
    }, [action]);

    const loadProviders = async () => {
        try {
            setIsLoading(true);
            const data = await llmProvidersAPI.getProviders();
            setProviders(data);
        } catch (error: any) {
            toast.error("Failed to load providers");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProvider = async () => {
        if (!formData.provider_name || !formData.api_key) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            setIsSubmitting(true);
            await llmProvidersAPI.createProvider(formData);
            toast.success("Provider added successfully!");
            setShowAddModal(false);
            setFormData({
                provider_type: "openai",
                provider_name: "",
                api_key: "",
                api_base_url: "",
                default_model: "",
                is_default: false,
                is_active: true,
            });
            loadProviders();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Failed to add provider");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProvider = async (id: number) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Provider",
            description: "Are you sure you want to delete this LLM provider? This will remove all configurations and keys associated with it.",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                try {
                    await llmProvidersAPI.deleteProvider(id);
                    toast.success("Provider deleted successfully");
                    loadProviders();
                } catch (error: any) {
                    toast.error("Failed to delete provider");
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
    };

    const handleSetDefault = async (id: number) => {
        try {
            await llmProvidersAPI.updateProvider(id, { is_default: true });
            toast.success("Default provider updated");
            loadProviders();
        } catch (error: any) {
            toast.error("Failed to update provider");
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const { authAPI } = await import("@/lib/api");

        if (passwordData.new_password !== passwordData.confirm_password) {
            toast.error("Passwords do not match");
            return;
        }
        if (passwordData.new_password.length < 8) {
            toast.error("New password must be at least 8 characters");
            return;
        }

        setIsChangingPassword(true);
        try {
            await authAPI.changePassword(passwordData.old_password, passwordData.new_password);
            toast.success("Password changed successfully");
            setPasswordData({ old_password: "", new_password: "", confirm_password: "" });
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Failed to change password");
        } finally {
            setIsChangingPassword(false);
        }
    };

    const renderProviderIcon = (type: string, className: string = "w-6 h-6") => {
        switch (type) {
            case "openai":
                return <SiOpenai className={cn(className, "text-[#74AA9C]")} />;
            case "anthropic":
                return <SiAnthropic className={cn(className, "text-[#D97757]")} />;
            case "google":
                return <SiGooglegemini className={cn(className, "text-[#1A73E8]")} />;
            case "groq":
                return <TbActivity className={cn(className, "text-[#F55036]")} />;
            case "cohere":
                return <RiNodeTree className={cn(className, "text-[#3D522B]")} />;
            case "mistral":
                return <TbTornado className={cn(className, "text-[#F3D03E]")} />;
            case "together":
                return <RiTeamLine className={cn(className, "text-blue-400")} />;
            case "zai":
                return <SiZhihu className={cn(className, "text-[#0084FF]")} />;
            default:
                return <Cpu className={cn(className, "text-gray-400")} />;
        }
    };

    const loadPlatformKeys = async () => {
        const { authAPI } = await import("@/lib/api");
        try {
            setIsKeysLoading(true);
            const res = await authAPI.getApiKeys();
            setPlatformKeys(res.data);
        } catch (error) {
            console.error("Failed to load keys");
        } finally {
            setIsKeysLoading(false);
        }
    };

    const handleCreateKey = async () => {
        if (!newKeyName) return;
        const { authAPI } = await import("@/lib/api");
        try {
            const res = await authAPI.createApiKey(newKeyName, newKeyExpires);
            setGeneratedKey(res.data.key);
            loadPlatformKeys();
        } catch (error) {
            toast.error("Failed to create key");
        }
    };

    const handleRotateKey = async (id: string) => {
        const { authAPI } = await import("@/lib/api");
        try {
            const res = await authAPI.rotateApiKey(id);
            setGeneratedKey(res.data.key);
            toast.success("Key rotated successfully");
            loadPlatformKeys();
        } catch (error) {
            toast.error("Failed to rotate key");
        }
    };

    const handleRevokeKey = async (id: string) => {
        const { authAPI } = await import("@/lib/api");
        try {
            await authAPI.revokeApiKey(id, false); // Just revoke (soft)
            toast.success("Key revoked");
            loadPlatformKeys();
        } catch (error) {
            toast.error("Failed to revoke key");
        }
    };

    const handleDeleteKey = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete API Key Permanently",
            description: "Are you sure you want to delete this API key forever? This action cannot be undone and all history for this key will be purged from the dashboard.",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                const { authAPI } = await import("@/lib/api");
                try {
                    await authAPI.revokeApiKey(id, true); // Permanent delete
                    toast.success("Key deleted permanently");
                    loadPlatformKeys();
                } catch (error: any) {
                    toast.error("Failed to delete key");
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
    };

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

    return (
        <MainLayout>
            <div className="p-4 pl-20 md:p-6 max-w-4xl mx-auto space-y-6 md:space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-app-text">Settings</h1>
                    <p className="text-app-text-secondary mt-1">Manage your account and LLM providers</p>
                </div>

                {/* LLM Providers */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-app-text flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-brand-red" />
                            LLM Providers
                        </h3>
                        <Button onClick={() => setShowAddModal(true)} size="sm">
                            <Plus className="w-4 h-4" />
                            Add Provider
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
                        </div>
                    ) : providers.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-app-text-secondary">No providers configured</p>
                            <p className="text-sm text-app-text-muted mt-1">Add your first LLM provider to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {providers.map((provider) => (
                                <div
                                    key={provider.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-app-bg border border-app-border"
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-10 h-10 rounded-xl bg-app-bg flex items-center justify-center border border-app-border">
                                            {renderProviderIcon(provider.provider_type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-app-text font-medium">{provider.provider_name}</p>
                                                {provider.is_default && (
                                                    <span className="text-xs bg-brand-red/20 text-brand-red px-2 py-0.5 rounded">
                                                        Default
                                                    </span>
                                                )}
                                                {!provider.is_active && (
                                                    <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-app-text-secondary truncate">
                                                {provider.api_key_masked} • {provider.provider_type}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!provider.is_default && (
                                            <button
                                                onClick={() => handleSetDefault(provider.id)}
                                                className="p-2 rounded-lg hover:bg-app-card-hover text-app-text-muted hover:text-app-text transition-colors"
                                                title="Set as default"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteProvider(provider.id)}
                                            className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Profile */}
                <Card>
                    <h3 className="font-medium text-app-text mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-brand-red" />
                        Profile
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="text-sm font-medium text-app-text-muted mb-1 block">Username</label>
                            <p className="text-app-text text-lg">{user?.username || "..."}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-app-text-muted mb-1 block">Email</label>
                            <p className="text-app-text text-lg">{user?.email || "..."}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-app-text-muted mb-1 block">Account Status</label>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                <p className="text-green-500 font-medium">Active Member</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Platform API Keys (The Rotation Requirement) */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-app-text flex items-center gap-2">
                            <Key className="w-5 h-5 text-brand-red" />
                            Platform API Keys
                        </h3>
                        <Button onClick={() => setShowNewKeyModal(true)} size="sm">
                            <Plus className="w-4 h-4" />
                            Create New Key
                        </Button>
                    </div>

                    <p className="text-sm text-app-text-secondary mb-4">
                        Use these keys to access SynAI Platform programmatically.
                    </p>

                    {isKeysLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-brand-red" />
                        </div>
                    ) : platformKeys.length === 0 ? (
                        <div className="text-center py-6 bg-app-bg/30 rounded-xl border border-dashed border-app-border">
                            <p className="text-app-text-muted text-sm">No platform keys generated</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Active Keys */}
                            {platformKeys.some(k => k.is_active) && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        Active Keys
                                    </h4>
                                    {platformKeys.filter(k => k.is_active).map((k) => (
                                        <div key={k.id} className="p-3 rounded-xl bg-app-bg border border-app-border flex items-center justify-between">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-app-text">{k.name}</p>
                                                <p className="text-xs text-app-text-muted mt-0.5">Expires: {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleRotateKey(k.id)}
                                                    className="p-1.5 text-app-text-muted hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors group"
                                                    title="Rotate Key"
                                                >
                                                    <RefreshCw className="w-4 h-4 group-active:rotate-180 transition-transform duration-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleRevokeKey(k.id)}
                                                    className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Revoke (Stop Access)"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Inactive/Revoked Keys */}
                            {platformKeys.some(k => !k.is_active) && (
                                <div className="space-y-3 pt-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted px-1">
                                        History & Revoked
                                    </h4>
                                    {platformKeys.filter(k => !k.is_active).map((k) => (
                                        <div key={k.id} className="p-3 rounded-xl bg-app-bg/50 border border-app-border/50 flex items-center justify-between opacity-70 grayscale-[0.5]">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-app-text-secondary line-through">{k.name}</p>
                                                    <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">Revoked</span>
                                                </div>
                                                <p className="text-[10px] text-app-text-muted mt-0.5 italic">No longer usable</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDeleteKey(k.id)}
                                                    className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete Permanently"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Security - Change Password */}
                <Card>
                    <h3 className="font-medium text-app-text mb-6 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-brand-red" />
                        Security & Credentials
                    </h3>
                    <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                        <div>
                            <label className="block text-sm text-app-text-muted mb-2">Current Password</label>
                            <input
                                type="password"
                                required
                                value={passwordData.old_password}
                                onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                                className="w-full bg-app-bg/50 border border-app-border rounded-xl px-4 py-2.5 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-app-text-muted mb-2">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.new_password}
                                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                                    className="w-full bg-app-bg/50 border border-app-border rounded-xl px-4 py-2.5 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-app-text-muted mb-2">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.confirm_password}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                                    className="w-full bg-app-bg/50 border border-app-border rounded-xl px-4 py-2.5 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div className="pt-2">
                            <Button
                                type="submit"
                                isLoading={isChangingPassword}
                                className="w-full md:w-auto px-8"
                            >
                                Update Password
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Danger Zone */}
                <Card className="border-red-500/30">
                    <h3 className="font-medium text-red-500 mb-4">Danger Zone</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-app-text">Sign Out</p>
                            <p className="text-sm text-app-text-secondary">Sign out of your account</p>
                        </div>
                        <Button variant="danger" onClick={logout}>
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Add Provider Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowAddModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-lg bg-app-card border border-app-border rounded-2xl p-6 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-app-text mb-4">Add LLM Provider</h3>

                            <div className="space-y-4">
                                {/* Provider Type */}
                                <div>
                                    <label className="block text-sm text-app-text-muted mb-3">Provider Type</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {PROVIDER_TYPES.map((type) => (
                                            <button
                                                key={type.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, provider_type: type.value })}
                                                className={cn(
                                                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2",
                                                    formData.provider_type === type.value
                                                        ? "bg-brand-red/10 border-brand-red text-app-text"
                                                        : "bg-app-bg/50 border-app-border text-app-text-muted hover:border-app-text-muted/50 hover:text-app-text-secondary"
                                                )}
                                            >
                                                {renderProviderIcon(type.value, "w-6 h-6")}
                                                <span className="text-[10px] font-medium text-center leading-tight">
                                                    {type.label.split(" (")[0]}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Provider Name */}
                                <div>
                                    <label className="block text-sm text-app-text-muted mb-2">Provider Name</label>
                                    <input
                                        type="text"
                                        value={formData.provider_name}
                                        onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                                        placeholder="My OpenAI Account"
                                        className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red"
                                    />
                                </div>

                                {/* API Key */}
                                <div>
                                    <label className="block text-sm text-app-text-muted mb-2">API Key</label>
                                    <input
                                        type="password"
                                        value={formData.api_key}
                                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                        placeholder="sk-..."
                                        className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red"
                                    />
                                </div>

                                {/* Custom URL and Model (Only for Custom Type) */}
                                {formData.provider_type === "custom" && (
                                    <>
                                        <div>
                                            <label className="block text-sm text-app-text-muted mb-2">Base URL</label>
                                            <input
                                                type="text"
                                                value={formData.api_base_url}
                                                onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                                                placeholder="https://api.deepseek.com/v1"
                                                className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-app-text-muted mb-2">Default Model Name</label>
                                            <input
                                                type="text"
                                                value={formData.default_model}
                                                onChange={(e) => setFormData({ ...formData, default_model: e.target.value })}
                                                placeholder="deepseek-chat"
                                                className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Set as Default */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_default"
                                        checked={formData.is_default}
                                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                        className="w-4 h-4 rounded border-app-border bg-app-bg text-brand-red focus:ring-brand-red"
                                    />
                                    <label htmlFor="is_default" className="text-sm text-app-text-secondary">
                                        Set as default provider
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddProvider}
                                    isLoading={isSubmitting}
                                    className="flex-1"
                                >
                                    Add Provider
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
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
                confirmText="Delete Provider"
                variant="danger"
            />

            {/* Generated Key Modal */}
            <AnimatePresence>
                {generatedKey && (
                    <motion.div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
                        <Card className="max-w-md w-full p-6 text-center">
                            <h3 className="text-xl font-bold text-app-text mb-4">Your New API Key</h3>
                            <p className="text-sm text-app-text-muted mb-4">
                                Copy this key now. You won't be able to see it again for security reasons.
                            </p>
                            <div className="bg-app-bg p-4 rounded-xl border border-brand-red/30 flex items-center gap-2 mb-6">
                                <code className="text-brand-red break-all text-sm flex-1 text-left">{generatedKey}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedKey);
                                        toast.success("Copied!");
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                            <Button onClick={() => setGeneratedKey(null)} className="w-full">Done</Button>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Key Modal */}
            <AnimatePresence>
                {showNewKeyModal && (
                    <motion.div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="max-w-sm w-full p-6">
                            <h3 className="text-xl font-bold text-app-text mb-4">Create API Key</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-app-text-muted mb-2 block">Key Name</label>
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        placeholder="e.g. My Automation Script"
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2 text-app-text outline-none focus:border-brand-red mb-4"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-app-text-muted mb-2 block">Expiration</label>
                                    <select
                                        value={newKeyExpires}
                                        onChange={(e) => setNewKeyExpires(parseInt(e.target.value))}
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2 text-app-text outline-none focus:border-brand-red appearance-none"
                                    >
                                        <option value={7}>7 Days</option>
                                        <option value={30}>30 Days</option>
                                        <option value={90}>90 Days</option>
                                        <option value={0}>Never</option>
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="secondary" onClick={() => setShowNewKeyModal(false)} className="flex-1">Cancel</Button>
                                    <Button
                                        onClick={() => {
                                            handleCreateKey();
                                            setShowNewKeyModal(false);
                                            setNewKeyName("");
                                        }}
                                        disabled={!newKeyName}
                                        className="flex-1"
                                    >
                                        Create
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </MainLayout>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <MainLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
                </div>
            </MainLayout>
        }>
            <SettingsContent />
        </Suspense>
    );
}
