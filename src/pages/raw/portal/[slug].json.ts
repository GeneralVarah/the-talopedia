import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { BUILT_FROM } from '../../../lib/revisions.mjs';

// The portal counterpart of /raw/[slug].json, so the editor can reopen a portal
// page the same way it reopens an article. Its own route because a portal and an
// article share a slug: /raw/nichirin.json is the country, this is the portal.
export async function getStaticPaths() {
  const all = await getCollection('portals');
  return all.map((e) => ({ params: { slug: e.id }, props: { e } }));
}

export const GET: APIRoute = ({ props }) => {
  const { e } = props as any;
  return new Response(JSON.stringify({ slug: 'portal:' + e.id, data: e.data, body: e.body ?? '' , commit: BUILT_FROM }), {
    headers: { 'content-type': 'application/json' },
  });
};
