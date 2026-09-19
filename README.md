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

Every page carries a tab bar: **Article** and **Source** on the left, **Edit** on the right. Edit
opens that page in the editor with its content already loaded.

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
| `:img[/assets/flags/kemet.png]` | an inline image by path, for anything with no article |
| `:img[/assets/media/x.jpg\|96]` | the same, at 96px, for a picture inside a table cell |
| `:up` / `:down` | the green and red statistic arrows |
| `**bold**`, `*italic*` | bold, italic, and they nest around a link |
| `[[#section-id\|Text]]` | a jump to a heading on the same page |
| `:navbox[site]` on its own line | renders that navbox where it sits |

Links, icons and navboxes are written into the markdown as markers and resolved on every page
render, not while the markdown is compiled. Astro caches each file's compiled HTML, so anything
resolved at compile time would freeze until that particular file was edited next: a rename would
reach the renamed article and nothing else. Editing `src/lib` itself still needs `npm run clean`,
because that cache lives in `node_modules/.astro`.

The Icons tab lists the flags and the two arrows, and nothing else. A flag belonging to a
nation in `nations.yaml` inserts as `:flag[slug]`, so renaming the nation carries
everywhere; the rest are files with no name to follow and insert as `:img[path]`. A nation from `nations.yaml` goes in as `:flag[slug]`, so renaming it
carries everywhere; anything else is a file with no name to follow, so it goes in as
`:img[path]`. That is why a war article's belligerents are a mixture of the two.

In a navbox, a bare nation id from `nations.yaml` picks up its flag automatically, and a
nation with `portal: true` renders bold and links to its portal. That is what "bold denotes
nations with nation portals" on the front page means; nothing is maintained by hand.

There are no font, size, colour or spacing controls anywhere, because the stylesheet is the
Manual of Style. A section header is Georgia 26 because it is a section header.

## Article types

The type in an article's frontmatter picks the sidebar skeleton the editor starts you with. Each
skeleton comes from the articles that already exist, so the fields are the ones those articles
already carry.

    overview  city  subdivision  continent  geography  celestial
    character  military  organization  company
    ideology  religion  ethnicity  event  list

A `subdivision` is a province, county or territory inside a nation; `geography` is a landform
such as a range, a lake or a river; `celestial` is a planet, a moon or a star system. Changing
an article's type asks before it replaces the sidebar.

## Renaming things

A link stores a slug and renders the title it finds, so changing one `title:` line renames that
subject across every article, sidebar and navbox at once. Two cases need more than that:

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

## Staying level with GitHub

Contributions arrive as pull requests, so this copy falls behind the moment one is
merged. `npm run dev` checks every minute and fast-forwards when it can, printing what
came down:

    [sync] pulled 2 commits
      src/content/articles/alemannia.md
      src/content/articles/auritania.md

It only ever fast-forwards, and only a clean checkout. Uncommitted work, or local commits
of your own, and it says so and leaves the tree alone rather than deciding a merge for
you. `npm run sync` does the same check once, by hand. `SYNC_SECONDS=0` turns it off,
and any other number changes how often it looks.

## Publishing

Push to `main`. `.github/workflows/deploy.yml` builds and deploys to GitHub Pages. It reads the
site's own URL and base path from `actions/configure-pages`, so a project site at
`<user>.github.io/<repo>/` works with no configuration and survives a rename. A `BASE_PATH`
repository variable overrides it if you ever need to.

## The editor

`/edit` is one page. The toolbar runs: **File**, undo and redo, bold / italic / superscript /
subscript / link, a **Text** menu for paragraphs, headings and lists, a **Media** menu for
pictures, icons and tables, then the save button and page settings.

File opens anything already published: articles, the twelve nation portals, and the navboxes. It
also starts new ones: **New article**, **New portal**, **New navbox**.

Empty rows from a type's skeleton are never written out, nor is a section heading with nothing
under it, so you can leave the template's unused fields on screen.

### Getting work into the repo

1. Contributor opens `/edit`, writes, presses **Download**.
2. They send you the file. Images go with it.
3. You drop it into `src/content/articles/`, drop images into `public/assets/media/`, commit, push.

### Writing locally

On `npm run dev` the save button reads **Save** and writes straight into
`src/content/articles/<name>.md`, skipping the download step. A portal saves to
`src/content/portals/`, a navbox to `src/content/data/navboxes/`. The endpoint behind it is a Vite
dev middleware marked `apply: 'serve'`, so it exists only while you are developing; the deployed
site has no write path of any kind, and there the same button reads **Download** instead.

Writing into `src/` restarts the dev server and reloads the page, so the editor keeps a draft in
`sessionStorage` and restores it on load. That also means an accidental refresh costs nothing.
**New** clears it.

### Pictures

`public/assets/old-media/` is an archive: everything converted from the old Google Doc,
kept so none of it has to be re-hosted, and closed to new pictures. The editor does not
offer it, so a new picture goes on an image host and the article keeps the link. Articles
that already point into the archive keep working.

`public/assets/flags/` stays out of the archive, because a flag is worn inline beside a
nation's name and is picked from the Icons tab rather than pasted.

Only hosts that serve a stable direct link are accepted, because the alternative is an
article whose pictures quietly vanish: `ibb.co`, `imgur.com`, `files.catbox.moe`. Discord
attachment links carry signed URLs that expire within days and are refused with a note
saying so. The list is `HOSTS` in `src/pages/edit.astro`.

`npm run dev` keeps **Upload**, so pictures added while developing still land in the
archive and stay versioned. The published editor has the link field only.

**Shape** is optional. Left on *Original* a picture keeps its own proportions; choosing a
ratio cuts it to exactly that shape, which is what lines a grid row up and what stops the
page jumping while a picture hosted elsewhere is still arriving.


**Media** opens three tabs: Images, Icons, Table.

Images starts with a search box, then **Insert as**, which is where a picture gets its shape:

- **Static** puts it in a block the width of the column.
- **Floating** sits it left or right with the text wrapping around it. Drag its edge to resize.
- **Grid** makes a row of pictures. Widths follow each picture's shape so they all come out the
  same height. A grid is always one row; add a second grid if you want a second row.

Under that is **Upload**, then everything already in `public/assets/`. Flags, emblems and
subdivision images are listed to browse; `media/` is three hundred-odd files, too many to
scroll, so it turns up when you search.

Every upload is named before it goes anywhere. That name, kebab-cased, becomes the filename.

Pictures have no path box. Hover one and two buttons appear in its corner: ⇄ to change it, ✕ to
remove it. An empty slot shows a dashed strip until you pick something.

New images: drag a file onto the article, paste one, or press Upload.

- On `npm run dev` they go to `public/assets/media/`, never overwriting (a clash becomes
  `name-2.jpg`). PNG, JPEG, WebP, GIF and AVIF only.
- On the published site there is no server, so the file rides along instead: **Download** produces
  a `.zip` of the article plus its images rather than a bare `.md`. Unzip it, drop the markdown in
  `src/content/articles/` and the `assets/media/` folder into `public/`.

### Portals and navboxes

A nation portal is a template. Three things are yours to set: the banner,
the welcome line, and the nation's navbox. The opening paragraph is taken from that nation's
overview article automatically, so there is only one copy to keep current.
Nations with no overview yet keep their own paragraph until one exists.

A navbox is edited with the same blocks as everything else: a group is a Section heading, a row is
a Subsection, and the articles in that row are a bulleted list of links. Reorder, delete, undo and
the link picker all work the way they do in an article. The **Edit** tab on a portal goes straight
to that nation's navbox, since the portal itself has nothing else to write.
