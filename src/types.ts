/**
 * The canonical content schema. The CMS and the site both import from here.
 * Changing a type here requires updating the admin form AND AGENTS.md §4.
 */

export interface GalleryImage {
  /** Relative to site root, e.g. "content/speakers/aurora/front.jpg" */
  path: string;
  /** Short alt text / caption */
  caption: string;
}

export interface Speaker {
  /** kebab-case, unique, used in URL: #/speaker/<slug> */
  slug: string;
  /** Display name */
  name: string;
  /** One-line intro */
  tagline: string;
  /** Markdown design notes */
  story: string;
  /** Ordered; index 0 is the cover on the home page */
  gallery: GalleryImage[];
  /** ISO 8601 date (YYYY-MM-DD), set by CMS */
  createdAt: string;
  /** ISO 8601 date (YYYY-MM-DD), set by CMS */
  updatedAt: string;
  /** Optional tags for faceting; normalized to kebab-case in CMS */
  tags?: string[];
}

export interface Facet {
  /** Tag name (kebab-case) */
  tag: string;
  /** Number of speakers having this tag */
  count: number;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a value against the Speaker schema. Returns a list of human-readable
 * problems; empty list means valid. Used by the CMS before every write.
 */
export function validateSpeaker(v: unknown): string[] {
  const errors: string[] = [];
  if (typeof v !== 'object' || v === null) return ['speaker must be an object'];
  const s = v as Record<string, unknown>;

  if (typeof s.slug !== 'string' || !SLUG_RE.test(s.slug)) {
    errors.push('slug must be kebab-case ([a-z0-9-])');
  }
  if (typeof s.name !== 'string' || s.name.trim() === '') errors.push('name is required');
  if (typeof s.tagline !== 'string') errors.push('tagline must be a string');
  if (typeof s.story !== 'string') errors.push('story must be a markdown string');
  if (!Array.isArray(s.gallery)) {
    errors.push('gallery must be an array');
  } else {
    s.gallery.forEach((g, i) => {
      if (typeof g !== 'object' || g === null) {
        errors.push(`gallery[${i}] must be an object`);
        return;
      }
      const gi = g as Record<string, unknown>;
      if (typeof gi.path !== 'string' || !gi.path.startsWith('content/speakers/')) {
        errors.push(`gallery[${i}].path must live under content/speakers/`);
      }
      if (typeof gi.caption !== 'string') errors.push(`gallery[${i}].caption must be a string`);
    });
  }
  if (typeof s.createdAt !== 'string' || !DATE_RE.test(s.createdAt)) {
    errors.push('createdAt must be YYYY-MM-DD');
  }
  if (typeof s.updatedAt !== 'string' || !DATE_RE.test(s.updatedAt)) {
    errors.push('updatedAt must be YYYY-MM-DD');
  }
  if (s.tags !== undefined) {
    if (!Array.isArray(s.tags)) {
      errors.push('tags must be an array');
    } else {
      s.tags.forEach((t, i) => {
        if (typeof t !== 'string' || !SLUG_RE.test(t)) {
          errors.push(`tags[${i}] must be kebab-case ([a-z0-9-])`);
        }
      });
    }
  }
  return errors;
}

/** Validate a whole speakers.json array, including slug uniqueness. */
export function validateContent(v: unknown): string[] {
  if (!Array.isArray(v)) return ['content must be an array'];
  const errors: string[] = [];
  const seen = new Set<string>();
  v.forEach((entry, i) => {
    for (const e of validateSpeaker(entry)) errors.push(`speakers[${i}]: ${e}`);
    const slug = (entry as Record<string, unknown>)?.slug;
    if (typeof slug === 'string') {
      if (seen.has(slug)) errors.push(`speakers[${i}]: duplicate slug "${slug}"`);
      seen.add(slug);
    }
  });
  return errors;
}

/** Normalize a single tag token to kebab-case (lowercase, alphanumeric + dash). */
export function normalizeTag(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
