import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { titleFor } from '../lib/registry.mjs';

/** The opening sentence or two, as plain text, for search result previews. */
function lede(body: string): string {
  const first = (body || '')
    .split('\n')
    .map((l) => l.trim())
    // Skip headings, tables, raw HTML and list items — but not a lede opening in bold.
    .find((l) => l && !/^(?:[#|<>]|[-*+]\s|\d+\.\s)/.test(l));
  if (!first) return '';
  const plain = first
    .replace(/\[\[([^\]|#]+?)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]|#]+?)\]\]/g, (_, s) => titleFor(s))
    .replace(/:(?:icon|flag|img)\[[^\]]*\]/g, '')
    .replace(/:(?:up|down)\b/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 230 ? plain.slice(0, 230).replace(/\s+\S*$/, '') + '…' : plain;
}

export const GET: APIRoute = async () => {
  const all = await getCollection('articles');
  // A portal is a page like any other: it is searched by name, listed in the
  // editor and titled from its own file. Its slug carries the prefix the link
  // syntax uses, so [[portal:nichirin]] and this agree on one spelling.
  const portals = await getCollection('portals');
  return new Response(
    JSON.stringify([
      ...all.map((e) => ({
        slug: e.id,
        title: e.data.title,
        type: e.data.type,
        icon: e.data.icon ?? null,
        lede: lede(e.body ?? ''),
      })),
      ...portals.map((e) => ({
        slug: 'portal:' + e.id,
        title: e.data.title,
        type: 'portal',
        icon: null,
        lede: lede(e.body ?? ''),
      })),
    ]),
    { headers: { 'content-type': 'application/json' } }
  );
};
