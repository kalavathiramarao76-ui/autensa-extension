export interface FuzzyResult {
  score: number;
  matches: number[];
}

export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return { score: 1, matches: [] };

  const matches: number[] = [];
  let score = 0;
  let qi = 0;
  let lastMatch = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      matches.push(ti);
      // Consecutive match bonus
      score += lastMatch === ti - 1 ? 8 : 1;
      // Start-of-word bonus
      if (ti === 0 || /[\s\-_/.]/.test(text[ti - 1])) score += 5;
      // Exact prefix bonus
      if (ti === qi) score += 3;
      lastMatch = ti;
      qi++;
    }
  }

  if (qi < q.length) return null; // Not all chars matched
  // Normalize by query length to keep scores comparable
  return { score: score / q.length, matches };
}
