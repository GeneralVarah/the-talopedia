/**
 * Bold and italic that will close on the page, fixed in the text before it is committed.
 *
 * Markdown closes ** only when the character before it is not a space, and opens it
 * only when the one after it is not. A bold word that took its trailing space along,
 * **word **, therefore never closes, and the page prints the asterisks. A mark wedged
 * between a punctuation mark and a letter, as in .”*It, fails the same way. The
 * editor's own view is more forgiving and shows both as bold, so nothing looks wrong
 * until the page is live. This moves the spaces outside the marks and parts a mark
 * from a letter it runs into.
 *
 * Asterisks that were never meant as marks are left as they are: a mark with no
 * partner on its line, or a single pair with a space inside both ends, as in 2 * 3 * 4.
 *
 * The editor runs it over every page it writes out, and the auto-merge over every page
 * it lands, so it holds however the text got there: typed, pasted, written by hand on
 * GitHub, or sent from an older copy of the editor.
 */
const WORD = /[\p{L}\p{N}]/u;
const PUNCT = /[\p{P}\p{S}]/u;

/** The line with code, tags, link targets and escapes blanked out, length for length. */
const blank = (line) => line
  .replace(/(`+).*?\1|<\/?[A-Za-z][^>]*>|\]\([^)]*\)|\\./g, (s) => '\x01'.repeat(s.length));

function fixMark(line, m) {
  let scan = blank(line);
  // Singles are looked for with the doubles blanked, so the two never pair up.
  if (m === '*') scan = scan.replace(/\*\*/g, '\x01\x01');
  let at = [...scan.matchAll(m === '*' ? /\*/g : /\*\*/g)].map((x) => x.index);
  const bullet = m === '*' && /^[ \t>]*\*(?=[ \t])/.exec(line);
  if (bullet) at = at.filter((i) => i !== bullet[0].length - 1);
  if (at.length < 2 || at.length % 2) return line;       // unpaired: not ours to guess at

  let out = '', last = 0;
  for (let k = 0; k < at.length; k += 2) {
    const a = at[k], b = at[k + 1];
    const inner = line.slice(a + m.length, b);
    const lead = inner.match(/^\s*/)[0];
    const tail = inner.slice(lead.length).match(/\s*$/)[0];
    const core = inner.slice(lead.length, inner.length - tail.length);
    const before = line[a - 1] || '', after = line[b + m.length] || '';
    let piece = line.slice(a, b + m.length);
    if (m === '*' && lead && tail) { /* a literal pair, as in 2 * 3 * 4 */ }
    // Marks around a comma and a space, left between two links by older editors.
    else if (!WORD.test(core)) { if (lead || tail) piece = inner; }
    else {
      // A space moved out beside one already there, or to the end of the line, is dropped.
      const pre = lead ? (/\s/.test(before) || !before ? '' : ' ')
        : PUNCT.test(core[0]) && WORD.test(before) ? ' ' : '';
      const post = tail ? (/\s/.test(after) || !after ? '' : ' ')
        : PUNCT.test(core.at(-1)) && WORD.test(after) ? ' ' : '';
      piece = pre + m + core + m + post;
    }
    out += line.slice(last, a) + piece;
    last = b + m.length;
  }
  return out + line.slice(last);
}

export function fixEmphasis(md) {
  let fence = null;
  const lines = md.split('\n');
  // Frontmatter is YAML, and its strings go through a renderer that already forgives this.
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
    if (fence || line.includes('***') || /^ {0,3}([*_-])(?:[ \t]*\1){2,}[ \t]*$/.test(line)) continue;
    lines[i] = fixMark(fixMark(line, '**'), '*');
  }
  return lines.join('\n');
}
