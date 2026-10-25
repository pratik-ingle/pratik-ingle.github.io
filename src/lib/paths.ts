const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix a site-relative path ("/work/") with the deploy base. External and "#" links pass through. */
export function href(path: string): string {
  return path.startsWith('/') ? base + path : path;
}

/** True for links that leave the site, so they can get the ↗ treatment. */
export function isExternal(path: string): boolean {
  return /^(https?:|mailto:)/.test(path);
}
