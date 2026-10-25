# Pratik Ingle · Portfolio

Personal site built with [Astro](https://astro.build) from the design in `layout_design/`. Five sections (Home, Work, Publications, Writing, Life), plus a page per project and per blog post. It builds to plain static HTML and deploys to GitHub Pages.

## Run it locally

Needs Node 22.12 or newer.

```sh
npm install
npm run dev       # http://localhost:4321, reloads as you edit
npm run build     # static site in dist/
npm run preview   # serve dist/ to check the production build
```

## Where the content lives

| What | File |
| --- | --- |
| Name, email, social links, nav | `src/data/site.ts` |
| Home page "Latest" list | `src/data/home.ts` |
| Home page bio | `src/pages/index.astro` |
| Home page demos (arm, world model, grasp-free surface, agent safety) | `src/components/EmbodiedDemo.astro`, `src/scripts/embodied-demo.ts`, `src/scripts/surface-scene.ts` (+ `surface-planner.ts` for its collision-free paths), `src/scripts/agent-safety.ts` |
| Agent-safety eval: attacks, tasks, what each defence stops | `src/lib/agent-eval.ts` |
| Projects (one file each) | `src/content/projects/*.md` |
| Blog posts (one file each) | `src/content/posts/*.md` |
| Publications | `src/data/publications.ts` |
| Interests, photos, reading shelf | `src/data/life.ts` |
| Colours and fonts | `src/styles/global.css` |

**Add a project:** copy any file in `src/content/projects/`, rename it (the file name becomes the URL, `/work/<name>/`), and edit the frontmatter. `order` sets its number and position, `type` and `tracks` drive the filters, and the Markdown below the frontmatter is the project page. Put external links in `links`; the first one becomes the card's call to action, unless you set `ctaLabel` (e.g. `ctaLabel: "Details"`) to keep the card pointing at the project page.

**Add a post:** copy a file in `src/content/posts/`. The current posts live on the Quarto blog, so each file holds only the listing details: `url` is where "Read →" goes and `minutes` is the reading time. Leave `url` out and write Markdown below the frontmatter to host a post here instead; its reading time is then calculated from the text. Give it a `date` to publish it in the RSS feed; leave `date` out while drafting (the list shows `[YYYY.MM]`).

## Replacing placeholders

The design's placeholders are kept on purpose and styled as in the mockup:

- **Media boxes** such as `[GIF: tactile skin readings during a grasp]`. Put the file in `public/media/` and add `image: /media/your-file.gif` to the project, post, paper, interest or photo. Images, GIFs, `.mp4` and `.webm` all work. Videos autoplay muted and loop. Everything in `public/` is published, so use compressed copies there; full-size originals live in `media-originals/`, which is git-ignored.
- **Links set to `"#"`**: code repos, the Time Weaver URL, preprints, DOIs and BibTeX. Search the project for `"#"`.
- **Text in `[brackets]`**: hobby details, books, the template posts and the project write-ups. Search for `[`.
- **BibTeX**: add a `bibtex` string to a paper in `src/data/publications.ts` and its BibTeX link becomes an expandable block.

## Changing the accent colour

Edit `--accent` at the top of `src/styles/global.css`. The design's alternatives are `#E1251B` (red), `#0A7F5A` (green) and `#0A0A0A` (black).

## The Quarto blog

The blog posts are still written in Quarto. The previous Quarto site moved, unchanged, into `blog/`. `npm run build` adds its rendered output (`blog/docs/`) to the built site, so every post keeps its URL (`/posts/...`) and its Quarto look. To publish or update a post:

```sh
cd blog
quarto preview     # live preview while editing
./deploy.sh        # renders into blog/docs/
```

Then commit and push. `blog/README.md` covers adding posts and importing notes from Obsidian. The old Quarto home page is replaced by this site; the old project and research pages stay reachable at their URLs.

## Deploying

This repository is `pratik-ingle.github.io`, and GitHub Pages is set to **Source: GitHub Actions**. Every push to `main` builds the site and the blog and deploys them through `.github/workflows/deploy.yml`; follow progress in the repository's **Actions** tab. Pushes to other branches don't deploy.
