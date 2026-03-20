import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings } from '@/shared/storage';
import { useToast } from './Toast';

type Status = 'online' | 'offline' | 'endpoint-unreachable' | 'reconnecting' | 'connection-lost' | 'reconnected';

const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 30000;
const BACKOFF_FACTOR = 2;
const MAX_ATTEMPTS = 5;
const RECONNECTED_DISMISS_MS = 3000;

// Backoff schedule: 2s → 4s → 8s → 16s → 30s
function getBackoffDelay(attempt: number): number {
  return Math.min(INITIAL_RETRY_MS * Math.pow(BACKOFF_FACTOR, attempt), MAX_RETRY_MS);
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('online');
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressRaf = useRef<number>();
  const progressStart = useRef(0);
  const progressDuration = useRef(0);
  const mountedRef = useRef(true);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();
  const wasUnreachableRef = useRef(false);
  const { toast } = useToast();

  const checkEndpoint = useCallback(async (): Promise<boolean> => {
    try {
      const settings = await getSettings();
      const endpoint = settings.provider === 'ollama'
        ? settings.ollamaEndpoint
        : null;

      if (!endpoint) return navigator.onLine;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(endpoint.replace(/\/v1\/?$/, '/v1/models'), {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok || res.status === 401;
    } catch {
      return false;
    }
  }, []);

  const stopProgress = useCallback(() => {
    if (progressRaf.current) {
      cancelAnimationFrame(progressRaf.current);
      progressRaf.current = undefined;
    }
  }, []);

  const animateProgress = useCallback((durationMs: number) => {
    stopProgress();
    progressStart.current = performance.now();
    progressDuration.current = durationMs;
    setProgress(0);

    const tick = () => {
      if (!mountedRef.current) return;
      const elapsed = performance.now() - progressStart.current;
      const pct = Math.min(elapsed / progressDuration.current, 1);
      setProgress(pct);
      if (pct < 1) {
        progressRaf.current = requestAnimationFrame(tick);
      }
    };
    progressRaf.current = requestAnimationFrame(tick);
  }, [stopProgress]);

  const handleReconnected = useCallback(() => {
    if (!mountedRef.current) return;
    wasUnreachableRef.current = false;
    setStatus('reconnected');
    setAttempt(0);
    setProgress(0);
    stopProgress();

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setStatus('online');
      setVisible(false);
    }, RECONNECTED_DISMISS_MS);
  }, [stopProgress]);

  const scheduleRetry = useCallback((currentAttempt: number) => {
    if (!mountedRef.current) return;
    if (retryTimer.current) clearTimeout(retryTimer.current);

    if (currentAttempt >= MAX_ATTEMPTS) {
      setStatus('connection-lost');
      stopProgress();
      return;
    }

    const delay = getBackoffDelay(currentAttempt);
    animateProgress(delay);

    retryTimer.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      setStatus('reconnecting');
      const nextAttempt = currentAttempt + 1;
      setAttempt(nextAttempt);

      const reachable = await checkEndpoint();
      if (!mountedRef.current) return;

      if (reachable && navigator.onLine) {
        handleReconnected();
      } else {
        setStatus(navigator.onLine ? 'endpoint-unreachable' : 'offline');
        scheduleRetry(nextAttempt);
      }
    }, delay);
  }, [checkEndpoint, animateProgress, stopProgress, handleReconnected]);

  const handleOffline = useCallback(() => {
    wasUnreachableRef.current = true;
    setStatus('offline');
    setVisible(true);
    setAttempt(0);
    scheduleRetry(0);
  }, [scheduleRetry]);

  const handleOnline = useCallback(async () => {
    setStatus('reconnecting');
    setAttempt(1);
    const reachable = await checkEndpoint();
    if (!mountedRef.current) return;

    if (reachable) {
      if (wasUnreachableRef.current) {
        handleReconnected();
      } else {
        setStatus('online');
        setVisible(false);
      }
    } else {
      wasUnreachableRef.current = true;
      setStatus('endpoint-unreachable');
      setVisible(true);
      scheduleRetry(1);
    }
  }, [checkEndpoint, scheduleRetry, handleReconnected]);

  const handleManualRetry = useCallback(() => {
    setAttempt(0);
    setStatus('reconnecting');
    wasUnreachableRef.current = true;
    scheduleRetry(0);
  }, [scheduleRetry]);

  // Network change detection
  useEffect(() => {
    const connection = (navigator as any).connection;
    if (!connection) return;

    const handleChange = () => {
      if (!mountedRef.current) return;
      toast({ type: 'info', title: 'Network changed', duration: 3000 });
      // Trigger immediate health check
      checkEndpoint().then(reachable => {
        if (!mountedRef.current) return;
        if (!reachable && status === 'online') {
          wasUnreachableRef.current = true;
          setStatus('endpoint-unreachable');
          setVisible(true);
          setAttempt(0);
          scheduleRetry(0);
        } else if (reachable && status !== 'online' && status !== 'reconnected') {
          handleReconnected();
        }
      });
    };

    connection.addEventListener('change', handleChange);
    return () => connection.removeEventListener('change', handleChange);
  }, [checkEndpoint, toast, status, scheduleRetry, handleReconnected]);

  // Initial check + event listeners
  useEffect(() => {
    mountedRef.current = true;

    if (!navigator.onLine) {
      handleOffline();
    } else {
      checkEndpoint().then(reachable => {
        if (!mountedRef.current) return;
        if (!reachable) {
          wasUnreachableRef.current = true;
          setStatus('endpoint-unreachable');
          setVisible(true);
          setAttempt(0);
          scheduleRetry(0);
        }
      });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic health check every 60s when online
    const healthCheck = setInterval(async () => {
      if (!mountedRef.current || !navigator.onLine) return;
      if (status !== 'online' && status !== 'reconnected') return;
      const reachable = await checkEndpoint();
      if (!mountedRef.current) return;
      if (!reachable) {
        wasUnreachableRef.current = true;
        setStatus('endpoint-unreachable');
        setVisible(true);
        setAttempt(0);
        scheduleRetry(0);
      }
    }, 60000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(healthCheck);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      stopProgress();
    };
  }, [handleOffline, handleOnline, checkEndpoint, scheduleRetry, stopProgress, status]);

  if (!visible) return null;
  if (status === 'online') return null;

  const configs: Record<Exclude<Status, 'online'>, {
    icon: React.ReactNode;
    text: string;
    color: string;
    bgColor: string;
    borderColor: string;
    progressColor: string;
  }> = {
    offline: {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      ),
      text: 'You are offline',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
      progressColor: '#f59e0b',
    },
    'endpoint-unreachable': {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      text: 'API endpoint unreachable',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
      progressColor: '#f59e0b',
    },
    reconnecting: {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ),
      text: `Reconnecting... (attempt ${attempt}/${MAX_ATTEMPTS})`,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
      progressColor: '#f59e0b',
    },
    'connection-lost': {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
      text: 'Connection lost',
      color: 'text-error',
      bgColor: 'bg-error/10',
      borderColor: 'border-error/20',
      progressColor: '#ef4444',
    },
    reconnected: {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      text: 'Reconnected',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
      progressColor: '#22c55e',
    },
  };

  const config = configs[status];

  const showRetryButton = status === 'connection-lost' || status === 'offline' || status === 'endpoint-unreachable';
  const showProgressBar = status === 'reconnecting' || status === 'endpoint-unreachable' || status === 'offline';

  return (
    <div className={`mx-4 mt-1 rounded-lg border ${config.borderColor} ${config.bgColor} animate-slide-down overflow-hidden transition-all duration-200`}>
      <div className="px-3 py-2 flex items-center gap-2">
        <span className={config.color}>{config.icon}</span>
        <span className={`text-2xs ${config.color} font-medium flex-1`}>{config.text}</span>
        {showRetryButton && (
          <button
            onClick={handleManualRetry}
            className="text-2xs text-accent hover:text-accent-hover transition-colors font-medium px-2 py-0.5 rounded-md hover:bg-accent/10"
          >
            Retry
          </button>
        )}
      </div>
      {/* Progress bar — shows time until next retry */}
      {showProgressBar && (
        <div className="h-[2px] w-full" style={{ backgroundColor: `${config.progressColor}15` }}>
          <div
            className="h-full transition-none"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: config.progressColor,
              opacity: 0.7,
            }}
          />
        </div>
      )}
    </div>
  );
}
