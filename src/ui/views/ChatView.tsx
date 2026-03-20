import React, { useState, useRef, useEffect } from 'react';
import { useAgent } from '../hooks/useAgent';
import { MessageBubble } from '../components/MessageBubble';
import { StreamingText } from '../components/StreamingText';
import { ToolExecution } from '../components/ToolExecution';
import { Input } from '../components/Input';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { QUICK_ACTIONS } from '@/shared/constants';

export function ChatView() {
  const { messages, isStreaming, streamingText, activeTools, sendMessage, clearMessages } = useAgent();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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
          {messages.length > 0 && (
            <button onClick={clearMessages} className="btn-ghost !px-2 !py-1 text-xs" title="New chat">
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
                  className="card !p-3 hover:!bg-surface-2 transition-colors text-left group cursor-pointer"
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
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" style={{ animationDelay: '300ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" style={{ animationDelay: '600ms' }} />
            </div>
            <span className="text-xs text-text-tertiary">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <Input
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isStreaming}
          autoFocus
        />
      </div>
    </div>
  );
}
