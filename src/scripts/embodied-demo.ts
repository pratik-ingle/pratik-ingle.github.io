// The home page's embodied-AI demos, switchable with tabs. Grasp-free manipulation lives in
// surface-scene.ts and Agent safety in agent-safety.ts; this file wires up the tabs, draws on the
// shared canvas and hides it while Agent safety is open.
//
// Language → action: a toy instruction-following arm. A rule-based parser turns an instruction
// ("stack red on blue") into a plan of pick-and-place moves; the arm carries it out with
// two-link inverse kinematics and a gripper.
//
// World model: a mobile robot that plans by imagining. Every frame it rolls 24 futures forward
// with its motion model, one per heading (turn to face it, pivoting on the spot if it's far round,
// then drive straight), scores where each leads on a cost-to-go map that routes around the walls,
// and acts on the best (re-planned every frame). To keep it out of corners: the map charges extra
// for passing close to walls, blocked motion slides along the wall, changing its mind costs a
// little, and if it is wedged against a wall without progress it backs up briefly and tries again.

import type { Preset } from '../lib/surface-presets';
import { SurfaceScene } from './surface-scene';

type Color = 'red' | 'blue' | 'green';
type Point = { x: number; y: number };

const css = getComputedStyle(document.documentElement);
const cssVar = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
const INK = cssVar('--ink', '#0a0a0a');
const ACCENT = cssVar('--accent', '#2d5bff');
const RULE = cssVar('--rule-strong', '#c9c9c6');
const FILL = cssVar('--fill', '#f1f1ef');
const PAPER = cssVar('--paper', '#ffffff');
const BLOCK: Record<Color, string> = { red: '#e1251b', blue: ACCENT, green: '#0a7f5a' };
const COLORS: Color[] = ['red', 'blue', 'green'];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (t: number) => t * t * (3 - 2 * t);

interface Scene {
  resize(w: number, h: number): void;
  step(dt: number, now: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

// ── Language → action ──────────────────────────────────────────────────────────────────

type Move = { color: Color; from: number; to: number; label: string; lift?: boolean };
type Segment =
  | { kind: 'move'; to: Point }
  | { kind: 'grip'; open: boolean }
  | { kind: 'attach'; slot: number }
  | { kind: 'detach'; slot: number }
  | { kind: 'pause'; dur: number }
  | { kind: 'step'; index: number };

const HOME: Record<Color, number> = { red: 1, blue: 3, green: 4 };

// What an instruction asks for. 'arrange' maps each block it mentions to what that block should
// end up resting on; the planner works out the moves.
export type Goal =
  | { kind: 'arrange'; on: Map<Color, Color | 'table'> }
  | { kind: 'side'; a: Color; side: 'left' | 'right' }
  | { kind: 'pick'; a: Color }
  | { kind: 'reset' }
  | { kind: 'invalid'; message: string };

const isColor = (s: unknown): s is Color => COLORS.includes(s as Color);

// A small rule-based parser. It understands chains ("red on green on blue"), follow-ups that refer
// back to the stack built so far ("… and both on blue", "… then the stack on blue", "… then it on
// blue"), "under", towers with a given order ("tower with blue at the bottom and red on top"),
// the table ("put red down", "unstack everything"), moving left/right, picking up and reset.
export function parseInstruction(text: string, stacks: Color[][]): Goal | null {
  let t = ` ${text.toLowerCase().replace(/[.!?"“”]/g, ' ')} `.replace(/\s+/g, ' ');
  if (/\b(reset|start over|original|initial)\b/.test(t)) return { kind: 'reset' };
  t = t.replace(/\b(on top of|onto|atop|upon|above|over)\b/g, 'on').replace(/\b(underneath|beneath|below)\b/g, 'under');
  t = t.replace(/(?<!\bon )\b(red|blue|green) and (red|blue|green) on (?:the )?(red|blue|green|table)\b/g, (_m, a, b, z) =>
    z === 'table' ? `${a} on table and ${b} on table` : `${a} on ${z} and ${b} on ${a}`,
  );
  const mentioned = [...t.matchAll(/\b(red|blue|green)\b/g)].map((m) => m[1] as Color);
  const invalid = (message: string): Goal => ({ kind: 'invalid', message });

  if (/\b(unstack|spread|scatter|separate|take apart|knock down)\b/.test(t) || /\b(all|everything|every block)\b.*\b(table|down)\b/.test(t)) {
    const which = mentioned.length && !/\b(all|everything|every)\b/.test(t) ? mentioned : COLORS;
    return { kind: 'arrange', on: new Map(which.map((c) => [c, 'table'])) };
  }

  // Positions in a tower: "blue at the bottom", "red on top", "the base is green".
  const slots: (Color | undefined)[] = [undefined, undefined, undefined]; // bottom, middle, top
  const place = (c: Color, where: string) => (slots[where === 'top' ? 2 : where === 'middle' || where === 'centre' || where === 'center' ? 1 : 0] = c);
  const positions = '(bottom|base|middle|centre|center|top)';
  t = t.replace(new RegExp(`\\b(red|blue|green) (?:block )?(?:is |goes |sits )?(?:at |on |in |as )?(?:the )?${positions}\\b`, 'g'), (_m, c, where) => {
    place(c, where);
    return ' ';
  });
  t = t.replace(new RegExp(`\\b${positions} (?:is |should be |= ?)?(red|blue|green)\\b`, 'g'), (_m, where, c) => {
    place(c, where);
    return ' ';
  });
  const allTower =
    slots.some(Boolean) ||
    /\b(build|make|form|create)\b.*\b(tower|pile|stack)\b/.test(t) ||
    /\b(a|one|single) (tower|pile)\b/.test(t) ||
    (/\b(stack|tower|pile)\b/.test(t) && /\b(all|three|3|every|everything|them)\b/.test(t));

  if (!allTower && !/\b(on|under|table|down)\b/.test(t) && mentioned.length) {
    if (/\bleft\b/.test(t)) return { kind: 'side', a: mentioned[0], side: 'left' };
    if (/\bright\b/.test(t)) return { kind: 'side', a: mentioned[0], side: 'right' };
    if (/\b(pick|lift|grab|raise|hold|take)\b/.test(t)) return { kind: 'pick', a: mentioned[0] };
  }

  // Relations, clause by clause. "both"/"them"/"the stack" mean the stack the previous clause built
  // (its bottom block moves); "it" means the block the previous clause moved.
  const on = new Map<Color, Color | 'table'>();
  let lastSubject: Color | undefined;
  const bottomOf = (c: Color) => {
    let b = c;
    for (let i = 0; i < 3; i++) {
      const under = on.get(b);
      if (!isColor(under)) break;
      b = under;
    }
    return b;
  };
  for (const clause of t.split(/,|;|\band then\b|\bthen\b|\band\b|\bafter that\b/)) {
    const c = clause.replace(/\b(?:the|that|this) (?:stack|tower|pair|two|pile)\b|\b(?:both|them|those|these)\b/g, ' ref ');
    const objs: (Color | 'table')[] = [];
    const seps: ('on' | 'under')[] = [];
    let pending: Color | 'table' | undefined;
    for (const [, tok] of c.matchAll(/\b(red|blue|green|ref|it|on|under|table|down)\b/g)) {
      if (tok === 'on' || tok === 'under' || tok === 'down') {
        if (pending === undefined) continue;
        objs.push(pending);
        pending = tok === 'down' ? 'table' : undefined;
        seps.push(tok === 'under' ? 'under' : 'on');
        continue;
      }
      if (isColor(tok) || tok === 'table') pending = tok;
      else if (tok === 'ref' && lastSubject) pending = bottomOf(lastSubject);
      else if (tok === 'it' && lastSubject) pending = lastSubject;
    }
    if (pending !== undefined) objs.push(pending);
    if (objs.length !== seps.length + 1 || !seps.length) continue;
    for (let i = 0; i < seps.length; i++) {
      const [upper, lower] = seps[i] === 'on' ? [objs[i], objs[i + 1]] : [objs[i + 1], objs[i]];
      if (upper === 'table') return invalid('The table can’t go on a block.');
      if (upper === lower) return invalid('A block can’t go on top of itself.');
      on.set(upper, lower);
    }
    if (isColor(objs[0])) lastSubject = objs[0];
  }

  if (allTower) {
    const order = slots;
    const pairs = [...on].filter((pair): pair is [Color, Color] => isColor(pair[1]));
    for (let pass = 0; pass < 4; pass++)
      for (const [u, l] of pairs) {
        const iu = order.indexOf(u);
        const il = order.indexOf(l);
        if (il >= 0 && il < 2 && iu < 0 && !order[il + 1]) order[il + 1] = u;
        else if (iu > 0 && il < 0 && !order[iu - 1]) order[iu - 1] = l;
        else if (iu < 0 && il < 0) {
          const i = [0, 1].find((k) => !order[k] && !order[k + 1]);
          if (i !== undefined) [order[i], order[i + 1]] = [l, u];
        }
      }
    const level = (c: Color) => Math.max(...stacks.map((s) => s.indexOf(c))); // keep lower blocks lower
    const rest = COLORS.filter((c) => !order.includes(c)).sort((a, b) => level(a) - level(b));
    for (let i = 0; i < 3; i++) if (!order[i]) order[i] = rest.shift();
    if (new Set(order).size !== 3 || pairs.some(([u, l]) => order.indexOf(u) !== order.indexOf(l) + 1))
      return invalid('Those can’t all be true in one tower of three.');
    const [b0, b1, b2] = order as Color[];
    on.clear();
    on.set(b0, 'table').set(b1, b0).set(b2, b1);
  }

  if (!on.size) return null;
  const supported = new Set<Color>();
  for (const [, lower] of on) {
    if (!isColor(lower)) continue;
    if (supported.has(lower)) return invalid(`Only one block fits directly on ${lower}.`);
    supported.add(lower);
  }
  for (const start of on.keys()) {
    let b: Color | 'table' | undefined = start;
    for (let i = 0; i < 4 && isColor(b); i++) b = on.get(b);
    if (isColor(b)) return invalid('That would need a block to sit under itself.');
  }
  return { kind: 'arrange', on };
}

export class ArmScene implements Scene {
  w = 0;
  h = 0;
  table = 0;
  block = 24;
  grip = 15; // wrist to the centre of a held block
  slots: number[] = [];
  stacks: Color[][] = [[], ['red'], [], ['blue'], ['green'], []];
  shoulder: Point = { x: 0, y: 0 };
  L = 95; // length of each link
  wrist: Point = { x: 0, y: 0 };
  fingers = 1; // 1 open, 0 closed
  held: Color | null = null;
  queue: Segment[] = [];
  active: { seg: Segment; t: number; from: Point; dur: number } | null = null;
  steps: string[] = [];
  current = -1;
  onChange: () => void = () => {};

  get busy() {
    return this.active !== null || this.queue.length > 0;
  }

  resize(w: number, h: number) {
    const first = this.w === 0;
    this.w = w;
    this.h = h;
    this.table = h - 18;
    this.block = clamp(w / 30, 16, 26);
    this.grip = 3 + this.block / 2;
    this.L = clamp(w * 0.13, 70, 98);
    this.shoulder = { x: w / 2, y: this.table - this.block * 1.6 };
    const R = this.L * 2;
    this.slots = [-0.88, -0.6, -0.32, 0.32, 0.6, 0.88].map((f) => this.shoulder.x + f * R * 0.95);
    if (first || !this.busy) this.wrist = this.homePose();
  }

  homePose(): Point {
    return { x: this.shoulder.x + this.L * 0.5, y: this.hoverY() + 10 };
  }

  // high enough to carry a block over a stack of three
  hoverY() {
    return this.table - this.block * 4 - 8;
  }

  // wrist height that puts a held block's centre at stack level `level`
  wristAt(level: number) {
    return this.table - this.block * (level + 0.5) - this.grip;
  }

  where(stacks: Color[][], c: Color) {
    for (let s = 0; s < stacks.length; s++) {
      const level = stacks[s].indexOf(c);
      if (level >= 0) return { slot: s, level };
    }
    return { slot: -1, level: -1 };
  }

  // Plan on a copy of the table so later steps see the effect of earlier ones.
  plan(cmd: Goal): Move[] | string {
    if (cmd.kind === 'invalid') return cmd.message;
    const sim = this.stacks.map((s) => [...s]);
    const moves: Move[] = [];
    const move = (from: number, to: number, label: string, lift = false) => {
      const color = sim[from].pop()!;
      sim[to].push(color);
      moves.push({ color, from, to, label, lift });
    };
    const freeNear = (from: number, avoid: number[]) =>
      sim
        .map((s, i) => i)
        .filter((i) => sim[i].length === 0 && !avoid.includes(i))
        .sort((a, b) => Math.abs(a - from) - Math.abs(b - from))[0];
    const clearAbove = (c: Color, avoid: number[]) => {
      const { slot } = this.where(sim, c);
      while (sim[slot][sim[slot].length - 1] !== c) {
        const top = sim[slot][sim[slot].length - 1];
        const to = freeNear(slot, avoid);
        if (to === undefined) return false;
        move(slot, to, `move ${top} off ${c}`);
      }
      return true;
    };

    if (cmd.kind === 'arrange') {
      // Blocks-world planning: put a block straight into its final place when that place is ready
      // (clear, and itself finished), otherwise move something in the way onto the table.
      const target = cmd.on;
      const named = new Set<Color>([...target.keys(), ...[...target.values()].filter(isColor)]);
      const pos = (c: Color) => this.where(sim, c);
      const below = (c: Color): Color | 'table' => {
        const p = pos(c);
        return p.level === 0 ? 'table' : sim[p.slot][p.level - 1];
      };
      const clear = (c: Color) => {
        const p = pos(c);
        return p.level === sim[p.slot].length - 1;
      };
      const done = (c: Color): boolean => {
        const want = target.get(c);
        if (want === undefined) {
          // a block the instruction didn't mention is fine unless it sits on one it did
          const p = pos(c);
          return sim[p.slot].slice(0, p.level).every((x) => !named.has(x));
        }
        return below(c) === want && (want === 'table' || done(want));
      };
      for (let guard = 0; guard < 16 && !COLORS.every(done); guard++) {
        const ready = COLORS.find((c) => {
          const want = target.get(c);
          if (want === undefined || done(c) || !clear(c)) return false;
          return want === 'table' || (clear(want) && done(want));
        });
        if (ready) {
          const want = target.get(ready)!;
          const from = pos(ready).slot;
          if (want === 'table') {
            const to = freeNear(from, []);
            if (to === undefined) return 'There’s no free space on the table.';
            move(from, to, `put ${ready} on the table`);
          } else move(from, pos(want).slot, `put ${ready} on ${want}`);
          continue;
        }
        const blocker = COLORS.find((c) => clear(c) && !done(c) && pos(c).level > 0);
        if (!blocker) break;
        const from = pos(blocker).slot;
        const to = freeNear(from, []);
        if (to === undefined) return 'There’s no free space on the table.';
        move(from, to, `move ${blocker} off ${below(blocker)}`);
      }
      if (!COLORS.every(done)) return 'I couldn’t find a way to do that.';
      if (!moves.length) return 'That’s already done.';
    } else if (cmd.kind === 'side') {
      const { a, side } = cmd as { a: Color; side: string };
      if (!clearAbove(a, [])) return `No room to clear ${a}.`;
      const from = this.where(sim, a).slot;
      const empty = sim.map((s, i) => i).filter((i) => sim[i].length === 0);
      const to = side === 'left' ? Math.min(...empty) : Math.max(...empty);
      if (!empty.length || (side === 'left' ? to > from : to < from)) return `${cap(a)} is already as far ${side} as it can go.`;
      move(from, to, `move ${a} ${side}`);
    } else if (cmd.kind === 'pick') {
      const { a } = cmd as { a: Color };
      if (!clearAbove(a, [])) return `No room to clear ${a}.`;
      const from = this.where(sim, a).slot;
      move(from, from, `lift ${a}`, true);
    } else {
      for (let guard = 0; guard < 12; guard++) {
        const misplaced = COLORS.find((c) => {
          const p = this.where(sim, c);
          return (p.slot !== HOME[c] || p.level !== 0) && sim[p.slot][sim[p.slot].length - 1] === c;
        });
        if (!misplaced) break;
        const from = this.where(sim, misplaced).slot;
        const home = HOME[misplaced];
        if (sim[home].length === 0) move(from, home, `return ${misplaced} home`);
        else {
          const buffer = freeNear(from, Object.values(HOME));
          if (buffer === undefined) break;
          move(from, buffer, `move ${misplaced} aside`);
        }
      }
      if (!moves.length) return 'Everything is already in place.';
    }
    return moves;
  }

  run(moves: Move[]) {
    this.steps = moves.map((m) => m.label);
    this.current = -1;
    const hover = this.hoverY();
    const heights = this.stacks.map((s) => s.length);
    moves.forEach((m, i) => {
      const fromLevel = heights[m.from] - 1;
      heights[m.from]--;
      const toLevel = heights[m.to];
      heights[m.to]++;
      const fx = this.slots[m.from];
      const tx = this.slots[m.to];
      this.queue.push(
        { kind: 'step', index: i },
        { kind: 'move', to: { x: fx, y: hover } },
        { kind: 'grip', open: true },
        { kind: 'move', to: { x: fx, y: this.wristAt(fromLevel) } },
        { kind: 'grip', open: false },
        { kind: 'attach', slot: m.from },
        { kind: 'move', to: { x: fx, y: m.lift ? hover - this.block * 0.4 : hover } },
      );
      if (m.lift) this.queue.push({ kind: 'pause', dur: 0.6 });
      this.queue.push(
        { kind: 'move', to: { x: tx, y: hover } },
        { kind: 'move', to: { x: tx, y: this.wristAt(toLevel) } },
        { kind: 'grip', open: true },
        { kind: 'detach', slot: m.to },
        { kind: 'move', to: { x: tx, y: hover } },
      );
    });
    this.queue.push({ kind: 'step', index: moves.length }, { kind: 'move', to: this.homePose() });
    this.onChange();
  }

  blockAt(p: Point): Color | null {
    for (let s = 0; s < this.stacks.length; s++) {
      for (let l = 0; l < this.stacks[s].length; l++) {
        const cx = this.slots[s];
        const cy = this.table - this.block * (l + 0.5);
        if (Math.abs(p.x - cx) <= this.block * 0.7 && Math.abs(p.y - cy) <= this.block * 0.7) return this.stacks[s][l];
      }
    }
    return null;
  }

  step(dt: number) {
    if (!this.active && this.queue.length) {
      const seg = this.queue.shift()!;
      let dur = 0;
      if (seg.kind === 'move') dur = clamp(Math.hypot(seg.to.x - this.wrist.x, seg.to.y - this.wrist.y) / 300, 0.18, 0.75);
      if (seg.kind === 'grip') dur = 0.22;
      if (seg.kind === 'pause') dur = seg.dur;
      if (seg.kind === 'attach') this.held = this.stacks[seg.slot].pop() ?? null;
      if (seg.kind === 'detach' && this.held) {
        this.stacks[seg.slot].push(this.held);
        this.held = null;
      }
      if (seg.kind === 'step') {
        this.current = seg.index;
        this.onChange();
      }
      if (dur > 0) this.active = { seg, t: 0, from: { ...this.wrist }, dur };
    }
    if (!this.active) return;
    const a = this.active;
    a.t = Math.min(1, a.t + dt / a.dur);
    const k = ease(a.t);
    if (a.seg.kind === 'move') {
      this.wrist = { x: a.from.x + (a.seg.to.x - a.from.x) * k, y: a.from.y + (a.seg.to.y - a.from.y) * k };
    } else if (a.seg.kind === 'grip') {
      this.fingers = a.seg.open ? Math.max(this.fingers, k) : Math.min(this.fingers, 1 - k);
    }
    if (a.t >= 1) {
      this.active = null;
      if (!this.queue.length) this.onChange();
    }
  }

  elbow(): Point {
    const S = this.shoulder;
    const dx = this.wrist.x - S.x;
    const dy = this.wrist.y - S.y;
    const d = clamp(Math.hypot(dx, dy), 1, this.L * 2 - 0.5);
    const phi = Math.atan2(dy, dx);
    const alpha = Math.acos(clamp(d / (2 * this.L), -1, 1));
    const e1 = { x: S.x + this.L * Math.cos(phi - alpha), y: S.y + this.L * Math.sin(phi - alpha) };
    const e2 = { x: S.x + this.L * Math.cos(phi + alpha), y: S.y + this.L * Math.sin(phi + alpha) };
    return e1.y < e2.y ? e1 : e2; // elbow up
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, table, block: b, grip } = this;
    ctx.clearRect(0, 0, w, this.h);

    // table and slot marks
    ctx.fillStyle = INK;
    ctx.fillRect(0, table, w, 2);
    ctx.fillStyle = RULE;
    for (const x of this.slots) ctx.fillRect(x - b * 0.55, table + 5, b * 1.1, 2);

    // blocks on the table
    this.stacks.forEach((stack, s) =>
      stack.forEach((c, l) => drawBlock(ctx, this.slots[s], table - b * (l + 0.5), b, c)),
    );

    // arm: pedestal, two links, joints
    const S = this.shoulder;
    const E = this.elbow();
    const W = this.wrist;
    ctx.fillStyle = INK;
    ctx.fillRect(S.x - b * 0.55, S.y, b * 1.1, table - S.y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    line(ctx, S, E);
    ctx.lineWidth = 6;
    line(ctx, E, W);
    for (const p of [S, E, W]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // held block, then the gripper around it
    if (this.held) drawBlock(ctx, W.x, W.y + grip, b, this.held);
    const half = (b + 2) / 2 + this.fingers * 6;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(W.x - half, W.y + 2);
    ctx.lineTo(W.x + half, W.y + 2);
    ctx.moveTo(W.x - half, W.y + 2);
    ctx.lineTo(W.x - half, W.y + grip + b * 0.4);
    ctx.moveTo(W.x + half, W.y + 2);
    ctx.lineTo(W.x + half, W.y + grip + b * 0.4);
    ctx.stroke();
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, c: Color) {
  ctx.fillStyle = BLOCK[c];
  ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - size / 2 + 0.5, cy - size / 2 + 0.5, size - 1, size - 1);
}

function line(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)); // angle in (-π, π]

// ── World model ────────────────────────────────────────────────────────────────────────

const HEADINGS = 24; // imagined futures, one per heading, 15° apart
const PIVOT_ANGLE = 0.7; // rad: further round than this, turn on the spot before driving
const ARRIVE = 10; // px from the goal that counts as arrived
const TIME_COST = 0.5; // charge per step of look-ahead, as a fraction of the distance it could cover
const TIE_ANGLE = 2.6; // rad (150°): beyond this, a pivot keeps its direction rather than reversing
const TOO_CLOSE = 12; // px of travel: a future that meets a wall sooner than this is ruled out
const BLOCKED_COST = 70; // cost of a future that runs into a wall at the very start of its look-ahead
const HORIZON = 30; // steps per imagined rollout
const MODEL_DT = 0.06; // s per imagined step (1.8 s look-ahead)
const MAX_SPEED = 120; // px/s
const MAX_TURN = 4; // rad/s
const RADIUS = 7;
const CELL = 6; // px per cell of the cost-to-go map
const WALL_MARGIN = 4; // cells near a wall that cost extra to pass through
const WALL_PENALTY = 2; // extra cost per cell right next to a wall, fading out over the margin
const SWITCH_COST = 80; // cost of reversing last frame's chosen heading (less for smaller changes)
const STUCK_AFTER = 2500; // ms without progress, near a wall, before backing up
const BACK_UP = 500; // ms spent backing up
const WALLS = [
  // x, y, w, h as fractions of the arena
  [0.22, 0, 0.03, 0.56],
  [0.44, 0.42, 0.03, 0.58],
  [0.66, 0, 0.03, 0.6],
  [0.83, 0.58, 0.07, 0.16],
];

export class NavScene implements Scene {
  w = 0;
  h = 0;
  rects: { x: number; y: number; w: number; h: number }[] = [];
  cols = 0;
  rows = 0;
  costToGo = new Float64Array(0);
  robot = { x: 0, y: 0, th: 0 };
  goal: Point = { x: 0, y: 0 };
  paths: Float32Array[] = [];
  scores: number[] = []; // each imagined future's score (lower is better), for the heat map
  aim: Point | null = null; // where the chosen future scores best
  bestPath = 0;
  lastInput = -Infinity;
  arrivedAt = -Infinity;
  still = false;
  heading: number | null = null; // heading chosen last frame, to avoid flip-flopping
  spin = 0; // direction of a pivot in progress (+1/-1), kept until it's facing roughly the right way
  progress = { best: Infinity, at: 0 }; // lowest cost-to-go so far, and when it was reached
  backUntil = -Infinity;
  backTurn = 0;

  resize(w: number, h: number) {
    const first = this.w === 0;
    const sx = first ? 1 : w / this.w;
    const sy = first ? 1 : h / this.h;
    this.w = w;
    this.h = h;
    this.rects = WALLS.map(([x, y, rw, rh]) => ({ x: x * w, y: y * h, w: rw * w, h: rh * h }));
    this.cols = Math.ceil(w / CELL);
    this.rows = Math.ceil(h / CELL);
    if (first) {
      this.robot = { x: w * 0.08, y: h * 0.75, th: -0.4 };
      this.goal = this.still ? { x: this.robot.x, y: this.robot.y } : { x: w * 0.93, y: h * 0.25 };
    } else {
      this.robot.x *= sx;
      this.robot.y *= sy;
      this.goal = { x: this.goal.x * sx, y: this.goal.y * sy };
    }
    this.mapCostToGo();
  }

  free(x: number, y: number) {
    const m = RADIUS + 2;
    if (x < m || y < m || x > this.w - m || y > this.h - m) return false;
    return !this.rects.some((r) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m);
  }

  // Shortest distance from every free cell to the goal, routing around the walls (Dijkstra).
  mapCostToGo() {
    const { cols, rows } = this;
    // Float64 to match the heap keys: rounding to Float32 made settled cells look stale and skipped them.
    const dist = new Float64Array(cols * rows).fill(Infinity);
    const blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) blocked[r * cols + c] = this.free((c + 0.5) * CELL, (r + 0.5) * CELL) ? 0 : 1;
    let gc = clamp(Math.floor(this.goal.x / CELL), 0, cols - 1);
    let gr = clamp(Math.floor(this.goal.y / CELL), 0, rows - 1);
    if (blocked[gr * cols + gc]) {
      // A goal inside a wall's margin moves to the nearest free cell (measured from where it was
      // asked for, not from the best found so far).
      const [wc, wr] = [gc, gr];
      let bestD = Infinity;
      for (let i = 0; i < cols * rows; i++)
        if (!blocked[i]) {
          const d = (i % cols - wc) ** 2 + (Math.floor(i / cols) - wr) ** 2;
          if (d < bestD) [bestD, gc, gr] = [d, i % cols, Math.floor(i / cols)];
        }
      this.goal = { x: (gc + 0.5) * CELL, y: (gr + 0.5) * CELL };
    }
    // How many cells each cell is from the nearest blocked one, so routes can keep a margin.
    const near = new Float64Array(cols * rows).fill(Infinity);
    const queue: number[] = [];
    for (let i = 0; i < cols * rows; i++) if (blocked[i]) (near[i] = 0), queue.push(i);
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const j = nr * cols + nc;
        if (near[j] > near[i] + 1) (near[j] = near[i] + 1), queue.push(j);
      }
    }
    const extra = (i: number) => WALL_PENALTY * Math.max(0, (WALL_MARGIN + 1 - near[i]) / WALL_MARGIN);
    const heap = new MinHeap();
    dist[gr * cols + gc] = 0;
    heap.push(0, gr * cols + gc);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (d > dist[i]) continue;
      const c = i % cols;
      const r = (i - c) / cols;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const j = nr * cols + nc;
          if (blocked[j]) continue;
          const nd = d + (dr && dc ? Math.SQRT2 : 1) * CELL * (1 + (extra(i) + extra(j)) / 2);
          if (nd < dist[j]) {
            dist[j] = nd;
            heap.push(nd, j);
          }
        }
    }
    this.costToGo = dist;
  }

  cost(x: number, y: number) {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    // A free point can sit in a cell whose centre isn't free (right at an edge): use its
    // neighbours then, rather than treating it as cut off from the goal.
    let best = Infinity;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) continue;
        const d = this.costToGo[rr * this.cols + cc] + (dr || dc ? CELL * Math.hypot(dr, dc) : 0);
        if (d < best) best = d;
        if (!dr && !dc && Number.isFinite(d)) return d;
      }
    return Number.isFinite(best) ? best : 1e4;
  }

  setGoal(p: Point, now: number) {
    this.goal = { x: clamp(p.x, 4, this.w - 4), y: clamp(p.y, 4, this.h - 4) };
    this.lastInput = now;
    this.arrivedAt = -Infinity;
    this.progress = { best: Infinity, at: now };
    this.heading = null; // a new goal is a fresh decision
    this.spin = 0;
    this.mapCostToGo();
  }

  // How far to turn from `th` to face `heading`: the short way round, unless a pivot is already
  // under way and the heading is nearly behind (a near tie), when it carries on in its direction
  // so a near-180° turn doesn't flip-flop.
  turnFrom(heading: number, th: number) {
    const off = wrap(heading - th);
    if (!this.spin || Math.abs(off) < TIE_ANGLE || Math.sign(off) === this.spin) return off;
    return off + this.spin * 2 * Math.PI;
  }

  // Move by (dx, dy), sliding along a wall instead of stopping dead when the move is blocked.
  move(dx: number, dy: number) {
    const R = this.robot;
    if (this.free(R.x + dx, R.y + dy)) {
      R.x += dx;
      R.y += dy;
    } else if (this.free(R.x + dx, R.y)) R.x += dx;
    else if (this.free(R.x, R.y + dy)) R.y += dy;
  }

  step(dt: number, now: number) {
    const R = this.robot;
    const remaining = this.cost(R.x, R.y);
    const arrived = Math.hypot(this.goal.x - R.x, this.goal.y - R.y) < ARRIVE;
    if (arrived && this.arrivedAt === -Infinity) this.arrivedAt = now;

    // Wander to a new goal when nobody has clicked for a while.
    if (!this.still && arrived && now - this.arrivedAt > 1800 && now - this.lastInput > 4000) {
      for (let tries = 0; tries < 50; tries++) {
        const p = { x: this.w * (0.05 + 0.9 * Math.random()), y: this.h * (0.1 + 0.8 * Math.random()) };
        if (this.free(p.x, p.y) && Math.hypot(p.x - R.x, p.y - R.y) > this.w * 0.3) {
          this.goal = p;
          this.arrivedAt = -Infinity;
          this.progress = { best: Infinity, at: now };
          this.heading = null;
          this.spin = 0;
          this.mapCostToGo();
          break;
        }
      }
    }

    if (arrived) {
      this.paths = [];
      this.scores = [];
      this.aim = null;
      return;
    }

    // Recovery: if the cost-to-go hasn't dropped for a while, back up briefly, then plan afresh.
    if (remaining < this.progress.best - 4) this.progress = { best: remaining, at: now };
    const wedged = !this.free(R.x + 2 * CELL, R.y) || !this.free(R.x - 2 * CELL, R.y) || !this.free(R.x, R.y + 2 * CELL) || !this.free(R.x, R.y - 2 * CELL);
    if (wedged && now - this.progress.at > STUCK_AFTER && now > this.backUntil) {
      this.backUntil = now + BACK_UP;
      this.backTurn = (Math.random() < 0.5 ? -1 : 1) * MAX_TURN * 0.6;
      this.progress = { best: remaining, at: now + BACK_UP };
      this.heading = null;
      this.spin = 0;
    }
    if (now < this.backUntil) {
      this.paths = [];
      this.scores = [];
      this.aim = null;
      R.th += this.backTurn * dt;
      this.move(-Math.cos(R.th) * MAX_SPEED * 0.45 * dt, -Math.sin(R.th) * MAX_SPEED * 0.45 * dt);
      return;
    }

    // Imagine: for each of 24 headings, roll the motion model forward (turn to face that heading,
    // pivoting on the spot if it's far round, then drive straight) and score where it leads on the
    // cost-to-go map. Headings are fixed in the world, so the best one doesn't shift as the robot
    // turns, and it commits to a turn instead of dithering between left and right.
    const fast = MAX_SPEED * clamp(remaining / 80, 0.3, 1);
    let bestCost = Infinity;
    const previous = this.heading ?? R.th;
    let bestHeading = previous;
    this.paths = [];
    this.scores = [];
    this.aim = null;
    this.bestPath = -1;
    for (let k = 0; k < HEADINGS; k++) {
      const heading = (k / HEADINGS) * 2 * Math.PI;
      let { x, y, th } = R;
      // Score = the best this future gets: cost-to-go at a point plus a charge for the time taken
      // to reach it (half the distance it could cover meanwhile, so progress still pays). A
      // future that ends badly can still be the right first move, like a step sideways round a corner.
      let cost = this.cost(x, y);
      let peak = { x, y };
      let reached = false;
      let travelled = 0;
      const path = new Float32Array((HORIZON / 2 + 2) * 2);
      path[0] = x;
      path[1] = y;
      let n = 1;
      let i = 0;
      for (; i < HORIZON; i++) {
        const off = this.turnFrom(heading, th);
        th += Math.sign(off) * Math.min(Math.abs(off), MAX_TURN * MODEL_DT);
        const v = Math.abs(off) > PIVOT_ANGLE ? 0 : fast;
        const nx = x + Math.cos(th) * v * MODEL_DT;
        const ny = y + Math.sin(th) * v * MODEL_DT;
        if (!this.free(nx, ny)) break;
        travelled += Math.hypot(nx - x, ny - y);
        x = nx;
        y = ny;
        const c = this.cost(x, y) + TIME_COST * fast * MODEL_DT * (i + 1);
        if (c < cost) [cost, peak] = [c, { x, y }];
        if (i % 2 === 1) {
          path[n * 2] = x;
          path[n * 2 + 1] = y;
          n++;
        }
        if (Math.hypot(x - this.goal.x, y - this.goal.y) < ARRIVE * 0.7) {
          reached = true; // this future gets there, whatever lies beyond the goal
          break;
        }
      }
      // A wall right ahead rules a future out; one further off only costs a little, since the
      // robot re-plans every frame and will turn before it gets there.
      const blocked = i < HORIZON && !reached;
      if (blocked && travelled < TOO_CLOSE) cost += 1e4;
      else if (blocked) cost += BLOCKED_COST * (1 - i / HORIZON);
      cost += (SWITCH_COST * Math.abs(wrap(heading - previous))) / Math.PI; // stick with last frame's choice
      if (path[n * 2 - 2] !== x || path[n * 2 - 1] !== y) {
        path[n * 2] = x; // end exactly where this future stops
        path[n * 2 + 1] = y;
        n++;
      }
      this.paths.push(path.slice(0, n * 2));
      this.scores.push(cost);
      if (cost < bestCost) {
        bestCost = cost;
        this.bestPath = k;
        this.aim = peak;
        bestHeading = heading;
      }
    }

    // Act: turn towards the chosen heading (on the spot if it's far round) and drive.
    if (bestCost >= 1e4) bestHeading = R.th + Math.PI / 2; // boxed in: turn and look again
    this.heading = bestHeading;
    const off = this.turnFrom(bestHeading, R.th);
    this.spin = Math.abs(off) > PIVOT_ANGLE ? Math.sign(off) : 0;
    R.th += Math.sign(off) * Math.min(Math.abs(off), MAX_TURN * dt);
    const v = Math.abs(off) > PIVOT_ANGLE || bestCost >= 1e4 ? 0 : fast;
    this.move(Math.cos(R.th) * v * dt, Math.sin(R.th) * v * dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = FILL;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK;
    for (const r of this.rects) ctx.fillRect(r.x, r.y, r.w, r.h);

    // range sensor rays, faint and underneath
    const R = this.robot;
    ctx.strokeStyle = 'rgba(10,10,10,0.1)';
    ctx.fillStyle = INK;
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const a = R.th + ((i - 4) / 4) * 1.6;
      let d = RADIUS;
      while (d < 70 && this.free(R.x + Math.cos(a) * d, R.y + Math.sin(a) * d)) d += 3;
      const end = { x: R.x + Math.cos(a) * d, y: R.y + Math.sin(a) * d };
      line(ctx, R, end);
      if (d < 70) ctx.fillRect(end.x - 1.5, end.y - 1.5, 3, 3);
    }

    // The 24 imagined futures as dotted lines, heat-mapped by score: blue best, through teal, green
    // and amber, to red worst; better ones also get bigger, stronger dots. Sparse grey dots: ruled
    // out by a wall right ahead. Drawn worst first so the best sit on top.
    const valid = this.scores.filter((v) => v < 1e4);
    const lo = Math.min(...valid);
    const hi = Math.max(...valid);
    const order = this.paths.map((_, k) => k).sort((a, b) => this.scores[b] - this.scores[a]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const k of order) {
      if (k === this.bestPath) continue;
      const score = this.scores[k];
      // With round caps, a zero-length dash draws a dot as wide as the line.
      if (score >= 1e4) {
        ctx.setLineDash([0, 7]);
        ctx.strokeStyle = 'rgba(10,10,10,0.25)';
        ctx.lineWidth = 1.5;
      } else {
        const t = hi > lo ? ((score - lo) / (hi - lo)) ** 0.7 : 0;
        ctx.lineWidth = 1.6 + 1.8 * (1 - t);
        ctx.setLineDash([0, ctx.lineWidth + 3]);
        ctx.strokeStyle = heat(t, 0.5 + 0.45 * (1 - t));
      }
      polyline(ctx, this.paths[k]);
    }
    ctx.setLineDash([]);

    // The chosen future, bold, with a ring where it scores best (where the robot is aiming).
    if (this.paths[this.bestPath]) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      polyline(ctx, this.paths[this.bestPath]);
      if (this.aim) {
        ctx.beginPath();
        ctx.arc(this.aim.x, this.aim.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';

    // goal
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.goal.x, this.goal.y, 9, 0, Math.PI * 2);
    ctx.moveTo(this.goal.x - 14, this.goal.y);
    ctx.lineTo(this.goal.x + 14, this.goal.y);
    ctx.moveTo(this.goal.x, this.goal.y - 14);
    ctx.lineTo(this.goal.x, this.goal.y + 14);
    ctx.stroke();

    // robot
    ctx.beginPath();
    ctx.arc(R.x, R.y, RADIUS + 2, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2;
    line(ctx, R, { x: R.x + Math.cos(R.th) * (RADIUS + 1), y: R.y + Math.sin(R.th) * (RADIUS + 1) });
  }
}

// Heat-map colour for t in [0, 1] (0 best): the site's blue, teal, green, amber, red.
// Keep in step with .heat-key in EmbodiedDemo.astro.
const HEAT = [
  [45, 91, 255],
  [24, 166, 196],
  [96, 178, 64],
  [234, 160, 30],
  [225, 37, 27],
];
function heat(t: number, alpha: number) {
  const f = clamp(t, 0, 1) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(f));
  const [r, g, b] = HEAT[i].map((c, j) => Math.round(c + (HEAT[i + 1][j] - c) * (f - i)));
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function polyline(ctx: CanvasRenderingContext2D, p: Float32Array) {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.stroke();
}

class MinHeap {
  keys: number[] = [];
  vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(k: number, v: number) {
    const { keys, vals } = this;
    let i = keys.length;
    keys.push(k);
    vals.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= keys[i]) break;
      [keys[p], keys[i]] = [keys[i], keys[p]];
      [vals[p], vals[i]] = [vals[i], vals[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const { keys, vals } = this;
    const top: [number, number] = [keys[0], vals[0]];
    const k = keys.pop()!;
    const v = vals.pop()!;
    if (keys.length) {
      keys[0] = k;
      vals[0] = v;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < keys.length && keys[l] < keys[m]) m = l;
        if (r < keys.length && keys[r] < keys[m]) m = r;
        if (m === i) break;
        [keys[m], keys[i]] = [keys[i], keys[m]];
        [vals[m], vals[i]] = [vals[i], vals[m]];
        i = m;
      }
    }
    return top;
  }
}

// ── Wiring ─────────────────────────────────────────────────────────────────────────────

const LABELS = {
  arm: {
    status: 'toy policy · parser + motion planner',
    aria: 'A robot arm on a table with red, blue and green blocks. Type an instruction below and the arm carries it out.',
  },
  nav: {
    status: 'model-predictive control · 24 imagined rollouts',
    aria: 'A mobile robot among walls. Click to set a goal: it imagines 24 possible paths and follows the best one. Arrow keys move the goal.',
  },
  surface: {
    status: 'grasp-free · collision-free paths · local control',
    aria: 'Top-down view of a soft surface over a grid of actuators, with red, blue and green balls. Click a ball to select it, then click where it should go: its path is planned so it never touches another ball, and the actuators tilt the surface to roll it along that path. Keys 1 to 3 select a ball; arrow keys move its target.',
  },
  safety: {
    status: 'simulated agent · fixed threat model',
    aria: '',
  },
};
type Mode = keyof typeof LABELS;
const AUTOPLAY = [
  'put red on green and both on blue',
  'unstack everything',
  'build a tower with green at the bottom and red on top',
  'reset',
];

for (const root of document.querySelectorAll<HTMLElement>('[data-embodied-demo]')) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const ctx = canvas.getContext('2d')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-panel]')];
  const form = root.querySelector<HTMLFormElement>('[data-arm-form]')!;
  const input = root.querySelector<HTMLInputElement>('[data-arm-input]')!;
  const runButton = root.querySelector<HTMLButtonElement>('[data-arm-run]')!;
  const planLine = root.querySelector<HTMLElement>('[data-plan]')!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const arm = new ArmScene();
  const nav = new NavScene();
  nav.still = still;
  const surface = new SurfaceScene();
  surface.still = still;
  let mode: Mode = 'arm';
  let scene: Scene = arm;
  let onScreen = true;
  let userTookOver = still;
  let lastArmActivity = performance.now();

  const renderPlan = (message?: string) => {
    planLine.textContent = '';
    if (message) {
      planLine.textContent = message;
      return;
    }
    if (!arm.steps.length) return;
    planLine.append('plan: ');
    arm.steps.forEach((s, i) => {
      const span = document.createElement('span');
      span.textContent = s;
      if (i === arm.current) span.className = 'is-current';
      else if (i < arm.current) span.className = 'is-done';
      planLine.append(span);
      if (i < arm.steps.length - 1) planLine.append(' → ');
    });
    if (arm.current >= arm.steps.length) planLine.append('  ✓');
  };
  arm.onChange = () => {
    runButton.disabled = arm.busy;
    runButton.textContent = arm.busy ? 'Running…' : 'Run';
    renderPlan();
  };

  const execute = (text: string) => {
    if (arm.busy) return;
    lastArmActivity = performance.now();
    const cmd = parseInstruction(text, arm.stacks);
    if (!cmd) {
      arm.steps = [];
      renderPlan('I didn’t catch that. I know stacking, towers, the table, left/right, pick up and reset; try “put red on green and both on blue”.');
      return;
    }
    const plan = arm.plan(cmd);
    if (typeof plan === 'string') {
      arm.steps = [];
      renderPlan(plan);
      return;
    }
    arm.run(plan);
  };

  const takeOver = () => {
    userTookOver = true;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    takeOver();
    execute(input.value);
  });
  input.addEventListener('focus', takeOver);
  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((b) =>
    b.addEventListener('click', () => {
      takeOver();
      input.value = b.textContent!.trim();
      execute(input.value);
    }),
  );

  const pointer = (e: PointerEvent): Point => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = pointer(e);
    if (mode === 'arm') {
      const c = arm.blockAt(p);
      if (c && !arm.busy) {
        takeOver();
        input.value = `pick up ${c}`;
        execute(input.value);
      }
    } else if (mode === 'surface') surface.pointer(p.x, p.y, performance.now());
    else nav.setGoal(p, performance.now());
  });
  canvas.addEventListener('keydown', (e) => {
    if (mode === 'surface') {
      if (surface.key(e.key, performance.now())) e.preventDefault();
      return;
    }
    if (mode !== 'nav' || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const step = 24;
    const g = { ...nav.goal };
    if (e.key === 'ArrowLeft') g.x -= step;
    if (e.key === 'ArrowRight') g.x += step;
    if (e.key === 'ArrowUp') g.y -= step;
    if (e.key === 'ArrowDown') g.y += step;
    nav.setGoal(g, performance.now());
  });

  const setMode = (m: Mode) => {
    mode = m;
    if (m !== 'safety') scene = m === 'arm' ? arm : m === 'nav' ? nav : surface;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === m)));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== m));
    canvas.hidden = m === 'safety';
    status.textContent = LABELS[m].status;
    canvas.setAttribute('aria-label', LABELS[m].aria);
    canvas.style.cursor = m === 'nav' ? 'crosshair' : 'pointer';
    root.dispatchEvent(new CustomEvent('demo-mode', { detail: m }));
  };
  tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode as Mode)));
  root.querySelectorAll<HTMLButtonElement>('[data-surface-preset]').forEach((b) =>
    b.addEventListener('click', () => surface.preset(b.dataset.surfacePreset as Preset, performance.now())),
  );
  setMode('arm');

  // While nobody is using it, the arm types and runs example instructions on its own.
  let autoIndex = 0;
  let typing = false;
  const autoplay = () => {
    if (userTookOver || mode !== 'arm' || arm.busy || typing || !onScreen) return;
    if (performance.now() - lastArmActivity < 2500) return;
    const text = AUTOPLAY[autoIndex++ % AUTOPLAY.length];
    typing = true;
    input.value = '';
    let i = 0;
    const tick = setInterval(() => {
      if (userTookOver) {
        clearInterval(tick);
        typing = false;
        return;
      }
      input.value = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(tick);
        typing = false;
        execute(text);
      }
    }, 55);
  };
  if (!still) setInterval(autoplay, 700);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return; // hidden behind the Agent safety tab: keep the scenes as they are
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    arm.resize(r.width, r.height);
    nav.resize(r.width, r.height);
    surface.resize(r.width, r.height);
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting)).observe(canvas);
  resize();

  let prev = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.033, (now - prev) / 1000);
    prev = now;
    if (onScreen && mode !== 'safety') {
      scene.step(dt, now);
      if (mode === 'arm' && arm.busy) lastArmActivity = now;
      scene.draw(ctx);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
