/**
 * Minimal hash router. Hash-based so GitHub Pages needs no rewrites.
 * Routes:  #/                  → home
 *          #/speaker/<slug>    → speaker page
 *          #/admin             → CMS (dev only, page module checks env)
 */

export type Route =
  | { name: 'home' }
  | { name: 'speaker'; slug: string }
  | { name: 'admin' }
  | { name: 'notfound' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === '') return { name: 'home' };
  const parts = path.split('/');
  if (parts[0] === 'speaker' && parts.length === 2 && parts[1] !== '') {
    return { name: 'speaker', slug: parts[1] };
  }
  if (parts[0] === 'admin') return { name: 'admin' };
  return { name: 'notfound' };
}

type Handler = (route: Route) => void;

export function startRouter(render: Handler): void {
  const onHash = () => render(parseHash(location.hash));
  window.addEventListener('hashchange', onHash);
  onHash();
}
