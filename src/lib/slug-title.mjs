/**
 * What a slug reads as when no page gives it a title: a red link, a Wanted entry.
 * The site imports this and the editor inlines it, so the two read every slug the
 * same way. They used to keep a copy each, and the site's knew no club initials:
 * the editor showed FC Barcino, left the link bare, and the page printed Fc Barcino.
 *
 * No imports and one export, because the editor inlines this file's source as is.
 */
const SMALL = /^(of|the|and|in|on|at|to|a|an|for|from|by|de|von)$/;
// Football clubs spell themselves in initials, and word-casing turns AFC into Afc.
// The list is only what the badges actually use.
const CAPS = new Set(['fc', 'jk', 'fk', 'sc', 'if', 'ff', 'ik', 'sk', 'ps', 'sv', 'is',
  'bk', 'ac', 'js', 'cf', 'tk', 'tv', 'afc', 'ifk', 'cska', 'arf', 'htk', 'ud', 'bc', 'rc']);
// A filename cannot hold brackets, so a wartime flag is stored as shivon-tgw and
// read back as Shivon (TGW) rather than the "Shivon Tgw" that word-casing gives.
const TAGS = { tgw: 'TGW', esu: 'E.S.U.', sar: 'SAR' };

export function slugTitle(slug) {
  const parts = slug.split('-');
  const tail = TAGS[parts[parts.length - 1]] && parts.length > 1 ? parts.pop() : null;
  const name = parts.map((w, i) =>
    CAPS.has(w) ? w.toUpperCase()
    : i > 0 && SMALL.test(w) ? w
    : TAGS[w] || w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return tail ? `${name} (${TAGS[tail]})` : name;
}
