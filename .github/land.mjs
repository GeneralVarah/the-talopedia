/**
 * Lands a pull request from the editor on main, merging each file against the copy
 * the writer actually opened.
 *
 * The editor opens every page from the live site and records which commit of main
 * that was, as a Based-on line in each commit it sends. A writer's fork, meanwhile,
 * can sit days behind main: GitHub will not bring a fork past a change to a workflow
 * file with the token the editor asks for. A pull request branched from that old fork
 * starts from the wrong place, so git sees every page it touches as changed on both
 * sides and refuses to merge. Merging against the copy the writer opened is right
 * whether their fork is fresh or stale; it keeps whatever landed on main since, and
 * never quietly undoes it.
 *
 * Stages the result in the working tree of a main checkout and prints one line:
 *   ready            merged; commit what is staged
 *   wait <reason>    a real collision: leave it open for a person
 *   fallback         sent by an older editor with no Based-on; let GitHub merge it
 *
 * Env: ONTO, the main commit to land on (default HEAD); PR_HEAD, the pull request.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fixEmphasis } from '../src/lib/emphasis.mjs';

const ONTO = process.env.ONTO || 'HEAD';
const { PR_HEAD } = process.env;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const bytes = (id) => execFileSync('git', ['cat-file', 'blob', id], { maxBuffer: 64 << 20 });
/** The blob a file is at a commit, or null where it does not exist there. */
const blob = (ref, path) => {
  try { return git('rev-parse', '--verify', '-q', `${ref}:${path}`).trim() || null; } catch { return null; }
};
const done = (line) => { console.log(line); process.exit(0); };
const put = (path, data) => {
  // Bold that would print its asterisks is fixed on the way in, whatever sent it.
  if (/^src\/content\/.*\.md$/.test(path)) data = fixEmphasis(data.toString('utf8'));
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); git('add', '--', path);
};

/** The commit of main the writer opened this file from, off the last commit that changed it. */
function basedOn(path) {
  const msg = git('log', '-1', '--format=%B', `${ONTO}..${PR_HEAD}`, '--', path);
  const from = (msg.match(/^Based-on: ([0-9a-f]{7,40})$/m) || [])[1];
  if (!from) return null;
  try { git('cat-file', '-e', `${from}^{commit}`); return from; } catch { return null; }
}

const changes = git('diff', '--name-status', '--no-renames', `${ONTO}...${PR_HEAD}`)
  .trim().split('\n').filter(Boolean)
  .map((l) => { const [s, path] = l.split('\t'); return { gone: s.startsWith('D'), path }; });
if (!changes.length) done('wait nothing to merge');

// Read every base first, so an older pull request falls back whole, not half landed.
const plan = changes.map((c) => {
  // A picture is only ever added, so it has nothing to be merged against.
  if (c.path.startsWith('public/assets/')) return { ...c, base: null };
  const from = basedOn(c.path);
  if (!from) done('fallback');
  return { ...c, base: blob(from, c.path) };
});

const scratch = mkdtempSync(join(tmpdir(), 'land-'));
for (const { path, gone, base } of plan) {
  const theirs = gone ? null : blob(PR_HEAD, path);
  const ours = blob(ONTO, path);
  if (theirs === ours) continue;                         // already so on main
  // A picture cannot be merged line by line. The gate only lets a new one through,
  // so one already on main that differs is not this pull request's to replace.
  if (path.startsWith('public/assets/') && ours) done(`wait ${path} is already on main`);
  if (ours === base) {                                   // untouched on main since it was opened
    if (theirs) put(path, bytes(theirs)); else git('rm', '-q', '--', path);
    continue;
  }
  // Main has moved since the writer opened it. Deleting a page someone has since
  // edited, or adding one at a name someone has since taken, is theirs to settle.
  if (!theirs || !ours) done(`wait ${path} changed on main since it was opened`);
  const f = (name, id) => { const p = join(scratch, name); writeFileSync(p, id ? bytes(id) : ''); return p; };
  let merged;
  try {
    merged = execFileSync('git', ['merge-file', '-p', f('ours', ours), f('base', base), f('theirs', theirs)],
      { maxBuffer: 64 << 20 });
  } catch {
    done(`wait ${path} was changed on main in the same place since it was opened`);
  }
  put(path, merged);
}
done('ready');
