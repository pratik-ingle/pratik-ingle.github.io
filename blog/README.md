# Blog (Quarto)

The Quarto part of <https://pratik-ingle.github.io/>: the blog posts, plus the previous site's pages. It renders to `docs/`.

The repository root holds the main site (Astro). Its build adds `blog/docs/` to the published site, so posts keep their URLs (`/posts/...`). The old Quarto home page is replaced by the main site; the old project and research pages stay reachable. GitHub Actions deploys every push to `main`.

## Local workflow

```bash
cd blog
quarto preview   # live preview while editing
./deploy.sh      # quarto render into docs/
git add -A && git commit -m "..." && git push
```

## Add a blog post

Create a folder under `posts/<category>/my-post/` with an `index.qmd` file and front matter like:

```yaml
---
title: "Post title"
date: 2026-09-21
categories: [learning, robotics]
description: "One sentence summary."
image: ../../../images/example.png
---
```

## Import notes from Obsidian

New posts are written in the Obsidian vault and imported. macOS blocks this repo's
tooling from reading `~/Library/Mobile Documents` directly, so the vault is never
touched by a script — notes are staged by hand:

1. In Finder, drag the notes you want published out of the vault's `Blogs/` folder into
   this repo's `Blogs/` folder. **Drag their attachments too** — images and the exported
   `.html` plots usually live in `Obsidian/Learning/utiles/`, not next to the note.
2. Run the importer:

   ```bash
   ./import-notes.py --dry-run   # see what it would do
   ./import-notes.py
   ```

   Each `Blogs/*.md` becomes `posts/notes/<slug>/index.qmd` with its attachments copied
   alongside. Notes come in verbatim — typos and wording are untouched; only Obsidian
   syntax is converted (`![[embed]]`, wikilinks, tab-indented `$$` math, bare URLs).

3. Open the generated post and fill in `description:`, then delete the `draft: true`
   line. Until that line is gone the post renders but stays out of the blog listings,
   the RSS feed, and site search.
4. `./deploy.sh`, then commit and push.

Re-running is safe: an already-imported post is skipped, and one you have hand-edited is
never overwritten. After adding a missing attachment, re-run with `--force` — it replaces
the body and keeps the front matter you edited. Other flags: `--slug`, `--keep-suffix`
(don't strip a trailing ` 1` from the filename), `--strict-verbatim`, `--wikilink-mode`,
`--embed-height`, `--no-draft`, `--force-all`. Exit code 2 means an attachment is missing.

`Blogs/` is gitignored — it is an inbox, and the generated post is the source of truth.

## Notes

The local machine currently has Quarto 1.0.37. Homebrew downloaded the newer cask but installation required sudo, so the site is kept compatible with the installed version.
