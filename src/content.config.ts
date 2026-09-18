import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Grouped the way the wiki actually divides: a place, a body, a people, a page.
// "geography" used to carry three unrelated shapes at once - planets, provinces and
// continents all wanted different infoboxes - so each of them is its own type now.
export const ARTICLE_TYPES = [
  'overview', 'city', 'subdivision', 'continent', 'geography', 'celestial',
  'character', 'military', 'organization', 'company',
  'ideology', 'religion', 'ethnicity', 'event', 'list',
] as const;

const row = z.object({
  section: z.string().optional(),                       // a heading band inside the infobox
  label: z.string().optional(),
  value: z.union([z.string(), z.array(z.string())]).optional(),
  image: z.string().optional(),
  caption: z.string().optional(),
  sub: z.boolean().default(false),                      // renders the bullet, so nobody types one
  // Two lists shown side by side, as belligerents or commanders in a war infobox.
  pair: z.array(z.object({
    heading: z.string().optional(),
    items: z.array(z.string()).default([]),
  })).optional(),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    nativeTitle: z.union([z.string(), z.array(z.string())]).optional(),   // one line per official language
    romaji: z.string().optional(),
    type: z.enum(ARTICLE_TYPES),
    nation: z.string().optional(),                      // drives the navbox attached at the foot
    authors: z.array(z.string()).optional(),            // byline, when it differs from `nation`
    navbox: z.string().optional(),                      // navbox to attach, when it differs
    icon: z.string().optional(),                        // shown by :icon[slug] wherever linked
    ooc: z.boolean().default(false),
    coords: z.string().optional(),   // overrides the map lookup
    infobox: z.array(row).default([]),
  }),
});

const portals = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/portals' }),
  schema: z.object({
    title: z.string(),
    nation: z.string(),
    banner: z.string().optional(),
    welcome: z.string().optional(),
  }),
});

export const collections = { articles, portals };
