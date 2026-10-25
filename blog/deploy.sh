#!/usr/bin/env bash
# Render the Quarto blog into docs/. The site's build (npm run build at the repo root) adds
# docs/ to the published site, so posts keep their URLs (/posts/...). Push to main to deploy.
set -euo pipefail
cd "$(dirname "$0")"

quarto render
echo "Rendered into blog/docs/. Now: git add -A && git commit && git push (GitHub Actions deploys main)."
