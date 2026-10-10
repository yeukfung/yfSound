import './styles/tokens.css';
import './styles/pixel.css';
import { homeHash, startRouter, type Route } from './router';
import { loadSpeakers } from './lib/content';
import { collectFacets, filterByTags } from './lib/facets';
import { renderMarkdown } from './lib/markdown';
import type { Speaker } from './types';

const app = document.getElementById('app')!;
let speakers: Speaker[] = [];

async function boot(): Promise<void> {
  try {
    speakers = await loadSpeakers();
  } catch (e) {
    speakers = [];
    console.error('Error loading speakers:', e);
  }
  startRouter(render);
}

function shell(content: HTMLElement): HTMLElement {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="inner">
      <a class="site-title" href="#/">yfSound<span class="cursor">_</span></a>
      <span class="site-tagline">a portfolio of DIY loudspeaker builds</span>
    </div>`;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.textContent = 'built with vite · content stored as json · no database';

  const main = document.createElement('main');
  main.append(content);

  const wrap = document.createElement('div');
  wrap.append(header, main, footer);
  return wrap;
}

async function render(route: Route): Promise<void> {
  app.replaceChildren();

  if (route.name === 'admin') {
    if (!import.meta.env.DEV) {
      app.replaceChildren(shell(notFoundEl()));
      return;
    }
    const { renderAdmin } = await import('./pages/admin/AdminPage');
    app.replaceChildren(shell(renderAdmin(speakers, reload)));
    return;
  }

  if (route.name === 'home') {
    app.replaceChildren(shell(homeEl(route.tags)));
    return;
  }

  if (route.name === 'speaker') {
    const sp = speakers.find((s) => s.slug === route.slug);
    app.replaceChildren(shell(sp ? speakerEl(sp) : notFoundEl()));
    return;
  }

  app.replaceChildren(shell(notFoundEl()));
}

function homeEl(selectedTags: string[]): HTMLElement {
  const frag = document.createElement('div');
  const h = document.createElement('h1');
  h.textContent = 'Designs';
  const p = document.createElement('p');
  p.className = 'dim';
  p.textContent = 'A collection of loudspeaker designs with notes and photos.';
  frag.append(h, p);

  if (speakers.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dim';
    empty.textContent = 'No designs published yet. Add one via the admin UI (npm run dev → #/admin).';
    frag.append(empty);
    return frag;
  }

  const facets = collectFacets(speakers);
  if (facets.length > 0) {
    const panel = document.createElement('div');
    panel.className = 'facet-panel';
    for (const f of facets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'facet' + (selectedTags.includes(f.tag) ? ' is-on' : '');
      btn.textContent = `${f.tag} (${f.count})`;
      btn.addEventListener('click', () => {
        const next = selectedTags.includes(f.tag)
          ? selectedTags.filter((t) => t !== f.tag)
          : [...selectedTags, f.tag];
        location.hash = homeHash(next);
      });
      panel.append(btn);
    }
    if (selectedTags.length > 0) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'facet';
      clear.textContent = 'clear';
      clear.addEventListener('click', () => {
        location.hash = homeHash([]);
      });
      panel.append(clear);
    }
    frag.append(panel);
  }

  const visible = filterByTags(speakers, selectedTags);
  const countBar = document.createElement('div');
  countBar.className = 'count-bar';
  countBar.textContent = `${visible.length} / ${speakers.length} speaker${speakers.length === 1 ? '' : 's'}`;
  frag.append(countBar);

  if (visible.length === 0) {
    const none = document.createElement('p');
    none.className = 'dim';
    none.textContent = 'no designs match these tags';
    frag.append(none);
    return frag;
  }

  const grid = document.createElement('div');
  grid.className = 'speaker-grid';
  for (const sp of visible) {
    const card = document.createElement('a');
    card.className = 'card card-row';
    card.href = `#/speaker/${sp.slug}`;
    if (sp.gallery.length > 0) {
      const img = document.createElement('img');
      img.className = 'card-cover';
      img.src = sp.gallery[0].path;
      img.alt = sp.gallery[0].caption || sp.name;
      img.loading = 'lazy';
      card.append(img);
    }
    const meta = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = sp.name;
    const tagline = document.createElement('div');
    tagline.className = 'dim card-tagline';
    tagline.textContent = sp.tagline;
    meta.append(name, tagline);
    if ((sp.tags || []).length) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'tag-row';
      for (const t of (sp.tags || []).slice(0, 4)) {
        const pill = document.createElement('span');
        pill.className = 'tag-pill';
        pill.textContent = t;
        tagsRow.append(pill);
      }
      meta.append(tagsRow);
    }
    card.append(meta);
    grid.append(card);
  }
  frag.append(grid);
  return frag;
}

function speakerEl(sp: Speaker): HTMLElement {
  const frag = document.createElement('div');

  const back = document.createElement('a');
  back.href = '#/';
  back.textContent = '<- all designs';
  back.style.display = 'inline-block';
  back.style.marginBottom = '18px';
  frag.append(back);

  const h = document.createElement('h1');
  h.textContent = sp.name;
  const tag = document.createElement('p');
  tag.className = 'dim';
  tag.textContent = sp.tagline;
  frag.append(h, tag);

  const story = document.createElement('article');
  story.className = 'story';
  story.innerHTML = renderMarkdown(sp.story);
  frag.append(story);

  if (sp.gallery.length > 0) {
    const gal = document.createElement('div');
    gal.style.display = 'grid';
    gal.style.gap = 'var(--gap)';
    for (const g of sp.gallery) {
      const figure = document.createElement('figure');
      figure.style.border = '1px solid var(--border)';
      figure.style.background = 'var(--bg-inset)';
      figure.style.padding = '8px';
      const img = document.createElement('img');
      img.src = g.path;
      img.alt = g.caption;
      figure.append(img);
      const cap = document.createElement('figcaption');
      cap.className = 'dim';
      cap.textContent = g.caption;
      figure.append(cap);
      gal.append(figure);
    }
    frag.append(gal);
  }

  if ((sp.tags || []).length) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'tag-row';
    for (const t of sp.tags || []) {
      const pill = document.createElement('a');
      pill.className = 'tag-pill';
      pill.href = homeHash([t]);
      pill.textContent = t;
      tagsRow.append(pill);
    }
    frag.append(tagsRow);
  }

  const date = document.createElement('p');
  date.className = 'dim';
  date.textContent = `created ${sp.createdAt} · updated ${sp.updatedAt}`;
  frag.append(date);

  return frag;
}

function notFoundEl(): HTMLElement {
  const frag = document.createElement('div');
  const h = document.createElement('h1');
  h.textContent = '404';
  const p = document.createElement('p');
  p.className = 'dim';
  p.textContent = 'Nothing here. ';
  const a = document.createElement('a');
  a.href = '#/';
  a.textContent = 'Back to all designs';
  p.append(a);
  frag.append(h, p);
  return frag;
}

function reload(): void {
  location.reload();
}

void boot();
