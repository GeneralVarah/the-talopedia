import { titleFor, iconFor, exists, url } from './registry.mjs';

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ARROW = {
  up: '<svg class="tri up" viewBox="0 0 10 9" aria-hidden="true"><path d="M5 0 10 9H0z"/></svg>',
  down: '<svg class="tri down" viewBox="0 0 10 9" aria-hidden="true"><path d="M5 9 0 0h10z"/></svg>',
};

/**
 * Where a picture lives. A path inside the site is answered under its base; a link to
 * an image host is already whole and is left exactly as it was written.
 */
export const asset = (p) => {
  const whole = p.replace(/&(?:amp;|#x26;|#38;)/gi, '&');
  return /^(https?:)?\/\//i.test(whole) ? whole : url(p);
};

export function icon(slug) {
  const src = iconFor(slug);
  return src ? `<img class="ico" src="${url(src)}" alt="" loading="lazy">` : '';
}

export function link(slug, display) {
  // [[#section-id|Text]] jumps within the page and is never a red link.
  if (slug.startsWith('#')) {
    return `<a class="wl anchor" href="${slug}">${esc(display || slug.slice(1))}</a>`;
  }
  const portal = slug.startsWith('portal:');
  const bare = portal ? slug.slice(7) : slug;
  const href = url(portal ? `/portal/${bare}` : `/${bare}`);
  const text = esc(display || titleFor(slug));
  const missing = !exists(slug) ? ' new' : '';
  return `<a class="wl${missing}" href="${href}">${text}</a>`;
}

// Custom syntax shared by article bodies, infobox values, navboxes and tables.
const CUSTOM = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]|:(icon|flag|img)\[([^\]]+?)\]|:(up|down)\b/g;
// Plus the two marks and the one link form the editor can produce, for strings
// that never pass through the markdown pipeline (infobox values, navbox labels).
const MARKS = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

/**
 * `defer` emits a placeholder instead of the finished HTML. Astro caches each
 * markdown file's render, so anything resolved here would freeze until that file
 * changed - a rename would not reach other articles. Deferred markers are resolved
 * on every page render instead. Arrows are static, so they are never deferred.
 */
function custom(m, defer = false) {
  if (m[1] !== undefined) {
    const slug = m[1].trim(), display = m[2]?.trim();
    return defer
      ? `<a data-wl="${esc(slug)}"${display ? ` data-d="${esc(display)}"` : ''}></a>`
      : link(slug, display);
  }
  if (m[3]) {
    const arg = m[4].trim();
    // :img takes a path straight through; :icon and :flag look the subject up.
    if (m[3] === 'img') {
      // :img[path] is an inline mark the size of the text beside it. :img[path|96]
      // is the same picture at 96px, which is what a rank insignia in a table needs.
      // Markdown turns a bare link into an anchor before this runs, so a pasted URL
      // arrives wrapped in one and has to be unwrapped again.
      // Markdown swallows the width into the link as %7C on the way, so it is put
      // back before the two halves are separated.
      const [path, w] = arg
        .replace(/<a\b[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/g, '$1')
        .replace(/%7C/gi, '|')
        .split('|');
      const size = parseInt(w, 10);
      const style = size > 0 ? ` style="width:${size}px;height:auto"` : '';
      return `<img class="ico${size > 0 ? ' sized' : ''}" src="${esc(asset(path.trim()))}"${style} alt="" loading="lazy">`;
    }
    return defer ? `<i data-ico="${esc(arg)}"></i>` : icon(arg);
  }
  if (m[5]) return ARROW[m[5]];
  return '';
}

export const unesc = (s) =>
  s.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

/** Render a frontmatter/YAML string: custom syntax plus bold, italic and external links. */
const SUPSUB = /<(sup|sub)>([\s\S]*?)<\/\1>/g;

export function renderInline(str) {
  if (str == null) return '';
  const both = new RegExp(`${CUSTOM.source}|${MARKS.source}`, 'g');
  let out = '', last = 0, m;
  while ((m = both.exec(String(str)))) {
    out += esc(String(str).slice(last, m.index));
    // Recurse so a link can sit inside bold or italics, not just plain text.
    if (m[6] !== undefined) out += `<strong>${renderInline(m[6])}</strong>`;
    else if (m[7] !== undefined) out += `<em>${renderInline(m[7])}</em>`;
    else if (m[8] !== undefined) out += `<a class="ext" href="${esc(m[9])}" target="_blank" rel="noopener">${esc(m[8])}</a>`;
    else out += custom(m);
    last = m.index + m[0].length;
  }
  // A flag must never be stranded at the end of a line without its name. A
  // non-breaking space is not enough on its own: a line may still break after an
  // inline image, so the pair is wrapped and told not to wrap. Covers :flag,
  // :icon and :img, and the placeholders resolveHtml() swaps in later.
  const ICON = '(?:<img class="ico"[^>]*>|<i data-ico="[^"]*"><\\/i>)';
  const NAME = '(?:<(?:strong|em)>)?(?:<a\\b[^>]*>[^<]*<\\/a>|[^\\s<]+)(?:<\\/(?:strong|em)>)?';
  return (out + esc(String(str).slice(last)))
    // Superscript is the one HTML the editor emits; unescape just those tags.
    .replace(/&lt;(sup|sub)&gt;([\s\S]*?)&lt;\/\1&gt;/g, '<$1>$2</$1>')
    .replace(new RegExp(`(${ICON}) (${NAME})`, 'g'), '<span class="nw">$1&nbsp;$2</span>');
}

export { CUSTOM, custom, esc };
