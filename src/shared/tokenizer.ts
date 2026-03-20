// Simple token estimator — ~4 characters per token (GPT/Claude heuristic).
// No external dependencies; good enough for UI display purposes.

const CHARS_PER_TOKEN = 4;

/** Estimate token count from raw text. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

/** Format a token count for compact display: "42", "1.2k", "15.3k". */
export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + 'k';
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k';
  return (n / 1_000_000).toFixed(1) + 'M';
}
