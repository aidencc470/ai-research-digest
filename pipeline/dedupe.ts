import type { NormalizedItem } from './types.js';

export function dedupeItems(items: NormalizedItem[]): NormalizedItem[] {
  const seen = new Set<string>();
  const result: NormalizedItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}
