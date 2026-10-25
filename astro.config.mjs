// @ts-check
import { defineConfig } from 'astro/config';

// The GitHub Pages workflow sets SITE and BASE_PATH from the repository's Pages settings,
// so the same build works for pratik-ingle.github.io, a project page or a custom domain.
export default defineConfig({
  site: process.env.SITE || 'https://pratik-ingle.github.io',
  base: process.env.BASE_PATH || '/',
});
