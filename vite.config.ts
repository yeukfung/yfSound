import { defineConfig, type Plugin } from 'vite';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

const CONTENT_DIR = 'content';
const SPEAKERS_JSON = join(CONTENT_DIR, 'speakers.json');

// Accept image uploads only — the CMS must never write arbitrary files.
const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

function kebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Dev-only file-based CMS endpoints. In production this plugin is not invoked
 * because the whole config callback checks command === 'serve'.
 */
function cmsPlugin(): Plugin {
  return {
    name: 'cms-api',
    configureServer(server) {
      // Read the raw body as a Buffer — image uploads must not be UTF-8 decoded.
      server.middlewares.use('/api/upload', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'method not allowed' }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', async () => {
          try {
            const raw = Buffer.concat(chunks);
            // Format: 20-byte header — 12 bytes slug (NUL-padded) + 8 bytes filename length,
            // then filename UTF-8, then image bytes. Simple and dependency-free.
            const slug = raw.subarray(0, 12).toString('utf8').replace(/\0+$/, '');
            const nameLen = raw.readUInt32BE(12);
            const filename = kebabCase(raw.subarray(20, 20 + nameLen).toString('utf8'));
            const data = raw.subarray(20 + nameLen);
            if (!/^[a-z0-9-]+$/.test(slug) || !ALLOWED_IMAGE_EXT.test(filename) || data.length === 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'invalid slug, filename, or empty file' }));
              return;
            }
            // normalize + containment check: slug is validated above, so this stays inside content/
            const relPath = normalize(join(CONTENT_DIR, 'speakers', slug, filename));
            if (!relPath.startsWith(CONTENT_DIR)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'path escapes content dir' }));
              return;
            }
            await mkdir(dirname(relPath), { recursive: true });
            await writeFile(relPath, data);
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ path: relPath }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });

      server.middlewares.use('/api/content', (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method === 'GET') {
          readFile(SPEAKERS_JSON, 'utf8')
            .then((t) => res.end(t))
            .catch(() => res.end('[]'));
          return;
        }
        if (req.method === 'PUT') {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', async () => {
            try {
              // Validate it parses before writing; full schema validation
              // happens client-side in the CMS before it sends.
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (!Array.isArray(parsed)) throw new Error('content must be an array');
              await writeFile(SPEAKERS_JSON, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: String(e) }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'method not allowed' }));
      });
    },
  };
}

/**
 * Prod builds fetch content/ from the site root, but Vite only copies public/.
 * This copies the whole content/ tree into dist so images + JSON ship together.
 */
function copyContentPlugin(): Plugin {
  return {
    name: 'copy-content',
    async closeBundle() {
      await cp(CONTENT_DIR, `dist/${CONTENT_DIR}`, { recursive: true });
    },
  };
}

export default defineConfig(({ command }) => ({
  // GitHub Pages serves under /<repo>/ unless using a custom domain.
  // Set BASE_PATH=/ for a user site or custom domain.
  base: process.env.BASE_PATH ?? '/yfSound/',
  plugins: command === 'serve' ? [cmsPlugin()] : [copyContentPlugin()],
  server: {
    fs: {
      // The site loads images from content/ in both dev and prod.
      allow: ['.'],
    },
  },
}));
