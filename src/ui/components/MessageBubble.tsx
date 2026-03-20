import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Message } from '@/shared/types';
import { marked, Renderer } from 'marked';

/* ── Custom renderer: language badge + copy-button shell ── */
const renderer = new Renderer();
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const langLabel = (lang || '').toUpperCase();
  const badge = langLabel
    ? `<span class="code-lang-badge">${langLabel}</span>`
    : '';
  return `<div class="code-block-wrapper" data-code="${escaped}">
  <div class="code-block-header">
    ${badge}
    <button class="code-copy-btn" aria-label="Copy code">
      <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre class="code-block-pre"><code class="language-${lang || 'text'}">${escaped}</code></pre>
</div>`;
};

marked.setOptions({ breaks: true, gfm: true, renderer });

/* ── Component ── */
interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    if (isUser) return null;
    return marked.parse(message.content) as string;
  }, [message.content, isUser]);

  /* Attach copy-button handlers after render */
  const attachCopyHandlers = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const buttons = el.querySelectorAll<HTMLButtonElement>('.code-copy-btn');
    buttons.forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const wrapper = btn.closest('.code-block-wrapper') as HTMLElement | null;
        if (!wrapper) return;
        const raw = wrapper.dataset.code || '';
        const decoded = raw
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&');
        navigator.clipboard.writeText(decoded).then(() => {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 2000);
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!isUser && html) attachCopyHandlers();
  }, [html, isUser, attachCopyHandlers]);

  return (
    <div className={`${isUser ? 'flex justify-end msg-user' : 'msg-assistant'}`}>
      <div className={`max-w-[95%] ${isUser
        ? 'bg-accent/15 text-text-primary rounded-2xl rounded-br-md px-4 py-2.5'
        : 'text-text-primary'
      }`}>
        {isUser ? (
          <p className="text-base leading-relaxed">{message.content}</p>
        ) : (
          <div
            ref={contentRef}
            className="prose prose-invert prose-sm max-w-none
              prose-p:text-text-primary prose-p:leading-relaxed prose-p:my-1.5
              prose-headings:text-text-primary prose-headings:mt-4 prose-headings:mb-2
              prose-code:text-accent prose-code:bg-surface-3 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
              prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:border-0
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-li:text-text-primary prose-li:my-0.5
              prose-strong:text-text-primary"
            dangerouslySetInnerHTML={{ __html: html || '' }}
          />
        )}
      </div>

      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {message.toolCalls.map(tc => (
            <div key={tc.id} className="tool-badge">
              <span className={tc.status === 'success' ? 'text-success' : tc.status === 'error' ? 'text-error' : 'text-warning'}>
                {tc.status === 'success' ? '✓' : tc.status === 'error' ? '✗' : '⋯'}
              </span>
              <span>{tc.name.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
