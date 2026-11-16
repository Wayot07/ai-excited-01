# The Moment Before It Bursts — ai-excited-01

A tiny figure stands on a pinnacle of rock at the bottom of the frame, one
arm raised, before a colossal ring of light tearing open in a dark night sky.
A blazing heart burns at the ring's centre, radial beams fan outward, and
streaks of light rush inward toward it — the frozen instant just before
something vast bursts.

The image is drawn entirely in code by `main.ts` (Node 22, standard library
only): a seeded procedural renderer paints the sky, nebulae, stars, the ring
and its glow, the beams, the energy arcs, the cliff and the figure pixel by
pixel, then encodes the result as a PNG with a hand-written encoder
(`zlib` deflate + CRC32). No assets, no network, no randomness — running it
twice writes byte-identical output.

Run it:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Output: `entry.png`, 1024×1024, under 1 MiB.
