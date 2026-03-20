import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAgent } from '../hooks/useAgent';
import { useSettings } from '../hooks/useSettings';
import { MessageBubble } from '../components/MessageBubble';
import { StreamingText } from '../components/StreamingText';
import { ToolExecution } from '../components/ToolExecution';
import { Input } from '../components/Input';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { QUICK_ACTIONS } from '@/shared/constants';
import { Session } from '@/shared/types';
import { estimateTokens, formatTokenCount } from '@/shared/tokenizer';

interface ChatViewProps {
  onOpenHistory?: () => void;
  sessionToRestore?: Session | null;
  onSessionRestored?: () => void;
}

export function ChatView({ onOpenHistory, sessionToRestore, onSessionRestored }: ChatViewProps) {
  const {
    messages, isStreaming, streamingText, activeTools, sessionId,
    sessionUsage, rateLimit,
    sendMessage, clearMessages, restoreSession, newSession,
  } = useAgent();
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live input token count
  const inputTokens = useMemo(() => estimateTokens(input), [input]);

  // Handle session restore from history
  useEffect(() => {
    if (sessionToRestore) {
      restoreSession(sessionToRestore);
      onSessionRestored?.();
    }
  }, [sessionToRestore, restoreSession, onSessionRestored]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, activeTools]);

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleQuickAction = (prompt: string) => {
    if (isStreaming) return;
    sendMessage(prompt);
  };

  const handleNewChat = () => {
    newSession();
  };

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">Autensa</span>
        </div>
        <div className="flex items-center gap-1">
          {onOpenHistory && (
            <button onClick={onOpenHistory} className="btn-ghost !px-2 !py-1 text-xs" title="History">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={handleNewChat} className="btn-ghost !px-2 !py-1 text-xs" title="New chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <ConnectionStatus />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <p className="text-text-secondary text-sm mb-6">What can I do for you?</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {QUICK_ACTIONS.slice(0, 4).map(action => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="card-interactive !p-3 text-left group"
                >
                  <span className="text-lg mb-1 block">{action.icon}</span>
                  <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {activeTools.length > 0 && (
          <ToolExecution tools={activeTools} />
        )}

        {isStreaming && streamingText && (
          <div className="animate-fade-in">
            <StreamingText text={streamingText} />
          </div>
        )}

        {isStreaming && !streamingText && activeTools.length === 0 && (
          <div className="thinking-indicator animate-fade-in">
            <div className="thinking-dots">
              <div className="thinking-dot" style={{ animationDelay: '0ms' }} />
              <div className="thinking-dot" style={{ animationDelay: '160ms' }} />
              <div className="thinking-dot" style={{ animationDelay: '320ms' }} />
            </div>
            <div className="thinking-bar" />
            <span className="text-xs text-text-tertiary">Thinking...</span>
          </div>
        )}
      </div>

      {/* Session Stats Bar — only when messages exist */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-5 py-1.5 border-t border-border text-2xs text-text-tertiary font-mono select-none">
          <span>{messages.length} msg{messages.length !== 1 ? 's' : ''}</span>
          <span>{formatTokenCount(sessionUsage.totalTokens)} tokens{sessionUsage.estimated ? '' : ' (actual)'}</span>
          <span className="truncate max-w-[120px]">{settings.model}</span>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        {/* Rate limit indicator */}
        {rateLimit.limited && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-error/10 text-error text-2xs font-mono animate-fade-in">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            <span>Rate limited — retry in <strong>{rateLimit.retryAfter}s</strong></span>
          </div>
        )}
        {!rateLimit.limited && rateLimit.warning && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-2xs font-mono animate-pulse-soft">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <path d="M12 9v4M12 17h.01"/>
            </svg>
            <span>High request rate ({rateLimit.requestsPerMinute}/min)</span>
          </div>
        )}

        <Input
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isStreaming || rateLimit.limited}
          autoFocus
        />

        {/* Token counter below input */}
        <div className="flex items-center justify-between mt-1.5 px-1 text-2xs text-text-tertiary font-mono select-none">
          <span>{inputTokens > 0 ? `${formatTokenCount(inputTokens)} tokens` : '\u00A0'}</span>
          {sessionUsage.totalTokens > 0 && (
            <span>{formatTokenCount(sessionUsage.totalTokens)} session</span>
          )}
        </div>
      </div>
    </div>
  );
}
