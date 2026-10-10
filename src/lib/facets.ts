import type { Facet, Speaker } from '../types';

/** Unique tags across the catalog, global counts, count desc then name. */
export function collectFacets(speakers: Speaker[]): Facet[] {
  const counts = new Map<string, number>();
  for (const sp of speakers) {
    const seen = new Set<string>();
    for (const t of sp.tags ?? []) {
      if (seen.has(t)) continue;
      seen.add(t);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Speakers that have every selected tag. Empty selection is the full list. */
export function filterByTags(speakers: Speaker[], selected: string[]): Speaker[] {
  if (selected.length === 0) return speakers;
  return speakers.filter((sp) => {
    const tags = sp.tags ?? [];
    return selected.every((t) => tags.includes(t));
  });
}
