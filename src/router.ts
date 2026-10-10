/**
 * Minimal hash router. Hash-based so GitHub Pages needs no rewrites.
 * Routes:  #/                  → home
 *          #/?tags=a,b         → home filtered by tags (AND)
 *          #/speaker/<slug>    → speaker page
 *          #/admin             → CMS (dev only, page module checks env)
 */

const TAG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type Route =
  | { name: 'home'; tags: string[] }
  | { name: 'speaker'; slug: string }
  | { name: 'admin' };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = qIndex === -1 ? '' : raw.slice(qIndex + 1);

  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'speaker' && parts.length === 2 && parts[1] !== '') {
    return { name: 'speaker', slug: parts[1] };
  }
  if (parts[0] === 'admin') return { name: 'admin' };

  return { name: 'home', tags: parseTagQuery(query) };
}

function parseTagQuery(query: string): string[] {
  const raw = new URLSearchParams(query).get('tags') ?? '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(',')) {
    const t = token.trim();
    if (!TAG_RE.test(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Hash for the home route; empty selection is `#/`. */
export function homeHash(tags: string[]): string {
  if (tags.length === 0) return '#/';
  return `#/?tags=${tags.join(',')}`;
}

type Handler = (route: Route) => void;

export function startRouter(render: Handler): void {
  const onHash = () => render(parseHash(location.hash));
  window.addEventListener('hashchange', onHash);
  onHash();
}
