import type { Speaker, GalleryImage } from '../../types';
import { validateContent, validateSpeaker, normalizeTag } from '../../types';

/**
 * Dev-only file-based CMS. Talks to the vite plugin endpoints:
 *   PUT  /api/content      — save the whole speakers array
 *   POST /api/upload       — save one image file (binary, see vite.config.ts)
 *
 * No delete of image files, per AGENTS.md §5.
 */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function putContent(speakers: Speaker[]): Promise<void> {
  const errors = validateContent(speakers);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const res = await fetch('/api/content', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(speakers, null, 2),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status} ${await res.text()}`);
}

async function uploadImage(slug: string, file: File): Promise<string> {
  // Binary framing: 12-byte slug + 8-byte name length + name + bytes (see vite.config.ts)
  const enc = new TextEncoder();
  const nameBytes = enc.encode(file.name);
  const slugBytes = enc.encode(slug);
  if (slugBytes.length > 12) throw new Error('slug too long for upload frame');
  const head = new Uint8Array(20);
  head.set(slugBytes, 0);
  new DataView(head.buffer).setUint32(12, nameBytes.length);
  const body = new Uint8Array(20 + nameBytes.length + file.size);
  body.set(head, 0);
  body.set(nameBytes, 20);
  body.set(new Uint8Array(await file.arrayBuffer()), 20 + nameBytes.length);

  const res = await fetch('/api/upload', { method: 'POST', body });
  const json = (await res.json()) as { path?: string; error?: string };
  if (!res.ok || !json.path) throw new Error(json.error ?? `upload failed: ${res.status}`);
  return json.path;
}

export function renderAdmin(speakers: Speaker[], reload: () => void): HTMLElement {
  const root = document.createElement('div');
  const h = document.createElement('h1');
  h.textContent = 'CMS // admin';
  root.append(h);

  const status = document.createElement('div');
  status.className = 'dim';
  status.style.whiteSpace = 'pre-wrap';
  status.style.margin = '12px 0';
  root.append(status);

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = 'var(--gap)';
  list.style.marginBottom = '28px';

  const editor = document.createElement('div');

  function say(msg: string, isError = false): void {
    status.textContent = msg;
    status.style.color = isError ? 'var(--danger)' : 'var(--fg-dim)';
  }

  function openEditor(speaker: Speaker | null, isNew: boolean): void {
    editor.replaceChildren();
    editor.style.marginTop = '24px';
    const draft: Speaker = speaker ?? {
      slug: '',
      name: '',
      tagline: '',
      story: '',
      gallery: [],
      createdAt: today(),
      updatedAt: today(),
      tags: [],
    } as Speaker;

    const panel = document.createElement('div');
    panel.className = 'card';
    const title = document.createElement('h2');
    title.textContent = isNew ? 'new speaker' : `edit: ${draft.slug}`;
    panel.append(title);

    const field = (
      label: string,
      value: string,
      onInput: (v: string) => void,
      multiline = false
    ): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.style.margin = '14px 0';
      const l = document.createElement('label');
      l.className = 'label';
      l.textContent = label;
      const input = document.createElement(multiline ? 'textarea' : 'input');
      input.className = 'input';
      if (multiline) (input as HTMLTextAreaElement).rows = 12;
      input.value = value;
      input.addEventListener('input', () => onInput(input.value));
      wrap.append(l, input);
      return wrap;
    };

    // ensure tags exists
    if (!Array.isArray(draft.tags)) draft.tags = [];

    panel.append(
      field('slug (kebab-case, immutable once created)', draft.slug, (v) => {
        draft.slug = v.trim();
      }),
      field('name', draft.name, (v) => (draft.name = v)),
      field('tagline', draft.tagline, (v) => (draft.tagline = v)),
      field('story (markdown)', draft.story, (v) => (draft.story = v), true)
    );

    // tags chip editor
    const tagsWrap = document.createElement('div');
    tagsWrap.style.margin = '14px 0';
    const tagsLabel = document.createElement('label');
    tagsLabel.className = 'label';
    tagsLabel.textContent = 'tags (kebab-case, comma or enter to add)';
    tagsWrap.append(tagsLabel);

    const chipRow = document.createElement('div');
    chipRow.style.display = 'flex';
    chipRow.style.flexWrap = 'wrap';
    chipRow.style.gap = '6px';
    chipRow.style.padding = '6px 8px';
    chipRow.style.border = '1px solid var(--border)';
    chipRow.style.background = 'var(--bg-inset)';
    chipRow.style.minHeight = '34px';

    const chipInput = document.createElement('input');
    chipInput.className = 'input';
    chipInput.type = 'text';
    chipInput.placeholder = 'add tag...';
    chipInput.style.border = 'none';
    chipInput.style.padding = '0';
    chipInput.style.background = 'transparent';
    chipInput.style.flex = '1';
    chipInput.style.minWidth = '80px';

    function renderChips(): void {
      chipRow.querySelectorAll('.chip').forEach((c) => c.remove());
      for (const t of draft.tags || []) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '6px';
        chip.style.padding = '2px 6px';
        chip.style.border = '1px solid var(--border)';
        chip.style.fontSize = '12px';
        const txt = document.createElement('span');
        txt.textContent = t;
        const x = document.createElement('button');
        x.className = 'btn';
        x.textContent = 'x';
        x.style.padding = '0 4px';
        x.style.fontSize = '11px';
        x.onclick = () => {
          draft.tags = (draft.tags || []).filter((v) => v !== t);
          renderChips();
        };
        chip.append(txt, x);
        chipRow.insertBefore(chip, chipInput);
      }
    }

    function addToken(raw: string): void {
      const n = normalizeTag(raw);
      if (!n) return;
      if (!SLUG_RE.test(n)) return;
      if (!Array.isArray(draft.tags)) draft.tags = [];
      if (!draft.tags.includes(n)) draft.tags.push(n);
      chipInput.value = '';
      renderChips();
    }

    chipInput.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addToken(chipInput.value);
      } else if (e.key === 'Backspace' && chipInput.value === '' && (draft.tags || []).length > 0) {
        draft.tags = (draft.tags || []).slice(0, -1);
        renderChips();
      }
    };
    chipInput.onblur = () => {
      if (chipInput.value.trim()) addToken(chipInput.value);
    };

    chipRow.append(chipInput);
    renderChips();
    tagsWrap.append(chipRow);
    panel.append(tagsWrap);

    // gallery management
    const galWrap = document.createElement('div');
    galWrap.style.margin = '14px 0';
    const galLabel = document.createElement('label');
    galLabel.className = 'label';
    galLabel.textContent = `gallery (${draft.gallery.length}) — first is the cover`;
    galWrap.append(galLabel);

    const galList = document.createElement('div');
    galList.style.display = 'grid';
    galList.style.gap = '6px';
    const renderGal = (): void => {
      galList.replaceChildren();
      draft.gallery.forEach((g, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        row.style.border = '1px solid var(--border)';
        row.style.padding = '6px 8px';
        row.style.background = 'var(--bg-inset)';

        const path = document.createElement('span');
        path.textContent = g.path;
        path.style.fontSize = '12px';
        path.style.flex = '1';
        row.append(path);

        const cap = document.createElement('input');
        cap.className = 'input';
        cap.value = g.caption;
        cap.placeholder = 'caption';
        cap.style.maxWidth = '160px';
        cap.addEventListener('input', () => (g.caption = cap.value));
        row.append(cap);

        const mkBtn = (txt: string, fn: () => void, danger = false): HTMLButtonElement => {
          const b = document.createElement('button');
          b.className = 'btn' + (danger ? ' btn-danger' : '');
          b.textContent = txt;
          b.style.padding = '3px 8px';
          b.style.fontSize = '12px';
          b.addEventListener('click', fn);
          return b;
        };
        row.append(
          mkBtn('^', () => {
            if (idx > 0) {
              [draft.gallery[idx - 1], draft.gallery[idx]] = [draft.gallery[idx], draft.gallery[idx - 1]];
              renderGal();
            }
          }),
          mkBtn('v', () => {
            if (idx < draft.gallery.length - 1) {
              [draft.gallery[idx + 1], draft.gallery[idx]] = [draft.gallery[idx], draft.gallery[idx + 1]];
              renderGal();
            }
          }),
          mkBtn('x', () => {
            // remove from list only — files are never auto-deleted (AGENTS.md §5)
            draft.gallery.splice(idx, 1);
            renderGal();
          }, true)
        );
        galList.append(row);
      });
    };
    renderGal();
    galWrap.append(galList);

    const uploadRow = document.createElement('div');
    uploadRow.style.marginTop = '10px';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', async () => {
      if (!draft.slug || !SLUG_RE.test(draft.slug)) {
        say('set a valid kebab-case slug before uploading', true);
        fileInput.value = '';
        return;
      }
      const files = fileInput.files;
      if (!files) return;
      try {
        for (const f of Array.from(files)) {
          const path = await uploadImage(draft.slug, f);
          const entry: GalleryImage = { path, caption: f.name.replace(/\.[^.]+$/, '') };
          draft.gallery.push(entry);
        }
        say(`uploaded ${files.length} file(s)`);
        renderGal();
      } catch (e) {
        say(String(e), true);
      }
      fileInput.value = '';
    });
    uploadRow.append(fileInput);
    galWrap.append(uploadRow);
    panel.append(galWrap);

    // actions
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '18px';

    const save = document.createElement('button');
    save.className = 'btn';
    save.textContent = 'save';
    save.addEventListener('click', async () => {
      draft.updatedAt = today();
      const errors = validateSpeaker(draft);
      if (errors.length > 0) {
        say(errors.join('\n'), true);
        return;
      }
      if (speakers.some((s) => s.slug === draft.slug && s !== speaker)) {
        say(`duplicate slug: ${draft.slug}`, true);
        return;
      }
      const next = isNew ? [draft, ...speakers] : speakers.map((s) => (s.slug === draft.slug ? draft : s));
      try {
        await putContent(next);
        say(`saved ${draft.slug}`);
        reload();
      } catch (e) {
        say(String(e), true);
      }
    });

    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'cancel';
    cancel.addEventListener('click', () => editor.replaceChildren());

    actions.append(save, cancel);
    panel.append(actions);
    editor.append(panel);
  }

  // existing speakers
  for (const sp of speakers) {
    const row = document.createElement('div');
    row.className = 'card';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const info = document.createElement('div');
    info.style.flex = '1';
    const name = document.createElement('div');
    name.textContent = sp.name;
    name.style.fontWeight = '700';
    const meta = document.createElement('div');
    meta.className = 'dim';
    meta.style.fontSize = '12px';
    meta.textContent = `${sp.slug} · updated ${sp.updatedAt}`;
    info.append(name, meta);
    row.append(info);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.textContent = 'edit';
    editBtn.addEventListener('click', () => openEditor(sp, false));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`delete "${sp.name}" from speakers.json?\n(image files are kept)`)) return;
      try {
        await putContent(speakers.filter((s) => s.slug !== sp.slug));
        say(`deleted ${sp.slug} (image files kept on disk)`);
        reload();
      } catch (e) {
        say(String(e), true);
      }
    });

    row.append(editBtn, delBtn);
    list.append(row);
  }
  root.append(list);

  const newBtn = document.createElement('button');
  newBtn.className = 'btn';
  newBtn.textContent = '+ new speaker';
  newBtn.addEventListener('click', () => openEditor(null, true));
  root.append(newBtn, editor);

  if (speakers.length === 0) say('no speakers yet — create one below');
  return root;
}
