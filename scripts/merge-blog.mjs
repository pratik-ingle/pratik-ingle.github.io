// Adds the Quarto blog's rendered pages (blog/docs/) to the built site in dist/, so the posts keep
// their URLs (/posts/...) and their Quarto styling. Runs after `astro build`; the new site's own
// files always win, and the old home page, 404, sitemap and robots file are left out.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const SRC = 'blog/docs';
const OUT = 'dist';
const SKIP_TOP_LEVEL = new Set(['index.html', '404.html', 'sitemap.xml', 'robots.txt', '.nojekyll']);

if (!existsSync(SRC)) {
  console.log(`merge-blog: ${SRC} not found, nothing to add.`);
  process.exit(0);
}

let added = 0;
const kept = [];

const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const from = join(dir, name);
    if (dir === SRC && SKIP_TOP_LEVEL.has(name)) continue;
    if (statSync(from).isDirectory()) {
      walk(from);
      continue;
    }
    const rel = relative(SRC, from);
    const to = join(OUT, rel);
    if (existsSync(to)) {
      kept.push(rel);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    added++;
  }
};

walk(SRC);
console.log(`merge-blog: added ${added} files from ${SRC}.`);
if (kept.length) console.log(`merge-blog: kept the new site's version of ${kept.length}: ${kept.join(', ')}`);
