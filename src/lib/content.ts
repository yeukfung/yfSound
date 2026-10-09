import type { Speaker } from '../types';

/**
 * Load speakers.json. In dev, Vite serves it from the project root;
 * in prod it's copied into dist by the build (public content step) —
 * we fetch it relative to the configured base.
 */
export async function loadSpeakers(): Promise<Speaker[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}content/speakers.json`);
  if (!res.ok) throw new Error(`failed to load content: ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('speakers.json must be an array');
  return data as Speaker[];
}
