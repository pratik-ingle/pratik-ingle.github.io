#!/usr/bin/env bash
# Render the Quarto site and mirror docs/ into the repo root.
# GitHub Pages for this user site serves from `main` + `/` (legacy build),
# so the rendered output must exist at the repository root.
# Never delete root html/site_libs by hand; rerun this script instead.
set -euo pipefail
cd "$(dirname "$0")"

quarto render
touch docs/.nojekyll
rsync -a docs/ ./

if [ ! -f index.html ]; then
  echo "index.html missing at repo root; Pages would serve README.md instead." >&2
  exit 1
fi
echo "Rendered and mirrored. Now: git add -A && git commit && git push"
