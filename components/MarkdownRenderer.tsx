'use client';

import React, { useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onCitationClick?: (citationNumber: number) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onCitationClick }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Parse markdown content into code blocks, paragraphs, lists, headers, etc.
  const renderFormattedContent = () => {
    if (!content) return null;

    // Split code blocks ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let codeIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const precedingText = content.substring(lastIndex, match.index);
      if (precedingText) {
        parts.push(renderTextBlocks(precedingText, `text-${lastIndex}`));
      }

      const lang = match[1] || 'code';
      const code = match[2];
      const curIndex = codeIndex++;

      parts.push(
        <div key={`code-${curIndex}`} className="my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono shadow-sm">
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400 select-none">
            <span className="text-[11px] uppercase tracking-wider font-semibold">{lang}</span>
            <button
              type="button"
              onClick={() => handleCopyCode(code, curIndex)}
              className="flex items-center gap-1 hover:text-white transition-colors p-1"
              title="Copy code"
            >
              {copiedIndex === curIndex ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3.5 overflow-x-auto leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    const remainingText = content.substring(lastIndex);
    if (remainingText) {
      parts.push(renderTextBlocks(remainingText, `text-end-${lastIndex}`));
    }

    return parts;
  };

  const renderTextBlocks = (rawText: string, keyPrefix: string) => {
    const paragraphs = rawText.split(/\n{2,}/);

    return paragraphs.map((para, pIdx) => {
      const trimmed = para.trim();
      if (!trimmed) return null;

      // Headers #, ##, ###
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={`${keyPrefix}-h3-${pIdx}`} className="text-base font-semibold text-slate-900 dark:text-white mt-3 mb-1.5">
            {renderInlineMarkdown(trimmed.substring(4))}
          </h3>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={`${keyPrefix}-h2-${pIdx}`} className="text-lg font-semibold text-slate-900 dark:text-white mt-4 mb-2">
            {renderInlineMarkdown(trimmed.substring(3))}
          </h2>
        );
      }
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={`${keyPrefix}-h1-${pIdx}`} className="text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2">
            {renderInlineMarkdown(trimmed.substring(2))}
          </h1>
        );
      }

      // Blockquotes >
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={`${keyPrefix}-quote-${pIdx}`} className="border-l-4 border-emerald-500 pl-3 py-1 my-2 italic text-slate-600 dark:text-slate-300 bg-slate-50/60 dark:bg-slate-800/40 rounded-r">
            {renderInlineMarkdown(trimmed.substring(2))}
          </blockquote>
        );
      }

      // Lists: check if lines start with - or * or numbers
      const lines = trimmed.split(/\n/);
      const isBulletList = lines.every((line) => /^[-*]\s+/.test(line.trim()));
      const isNumberList = lines.every((line) => /^\d+\.\s+/.test(line.trim()));

      if (isBulletList) {
        return (
          <ul key={`${keyPrefix}-ul-${pIdx}`} className="list-disc pl-5 my-2 space-y-1">
            {lines.map((line, lIdx) => (
              <li key={`li-${lIdx}`} className="text-sm leading-relaxed">
                {renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ''))}
              </li>
            ))}
          </ul>
        );
      }

      if (isNumberList) {
        return (
          <ol key={`${keyPrefix}-ol-${pIdx}`} className="list-decimal pl-5 my-2 space-y-1">
            {lines.map((line, lIdx) => (
              <li key={`oli-${lIdx}`} className="text-sm leading-relaxed">
                {renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ''))}
              </li>
            ))}
          </ol>
        );
      }

      // Normal paragraph
      return (
        <p key={`${keyPrefix}-p-${pIdx}`} className="text-sm leading-relaxed mb-2.5 last:mb-0">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  /**
   * Render bold **text**, inline `code`, links, and citations like [1], [2], [Page 4]
   */
  const renderInlineMarkdown = (text: string) => {
    // Regex for inline code `code`, bold **bold**, citations [1], [2]
    const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\[\d+\]|\[Page\s+\d+\])/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Inline code `code`
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 text-xs font-mono border border-slate-200 dark:border-slate-700">
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold **text**
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Citation like [1], [2]
      const citationMatch = part.match(/^\[(\d+)\]$/);
      if (citationMatch) {
        const citationNum = parseInt(citationMatch[1], 10);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onCitationClick?.(citationNum)}
            className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-all cursor-pointer shadow-2xs"
            title={`View Source ${citationNum}`}
          >
            <FileText className="w-2.5 h-2.5 inline" />
            <span>{citationNum}</span>
          </button>
        );
      }

      // Page citation like [Page 3]
      if (/^\[Page\s+\d+\]$/i.test(part)) {
        return (
          <span key={idx} className="inline-block mx-0.5 px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
            {part}
          </span>
        );
      }

      return <span key={idx}>{part}</span>;
    });
  };

  return <div className="prose-polyrag select-text">{renderFormattedContent()}</div>;
};
