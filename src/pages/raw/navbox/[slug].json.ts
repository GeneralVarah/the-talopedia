import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { BUILT_FROM } from '../../../lib/revisions.mjs';

// Navboxes are plain YAML under src/content/data, not a content collection, so they
// are read straight off disk. Same shape of reply as /raw/[slug].json: what the
// editor needs to rebuild the page and nothing else.
const DIR = path.resolve('src/content/data/navboxes');
const files = () => (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.yaml')) : []);

export async function getStaticPaths() {
  return files().map((f) => ({ params: { slug: f.replace(/\.yaml$/, '') } }));
}

export const GET: APIRoute = ({ params }) => {
  const file = path.join(DIR, `${params.slug}.yaml`);
  if (path.dirname(path.resolve(file)) !== DIR || !fs.existsSync(file)) {
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  }
  const text = fs.readFileSync(file, 'utf8');
  // The comment block at the top of a file documents how that navbox behaves, so it
  // is handed back and written out again rather than lost on the first save.
  const lead = (text.match(/^(?:#[^\n]*\n)+/) || [''])[0];
  const d = parse(text) || {};
  return new Response(JSON.stringify({
    slug: 'navbox:' + params.slug,
    commit: BUILT_FROM,
    data: { title: d.title ?? '', crumb: d.crumb ?? '' },
    groups: d.groups ?? [],
    lead,
  }), { headers: { 'content-type': 'application/json' } });
};
