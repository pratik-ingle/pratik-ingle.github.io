// Renders $…$ and $$…$$ in Markdown with KaTeX at build time, so pages ship static math and no
// script. The parser's `math` feature turns them into <code class="math-inline"> and
// <pre><code class="math-display">; this plugin swaps those for KaTeX's HTML (styled by
// katex.min.css, imported on the pages that render Markdown).
import katex from 'katex';

const classes = (node) => (Array.isArray(node.properties?.className) ? node.properties.className : []);

const render = (tex, displayMode) =>
  katex.renderToString(tex.trim(), { displayMode, throwOnError: false, strict: 'ignore' });

export const katexPlugin = {
  name: 'katex',
  element: {
    filter: ['pre', 'code'],
    visit(node, ctx) {
      if (node.tagName === 'pre') {
        const code = node.children?.find((c) => c.type === 'element' && c.tagName === 'code');
        if (!code || !classes(code).includes('math-display')) return;
        return { type: 'raw', value: render(ctx.textContent(code), true) };
      }
      if (classes(node).includes('math-inline')) {
        return { type: 'raw', value: render(ctx.textContent(node), false) };
      }
    },
  },
};
