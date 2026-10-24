'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Files,
  Trash2,
  BookOpen,
  FileText,
  Loader2,
  Sparkles,
  ArrowRight,
  GitCompare,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { TranslationDictionary } from '@/lib/i18n';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

export interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount: number;
  language: string | null;
  status: string;
  createdAt: string;
  _count?: { chunks: number };
}

interface DocumentLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocForChat?: (docId: string, title: string) => void;
  t: TranslationDictionary;
}

export const DocumentLibraryModal: React.FC<DocumentLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectDocForChat,
  t,
}) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Quick Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionOutput, setActionOutput] = useState<string>('');
  const [actionTitle, setActionTitle] = useState<string>('');
  const [targetTranslateLang, setTargetTranslateLang] = useState('ta');

  // Compare state
  const [compareDoc1, setCompareDoc1] = useState<string>('');
  const [compareDoc2, setCompareDoc2] = useState<string>('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareOutput, setCompareOutput] = useState<string>('');
  const [isCompareView, setIsCompareView] = useState(false);

  const fetchDocs = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
        if (data.documents.length > 0 && !selectedDocId) {
          setSelectedDocId(data.documents[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch documents:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDocId]);

  useEffect(() => {
    if (isOpen) {
      fetchDocs();
    }
  }, [isOpen, fetchDocs]);

  if (!isOpen) return null;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document and all its indexed chunks?')) return;

    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDocId === id) {
        setSelectedDocId(null);
        setActionOutput('');
      }
    } catch (err) {
      console.error('Failed to delete doc:', err);
    }
  };

  const handleRunAction = async (action: 'summarize' | 'keyPoints' | 'actionItems' | 'explainSimply' | 'translate') => {
    if (!selectedDocId) return;
    setActionLoading(true);
    setActionOutput('');
    setActionTitle(
      action === 'summarize'
        ? t.summarize
        : action === 'keyPoints'
        ? t.keyPoints
        : action === 'actionItems'
        ? t.actionItems
        : action === 'explainSimply'
        ? t.explainSimply
        : `${t.translateSummary} (${targetTranslateLang.toUpperCase()})`
    );

    try {
      const res = await fetch(`/api/documents/${selectedDocId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetLanguage: action === 'translate' ? targetTranslateLang : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute action');
      setActionOutput(data.result);
    } catch (err: unknown) {
      setActionOutput(`Error: ${err instanceof Error ? err.message : 'Action failed'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!compareDoc1 || !compareDoc2) return;
    setCompareLoading(true);
    setCompareOutput('');

    try {
      const res = await fetch('/api/documents/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId1: compareDoc1, docId2: compareDoc2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compare documents');
      setCompareOutput(data.comparison);
    } catch (err: unknown) {
      setCompareOutput(`Error: ${err instanceof Error ? err.message : 'Comparison failed'}`);
    } finally {
      setCompareLoading(false);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
              <Files className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.docsLibrary}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage uploaded knowledge, trigger instant whole-document intelligence, and compare texts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCompareView(!isCompareView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isCompareView
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{t.compareDocs}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left panel: Document List */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 overflow-y-auto p-3 space-y-1.5">
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Uploaded Documents ({documents.length})
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-slate-400">
                No documents uploaded yet. Use the + menu in chat to upload PDFs, Word files, or images.
              </div>
            ) : (
              documents.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setActionOutput('');
                    }}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100'
                        : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{doc.title}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {doc.fileName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(doc.id, e)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        {doc.status === 'ready' ? (
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        ) : doc.status === 'processing' ? (
                          <Clock className="w-3 h-3 text-amber-500 animate-spin" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-red-500" />
                        )}
                        <span className="capitalize">{doc.status}</span>
                      </span>
                      <span>•</span>
                      <span>{doc.pageCount} pgs</span>
                      <span>•</span>
                      <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right panel: Document Details, Quick Actions, or Comparison */}
          <div className="flex-1 p-5 overflow-y-auto">
            {isCompareView ? (
              /* Compare Two Documents View */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <GitCompare className="w-4 h-4 text-emerald-600" />
                  <span>Cross-Document Comparative Analysis</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      First Document
                    </label>
                    <select
                      value={compareDoc1}
                      onChange={(e) => setCompareDoc1(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Document A</option>
                      {documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d.pageCount} pgs)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Second Document
                    </label>
                    <select
                      value={compareDoc2}
                      onChange={(e) => setCompareDoc2(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Document B</option>
                      {documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d.pageCount} pgs)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCompare}
                  disabled={!compareDoc1 || !compareDoc2 || compareDoc1 === compareDoc2 || compareLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {compareLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                  <span>Run Comparison</span>
                </button>

                {compareOutput && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {compareOutput}
                  </div>
                )}
              </div>
            ) : selectedDoc ? (
              /* Selected Document Quick Actions */
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedDoc.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedDoc.fileName} • {selectedDoc.pageCount} pages •{' '}
                      {selectedDoc._count?.chunks || selectedDoc.pageCount * 3} indexed chunks
                    </p>
                  </div>

                  {onSelectDocForChat && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDocForChat(selectedDoc.id, selectedDoc.title);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                    >
                      <span>Chat with this</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Action Chips */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Quick Map-Reduce Document Actions
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunAction('summarize')}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.summarize}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunAction('keyPoints')}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.keyPoints}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunAction('actionItems')}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.actionItems}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunAction('explainSimply')}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.explainSimply}</span>
                    </button>

                    {/* Translate Summary dropdown trigger */}
                    <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <select
                        value={targetTranslateLang}
                        onChange={(e) => setTargetTranslateLang(e.target.value)}
                        className="bg-transparent text-xs px-2 py-1.5 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 focus:outline-none"
                      >
                        {SUPPORTED_LANGUAGES.filter((l) => l.isIndian).map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.nativeName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRunAction('translate')}
                        disabled={actionLoading}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors"
                      >
                        {t.translateSummary}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Output Area */}
                {actionLoading && (
                  <div className="flex items-center justify-center py-12 gap-2 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Processing full document across pages with map-reduce...</span>
                  </div>
                )}

                {actionOutput && !actionLoading && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{actionTitle}</span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {actionOutput}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Select a document from the left to view details and quick actions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
