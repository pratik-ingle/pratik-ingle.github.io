// Client-side filtering for the Work and Writing lists. The page works without it; it only hides items.
//
//   [data-filter-root]                        wraps one filterable list
//   button[data-filter-group][data-value]     an option; the value "All" clears that group
//   [data-filter-item][data-<group>="a|b"]    an item, shown when its values include every group's selection
//   [data-filter-count]                       optional live count, worded with data-singular / data-plural
//   [data-filter-empty]                       optional message for when nothing matches
//
// The selection is mirrored into the query string (?type=Research&track=ML) so filtered views can be shared.

for (const root of document.querySelectorAll<HTMLElement>('[data-filter-root]')) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[data-filter-group]')];
  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')];
  const count = root.querySelector<HTMLElement>('[data-filter-count]');
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  const groups = [...new Set(buttons.map((b) => b.dataset.filterGroup!))];

  const params = new URLSearchParams(location.search);
  const selected: Record<string, string> = {};
  for (const group of groups) {
    const wanted = params.get(group);
    const known = buttons.some((b) => b.dataset.filterGroup === group && b.dataset.value === wanted);
    selected[group] = known ? wanted! : 'All';
  }

  const render = () => {
    for (const b of buttons) {
      b.setAttribute('aria-pressed', String(selected[b.dataset.filterGroup!] === b.dataset.value));
    }
    let shown = 0;
    for (const item of items) {
      const match = groups.every(
        (g) => selected[g] === 'All' || (item.dataset[g] ?? '').split('|').includes(selected[g]),
      );
      item.hidden = !match;
      if (match) shown++;
    }
    if (count) count.textContent = `${shown} ${shown === 1 ? count.dataset.singular : count.dataset.plural}`;
    if (empty) empty.hidden = shown > 0;
  };

  for (const b of buttons) {
    b.addEventListener('click', () => {
      selected[b.dataset.filterGroup!] = b.dataset.value!;
      const url = new URL(location.href);
      for (const g of groups) {
        if (selected[g] === 'All') url.searchParams.delete(g);
        else url.searchParams.set(g, selected[g]);
      }
      history.replaceState(null, '', url);
      render();
    });
  }

  render();
}
