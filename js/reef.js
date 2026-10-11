/* Fish Friends — the reef: everything in the tank that isn't a creature.

   Built to sit behind the fish in the same flat, saturated, inked language:
   clear turquoise water lit from above, two hazy layers of reef far off, then
   a planted floor of seagrass, kelp, sea lettuce, red sea whips, anemones,
   corals and rocks on warm sand. Distance is done the way an illustrator does
   it — further things are paler, bluer, and lose their ink.

   Layers, back to front:
     baked   bg     water, sun glow, two far reef silhouettes
     live    surface ripples, distant shoals, mid planting (hazed)
     baked   floor  sand, rocks, corals, sea fans, pebbles, shells
     live    caustics, light shafts
             … scenery creatures (aquarium.js) …
     live    front planting, inked, full colour
             … friends and you …
     live    bubbles, specks, vignette, grain

   Layout is seeded, so moving a colour dial rebakes the same reef rather than
   reshuffling it. Only the density dials change what is planted. */

const Reef = (() => {
  const v = Look.v;
  let W = 0, H = 0, FY = 0, DPR = 1;
  let bg = null, floor = null;
  let C = {};
  let far = [], mid = [], front = [], baked = [], streams = [], shoals = [], bubbles = [], motes = [];

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const T = () => (typeof frameCount !== 'undefined' ? frameCount : 0);

  /* ------------------------------------------------------------ palette */

  function palette() {
    const d = v.waterDepth;
    const three = (a, b, c) => d < 0.45 ? Col.mix(a, b, d / 0.45) : Col.mix(b, c, (d - 0.45) / 0.55);
    const water = c => Col.hex(Col.adjust(c, v.waterHue, v.waterSat / 0.8, 0));
    C.top  = water(three('#8BE6E6', '#3FCAD6', '#167FA4'));
    C.mid  = water(three('#3FC2CF', '#139DB6', '#0A537B'));
    C.deep = water(three('#2093AE', '#0B6A8E', '#062B52'));
    C.haze = Col.hex(Col.mix(C.mid, C.top, 0.45));
    Paint.setWater(C.mid);

    const plant = c => Col.hex(Col.adjust(c, v.plantHue, v.plantVivid, 0));
    C.greens  = ['#22AE4C', '#12863F', '#7DCF2A', '#18B37E'].map(plant);
    C.kelp    = ['#A3AA16', '#D39A16', '#7A9418'].map(plant);
    C.lettuce = ['#8EDB2E', '#4CC23A'].map(plant);
    C.reds    = ['#F2432A', '#FF6A3A', '#EC2F6E'].map(plant);
    C.coral   = ['#FF7A36', '#FF8DBA', '#FFC93A', '#B583FF'].map(plant);
    C.anem    = ['#FF6FB2', '#B583FF', '#FF8A3A'].map(plant);
    C.rocks   = ['#5E74A8', '#7F8BC0', '#C88C55', '#4F8D9E'];
    const sand = Col.mix('#F6C96E', C.mid, (1 - v.sand) * 0.55);
    C.sand    = Col.hex(sand);
    C.sandDk  = Col.hex(Col.mix(sand, '#B5622A', 0.22 + 0.1 * v.sand));
    C.sandLt  = Col.hex(Col.mix(sand, '#FFF4D2', 0.45));
    C.ink     = Paint.INK;
  }

  /* toward the water with distance — and the haze dial */
  function hz(col, depth) {
    return Col.hex(Col.mix(col, C.haze, clamp(depth * (0.3 + 0.7 * v.haze), 0, 0.96)));
  }
  const darker = (c, k = 0.3) => Col.hex(Col.mix(c, '#0B2E2A', k));
  const lighter = (c, k = 0.4) => Col.hex(Col.mix(c, '#F4FFD8', k));
  const lineW = () => Math.max(0.8, Math.min(W, H) * 0.0026) * v.ink;

  /* ----------------------------------------------------------- layout */

  function build(w, h, floorY) {
    W = w; H = h; FY = floorY;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    palette();
    layout();
    bake();
  }

  function layout() {
    const r = Paint.rng(4242);
    const short = Math.min(W, H);
    /* plant heights: off the screen height, but capped by the width so a tall
       phone doesn't grow a forest up to the middle of the tank */
    const PH = Math.min(H, W * 0.85);
    const dens = 0.25 + v.plants;
    const red = v.redPlants;

    // far reef: rocky ridges with clumps of grass and kelp on them, baked
    far = [];
    for (let layer = 0; layer < 2; layer++) {
      const depth = layer ? 0.62 : 0.86;
      const base = FY - H * (layer ? 0.035 : 0.075);
      const n = Math.round(W / short * (layer ? 7 : 9) * dens);
      for (let i = 0; i < n; i++) {
        const x = r() * W;
        const kind = r();
        far.push({ layer, depth, x, base: base + r() * H * 0.02,
                   kind: kind < 0.45 ? 'grass' : kind < 0.7 ? 'kelp' : kind < 0.88 ? 'bush' : 'fan',
                   h: PH * (0.10 + r() * (layer ? 0.22 : 0.18)), w: short * (0.03 + r() * 0.05),
                   col: Math.floor(r() * 4), seed: r() * 100 });
      }
    }

    /* mid: hazed seagrass and kelp, swaying, behind the scenery fish */
    mid = [];
    const nMid = Math.round(W / short * 5 * dens);
    for (let i = 0; i < nMid; i++) {
      const k = r();
      mid.push({ x: (i + 0.2 + r() * 0.6) / nMid * W, base: FY + H * 0.01,
                 kind: k < 0.55 ? 'grass' : 'kelp', h: PH * (0.22 + r() * 0.30),
                 w: short * (0.012 + r() * 0.012), n: 3 + Math.floor(r() * 4),
                 col: Math.floor(r() * 4), phase: r() * 6.28, depth: 0.38 });
    }

    /* front: tall things at the sides, low things in the middle, so the fish
       always have open water */
    front = [];
    const nFront = Math.round(W / short * 6.5 * dens);
    for (let i = 0; i < nFront; i++) {
      const x = (i + 0.15 + r() * 0.7) / nFront * W;
      const edge = Math.min(x, W - x) / W;            // 0 at the sides, .5 centre
      const tall = edge < 0.2;
      let kind;
      const k = r();
      if (tall) kind = k < 0.45 ? 'grass' : k < 0.75 ? 'kelp' : (k < 0.75 + 0.25 * red ? 'whip' : 'lettuce');
      else kind = k < 0.35 ? 'grass' : k < 0.6 ? 'lettuce' : (k < 0.6 + 0.4 * red ? 'whip' : 'anemone');
      const hMul = tall ? 1 : 0.55;
      front.push({ x, base: FY + H * (0.04 + r() * 0.05), kind,
                   h: PH * (kind === 'kelp' ? 0.42 + r() * 0.2 : kind === 'anemone' ? 0.07 + r() * 0.03 :
                           kind === 'lettuce' ? 0.10 + r() * 0.06 : 0.18 + r() * 0.16) * (kind === 'anemone' ? 1 : hMul),
                   w: short * (kind === 'grass' ? 0.016 + r() * 0.01 : kind === 'kelp' ? 0.035 + r() * 0.015 : 0.05 + r() * 0.03),
                   n: 4 + Math.floor(r() * 4), col: Math.floor(r() * 4), phase: r() * 6.28, seed: r() * 1000 });
    }
    /* anemones a little in front of the rest */
    front.sort((a, b) => a.base - b.base);

    /* baked on the floor: rocks, corals, fans, a few shells */
    baked = [];
    const nRock = Math.round(W / short * 3 * dens) + 2;
    for (let i = 0; i < nRock; i++) {
      baked.push({ kind: 'rock', x: r() * W, y: FY + H * (0.02 + r() * 0.08),
                   s: short * (0.05 + r() * 0.07), col: Math.floor(r() * 4), seed: r() * 100 });
    }
    const nCoral = Math.round(W / short * 2.6 * dens);
    for (let i = 0; i < nCoral; i++) {
      const k = r();
      baked.push({ kind: k < 0.45 ? 'coral' : k < 0.75 ? 'brain' : 'fan',
                   x: r() * W, y: FY + H * (0.03 + r() * 0.07), s: short * (0.06 + r() * 0.06),
                   col: Math.floor(r() * 4), seed: Math.floor(r() * 10000) });
    }
    for (let i = 0; i < Math.round(W / short * 2); i++) {
      baked.push({ kind: r() < 0.5 ? 'shell' : 'star', x: r() * W, y: FY + H * (0.07 + r() * 0.07),
                   s: short * (0.015 + r() * 0.012), col: Math.floor(r() * 4), seed: r() * 100 });
    }
    baked.sort((a, b) => a.y - b.y);

    // two bubble streams, rising from behind rocks
    const rocks = baked.filter(b => b.kind === 'rock');
    streams = [0, 1].map(i => {
      const rk = rocks[Math.floor(r() * rocks.length)];
      return { x: rk ? rk.x : W * (0.3 + i * 0.4), y: rk ? rk.y - rk.s * 0.4 : FY, acc: 0 };
    });

    // distant shoals
    shoals = [];
    for (let i = 0; i < 3; i++) {
      const n = 9 + Math.floor(r() * 10);
      const fish = [];
      for (let k = 0; k < n; k++) fish.push({ dx: (r() - 0.5) * 2, dy: (r() - 0.5) * 2, ph: r() * 6.28 });
      shoals.push({ x: r() * W, y: H * (0.18 + r() * 0.45), dir: r() < 0.5 ? 1 : -1,
                    sp: 0.25 + r() * 0.3, size: short * (0.012 + r() * 0.008) * (1 + i * 0.25),
                    spread: short * (0.07 + r() * 0.05), depth: 0.9 - i * 0.12, fish, ph: r() * 6.28 });
    }

    bubbles = [];
    motes = [];
    for (let i = 0; i < 140; i++) {
      motes.push({ x: r() * W, y: r() * H, z: r(), ph: r() * 6.28, keep: r() });
    }
  }

  /* -------------------------------------------------------------- bake */

  function canvas() {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(W * DPR));
    c.height = Math.max(1, Math.ceil(H * DPR));
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    return [c, g];
  }

  function bake() {
    palette();
    let g;
    [bg, g] = canvas();

    // water: bright at the surface, deep toward the floor
    const lin = g.createLinearGradient(0, 0, 0, FY);
    lin.addColorStop(0, C.top);
    lin.addColorStop(0.45, C.mid);
    lin.addColorStop(1, C.deep);
    g.fillStyle = lin;
    g.fillRect(0, 0, W, H);

    // the sun, a soft pool at the surface
    const sun = g.createRadialGradient(W * 0.62, -H * 0.08, 0, W * 0.62, -H * 0.08, H * 0.75);
    sun.addColorStop(0, Col.rgba('#FFFBE0', 0.55));
    sun.addColorStop(0.35, Col.rgba(C.top, 0.25));
    sun.addColorStop(1, Col.rgba(C.top, 0));
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);

    // far reef, two layers, each paler than the one in front of it
    for (let layer = 0; layer < 2; layer++) {
      const depth = layer ? 0.62 : 0.86;
      const base = FY - H * (layer ? 0.03 : 0.07);
      ridge(g, base, H * (layer ? 0.07 : 0.11), layer ? 0.0045 : 0.0032, layer * 7 + 1,
            hz(C.rocks[layer ? 3 : 0], depth));
      for (const p of far) if (p.layer === layer) farPlant(g, p);
      // a band of haze settling at its foot
      const hzg = g.createLinearGradient(0, base - H * 0.18, 0, FY + H * 0.02);
      hzg.addColorStop(0, Col.rgba(C.haze, 0));
      hzg.addColorStop(1, Col.rgba(C.haze, 0.35 * v.haze));
      g.fillStyle = hzg;
      g.fillRect(0, base - H * 0.18, W, H * 0.25);
    }

    // the floor layer: sand and everything that never moves
    [floor, g] = canvas();
    sand(g);
    for (const b of baked) {
      if (b.kind === 'rock') rock(g, b);
      else if (b.kind === 'coral') coral(g, b);
      else if (b.kind === 'brain') brain(g, b);
      else if (b.kind === 'fan') seaFan(g, b);
      else if (b.kind === 'shell') shell(g, b);
      else if (b.kind === 'star') tinyStar(g, b);
    }
  }

  function ridge(g, base, amp, freq, seed, col) {
    g.beginPath();
    g.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 10) {
      const y = base
        - (Math.sin(x * freq + seed) * 0.5 + 0.5) * amp
        - (Math.sin(x * freq * 2.3 + seed * 2) * 0.5 + 0.5) * amp * 0.4
        - Math.pow(Math.max(0, Math.sin(x * freq * 0.7 + seed * 3)), 4) * amp * 0.9;
      g.lineTo(x, y);
    }
    g.lineTo(W + 10, H + 10);
    g.closePath();
    g.fillStyle = col;
    g.fill();
  }

  function farPlant(g, p) {
    const pal = p.kind === 'kelp' ? C.kelp : p.kind === 'fan' ? C.coral : C.greens;
    const col = hz(pal[p.col % pal.length], p.depth);
    const r = Paint.rng(Math.floor(p.seed * 100));
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineCap = 'round';
    if (p.kind === 'bush') {
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(p.x + (r() - 0.5) * p.w * 2, p.base - r() * p.w * 0.9, p.w * (0.5 + r() * 0.5), 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    if (p.kind === 'fan') {
      g.lineWidth = Math.max(1, p.w * 0.12);
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.16;
        g.beginPath();
        g.moveTo(p.x, p.base);
        g.quadraticCurveTo(p.x + Math.cos(a) * p.h * 0.3, p.base + Math.sin(a) * p.h * 0.5,
                           p.x + Math.cos(a) * p.h * 0.55, p.base + Math.sin(a) * p.h * 0.75);
        g.stroke();
      }
      return;
    }
    const n = p.kind === 'kelp' ? 2 : 5;
    for (let i = 0; i < n; i++) {
      const tilt = (r() - 0.5) * 0.5;
      const hh = p.h * (0.6 + r() * 0.4);
      blade(g, p.x + (i - n / 2) * p.w * 0.3, p.base, hh,
            p.kind === 'kelp' ? p.w * 0.6 : p.w * 0.22, tilt, (r() - 0.5) * 0.5, col, null, null, p.depth);
    }
  }

  /* --------------------------------------------------------- the floor */

  function sandEdge(x) {
    return FY + Math.sin(x * 0.006 + 1.3) * H * 0.008 + Math.sin(x * 0.017) * H * 0.004;
  }

  function sand(g) {
    const r = Paint.rng(77);
    g.beginPath();
    g.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 8) g.lineTo(x, sandEdge(x));
    g.lineTo(W + 10, H + 10);
    g.closePath();
    const lin = g.createLinearGradient(0, FY - H * 0.02, 0, H);
    lin.addColorStop(0, hz(C.sand, 0.55));
    lin.addColorStop(0.18, hz(C.sand, 0.2));
    lin.addColorStop(1, C.sand);
    g.fillStyle = lin;
    g.fill();
    g.save();
    g.clip();
    // ripple marks
    g.lineCap = 'round';
    for (let i = 0; i < Math.round(W / 16); i++) {
      const x = r() * W, y = FY + H * 0.02 + r() * (H - FY);
      const len = 14 + r() * 40;
      const near = (y - FY) / (H - FY);
      g.strokeStyle = Col.rgba(C.sandDk, 0.25 + 0.35 * near);
      g.lineWidth = 1 + near * 1.5;
      g.beginPath();
      g.moveTo(x - len / 2, y);
      g.quadraticCurveTo(x, y - 3 - r() * 3, x + len / 2, y);
      g.stroke();
      g.strokeStyle = Col.rgba(C.sandLt, 0.35 + 0.3 * near);
      g.beginPath();
      g.moveTo(x - len / 2, y - 2.5);
      g.quadraticCurveTo(x, y - 6 - r() * 3, x + len / 2, y - 2.5);
      g.stroke();
    }
    // speckle
    for (let i = 0; i < W * (H - FY) / 70; i++) {
      g.fillStyle = r() < 0.5 ? Col.rgba(C.sandDk, 0.35) : Col.rgba(C.sandLt, 0.5);
      g.fillRect(r() * W, FY + r() * (H - FY), 1.2 + r() * 1.5, 1.2 + r() * 1.5);
    }
    // pebbles
    const pebbleCols = [C.rocks[0], C.rocks[2], '#F4E6CF', C.rocks[3], '#E3734A'];
    for (let i = 0; i < Math.round(W / 26); i++) {
      const x = r() * W, y = FY + H * 0.03 + Math.pow(r(), 0.8) * (H - FY);
      const near = (y - FY) / (H - FY);
      const s = (2 + r() * 5) * (0.6 + near);
      const col = hz(pebbleCols[i % pebbleCols.length], 0.5 * (1 - near));
      g.beginPath();
      g.ellipse(x, y, s, s * 0.7, r() * 0.6 - 0.3, 0, Math.PI * 2);
      g.fillStyle = col;
      g.fill();
      if (v.ink > 0.01 && near > 0.3) {
        g.strokeStyle = Col.rgba(C.ink, 0.8 * near);
        g.lineWidth = lineW() * 0.6;
        g.stroke();
      }
      g.fillStyle = Col.rgba('#FFFFFF', 0.5);
      g.beginPath(); g.ellipse(x - s * 0.3, y - s * 0.25, s * 0.3, s * 0.15, -0.3, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // the far edge of the sand, softly inked
    g.beginPath();
    for (let x = -10; x <= W + 10; x += 8) x === -10 ? g.moveTo(x, sandEdge(x)) : g.lineTo(x, sandEdge(x));
    g.strokeStyle = Col.rgba(hz(C.ink, 0.6), 0.5);
    g.lineWidth = lineW() * 0.8;
    if (v.ink > 0.01) g.stroke();
  }

  /* depth of a floor item, 0 at the front of the sand, ~0.5 at the back */
  const floorDepth = y => clamp(0.55 * (1 - (y - FY) / (H * 0.12)), 0, 0.55);

  function inkOn(g, mul, depth) {
    if (v.ink < 0.01) return false;
    g.strokeStyle = hz(C.ink, depth * 0.9);
    g.lineWidth = lineW() * mul;
    g.lineJoin = g.lineCap = 'round';
    return true;
  }

  function rock(g, b) {
    const r = Paint.rng(Math.floor(b.seed * 1000));
    const d = floorDepth(b.y);
    const col = hz(C.rocks[b.col], d + 0.12);
    const pts = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;           // the top half
      const rr = b.s * (0.75 + r() * 0.35);
      pts.push([b.x + Math.cos(a) * rr * 1.25, b.y + Math.sin(a) * rr * 0.85]);
    }
    pts.push([b.x + b.s * 1.2, b.y + b.s * 0.1], [b.x - b.s * 1.2, b.y + b.s * 0.1]);
    const path = () => smooth(g, pts);
    path();
    g.fillStyle = col;
    g.fill();
    g.save();
    path(); g.clip();
    // the lit top facet and a shadowed foot
    g.fillStyle = hz(lighter(C.rocks[b.col], 0.35), d + 0.12);
    g.beginPath(); g.ellipse(b.x - b.s * 0.25, b.y - b.s * 0.75, b.s * 0.95, b.s * 0.42, -0.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = Col.rgba(darker(col, 0.35), 0.5);
    g.fillRect(b.x - b.s * 2, b.y - b.s * 0.12, b.s * 4, b.s);
    // a speck or two of lichen
    for (let i = 0; i < 4; i++) {
      g.fillStyle = Col.rgba(hz(C.greens[i % 4], d + 0.1), 0.85);
      g.beginPath(); g.arc(b.x + (r() - 0.5) * b.s * 1.6, b.y - r() * b.s * 0.7, b.s * (0.05 + r() * 0.06), 0, Math.PI * 2); g.fill();
    }
    g.restore();
    path();
    if (inkOn(g, 1, d)) g.stroke();
    // contact shadow
    g.fillStyle = Col.rgba(C.sandDk, 0.45);
    g.beginPath(); g.ellipse(b.x, b.y + b.s * 0.12, b.s * 1.25, b.s * 0.12, 0, 0, Math.PI * 2); g.fill();
  }

  function smooth(g, pts) {
    const n = pts.length;
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = m(pts[n - 1], pts[0]);
    g.beginPath();
    g.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const q = m(pts[i], pts[(i + 1) % n]);
      g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]);
    }
    g.closePath();
  }

  function smoothOpen(g, pts) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l[0], l[1]);
  }

  /* an inked stroke: ink underneath, colour on top, so a line is outlined */
  function inkedLine(g, draw, width, col, depth) {
    if (v.ink > 0.01) {
      g.strokeStyle = hz(C.ink, depth * 0.9);
      g.lineWidth = width + lineW() * 2;
      draw(); g.stroke();
    }
    g.strokeStyle = col;
    g.lineWidth = width;
    draw(); g.stroke();
  }

  function coral(g, b) {
    const r = Paint.rng(b.seed);
    const d = floorDepth(b.y);
    const base = C.coral[b.col];
    const col = hz(base, d);
    const tips = [];
    const segs = [];
    const grow = (x, y, a, len, wd, depth) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      segs.push([x, y, ex, ey, wd, (x + ex) / 2 + (r() - 0.5) * len * 0.3, (y + ey) / 2]);
      if (depth > 0) {
        grow(ex, ey, a - 0.35 - r() * 0.3, len * (0.62 + r() * 0.2), wd * 0.78, depth - 1);
        grow(ex, ey, a + 0.35 + r() * 0.3, len * (0.62 + r() * 0.2), wd * 0.78, depth - 1);
      } else tips.push([ex, ey, wd]);
    };
    grow(b.x, b.y, -Math.PI / 2 + (r() - 0.5) * 0.3, b.s * 0.55, b.s * 0.16, 3);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (v.ink > 0.01) {
      g.strokeStyle = hz(C.ink, d * 0.9);
      for (const s of segs) {
        g.lineWidth = s[4] + lineW() * 2;
        g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(s[5], s[6], s[2], s[3]); g.stroke();
      }
    }
    g.strokeStyle = col;
    for (const s of segs) {
      g.lineWidth = s[4];
      g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(s[5], s[6], s[2], s[3]); g.stroke();
    }
    // a lit edge along each branch, and pale polyp tips
    g.strokeStyle = hz(lighter(base, 0.45), d);
    for (const s of segs) {
      g.lineWidth = s[4] * 0.28;
      g.beginPath(); g.moveTo(s[0] - s[4] * 0.2, s[1]); g.quadraticCurveTo(s[5] - s[4] * 0.2, s[6], s[2] - s[4] * 0.2, s[3]); g.stroke();
    }
    g.fillStyle = hz(lighter(base, 0.6), d);
    for (const t of tips) { g.beginPath(); g.arc(t[0], t[1], t[2] * 0.42, 0, Math.PI * 2); g.fill(); }
  }

  function brain(g, b) {
    const r = Paint.rng(b.seed);
    const d = floorDepth(b.y);
    const base = C.coral[(b.col + 2) % 4];
    g.beginPath();
    g.ellipse(b.x, b.y - b.s * 0.32, b.s * 0.8, b.s * 0.55, 0, Math.PI, Math.PI * 2);
    g.lineTo(b.x + b.s * 0.8, b.y);
    g.lineTo(b.x - b.s * 0.8, b.y);
    g.closePath();
    g.fillStyle = hz(base, d);
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = hz(darker(base, 0.35), d);
    g.lineWidth = Math.max(1, b.s * 0.05);
    g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      let x = b.x - b.s * 0.8, y = b.y - b.s * (0.1 + k * 0.12);
      g.moveTo(x, y);
      while (x < b.x + b.s * 0.8) {
        x += b.s * 0.1;
        g.lineTo(x, y + Math.sin(x * 0.4 + k + r()) * b.s * 0.04);
      }
      g.stroke();
    }
    g.fillStyle = Col.rgba('#FFFFFF', 0.35);
    g.beginPath(); g.ellipse(b.x - b.s * 0.25, b.y - b.s * 0.68, b.s * 0.3, b.s * 0.1, -0.2, 0, Math.PI * 2); g.fill();
    g.restore();
    g.beginPath();
    g.ellipse(b.x, b.y - b.s * 0.32, b.s * 0.8, b.s * 0.55, 0, Math.PI, Math.PI * 2);
    g.lineTo(b.x + b.s * 0.8, b.y);
    g.lineTo(b.x - b.s * 0.8, b.y);
    g.closePath();
    if (inkOn(g, 1, d)) g.stroke();
  }

  function seaFan(g, b) {
    const r = Paint.rng(b.seed);
    const d = floorDepth(b.y) + 0.08;
    const base = b.col % 2 ? C.reds[2] : C.coral[3];
    const col = hz(base, d);
    const H0 = b.s * 1.6;
    const lines = [];
    const branch = (x, y, a, len, wd, depth) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      lines.push([x, y, ex, ey, wd]);
      if (depth > 0) {
        branch(ex, ey, a - 0.28 - r() * 0.2, len * 0.78, wd * 0.75, depth - 1);
        branch(ex, ey, a + 0.28 + r() * 0.2, len * 0.78, wd * 0.75, depth - 1);
      }
    };
    branch(b.x, b.y, -Math.PI / 2, H0 * 0.28, b.s * 0.08, 4);
    g.lineCap = 'round';
    if (v.ink > 0.01) {
      g.strokeStyle = hz(C.ink, d * 0.9);
      for (const l of lines) { g.lineWidth = l[4] + lineW() * 1.6; g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); }
    }
    g.strokeStyle = col;
    for (const l of lines) { g.lineWidth = l[4]; g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); }
  }

  function shell(g, b) {
    const d = floorDepth(b.y);
    const col = hz(['#FFB3C8', '#FFE2B0', '#F79A5C', '#FFFFFF'][b.col], d);
    g.beginPath();
    g.moveTo(b.x - b.s, b.y);
    g.quadraticCurveTo(b.x - b.s, b.y - b.s * 1.3, b.x, b.y - b.s * 1.3);
    g.quadraticCurveTo(b.x + b.s, b.y - b.s * 1.3, b.x + b.s, b.y);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    if (inkOn(g, 0.7, d)) {
      g.stroke();
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + i * b.s * 0.38, b.y - b.s * 1.1); g.stroke();
      }
    }
  }

  function tinyStar(g, b) {
    const d = floorDepth(b.y);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 5 + b.seed;
      const rr = i % 2 ? b.s * 0.45 : b.s * 1.2;
      i ? g.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * 0.6) : g.moveTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * 0.6);
    }
    g.closePath();
    g.fillStyle = hz(['#FF7A2A', '#FF4F7E', '#FFC612', '#B583FF'][b.col], d);
    g.fill();
    if (inkOn(g, 0.7, d)) g.stroke();
  }

  /* -------------------------------------------------------- the planting */

  /* How far a plant leans at fraction t (0 root, 1 tip): a slow sway plus a
     quicker ripple running up it. */
  function swayAt(t, phase) {
    const k = v.sway;
    const time = T() * 0.016;
    return (Math.sin(time + phase - t * 1.4) * 0.30 + Math.sin(time * 2.3 + phase * 1.7 - t * 3) * 0.08) * k * t;
  }

  /* One ribbon blade, root at (x, y), `len` long, `wd` wide. `curl` bends it
     at rest; a null `phase` holds it still (for the baked layers). Flat colour, a
     lighter midrib, inked. */
  function blade(g, x, y, len, wd, tilt, curl, col, ink, phase, depth, ruffle = 0) {
    const N = 14;
    const mid = [];
    let px = x, py = y, a = tilt;
    const step = len / N;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      mid.push([px, py, t]);
      a = tilt + curl * t + (phase == null ? 0 : swayAt(t, phase));
      px += Math.sin(a) * step;
      py -= Math.cos(a) * step;
    }
    const L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const p = mid[i], q = mid[Math.min(N, i + 1)], o = mid[Math.max(0, i - 1)];
      let tx = q[0] - o[0], ty = q[1] - o[1];
      const ln = Math.hypot(tx, ty) || 1;
      tx /= ln; ty /= ln;
      const t = p[2];
      let half = wd * 0.5 * (t < 0.8 ? 1 - 0.25 * t : 0.8 * Math.sqrt(Math.max(0, (1 - t) / 0.2)));
      if (ruffle) half *= 1 + ruffle * Math.sin(t * 22 + (phase || 0) * 3 + T() * 0.05);
      L.push([p[0] - ty * half, p[1] + tx * half]);
      R.push([p[0] + ty * half, p[1] - tx * half]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= N; i++) {
      const mx = (L[i][0] + L[Math.min(N, i + 1)][0]) / 2, my = (L[i][1] + L[Math.min(N, i + 1)][1]) / 2;
      g.quadraticCurveTo(L[i][0], L[i][1], mx, my);
    }
    for (let i = N; i >= 0; i--) {
      const j = Math.max(0, i - 1);
      g.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[j][0]) / 2, (R[i][1] + R[j][1]) / 2);
    }
    g.closePath();
    g.fillStyle = col;
    g.fill();
    if (ink) {
      g.strokeStyle = ink;
      g.lineWidth = lineW() * (depth ? 0.7 : 0.9);
      g.lineJoin = 'round';
      g.stroke();
    }
    if (wd > 5 && depth < 0.5) {
      g.strokeStyle = Col.rgba(lighter(col, 0.5), 0.75);
      g.lineWidth = Math.max(0.8, wd * 0.1);
      g.lineCap = 'round';
      g.beginPath();
      for (let i = 1; i < N - 1; i++) i === 1 ? g.moveTo(mid[i][0], mid[i][1]) : g.lineTo(mid[i][0], mid[i][1]);
      g.stroke();
    }
    return mid[N];
  }

  function plant(g, p, depth) {
    const ink = v.ink > 0.01 ? hz(C.ink, depth * 0.95) : null;
    const r = Paint.rng(Math.floor((p.seed || p.phase * 1000) + 1));

    if (p.kind === 'grass') {
      for (let i = 0; i < p.n; i++) {
        const t = p.n === 1 ? 0 : i / (p.n - 1) - 0.5;
        const col = hz(C.greens[(p.col + i) % 4], depth);
        blade(g, p.x + t * p.w * 2.2, p.base, p.h * (0.7 + 0.3 * r()), p.w, t * 0.35, t * 0.3,
              col, ink, p.phase + i * 0.6, depth);
      }
    } else if (p.kind === 'kelp') {
      for (let i = 0; i < 2; i++) {
        const col = hz(C.kelp[(p.col + i) % 3], depth);
        const tip = blade(g, p.x + i * p.w * 0.7, p.base, p.h * (1 - i * 0.18), p.w * (1 - i * 0.2),
                          (i - 0.5) * 0.12, (i - 0.5) * 0.2, col, ink, p.phase + i * 1.1, depth, 0.18);
        // the float at the top of the frond
        g.beginPath();
        g.arc(tip[0], tip[1], p.w * 0.32, 0, Math.PI * 2);
        g.fillStyle = hz(lighter(C.kelp[(p.col + i) % 3], 0.2), depth);
        g.fill();
        if (ink) { g.strokeStyle = ink; g.lineWidth = lineW() * 0.8; g.stroke(); }
      }
    } else if (p.kind === 'lettuce') {
      for (let i = 0; i < p.n; i++) {
        const t = i / (p.n - 1) - 0.5;
        const col = hz(C.lettuce[i % 2], depth);
        blade(g, p.x + t * p.w * 0.6, p.base, p.h * (0.7 + 0.3 * r()), p.w * (0.7 + 0.3 * r()),
              t * 1.5, t * 0.6, col, ink, p.phase + i * 0.4, depth, 0.14);
      }
    } else if (p.kind === 'whip') {
      // red sea whips: thin, curling, forking stems with pale tips
      const col = hz(C.reds[p.col % 3], depth);
      const tipCol = hz(lighter(C.reds[p.col % 3], 0.4), depth);
      g.lineCap = g.lineJoin = 'round';
      const stem = (x, y, a, curl, len, wd, lvl, ph) => {
        const pts = [[x, y]];
        let px = x, py = y, aa = a;
        for (let i = 1; i <= 10; i++) {
          const t = i / 10;
          aa = a + curl * t * t + swayAt(Math.min(1, t * 0.6 + lvl * 0.25), p.phase + ph);
          px += Math.sin(aa) * len / 10; py -= Math.cos(aa) * len / 10;
          pts.push([px, py]);
        }
        const draw = () => { g.beginPath(); smoothOpen(g, pts); };
        inkedLine(g, draw, wd, col, depth);
        g.fillStyle = tipCol;
        g.beginPath(); g.arc(px, py, wd * 0.6, 0, Math.PI * 2); g.fill();
        if (lvl < 1) {
          for (const [k, side] of [[4, 1], [6, -1]]) {
            const q = pts[k];
            stem(q[0], q[1], aa * 0.4 + side * 0.5, side * 0.3, len * 0.55, wd * 0.8, lvl + 1, ph + k * 0.3);
          }
        }
      };
      const wd = Math.max(2.2, p.w * 0.12);
      for (let i = 0; i < 3; i++) {
        stem(p.x + (i - 1) * p.w * 0.3, p.base, (i - 1) * 0.22, (i - 1) * 0.25 + (r() - 0.5) * 0.25,
             p.h * (0.75 + 0.25 * r()), wd, 0, i);
      }
    } else if (p.kind === 'anemone') {
      const base = C.anem[p.col % 3];
      const col = hz(base, depth);
      const R = p.h * 0.6;
      // column
      g.beginPath();
      g.moveTo(p.x - R * 0.55, p.base);
      g.quadraticCurveTo(p.x - R * 0.35, p.base - p.h * 0.5, p.x - R * 0.6, p.base - p.h * 0.75);
      g.lineTo(p.x + R * 0.6, p.base - p.h * 0.75);
      g.quadraticCurveTo(p.x + R * 0.35, p.base - p.h * 0.5, p.x + R * 0.55, p.base);
      g.closePath();
      g.fillStyle = hz(darker(base, 0.15), depth);
      g.fill();
      if (ink) { g.strokeStyle = ink; g.lineWidth = lineW() * 0.9; g.stroke(); }
      // tentacles, waving
      const n = 13;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const x0 = p.x + t * R * 1.2, y0 = p.base - p.h * 0.75;
        const a0 = t * 2.2;
        const len = p.h * (0.75 + 0.25 * Math.cos(t * 3));
        const pts = [[x0, y0]];
        let px = x0, py = y0;
        for (let k = 1; k <= 6; k++) {
          const s = k / 6;
          const a = a0 + Math.sin(T() * 0.04 + p.phase + i * 0.7 - s * 2) * 0.35 * (0.3 + v.sway) * s;
          px += Math.sin(a) * len / 6; py -= Math.cos(a) * len / 6;
          pts.push([px, py]);
        }
        const wd = Math.max(2, p.w * 0.11);
        inkedLine(g, () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); }, wd, col, depth);
        g.fillStyle = hz(lighter(base, 0.55), depth);
        g.beginPath(); g.arc(px, py, wd * 0.55, 0, Math.PI * 2); g.fill();
      }
    }
  }

  /* --------------------------------------------------- per-frame layers */

  function drawBack(g) {
    if (!bg) return;
    g.drawImage(bg, 0, 0, W, H);
    surface(g);
    if (v.farFish > 0.01) drawShoals(g);
    for (const p of mid) plant(g, p, p.depth);
  }

  /* the underside of the surface: a few bright wavering lines */
  function surface(g) {
    const t = T() * 0.02;
    g.save();
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const y0 = H * (0.012 + k * 0.016);
      g.strokeStyle = Col.rgba('#FFFFFF', 0.35 - k * 0.09);
      g.lineWidth = Math.max(1, H * 0.004 * (1 - k * 0.25));
      g.setLineDash([W * 0.05, W * 0.025, W * 0.012, W * 0.03]);
      g.lineDashOffset = -t * 40 * (k % 2 ? 1 : -1);
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 14) {
        const y = y0 + Math.sin(x * 0.012 + t * (1 + k * 0.3) + k) * H * 0.006;
        x === -10 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    g.setLineDash([]);
    g.restore();
  }

  function drawShoals(g) {
    const t = T();
    const sp = v.speed;
    g.save();
    for (const s of shoals) {
      s.x += s.dir * s.sp * sp;
      if (s.dir > 0 && s.x > W + s.spread * 2) { s.x = -s.spread * 2; s.y = H * (0.15 + Math.random() * 0.45); }
      if (s.dir < 0 && s.x < -s.spread * 2) { s.x = W + s.spread * 2; s.y = H * (0.15 + Math.random() * 0.45); }
      const cy = s.y + Math.sin(t * 0.008 + s.ph) * H * 0.03;
      g.fillStyle = Col.rgba(Col.mix(C.mid, C.top, 0.25 + s.depth * 0.3), Math.min(1, 0.3 + 0.7 * v.farFish));
      const count = Math.round(s.fish.length * Math.min(1, 0.4 + v.farFish));
      for (let i = 0; i < count; i++) {
        const f = s.fish[i];
        const x = s.x + f.dx * s.spread + Math.sin(t * 0.03 + f.ph) * s.size * 1.2;
        const y = cy + f.dy * s.spread * 0.45 + Math.cos(t * 0.025 + f.ph) * s.size;
        const L = s.size * 2.2, h = s.size * 0.8;
        const wag = Math.sin(t * 0.25 + f.ph) * h * 0.4;
        g.save();
        g.translate(x, y);
        g.scale(s.dir, 1);
        g.beginPath();
        g.moveTo(L * 0.5, 0);
        g.quadraticCurveTo(L * 0.1, -h, -L * 0.3, 0);
        g.lineTo(-L * 0.55, -h * 0.7 + wag);
        g.lineTo(-L * 0.48, wag * 0.5);
        g.lineTo(-L * 0.55, h * 0.7 + wag);
        g.lineTo(-L * 0.3, 0);
        g.quadraticCurveTo(L * 0.1, h, L * 0.5, 0);
        g.fill();
        g.restore();
      }
    }
    g.restore();
  }

  function drawFloor(g, night) {
    if (floor) g.drawImage(floor, 0, 0, W, H);
    caustics(g, night);
  }

  function drawFront(g) {
    for (const p of front) plant(g, p, 0);
  }

  /* ------------------------------------------------------------ light */

  let cBuf = null;
  function caustics(ctx, night) {
    const k = v.caustics * (night ? 0.3 : 1);
    if (k < 0.01) return;
    const bw = Math.max(2, Math.ceil(W / 2)), bh = Math.max(2, Math.ceil(H / 2));
    if (!cBuf || cBuf.width !== bw || cBuf.height !== bh) {
      cBuf = document.createElement('canvas');
      cBuf.width = bw; cBuf.height = bh;
    }
    const g = cBuf.getContext('2d');
    const t = T();
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, bw, bh);
    g.globalCompositeOperation = 'lighter';
    const tc = Paint.tex().caustic;
    const layer = (size, vx, vy, a) => {
      const ox = ((t * vx) % size + size) % size, oy = ((t * vy) % size + size) % size;
      g.globalAlpha = a;
      for (let y = -size + oy; y < bh; y += size) {
        for (let x = -size + ox; x < bw; x += size) g.drawImage(tc, x, y, size, size * 0.55);
      }
    };
    layer(150, 0.13, 0.05, 0.75);
    layer(205, -0.09, 0.07, 0.6);
    g.globalCompositeOperation = 'destination-in';
    g.globalAlpha = 1;
    const fy = FY / H;
    const m = g.createLinearGradient(0, 0, 0, bh);
    m.addColorStop(0, 'rgba(0,0,0,0.5)');
    m.addColorStop(0.15, 'rgba(0,0,0,0.0)');
    m.addColorStop(Math.max(0.2, fy - 0.03), 'rgba(0,0,0,0.0)');
    m.addColorStop(Math.min(0.99, fy + 0.04), 'rgba(0,0,0,0.9)');
    m.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.fillStyle = m;
    g.fillRect(0, 0, bw, bh);
    g.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32 * k;
    ctx.drawImage(cBuf, 0, 0, W, H);
    ctx.restore();
  }

  function drawRays(g, night) {
    if (v.rays < 0.01) return;
    const t = T();
    const tex = night ? Paint.tex().rayNight : Paint.tex().rayDay;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const ph = i * 1.9;
      const x = W * (0.12 + i * 0.2) + Math.sin(t * 0.004 + ph) * W * 0.03;
      const wd = W * (0.07 + 0.05 * Math.abs(Math.sin(ph * 3)));
      const pulse = 0.65 + 0.35 * Math.sin(t * 0.011 + ph * 2);
      g.globalAlpha = v.rays * pulse * (night ? 0.12 : 0.26);
      g.save();
      g.translate(x, -10);
      g.rotate(0.22);
      g.drawImage(tex, -wd / 2, 0, wd, H * 0.95);
      g.restore();
    }
    g.restore();
  }

  /* ---------------------------------------------------- bubbles, specks */

  function bubble(g, x, y, r, alpha = 1) {
    g.save();
    g.globalAlpha = alpha;
    g.drawImage(Paint.tex().bubble, x - r, y - r, r * 2, r * 2);
    g.restore();
  }

  function drawBubbles(g) {
    const k = v.bubbles;
    if (k < 0.01) { bubbles.length = 0; return; }
    const short = Math.min(W, H);
    // the two streams
    for (const s of streams) {
      s.acc += 0.12 * k;
      while (s.acc > 1) {
        s.acc -= 1;
        bubbles.push({ x: s.x + (Math.random() - 0.5) * 6, y: s.y, r: short * (0.004 + Math.random() * 0.008),
                       sp: 0.9 + Math.random() * 0.8, ph: Math.random() * 6.28 });
      }
    }
    // and the odd stray one
    if (Math.random() < 0.03 * k) {
      bubbles.push({ x: Math.random() * W, y: FY, r: short * (0.005 + Math.random() * 0.01),
                     sp: 0.6 + Math.random() * 0.6, ph: Math.random() * 6.28 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.sp * (1 + b.r * 0.02);
      b.x += Math.sin(T() * 0.06 + b.ph) * 0.4;
      b.r *= 1.0012;
      if (b.y < -20) { bubbles.splice(i, 1); continue; }
      bubble(g, b.x, b.y, b.r, 0.9);
    }
  }

  function drawParticles(g) {
    const k = v.particles;
    if (k < 0.01) return;
    const s = Paint.tex().mote;
    const t = T();
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const p of motes) {
      if (p.keep > k) continue;
      p.y += 0.04 + p.z * 0.12;
      p.x += Math.sin(t * 0.008 + p.ph) * (0.06 + p.z * 0.1);
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      const d = 1.5 + p.z * (p.z > 0.93 ? 22 : 4);
      g.globalAlpha = p.z > 0.93 ? 0.08 : 0.12 + p.z * 0.3;
      g.drawImage(s, p.x - d / 2, p.y - d / 2, d, d);
    }
    g.restore();
  }

  /* --------------------------------------------------------- overlays */

  function night(g, k) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = Col.rgba('#3B4C9A', k);
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  function drawOverlay(g) {
    if (v.vignette > 0.01) {
      const r = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.8);
      r.addColorStop(0, Col.rgba(C.deep, 0));
      r.addColorStop(1, Col.rgba(darker(C.deep, 0.5), 0.8 * v.vignette));
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
    }
    if (v.grain > 0.01) {
      const p = Paint.pattern(g, 'grain');
      Paint.placePattern(p, 1.2);
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.45 * v.grain;
      g.fillStyle = p;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  }

  /* the plants a fish can get tangled in, and a blade to tangle it with */
  function anchors() {
    return front.filter(p => p.kind === 'grass' || p.kind === 'kelp');
  }
  function strand(g, x, y, len, wd, phase, tilt) {
    blade(g, x, y, len, wd, tilt, tilt * 0.5, C.greens[1], v.ink > 0.01 ? C.ink : null, phase, 0);
  }

  return {
    build, rebake: bake, relayout() { palette(); layout(); bake(); },
    drawBack, drawFloor, drawFront, drawRays, drawBubbles, drawParticles, drawOverlay, night,
    bubble, anchors, strand,
    get floorY() { return FY; }
  };
})();
