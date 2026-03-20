import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  /** ms until auto-dismiss */
  duration: number;
  createdAt: number;
}

interface ToastContextValue {
  toast: (opts: { type: ToastType; title: string; description?: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ── Constants ──────────────────────────────────────────────────────────
const MAX_VISIBLE = 3;
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
  warning: 6000,
};

const ACCENT: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#6366f1',
  warning: '#f59e0b',
};

const ACCENT_BG: Record<ToastType, string> = {
  success: 'rgba(34,197,94,0.12)',
  error: 'rgba(239,68,68,0.12)',
  info: 'rgba(99,102,241,0.12)',
  warning: 'rgba(245,158,11,0.12)',
};

let _toastId = 0;
function nextId() {
  return `toast-${++_toastId}-${Date.now()}`;
}

// ── Icons (inline SVGs — 16×16) ────────────────────────────────────────
function ToastIcon({ type }: { type: ToastType }) {
  const color = ACCENT[type];
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (type) {
    case 'success':
      return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'error':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>;
    case 'warning':
      return <svg {...common}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case 'info':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
  }
}

// ── Single Toast Item ──────────────────────────────────────────────────
function ToastItem({
  data,
  onDismiss,
}: {
  data: ToastData;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(data.duration);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startX: number; currentX: number } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(data.id), 220);
  }, [data.id, onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    if (paused) return;
    startRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, remainingRef.current);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingRef.current -= Date.now() - startRef.current;
      if (remainingRef.current < 0) remainingRef.current = 0;
    };
  }, [paused, dismiss]);

  // Drag to dismiss (pointer events for touch + mouse)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, currentX: e.clientX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !elRef.current) return;
    dragRef.current.currentX = e.clientX;
    const dx = e.clientX - dragRef.current.startX;
    if (dx > 0) {
      elRef.current.style.transform = `translateX(${dx}px)`;
      elRef.current.style.opacity = `${Math.max(0, 1 - dx / 200)}`;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !elRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current = null;
    if (dx > 80) {
      dismiss();
    } else {
      elRef.current.style.transform = '';
      elRef.current.style.opacity = '';
    }
  }, [dismiss]);

  // Progress fraction (0→1 = full→empty)
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - data.createdAt;
      const p = Math.max(0, 1 - elapsed / data.duration);
      setProgress(paused ? progress : p);
      if (p > 0 && !paused) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={elRef}
      role="alert"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={dismiss}
      className={`
        relative flex items-start gap-2.5 cursor-pointer select-none overflow-hidden
        rounded-xl border border-border shadow-lg
        backdrop-blur-xl
        transition-all duration-200
        ${exiting
          ? 'animate-toast-exit'
          : 'animate-toast-enter'
        }
      `}
      style={{
        background: 'rgba(17,17,19,0.85)',
        minHeight: 48,
        maxWidth: 340,
        width: '100%',
        touchAction: 'pan-y',
      }}
    >
      {/* Left accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: ACCENT[data.type] }}
      />

      {/* Content */}
      <div className="flex items-start gap-2.5 pl-4 pr-8 py-3 min-w-0">
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-px"
          style={{ background: ACCENT_BG[data.type] }}
        >
          <ToastIcon type={data.type} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary leading-snug truncate">
            {data.title}
          </p>
          {data.description && (
            <p className="text-2xs text-text-secondary leading-snug mt-0.5 line-clamp-2">
              {data.description}
            </p>
          )}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition-colors"
        aria-label="Dismiss"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-1 right-0 h-[2px]">
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${progress * 100}%`,
            background: ACCENT[data.type],
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback(
    ({ type, title, description, duration }: { type: ToastType; title: string; description?: string; duration?: number }) => {
      const d = duration ?? DEFAULT_DURATION[type];
      const newToast: ToastData = {
        id: nextId(),
        type,
        title,
        description,
        duration: d,
        createdAt: Date.now(),
      };
      setToasts((prev) => {
        const next = [...prev, newToast];
        // Keep at most MAX_VISIBLE — dismiss oldest
        if (next.length > MAX_VISIBLE) {
          return next.slice(next.length - MAX_VISIBLE);
        }
        return next;
      });
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
          style={{ maxWidth: 340 }}
        >
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem data={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
