/**
 * Who has written what, taken from the byline every article already carries.
 *
 * An article credits a nation, or several for a communal one, through `authors` or
 * `nation` in its frontmatter, and the site prints that at the top of the page. That
 * is the attribution counted here. Reading it out of the commit log instead measured
 * who last touched a file, which is a different thing: a three-line fix was enough to
 * take an article off the person who wrote it.
 *
 * A communal article counts once for each nation credited. There is no way to say who
 * wrote which half, and the byline does not claim to.
 */

/** Which GitHub account writes for each nation. A byline is not a username. */
export const ACCOUNT_OF = {
  esu: 'that1sealguy',
  skjarnland: 'SwiftorArrow',
  nichirin: 'auroruse',
  karjania: 'zezelandnationstates-hash',
  cortesia: 'Aetheryis',
  varahmehr: 'GeneralVarah',
  shivon: 'khanategolden-tech',
  alemannia: 'mrrv533-creator',
  albinya: 'kiohit05-cyber',
};

/**
 * @param {Array} articles the article collection
 * @returns {Array<{id, articles, lines, account}>} one row per crediting nation
 */
export function contributors(articles) {
  const tally = new Map();
  for (const entry of articles) {
    if (entry.id === 'home') continue;
    const credits = entry.data.authors?.length ? entry.data.authors
      : entry.data.nation ? [entry.data.nation] : [];
    if (!credits.length) continue;
    // The article as it stands, which is the length a reader would recognise.
    const lines = (entry.body || '').trim().split('\n').length;
    for (const id of credits) {
      const seen = tally.get(id) || { id, articles: 0, lines: 0, account: ACCOUNT_OF[id] || null };
      seen.articles += 1;
      seen.lines += lines;
      tally.set(id, seen);
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.articles - a.articles || b.lines - a.lines || a.id.localeCompare(b.id));
}
