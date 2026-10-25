// Cross-fades the Life page's photo grid through every photo, one tile at a time.
//
//   [data-rotator]      the grid; data-photos lists the photos not shown at first, as [{ src, alt }]
//   .photo > img        one image per tile
//
// Holds still for visitors who prefer reduced motion, while the grid is off-screen or hovered,
// and while the tab is in the background.

const INTERVAL = 3200;

for (const grid of document.querySelectorAll<HTMLElement>('[data-rotator]')) {
  const queue: { src: string; alt: string }[] = JSON.parse(grid.dataset.photos ?? '[]');
  const tiles = [...grid.querySelectorAll<HTMLElement>('.photo')].filter((t) => t.querySelector('img'));
  if (!queue.length || !tiles.length || matchMedia('(prefers-reduced-motion: reduce)').matches) continue;

  let onScreen = false;
  let hovered = false;
  new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting)).observe(grid);
  grid.addEventListener('mouseenter', () => (hovered = true));
  grid.addEventListener('mouseleave', () => (hovered = false));

  // Visit the tiles in a scattered order so changes don't sweep left to right.
  const order = [0, 2, 1, 3].filter((i) => i < tiles.length);
  let step = 0;

  setInterval(async () => {
    if (!onScreen || hovered || document.hidden) return;
    const tile = tiles[order[step++ % order.length]];

    // Drop any image left over from an interrupted fade, keeping the visible one.
    const shown = [...tile.querySelectorAll('img')];
    shown.slice(0, -1).forEach((img) => img.remove());
    const current = shown[shown.length - 1];

    const next = queue.shift()!;
    queue.push({ src: current.getAttribute('src')!, alt: current.alt });

    const img = new Image();
    img.src = next.src;
    img.alt = next.alt;
    img.className = 'is-entering';
    await img.decode().catch(() => {});

    tile.append(img);
    img.getBoundingClientRect(); // commit the hidden state so the fade runs
    img.classList.remove('is-entering');
    img.addEventListener('transitionend', () => current.remove(), { once: true });
  }, INTERVAL);
}
