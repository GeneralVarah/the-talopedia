/**
 * The article on the front page today.
 *
 * The pick is a function of the date, so every reader sees the same one all day and
 * it changes at midnight UTC without anybody editing the front page. A hash rather
 * than the day number modulo the list, or consecutive days would walk the articles in
 * alphabetical order and the run would be obvious within a week.
 *
 * An article qualifies when it has both halves of the panel: a sidebar picture and an
 * overview to quote. Roughly ten of the shorter ones do not, and they are skipped
 * rather than shown as a heading over nothing.
 */

/** Everything before the first section heading: the overview, as rendered HTML. */
export function overview(html = '') {
  const cut = html.search(/<h2\b/);
  return cut === -1 ? html : html.slice(0, cut);
}

/** The first picture in an article's sidebar. */
export function firstImage(data) {
  const row = (data.infobox || []).find((r) => r.image || r.images?.[0]?.src);
  return row?.image || row?.images?.[0]?.src || '';
}

/** Stable across builds and platforms, unlike anything seeded from Math.random. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function featured(entries, today = new Date()) {
  const day = today.toISOString().slice(0, 10);
  const pool = entries
    .filter((e) => e.id !== 'home')
    .filter((e) => firstImage(e.data) && overview(e.rendered?.html || '').length > 300)
    // Sorted so the pick depends on the date and the set, never on directory order.
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return null;
  return pool[hash(day) % pool.length];
}
