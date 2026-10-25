// "Agent safety" tab: toggling a defence re-runs the toy prompt-injection eval from
// src/lib/agent-eval.ts; clicking a tile shows that episode's transcript.

import { EPISODES, runEpisode, type DefenceId, type Outcome } from '../lib/agent-eval';

const STAGGER = 35; // ms between tiles when the grid re-fills

for (const panel of document.querySelectorAll<HTMLElement>('[data-safety]')) {
  const root = panel.closest<HTMLElement>('[data-embodied-demo]')!;
  const chips = [...panel.querySelectorAll<HTMLButtonElement>('[data-defence]')];
  const tiles = [...panel.querySelectorAll<HTMLButtonElement>('[data-episode]')];
  const metrics = panel.querySelector<HTMLElement>('[data-metrics]')!;
  const log = panel.querySelector<HTMLElement>('[data-log]')!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const on = new Set<DefenceId>();
  let outcomes: Outcome[] = [];
  let selected = 0;
  let run = 0; // increments on every re-run so a superseded animation stops
  let started = false;

  const showLog = () => {
    const o = outcomes[selected];
    log.textContent = '';
    if (!o) return;
    for (const [label, text] of o.lines) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = text;
      log.append(dt, dd);
    }
    const dt = document.createElement('dt');
    dt.textContent = 'result';
    const dd = document.createElement('dd');
    dd.className = `verdict verdict--${o.pass ? 'pass' : 'fail'}`;
    dd.textContent = o.verdict;
    log.append(dt, dd);
  };

  const select = (i: number) => {
    selected = i;
    tiles.forEach((t, j) => t.setAttribute('aria-current', String(j === i)));
    showLog();
  };

  const label = (i: number) => {
    const e = EPISODES[i];
    const o = outcomes[i];
    const what = e.kind === 'task' ? `normal task: ${e.sub}` : `${e.tag} attack, aiming to ${e.sub}`;
    const result = e.kind === 'task' ? (o.pass ? 'done' : 'failed') : o.pass ? 'blocked' : 'hijacked';
    tiles[i].setAttribute('aria-label', `Episode ${i + 1}, ${what}: ${result}`);
  };

  const showMetrics = () => {
    const attacks = outcomes.filter((_, i) => EPISODES[i].kind === 'attack');
    const tasks = outcomes.filter((_, i) => EPISODES[i].kind === 'task');
    const hijacked = attacks.filter((o) => !o.pass).length;
    const done = tasks.filter((o) => o.pass).length;
    const asks = outcomes.filter((o) => o.asked).length;
    metrics.innerHTML = `Attacks that worked <b>${hijacked}/${attacks.length}</b> · Tasks done <b>${done}/${tasks.length}</b> · Interruptions <b>${asks}</b>`;
  };

  const evaluate = () => {
    const id = ++run;
    outcomes = EPISODES.map((e) => runEpisode(e, on));
    showMetrics();
    showLog();
    tiles.forEach((tile, i) => {
      label(i);
      const reveal = () => {
        if (id === run) tile.dataset.state = outcomes[i].pass ? 'pass' : 'fail';
      };
      if (still) reveal();
      else {
        tile.dataset.state = 'pending';
        setTimeout(reveal, 80 + i * STAGGER);
      }
    });
  };

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const id = chip.dataset.defence as DefenceId;
      if (on.has(id)) on.delete(id);
      else on.add(id);
      chip.setAttribute('aria-pressed', String(on.has(id)));
      evaluate();
    }),
  );
  tiles.forEach((tile, i) => tile.addEventListener('click', () => select(i)));

  // Run the eval with no defences the first time the tab is opened.
  root.addEventListener('demo-mode', (e) => {
    if ((e as CustomEvent<string>).detail !== 'safety' || started) return;
    started = true;
    select(0);
    evaluate();
  });
}
