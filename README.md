# Speaker Design Showcase

A static SPA portfolio for loudspeaker designs, built with **Vite + vanilla TypeScript** in a retro-terminal **pixel aesthetic**. Content lives in `content/speakers.json` (plus images under `content/speakers/<slug>/`) — no database. A dev-only admin UI edits that content.

## Quick start

```bash
npm install
npm run dev        # site at /yfSound/, admin at #/admin
npm run build      # tsc + vite build → dist/
npm run preview    # serve the prod build locally
```

## Content workflow

1. `npm run dev`, open `http://localhost:5173/yfSound/#/admin`
2. Create/edit speakers, upload gallery images (written to `content/speakers/<slug>/`, referenced from JSON)
3. `git add . && git commit && git push` — GitHub Actions builds and deploys `dist/` to GitHub Pages

> The `#/admin` route only exists in dev. Image uploads require the local dev server — pages are static.

## Deploy

- Push to `main` → `.github/workflows/deploy.yml` builds and publishes.
- The site is served under `/yfSound/` (repo name). For a user site or a custom domain, set `BASE_PATH=/` when building:
  `BASE_PATH=/ npm run build`

## Docs

- [`AGENTS.md`](AGENTS.md) — the project's governing rules: stack, schema, CMS contract, pixel design guide, conventions.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | dev server + CMS API endpoints |
| `npm run build` | type-check + production build |
| `npm run preview` | serve `dist/` locally |