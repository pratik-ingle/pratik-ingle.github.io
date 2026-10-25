/** "2026.10", the date style used across the Writing pages. */
export function formatMonth(date?: Date): string {
  if (!date) return '[YYYY.MM]';
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "Oct 2026" for the time of the build, so "Rev." and "Updated" labels stay current on every deploy. */
export const builtMonth = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

export function readingTime(markdown = '', minutes?: number): string {
  if (minutes) return `${minutes} min`;
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min`;
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}
