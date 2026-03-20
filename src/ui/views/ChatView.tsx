import React, { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useAgent } from '../hooks/useAgent';
import { useSettings } from '../hooks/useSettings';
import { MessageBubble } from '../components/MessageBubble';
import { StreamingText } from '../components/StreamingText';
import { ToolExecution } from '../components/ToolExecution';
import { Input, InputHandle } from '../components/Input';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { useToast } from '../components/Toast';
import { QUICK_ACTIONS } from '@/shared/constants';
import { Session, ToolCallDisplay } from '@/shared/types';
import { estimateTokens, formatTokenCount } from '@/shared/tokenizer';
import { gridNav, MOD_KEY } from '../hooks/useKeyboardNav';

interface ChatViewProps {
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  sessionToRestore?: Session | null;
  onSessionRestored?: () => void;
}

export interface ChatViewHandle {
  focusInput: () => void;
  clearAndFocus: () => void;
  newChat: () => void;
}

export const ChatView = forwardRef<ChatViewHandle, ChatViewProps>(function ChatView(
  { onOpenHistory, onOpenSettings, sessionToRestore, onSessionRestored },
  fwdRef,
) {
  const {
    messages, isStreaming, streamingText, activeTools, sessionId,
    sessionUsage, rateLimit,
    sendMessage, clearMessages, restoreSession, newSession,
  } = useAgent();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputHandle>(null);
  const prevToolsRef = useRef<ToolCallDisplay[]>([]);

  // Quick actions grid keyboard state
  const [qaIndex, setQaIndex] = useState(-1);
  const qaItems = QUICK_ACTIONS.slice(0, 4);

  // Live input token count
  const inputTokens = useMemo(() => estimateTokens(input), [input]);

  // Expose imperative handle to parent
  useImperativeHandle(fwdRef, () => ({
    focusInput: () => inputRef.current?.focus(),
    clearAndFocus: () => {
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    newChat: () => {
      newSession();
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  }));

  // Handle session restore from history
  useEffect(() => {
    if (sessionToRestore) {
      restoreSession(sessionToRestore);
      onSessionRestored?.();
      toast({ type: 'info', title: 'Session restored' });
    }
  }, [sessionToRestore, restoreSession, onSessionRestored, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, activeTools]);

  // Toast on tool completion
  useEffect(() => {
    const prev = prevToolsRef.current;
    for (const tool of activeTools) {
      const wasPrev = prev.find(t => t.id === tool.id);
      if (wasPrev?.status === 'running' && (tool.status === 'success' || tool.status === 'error')) {
        const label = tool.name
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        if (tool.status === 'success') {
          toast({ type: 'success', title: `${label}` });
        } else {
          const snippet = tool.result ? tool.result.slice(0, 80) : 'Unknown error';
          toast({ type: 'error', title: `Failed: ${label}`, description: snippet });
        }
      }
    }
    prevToolsRef.current = activeTools;
  }, [activeTools, toast]);

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
    toast({ type: 'info', title: 'Chat cleared' });
  };

  const isEmpty = messages.length === 0 && !isStreaming;

  // Quick actions grid keyboard navigation
  useEffect(() => {
    if (!isEmpty) { setQaIndex(-1); return; }

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isInput) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setQaIndex(prev => {
          const cur = prev < 0 ? 0 : prev;
          return gridNav(cur, e.key, 2, qaItems.length);
        });
      }

      if (e.key === 'Enter' && qaIndex >= 0) {
        e.preventDefault();
        handleQuickAction(qaItems[qaIndex].prompt);
        setQaIndex(-1);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isEmpty, qaIndex, qaItems]);

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
            <button
              onClick={onOpenHistory}
              className="btn-ghost !px-2 !py-1 text-xs group/hint relative"
              title="History"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-2xs text-text-tertiary opacity-0 group-hover/hint:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {MOD_KEY}H
              </span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="btn-ghost !px-2 !py-1 text-xs group/hint relative"
              title="New chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-2xs text-text-tertiary opacity-0 group-hover/hint:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {MOD_KEY}N
              </span>
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
            <p className="text-text-secondary text-sm mb-1">What can I do for you?</p>
            <p className="text-text-tertiary text-2xs mb-6">
              Press <kbd className="px-1 py-0.5 rounded bg-surface-3 text-text-tertiary font-mono text-2xs">/</kbd> to start typing
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {qaItems.map((action, idx) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  className={`card-interactive !p-3 text-left group outline-none
                    ${qaIndex === idx ? 'ring-2 ring-accent/50 border-accent/30 bg-surface-2' : ''}
                  `}
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
          ref={inputRef}
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
});
