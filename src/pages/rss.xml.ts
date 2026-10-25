import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../data/site';
import { getPosts } from '../lib/content';
import { href } from '../lib/paths';

// Undated posts are treated as drafts and left out of the feed.
export async function GET(context: APIContext) {
  const posts = (await getPosts()).filter((post) => post.data.date);
  return rss({
    title: `${site.name} · Writing`,
    description: 'Essays, tutorials and research notes on robotics, machine learning and building with AI tools.',
    site: new URL(href('/'), context.site),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.date,
      link: post.data.url ?? href(`/writing/${post.id}/`),
    })),
  });
}
