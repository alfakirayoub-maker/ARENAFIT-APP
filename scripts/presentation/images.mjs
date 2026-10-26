#!/usr/bin/env node
/**
 * Temporary presentation photos (presentation/README.md) — apply or remove.
 *
 *   node scripts/presentation/images.mjs apply  [--local] [--dry-run]
 *   node scripts/presentation/images.mjs remove [--local] [--dry-run]
 *   node scripts/presentation/images.mjs status [--local]
 *
 * apply   uploads presentation/images/* to Storage under `presentation/` and
 *         points activities.image_path / news.cover_path at them — ONLY where
 *         the row has no image or already has a presentation image. A real photo
 *         uploaded from the dashboard is never touched.
 * remove  clears every `presentation/…` path and deletes those objects; the
 *         apps fall back to their default artwork.
 *
 * Target: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or --local (.local-stack/).
 * The service-role key stays on the operator's machine; the apps never see it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'presentation/manifest.json'), 'utf8'));
const PREFIX = manifest.storagePrefix;
const [command = 'status', ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');

let url = process.env.SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (flags.includes('--local')) {
  url = 'http://localhost:54321';
  key = readFileSync(join(ROOT, '.local-stack/service-key'), 'utf8').trim();
}
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --local.');
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
async function call(method, path, body, extra = {}) {
  const res = await fetch(url + path, { method, headers: { ...headers, ...extra }, body });
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
const rest = (method, path, body) =>
  call(method, `/rest/v1/${path}`, body && JSON.stringify(body), { 'content-type': 'application/json', Prefer: 'return=minimal' });

/** slot → local file, for slots whose prepared image exists and has a recorded licence. */
function availableSlots() {
  const slots = new Map();
  for (const [slot, spec] of Object.entries(manifest.images)) {
    const file = join(ROOT, 'presentation/images', spec.file);
    if (!existsSync(file)) continue;
    if (!spec.credit?.license || !spec.credit?.url) {
      console.warn(`! ${slot}: no credit/licence recorded in the manifest — skipped`);
      continue;
    }
    slots.set(slot, file);
  }
  return slots;
}

const isPresentation = (path) => typeof path === 'string' && path.startsWith(PREFIX);
const keyFor = (slot) => `${PREFIX}${manifest.images[slot].file}`;

/** Rows to update: [table, id, column, bucket, wanted path, current path]. */
async function plan(slots) {
  const out = [];
  const activities = await rest('GET', 'activities?select=id,slug,category,image_path');
  for (const a of activities) {
    if (a.image_path && !isPresentation(a.image_path)) continue; // real photo
    const slot = manifest.activities.bySlug[a.slug] ?? manifest.activities.byCategory[a.category];
    if (slot && slots.has(slot)) out.push(['activities', a.id, 'image_path', 'activities', keyFor(slot), a.image_path, a.slug]);
  }
  const news = await rest('GET', 'news?select=id,slug,category,cover_path');
  for (const n of news) {
    if (n.cover_path && !isPresentation(n.cover_path)) continue;
    const slot = manifest.news.byCategory[n.category];
    if (slot && slots.has(slot)) out.push(['news', n.id, 'cover_path', 'news', keyFor(slot), n.cover_path, n.slug]);
  }
  return out;
}

async function apply() {
  const slots = availableSlots();
  if (slots.size === 0) {
    console.log('No prepared presentation images yet (presentation/images/). Nothing to do.');
    return;
  }
  const rows = await plan(slots);
  const uploads = new Set(rows.map(([, , , bucket, path]) => `${bucket}/${path}`));
  for (const target of uploads) {
    const slot = Object.keys(manifest.images).find((s) => target.endsWith(`/${keyFor(s)}`));
    console.log(`↑ ${target}`);
    if (!dryRun) {
      await call('POST', `/storage/v1/object/${target}`, readFileSync(slots.get(slot)), {
        'content-type': 'image/jpeg',
        'x-upsert': 'true',
        'cache-control': 'max-age=3600',
      });
    }
  }
  let changed = 0;
  for (const [table, id, column, , path, current, label] of rows) {
    if (current === path) continue;
    console.log(`· ${table} ${label}: ${column} = ${path}`);
    if (!dryRun) await rest('PATCH', `${table}?id=eq.${id}`, { [column]: path });
    changed++;
  }
  console.log(`${dryRun ? '(dry run) ' : ''}${changed} row(s) updated, ${uploads.size} image(s) uploaded.`);
}

async function remove() {
  let changed = 0;
  for (const [table, column, bucket] of [['activities', 'image_path', 'activities'], ['news', 'cover_path', 'news']]) {
    const rows = await rest('GET', `${table}?select=id,${column}&${column}=like.${encodeURIComponent(PREFIX + '*')}`);
    for (const r of rows) {
      if (!dryRun) await rest('PATCH', `${table}?id=eq.${r.id}`, { [column]: null });
      changed++;
    }
    const objects = Object.values(manifest.images).map((s) => `${PREFIX}${s.file}`);
    if (!dryRun) await call('DELETE', `/storage/v1/object/${bucket}`, JSON.stringify({ prefixes: objects }), { 'content-type': 'application/json' });
  }
  console.log(`${dryRun ? '(dry run) ' : ''}${changed} presentation image path(s) cleared.`);
}

async function status() {
  const count = async (table, column) => {
    const rows = await rest('GET', `${table}?select=${column}`);
    return {
      real: rows.filter((r) => r[column] && !isPresentation(r[column])).length,
      presentation: rows.filter((r) => isPresentation(r[column])).length,
      none: rows.filter((r) => !r[column]).length,
    };
  };
  console.log('activities', await count('activities', 'image_path'));
  console.log('news      ', await count('news', 'cover_path'));
  console.log('prepared  ', [...availableSlots().keys()].join(', ') || '—');
}

const commands = { apply, remove, status };
if (!commands[command]) {
  console.error(`Unknown command "${command}" (apply | remove | status).`);
  process.exit(2);
}
commands[command]().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
