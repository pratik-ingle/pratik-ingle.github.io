# pratik-ingle.github.io

Source for <https://pratik-ingle.github.io/>.

This site is built with [Quarto](https://quarto.org/) and renders to `docs/`.

GitHub Pages for this `pratik-ingle.github.io` user site is currently configured as a legacy deployment from the repository root (`main` + `/`). Because of that, the rendered `docs/` output is mirrored into the repository root for deployment. If Pages is later switched to GitHub Actions or a `/docs` source, the root mirror can be removed.

## Local workflow

```bash
quarto preview   # live preview while editing
./deploy.sh      # quarto render + mirror docs/ into the repo root
git add -A && git commit -m "..." && git push
```

Do not delete the rendered `*.html`, `site_libs/`, `posts/**/*.html`, etc. from the
repository root. If they are missing, GitHub Pages falls back to rendering this
README with Jekyll and the site shows the README instead of the home page.
A `.nojekyll` file is kept at the root so Jekyll never processes the site.

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
4. `./deploy.sh`, then commit.

Re-running is safe: an already-imported post is skipped, and one you have hand-edited is
never overwritten. After adding a missing attachment, re-run with `--force` — it replaces
the body and keeps the front matter you edited. Other flags: `--slug`, `--keep-suffix`
(don't strip a trailing ` 1` from the filename), `--strict-verbatim`, `--wikilink-mode`,
`--embed-height`, `--no-draft`, `--force-all`. Exit code 2 means an attachment is missing.

`Blogs/` is gitignored — it is an inbox, and the generated post is the source of truth.

## Notes

The local machine currently has Quarto 1.0.37. Homebrew downloaded the newer cask but installation required sudo, so the site is kept compatible with the installed version.
