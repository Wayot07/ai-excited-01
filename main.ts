// ai-excited-01 — "The Moment Before It Bursts"
// A tiny figure stands on a cliff edge before a colossal ring of light tearing
// open in a dark sky. Everything rushes toward the ring: streaks of light,
// radial beams, arcs of energy. One look should hit with scale, awe and motion.
// Drawn entirely in code, pixel by pixel, with a fixed seed — no assets, no
// network, no randomness. Running it twice produces byte-identical output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only (node:fs, node:path, node:zlib).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Deterministic random numbers (mulberry32, fixed seed). No Math.random,
// no timestamps anywhere, so both grader runs are byte-identical.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261116);

// ---------------------------------------------------------------------------
// Pixel buffer (linear float RGB) and additive drawing helpers.
// ---------------------------------------------------------------------------
const R = new Float32Array(W * H);
const G = new Float32Array(W * H);
const B = new Float32Array(W * H);

function addPx(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  R[i] += r;
  G[i] += g;
  B[i] += b;
}

function setPx(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  R[i] = r;
  G[i] = g;
  B[i] = b;
}

// Soft round glow spot: intensity falls off as a Gaussian with radius `rad`.
function glow(x0, y0, rad, r, g, b, strength) {
  const xMin = Math.max(0, Math.floor(x0 - rad * 3));
  const xMax = Math.min(W - 1, Math.ceil(x0 + rad * 3));
  const yMin = Math.max(0, Math.floor(y0 - rad * 3));
  const yMax = Math.min(H - 1, Math.ceil(y0 + rad * 3));
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const dx = x - x0;
      const dy = y - y0;
      const d2 = (dx * dx + dy * dy) / (rad * rad);
      if (d2 > 9) continue;
      const s = strength * Math.exp(-d2);
      addPx(x, y, r * s, g * s, b * s);
    }
  }
}

// Bright line segment with a soft halo, drawn additively.
function beam(x0, y0, x1, y1, width, r, g, b, strength) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const steps = Math.ceil(len);
  const reach = width * 3;
  for (let s = 0; s <= steps; s++) {
    const cx = x0 + ux * s;
    const cy = y0 + uy * s;
    const xMin = Math.max(0, Math.floor(cx - reach));
    const xMax = Math.min(W - 1, Math.ceil(cx + reach));
    const yMin = Math.max(0, Math.floor(cy - reach));
    const yMax = Math.min(H - 1, Math.ceil(cy + reach));
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const px = x - cx;
        const py = y - cy;
        // Perpendicular distance from the line.
        const perp = Math.abs(px * uy - py * ux);
        if (perp > reach) continue;
        const fall = Math.exp(-(perp * perp) / (width * width));
        addPx(x, y, r * strength * fall, g * strength * fall, b * strength * fall);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Scene constants: the ring is the hero. Centre high in the frame, huge,
// so it reads even at 300 px across; the figure is deliberately tiny.
// ---------------------------------------------------------------------------
const CX = 512;
const CY = 395;
const RING_R = 262;

// Nebula blobs: dim violet/teal clouds that give the dark sky depth.
const nebulae = [];
for (let i = 0; i < 5; i++) {
  nebulae.push({
    x: 120 + rand() * 784,
    y: 60 + rand() * 620,
    rad: 150 + rand() * 220,
    r: 0.10 + rand() * 0.10,
    g: 0.05 + rand() * 0.06,
    b: 0.22 + rand() * 0.14,
  });
}

// Twelve radial beams fanning out of the ring, uneven widths and strengths.
const beamAngles = [];
for (let i = 0; i < 12; i++) {
  beamAngles.push({
    a: (i / 12) * Math.PI * 2 + (rand() - 0.5) * 0.35,
    w: 0.05 + rand() * 0.10,
    s: 0.25 + rand() * 0.45,
  });
}

// ---------------------------------------------------------------------------
// Pass 1: the analytic sky — gradient, nebulae, the ring and its glow,
// the radial beams, the blazing heart at the ring's centre.
// ---------------------------------------------------------------------------
for (let y = 0; y < H; y++) {
  const t = y / H;
  // Deep night gradient: near-black violet at the top, faint indigo low down.
  const skyR = 4 + 10 * t * t;
  const skyG = 5 + 12 * t * t;
  const skyB = 16 + 26 * t * t;
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let r = skyR;
    let g = skyG;
    let b = skyB;

    for (const n of nebulae) {
      const dx = x - n.x;
      const dy = y - n.y;
      const d2 = (dx * dx + dy * dy) / (n.rad * n.rad);
      if (d2 < 4) {
        const s = Math.exp(-d2) * 0.55;
        r += n.r * s * 255 * 0.12;
        g += n.g * s * 255 * 0.12;
        b += n.b * s * 255 * 0.12;
      }
    }

    const dx = x - CX;
    const dy = y - CY;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);

    // The ring: a white-hot core, a gold band, a wide magenta-orange halo.
    const dRing = dist - RING_R;
    const wobble = 1 + 0.12 * Math.sin(ang * 3 + 0.8);
    const core = Math.exp(-(dRing * dRing) / (13 * 13)) * wobble;
    const band = Math.exp(-(dRing * dRing) / (46 * 46)) * wobble;
    const halo = Math.exp(-(dRing * dRing) / (150 * 150));
    r += core * 255 + band * 235 + halo * 150;
    g += core * 245 + band * 165 + halo * 55;
    b += core * 210 + band * 45 + halo * 110;

    // Faint luminous fill inside the ring, brighter toward its inner edge.
    if (dist < RING_R - 24) {
      const inner = Math.exp(-(((RING_R - 24 - dist) / 90) ** 2)) * 0.35;
      r += inner * 90;
      g += inner * 55;
      b += inner * 120;
    }

    // Radial beams streaming outward from the ring.
    if (dist > RING_R) {
      let beamSum = 0;
      for (const bm of beamAngles) {
        let da = ang - bm.a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        beamSum += bm.s * Math.exp(-(da * da) / (bm.w * bm.w));
      }
      const fall = Math.exp(-(dist - RING_R) / 260);
      r += beamSum * fall * 150;
      g += beamSum * fall * 95;
      b += beamSum * fall * 35;
    }

    // The blazing heart: a point of light at the centre, about to burst,
    // with horizontal and vertical diffraction spikes.
    const heart = 1 / (1 + (dist * dist) / 90);
    r += heart * 255;
    g += heart * 235;
    b += heart * 190;
    const spike = Math.max(0, 1 - Math.abs(dy) / 3) * Math.exp(-dist / 260)
      + Math.max(0, 1 - Math.abs(dx) / 3) * Math.exp(-dist / 260);
    r += spike * 120;
    g += spike * 100;
    b += spike * 60;

    R[i] = r;
    G[i] = g;
    B[i] = b;
  }
}

// ---------------------------------------------------------------------------
// Pass 2: stars, light streaks rushing into the ring, energy arcs,
// the cliff and the tiny figure.
// ---------------------------------------------------------------------------

// Stars: mostly faint, a dozen bright ones with cross sparkles.
for (let i = 0; i < 420; i++) {
  const x = Math.floor(rand() * W);
  const y = Math.floor(rand() * 760);
  const dx = x - CX;
  const dy = y - CY;
  if (Math.hypot(dx, dy) < RING_R - 40) continue; // keep the ring's disc clean
  const bright = rand();
  const s = bright < 0.03 ? 200 + rand() * 55 : 25 + rand() * 90;
  const tint = rand();
  const r = s;
  const g = s * (0.85 + tint * 0.15);
  const b = s * (0.9 + (1 - tint) * 0.1);
  addPx(x, y, r, g, b);
  if (bright < 0.03) {
    // Cross sparkle on the brightest stars.
    for (let k = 1; k <= 5; k++) {
      const f = 0.5 - k * 0.08;
      addPx(x + k, y, r * f, g * f, b * f);
      addPx(x - k, y, r * f, g * f, b * f);
      addPx(x, y + k, r * f, g * f, b * f);
      addPx(x, y - k, r * f, g * f, b * f);
    }
  }
}

// Streaks of light flying inward toward the ring — the momentum of the scene.
// Each streak points radially at the centre and fades along its length.
for (let i = 0; i < 150; i++) {
  const a = rand() * Math.PI * 2;
  const r0 = RING_R + 30 + rand() * 260;
  const len = 18 + rand() * 55;
  const x0 = CX + Math.cos(a) * r0;
  const y0 = CY + Math.sin(a) * r0;
  const x1 = CX + Math.cos(a) * (r0 - len);
  const y1 = CY + Math.sin(a) * (r0 - len);
  const s = 0.35 + rand() * 0.6;
  const warm = rand() < 0.6;
  beam(x0, y0, x1, y1, 1.1, warm ? 255 * s : 170 * s, warm ? 190 * s : 220 * s, warm ? 90 * s : 255 * s, 1);
}

// Energy arcs: jagged lightning forking from the ring's inner edge inward.
for (let a = 0; a < 4; a++) {
  const startA = rand() * Math.PI * 2;
  let x = CX + Math.cos(startA) * (RING_R - 20);
  let y = CY + Math.sin(startA) * (RING_R - 20);
  const steps = 7 + Math.floor(rand() * 4);
  for (let s = 0; s < steps; s++) {
    const toward = Math.atan2(CY - y, CX - x) + (rand() - 0.5) * 1.1;
    const stepLen = 22 + rand() * 26;
    const nx = x + Math.cos(toward) * stepLen;
    const ny = y + Math.sin(toward) * stepLen;
    beam(x, y, nx, ny, 1.6, 190, 235, 255, 0.9);
    x = nx;
    y = ny;
    if (Math.hypot(x - CX, y - CY) < 60) break;
  }
}

// The cliff: a jagged black ridge along the bottom, rim-lit gold on its crest
// by the ring above. The ridge height is a fixed seeded function of x.
const ridge = new Float32Array(W);
for (let x = 0; x < W; x++) {
  // Smooth rolling ridge: sines only, no per-column jitter (that read as
  // static along the horizon).
  ridge[x] = 872
    + 26 * Math.sin(x * 0.011 + 1.7)
    + 14 * Math.sin(x * 0.031 + 0.4)
    + 10 * Math.sin(x * 0.007 + 2.3);
}
for (let x = 0; x < W; x++) {
  const top = Math.floor(ridge[x]);
  for (let y = top; y < H; y++) {
    const depth = (y - top) / (H - top);
    // Near-black rock, faint violet, darker with depth.
    setPx(x, y, 5 + 4 * (1 - depth), 5 + 3 * (1 - depth), 10 + 6 * (1 - depth));
  }
  // Gold rim light on the crest.
  const rim = 0.55 + 0.45 * Math.sin(x * 0.05);
  for (let k = 0; k < 3; k++) {
    addPx(x, top + k, 150 * rim * (1 - k / 3), 95 * rim * (1 - k / 3), 30 * rim * (1 - k / 3));
  }
}

// A lone pinnacle of rock rising from the ridge, dead centre under the ring.
const pinX = 512;
for (let y = 812; y < 905; y++) {
  const half = 4 + ((y - 812) / 93) * 16;
  for (let x = Math.floor(pinX - half); x <= Math.ceil(pinX + half); x++) {
    setPx(x, y, 6, 6, 12);
  }
  addPx(Math.floor(pinX - half), y, 120, 80, 25);
}

// Line segment that OVERWRITES pixels (for the dark silhouette — the
// additive beam() helper would add near-black and stay invisible).
function lineSet(x0, y0, x1, y1, half, r, g, b) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(len * 2);
  for (let s = 0; s <= steps; s++) {
    const cx = x0 + (dx * s) / steps;
    const cy = y0 + (dy * s) / steps;
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        if (ox * ox + oy * oy <= half * half + 1) setPx(Math.round(cx + ox), Math.round(cy + oy), r, g, b);
      }
    }
  }
}

// The tiny figure on the pinnacle: dark silhouette, one arm raised toward
// the ring, a hair of gold rim light on the side facing it. ~55 px tall —
// small against the ring, but big enough to read. A faint halo behind it
// lifts the silhouette off the dark sky.
const fig = (x, y, r, g, b) => setPx(Math.round(x), Math.round(y), r, g, b);
const SIL = [3, 3, 6]; // near-black silhouette
glow(pinX, 772, 26, 255, 190, 90, 0.22);
// Head.
for (let dy = -6; dy <= 6; dy++) {
  for (let dx = -6; dx <= 6; dx++) {
    if (dx * dx + dy * dy <= 36) fig(pinX + dx, 730 + dy, ...SIL);
  }
}
// Raised arm reaching up toward the ring.
lineSet(pinX + 3, 744, pinX + 19, 710, 2, ...SIL);
// Body and legs.
lineSet(pinX, 742, pinX - 1, 774, 3, ...SIL);
lineSet(pinX - 1, 774, pinX - 9, 810, 2, ...SIL);
lineSet(pinX - 1, 774, pinX + 8, 810, 2, ...SIL);
// Gold rim light on the figure's upper edge, from the ring's glow.
fig(pinX - 5, 725, 255, 200, 90);
fig(pinX - 2, 724, 255, 210, 110);
fig(pinX + 2, 724, 255, 200, 90);
fig(pinX + 17, 713, 255, 190, 80);
fig(pinX + 19, 711, 255, 190, 80);
// A small pool of light at the figure's feet.
glow(pinX, 811, 16, 255, 180, 70, 0.35);

// Pass 3: vignette (darken the corners so the eye stays on the ring).
// No per-pixel grain: it would defeat PNG compression and push the file
// over the 1 MiB cap; the smooth gradients compress far better without it.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const nx = (x - W / 2) / (W / 2);
    const ny = (y - H / 2) / (H / 2);
    const v = Math.max(0, nx * nx + ny * ny - 0.55) * 0.35;
    const f = 1 - Math.min(0.55, v);
    R[i] *= f;
    G[i] *= f;
    B[i] *= f;
  }
}

// ---------------------------------------------------------------------------
// PNG encoder: raw scanlines (filter 0), zlib deflate, CRC32. No libraries.
// ---------------------------------------------------------------------------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    crc32.table = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = y * (1 + W * 3) + 1 + x * 3;
      raw[o] = Math.max(0, Math.min(255, Math.round(R[i])));
      raw[o + 1] = Math.max(0, Math.min(255, Math.round(G[i])));
      raw[o + 2] = Math.max(0, Math.min(255, Math.round(B[i])));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePng());
