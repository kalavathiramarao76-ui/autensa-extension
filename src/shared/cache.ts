// ─── Response Cache (LRU, in-memory) ───────────────────────────────────

import { ToolCallDisplay } from './types';

export interface CacheEntry {
  response: string;
  timestamp: number;
  model: string;
  toolCalls?: ToolCallDisplay[];
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}

const MAX_SIZE = 50;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Page-context patterns — queries referencing the active page should not be cached
const PAGE_CONTEXT_PATTERNS = [
  /\bthis page\b/i,
  /\bcurrent page\b/i,
  /\bthis tab\b/i,
  /\bcurrent tab\b/i,
  /\bthis site\b/i,
  /\bthis url\b/i,
  /\bthe page\b/i,
  /\bthis article\b/i,
  /\bthis website\b/i,
  /\bopen tab\b/i,
];

// ── Internals ──

// Map preserves insertion order — we use it as an LRU list
const cache = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

// ── Helpers ──

function normalizeKey(query: string, model: string): string {
  return `${model}::${query.toLowerCase().trim().replace(/\s+/g, ' ')}`;
}

function isPageContextQuery(query: string): boolean {
  return PAGE_CONTEXT_PATTERNS.some(p => p.test(query));
}

function evictStale(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > TTL_MS) {
      cache.delete(key);
    }
  }
}

function evictLRU(): void {
  while (cache.size > MAX_SIZE) {
    // Map iterator yields in insertion order — first key is the oldest
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

// ── Public API ──

/**
 * Returns true if the query is eligible for caching.
 * Queries referencing page context are never cached.
 */
export function isCacheable(query: string): boolean {
  return !isPageContextQuery(query);
}

export function getFromCache(query: string, model: string): CacheEntry | null {
  if (!isCacheable(query)) {
    misses++;
    return null;
  }

  const key = normalizeKey(query, model);
  const entry = cache.get(key);

  if (!entry) {
    misses++;
    return null;
  }

  // TTL check
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    misses++;
    return null;
  }

  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, entry);

  hits++;
  return entry;
}

export function addToCache(query: string, entry: CacheEntry): void {
  if (!isCacheable(query)) return;

  // Don't cache entries that had tool calls (side effects)
  if (entry.toolCalls && entry.toolCalls.length > 0) return;

  // Don't cache error responses
  if (entry.response.startsWith('Error:')) return;

  const key = normalizeKey(query, entry.model);

  // Delete first so re-insertion puts it at the end (most recent)
  cache.delete(key);
  cache.set(key, entry);

  evictStale();
  evictLRU();
}

export function clearCache(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}

export function getCacheStats(): CacheStats {
  evictStale();
  return {
    size: cache.size,
    hits,
    misses,
  };
}
