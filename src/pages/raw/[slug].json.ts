import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { BUILT_FROM } from '../../lib/revisions.mjs';

// Lets the editor reopen a published article instead of retyping it.
export async function getStaticPaths() {
  const all = await getCollection('articles');
  return all.map((e) => ({ params: { slug: e.id }, props: { e } }));
}

export const GET: APIRoute = ({ props }) => {
  const { e } = props as any;
  return new Response(JSON.stringify({ slug: e.id, data: e.data, body: e.body ?? '' , commit: BUILT_FROM }), {
    headers: { 'content-type': 'application/json' },
  });
};
