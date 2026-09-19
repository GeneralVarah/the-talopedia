/**
 * Bring the local checkout level with GitHub, and never do anything else.
 *
 * Contributions arrive as pull requests, so the moment one is merged this copy is
 * behind. This pulls that down. It fast-forwards or it reports why it did not: a
 * merge or a rebase decided by a background timer is how work in progress gets
 * mangled, and the whole point is that it can be left running and forgotten.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * @returns {{state: string, note: string, files?: string[]}}
 *   pulled | current | dirty | diverged | detached | offline | nogit
 */
export function sync() {
  try {
    git('rev-parse', '--git-dir');
  } catch {
    return { state: 'nogit', note: 'not a git checkout' };
  }

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch === 'HEAD') return { state: 'detached', note: 'detached head' };

  let upstream;
  try {
    upstream = git('rev-parse', '--abbrev-ref', `${branch}@{upstream}`);
  } catch {
    return { state: 'nogit', note: `${branch} is not tracking anything` };
  }

  try {
    git('fetch', '--quiet', '--prune');
  } catch (e) {
    return { state: 'offline', note: String(e.stderr || e.message).split('\n')[0] };
  }

  const [behind, ahead] = git('rev-list', '--left-right', '--count', `${upstream}...HEAD`)
    .split(/\s+/).map(Number);
  if (!behind) return { state: 'current', note: ahead ? `${ahead} to push` : 'level' };

  // Anything uncommitted, and the pull waits. Rebasing someone else's work under a
  // half-finished edit is exactly the mess this is supposed to avoid.
  if (git('status', '--porcelain')) {
    return { state: 'dirty', note: `${behind} waiting, but there are uncommitted changes` };
  }
  if (ahead) {
    return { state: 'diverged', note: `${behind} behind and ${ahead} ahead; rebase by hand` };
  }

  const files = git('diff', '--name-only', 'HEAD', upstream).split('\n').filter(Boolean);
  git('merge', '--ff-only', upstream);
  return { state: 'pulled', note: `${behind} commit${behind === 1 ? '' : 's'}`, files };
}

// Run directly rather than imported. Comparing the raw argv path misses, because
// import.meta.url is a properly encoded URL and the argument is a plain path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = sync();
  console.log(`${r.state}: ${r.note}`);
  if (r.files?.length) console.log(r.files.map((f) => `  ${f}`).join('\n'));
}
