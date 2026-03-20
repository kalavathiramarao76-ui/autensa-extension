import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@/shared/types';
import { getSessions, deleteSession } from '@/shared/storage';
import { exportSessionToMarkdown, downloadMarkdown, exportFilename } from '@/shared/export';
import { useToast } from '../components/Toast';
import { Skeleton } from '../components/Skeleton';

interface Props {
  onBack: () => void;
  onSelectSession: (session: Session) => void;
  activeSessionId?: string;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function sessionTitle(session: Session): string {
  if (session.title) return session.title;
  const firstUser = session.messages.find(m => m.role === 'user');
  if (firstUser) return firstUser.content.slice(0, 80);
  return 'New conversation';
}

function sessionPreview(session: Session): string {
  const lastAssistant = [...session.messages].reverse().find(m => m.role === 'assistant');
  if (lastAssistant) return lastAssistant.content.slice(0, 100);
  return '';
}

export function HistoryView({ onBack, onSelectSession, activeSessionId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { toast } = useToast();

  const loadSessions = useCallback(async () => {
    const data = await getSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Arrow key navigation
  useEffect(() => {
    if (loading || sessions.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isInput) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, sessions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < sessions.length) {
            onSelectSession(sessions[selectedIndex]);
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedIndex >= 0 && selectedIndex < sessions.length) {
            const sid = sessions[selectedIndex].id;
            if (deletingId === sid) {
              // Confirm delete
              e.preventDefault();
              deleteSession(sid).then(() => {
                setSessions(prev => prev.filter(s => s.id !== sid));
                setDeletingId(null);
                setSelectedIndex(prev => Math.min(prev, sessions.length - 2));
              });
            } else {
              e.preventDefault();
              setDeletingId(sid);
              setTimeout(() => setDeletingId(prev => prev === sid ? null : prev), 3000);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onBack();
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [loading, sessions, selectedIndex, deletingId, onBack, onSelectSession]);

  const handleExportSession = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    const md = exportSessionToMarkdown(session);
    downloadMarkdown(md, exportFilename());
    toast({ type: 'success', title: 'Conversation exported' });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      // Second click = confirm
      await deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setDeletingId(null);
    } else {
      setDeletingId(id);
      // Reset after 3s if not confirmed
      setTimeout(() => setDeletingId(prev => prev === id ? null : prev), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
        <button onClick={onBack} className="btn-ghost !p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-text-primary">History</span>
        <span className="text-2xs text-text-tertiary ml-auto">
          {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
          {sessions.length > 0 && (
            <span className="ml-2 text-text-tertiary/50">↑↓ navigate</span>
          )}
        </span>
      </div>

      {/* Session List */}
      <div ref={listRef} className="flex-1 overflow-y-auto" role="listbox" aria-label="Chat sessions">
        {loading && (
          <div className="p-5 space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="space-y-2" style={{ animation: `fadeIn 150ms ease-out ${i * 60}ms both` }}>
                <Skeleton variant="text" className="w-3/4 h-3.5" />
                <Skeleton variant="text" className="w-1/2 h-2.5" />
                <Skeleton variant="text" className="w-1/3 h-2" />
              </div>
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in px-6">
            <div className="w-14 h-14 rounded-2xl bg-surface-3 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-text-secondary mb-1">No conversations yet</p>
            <p className="text-2xs text-text-tertiary text-center">
              Your chat history will appear here
            </p>
          </div>
        )}

        {!loading && sessions.map((session, index) => {
          const isActive = session.id === activeSessionId;
          const isDeleting = deletingId === session.id;
          const isSelected = selectedIndex === index;
          const title = sessionTitle(session);
          const preview = sessionPreview(session);
          const msgCount = session.messages.length;

          return (
            <button
              key={session.id}
              ref={el => { itemRefs.current[index] = el; }}
              onClick={() => onSelectSession(session)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={isSelected}
              className={`
                history-item group outline-none
                ${isActive ? 'history-item-active' : ''}
                ${isSelected && !isActive ? 'bg-surface-2 border-l-2 border-l-accent/40' : ''}
                ${isSelected ? 'ring-1 ring-inset ring-accent/20' : ''}
              `}
              style={{
                animation: `fadeIn 150ms ease-out ${index * 30}ms both`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`
                    text-sm font-medium truncate
                    ${isActive ? 'text-accent' : 'text-text-primary'}
                  `}>
                    {title}
                  </p>
                  {preview && (
                    <p className="text-2xs text-text-tertiary truncate mt-0.5">
                      {preview}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-2xs text-text-tertiary">
                      {msgCount} message{msgCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-text-tertiary text-2xs">·</span>
                    <span className="text-2xs text-text-tertiary">
                      {timeAgo(session.updatedAt)}
                    </span>
                    {isDeleting && (
                      <>
                        <span className="text-text-tertiary text-2xs">·</span>
                        <span className="text-2xs text-error animate-fade-in">Press again to delete</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={(e) => handleExportSession(e, session)}
                    className={`
                      mt-0.5 p-1.5 rounded-lg transition-all duration-150
                      outline-none focus-visible:ring-2 focus-visible:ring-accent/40
                      ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                      hover:bg-surface-4 text-text-tertiary hover:text-text-secondary
                    `}
                    title="Export conversation"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className={`
                    mt-0.5 p-1.5 rounded-lg transition-all duration-150
                    outline-none focus-visible:ring-2 focus-visible:ring-accent/40
                    ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    ${isDeleting
                      ? 'bg-error/20 text-error opacity-100'
                      : 'hover:bg-surface-4 text-text-tertiary hover:text-text-secondary'
                    }
                  `}
                  title={isDeleting ? 'Click again to confirm' : 'Delete conversation'}
                >
                  {isDeleting ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  )}
                </button>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
