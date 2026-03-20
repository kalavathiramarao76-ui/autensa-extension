import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings } from '@/shared/types';

export type HealthStatus = 'healthy' | 'degraded' | 'unreachable' | 'checking' | 'unknown';

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs: number | null;
  lastCheckedAt: number | null;
  endpoint: string | null;
  model: string | null;
}

const PING_INTERVAL_MS = 30_000;
const DEGRADED_THRESHOLD_MS = 2000;
const PING_TIMEOUT_MS = 8000;

export function useHealthCheck(settings: Settings, isConfigured: boolean): HealthCheckResult {
  const [status, setStatus] = useState<HealthStatus>('unknown');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const pingingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const getEndpoint = useCallback((): string | null => {
    if (settings.provider === 'ollama' && settings.ollamaEndpoint) {
      return settings.ollamaEndpoint;
    }
    return null;
  }, [settings.provider, settings.ollamaEndpoint]);

  const ping = useCallback(async () => {
    // Debounce: don't ping if already pinging
    if (pingingRef.current) return;

    if (!isConfigured) {
      setStatus('unknown');
      return;
    }

    // For Claude: just check if key is set, don't waste API calls
    if (settings.provider === 'claude') {
      if (settings.claudeApiKey) {
        setStatus('healthy');
        setLatencyMs(0);
        setLastCheckedAt(Date.now());
      } else {
        setStatus('unknown');
      }
      return;
    }

    const endpoint = getEndpoint();
    if (!endpoint) {
      setStatus('unknown');
      return;
    }

    pingingRef.current = true;
    setStatus('checking');

    const pingUrl = endpoint.replace(/\/v1\/?$/, '/v1/models');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const start = performance.now();

    try {
      const res = await fetch(pingUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsed = Math.round(performance.now() - start);

      if (!mountedRef.current) return;

      if (res.ok || res.status === 401) {
        setLatencyMs(elapsed);
        setLastCheckedAt(Date.now());
        setStatus(elapsed > DEGRADED_THRESHOLD_MS ? 'degraded' : 'healthy');
      } else {
        setLatencyMs(elapsed);
        setLastCheckedAt(Date.now());
        setStatus('unreachable');
      }
    } catch {
      clearTimeout(timeout);
      if (!mountedRef.current) return;
      setLatencyMs(null);
      setLastCheckedAt(Date.now());
      setStatus('unreachable');
    } finally {
      pingingRef.current = false;
    }
  }, [settings.provider, settings.claudeApiKey, isConfigured, getEndpoint]);

  // Ping on mount and on settings change
  useEffect(() => {
    mountedRef.current = true;
    ping();
    return () => { mountedRef.current = false; };
  }, [ping]);

  // Periodic pinging, paused when tab is hidden
  useEffect(() => {
    const startInterval = () => {
      intervalRef.current = setInterval(ping, PING_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping(); // immediate ping on re-focus
        startInterval();
      } else {
        stopInterval();
      }
    };

    if (document.visibilityState === 'visible') {
      startInterval();
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [ping]);

  return {
    status,
    latencyMs,
    lastCheckedAt,
    endpoint: getEndpoint(),
    model: settings.model || null,
  };
}
