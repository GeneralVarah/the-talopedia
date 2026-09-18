// Search shared by the masthead dropdown and the /search page.
//
// Pagefind alone ranks by full-text relevance, which buries the article a reader
// actually asked for: searching "shogun" put section fragments of six other pages
// above Nichirin, whose official name is the Miyamoto Shogunate. So titles are
// matched here and placed first, and Pagefind supplies everything else.

const BASE = (document.documentElement.dataset.base || '').replace(/\/$/, '');
export const href = (p) => BASE + (p.startsWith('/') ? p : '/' + p);

const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let titlesPromise = null;
const titles = () =>
  (titlesPromise ??= fetch(href('/articles.json')).then((r) => r.json()).catch(() => []));

let pfPromise = null;
const pagefind = () =>
  (pfPromise ??= import(/* @vite-ignore */ href('/pagefind/pagefind.js')).catch(() => null));

/** How well an article's own name answers the query. 0 means it does not. */
function titleScore(title, q) {
  const t = fold(title), n = fold(q);
  if (!n) return 0;
  if (t === n) return 100;
  if (t.startsWith(n)) return 80;
  // Word starts only. A bare substring match put "Ogasawara" under a search for "war".
  return new RegExp(`\\b${esc(n)}`).test(t) ? 60 : 0;
}

const tidy = (u) => (u.replace(/index\.html$/, '').replace(/\/$/, '') || '/');

/**
 * Ranked results: articles whose title matches, then pages that merely mention
 * the term. `limit` caps how many mention excerpts are loaded; `hasMore` says
 * whether Pagefind held back others.
 */
export async function search(query, limit = 8) {
  const q = query.trim();
  if (!q) return { titled: [], mentions: [], hasMore: false };

  const [list, pf] = await Promise.all([titles(), pagefind()]);

  const titled = list
    .map((a) => ({ ...a, score: titleScore(a.title, q) }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .map((a) => ({
      url: href(a.slug.startsWith('portal:') ? '/portal/' + a.slug.slice(7) : '/' + a.slug),
      title: a.title, type: a.type, excerpt: a.lede || '',
    }));

  const seen = new Set(titled.map((h) => tidy(h.url)));
  const mentions = [];
  let hasMore = false;

  if (pf) {
    const found = await pf.search(q);
    // Each excerpt is its own fetch, so ask for them together rather than in a queue:
    // "evria" hits 31 pages and one-at-a-time left the page on "Searching…" for seconds.
    const take = found.results.slice(0, limit + titled.length);
    hasMore = found.results.length > take.length;
    for (const data of await Promise.all(take.map((r) => r.data()))) {
      if (mentions.length >= limit) { hasMore = true; break; }
      const u = tidy(data.url);
      if (seen.has(u)) continue;
      seen.add(u);
      mentions.push({ url: u, title: data.meta?.title || u, excerpt: data.excerpt });
    }
  }
  return { titled, mentions, hasMore };
}
