# The Talopedia

A wiki for Avium. Static site, no server, no database, no login, free to host.

## How it works

Articles are markdown files with YAML frontmatter in `src/content/articles/`. Astro turns them
into static HTML at build time and GitHub Pages serves the result. Git is the database, which is
where revision history, diffs, blame and revert come from at no cost.

    src/content/
      articles/<slug>.md         one article, frontmatter carries the sidebar
      articles/home.md           the front page, served at / and editable like any article
      portals/<slug>.md          nation portals
      data/nations.yaml          the nation registry
      data/navboxes/<id>.yaml    curated blocks: <nation> attaches to that nation's
                                 articles, `site` is the front page navigation

## The syntax editors can use

Everything below works in an article body, in a sidebar value, and in a navbox entry.

| You write | You get |
| --- | --- |
| `[[shinkeisei]]` | a link showing that article's current title, red if it does not exist yet |
| `[[shinkeisei\|the capital]]` | the same link with your own wording |
| `[[portal:nichirin]]` | a link to a portal |
| `[text](https://…)` | an external link |
| `:icon[masashi-miyamoto]` | that subject's flag or emblem, inline |
| `:flag[nichirin]` | the same thing, read better for nations |
| `:up` / `:down` | the green and red statistic arrows |
| `**bold**`, `*italic*` | bold, italic, and they nest around a link |
| `[[#section-id\|Text]]` | a jump to a heading on the same page |
| `:navbox[site]` on its own line | renders that navbox where it sits |

Links, icons and navboxes are written into the markdown as markers and resolved on every page
render, not while the markdown is compiled. Astro caches each file's compiled HTML, so anything
resolved at compile time would freeze until that particular file was edited next — a rename would
reach the renamed article and nothing else. Editing `src/lib` itself still needs `npm run clean`,
because that cache lives in `node_modules/.astro`.

In a navbox, a bare nation id from `nations.yaml` picks up its flag automatically, and a
nation with `portal: true` renders bold and links to its portal. That is what "bold denotes
nations with nation portals" on the front page means; nothing is maintained by hand.

There are no font, size, colour or spacing controls anywhere, because the stylesheet is the
Manual of Style. A section header is Georgia 26 because it is a section header.

## Renaming things

A link stores a slug and renders the title it finds, so changing one `title:` line renames that
subject across every article, sidebar and navbox at once. The two cases that needs more:

    npm run retcon -- slug niiyama tohara       the slug itself changes: moves the file,
                                                rewrites every [[ref]], navbox entry and icon
    npm run retcon -- text "Niiyama" "Tōhara"   the name is sitting in running prose

Both show a diff per file and ask before writing. `a` applies to everything remaining.

Deleting a nation: remove its row from `nations.yaml`. Every article tagged with it keeps
building, and the build prints what is now pointing at nothing.

## Commands

    npm install
    npm run dev       localhost:4321 - the only server you need day to day
    npm run build     static site into dist/, plus the Pagefind search index
    npm run preview   serve dist/ to check exactly what will deploy
    npm run clean     drop every cache: only needed after editing src/lib

`npm run dev` has live reload, working search, and the Save button. Search works because the dev
server fetches its own pages, indexes them with Pagefind's Node API and serves `/pagefind/*` from
memory; editing an article reindexes it about a second later. `npm run build` still writes a real
index to `dist/` for the deployed site.

## Publishing

Push to `main`. `.github/workflows/deploy.yml` builds and deploys to GitHub Pages.
If the repo is not named `<username>.github.io`, set a repository variable `BASE_PATH` to
`/<repo-name>/`.

## The contributor loop

1. Contributor opens `/edit`, writes, presses **Download .md**.
2. They send you the file. Images go with it.
3. You drop it into `src/content/articles/`, drop images into `public/assets/media/`, commit, push.

`/edit` can reopen anything already published through the dropdown at the top, so revising an
article does not mean retyping it.

### Writing locally

On `npm run dev` the editor grows a **Save to articles** button that writes straight into
`src/content/articles/<name>.md`, no download and no copy-paste. The endpoint behind it is a Vite
dev middleware marked `apply: 'serve'`, so it exists only while you are developing; the deployed
site has no write path of any kind and no Save button.

Writing into `src/` restarts the dev server and reloads the page, so the editor keeps a draft in
`sessionStorage` and restores it on load. That also means an accidental refresh costs nothing.
**New** clears it.

Empty rows from a type's skeleton are never written out, nor is a section heading with nothing
under it, so you can leave the template's unused fields on screen.

### Images

**Media** in the toolbar opens a picker with two tabs. *Images* lists everything under
`public/assets/`; clicking one fills the image field you were last in, or adds an image block.
*Inline icons* lists nation flags and article icons, and clicking one drops a `:flag[...]` or
`:icon[...]` token at the cursor.

New images: drag a file onto the article, paste one, or use the button at the foot of the picker.

- On `npm run dev` it uploads to `public/assets/media/`, never overwriting (a clash becomes
  `name-2.jpg`). PNG, JPEG, WebP, GIF and AVIF only.
- On the published site there is no server, so the file rides along instead: **Download** produces
  a `.zip` of the article plus its images rather than a bare `.md`. Unzip it, drop the markdown in
  `src/content/articles/` and the `assets/media/` folder into `public/`.
