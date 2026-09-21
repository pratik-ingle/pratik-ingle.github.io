# pratik-ingle.github.io

Source for <https://pratik-ingle.github.io/>.

This site is built with [Quarto](https://quarto.org/) and renders to `docs/`.

GitHub Pages for this `pratik-ingle.github.io` user site is currently configured as a legacy deployment from the repository root (`main` + `/`). Because of that, the rendered `docs/` output is mirrored into the repository root for deployment. If Pages is later switched to GitHub Actions or a `/docs` source, the root mirror can be removed.

## Local workflow

```bash
quarto preview
quarto render
rsync -a docs/ ./
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

## Notes

The local machine currently has Quarto 1.0.37. Homebrew downloaded the newer cask but installation required sudo, so the site is kept compatible with the installed version.
