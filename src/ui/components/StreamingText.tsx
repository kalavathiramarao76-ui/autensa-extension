import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { marked, Renderer } from 'marked';

/* ── Streaming-aware renderer ── */
function createStreamingRenderer(isComplete: boolean) {
  const renderer = new Renderer();

  /* Links open in new tab */
  renderer.link = function ({ href, text }: { href: string; text: string }) {
    const escaped = (text || href || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
  };

  /* Wrap tables in scrollable container */
  renderer.table = function ({ header, body }: { header: string; body: string }) {
    return `<div class="table-scroll-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  };

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

    // Complete code blocks get copy button; in-progress ones get streaming indicator
    if (isComplete) {
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
    }

    return `<div class="code-block-wrapper" data-code="${escaped}">
  <div class="code-block-header">
    ${badge}
    <span class="code-streaming-indicator">streaming...</span>
  </div>
  <pre class="code-block-pre"><code class="language-${lang || 'text'}">${escaped}</code></pre>
</div>`;
  };

  return renderer;
}

/* ── Detect and handle incomplete code blocks ── */
function preprocessIncompleteCodeBlocks(text: string): { processed: string; hasIncomplete: boolean } {
  // Count triple backticks (only at start of line or after newline)
  const fenceMatches = text.match(/```/g);
  const fenceCount = fenceMatches ? fenceMatches.length : 0;

  if (fenceCount % 2 !== 0) {
    // Odd number = there's an unclosed code block. Close it so marked can parse it.
    return { processed: text + '\n```', hasIncomplete: true };
  }

  return { processed: text, hasIncomplete: false };
}

interface Props {
  text: string;
}

export function StreamingText({ text }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const lastParsedRef = useRef('');
  const lastHtmlRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const [renderedHtml, setRenderedHtml] = React.useState('');

  // Debounced markdown parsing — 50ms
  useEffect(() => {
    if (!text) {
      setRenderedHtml('');
      lastParsedRef.current = '';
      lastHtmlRef.current = '';
      return;
    }

    // If text hasn't changed from last parse, skip
    if (text === lastParsedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { processed, hasIncomplete } = preprocessIncompleteCodeBlocks(text);

      const renderer = createStreamingRenderer(!hasIncomplete);
      const html = marked.parse(processed, { breaks: true, gfm: true, renderer }) as string;

      lastParsedRef.current = text;
      lastHtmlRef.current = html;
      setRenderedHtml(html);
    }, 50);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text]);

  // Attach copy handlers for any completed code blocks
  useEffect(() => {
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
  }, [renderedHtml]);

  if (!text) return null;

  return (
    <div className="streaming-text-container">
      <div
        ref={contentRef}
        className="prose prose-sm max-w-none
          prose-p:text-text-primary prose-p:leading-relaxed prose-p:my-1.5
          prose-headings:text-text-primary prose-headings:mt-4 prose-headings:mb-2
          prose-code:text-accent prose-code:bg-surface-3 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
          prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:border-0
          prose-a:text-[#6366f1] prose-a:no-underline hover:prose-a:underline prose-a:cursor-pointer
          prose-li:text-text-primary prose-li:my-0.5
          prose-strong:text-text-primary"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
      <span className="streaming-cursor" />
    </div>
  );
}
