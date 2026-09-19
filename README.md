# The Talopedia

The in-universe encyclopedia for Avium. Read it at
**[auroruse.github.io/the-talopedia](https://auroruse.github.io/the-talopedia/)**.

Articles are markdown files. Astro builds them into a static site, GitHub Pages serves it, and git
keeps the history, so every edit has a diff and an author.

## Writing an article

Click **Edit** on any page, or start from
[/edit](https://auroruse.github.io/the-talopedia/edit/). You do not need to install anything or
have write access to the repo.

1. Write. **File → New article** for a new one, or open an existing page to change it.
2. Press **Commit**. The page joins your list of changes.
3. Do that for as many pages as you want.
4. Press **Changes**, then **Push**. Your work arrives as a pull request.

The first push asks for a GitHub token and shows you how to make one. It stays in your browser
and goes only to GitHub.

Two things the editor will stop you doing, both because they have cost articles before: saving
one subject over a different one, and saving a copy back over the page you copied it from. Use
**File → Duplicate as a new page** when you want an existing article as a starting point.

## Syntax

Works in article text, in sidebar values, and in navbox entries.

| You write | You get |
| --- | --- |
| `[[shinkeisei]]` | a link, showing that article's current title, red if it does not exist yet |
| `[[shinkeisei\|the capital]]` | the same link with your own wording |
| `[[portal:nichirin]]` | a link to a nation portal |
| `[[#section-id\|Text]]` | a jump to a heading on the same page |
| `[text](https://…)` | an external link |
| `:flag[nichirin]` | that nation's flag, inline |
| `:icon[masashi-miyamoto]` | any subject's flag or emblem, inline |
| `:img[/assets/flags/kemet.png]` | an image by path, for anything with no article |
| `:img[/assets/flags/kemet.png\|96]` | the same at 96px, for a picture in a table cell |
| `:up` / `:down` | the green and red statistic arrows |
| `**bold**`, `*italic*` | bold and italic, and they nest around a link |
| `:navbox[site]` on its own line | that navbox, where it sits |

Rename a subject by changing one `title:` line. Every link to it follows, because a link stores
the slug and renders whatever title it finds.

There are no font, size or colour controls. The stylesheet decides how things look.

## Pictures

Put the picture on a host and paste the link. Accepted: **imgbb**, **imgur**, **catbox**,
**Google Drive** and **Google Photos**. Discord links expire within days and are refused.

For Drive, share the file and paste the share link. For Photos, share the picture, open the
link, right-click the image and **Copy image address**. A picture that stops being shared stops
loading.

`public/assets/old-media/` holds everything converted from the old Google Doc. It is closed to
new pictures, and articles pointing into it keep working. `public/assets/flags/` is separate,
because flags are picked from the Icons tab rather than pasted.

## Running it locally

```
npm install
npm run dev       localhost:4321, with live reload, search, and a Save button
npm run build     static site into dist/
npm run preview   serve dist/ to see what deploys
npm run clean     drop the caches, needed after editing src/lib
```

On `npm run dev` the Save button writes straight into `src/content/`, skipping the pull request.
The deployed site has no write path at all.

`npm run dev` also fast-forwards from GitHub once a minute so your copy does not fall behind
merged pull requests. It never merges or rebases; if the tree is dirty it says so and leaves it
alone. `SYNC_SECONDS=0` turns it off.

Renaming a slug, rather than a title, moves the file and rewrites every reference:

```
npm run retcon -- slug niiyama tohara
npm run retcon -- text "Niiyama" "Tōhara"
```

Both show a diff per file and ask before writing.

## Layout

```
src/content/
  articles/<slug>.md         one article, frontmatter carries the sidebar
  articles/home.md           the front page, edited like any other article
  portals/<slug>.md          nation portals
  data/nations.yaml          the nation registry
  data/navboxes/<id>.yaml    navboxes: <nation> for that nation's articles, site for the front page
```

An article's `type` picks which sidebar the editor starts you with:

```
overview  city  subdivision  continent  geography  celestial
character  military  organization  company
ideology  religion  ethnicity  event  list
```

A nation portal is a template. You set the banner, the welcome line and the navbox; the opening
paragraph comes from that nation's overview article. A navbox is edited with the same blocks as
an article, so a group is a Section heading and a row is a Subsection.

Push to `main` and `.github/workflows/deploy.yml` deploys it.
