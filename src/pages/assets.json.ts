import type { APIRoute } from 'astro';
import fs from 'node:fs';

const IMAGE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/** The flags and icons the editor's picker offers, read fresh so a new one shows at once. */
export const GET: APIRoute = () => {
  const out = ['flags', 'icons'].flatMap((group) => {
    const dir = `public/assets/${group}`;
    return fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((name) => IMAGE.test(name)).map((name) => ({ path: `/assets/${group}/${name}`, name, group }))
      : [];
  });
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
};
