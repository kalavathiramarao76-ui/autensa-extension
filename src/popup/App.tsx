import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChatView, ChatViewHandle } from '../ui/views/ChatView';
import { SettingsView } from '../ui/views/SettingsView';
import { HistoryView } from '../ui/views/HistoryView';
import { useSettings } from '../ui/hooks/useSettings';
import { useKeyboardNav, ViewType, MOD_KEY } from '../ui/hooks/useKeyboardNav';
import { ErrorBoundary } from '../ui/components/ErrorBoundary';
import { Session } from '@/shared/types';

function AppInner() {
  const [view, setView] = useState<ViewType>('chat');
  const [sessionToRestore, setSessionToRestore] = useState<Session | null>(null);
  const { isConfigured, loading } = useSettings();
  const chatRef = useRef<ChatViewHandle>(null);

  const handleSelectSession = useCallback((session: Session) => {
    setSessionToRestore(session);
    setView('chat');
  }, []);

  const handleSessionRestored = useCallback(() => {
    setSessionToRestore(null);
  }, []);

  // Auto-focus input when switching to chat view
  useEffect(() => {
    if (view === 'chat') {
      const t = setTimeout(() => chatRef.current?.focusInput(), 50);
      return () => clearTimeout(t);
    }
  }, [view]);

  // Global keyboard shortcuts
  useKeyboardNav(view, {
    onNewChat: () => {
      if (view !== 'chat') setView('chat');
      chatRef.current?.newChat();
    },
    onOpenHistory: () => {
      setView(prev => (prev === 'history' ? 'chat' : 'history'));
    },
    onOpenSettings: () => {
      setView(prev => (prev === 'settings' ? 'chat' : 'settings'));
    },
    onFocusInput: () => {
      if (view !== 'chat') setView('chat');
      chatRef.current?.clearAndFocus();
    },
    onEscape: () => {
      if (view !== 'chat') {
        setView('chat');
      } else {
        // In popup, close it
        window.close();
      }
    },
  });

  // Focus trap: keep Tab within the popup
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = document.querySelector<HTMLElement>('.popup-root');
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Show settings if not configured
  if (!loading && !isConfigured && view !== 'settings') {
    return (
      <div className="popup-root h-[500px] w-[400px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-text-primary mb-1">Welcome to Autensa</h1>
          <p className="text-sm text-text-secondary text-center mb-6">
            Add your API keys to get started
          </p>
          <button onClick={() => setView('settings')} className="btn-primary">
            Configure Keys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-root h-[500px] w-[400px] flex flex-col">
      {view === 'chat' && (
        <>
          <ChatView
            ref={chatRef}
            onOpenHistory={() => setView('history')}
            onOpenSettings={() => setView('settings')}
            sessionToRestore={sessionToRestore}
            onSessionRestored={handleSessionRestored}
          />
          <div className="px-4 pb-2 flex justify-between items-center">
            <button
              onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })}
              className="btn-ghost text-2xs flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>
              </svg>
              Side Panel
            </button>
            <button
              onClick={() => setView('settings')}
              className="btn-ghost text-2xs flex items-center gap-1 group/hint relative outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              Settings
              <span className="text-2xs text-text-tertiary opacity-0 group-hover/hint:opacity-100 transition-opacity ml-1">
                {MOD_KEY},
              </span>
            </button>
          </div>
        </>
      )}
      {view === 'settings' && (
        <SettingsView onBack={() => setView('chat')} />
      )}
      {view === 'history' && (
        <HistoryView
          onBack={() => setView('chat')}
          onSelectSession={handleSelectSession}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
