// Grasp-free manipulation demo, in the spirit of MANTA-RAY: a top-down view of a soft surface
// stretched over a grid of actuators. Nothing is grasped.
//
// When a target changes, surface-planner.ts plans timed, collision-free paths for all the balls
// (one may wait or step aside to let another pass). Each ball's controller tracks a point moving
// along its path and asks for the fabric tilt that produces the acceleration it needs; every
// actuator only listens to the balls within about a cell of it and blends their requests (local
// control). The actuators move at a limited speed, the fabric between them is interpolated, and
// the balls roll down its slope. If any ball falls behind its path, the plan's clock pauses for
// everyone, so the timing that keeps them apart still holds.

import { PRESETS, type Preset } from '../lib/surface-presets';
import { planPaths, type Point } from './surface-planner';

type Ball = { name: string; color: string; x: number; y: number; vx: number; vy: number; tx: number; ty: number };

const css = getComputedStyle(document.documentElement);
const cssVar = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
const INK = cssVar('--ink', '#0a0a0a');
const ACCENT = cssVar('--accent', '#2d5bff');
const RULE = cssVar('--rule-strong', '#c9c9c6');

const ROWS = 4; // cells top to bottom; columns follow the width
const MARGIN = 6;
const GRAV = 1500; // px/s² of acceleration per unit of slope
const AMAX = 280; // px/s², the most any ball's controller asks for
const VMAX = 230; // px/s
const KP = 4; // 1/s, distance from the path's moving point to correcting speed
const KV = 5; // 1/s, speed error to desired acceleration
const FRICTION = 0.8; // 1/s, rolling friction
const RATE = 3; // actuator travel per second, as a fraction of its full range
const REACH = 1.25; // cells: how far an actuator looks for balls
// Cells: closest any two balls' planned paths (and targets) may come. From about 1.42 cells
// apart, every actuator around a ball is nearer to it than to any other ball, so their
// tilt requests stop competing for the same actuators.
const CLEAR = 1.45;
const SAFE = 10; // px beyond touching at which the safety layer starts pushing two balls apart
const TAU = 0.18; // s per planned step of half a cell
const LAG_OK = 5; // px a ball may trail its path before the plan's clock slows down
const LAG_STOP = 12; // px at which the clock stops until it catches up
const IDLE_AFTER = 6000; // ms without input before the demo runs presets on its own
const PRESET_EVERY = 10000; // ms between automatic presets, so a typical rearrangement finishes


const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class SurfaceScene {
  w = 0;
  h = 0;
  s = 0; // cell size, px
  x0 = 0;
  y0 = 0;
  cols = 0;
  z = new Float32Array(0); // actuator heights, 0 (down) to 1 (up)
  balls: Ball[] = [];
  selected = 0;
  still = false;
  lastInput = -Infinity;
  lastPreset = -Infinity;
  nextPreset = 0;
  paths: Point[][] | null = null; // timed, one point per planned step; kept after arrival
  clock = 0; // planned steps elapsed
  replanAt = Infinity; // retry time when the last plan couldn't reach every target
  bumps = 0; // contacts between balls; the planner should keep this at 0
  off?: HTMLCanvasElement;

  get width() {
    return this.cols * this.s;
  }

  get height() {
    return ROWS * this.s;
  }

  get radius() {
    return this.s * 0.3;
  }

  // physical height of the actuators' full range, px
  get lift() {
    return this.s * 0.6;
  }

  resize(w: number, h: number) {
    const old = { x0: this.x0, y0: this.y0, w: this.width, h: this.height };
    this.w = w;
    this.h = h;
    this.s = (h - 2 * MARGIN) / ROWS;
    this.cols = Math.max(3, Math.floor((w - 2 * MARGIN) / this.s));
    this.x0 = (w - this.width) / 2;
    this.y0 = MARGIN;
    this.z = new Float32Array((this.cols + 1) * (ROWS + 1)).fill(0.5);
    if (!this.balls.length) {
      const start = [
        ['red', '#e1251b', 0.14, 0.3],
        ['blue', ACCENT, 0.52, 0.76],
        ['green', '#0a7f5a', 0.84, 0.28],
      ] as const;
      this.balls = start.map(([name, color, u, v]) => {
        const x = this.x0 + u * this.width;
        const y = this.y0 + v * this.height;
        return { name, color, x, y, vx: 0, vy: 0, tx: x, ty: y };
      });
    } else {
      const map = (x: number, y: number) => ({
        x: this.x0 + ((x - old.x0) / old.w) * this.width,
        y: this.y0 + ((y - old.y0) / old.h) * this.height,
      });
      for (const b of this.balls) {
        ({ x: b.x, y: b.y } = map(b.x, b.y));
        ({ x: b.tx, y: b.ty } = map(b.tx, b.ty));
      }
      if (this.paths) this.replan();
    }
  }

  inside(x: number, y: number) {
    const r = this.radius + 2;
    return {
      x: clamp(x, this.x0 + r, this.x0 + this.width - r),
      y: clamp(y, this.y0 + r, this.y0 + this.height - r),
    };
  }

  // Height and slope of the fabric at a point, interpolated between the four nearest actuators.
  sample(x: number, y: number) {
    const { s, cols, z } = this;
    const gx = clamp((x - this.x0) / s, 0, cols - 1e-6);
    const gy = clamp((y - this.y0) / s, 0, ROWS - 1e-6);
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const u = gx - i;
    const v = gy - j;
    const n = cols + 1;
    const z00 = z[j * n + i];
    const z10 = z[j * n + i + 1];
    const z01 = z[(j + 1) * n + i];
    const z11 = z[(j + 1) * n + i + 1];
    return {
      z: z00 * (1 - u) * (1 - v) + z10 * u * (1 - v) + z01 * (1 - u) * v + z11 * u * v,
      zx: ((z10 - z00) * (1 - v) + (z11 - z01) * v) / s,
      zy: ((z01 - z00) * (1 - u) + (z11 - z10) * u) / s,
      u,
      v,
    };
  }

  // A visitor's target for one ball, nudged away from the other balls' targets so they never have
  // to touch. Returns false (and leaves the target alone) if no clear spot is close by.
  setTarget(b: Ball, x: number, y: number) {
    let p = this.inside(x, y);
    const gap = CLEAR * this.s;
    const crowding = (q: { x: number; y: number }) =>
      this.balls.find((o) => o !== b && Math.hypot(o.tx - q.x, o.ty - q.y) < gap);
    for (let pass = 0; pass < 6; pass++) {
      const o = crowding(p);
      if (!o) break;
      const d = Math.hypot(p.x - o.tx, p.y - o.ty);
      const [ux, uy] = d > 1 ? [(p.x - o.tx) / d, (p.y - o.ty) / d] : [p.x < this.x0 + this.width / 2 ? 1 : -1, 0];
      p = this.inside(o.tx + ux * (gap + 1), o.ty + uy * (gap + 1));
    }
    if (crowding(p)) return false;
    b.tx = p.x;
    b.ty = p.y;
    return true;
  }

  // Targets for all the balls at once. Presets are laid out well apart, so no nudging is needed.
  setTargets(points: { x: number; y: number }[]) {
    this.balls.forEach((b, k) => ({ x: b.tx, y: b.ty } = this.inside(points[k].x, points[k].y)));
  }

  // Plan collision-free paths from where the balls are now to their targets.
  replan(now = 0) {
    const step = this.s / 2;
    const grid = { ox: this.x0 + step, oy: this.y0 + step, step, nx: 2 * this.cols - 1, ny: 2 * ROWS - 1 };
    const plan = planPaths(
      this.balls.map((b) => ({ x: b.x, y: b.y })),
      this.balls.map((b) => ({ x: b.tx, y: b.ty })),
      grid,
      CLEAR * this.s,
    );
    // With no plan at all, everyone holds still rather than heading for a target unplanned.
    this.paths = plan?.paths ?? this.balls.map((b) => [{ x: b.x, y: b.y }]);
    this.clock = 0;
    // When someone had to stop short, plan again once this plan has played out.
    const duration = Math.max(...this.paths.map((p) => p.length)) * TAU * 1000;
    this.replanAt = plan?.complete ? Infinity : now + Math.max(1000, duration);
  }

  // Where ball k should be now, and how fast that point is moving.
  reference(k: number, rate: number) {
    const b = this.balls[k];
    const path = this.paths?.[k];
    if (!path) return { x: b.tx, y: b.ty, vx: 0, vy: 0 };
    const i = Math.floor(this.clock);
    const f = this.clock - i;
    const a = path[Math.min(i, path.length - 1)];
    const c = path[Math.min(i + 1, path.length - 1)];
    const v = rate / TAU;
    return { x: a.x + (c.x - a.x) * f, y: a.y + (c.y - a.y) * f, vx: (c.x - a.x) * v, vy: (c.y - a.y) * v };
  }

  preset(name: Preset, now: number, byUser = true) {
    if (byUser) this.lastInput = now;
    this.lastPreset = now;
    const { x0, y0, width: W, height: H } = this;
    const [red, , green] = this.balls;
    if (name === 'line up') {
      this.setTargets([1, 2, 3].map((k) => ({ x: x0 + (k / 4) * W, y: y0 + H / 2 })));
    } else if (name === 'spread out') {
      this.setTargets([
        { x: x0 + 0.1 * W, y: y0 + 0.25 * H },
        { x: x0 + 0.5 * W, y: y0 + 0.78 * H },
        { x: x0 + 0.9 * W, y: y0 + 0.25 * H },
      ]);
    } else if (name === 'gather') {
      // just over the planner's clearance apart
      const d = (CLEAR * this.s) / Math.sqrt(3) + 2;
      this.setTargets(
        [0, 1, 2].map((k) => {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
          return { x: x0 + W / 2 + Math.cos(a) * d, y: y0 + H / 2 + Math.sin(a) * d };
        }),
      );
    } else {
      [red.tx, red.ty, green.tx, green.ty] = [green.tx, green.ty, red.tx, red.ty];
    }
    this.replan(now);
  }

  pointer(x: number, y: number, now: number) {
    this.lastInput = now;
    const hit = this.balls.findIndex((b) => Math.hypot(b.x - x, b.y - y) < this.radius * 1.7);
    if (hit >= 0) this.selected = hit;
    else if (this.setTarget(this.balls[this.selected], x, y)) this.replan(now);
  }

  // Keys 1–3 pick a ball; arrow keys move its target. Returns whether the key was used.
  key(key: string, now: number) {
    const k = '123'.indexOf(key);
    if (k >= 0) this.selected = k;
    else if (key.startsWith('Arrow')) {
      const b = this.balls[this.selected];
      const step = this.s * 0.5;
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
      if (this.setTarget(b, b.tx + dx, b.ty + dy)) this.replan(now);
    } else return false;
    this.lastInput = now;
    return true;
  }

  step(dt: number, now: number) {
    if (!this.w) return;
    if (!this.still && now - this.lastInput > IDLE_AFTER && now - this.lastPreset > PRESET_EVERY) {
      this.preset(PRESETS[this.nextPreset++ % PRESETS.length], now, false);
    }
    if (now >= this.replanAt) this.replan(now);

    // The plan's clock runs at full speed while every ball keeps up, slows as the slowest one
    // falls behind, and stops until it catches up.
    let rate = 0;
    if (this.paths) {
      const lag = Math.max(...this.balls.map((b, k) => {
        const r = this.reference(k, 0);
        return Math.hypot(r.x - b.x, r.y - b.y);
      }));
      rate = clamp((LAG_STOP - lag) / (LAG_STOP - LAG_OK), 0, 1);
      this.clock = Math.min(this.clock + (rate * dt) / TAU, Math.max(...this.paths.map((p) => p.length)));
    }

    const { s, cols, z, lift } = this;
    const n = cols + 1;

    // What each ball asks for: the acceleration that keeps it on its path, turned into a tilt.
    // Every actuator within REACH cells hears it and blends the requests, nearer balls first.
    const want = new Float32Array(z.length);
    const weight = new Float32Array(z.length);
    this.balls.forEach((b, k) => {
      const ref = this.reference(k, rate);
      let vx = ref.vx + KP * (ref.x - b.x);
      let vy = ref.vy + KP * (ref.y - b.y);
      // Safety layer: the plan keeps balls apart, but if a disturbance ever brings two within
      // SAFE px of touching, back away from each other.
      for (const o of this.balls) {
        if (o === b) continue;
        const ox = b.x - o.x;
        const oy = b.y - o.y;
        const d = Math.hypot(ox, oy) || 1;
        const near = 2 * this.radius + SAFE - d;
        if (near > 0) {
          vx += (ox / d) * near * 8;
          vy += (oy / d) * near * 8;
        }
      }
      const speed = Math.hypot(vx, vy);
      if (speed > VMAX) [vx, vy] = [(vx / speed) * VMAX, (vy / speed) * VMAX];
      let ax = KV * (vx - b.vx);
      let ay = KV * (vy - b.vy);
      const a = Math.hypot(ax, ay);
      if (a > AMAX) [ax, ay] = [(ax / a) * AMAX, (ay / a) * AMAX];
      const gx = -ax / GRAV; // fabric slope that produces that acceleration
      const gy = -ay / GRAV;
      const ci = (b.x - this.x0) / s;
      const cj = (b.y - this.y0) / s;
      for (let j = Math.max(0, Math.floor(cj - REACH)); j <= Math.min(ROWS, Math.ceil(cj + REACH)); j++) {
        for (let i = Math.max(0, Math.floor(ci - REACH)); i <= Math.min(cols, Math.ceil(ci + REACH)); i++) {
          const dx = this.x0 + i * s - b.x;
          const dy = this.y0 + j * s - b.y;
          const w = clamp(REACH - Math.hypot(dx, dy) / s, 0, 1) ** 6; // the nearest ball dominates
          if (!w) continue;
          want[j * n + i] += w * ((gx * dx + gy * dy) / lift);
          weight[j * n + i] += w;
        }
      }
    });
    for (let k = 0; k < z.length; k++) {
      const target = clamp(0.5 + (weight[k] ? want[k] / weight[k] : 0), 0.03, 0.97);
      const err = target - z[k];
      z[k] += Math.sign(err) * Math.min(Math.abs(err), RATE * dt);
    }

    // The balls roll down the fabric's slope.
    for (const b of this.balls) {
      const { zx, zy } = this.sample(b.x, b.y);
      b.vx += (-GRAV * lift * zx - FRICTION * b.vx) * dt;
      b.vy += (-GRAV * lift * zy - FRICTION * b.vy) * dt;
      const v = Math.hypot(b.vx, b.vy);
      if (v > VMAX * 1.5) [b.vx, b.vy] = [(b.vx / v) * VMAX * 1.5, (b.vy / v) * VMAX * 1.5];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    // Balls bump into each other and stay on the surface.
    const r = this.radius;
    for (let p = 0; p < this.balls.length; p++) {
      for (let q = p + 1; q < this.balls.length; q++) {
        const A = this.balls[p];
        const B = this.balls[q];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d >= 2 * r) continue;
        this.bumps++;
        const nx = dx / d;
        const ny = dy / d;
        const push = (2 * r - d) / 2;
        A.x -= nx * push;
        A.y -= ny * push;
        B.x += nx * push;
        B.y += ny * push;
        const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rel < 0) {
          const j = -0.75 * rel;
          A.vx -= nx * j;
          A.vy -= ny * j;
          B.vx += nx * j;
          B.vy += ny * j;
        }
      }
    }
    for (const b of this.balls) {
      const c = this.inside(b.x, b.y);
      if (c.x !== b.x) b.vx *= -0.4;
      if (c.y !== b.y) b.vy *= -0.4;
      b.x = c.x;
      b.y = c.y;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, h, s, x0, y0, cols, lift } = this;
    const W = this.width;
    const H = this.height;
    ctx.clearRect(0, 0, w, h);

    // Fabric, shaded by height and slope at half resolution. A slight sag between actuators
    // is added for looks only.
    const sw = Math.ceil(W / 2);
    const sh = Math.ceil(H / 2);
    if (!this.off) this.off = document.createElement('canvas');
    const off = this.off;
    if (off.width !== sw || off.height !== sh) {
      off.width = sw;
      off.height = sh;
    }
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(sw, sh);
    const SAG = 0.07;
    for (let py = 0; py < sh; py++) {
      for (let px = 0; px < sw; px++) {
        const p = this.sample(x0 + (px + 0.5) * 2, y0 + (py + 0.5) * 2);
        const su = Math.sin(Math.PI * p.u);
        const sv = Math.sin(Math.PI * p.v);
        const zz = p.z - SAG * su * sv;
        const hx = lift * (p.zx - (SAG * Math.PI * Math.cos(Math.PI * p.u) * sv) / s);
        const hy = lift * (p.zy - (SAG * Math.PI * su * Math.cos(Math.PI * p.v)) / s);
        const b = clamp(0.9 + 0.75 * (0.55 * hx + 0.65 * hy) + 0.22 * (zz - 0.5), 0.55, 1.08);
        const k = (py * sw + px) * 4;
        img.data[k] = Math.min(255, 238 * b);
        img.data[k + 1] = Math.min(255, 237 * b);
        img.data[k + 2] = Math.min(255, 232 * b);
        img.data[k + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, x0, y0, W, H);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, W - 1, H - 1);

    // Actuators: darker and bigger the higher they push.
    for (let j = 0; j <= ROWS; j++) {
      for (let i = 0; i <= cols; i++) {
        const zk = this.z[j * (cols + 1) + i];
        ctx.fillStyle = `rgba(10,10,10,${(0.12 + 0.4 * zk).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x0 + i * s, y0 + j * s, 1.5 + 2.5 * zk, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Targets, and the rest of each ball's planned path as a dashed line.
    const r = this.radius;
    this.balls.forEach((b, k) => {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.5;
      const path = this.paths?.[k];
      if (path && Math.hypot(b.tx - b.x, b.ty - b.y) > r) {
        ctx.globalAlpha = 0.6;
        ctx.lineJoin = 'round';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        for (let i = Math.floor(this.clock) + 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(b.tx, b.ty, r * 0.75, 0, Math.PI * 2);
      ctx.moveTo(b.tx - r * 1.2, b.ty);
      ctx.lineTo(b.tx + r * 1.2, b.ty);
      ctx.moveTo(b.tx, b.ty - r * 1.2);
      ctx.lineTo(b.tx, b.ty + r * 1.2);
      ctx.stroke();
    });

    // Balls, with a soft shadow; the selected one gets a ring.
    this.balls.forEach((b, k) => {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(b.x + 2, b.y + 3, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      if (k === this.selected) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }
}
