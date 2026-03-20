import { useEffect, useCallback } from 'react';

export type ViewType = 'chat' | 'settings' | 'history';

interface KeyboardNavCallbacks {
  onNewChat?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onFocusInput?: () => void;
  onEscape?: () => void;
}

/**
 * Global keyboard shortcut hook.
 * Registers Cmd/Ctrl shortcuts and Escape/slash patterns.
 * Use in both popup and sidepanel App components.
 */
export function useKeyboardNav(
  view: ViewType,
  callbacks: KeyboardNavCallbacks,
) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // ── Escape ──
      if (e.key === 'Escape') {
        // If an input is focused, blur it first
        if (isInput) {
          (target as HTMLElement).blur();
          e.preventDefault();
          return;
        }
        callbacks.onEscape?.();
        e.preventDefault();
        return;
      }

      // ── Mod shortcuts ──
      if (mod) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            callbacks.onNewChat?.();
            return;
          case 'h':
            e.preventDefault();
            callbacks.onOpenHistory?.();
            return;
          case ',':
            e.preventDefault();
            callbacks.onOpenSettings?.();
            return;
          case 'l':
            e.preventDefault();
            callbacks.onFocusInput?.();
            return;
        }
      }

      // ── Slash to focus input (when not already typing) ──
      if (e.key === '/' && !isInput && view === 'chat') {
        e.preventDefault();
        callbacks.onFocusInput?.();
      }
    },
    [view, callbacks],
  );

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}

/**
 * Arrow-key list navigation hook.
 * Returns the currently selected index and handlers to wire up.
 */
export function useListNavigation(opts: {
  itemCount: number;
  onSelect: (index: number) => void;
  onDelete?: (index: number) => void;
  onEscape?: () => void;
  enabled?: boolean;
}) {
  const { itemCount, onSelect, onDelete, onEscape, enabled = true } = opts;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isInput) return;

      // We don't manage state here — the parent dispatches via callbacks.
      // This hook only captures keys and maps them.
    },
    [enabled, itemCount],
  );

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}

/**
 * Grid navigation for 2-column quick actions.
 * cols=2, rows derived from itemCount.
 */
export function gridNav(
  current: number,
  key: string,
  cols: number,
  total: number,
): number {
  const rows = Math.ceil(total / cols);
  const row = Math.floor(current / cols);
  const col = current % cols;

  switch (key) {
    case 'ArrowUp':
      return row > 0 ? (row - 1) * cols + col : current;
    case 'ArrowDown': {
      const next = (row + 1) * cols + col;
      return next < total ? next : current;
    }
    case 'ArrowLeft':
      return current > 0 ? current - 1 : current;
    case 'ArrowRight':
      return current < total - 1 ? current + 1 : current;
    default:
      return current;
  }
}

/**
 * Detect modifier key label for current platform.
 */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
