// Collision-free paths for the grasp-free manipulation demo (surface-scene.ts).
//
// Prioritised space-time A*: balls are planned one after another on a grid of waypoints, one grid
// step per time step, and each must stay at least `clear` px from the timed paths of the balls
// planned before it (checked along every step, not just at the waypoints), and from where they end
// up. Moving aside and waiting are allowed, so a ball can make way for another; moving costs a
// little more than waiting, so it waits rather than wandering. Every priority order is tried and
// the cheapest complete plan wins. Finally each path is smoothed: runs of grid moves are replaced
// by straight lines covering the same time, wherever that stays clear of the other balls.

export type Point = { x: number; y: number };

export interface Grid {
  ox: number; // position of node (0, 0)
  oy: number;
  step: number; // px between neighbouring nodes
  nx: number; // nodes across and down
  ny: number;
}

const MAX_T = 160; // time steps a single path may take
const HEAD_START = 6; // steps a ball keeps away from where the not-yet-planned balls are sitting
const MOVE_COST = 0.3; // cost of moving one grid step, on top of the one time step it takes
const MAX_EXPANSIONS = 40000; // per ball, so a hopeless search gives up quickly

// Smallest distance between two points moving in straight lines over the same time step.
function closest(a0: Point, a1: Point, b0: Point, b1: Point) {
  const px = a0.x - b0.x;
  const py = a0.y - b0.y;
  const vx = a1.x - a0.x - (b1.x - b0.x);
  const vy = a1.y - a0.y - (b1.y - b0.y);
  const vv = vx * vx + vy * vy;
  const t = vv > 0 ? Math.max(0, Math.min(1, -(px * vx + py * vy) / vv)) : 0;
  return Math.hypot(px + vx * t, py + vy * t);
}

const at = (path: Point[], t: number) => path[Math.min(t, path.length - 1)];

// Is a move from p0 (time t-1) to p1 (time t) clear of every reserved path?
function clearStep(p0: Point, p1: Point, t: number, reserved: Point[][], clear: (t: number) => number) {
  return reserved.every((r) => closest(p0, p1, at(r, t - 1), at(r, t)) >= clear(t));
}

// Can a ball sit at `p` from time t onwards without anything reserved coming too close?
function clearForever(p: Point, t: number, reserved: Point[][], clear: number) {
  for (const r of reserved) {
    for (let k = Math.max(0, t - 1); k < r.length; k++) {
      if (closest(p, p, at(r, k), at(r, k + 1)) < clear) return false;
    }
    if (Math.hypot(p.x - r[r.length - 1].x, p.y - r[r.length - 1].y) < clear) return false;
  }
  return true;
}

class Heap {
  items: [number, number][] = []; // [priority, value]
  get size() {
    return this.items.length;
  }
  push(p: number, v: number) {
    const a = this.items;
    a.push([p, v]);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top[1];
  }
}

// One ball: a timed path from `start` to `goal`. If the goal can't be reached this time, the
// path instead ends where the ball can safely park closest to it (`left` steps short), so it
// still makes progress; null only if it can't even move safely.
function planOne(
  start: Point,
  goal: Point,
  grid: Grid,
  reserved: Point[][],
  clear: number,
  clearAt: (t: number) => number,
  waiting: Point[],
): { path: Point[]; left: number } | null {
  const { ox, oy, step, nx, ny } = grid;
  // Clear of the planned balls, and for the first few steps also of the balls still to be
  // planned, so they get time to move out of the way rather than being run down.
  const free = (p0: Point, p1: Point, t: number) =>
    clearStep(p0, p1, t, reserved, clearAt) &&
    (t > HEAD_START || waiting.every((w) => closest(p0, p1, w, w) >= clearAt(t)));
  const pos = (n: number): Point => ({ x: ox + (n % nx) * step, y: oy + Math.floor(n / nx) * step });
  const node = (p: Point) => {
    const i = Math.max(0, Math.min(nx - 1, Math.round((p.x - ox) / step)));
    const j = Math.max(0, Math.min(ny - 1, Math.round((p.y - oy) / step)));
    return j * nx + i;
  };
  // The goal needn't be a node: a path ends at any node next to it, then steps onto it.
  const gi = (goal.x - ox) / step;
  const gj = (goal.y - oy) / step;
  const h = (n: number) => Math.max(0, Math.max(Math.abs((n % nx) - gi), Math.abs(Math.floor(n / nx) - gj)) - 1);
  const nearGoal = (p: Point) => Math.hypot(p.x - goal.x, p.y - goal.y) <= step * 1.5;

  // State = t * N + node, cost = time + MOVE_COST × distance moved. Parents are kept per state
  // so paths can be rebuilt.
  const N = nx * ny;
  const parent = new Map<number, number>();
  const cost = new Map<number, number>();
  const seen = new Set<number>();
  const heap = new Heap();
  const rebuild = (s: number) => {
    const path: Point[] = [];
    for (let k = s; k !== -1; k = parent.get(k)!) path.push(pos(k % N));
    path.push(start);
    return path.reverse();
  };
  let park = -1; // best state to stop at if the goal can't be reached
  let parkLeft = Infinity;
  const first = node(start);
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const i = (first % nx) + di;
      const j = Math.floor(first / nx) + dj;
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const n = j * nx + i;
      if (!free(start, pos(n), 1)) continue;
      const s = N + n;
      const g = 1 + (MOVE_COST * Math.hypot(pos(n).x - start.x, pos(n).y - start.y)) / step;
      parent.set(s, -1);
      cost.set(s, g);
      heap.push(g + h(n), s);
    }
  }

  let expansions = 0;
  while (heap.size && expansions++ < MAX_EXPANSIONS) {
    const s = heap.pop();
    if (seen.has(s)) continue;
    seen.add(s);
    const t = Math.floor(s / N);
    const n = s % N;
    const p = pos(n);
    if (nearGoal(p) && free(p, goal, t + 1) && clearForever(goal, t + 1, reserved, clear)) {
      return { path: [...rebuild(s), goal], left: 0 };
    }
    if (h(n) + 1 < parkLeft && clearForever(p, t, reserved, clear)) {
      park = s;
      parkLeft = h(n) + 1;
    }
    if (t + 1 >= MAX_T) continue;
    const ci = n % nx;
    const cj = Math.floor(n / nx);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const m = j * nx + i;
        const next = (t + 1) * N + m;
        if (seen.has(next)) continue;
        const g = cost.get(s)! + 1 + MOVE_COST * Math.hypot(di, dj);
        if (g >= (cost.get(next) ?? Infinity)) continue;
        if (!free(p, pos(m), t + 1)) continue;
        parent.set(next, s);
        cost.set(next, g);
        heap.push(g + h(m), next);
      }
    }
  }
  return park >= 0 ? { path: rebuild(park), left: parkLeft } : null;
}

// Straighten one ball's path in place without changing when it is where: from each point, jump
// to the furthest later point it can reach in a straight line over the same time, moving at a
// steady speed, while staying clear of every other ball at every step.
function smooth(paths: Point[][], k: number, clearAt: (t: number) => number) {
  const p = paths[k];
  const others = paths.filter((_, j) => j !== k);
  const lerp = (a: Point, b: Point, f: number) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  const straight = (i: number, j: number) => {
    let prev = p[i];
    for (let t = i + 1; t <= j; t++) {
      const q = lerp(p[i], p[j], (t - i) / (j - i));
      if (others.some((o) => closest(prev, q, at(o, t - 1), at(o, t)) < clearAt(t))) return false;
      prev = q;
    }
    return true;
  };
  for (let i = 0; i < p.length - 1; ) {
    let j = p.length - 1;
    while (j > i + 1 && !straight(i, j)) j--;
    for (let t = i + 1; t < j; t++) p[t] = lerp(p[i], p[j], (t - i) / (j - i));
    i = j;
  }
}

const ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

// Timed paths for every ball (one point per time step), or null if no order works. `complete` is
// false when some ball has to stop short this time; planning again from there gets it home.
export function planPaths(starts: Point[], goals: Point[], grid: Grid, clear: number) {
  // Getting onto the grid can shift a ball by most of a step, and balls may start just inside
  // `clear` (they settle a pixel or two short), so the first couple of steps allow a step less;
  // the full clearance applies from then on. A step less is still well clear of touching.
  let tightest = Infinity;
  starts.forEach((a, i) => starts.slice(i + 1).forEach((b) => (tightest = Math.min(tightest, Math.hypot(a.x - b.x, a.y - b.y)))));
  const clearAt = (t: number) => Math.min(clear, Math.min(tightest, clear) - grid.step * 1.5 + t * grid.step * 0.5);
  let best: { paths: Point[][]; score: number } | null = null;
  for (const order of ORDERS.filter((o) => o.every((k) => k < starts.length))) {
    const paths: Point[][] = [];
    const reserved: Point[][] = [];
    let score = 0;
    let ok = true;
    for (const [i, k] of order.entries()) {
      const waiting = order.slice(i + 1).map((j) => starts[j]);
      const plan = planOne(starts[k], goals[k], grid, reserved, clear, clearAt, waiting);
      if (!plan) {
        ok = false;
        break;
      }
      paths[k] = plan.path;
      reserved.push(plan.path);
      score += plan.path.length + (plan.left ? 1000 + 10 * plan.left : 0); // stopping short costs most
    }
    if (ok && (!best || score < best.score)) best = { paths, score };
  }
  if (!best) return null;
  // Twice round, since straightening one path can open up room for the others.
  for (let pass = 0; pass < 2; pass++) best.paths.forEach((_, k) => smooth(best!.paths, k, clearAt));
  return { paths: best.paths, complete: best.score < 1000 };
}
