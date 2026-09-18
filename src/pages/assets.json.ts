import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('public/assets');
const IMAGE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/** Everything the image picker can offer, read fresh so a new upload shows at once. */
export const GET: APIRoute = () => {
  const out: { path: string; name: string; group: string; size: number }[] = [];
  const walk = (dir: string, group: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, e.name);
      else if (IMAGE.test(e.name)) {
        out.push({
          path: '/assets/' + path.relative(ROOT, full).split(path.sep).join('/'),
          name: e.name,
          group,
          size: fs.statSync(full).size,
        });
      }
    }
  };
  if (fs.existsSync(ROOT)) walk(ROOT, 'assets');
  out.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
};
