const FRECENCY_KEY = 'autensa_frecency';

interface FrecencyEntry {
  count: number;
  lastUsed: number;
}

type FrecencyData = Record<string, FrecencyEntry>;

function recencyDecay(lastUsed: number): number {
  const age = Date.now() - lastUsed;
  const HOUR = 3600_000;
  const DAY = 86400_000;
  const WEEK = 604800_000;
  if (age < HOUR) return 4;
  if (age < DAY) return 2;
  if (age < WEEK) return 1;
  return 0.5;
}

async function getData(): Promise<FrecencyData> {
  const result = await chrome.storage.local.get(FRECENCY_KEY);
  return result[FRECENCY_KEY] || {};
}

export async function updateFrecency(id: string): Promise<void> {
  const data = await getData();
  const entry = data[id] || { count: 0, lastUsed: 0 };
  data[id] = { count: entry.count + 1, lastUsed: Date.now() };
  await chrome.storage.local.set({ [FRECENCY_KEY]: data });
}

export async function getFrecencyScores(): Promise<Record<string, number>> {
  const data = await getData();
  const scores: Record<string, number> = {};
  for (const [id, entry] of Object.entries(data)) {
    scores[id] = entry.count * recencyDecay(entry.lastUsed);
  }
  return scores;
}
