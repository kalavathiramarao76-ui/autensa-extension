import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'autensa_compact_mode';

export function useCompactMode() {
  const [compact, setCompactState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Sync with chrome.storage if available
  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
          if (result[STORAGE_KEY] !== undefined) {
            setCompactState(result[STORAGE_KEY] === true);
          }
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const setCompact = useCallback((value: boolean) => {
    setCompactState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: value });
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCompact = useCallback(() => {
    setCompact(!compact);
  }, [compact, setCompact]);

  return { compact, setCompact, toggleCompact };
}
