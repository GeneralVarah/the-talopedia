#!/usr/bin/env node
// Retcon tool. Two jobs, deliberately separate:
//
//   npm run retcon -- slug niiyama tohara      rename an article and every reference to it
//   npm run retcon -- text "Niiyama" "Tōhara"  sweep the prose, one file at a time
//
// Renaming a title in frontmatter already moves every [[link]] on the site, because
// links store slugs and render the current title. This tool is for the other two
// cases: the slug itself changing, and the name sitting in running prose.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const ROOT = path.resolve('src/content');
const [mode, from, to] = process.argv.slice(2);

if (!['slug', 'text'].includes(mode) || !from || !to) {
  console.error('usage: retcon slug <old-slug> <new-slug>\n       retcon text "<Old Name>" "<New Name>"');
  process.exit(1);
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(md|yaml)$/.test(e.name)) files.push(p);
  }
})(ROOT);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const rel = (p) => path.relative(process.cwd(), p);

function diff(before, after) {
  const a = before.split('\n'), b = after.split('\n');
  const out = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) out.push(`  \x1b[31m- ${a[i]}\x1b[0m\n  \x1b[32m+ ${b[i]}\x1b[0m`);
  }
  return out.join('\n');
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A slug rename is mechanical: [[slug]], [[slug|Display]], :icon[slug], YAML list
// entries and nation ids. Word-bounded so `nichirin` never eats `nichirin-league`.
const slugRe = new RegExp(`(?<![\\w-])${esc(from)}(?![\\w-])`, 'g');
const textRe = new RegExp(esc(from), 'g');

let changed = 0, skipped = 0;
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  const after = before.replace(mode === 'slug' ? slugRe : textRe, to);
  if (after === before) continue;

  console.log(`\n\x1b[1m${rel(f)}\x1b[0m`);
  console.log(diff(before, after));
  const ans = (await rl.question('  apply? [y/N/a=all] ')).trim().toLowerCase();
  if (ans === 'a') {
    fs.writeFileSync(f, after);
    changed++;
    for (const g of files.slice(files.indexOf(f) + 1)) {
      const b2 = fs.readFileSync(g, 'utf8');
      const a2 = b2.replace(mode === 'slug' ? slugRe : textRe, to);
      if (a2 !== b2) { fs.writeFileSync(g, a2); changed++; console.log(`  applied ${rel(g)}`); }
    }
    break;
  }
  if (ans === 'y') { fs.writeFileSync(f, after); changed++; } else skipped++;
}

// The file itself has to move too, or the URL keeps the old name.
if (mode === 'slug') {
  for (const dir of ['articles', 'portals']) {
    const old = path.join(ROOT, dir, from + '.md');
    if (fs.existsSync(old)) {
      fs.renameSync(old, path.join(ROOT, dir, to + '.md'));
      console.log(`\nmoved ${rel(old)} -> ${to}.md`);
    }
  }
  const nb = path.join(ROOT, 'data/navboxes', from + '.yaml');
  if (fs.existsSync(nb)) {
    fs.renameSync(nb, path.join(ROOT, 'data/navboxes', to + '.yaml'));
    console.log(`moved ${rel(nb)} -> ${to}.yaml`);
  }
}

console.log(`\n${changed} file(s) changed, ${skipped} skipped.`);
rl.close();
