"use client";

import { Citation } from "@/types";
import { FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CitationCardProps {
    citation: Citation;
    index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Convert relevance score to percentage
    const relevancePercentage = Math.round(citation.relevance_score * 100);

    // Color based on relevance
    const getRelevanceColor = (score: number) => {
        if (score >= 0.8) return "text-green-400 bg-green-400/10 border-green-400/30";
        if (score >= 0.6) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
        return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    };

    const relevanceColor = getRelevanceColor(citation.relevance_score);

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group"
        >
            <div
                className={`
                    relative rounded-lg border transition-all duration-200
                    ${relevanceColor}
                    hover:shadow-lg hover:scale-[1.02]
                    cursor-pointer
                `}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Header */}
                <div className="p-2 md:p-3 flex items-start gap-2 md:gap-3">
                    {/* Icon */}
                    <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-md bg-app-bg/50 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Source name */}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">
                                {citation.source}
                            </span>
                            {citation.file_id && (
                                <ExternalLink className="w-3 h-3 opacity-50" />
                            )}
                        </div>

                        {/* Relevance score */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-app-bg/50 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${relevancePercentage}%` }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    className="h-full bg-current rounded-full"
                                />
                            </div>
                            <span className="text-xs font-mono">
                                {relevancePercentage}%
                            </span>
                        </div>
                    </div>

                    {/* Expand button */}
                    <button
                        className="shrink-0 p-1 rounded hover:bg-app-bg/50 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </button>
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-3 pb-3 pt-1 border-t border-current/20">
                                <p className="text-xs text-app-text-secondary leading-relaxed whitespace-pre-wrap">
                                    {citation.content}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Content removed to fix 'mysterious black circle' bug */}
            </div>
        </motion.div>
    );
}
