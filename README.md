# The Talopedia

The in-universe encyclopedia for Avium.
**[auroruse.github.io/the-talopedia](https://auroruse.github.io/the-talopedia/)**

Articles are markdown files. Astro builds them into a static site, GitHub Pages serves it, and
git records who changed what, forever, with their name on it. Bear that in mind.

## How to write an article

I have been told by grown ass adults that the editor looked daunting. In the interest of never
being told it again:

1. Click **Edit**. It sits at the top right of every page and has done so the entire time.
2. Type.
3. Click **Commit**. Repeat on as many pages as you feel able.
4. Click **Changes**, then **Push**.

That is the procedure in full. There is no export. There is no zip file. Nobody posts anything
in a Discord channel and waits for me to notice it. Your work becomes a pull request and walks
here on its own legs.

You do not need to install anything. You do not need an account on this repository. You are
asked once for a GitHub token, and the editor spells out how to obtain one in language I
deliberately pitched below the level of this audience.

It will also stop you saving one article over another, a feature added after a week I would
prefer not to discuss.

## Improvements over a word processor

* Search across every page
* Links that follow a rename everywhere at once, unprompted
* Sidebar fields in a fixed order, so nobody may invent their own
* Images that float, tables that behave
* A navbox at the foot of every article
* Hyperlink colours you cannot change. This one is not negotiable.

Do not ask me for help with the editor. Use your noggin man. I beg you.

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
scripts/                     retcon for renaming slugs, sync, and the editor tests
```
