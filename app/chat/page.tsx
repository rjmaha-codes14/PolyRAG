'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Paperclip,
  Image as ImageIcon,
  Send,
  Square,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Download,
  Share2,
  Edit3,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  ArrowDown,
  X,
  Loader2,
} from 'lucide-react';
import { Sidebar, ChatSummary } from '@/components/Sidebar';
import { SettingsModal } from '@/components/SettingsModal';
import { DocumentLibraryModal } from '@/components/DocumentLibraryModal';
import { SourcePreviewModal, SourceCitation } from '@/components/SourcePreviewModal';
import { LanguageBadge } from '@/components/LanguageBadge';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { getTranslation, TranslationDictionary, InterfaceLanguage } from '@/lib/i18n';
import { SUPPORTED_LANGUAGES, isRtlLanguage } from '@/lib/languages';

interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  detectedLanguage?: string | null;
  script?: string | null;
  isRomanized?: boolean;
  reaction?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentPages?: number | null;
  sources?: string | null;
  createdAt: string;
}

export default function ChatPage() {
  const router = useRouter();

  // User state
  const [user, setUser] = useState<any>(null);
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('en');
  const t: TranslationDictionary = getTranslation(interfaceLang);

  // Health / Alert Banner state
  const [healthStatus, setHealthStatus] = useState<{ available: boolean; reason?: string } | null>(null);

  // Conversation state
  const [conversations, setConversations] = useState<ChatSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  // Input & Streaming state
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [streamingMeta, setStreamingMeta] = useState<{
    detectedLanguage?: string;
    script?: string;
    isRomanized?: boolean;
    sources?: SourceCitation[];
    suggestedFollowUps?: string[];
  } | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Attached Document state
  const [attachedDoc, setAttachedDoc] = useState<{
    id: string;
    fileName: string;
    pageCount: number;
    uploading?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Context Document filter
  const [availableDocs, setAvailableDocs] = useState<Array<{ id: string; title: string; pageCount: number }>>([]);
  const [selectedContextDocId, setSelectedContextDocId] = useState<string>('all');

  // Manual language override
  const [languageOverride, setLanguageOverride] = useState<string>('auto');

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocLibraryOpen, setIsDocLibraryOpen] = useState(false);
  const [activeSourcePreview, setActiveSourcePreview] = useState<{ source: SourceCitation; index: number } | null>(null);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [expandedSourcesMessageId, setExpandedSourcesMessageId] = useState<string | null>(null);

  // UI helpers: auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // loadConversations must be declared before the useEffect that uses it
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  }, []);

  // Check health and user on mount
  useEffect(() => {
    // 1. Fetch current user
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (data.user.interfaceLanguage) {
            setInterfaceLang(data.user.interfaceLanguage as InterfaceLanguage);
          }
          if (data.user.theme) {
            const isDark =
              data.user.theme === 'dark' ||
              (data.user.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.classList.toggle('dark', isDark);
          }
          if (data.user.fontSize) {
            document.body.setAttribute('data-font-size', data.user.fontSize);
          }
        }
      })
      .catch(() => router.push('/login'));

    // 2. Health self-test
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.ai) {
          setHealthStatus({
            available: data.ai.available,
            reason: data.ai.reason || undefined,
          });
        }
      })
      .catch((err) => console.warn('Health check error:', err));

    // 3. Load conversations
    loadConversations();

    // 4. Load available documents
    fetch('/api/documents')
      .then((res) => res.json())
      .then((data) => {
        if (data.documents) {
          setAvailableDocs(data.documents);
        }
      })
      .catch(() => {});
  }, [router, loadConversations]);

  // Load messages when activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    setChatError(null);
    fetch(`/api/conversations/${activeConversationId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
        }
      })
      .catch((err) => console.error('Error loading chat messages:', err))
      .finally(() => setLoadingMessages(false));
  }, [activeConversationId]);

  // Handle auto-scroll
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom(isStreaming ? 'auto' : 'smooth');
  }, [messages, streamingText, isStreaming]);

  // Monitor scroll for "Scroll to bottom" button
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isUp);
  };

  // Start a new chat
  const handleNewChat = () => {
    setActiveConversationId(undefined);
    setMessages([]);
    setStreamingText('');
    setStreamingMeta(null);
    setAttachedDoc(null);
    setChatError(null);
    setInputMessage('');
  };

  // Handle document/image upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setAttachedDoc({
      id: '',
      fileName: file.name,
      pageCount: 1,
      uploading: true,
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setAttachedDoc({
        id: data.document.id,
        fileName: data.document.fileName,
        pageCount: data.document.pageCount || 1,
        uploading: false,
      });

      // Refresh available docs
      const docsRes = await fetch('/api/documents');
      const docsData = await docsRes.json();
      if (docsData.documents) {
        setAvailableDocs(docsData.documents);
      }
    } catch (err: unknown) {
      alert(`File upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setAttachedDoc(null);
    }
  };

  // Send message with SSE streaming
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isStreaming) return;

    setInputMessage('');
    setChatError(null);

    // Optimistic user message representation
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const optimisticUserMsg: MessageItem = {
      id: tempUserMsgId,
      role: 'user',
      content: text,
      attachmentName: attachedDoc?.fileName,
      attachmentPages: attachedDoc?.pageCount,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsStreaming(true);
    setStreamingText('');
    setStreamingMeta(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const payload = {
        conversationId: activeConversationId,
        message: text,
        attachedDocumentId: attachedDoc?.id || undefined,
        selectedDocumentIds: selectedContextDocId !== 'all' ? [selectedContextDocId] : undefined,
        manualLanguageOverride: languageOverride !== 'auto' ? languageOverride : undefined,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No readable stream response from server');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let activeConversationSet = false;
      let accumulatedClientText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Handle both CRLF and LF delimiters
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!block.trim()) continue;

          // Parse SSE event and data lines
          let eventType = 'chunk';
          const dataLines: string[] = [];

          for (const rawLine of block.split(/\r?\n/)) {
            const trimmed = rawLine.trim();
            if (trimmed.startsWith('event:')) {
              eventType = trimmed.slice(6).trim();
            } else if (trimmed.startsWith('data:')) {
              dataLines.push(trimmed.slice(5).trim());
            }
          }

          const dataText = dataLines.join('\n');
          let parsedData: any = {};
          if (dataText) {
            try {
              parsedData = JSON.parse(dataText);
            } catch {
              parsedData = { text: dataText };
            }
          }

          if (eventType === 'meta') {
            if (parsedData.conversationId && !activeConversationSet) {
              activeConversationSet = true;
              if (!activeConversationId) {
                setActiveConversationId(parsedData.conversationId);
                loadConversations();
              }
            }

            setStreamingMeta({
              detectedLanguage: parsedData.detectedLanguage,
              script: parsedData.script,
              isRomanized: parsedData.isRomanized,
              sources: parsedData.sources || [],
              suggestedFollowUps: parsedData.suggestedFollowUps || [],
            });

            // Update user message detection details in local state
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempUserMsgId
                  ? {
                      ...m,
                      id: parsedData.userMessageId || m.id,
                      detectedLanguage: parsedData.detectedLanguage,
                      script: parsedData.script,
                      isRomanized: parsedData.isRomanized,
                    }
                  : m
              )
            );
          } else if (eventType === 'chunk') {
            if (parsedData.text) {
              accumulatedClientText += parsedData.text;
              setStreamingText((prev) => prev + parsedData.text);
            }
          } else if (eventType === 'done') {
            // Append the finished assistant message
            const finalAssistantMsg: MessageItem = {
              id: parsedData.messageId || `msg-done-${Date.now()}`,
              role: 'assistant',
              content: parsedData.fullText || accumulatedClientText,
              detectedLanguage: streamingMeta?.detectedLanguage,
              script: streamingMeta?.script,
              isRomanized: streamingMeta?.isRomanized,
              sources: streamingMeta?.sources ? JSON.stringify(streamingMeta.sources) : null,
              createdAt: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, finalAssistantMsg]);
            setStreamingText('');
            setStreamingMeta(null);
            loadConversations();
          } else if (eventType === 'error') {
            throw new Error(parsedData.error || 'AI generation encountered an error');
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Failed to communicate with PolyRAG';
        setChatError(errorMsg);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      if (streamingText) {
        // Save whatever text was streamed so far
        const partialMsg: MessageItem = {
          id: `partial-${Date.now()}`,
          role: 'assistant',
          content: streamingText,
          detectedLanguage: streamingMeta?.detectedLanguage,
          sources: streamingMeta?.sources ? JSON.stringify(streamingMeta.sources) : null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, partialMsg]);
        setStreamingText('');
        setStreamingMeta(null);
      }
    }
  };

  // Reactions & Actions
  const handleReaction = async (messageId: string, currentReaction?: string | null, newReaction?: 'like' | 'dislike') => {
    const updatedReaction = currentReaction === newReaction ? null : newReaction;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reaction: updatedReaction } : m))
    );

    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: updatedReaction }),
      });
    } catch (e) {
      console.error('Failed to update reaction:', e);
    }
  };

  const handleCopyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleShareMessage = async (content: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PolyRAG Response',
          text: content,
        });
        return;
      } catch {
        // user cancelled or share failed, fallback
      }
    }
    navigator.clipboard.writeText(content);
    alert('Response copied to clipboard!');
  };

  const handleDownloadMarkdown = (title: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditResend = (originalMessageId: string) => {
    const msg = messages.find((m) => m.id === originalMessageId);
    if (!msg) return;

    if (editContent.trim()) {
      // Remove messages after this one and re-send
      const msgIndex = messages.findIndex((m) => m.id === originalMessageId);
      const remainingMessages = messages.slice(0, msgIndex);
      setMessages(remainingMessages);
      setEditingMessageId(null);
      handleSendMessage(editContent.trim());
    }
  };

  // Sidebar actions
  const handleRenameChat = async (id: string, currentTitle: string) => {
    const newTitle = window.prompt('Rename conversation:', currentTitle);
    if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
      try {
        await fetch(`/api/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle.trim() }),
        });
        loadConversations();
      } catch (err) {
        console.error('Rename error:', err);
      }
    }
  };

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      loadConversations();
    } catch (err) {
      console.error('Pin error:', err);
    }
  };

  const handleDeleteChat = async (id: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (activeConversationId === id) {
        handleNewChat();
      }
      loadConversations();
    } catch (err) {
      console.error('Delete chat error:', err);
    }
  };

  const handleExportMarkdown = (id: string) => {
    window.open(`/api/conversations/${id}/export?format=md`, '_blank');
  };

  const handleExportAllJson = () => {
    if (activeConversationId) {
      window.open(`/api/conversations/${activeConversationId}/export?format=json`, '_blank');
    } else {
      alert('Open a conversation first to export its data.');
    }
  };

  const handleDeleteAllChats = async () => {
    await fetch('/api/conversations', { method: 'DELETE' });
    setConversations([]);
    handleNewChat();
  };

  const handleDeleteAccount = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' });
    router.push('/login');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100">
      {/* Sidebar Component */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onTogglePin={handleTogglePin}
        onDeleteChat={handleDeleteChat}
        onExportMarkdown={handleExportMarkdown}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDocLibrary={() => setIsDocLibraryOpen(true)}
        onLogout={handleLogout}
        userName={user?.name}
        userEmail={user?.email}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
        t={t}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-200/80 dark:border-slate-800/80 px-4 flex items-center justify-between bg-white/70 dark:bg-slate-900/70 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarMobileOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 md:hidden"
              title="Open drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Context Document Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <select
                value={selectedContextDocId}
                onChange={(e) => setSelectedContextDocId(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none max-w-[140px] sm:max-w-[200px] truncate"
              >
                <option value="all">{t.allDocs}</option>
                {availableDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.pageCount} pgs)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Header Controls: Manual language override dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <span className="text-[11px] text-slate-400 hidden sm:inline">Reply in:</span>
              <select
                value={languageOverride}
                onChange={(e) => setLanguageOverride(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none font-medium max-w-[120px] truncate"
              >
                <option value="auto">Auto-detect</option>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Health status warning banner if Gemini is unconfigured or model retired */}
        {healthStatus && !healthStatus.available && (
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>AI model unavailable:</strong> {healthStatus.reason || 'Please check GEMINI_API_KEY in .env'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setHealthStatus(null)}
              className="text-amber-600 hover:text-amber-900 dark:hover:text-amber-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Chat Scroll Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6"
        >
          {loadingMessages ? (
            <div className="flex items-center justify-center py-20 gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 && !streamingText ? (
            /* Empty State: "How can I help you today?" with 4 clickable sample prompts */
            <div className="max-w-2xl mx-auto py-12 text-center select-none animate-fade-in">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {t.emptyTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
                {t.appSubtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {/* 1. General prompt */}
                <button
                  type="button"
                  onClick={() => handleSendMessage(t.exampleGeneral)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all text-xs group"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 mb-1">
                    General Knowledge
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 line-clamp-2">
                    {t.exampleGeneral}
                  </div>
                </button>

                {/* 2. Document prompt */}
                <button
                  type="button"
                  onClick={() => handleSendMessage(t.exampleDoc)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all text-xs group"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 mb-1">
                    Document Intelligence
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 line-clamp-2">
                    {t.exampleDoc}
                  </div>
                </button>

                {/* 3. Tamil prompt */}
                <button
                  type="button"
                  onClick={() => handleSendMessage(t.exampleTamil)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all text-xs group"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 mb-1">
                    தமிழ் வினவல் (Tamil)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 line-clamp-2 font-sans">
                    {t.exampleTamil}
                  </div>
                </button>

                {/* 4. Hindi prompt */}
                <button
                  type="button"
                  onClick={() => handleSendMessage(t.exampleHindi)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all text-xs group"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 mb-1">
                    हिन्दी प्रश्न (Hindi)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 line-clamp-2 font-sans">
                    {t.exampleHindi}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              let sourcesList: SourceCitation[] = [];
              if (msg.sources) {
                try {
                  sourcesList = JSON.parse(msg.sources);
                } catch {
                  sourcesList = [];
                }
              }

              const isSourcesExpanded = expandedSourcesMessageId === msg.id;
              const isRtl = msg.detectedLanguage ? isRtlLanguage(msg.detectedLanguage) : false;

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full`}
                >
                  {/* Bubble Container */}
                  <div
                    className={`group relative rounded-2xl px-4 py-3.5 text-sm transition-all shadow-xs ${
                      isUser
                        ? 'bg-emerald-600 text-white rounded-br-xs max-w-[85%]'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs w-full'
                    }`}
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    {/* User bubble: attached document chip */}
                    {isUser && msg.attachmentName && (
                      <div className="mb-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-700/80 text-emerald-100 text-xs border border-emerald-500/50">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium truncate max-w-[200px]">{msg.attachmentName}</span>
                        {msg.attachmentPages ? (
                          <span className="text-[10px] opacity-80">({msg.attachmentPages} pgs)</span>
                        ) : null}
                      </div>
                    )}

                    {/* Edit mode for user message */}
                    {isUser && editingMessageId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 rounded-lg bg-emerald-700 text-white text-xs border border-emerald-400 focus:outline-none"
                          rows={3}
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="px-2.5 py-1 rounded-md text-[11px] bg-emerald-800 hover:bg-emerald-900 text-emerald-200"
                          >
                            {t.cancel}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditResend(msg.id)}
                            className="px-2.5 py-1 rounded-md text-[11px] bg-white text-emerald-800 font-semibold hover:bg-emerald-50"
                          >
                            {t.saveSubmit}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Render Formatted Markdown */
                      <MarkdownRenderer
                        content={msg.content}
                        onCitationClick={(citationNum) => {
                          const src = sourcesList[citationNum - 1];
                          if (src) {
                            setActiveSourcePreview({ source: src, index: citationNum });
                          }
                        }}
                      />
                    )}

                    {/* Collapsible Sources Panel for Assistant */}
                    {!isUser && sourcesList.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSourcesMessageId(isSourcesExpanded ? null : msg.id)
                          }
                          className="flex items-center justify-between w-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:opacity-80 transition-opacity"
                        >
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            <span>
                              {t.sources} ({sourcesList.length})
                            </span>
                          </div>
                          {isSourcesExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isSourcesExpanded && (
                          <div className="mt-2.5 space-y-2 animate-fade-in">
                            {sourcesList.map((src, sIdx) => (
                              <div
                                key={sIdx}
                                onClick={() => setActiveSourcePreview({ source: src, index: sIdx + 1 })}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-500 cursor-pointer transition-all text-xs"
                              >
                                <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                  <span className="truncate max-w-xs">
                                    [{sIdx + 1}] {src.documentTitle}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Page {src.pageNumber}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                  &quot;{src.snippet}&quot;
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar & Language Badge underneath bubble */}
                  <div
                    className={`flex items-center gap-2 mt-1 px-1 text-xs text-slate-400 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Detected Language Badge */}
                    <LanguageBadge
                      detectedLanguage={msg.detectedLanguage}
                      script={msg.script}
                      isRomanized={msg.isRomanized}
                      onLanguageChange={(newLang) => {
                        handleSendMessage(
                          `Please explain your previous answer in ${SUPPORTED_LANGUAGES.find((l) => l.code === newLang)?.name || newLang}.`
                        );
                      }}
                    />

                    {/* Copy action */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      title={copiedMessageId === msg.id ? t.copied : t.copy}
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    {/* Assistant specific actions: Like, Dislike, Regenerate, Download, Share */}
                    {!isUser && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReaction(msg.id, msg.reaction, 'like')}
                          className={`hover:text-emerald-500 transition-colors p-1 ${
                            msg.reaction === 'like' ? 'text-emerald-500 font-bold' : ''
                          }`}
                          title={t.like}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReaction(msg.id, msg.reaction, 'dislike')}
                          className={`hover:text-red-500 transition-colors p-1 ${
                            msg.reaction === 'dislike' ? 'text-red-500 font-bold' : ''
                          }`}
                          title={t.dislike}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Find the preceding user message to regenerate
                            const userMsg = messages[index - 1];
                            if (userMsg) {
                              handleSendMessage(userMsg.content);
                            }
                          }}
                          className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                          title={t.regenerate}
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadMarkdown(`polyrag-response-${index}`, msg.content)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                          title="Download Markdown"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareMessage(msg.content)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                          title={t.share}
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    {/* User edit action */}
                    {isUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setEditContent(msg.content);
                        }}
                        className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                        title={t.edit}
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Live Streaming Bubble */}
          {isStreaming && (
            <div className="flex flex-col items-start max-w-3xl mx-auto w-full animate-fade-in">
              <div className="rounded-2xl rounded-bl-xs px-4 py-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs w-full">
                {streamingText ? (
                  <MarkdownRenderer
                    content={streamingText}
                    onCitationClick={(citationNum) => {
                      if (streamingMeta?.sources?.[citationNum - 1]) {
                        setActiveSourcePreview({
                          source: streamingMeta.sources[citationNum - 1],
                          index: citationNum,
                        });
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span>Analyzing documents & formulating answer...</span>
                  </div>
                )}
              </div>

              {/* Streaming Language Badge Indicator */}
              {streamingMeta?.detectedLanguage && (
                <div className="flex items-center gap-2 mt-1 px-1 text-xs text-slate-400">
                  <LanguageBadge
                    detectedLanguage={streamingMeta.detectedLanguage}
                    script={streamingMeta.script}
                    isRomanized={streamingMeta.isRomanized}
                    interactive={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* Visible Error Banner with Retry */}
          {chatError && (
            <div className="max-w-3xl mx-auto p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{chatError}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                  if (lastUser) {
                    handleSendMessage(lastUser.content);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center gap-1 transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>{t.retry}</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-24 right-8 z-20 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-md hover:bg-slate-50 transition-all"
            title="Scroll to latest message"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Bottom Input Area */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attached file chip above input */}
            {attachedDoc && (
              <div className="mb-2 flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="font-medium truncate max-w-xs">{attachedDoc.fileName}</span>
                  {attachedDoc.uploading ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Ingesting...
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      ({attachedDoc.pageCount} pgs)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setAttachedDoc(null)}
                    className="p-0.5 rounded hover:bg-emerald-200/60 dark:hover:bg-emerald-900 transition-colors ml-1"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Hidden File inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />

            {/* Input Form Box */}
            <div className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800/90 rounded-2xl p-2 border border-slate-200 dark:border-slate-700/80 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              {/* Attachment '+' Dropdown Button */}
              <div className="flex items-center gap-1 shrink-0 pb-1 pl-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title={t.uploadDoc}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title={t.uploadImage}
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder={t.inputPlaceholder}
                className="flex-1 bg-transparent border-0 resize-none max-h-36 py-2 px-1 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none leading-relaxed"
                style={{ minHeight: '38px' }}
              />

              {/* Send or Stop Button */}
              <div className="shrink-0 pb-0.5 pr-0.5">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopStreaming}
                    className="p-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors shadow-sm"
                    title={t.stop}
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isStreaming}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t.send}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {user && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          onUpdateUser={(updated) => {
            setUser(updated);
            if (updated.interfaceLanguage) {
              setInterfaceLang(updated.interfaceLanguage as InterfaceLanguage);
            }
          }}
          onExportAllJson={handleExportAllJson}
          onDeleteAllChats={handleDeleteAllChats}
          onDeleteAccount={handleDeleteAccount}
          t={t}
        />
      )}

      {/* Document Library Modal */}
      <DocumentLibraryModal
        isOpen={isDocLibraryOpen}
        onClose={() => setIsDocLibraryOpen(false)}
        onSelectDocForChat={(docId, title) => {
          setSelectedContextDocId(docId);
          setAttachedDoc({ id: docId, fileName: title, pageCount: 1 });
        }}
        t={t}
      />

      {/* Source Citation Inspector Modal */}
      <SourcePreviewModal
        isOpen={activeSourcePreview !== null}
        onClose={() => setActiveSourcePreview(null)}
        source={activeSourcePreview?.source || null}
        citationIndex={activeSourcePreview?.index}
      />
    </div>
  );
}
