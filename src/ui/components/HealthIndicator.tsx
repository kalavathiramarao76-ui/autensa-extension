import React, { useState, useRef, useEffect } from 'react';
import { HealthCheckResult, HealthStatus } from '../hooks/useHealthCheck';

interface HealthIndicatorProps {
  health: HealthCheckResult;
}

const STATUS_CONFIG: Record<HealthStatus, {
  dotClass: string;
  label: string;
}> = {
  healthy: {
    dotClass: 'bg-success animate-pulse-soft',
    label: 'Connected',
  },
  degraded: {
    dotClass: 'bg-warning',
    label: 'Slow',
  },
  unreachable: {
    dotClass: 'bg-error animate-[pulseSoft_1s_ease-in-out_infinite]',
    label: 'Unreachable',
  },
  reconnecting: {
    dotClass: 'bg-warning animate-[pulseSoft_0.8s_ease-in-out_infinite]',
    label: 'Reconnecting...',
  },
  checking: {
    dotClass: 'bg-text-tertiary animate-pulse-soft',
    label: 'Checking...',
  },
  unknown: {
    dotClass: 'bg-text-tertiary',
    label: 'Not configured',
  },
};

function formatLatency(ms: number | null): string {
  if (ms === null) return '--';
  if (ms === 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts: number | null): string {
  if (ts === null) return 'Never';
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 5) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function truncateUrl(url: string | null, maxLen = 32): string {
  if (!url) return 'N/A';
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 1) + '\u2026';
}

export function HealthIndicator({ health }: HealthIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh "last checked" display
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!showTooltip) return;
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [showTooltip]);

  const handleEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowTooltip(true);
    showTimer.current = setTimeout(() => setTooltipVisible(true), 10);
  };

  const handleLeave = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    setTooltipVisible(false);
    hideTimer.current = setTimeout(() => setShowTooltip(false), 180);
  };

  const { status, latencyMs, lastCheckedAt, endpoint, model } = health;
  const config = STATUS_CONFIG[status];

  const statusLabel = status === 'degraded' && latencyMs
    ? `Slow (${formatLatency(latencyMs)})`
    : config.label;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Status dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full ${config.dotClass} transition-colors duration-300`}
        aria-label={`Model status: ${statusLabel}`}
      />

      {/* Tooltip card */}
      {showTooltip && (
        <div
          className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50
            w-56 p-3 rounded-xl shadow-lg
            bg-surface-1/90 backdrop-blur-xl border border-border
            transition-all duration-150 ease-out
            ${tooltipVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
          `}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {/* Status line */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className={`w-2 h-2 rounded-full ${config.dotClass}`} />
            <span className="text-xs font-semibold text-text-primary">{statusLabel}</span>
          </div>

          {/* Details */}
          <div className="space-y-1.5 text-2xs font-mono">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Model</span>
              <span className="text-text-secondary truncate max-w-[120px]">{model || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Endpoint</span>
              <span className="text-text-secondary truncate max-w-[120px]">{truncateUrl(endpoint)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Latency</span>
              <span className="text-text-secondary">{formatLatency(latencyMs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Last check</span>
              <span className="text-text-secondary">{formatTime(lastCheckedAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
