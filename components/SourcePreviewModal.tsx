'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, BookOpen } from 'lucide-react';

export interface SourceCitation {
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  snippet: string;
  fullContent?: string;
  score?: number;
}

interface SourcePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: SourceCitation | null;
  citationIndex?: number;
}

export const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({
  isOpen,
  onClose,
  source,
  citationIndex,
}) => {
  const [fullPageText, setFullPageText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!source || !isOpen) {
      setFullPageText('');
      return;
    }

    // If source already has fullContent, use it initially
    if (source.fullContent) {
      setFullPageText(source.fullContent);
    }

    // Fetch full page text from the API
    if (source.documentId && source.pageNumber) {
      setLoading(true);
      fetch(`/api/documents/${source.documentId}?page=${source.pageNumber}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.pageText) {
            setFullPageText(data.pageText);
          }
        })
        .catch((err) => console.error('Failed to load page text:', err))
        .finally(() => setLoading(false));
    }
  }, [source, isOpen]);

  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {citationIndex ? <span>Source [{citationIndex}]:</span> : null}
                <span className="truncate max-w-xs">{source.documentTitle}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Page {source.pageNumber} {source.score ? `• Relevance: ${Math.round(source.score * 100)}%` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* Relevant snippet highlight */}
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Retrieved Passage</span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
              &quot;{source.snippet}&quot;
            </div>
          </div>

          {/* Full Page Text */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Full Page {source.pageNumber} Context
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading complete page text...</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">
                {fullPageText || source.snippet}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
