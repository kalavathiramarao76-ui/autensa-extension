import { useState, useEffect, useCallback } from 'react';
import { ThemeMode } from '@/shared/types';
import { getSettings, saveSettings } from '@/shared/storage';

/** Resolved theme — what's actually applied to the DOM */
type ResolvedTheme = 'dark' | 'light';

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

function applyTheme(resolved: ResolvedTheme) {
  const html = document.documentElement;
  if (resolved === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

const CYCLE_ORDER: ThemeMode[] = ['dark', 'light', 'system'];

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme('system'));
  const [loaded, setLoaded] = useState(false);

  // Load persisted theme on mount
  useEffect(() => {
    getSettings().then((s) => {
      const m = s.theme || 'system';
      setMode(m);
      const r = resolveTheme(m);
      setResolved(r);
      applyTheme(r);
      try { localStorage.setItem('autensa_theme_cache', m); } catch {}
      setLoaded(true);
    });
  }, []);

  // Listen for system preference changes when mode is 'system'
  useEffect(() => {
    if (mode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const r: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolved(r);
      applyTheme(r);
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setTheme = useCallback(async (newMode: ThemeMode) => {
    // Enable transition on theme switch
    document.documentElement.classList.add('theme-transitioning');
    setMode(newMode);
    const r = resolveTheme(newMode);
    setResolved(r);
    applyTheme(r);
    // Cache to localStorage for FOUC prevention on next load
    try { localStorage.setItem('autensa_theme_cache', newMode); } catch {}
    await saveSettings({ theme: newMode });
    // Remove transition class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 250);
  }, []);

  const cycleTheme = useCallback(() => {
    const currentIdx = CYCLE_ORDER.indexOf(mode);
    const nextMode = CYCLE_ORDER[(currentIdx + 1) % CYCLE_ORDER.length];
    setTheme(nextMode);
  }, [mode, setTheme]);

  return { mode, resolved, setTheme, cycleTheme, loaded };
}
