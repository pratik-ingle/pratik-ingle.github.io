// @ts-check
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import { katexPlugin } from './src/lib/markdown-math.mjs';

// The GitHub Pages workflow sets SITE and BASE_PATH from the repository's Pages settings,
// so the same build works for pratik-ingle.github.io, a project page or a custom domain.
export default defineConfig({
  site: process.env.SITE || 'https://pratik-ingle.github.io',
  base: process.env.BASE_PATH || '/',
  markdown: {
    // $…$ and $$…$$ math in posts and write-ups, rendered with KaTeX at build time.
    // A literal dollar sign in Markdown therefore needs escaping: \$5.
    processor: satteri({ features: { math: true }, hastPlugins: [katexPlugin] }),
  },
});
