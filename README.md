# pratik-ingle.github.io

Source for <https://pratik-ingle.github.io/>.

This site is built with [Quarto](https://quarto.org/) and renders to `docs/`, which should be selected as the GitHub Pages publish directory for the `main` branch.

## Local workflow

```bash
quarto preview
quarto render
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
