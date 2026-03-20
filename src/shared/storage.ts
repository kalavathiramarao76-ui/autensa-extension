import { Settings, DEFAULT_SETTINGS, Session } from './types';

const KEYS = {
  settings: 'autensa_settings',
  sessions: 'autensa_sessions',
  commandHistory: 'autensa_cmd_history',
} as const;

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEYS.settings]: { ...current, ...settings } });
}

export async function getSessions(): Promise<Session[]> {
  const result = await chrome.storage.local.get(KEYS.sessions);
  return result[KEYS.sessions] || [];
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await getSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  // Keep last 50
  await chrome.storage.local.set({ [KEYS.sessions]: sessions.slice(0, 50) });
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getSessions();
  await chrome.storage.local.set({
    [KEYS.sessions]: sessions.filter(s => s.id !== id),
  });
}

export async function getCommandHistory(): Promise<string[]> {
  const result = await chrome.storage.local.get(KEYS.commandHistory);
  return result[KEYS.commandHistory] || [];
}

export async function addCommandHistory(cmd: string): Promise<void> {
  const history = await getCommandHistory();
  const updated = [cmd, ...history.filter(h => h !== cmd)].slice(0, 20);
  await chrome.storage.local.set({ [KEYS.commandHistory]: updated });
}
