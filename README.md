# The Talopedia

The in-universe encyclopedia for Avium.
**[auroruse.github.io/the-talopedia](https://auroruse.github.io/the-talopedia/)**

Articles are markdown files. Astro builds them into a static site, GitHub Pages serves it, and
git keeps the history.

To write something, click **Edit** on any page. You do not need to install anything or have
write access here; the editor explains the rest and opens a pull request when you are done.

## Running it locally

```
npm install
npm run dev       localhost:4321, with live reload, search, and a Save button
npm run build     static site into dist/
npm run preview   serve dist/ to see what deploys
npm run clean     drop the caches, needed after editing src/lib
```

Push to `main` and `.github/workflows/deploy.yml` deploys it.

## Layout

```
src/content/
  articles/<slug>.md         one article, frontmatter carries the sidebar
  articles/home.md           the front page, edited like any other article
  portals/<slug>.md          nation portals
  data/nations.yaml          the nation registry
  data/navboxes/<id>.yaml    navboxes: <nation> for that nation's articles, site for the front page
src/lib/                     link, icon and navbox resolution
src/pages/edit.astro         the editor
scripts/                     the Google Docs converter, and retcon for renaming slugs
```
