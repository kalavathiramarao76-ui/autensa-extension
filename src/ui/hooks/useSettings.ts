import { useState, useEffect, useCallback } from 'react';
import { Settings, DEFAULT_SETTINGS } from '@/shared/types';
import { getSettings, saveSettings } from '@/shared/storage';

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then(s => { setSettingsState(s); setLoading(false); });
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    await saveSettings(updates);
    setSettingsState(prev => ({ ...prev, ...updates }));
  }, []);

  const isConfigured = settings.provider === 'ollama'
    ? Boolean(settings.ollamaEndpoint)
    : Boolean(settings.claudeApiKey);

  return { settings, updateSettings, loading, isConfigured };
}
