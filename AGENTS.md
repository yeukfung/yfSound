# AGENTS.md — yfSound (Speaker Design Showcase)

> This document governs the entire project. Any agent (human or AI) working on this
> repo MUST follow these rules. If a change conflicts with this file, update this
> file first, then make the change.

## 1. Project Purpose

A personal portfolio website showcasing the author's speaker (loudspeaker) designs.
Each design has a page with a long-form design story and a photo gallery. The site
is a static single-page app (SPA) built locally and served from GitHub Pages.
Content is managed through a local-only admin UI that writes plain JSON files and
stores images on the filesystem — **no database, ever**.

## 2. Tech Stack (fixed)

| Concern        | Choice                                   | Notes |
|----------------|------------------------------------------|-------|
| Build tool     | Vite                                     | dev server + prod build to `/dist` |
| Language       | TypeScript (strict mode)                 | no `any` in exported types |
| UI             | Vanilla TS DOM helpers                   | NO React/Vue/Svelte/frameworks |
| Styling        | Plain CSS with design tokens             | NO Tailwind, NO CSS frameworks |
| Routing        | Hand-rolled hash router (`src/router.ts`) | hash-based so GitHub Pages Just Works™ |
| Content store  | `content/speakers.json`                  | single JSON file, human-editable |
| Images         | `content/speakers/<slug>/`               | referenced by relative path from JSON |
| Story format   | Markdown-in-JSON, rendered at runtime    | tiny renderer in `src/lib/markdown.ts` |
| Hosting        | GitHub Pages via GitHub Actions          | builds on push to `main` |

**Forbidden dependencies:** any UI framework, CSS framework, router library,
state management library, database client. If you think you need one, propose it
in this file first.

## 3. Non-Negotiable Rules

1. **No `border-radius` anywhere.** The pixel aesthetic is square. Ever.
2. **Monospace, system fonts only.** `font-family: var(--font-mono)` — no webfonts, no CDN.
3. **No external network requests at runtime** — no CDNs, no analytics, no embeds.
   (User-uploaded images are the only exception, and they are local files.)
4. **The CMS writes ONLY to `content/`.** Never to `src/`, never to config files.
5. **`content/speakers.json` is the source of truth.** If it isn't in the JSON, it
   isn't on the site.
6. **The admin UI must not appear in the production build.** The `#/admin` route
   renders a 404 unless `import.meta.env.DEV`. The admin module is dynamically
   imported only after that guard, so it ends up as a lazy chunk that production
   never requests. It is NOT statically tree-shaken — don't rely on that.
7. **TypeScript types in `src/types.ts` are the schema.** Both the site and the
   CMS import from there. Change the type → update the CMS form → update this doc.
8. **Validate before write.** The CMS must validate a speaker object against the
   schema before it touches `speakers.json`. Invalid data never gets written.

## 4. Content Schema

Canonical definition: `src/types.ts`. Summary:

```ts
interface GalleryImage {
  path: string;      // relative to site root, e.g. "content/speakers/aurora/front.jpg"
  caption: string;   // short alt text / caption
}

interface Speaker {
  slug: string;      // kebab-case, unique, used in URL: #/speaker/<slug>
  name: string;      // display name, e.g. "Aurora 2-Way"
  tagline: string;   // one-line intro
  story: string;     // markdown, the design notes
  gallery: GalleryImage[];  // ordered, first image is the cover
  createdAt: string; // ISO 8601 date, set by CMS
  updatedAt: string; // ISO 8601 date, set by CMS
}
```

`speakers.json` is a top-level array of `Speaker`, ordered by `createdAt` desc
(newest first). The home page renders in file order.

## 5. CMS Contract

- Route: `#/admin` — only reachable in dev (`npm run dev`).
- Actions allowed: create speaker, edit speaker, delete speaker, reorder gallery,
  upload image.
- On image upload:
  1. sanitize the filename to kebab-case
  2. write to `content/speakers/<slug>/<sanitized-name>`
  3. insert the relative path into the speaker's `gallery`
- On save:
  1. validate against schema
  2. set `updatedAt`
  3. write pretty-printed JSON (2-space indent, UTF-8, trailing newline)
- On delete: remove the speaker entry from JSON. **Do NOT delete image files
  automatically** — orphan cleanup is a manual/human decision.
- The CMS talks to the dev server through a Vite plugin (`cmsPlugin` in
  `vite.config.ts`). The plugin is only registered when `command === 'serve'`, so
  the endpoints exist in dev only. Exactly two endpoints:
  - `POST /api/upload` — raw binary body framed as: 12-byte NUL-padded slug +
    4-byte big-endian filename length + 4 reserved bytes + UTF-8 filename +
    image bytes. Responds `{ "path": "content/speakers/<slug>/<file>" }`.
  - `GET|PUT /api/content` — GET returns the raw `speakers.json`; PUT replaces it
    with the submitted array (pretty-printed, trailing newline).
  - Delete has NO dedicated endpoint: the CMS removes the entry from its local
    array and PUTs the whole array. Failures respond `{ "error": ... }` with a
    4xx/5xx status.

## 6. Pixel Design Guide

The look: retro terminal / pixel-art, inspired by the OpenCode website aesthetic.

### Palette (tokens in `src/styles/tokens.css`)

| Token              | Value     | Use |
|--------------------|-----------|-----|
| `--bg`             | `#0a0e14` | page background |
| `--bg-raised`      | `#11161f` | cards, panels |
| `--bg-inset`       | `#070a0f` | inset wells, image frames |
| `--border`         | `#2a3340` | default 1px borders |
| `--border-strong`  | `#3d4a5c` | emphasized borders, 2px |
| `--fg`             | `#c5cdd9` | body text |
| `--fg-dim`         | `#6b7686` | secondary text, captions |
| `--accent`         | `#7fd962` | links, focus, highlights (terminal green) |
| `--accent-warn`    | `#e0b458` | warnings, hover accents (amber) |
| `--danger`         | `#d95c5c` | destructive actions |

### Typography

- `--font-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;`
- Base 15px / 1.6. H1 24px, H2 19px, H3 16px. No italics except blockquotes.
- Letter-spacing `0.02em` on headings for a mechanical feel.

### Shapes & depth

- **Square corners only.** Buttons, cards, images, inputs — all `border-radius: 0`.
- Borders are the depth system: 1px `--border` default, 2px `--border-strong` for
  emphasis. No box-shadows, no gradients on UI chrome.
- Selected/hover states: border color shifts to `--accent`.

### Background texture

Dot-grid via CSS (no images):

```css
background-image: radial-gradient(var(--border) 1px, transparent 1px);
background-size: 16px 16px;
```

### Motion

Transitions only on `border-color`, `color`, `background-color` — 120ms, linear.
No transforms, no bounces. Blinking cursor allowed on the site title via
`@keyframes` with `steps(2, end)`.

## 7. Build & Deploy

- `npm run dev` — dev server with admin enabled at `#/admin`
- `npm run build` — `tsc && vite build` → `/dist`, admin excluded
- `npm run preview` — serve the prod build locally
- GitHub Pages workflow: `.github/workflows/deploy.yml` triggers on push to `main`,
  runs `npm ci && npm run build`, publishes `/dist` via `actions/deploy-pages`.
- `content/` is copied verbatim into `dist/` during the build (`copyContentPlugin`
  in `vite.config.ts`) — prod is a fully static snapshot and needs no dev server.
- `base` defaults to `/yfSound/` (the GitHub repo name). For a user site or a
  custom domain, override it: `BASE_PATH=/ npm run build`.
- Hash routing means no server-side rewrites are needed. No 404.html hack required.

## 8. Conventions

- **Slugs:** kebab-case matching `^[a-z0-9]+(-[a-z0-9]+)*$` — no spaces, no
  diacritics, no leading/trailing or doubled hyphens. `src/types.ts` enforces on
  save; the CMS enforces live while typing.
- **File names:** kebab-case, lowercase, images keep their real extension.
- **Gallery order:** array order = display order; index 0 is the cover on the home page.
- **Story markdown:** supports headings, paragraphs, bold/italic, inline code,
  links, unordered/ordered lists, blockquotes, code fences. Nothing else (no HTML).
- **Dates:** always ISO `YYYY-MM-DD` strings.
- **Comments:** explain *why*, not *what*. Skip restating the code.
- **Errors:** surface to the user in the admin UI, never silently swallow.

## 9. Change Log for This File

When you change a rule here, append a line:

- 2026-10-09 — initial version
- 2026-10-09 — corrected CMS endpoint contract: no `DELETE /api/speaker/<slug>`
  exists, delete goes through `PUT /api/content`; documented `/api/upload` binary
  framing. Clarified rule 6 (admin is a lazy chunk, not tree-shaken). Tightened
  slug convention to the actual regex. Documented the `dist/` content copy step
  and the `/yfSound/` base path in Build & Deploy.
