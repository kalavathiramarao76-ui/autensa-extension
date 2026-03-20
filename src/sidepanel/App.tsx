import React, { useState } from 'react';
import { ChatView } from '../ui/views/ChatView';
import { SettingsView } from '../ui/views/SettingsView';
import { useSettings } from '../ui/hooks/useSettings';

export function App() {
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const { isConfigured, loading } = useSettings();

  if (!loading && !isConfigured && view !== 'settings') {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Autensa</h1>
        <p className="text-sm text-text-secondary text-center mb-6">Configure your API keys to get started</p>
        <button onClick={() => setView('settings')} className="btn-primary text-base px-6 py-2.5">
          Configure Keys
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {view === 'chat' ? (
        <>
          <ChatView />
          <div className="px-4 pb-3 flex justify-end">
            <button onClick={() => setView('settings')} className="btn-ghost text-2xs flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              Settings
            </button>
          </div>
        </>
      ) : (
        <SettingsView onBack={() => setView('chat')} />
      )}
    </div>
  );
}
