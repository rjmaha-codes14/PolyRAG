'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  MoreVertical,
  Edit2,
  Trash2,
  Download,
  Settings,
  LogOut,
  Files,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { TranslationDictionary } from '@/lib/i18n';

export interface ChatSummary {
  id: string;
  title: string;
  isPinned: boolean;
  detectedLanguage?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface SidebarProps {
  conversations: ChatSummary[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, currentTitle: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDeleteChat: (id: string) => void;
  onExportMarkdown: (id: string) => void;
  onOpenSettings: () => void;
  onOpenDocLibrary: () => void;
  onLogout: () => void;
  userName?: string | null;
  userEmail?: string;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  t: TranslationDictionary;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameChat,
  onTogglePin,
  onDeleteChat,
  onExportMarkdown,
  onOpenSettings,
  onOpenDocLibrary,
  onLogout,
  userName,
  userEmail,
  isOpenMobile,
  onCloseMobile,
  t,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K to focus search, Ctrl+Shift+O for new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        onNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewChat]);

  // Close popup menu on outside click
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.chat-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Filter conversations
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Grouping: Pinned, Today, Yesterday, Previous 7 days, Older
  const pinnedList: ChatSummary[] = [];
  const todayList: ChatSummary[] = [];
  const yesterdayList: ChatSummary[] = [];
  const prev7DaysList: ChatSummary[] = [];
  const olderList: ChatSummary[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7DaysAgo = startOfToday - 6 * 86400000;

  for (const c of filtered) {
    if (c.isPinned) {
      pinnedList.push(c);
      continue;
    }

    const time = new Date(c.updatedAt || c.createdAt).getTime();
    if (time >= startOfToday) {
      todayList.push(c);
    } else if (time >= startOfYesterday) {
      yesterdayList.push(c);
    } else if (time >= startOf7DaysAgo) {
      prev7DaysList.push(c);
    } else {
      olderList.push(c);
    }
  }

  const renderGroup = (title: string, list: ChatSummary[]) => {
    if (list.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5 mt-1">
          {list.map((c) => {
            const isActive = c.id === activeConversationId;
            const isMenuOpen = activeMenuId === c.id;

            return (
              <div
                key={c.id}
                className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors cursor-pointer select-none ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
                onClick={() => {
                  onSelectConversation(c.id);
                  onCloseMobile();
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{c.title || 'Untitled chat'}</span>
                </div>

                {/* 3-dots actions menu */}
                <div className="relative chat-menu-container">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : c.id);
                    }}
                    className={`p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity ${
                      isMenuOpen || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title="Chat actions"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-8 z-50 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onRenameChat(c.id, c.title);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{t.rename}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onTogglePin(c.id, c.isPinned);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
                      >
                        {c.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        <span>{c.isPinned ? t.unpin : t.pin}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onExportMarkdown(c.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t.exportMarkdown}</span>
                      </button>

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onDeleteChat(c.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.delete}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container: fixed drawer on mobile, static on >= 900px */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                PolyRAG
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Multilingual AI & RAG
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 md:hidden"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Controls: New Chat + Search */}
        <div className="p-3 space-y-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm shadow-emerald-600/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>{t.newChat}</span>
            </div>
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-emerald-700/60 text-[10px] text-emerald-100 font-mono">
              Ctrl+Shift+O
            </kbd>
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchChats}
              className="w-full pl-8 pr-11 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-transparent dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-500 dark:text-slate-400 font-mono select-none">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 select-none">
          {renderGroup(t.pinned, pinnedList)}
          {renderGroup(t.today, todayList)}
          {renderGroup(t.yesterday, yesterdayList)}
          {renderGroup(t.prev7Days, prev7DaysList)}
          {renderGroup(t.older, olderList)}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </div>
          )}
        </div>

        {/* Bottom Profile & Utilities */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onOpenDocLibrary}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Files className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t.docsLibrary}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>{t.settings}</span>
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 px-2">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {userName || 'User'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{userEmail}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={t.logOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
