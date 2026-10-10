import './styles/tokens.css';
import './styles/pixel.css';
import { startRouter, type Route } from './router';
import { loadSpeakers } from './lib/content';
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
    app.replaceChildren(shell(homeEl()));
    return;
  }

  if (route.name === 'speaker') {
    const sp = speakers.find((s) => s.slug === route.slug);
    app.replaceChildren(shell(sp ? speakerEl(sp) : notFoundEl()));
    return;
  }

  app.replaceChildren(shell(notFoundEl()));
}

function homeEl(): HTMLElement {
  const frag = document.createElement('div');
  const h = document.createElement('h1');
  h.textContent = 'Designs';
  const p = document.createElement('p');
  p.className = 'dim';
  p.textContent = 'A collection of loudspeaker designs with notes and photos.';
  frag.append(h, p);

  if (speakers.length === 0) {
    const p = document.createElement('p');
    p.className = 'dim';
    p.textContent = 'No designs published yet. Add one via the admin UI (npm run dev → #/admin).';
    frag.append(p);
    return frag;
  }

  const listArea = document.createElement('div');
  const countBar = document.createElement('div');
  countBar.className = 'dim';
  countBar.style.marginBottom = 'var(--gap)';
  listArea.append(countBar);

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gap = 'var(--gap)';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';

  function renderList(): void {
    countBar.textContent = `${speakers.length} / ${speakers.length} speaker${speakers.length === 1 ? '' : 's'}`;
    grid.innerHTML = '';
    for (const sp of speakers) {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = `#/speaker/${sp.slug}`;
      card.style.display = 'flex';
      card.style.gap = 'var(--gap)';
      card.style.alignItems = 'center';
      card.style.color = 'inherit';
      if (sp.gallery.length > 0) {
        const img = document.createElement('img');
        img.src = sp.gallery[0].path;
        img.alt = sp.gallery[0].caption || sp.name;
        img.loading = 'lazy';
        img.style.width = '120px';
        img.style.height = '90px';
        img.style.objectFit = 'cover';
        img.style.border = '1px solid var(--border)';
        img.style.background = 'var(--bg-inset)';
        card.append(img);
      }
      const meta = document.createElement('div');
      const name = document.createElement('div');
      name.textContent = sp.name;
      name.style.fontWeight = '700';
      name.style.color = 'var(--fg)';
      const tagline = document.createElement('div');
      tagline.className = 'dim';
      tagline.style.fontSize = '13px';
      tagline.textContent = sp.tagline;
      meta.append(name, tagline);
      if ((sp.tags || []).length) {
        const tagsRow = document.createElement('div');
        tagsRow.style.display = 'flex';
        tagsRow.style.flexWrap = 'wrap';
        tagsRow.style.gap = '6px';
        for (const t of (sp.tags || []).slice(0, 4)) {
          const pill = document.createElement('span');
          pill.className = 'dim';
          pill.textContent = t;
          pill.style.fontSize = '12px';
          pill.style.padding = '2px 6px';
          pill.style.border = '1px solid var(--border)';
          tagsRow.append(pill);
        }
        meta.append(tagsRow);
      }
      card.append(meta);
      grid.append(card);
    }
    listArea.append(grid);
  }
  
  renderList();
  frag.append(listArea);
  return frag;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
    tagsRow.style.display = 'flex';
    tagsRow.style.flexWrap = 'wrap';
    tagsRow.style.gap = '6px';
    for (const t of (sp.tags || [])) {
      const pill = document.createElement('a');
      pill.className = 'dim';
      pill.href = `#/?tags=${t},`; // Add comma so tag filters work
      pill.textContent = t;
      pill.style.fontSize = '12px';
      pill.style.border = '1px solid var(--border)';
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