"use client";

import { useState, useEffect } from "react";
import { filesAPI } from "@/lib/api";
import { FileItem } from "@/types";
import { formatFileSize, formatDate } from "@/lib/utils";
import { X, File, Image, FileText, Check, Search, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

interface FilePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (files: FileItem[]) => void;
    selectedFiles: FileItem[];
}

export function FilePicker({ isOpen, onClose, onSelect, selectedFiles }: FilePickerProps) {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [tempSelected, setTempSelected] = useState<FileItem[]>(selectedFiles);

    useEffect(() => {
        if (isOpen) {
            loadFiles();
            setTempSelected(selectedFiles);
        }
    }, [isOpen, selectedFiles]);

    const loadFiles = async () => {
        setIsLoading(true);
        try {
            const response = await filesAPI.list();
            // ✅ ตรวจสอบ response structure
            const data = response.data;
            if (Array.isArray(data)) {
                setFiles(data);
            } else if (data?.files && Array.isArray(data.files)) {
                setFiles(data.files);
            } else {
                setFiles([]);
            }
        } catch (error: any) {
            console.error("Failed to load files:", error);
            toast.error("Failed to load files");
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFile = (file: FileItem) => {
        const isSelected = tempSelected.some((f) => f.id === file.id);
        if (isSelected) {
            setTempSelected(tempSelected.filter((f) => f.id !== file.id));
        } else {
            setTempSelected([...tempSelected, file]);
        }
    };

    const handleConfirm = () => {
        onSelect(tempSelected);
        onClose();
    };

    const getFileIcon = (fileType: string, mimeType?: string) => {
        if (fileType === "image" || mimeType?.startsWith("image/")) {
            return <Image className="w-5 h-5 text-green-500" />;
        }
        if (mimeType?.includes("pdf")) {
            return <FileText className="w-5 h-5 text-red-500" />;
        }
        return <File className="w-5 h-5 text-blue-500" />;
    };

    const filteredFiles = files.filter((file) =>
        file.original_filename?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-2xl bg-app-card border border-app-border rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 md:p-4 border-b border-app-border">
                        <h3 className="font-semibold text-app-text text-base md:text-lg">Select Files</h3>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-app-card-hover text-app-text-muted hover:text-app-text"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-3 md:p-4 border-b border-app-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-app-text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search files..."
                                className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-4 py-2 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red"
                            />
                        </div>
                    </div>

                    {/* File List */}
                    <div className="max-h-60 md:max-h-80 overflow-y-auto p-3 md:p-4 flex-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full" />
                            </div>
                        ) : filteredFiles.length === 0 ? (
                            <div className="text-center py-8">
                                <FolderOpen className="w-12 h-12 text-app-text-muted opacity-50 mx-auto mb-3" />
                                <p className="text-app-text-muted">
                                    {files.length === 0 ? "No files uploaded yet" : "No files match your search"}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredFiles.map((file) => {
                                    const isSelected = tempSelected.some((f) => f.id === file.id);
                                    return (
                                        <button
                                            key={file.id}
                                            onClick={() => toggleFile(file)}
                                            className={`w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg border transition-all ${isSelected
                                                ? "bg-brand-red/10 border-brand-red"
                                                : "bg-app-bg border-app-border hover:border-gray-600"
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className={`w-4 h-4 md:w-5 md:h-5 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-brand-red border-brand-red" : "border-gray-500"
                                                    }`}
                                            >
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>

                                            {/* Icon */}
                                            <div className="shrink-0">
                                                {getFileIcon(file.file_type, file.mime_type)}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-sm md:text-base text-app-text truncate">{file.original_filename}</p>
                                                <p className="text-xs text-app-text-muted">
                                                    {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                                                </p>
                                            </div>

                                            {/* RAG Badge */}
                                            {file.is_processed && (
                                                <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                                                    RAG
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 md:p-4 border-t border-app-border bg-app-card">
                        <p className="text-xs md:text-sm text-app-text-muted text-center sm:text-left">
                            {tempSelected.length} file{tempSelected.length !== 1 ? "s" : ""} selected
                        </p>
                        <div className="flex gap-2 md:gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-lg bg-app-bg border border-app-border text-app-text hover:bg-app-card-hover transition-colors text-sm md:text-base"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-lg bg-brand-red text-white hover:bg-brand-red-dark transition-colors text-sm md:text-base"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
