'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '@/lib/languages';

interface LanguageBadgeProps {
  detectedLanguage?: string | null;
  script?: string | null;
  isRomanized?: boolean;
  onLanguageChange?: (langCode: string) => void;
  interactive?: boolean;
}

export const LanguageBadge: React.FC<LanguageBadgeProps> = ({
  detectedLanguage,
  script,
  isRomanized,
  onLanguageChange,
  interactive = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const langInfo = detectedLanguage ? getLanguageByCode(detectedLanguage) : undefined;
  const displayName = langInfo ? langInfo.nativeName : detectedLanguage?.toUpperCase() || 'Auto';
  const subText = isRomanized ? 'Romanized' : script && script !== 'Unknown' ? script : '';

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        disabled={!interactive}
        onClick={() => interactive && setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
          interactive
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer'
            : 'bg-transparent text-slate-400 border-transparent cursor-default'
        }`}
        title={`Language: ${langInfo?.name || displayName} ${subText ? `(${subText})` : ''} - Click to change`}
      >
        <Globe className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
        <span>{displayName}</span>
        {subText ? <span className="opacity-60 text-[9px]">({subText})</span> : null}
        {interactive ? <ChevronDown className="w-2.5 h-2.5 opacity-60" /> : null}
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-1 z-50 w-52 max-h-60 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs animate-fade-in">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
            Switch Language
          </div>
          <div className="py-1">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  onLanguageChange?.(l.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors ${
                  l.code === detectedLanguage ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{l.nativeName}</span>
                <span className="text-[10px] text-slate-400">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
