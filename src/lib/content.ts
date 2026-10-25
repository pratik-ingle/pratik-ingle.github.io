import { getCollection } from 'astro:content';

/** Projects in their numbered order (the `order` field). */
export async function getProjects() {
  const projects = await getCollection('projects');
  return projects.sort((a, b) => a.data.order - b.data.order);
}

/** Posts newest first; undated drafts follow in file-name order. */
export async function getPosts() {
  const posts = await getCollection('posts');
  const time = (date?: Date) => date?.getTime() ?? -Infinity;
  return posts.sort((a, b) => time(b.data.date) - time(a.data.date) || a.id.localeCompare(b.id));
}
