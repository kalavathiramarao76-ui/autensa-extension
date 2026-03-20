import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings } from '@/shared/storage';

type Status = 'online' | 'offline' | 'endpoint-unreachable' | 'reconnecting';

const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 30000;
const BACKOFF_FACTOR = 1.5;

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('online');
  const [visible, setVisible] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const retryDelay = useRef(INITIAL_RETRY_MS);
  const mountedRef = useRef(true);

  const checkEndpoint = useCallback(async (): Promise<boolean> => {
    try {
      const settings = await getSettings();
      const endpoint = settings.provider === 'ollama'
        ? settings.ollamaEndpoint
        : null;

      // If using Claude API, we only check browser online status
      if (!endpoint) return navigator.onLine;

      // Ping the endpoint root with a short timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(endpoint.replace(/\/v1\/?$/, '/v1/models'), {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok || res.status === 401; // 401 means reachable but auth issue
    } catch {
      return false;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    if (!mountedRef.current) return;

    retryTimer.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      setStatus('reconnecting');
      const reachable = await checkEndpoint();

      if (!mountedRef.current) return;

      if (reachable && navigator.onLine) {
        setStatus('online');
        setVisible(false);
        retryDelay.current = INITIAL_RETRY_MS;
      } else {
        setStatus(navigator.onLine ? 'endpoint-unreachable' : 'offline');
        retryDelay.current = Math.min(retryDelay.current * BACKOFF_FACTOR, MAX_RETRY_MS);
        scheduleRetry();
      }
    }, retryDelay.current);
  }, [checkEndpoint]);

  const handleOffline = useCallback(() => {
    setStatus('offline');
    setVisible(true);
    retryDelay.current = INITIAL_RETRY_MS;
    scheduleRetry();
  }, [scheduleRetry]);

  const handleOnline = useCallback(async () => {
    setStatus('reconnecting');
    const reachable = await checkEndpoint();
    if (!mountedRef.current) return;

    if (reachable) {
      setStatus('online');
      setVisible(false);
      retryDelay.current = INITIAL_RETRY_MS;
    } else {
      setStatus('endpoint-unreachable');
      setVisible(true);
      scheduleRetry();
    }
  }, [checkEndpoint, scheduleRetry]);

  // Initial check + event listeners
  useEffect(() => {
    mountedRef.current = true;

    if (!navigator.onLine) {
      handleOffline();
    } else {
      // Do an initial endpoint check silently
      checkEndpoint().then(reachable => {
        if (!mountedRef.current) return;
        if (!reachable) {
          setStatus('endpoint-unreachable');
          setVisible(true);
          scheduleRetry();
        }
      });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic health check every 60s when online
    const healthCheck = setInterval(async () => {
      if (!mountedRef.current || !navigator.onLine) return;
      const reachable = await checkEndpoint();
      if (!mountedRef.current) return;
      if (!reachable && status === 'online') {
        setStatus('endpoint-unreachable');
        setVisible(true);
        retryDelay.current = INITIAL_RETRY_MS;
        scheduleRetry();
      }
    }, 60000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(healthCheck);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [handleOffline, handleOnline, checkEndpoint, scheduleRetry, status]);

  if (!visible) return null;

  const config: Record<Exclude<Status, 'online'>, { icon: React.ReactNode; text: string; color: string; bgColor: string }> = {
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
      bgColor: 'bg-warning/10 border-warning/20',
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
      color: 'text-error',
      bgColor: 'bg-error/10 border-error/20',
    },
    reconnecting: {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ),
      text: 'Reconnecting...',
      color: 'text-text-secondary',
      bgColor: 'bg-surface-3/50 border-border',
    },
  };

  if (status === 'online') return null;

  const { icon, text, color, bgColor } = config[status];

  return (
    <div className={`mx-4 mt-1 px-3 py-2 rounded-lg border flex items-center gap-2 animate-slide-down ${bgColor}`}>
      <span className={color}>{icon}</span>
      <span className={`text-2xs ${color} font-medium flex-1`}>{text}</span>
      {status !== 'reconnecting' && (
        <button
          onClick={() => {
            retryDelay.current = INITIAL_RETRY_MS;
            setStatus('reconnecting');
            handleOnline();
          }}
          className="text-2xs text-accent hover:text-accent-hover transition-colors font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}
