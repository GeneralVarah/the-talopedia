/**
 * Which pages point at which. Built once and read by every Connections page.
 *
 * Links live in three places: the article text, the sidebar values in frontmatter,
 * and the navbox entries. Rather than walk each shape, the whole record is flattened
 * to a string and scanned, so a link added to a row type nobody has thought of yet is
 * still found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { navbox } from './registry.mjs';

const REF = /\[\[([^\]|#]+?)(?:\|[^\]]*)?\]\]/g;

/** Every page this one names, as slugs. Anchors on the same page are not links out. */
export function outgoing(entry) {
  const hay = JSON.stringify(entry.data ?? {}) + '\n' + (entry.body ?? '');
  const out = new Set();
  for (const m of hay.matchAll(REF)) {
    const t = m[1].trim();
    if (t) out.add(t);
  }
  return out;
}

const NAVBOX_DIR = 'src/content/data/navboxes';

/** Every slug a navbox lists, so an article can say which ones carry it. */
function navboxMembers() {
  const byId = new Map();
  let ids = [];
  try {
    ids = fs.readdirSync(NAVBOX_DIR).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5));
  } catch { return byId; }
  for (const id of ids) {
    const box = navbox(id);
    if (!box) continue;
    const held = new Set();
    for (const g of box.groups || []) {
      for (const r of g.rows || [g]) {
        for (const item of r.items || []) held.add(String(item).split('|')[0].trim());
      }
    }
    for (const m of String(box.crumb || '').matchAll(REF)) held.add(m[1].trim());
    byId.set(id, held);
  }
  return byId;
}

/**
 * @param {Array} pages every article and portal, portals keyed `portal:<id>`
 * @returns {{out: Map<string, Set<string>>, in: Map<string, Set<string>>, boxes: Map<string, string[]>}}
 */
export function graph(pages) {
  const out = new Map();
  const into = new Map();
  for (const [key, entry] of pages) {
    const refs = outgoing(entry);
    out.set(key, refs);
    for (const t of refs) {
      if (!into.has(t)) into.set(t, new Set());
      into.get(t).add(key);
    }
  }
  const members = navboxMembers();
  const boxes = new Map();
  for (const [id, held] of members) {
    for (const slug of held) {
      if (!boxes.has(slug)) boxes.set(slug, []);
      boxes.get(slug).push(id);
    }
  }
  return { out, in: into, boxes };
}
