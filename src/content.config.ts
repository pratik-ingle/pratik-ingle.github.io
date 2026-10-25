import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { POST_TOPICS, PROJECT_TRACKS, PROJECT_TYPES } from './data/taxonomy';

const link = z.object({ label: z.string(), href: z.string() });

// One Markdown file per project; the file name becomes the URL (/work/<file-name>/).
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    type: z.enum(PROJECT_TYPES),
    tracks: z.array(z.enum(PROJECT_TRACKS)),
    blurb: z.string(),
    // Stack or context line at the foot of the card, e.g. "TRL · LoRA · vLLM".
    meta: z.string().optional(),
    // Placeholder caption shown in the black figure box until `image` is set.
    media: z.string(),
    // Path inside public/, e.g. /media/tactile.gif. Images, GIFs, .mp4 and .webm all work.
    image: z.string().optional(),
    // External links. The first one becomes the card's call to action ("Code ↗") unless ctaLabel is set.
    links: z.array(link).default([]),
    // Points the card's call to action at this project's page with this label ("Details →"),
    // even when there are external links. Without links the card always links to the page.
    ctaLabel: z.string().optional(),
  }),
});

// One Markdown file per post; the file name becomes the URL (/writing/<file-name>/).
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    // Leave out while drafting: the list shows "[YYYY.MM]" and the RSS feed skips the post.
    date: z.coerce.date().optional(),
    topic: z.enum(POST_TOPICS),
    media: z.string(),
    image: z.string().optional(),
    // A post published elsewhere (the Quarto blog, Medium…). "Read →" opens it and no page is built here.
    url: z.url().optional(),
    // Reading time for linked posts, whose text isn't in this file.
    minutes: z.number().optional(),
  }),
});

export const collections = { projects, posts };
