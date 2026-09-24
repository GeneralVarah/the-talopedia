/**
 * Which pages point at which. Built once and read by every Connections page.
 *
 * Links live in two places: the article text and the sidebar values in frontmatter.
 * Rather than walk each shape, the whole record is flattened to a string and scanned,
 * so a link added to a row type nobody has thought of yet is still found.
 */

const REF = /\[\[([^\]|#]+?)(?:\|[^\]]*)?\]\]/g;

/** Every page this one names, as slugs. Anchors on the same page are not links out. */
function outgoing(entry) {
  const hay = JSON.stringify(entry.data ?? {}) + '\n' + (entry.body ?? '');
  const out = new Set();
  for (const m of hay.matchAll(REF)) {
    const t = m[1].trim();
    if (t) out.add(t);
  }
  return out;
}

/**
 * @param {Array} pages every article and portal, portals keyed `portal:<id>`
 * @returns {{out: Map<string, Set<string>>, in: Map<string, Set<string>>}}
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
  return { out, in: into };
}
