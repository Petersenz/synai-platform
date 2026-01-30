"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { llmProvidersAPI, LLMProvider } from "@/lib/llmProvidersAPI";
import { ChevronDown, Sparkles, Check, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
    SiOpenai,
    SiAnthropic,
    SiGooglegemini,
    SiZhihu,
} from "react-icons/si";
import {
    RiTeamLine,
    RiNeteaseCloudMusicLine,
    RiNodeTree,
    RiLightbulbFlashLine,
} from "react-icons/ri";
import { TbTornado, TbActivity } from "react-icons/tb";

interface ModelSelectorProps {
    onModelChange?: (providerId: number, model: string) => void;
}

export function ModelSelector({ onModelChange }: ModelSelectorProps) {
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadProviders();
    }, []);

    const loadProviders = async () => {
        try {
            setIsLoading(true);
            const data = await llmProvidersAPI.getProviders(true); // Active only
            setProviders(data);

            // Try to load from localStorage
            const savedProviderId = localStorage.getItem("selected_provider_id");
            const savedModel = localStorage.getItem("selected_model");

            let initialProvider = null;
            let initialModel = "";

            if (savedProviderId && savedModel) {
                initialProvider = data.find(p => p.id.toString() === savedProviderId);
                // Verify the model exists in the provider
                if (initialProvider && initialProvider.available_models?.includes(savedModel)) {
                    initialModel = savedModel;
                } else {
                    initialProvider = null; // Reset to default if model not found
                }
            }

            if (!initialProvider) {
                initialProvider = data.find(p => p.is_default) || data[0];
                initialModel = initialProvider?.default_model || initialProvider?.available_models?.[0] || "";
            }

            if (initialProvider) {
                setSelectedProvider(initialProvider);
                setSelectedModel(initialModel);
                // Call callback with initial values
                onModelChange?.(initialProvider.id, initialModel);
            }
        } catch (error: any) {
            toast.error("Failed to load providers");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectModel = (provider: LLMProvider, model: string) => {
        setSelectedProvider(provider);
        setSelectedModel(model);
        setIsOpen(false);

        // Save to localStorage
        localStorage.setItem("selected_provider_id", provider.id.toString());
        localStorage.setItem("selected_model", model);

        onModelChange?.(provider.id, model);
        toast.success(`Switched to ${provider.provider_name} - ${model}`);
    };

    const renderProviderIcon = (type: string, className: string = "w-5 h-5") => {
        switch (type) {
            case "openai":
                return <SiOpenai className={cn(className, "text-[#74AA9C]")} />;
            case "anthropic":
                return <SiAnthropic className={cn(className, "text-[#D97757]")} />;
            case "google":
                return <SiGooglegemini className={cn(className, "text-[#1A73E8]")} />;
            case "groq":
                return <TbActivity className={cn(className, "text-[#F55036]")} />; // Representing speed/activity
            case "cohere":
                return <RiNodeTree className={cn(className, "text-[#3D522B]")} />; // Representing embeddings/nodes
            case "mistral":
                return <TbTornado className={cn(className, "text-[#F3D03E]")} />; // Representing "Mistral" wind
            case "together":
                return <RiTeamLine className={cn(className, "text-blue-400")} />;
            case "zai":
                return <SiZhihu className={cn(className, "text-[#0084FF]")} />;
            default:
                return <Cpu className={cn(className, "text-gray-400")} />;
        }
    };

    if (isLoading || !selectedProvider) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-app-card border border-app-border">
                <Sparkles className="w-4 h-4 text-app-text-muted animate-pulse" />
                <span className="text-sm text-app-text-muted">Loading...</span>
            </div>
        );
    }

    if (providers.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-app-card border border-app-border">
                <Sparkles className="w-4 h-4 text-app-text-muted" />
                <span className="text-sm text-app-text-muted">No providers</span>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Selector Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all text-app-text-secondary hover:text-app-text"
            >
                <div className="shrink-0 flex items-center justify-center">
                    {renderProviderIcon(selectedProvider.provider_type, "w-4 h-4")}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{selectedModel}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 opacity-50 transition-transform", isOpen ? "rotate-180" : "")} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 mt-2 w-80 bg-app-card border border-app-border rounded-lg shadow-xl overflow-hidden z-50"
                    >
                        <div className="max-h-96 overflow-y-auto">
                            {providers.map((provider) => (
                                <div key={provider.id} className="border-b border-app-border last:border-0">
                                    {/* Provider Header */}
                                    <div className="px-4 py-2 bg-app-bg/50">
                                        <div className="flex items-center gap-2">
                                            {renderProviderIcon(provider.provider_type, "w-4 h-4")}
                                            <span className="text-sm font-medium text-app-text">{provider.provider_name}</span>
                                            {provider.is_default && (
                                                <span className="text-xs bg-brand-red/20 text-brand-red px-2 py-0.5 rounded">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Models */}
                                    <div className="py-1">
                                        {/* Fallback to default_model if available_models is empty */}
                                        {(provider.available_models && provider.available_models.length > 0
                                            ? provider.available_models
                                            : [provider.default_model || "default"]).map((model) => (
                                                <button
                                                    key={model}
                                                    onClick={() => handleSelectModel(provider, model)}
                                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-app-bg transition-colors"
                                                >
                                                    <span className="text-sm text-app-text-secondary">{model}</span>
                                                    {selectedProvider?.id === provider.id && selectedModel === model && (
                                                        <Check className="w-4 h-4 text-brand-red" />
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 bg-app-bg/50 border-t border-app-border">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push("/settings?action=add");
                                }}
                                className="text-xs text-brand-red hover:underline"
                            >
                                Manage Providers →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
