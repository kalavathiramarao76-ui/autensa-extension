import React, { useMemo } from 'react';
import { Message } from '@/shared/types';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  const html = useMemo(() => {
    if (isUser) return null;
    return marked.parse(message.content) as string;
  }, [message.content, isUser]);

  return (
    <div className={`animate-fade-in ${isUser ? 'flex justify-end' : ''}`}>
      <div className={`max-w-[95%] ${isUser
        ? 'bg-accent/15 text-text-primary rounded-2xl rounded-br-md px-4 py-2.5'
        : 'text-text-primary'
      }`}>
        {isUser ? (
          <p className="text-base leading-relaxed">{message.content}</p>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-p:text-text-primary prose-p:leading-relaxed prose-p:my-1.5
              prose-headings:text-text-primary prose-headings:mt-4 prose-headings:mb-2
              prose-code:text-accent prose-code:bg-surface-3 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
              prose-pre:bg-surface-2 prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:p-4
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
