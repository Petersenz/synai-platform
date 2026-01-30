"use client";

import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Send, Paperclip, X, FolderOpen, Upload, Smile } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FileItem } from "@/types";
import { FilePicker } from "./FilePicker";
import { formatFileSize, cn } from "@/lib/utils";

interface ChatInputProps {
    onSend: (message: string, options?: { selectedFiles?: FileItem[]; uploadedFiles?: File[] }) => void;
    isLoading?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder = "Ask anything..." }: ChatInputProps) {
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [showUploadMenu, setShowUploadMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    const handleSend = () => {
        if (message.trim() || selectedFiles.length > 0 || uploadedFiles.length > 0) {
            onSend(message.trim(), {
                selectedFiles: selectedFiles,
                uploadedFiles: uploadedFiles,
            });
            setMessage("");
            setSelectedFiles([]);
            setUploadedFiles([]);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setUploadedFiles([...uploadedFiles, ...Array.from(e.target.files)]);
        }
        setShowUploadMenu(false);
    };

    const removeSelectedFile = (fileId: string) => {
        setSelectedFiles(selectedFiles.filter((f) => f.id !== fileId));
    };

    const removeUploadedFile = (index: number) => {
        setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
    };

    const hasAttachments = selectedFiles.length > 0 || uploadedFiles.length > 0;

    return (
        <>
            <div className="max-w-4xl mx-auto w-full px-4 pb-4 md:pb-6">
                {/* Attached Files Overlay (shown above input) */}
                <AnimatePresence>
                    {hasAttachments && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex flex-wrap gap-2 mb-3 px-2"
                        >
                            {selectedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-app-card border border-app-border text-blue-500 group hover:border-blue-500/50 transition-all shadow-sm"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium truncate max-w-[120px]">{file.original_filename}</span>
                                    <button
                                        onClick={() => removeSelectedFile(file.id)}
                                        className="opacity-50 group-hover:opacity-100 hover:text-red-400"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}

                            {uploadedFiles.map((file, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-app-card border border-app-border text-green-500 group hover:border-green-500/50 transition-all shadow-sm"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium truncate max-w-[120px]">{file.name}</span>
                                    <button
                                        onClick={() => removeUploadedFile(index)}
                                        className="opacity-50 group-hover:opacity-100 hover:text-red-400"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* The Pill Input Container */}
                <div className={cn(
                    "relative flex flex-col glass rounded-2xl md:rounded-3xl shadow-2xl transition-all duration-300 ring-1 ring-white/10 z-20"
                )}>
                    {/* Textarea Area */}
                    <div className="flex-1 flex flex-col p-2 pt-3 md:pt-4 px-4 md:px-6">
                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            rows={1}
                            className="w-full resize-none bg-transparent border-none outline-none text-app-text placeholder:text-app-text-muted focus:ring-0 p-0 text-base md:text-lg leading-relaxed max-h-48 overflow-y-auto"
                            style={{ minHeight: "24px" }}
                        />
                    </div>

                    {/* Bottom Toolbar inside input */}
                    <div className="flex items-center justify-between p-2 px-3 md:px-4 pb-3">
                        {/* Left Actions */}
                        <div className="flex items-center gap-1">
                            <div className="relative">
                                <button
                                    onClick={() => setShowUploadMenu(!showUploadMenu)}
                                    className="p-2.5 rounded-xl hover:bg-app-card-hover text-app-text-secondary hover:text-app-text transition-all"
                                    title="Attach files"
                                >
                                    <Paperclip className="w-5 h-5 md:w-[22px] md:h-[22px]" />
                                </button>

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {showUploadMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                            className="absolute bottom-full left-0 mb-4 w-60 bg-app-card border border-app-border rounded-2xl shadow-2xl overflow-hidden z-50 p-1.5"
                                        >
                                            <button
                                                onClick={() => {
                                                    setShowFilePicker(true);
                                                    setShowUploadMenu(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-app-text-secondary hover:bg-app-card-hover hover:text-app-text transition-all"
                                            >
                                                <FolderOpen className="w-5 h-5 text-blue-500" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">From File Manager</p>
                                                    <p className="text-[10px] text-app-text-muted">Pick existing documents</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    fileInputRef.current?.click();
                                                    setShowUploadMenu(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-app-text-secondary hover:bg-app-card-hover hover:text-app-text transition-all"
                                            >
                                                <Upload className="w-5 h-5 text-green-500" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">Upload New File</p>
                                                    <p className="text-[10px] text-app-text-muted">From your computer</p>
                                                </div>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-3">
                            {message.length > 0 && (
                                <span className="text-[10px] text-gray-500 font-mono hidden sm:block">
                                    {message.length} chars
                                </span>
                            )}

                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={handleSend}
                                disabled={(!message.trim() && !hasAttachments) || isLoading}
                                className={cn(
                                    "h-10 w-10 md:h-11 md:w-11 rounded-full flex items-center justify-center transition-all duration-300",
                                    (message.trim() || hasAttachments)
                                        ? "bg-brand-red text-white shadow-lg shadow-brand-red/20"
                                        : "bg-app-bg text-app-text-muted cursor-not-allowed"
                                )}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5 md:w-[22px] md:h-[22px]" />
                                )}
                            </motion.button>
                        </div>
                    </div>


                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif"
                    />
                </div>
            </div>

            {/* File Picker Modal */}
            <FilePicker
                isOpen={showFilePicker}
                onClose={() => setShowFilePicker(false)}
                onSelect={setSelectedFiles}
                selectedFiles={selectedFiles}
            />
        </>
    );
}
