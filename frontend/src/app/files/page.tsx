"use client";

import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { filesAPI } from "@/lib/api";
import { FileItem } from "@/types";
import { formatFileSize, formatDate } from "@/lib/utils";
import {
    Upload,
    File,
    Image,
    FileText,
    Trash2,
    Download,
    Eye,
    Search,
    FolderOpen,
    X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function FilesPage() {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [viewingFile, setViewingFile] = useState<FileItem | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            const response = await filesAPI.list();
            setFiles(response.data.files);
        } catch (error) {
            toast.error("Failed to load files");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (uploadFiles: FileList | null) => {
        if (!uploadFiles || uploadFiles.length === 0) return;

        setIsUploading(true);
        const uploadPromises = Array.from(uploadFiles).map(async (file) => {
            const fileKey = `${file.name}-${Date.now()}`;
            setUploadProgress(prev => ({ ...prev, [fileKey]: 0 }));

            try {
                await filesAPI.upload(file, (percent) => {
                    setUploadProgress(prev => ({ ...prev, [fileKey]: percent }));
                });
                toast.success(`Uploaded: ${file.name}`);
                setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[fileKey];
                    return next;
                });
            } catch (error: any) {
                toast.error(`Failed to upload: ${file.name}`);
                setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[fileKey];
                    return next;
                });
            }
        });

        await Promise.all(uploadPromises);
        setIsUploading(false);
        loadFiles();
    };

    const handleDelete = async (fileId: string, fileName: string) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete File",
            description: `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                try {
                    await filesAPI.delete(fileId);
                    toast.success("File deleted successfully");
                    loadFiles();
                } catch (error) {
                    toast.error("Failed to delete file");
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
    };

    const handleDownload = async (fileId: string, fileName: string) => {
        try {
            const response = await filesAPI.download(fileId);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error("Failed to download file");
        }
    };

    // ✅ แก้ไข handleView ให้ใช้ download แล้ว preview
    const handleView = async (file: FileItem) => {
        try {
            const response = await filesAPI.download(file.id);
            const blob = new Blob([response.data], { type: file.mime_type });
            const url = window.URL.createObjectURL(blob);
            setPreviewUrl(url);
            setViewingFile(file);
        } catch (error) {
            toast.error("Failed to view file");
        }
    };

    const closePreview = () => {
        if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setViewingFile(null);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleUpload(e.dataTransfer.files);
    };

    const getFileIcon = (fileType: string, mimeType: string) => {
        if (fileType === "image" || mimeType?.startsWith("image/")) {
            return <Image className="w-6 h-6 text-green-500" />;
        }
        if (mimeType?.includes("pdf")) {
            return <FileText className="w-6 h-6 text-red-500" />;
        }
        return <File className="w-6 h-6 text-blue-500" />;
    };

    const filteredFiles = files.filter((file) =>
        file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <MainLayout>
            <div className="p-4 pl-20 md:p-6 space-y-6 md:space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-app-text">Files</h1>
                        <p className="text-app-text-secondary mt-1">
                            Manage your uploaded documents and images
                        </p>
                    </div>
                    <Button onClick={() => fileInputRef.current?.click()} isLoading={isUploading} className="w-full sm:w-auto">
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">Upload Files</span>
                        <span className="sm:hidden">Upload</span>
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files)}
                        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif"
                    />
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search files..."
                        className="w-full bg-app-card border border-app-border rounded-lg pl-12 pr-4 py-3 text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-brand-red"
                    />
                </div>

                {/* Active Uploads */}
                <AnimatePresence>
                    {Object.keys(uploadProgress).length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3 overflow-hidden"
                        >
                            <h2 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider">
                                Uploading {Object.keys(uploadProgress).length} file{Object.keys(uploadProgress).length !== 1 ? "s" : ""}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Object.entries(uploadProgress).map(([key, progress]) => (
                                    <Card key={key} className="p-3 bg-brand-red/5 border-brand-red/20">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-brand-red/10 flex items-center justify-center shrink-0">
                                                <Upload className="w-4 h-4 text-brand-red animate-pulse" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between mb-1 text-xs">
                                                    <span className="text-app-text font-medium truncate pr-2">
                                                        {key.split("-")[0]}
                                                    </span>
                                                    <span className="text-brand-red font-bold">{progress}%</span>
                                                </div>
                                                <div className="w-full bg-app-bg rounded-full h-1.5 overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${progress}%` }}
                                                        className="bg-brand-red h-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Drop Zone */}
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${dragActive
                        ? "border-brand-red bg-brand-red/5"
                        : "border-app-border hover:border-gray-600"
                        }`}
                >
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? "text-brand-red" : "text-app-text-muted"}`} />
                    <p className="text-app-text-secondary">
                        Drag and drop files here, or{" "}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-brand-red hover:underline"
                        >
                            browse
                        </button>
                    </p>
                    <p className="text-sm text-app-text-muted mt-2">
                        Supports: PDF, DOCX, TXT, PNG, JPG, GIF (Max 50MB)
                    </p>
                </div>

                {/* Files Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full" />
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <Card className="text-center py-12">
                        <FolderOpen className="w-16 h-16 text-app-text-muted mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-app-text mb-2">No files yet</h3>
                        <p className="text-app-text-secondary">Upload your first file to get started</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        <AnimatePresence>
                            {filteredFiles.map((file) => (
                                <motion.div
                                    key={file.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <Card className="group hover:border-gray-600 transition-all duration-200 p-3 md:p-4">
                                        <div className="flex items-start gap-4">
                                            {/* Icon */}
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-app-bg flex items-center justify-center shrink-0">
                                                {getFileIcon(file.file_type, file.mime_type)}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-app-text truncate" title={file.original_filename}>
                                                    {file.original_filename}
                                                </h3>
                                                <p className="text-sm text-app-text-muted">
                                                    {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                                                </p>
                                                {file.is_processed && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-green-500 mt-1">
                                                        ✓ Processed for RAG
                                                    </span>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleDownload(file.id, file.original_filename)}
                                                    className="p-2 rounded-lg hover:bg-app-bg text-app-text-muted hover:text-app-text"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleView(file)}
                                                    className="p-2 rounded-lg hover:bg-app-bg text-app-text-muted hover:text-app-text"
                                                    title="View"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(file.id, file.original_filename)}
                                                    className="p-2 rounded-lg hover:bg-app-bg text-app-text-muted hover:text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* Stats */}
                <Card className="flex items-center justify-between">
                    <span className="text-app-text-secondary">
                        {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-app-text-secondary">
                        Total: {formatFileSize(filteredFiles.reduce((acc, f) => acc + f.file_size, 0))}
                    </span>
                </Card>
            </div>

            {/* ✅ File Preview Modal */}
            <AnimatePresence>
                {viewingFile && previewUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={closePreview}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-4xl max-h-[90vh] w-full bg-app-card rounded-xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-app-border">
                                <h3 className="font-medium text-app-text truncate">{viewingFile.original_filename}</h3>
                                <button
                                    onClick={closePreview}
                                    className="p-2 rounded-lg hover:bg-app-bg text-app-text-muted hover:text-app-text"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
                                {viewingFile.mime_type?.startsWith("image/") ? (
                                    <img
                                        src={previewUrl}
                                        alt={viewingFile.original_filename}
                                        className="max-w-full h-auto mx-auto rounded-lg"
                                    />
                                ) : viewingFile.mime_type === "application/pdf" ? (
                                    <iframe
                                        src={previewUrl}
                                        className="w-full h-[70vh] rounded-lg"
                                        title={viewingFile.original_filename}
                                    />
                                ) : viewingFile.mime_type?.startsWith("text/") ? (
                                    <iframe
                                        src={previewUrl}
                                        className="w-full h-[70vh] bg-app-bg rounded-lg"
                                        title={viewingFile.original_filename}
                                    />
                                ) : (
                                    <div className="text-center py-12">
                                        <File className="w-16 h-16 text-app-text-muted mx-auto mb-4" />
                                        <p className="text-app-text-secondary">Preview not available for this file type</p>
                                        <Button
                                            className="mt-4"
                                            onClick={() => handleDownload(viewingFile.id, viewingFile.original_filename)}
                                        >
                                            <Download className="w-4 h-4" />
                                            Download to View
                                        </Button>
                                    </div>
                                )}
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
                confirmText="Delete File"
                variant="danger"
            />
        </MainLayout>
    );
}
