"use client";

import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types";
import { motion } from "framer-motion";
import { Bot, User, Copy, Check, File as FileIcon, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationCard } from "./CitationCard";

interface ChatBubbleProps {
    message: ChatMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === "user";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderUserContent = (content: string) => {
        const lines = content.split("\n");
        const attachmentLines = lines.filter(l => l.includes("📎 Attached:") || l.includes("📤 Uploaded:"));
        const textLines = lines.filter(l => !attachmentLines.includes(l));

        return (
            <div className="space-y-3">
                {textLines.length > 0 && <p className="whitespace-pre-wrap">{textLines.join("\n").trim()}</p>}

                {attachmentLines.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/10">
                        {attachmentLines.map((line, lIdx) => {
                            const isLibrary = line.includes("📎 Attached:");
                            const fileNames = line.replace(/📎 Attached: |📤 Uploaded: /, "").split(", ");
                            return fileNames.map((name, fIdx) => {
                                const ext = name.split('.').pop()?.toLowerCase();
                                const getIcon = () => {
                                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="w-3.5 h-3.5" />;
                                    if (['pdf'].includes(ext || '')) return <FileText className="w-3.5 h-3.5" />;
                                    return isLibrary ? <FileIcon className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />;
                                };
                                return (
                                    <div
                                        key={`${lIdx}-${fIdx}`}
                                        className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105",
                                            isLibrary
                                                ? "bg-white/20 text-white border border-white/10"
                                                : "bg-white/10 text-white/90 border border-white/5"
                                        )}
                                    >
                                        {getIcon()}
                                        <span className="truncate max-w-[150px]">{name}</span>
                                    </div>
                                );
                            });
                        })}
                    </div>
                )}
            </div>
        );
    };
    const processChildren = (nodes: any): any => {
        if (typeof nodes === 'string') {
            // Support formats: [ref:FileName|Page], [ref:FileName:Page], and [Source: FileName, Page: X]
            const citationRegex = /(\[ref:[^\]]+\]|\[Source:[^\]]+\])/gi;
            const parts = nodes.split(citationRegex);

            return parts.map((part, i) => {
                // Try format: [ref:FileName|Page] or [ref:FileName:Page]
                let match = part.match(/\[ref:\s*([^:|\]]+)\s*[:|]\s*(?:Page\s*)?([^\]]+)\]/i);

                // Fallback to old format
                if (!match) {
                    match = part.match(/\[Source:\s*([^,;:]+)[,;:]?\s*Page:?\s*([^\]]+)\]/i);
                }

                if (match) {
                    const [_, file, page] = match;
                    let displayPage = page.toLowerCase().includes('unknown') ? '?' : page.replace(/Page\s+/i, '').trim();
                    if (displayPage.includes(',')) displayPage = displayPage.split(',')[0].trim() + '+';

                    return (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand-red/10 border border-brand-red/20 text-[10px] font-bold text-brand-red hover:bg-brand-red/20 transition-all mx-0.5 align-top mt-0.5 cursor-help group/cite relative shrink-0"
                        >
                            <Paperclip className="w-2.5 h-2.5" />
                            {displayPage}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-white text-[11px] whitespace-nowrap opacity-0 group-hover/cite:opacity-100 transition-all pointer-events-none shadow-2xl z-50 ring-1 ring-white/5 backdrop-blur-xl">
                                <span className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-brand-red" />
                                    <span className="font-semibold truncate max-w-[150px]">{file}</span>
                                    <span className="text-white/60">P.{page}</span>
                                </span>
                            </span>
                        </span>
                    );
                }
                return part;
            });
        }
        if (Array.isArray(nodes)) {
            return nodes.map((node, idx) => <span key={idx}>{processChildren(node)}</span>);
        }
        if (nodes && typeof nodes === 'object' && nodes.props && nodes.props.children) {
            return {
                ...nodes,
                props: {
                    ...nodes.props,
                    children: processChildren(nodes.props.children)
                }
            };
        }
        return nodes;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3 md:gap-4", isUser ? "flex-row-reverse" : "flex-row")}
        >
            {/* Avatar */}
            <div
                className={cn(
                    "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0",
                    isUser ? "bg-brand-red" : "bg-app-card-hover border border-app-border"
                )}
            >
                {isUser ? (
                    <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
                ) : (
                    <Bot className="w-4 h-4 md:w-5 md:h-5 text-brand-red" />
                )}
            </div>

            {/* Message */}
            <div className={cn("flex-1 max-w-[85%] md:max-w-[80%]", isUser && "flex justify-end")}>
                <div
                    className={cn(
                        "rounded-2xl px-3 py-2 md:px-4 md:py-3 relative group",
                        isUser
                            ? "bg-brand-red text-white rounded-tr-sm"
                            : "bg-app-card border border-app-border text-app-text rounded-tl-sm"
                    )}
                >
                    {/* Content */}
                    {isUser ? (
                        renderUserContent(message.content)
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => <span>{processChildren(children)}</span>,
                                    li: ({ children }) => <span>{processChildren(children)}</span>,
                                    span: ({ children }) => <span>{processChildren(children)}</span>,
                                    em: ({ children }) => <em>{processChildren(children)}</em>,
                                    strong: ({ children }) => <strong>{processChildren(children)}</strong>
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}

                    {/* Copy Button (for AI messages) */}
                    {!isUser && (
                        <button
                            onClick={copyToClipboard}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-app-bg/50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4 text-app-text-muted" />
                            )}
                        </button>
                    )}

                    {/* Citations */}
                    {message.citations && message.citations.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-app-border/50">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-4 bg-brand-red rounded-full" />
                                <p className="text-sm font-medium text-app-text">
                                    Sources ({message.citations.length})
                                </p>
                            </div>
                            <div className="space-y-2">
                                {message.citations.map((citation, index) => (
                                    <CitationCard
                                        key={index}
                                        citation={citation}
                                        index={index}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tokens */}
                {
                    !isUser && message.tokens_used > 0 && (
                        <p className="text-xs text-app-text-muted mt-1 ml-1">
                            {message.tokens_used} tokens
                        </p>
                    )
                }
            </div >
        </motion.div >
    );
}
