/**
 * Who wrote the wiki, measured in lines of content added.
 *
 * Two kinds of commit are left out, because counting them would credit the wrong
 * person. The first is the migration that created the site: it added eleven thousand
 * lines in one go, all of them other people's Google Docs, and it would put whoever
 * ran the conversion above every author on the board. The second is anything written
 * with Claude, which is the same argument applied to the ports done since.
 *
 * Only `src/content` counts. Nobody writes an encyclopedia by editing the stylesheet.
 */
import { execFileSync } from 'node:child_process';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

export function contributors() {
  let log, migration;
  try {
    // The commit that first brought the content in. Everything in it predates the wiki.
    migration = git('log', '--reverse', '--format=%H', '--', 'src/content').split('\n')[0];
    log = git(
      'log', '--no-merges', '--numstat',
      // %x00 so git writes the separator; an argument may not carry a real NUL.
      '--format=%x00%H\t%an\t%(trailers:key=Co-Authored-By,valueonly,separator=%x2C)',
      '--', 'src/content',
    );
  } catch {
    return null;                       // no git, or a shallow checkout: say so instead
  }

  const tally = new Map();
  for (const chunk of log.split('\x00').slice(1)) {
    const [head, ...rows] = chunk.split('\n');
    const [hash, name, trailers = ''] = head.split('\t');
    if (hash === migration || /claude/i.test(trailers) || !name) continue;
    let added = 0;
    for (const row of rows) {
      const [a, , path] = row.split('\t');
      if (/^\d+$/.test(a) && path) added += Number(a);
    }
    if (!added) continue;
    const seen = tally.get(name) || { name, lines: 0, commits: 0 };
    seen.lines += added;
    seen.commits += 1;
    tally.set(name, seen);
  }
  return [...tally.values()].sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));
}
