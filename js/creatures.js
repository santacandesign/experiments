/* Fish Friends — the cast.

   Every creature in the tank, yours included, is drawn from this registry, so
   the species you pick for yourself is the same code that fills the water
   around you.

   A species owns: its proportions, its silhouette, whatever hangs off it, and
   where an eye belongs. Bodies are drawn straight into the 2D context rather
   than through p5 shapes, because the same path is needed twice — once to fill
   and ink it, once to clip the patterning and shading inside it.

   Callers apply the transform and draw the eye; draw() only does the creature. */

const Creatures = (() => {

  const ORDER = ['fish', 'deep', 'tiny', 'seahorse', 'starfish', 'whale', 'manta', 'shark'];

  const SPECIES = {
    fish:     { label: 'fish',     aspect: 0.70, sizeMul: 1.00, flips: true,  spins: false, speed: 1.00,
                motion: 'burst',    beat: 0.20, pattern: 'stripes', eye: { x: 0.17, y: -0.21, d: 0.28 } },
    long:     { label: 'long',     aspect: 0.34, sizeMul: 1.25, flips: true,  spins: false, speed: 1.05,
                motion: 'undulate', beat: 0.20, pattern: 'spots',   eye: { x: 0.34, y: -0.16, d: 0.17 } },
    deep:     { label: 'round',    aspect: 1.05, sizeMul: 0.85, flips: true,  spins: false, speed: 0.70,
                motion: 'hover',    beat: 0.11, pattern: 'stripes', eye: { x: 0.23, y: -0.17, d: 0.25 } },
    tiny:     { label: 'tiny',     aspect: 0.62, sizeMul: 0.50, flips: true,  spins: false, speed: 1.55,
                motion: 'burst',    beat: 0.34, pattern: 'band',    eye: { x: 0.20, y: -0.18, d: 0.30 } },
    seahorse: { label: 'seahorse', aspect: 1.90, sizeMul: 0.64, flips: true,  spins: false, speed: 0.32,
                motion: 'seahorse', beat: 0.62, pattern: 'speckle', eye: { x: 0.13, y: -0.335, d: 0.19 } },
    starfish: { label: 'starfish', aspect: 1.00, sizeMul: 0.80, flips: false, spins: true,  speed: 0.30,
                motion: 'crawl',    beat: 0.00, pattern: 'dots',    eye: { x: 0.02, y: 0.00,  d: 0.34 } },
    whale:    { label: 'whale',    aspect: 0.60, sizeMul: 1.50, flips: true,  spins: false, speed: 0.48,
                motion: 'cruise',   beat: 0.045, pattern: 'belly',  eye: { x: 0.30, y: 0.02,  d: 0.13 } },
    manta:    { label: 'manta',    aspect: 0.78, sizeMul: 1.45, flips: true,  spins: false, speed: 0.55,
                motion: 'cruise',   beat: 0.06, pattern: 'belly',   eye: { x: 0.24, y: -0.06, d: 0.12 } },
    shark:    { label: 'shark',    aspect: 0.44, sizeMul: 1.35, flips: true,  spins: false, speed: 1.00,
                motion: 'cruise',   beat: 0.10, pattern: 'belly',   eye: { x: 0.32, y: -0.05, d: 0.11 } }
  };

  const get = id => SPECIES[id] || SPECIES.fish;

  /* Outline and marking colours. Scenery passes its own so it can sink into the
     water; a creature with a person behind it keeps the drawn palette. */
  const lineOf = f => f.lineCol || shade(f.col, 0.52);
  const patOf  = f => f.patCol  || PAL.cream;
  const dims = f => {
    const sp = get(f.species);
    const w = f.w * sp.sizeMul;
    return { sp, w, h: w * sp.aspect };
  };

  /* Where the eye goes, in the creature's own coordinates. */
  function eyeSpot(f) {
    const { sp, w, h } = dims(f);
    return { x: w * sp.eye.x, y: h * sp.eye.y, d: w * sp.eye.d };
  }

  /* How far below the origin a name tag should sit. */
  function tagDrop(f) {
    const { h } = dims(f);
    return h * 0.60 + f.w * 0.10;
  }

  /* ------------------------------------------------------------ outlines */

  /* Wobbly closed path through a list of [x,y] points, using the same boil as
     everything else so outlines shimmer rather than sit dead still. */
  function wobblePath(ctx, pts, id, amp) {
    const s = boilSeed(id);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const n = noise(s + i * 0.6, s + 5);
      const o = (n - 0.5) * 2 * amp;
      const q = pts[(i + 1) % pts.length];
      const nx = -(q[1] - p[1]), ny = q[0] - p[0];
      const len = Math.hypot(nx, ny) || 1;
      const x = p[0] + (nx / len) * o, y = p[1] + (ny / len) * o;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* Anguilliform swimming: the whole body carries a wave that grows toward the
     tail. Built as a ribbon so the outline genuinely bends, rather than an oval
     that slides sideways. */
  function longSpine(S, phase) {
    const pts = [];
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const t = i / N;                                   // 0 nose, 1 tail tip
      const amp = S * 0.088 * Math.pow(t, 1.4);
      const x = (0.46 - t * 0.92) * S;
      const y = Math.sin(t * Math.PI * 2.4 - (phase || 0)) * amp;
      const r = S * 0.168 * Math.sin(Math.pow(t, 0.72) * Math.PI) + S * 0.010;
      pts.push([x, y, r]);
    }
    return pts;
  }

  function bodyPath(ctx, f) {
    const { sp, w, h } = dims(f);
    const amp = w * 0.016;

    if (f.species === 'starfish') {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / 5;
        const r = (i % 2 === 0 ? w * 0.50 : w * 0.21);
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      wobblePath(ctx, pts, f.id, amp * 1.4);
      return;
    }

    if (f.species === 'seahorse') {
      ribbonPath(ctx, seahorseSpine(w, f.coil));
      return;
    }

    if (f.species === 'long') {
      ribbonPath(ctx, longSpine(w, f.wave));
      return;
    }

    if (f.species === 'whale') {
      ctx.beginPath();
      ctx.moveTo(w * 0.50, h * 0.06);                                     // snout
      ctx.bezierCurveTo(w * 0.44, -h * 0.44, -w * 0.06, -h * 0.52, -w * 0.28, -h * 0.30);
      ctx.bezierCurveTo(-w * 0.42, -h * 0.16, -w * 0.44, -h * 0.06, -w * 0.50, -h * 0.02);
      ctx.bezierCurveTo(-w * 0.44,  h * 0.10, -w * 0.34,  h * 0.22, -w * 0.16,  h * 0.34);
      ctx.bezierCurveTo(w * 0.10,  h * 0.50,  w * 0.42,  h * 0.34,  w * 0.50,  h * 0.06);
      ctx.closePath();
      return;
    }

    if (f.species === 'shark') {
      /* a torpedo with a pointed snout at +x, tapering to a slim tail wrist */
      ctx.beginPath();
      ctx.moveTo(w * 0.52,  h * 0.04);                                    // snout tip
      ctx.bezierCurveTo(w * 0.34, -h * 0.34,  w * 0.02, -h * 0.42, -w * 0.30, -h * 0.22); // back
      ctx.bezierCurveTo(-w * 0.40, -h * 0.16, -w * 0.44, -h * 0.10, -w * 0.46, -h * 0.03); // to wrist top
      ctx.bezierCurveTo(-w * 0.42,  h * 0.06, -w * 0.28,  h * 0.22, -w * 0.04,  h * 0.30); // belly rear
      ctx.bezierCurveTo(w * 0.20,  h * 0.40,  w * 0.42,  h * 0.24,  w * 0.52,  h * 0.04); // belly to snout
      ctx.closePath();
      return;
    }

    if (f.species === 'manta') {
      /* top-down glider: a swept diamond, its wingtips flapping slowly. The two
         "wings" are up/down here, and the head points +x. */
      const flap = Math.sin(frameCount * (f.wagSpeed || 0.06) + (f.phase || 0)) * h * 0.18;
      ctx.beginPath();
      ctx.moveTo(w * 0.46, 0);                                            // head tip
      ctx.bezierCurveTo(w * 0.30, -h * 0.16,  w * 0.06, -h * 0.24, -w * 0.14, -h * 0.50 - flap); // to top wingtip
      ctx.bezierCurveTo(-w * 0.26, -h * 0.56 - flap, -w * 0.34, -h * 0.40, -w * 0.34, -h * 0.16); // wingtip curl
      ctx.bezierCurveTo(-w * 0.40, -h * 0.05, -w * 0.40,  h * 0.05, -w * 0.34,  h * 0.16); // rear waist
      ctx.bezierCurveTo(-w * 0.34,  h * 0.40, -w * 0.26,  h * 0.56 + flap, -w * 0.14,  h * 0.50 + flap); // bottom wingtip
      ctx.bezierCurveTo(w * 0.06,  h * 0.24,  w * 0.30,  h * 0.16,  w * 0.46, 0);         // back to head
      ctx.closePath();
      return;
    }

    /* everything else is an oval, with the boil already built in */
    blobPath(ctx, 0, 0, w, h, f.id, 30, amp);
  }


  /* ---------------------------------------------------------- seahorse ---

     Built from a centreline rather than a blob outline: a list of
     [x, y, halfWidth] points walked from the snout, down the neck and body,
     then round a shrinking spiral for the tail. Offsetting that centreline by
     its half-width gives a shape that tapers properly and can curl, which a
     closed bezier cannot. Everything else — segment rings, the dorsal fin,
     the coronet — is positioned off the same spine, so it all stays attached.

     Coordinates are in units of the nominal width; y is positive downward, and
     the creature faces +x. */

  const SEAHORSE_BODY = [
    [ 0.52, -0.55, 0.028],   // snout tip
    [ 0.40, -0.60, 0.048],
    [ 0.27, -0.65, 0.078],
    [ 0.12, -0.67, 0.135],   // head
    [-0.03, -0.61, 0.165],
    [-0.13, -0.47, 0.160],   // nape
    [-0.11, -0.30, 0.163],
    [-0.01, -0.13, 0.168],   // chest
    [ 0.05,  0.06, 0.156],
    [ 0.03,  0.24, 0.130],
    [-0.06,  0.38, 0.104]    // tail base
  ];
  /* Spine fractions matter: the snout alone is the first ~17% of the smoothed
     array, so anything anchored by fraction has to account for that. */
  const SEAHORSE_COIL = { cx: 0.02, cy: 0.70, turns: 1.22, steps: 60 };
  const AT = { crown: 0.185, napeFrom: 0.225, napeStep: 0.028,
               finFrom: 0.285, finTo: 0.525, pectoral: 0.275, rings: 0.20 };

  /* Catmull-Rom through the control points, so the body reads as one curve. */
  function smoothSpine(src, per) {
    const out = [];
    const at = i => src[Math.max(0, Math.min(src.length - 1, i))];
    for (let i = 0; i < src.length - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        const q = [];
        for (let d = 0; d < 3; d++) {
          q[d] = 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t +
                 (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
                 (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
        }
        out.push(q);
      }
    }
    out.push(src[src.length - 1].slice());
    return out;
  }

  /* `coil` is 0 (tail hanging open) to 1 (curled tight). A seahorse is a poor
     swimmer that repositions itself by rolling and unrolling its tail, so this
     is animated rather than fixed. */
  function seahorseSpine(S, coil) {
    const c = coil == null ? 1 : Math.max(0, Math.min(1, coil));
    const sp = smoothSpine(SEAHORSE_BODY, 7);
    const C = SEAHORSE_COIL;
    const tail = sp[sp.length - 1];
    const a0 = Math.atan2(tail[1] - C.cy, tail[0] - C.cx);
    const r0 = Math.hypot(tail[0] - C.cx, tail[1] - C.cy) * (1 + 0.30 * (1 - c));
    const turns = 0.62 + 0.62 * c;
    const shrink = 0.58 + 0.30 * c;
    for (let i = 1; i <= C.steps; i++) {
      const t = i / C.steps;
      const a = a0 + t * turns * Math.PI * 2;
      const r = r0 * (1 - t * shrink);
      sp.push([C.cx + Math.cos(a) * r,
               C.cy + Math.sin(a) * r,
               0.106 * Math.pow(1 - t, 0.75) + 0.006]);
    }
    return sp.map(p => [p[0] * S, p[1] * S, p[2] * S]);
  }

  /* unit normal at spine index i; `back` points away from the belly */
  function spineNormal(sp, i) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(sp.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    return [-ty, tx];
  }

  /* The outline: walk one side out, the other side back. */
  function ribbonPath(ctx, sp) {
    const L = [], R = [];
    for (let i = 0; i < sp.length; i++) {
      const n = spineNormal(sp, i), p = sp[i];
      L.push([p[0] + n[0] * p[2], p[1] + n[1] * p[2]]);
      R.push([p[0] - n[0] * p[2], p[1] - n[1] * p[2]]);
    }
    const loop = L.concat(R.reverse());
    ctx.beginPath();
    ctx.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i++) ctx.lineTo(loop[i][0], loop[i][1]);
    ctx.closePath();
  }

  /* Which normal direction is the back? Sampled at the nape, where the back is
     unambiguously the side further from the belly's forward bulge. */
  function backSign(sp) {
    const i = Math.round(sp.length * 0.22);
    return spineNormal(sp, i)[0] < 0 ? 1 : -1;
  }

  function seahorseBehind(ctx, f, S, wag) {
    const sp = seahorseSpine(S, f.coil);
    const bs = backSign(sp);
    const spineAt = t => sp[Math.round(t * (sp.length - 1))];

    ctx.strokeStyle = lineOf(f);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.lineWidth = f.line;

    // the big ornate dorsal fan, riding the back of the mid body
    const i0 = Math.round(sp.length * AT.finFrom), i1 = Math.round(sp.length * AT.finTo);
    const outer = [];
    ctx.fillStyle = f.accent;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const t = (i - i0) / (i1 - i0);
      /* flattened bell: a broad webbed fan rather than a single spike, with a
         shallow scallop along the outer edge */
      const bell = Math.pow(Math.sin(t * Math.PI), 0.55);
      const scallop = 1 + 0.06 * Math.sin(t * Math.PI * 7);
      const n = spineNormal(sp, i), p = sp[i];
      const reach = (p[2] + S * (0.05 + 0.235 * bell)) * scallop + wag * 0.22 * bell;
      const x = p[0] + n[0] * bs * reach, y = p[1] + n[1] * bs * reach;
      outer.push([x, y, i]);
      i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let i = i1; i >= i0; i--) {
      const n = spineNormal(sp, i), p = sp[i];
      ctx.lineTo(p[0] + n[0] * bs * p[2] * 0.9, p[1] + n[1] * bs * p[2] * 0.9);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // fin rays across the fan
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(0.35, f.line * 0.5);
    for (const o of outer) {
      if ((o[2] - i0) % 5) continue;
      const p = sp[o[2]], n = spineNormal(sp, o[2]);
      ctx.beginPath();
      ctx.moveTo(p[0] + n[0] * bs * p[2] * 0.9, p[1] + n[1] * bs * p[2] * 0.9);
      ctx.lineTo(o[0], o[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // spiny ridge down the nape, between head and fan
    ctx.fillStyle = f.accent;
    ctx.lineWidth = Math.max(0.4, f.line * 0.75);
    for (let k = 0; k < 5; k++) {
      const i = Math.round(sp.length * (AT.napeFrom + k * AT.napeStep));
      const p = sp[i], n = spineNormal(sp, i);
      const base = p[2] * 0.95, tip = base + S * (0.075 - k * 0.006);
      const t = [ -n[1] * bs, n[0] * bs ];
      ctx.beginPath();
      ctx.moveTo(p[0] + n[0] * bs * base - t[0] * S * 0.035,
                 p[1] + n[1] * bs * base - t[1] * S * 0.035);
      ctx.lineTo(p[0] + n[0] * bs * tip, p[1] + n[1] * bs * tip);
      ctx.lineTo(p[0] + n[0] * bs * base + t[0] * S * 0.035,
                 p[1] + n[1] * bs * base + t[1] * S * 0.035);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // coronet on top of the head
    const hi = Math.round(sp.length * AT.crown);
    const hp = sp[hi], hn = spineNormal(sp, hi);
    for (let k = -1; k <= 1; k++) {
      const off = k * S * 0.055;
      const t = [ -hn[1] * bs, hn[0] * bs ];
      const bx = hp[0] + t[0] * off, by = hp[1] + t[1] * off;
      const len = S * (k === 0 ? 0.135 : 0.10);
      ctx.beginPath();
      ctx.moveTo(bx + hn[0] * bs * hp[2] * 0.6 - t[0] * S * 0.028,
                 by + hn[1] * bs * hp[2] * 0.6 - t[1] * S * 0.028);
      ctx.lineTo(bx + hn[0] * bs * (hp[2] + len), by + hn[1] * bs * (hp[2] + len));
      ctx.lineTo(bx + hn[0] * bs * hp[2] * 0.6 + t[0] * S * 0.028,
                 by + hn[1] * bs * hp[2] * 0.6 + t[1] * S * 0.028);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function seahorseFront(ctx, f, S) {
    const sp = seahorseSpine(S, f.coil);
    const bs = backSign(sp);

    // bony segment rings, drawn across the spine so they follow the curl
    ctx.save();
    ribbonPath(ctx, sp);
    ctx.clip();
    ctx.strokeStyle = lineOf(f);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(0.35, f.line * 0.5);
    for (let i = Math.round(sp.length * AT.rings); i < sp.length - 2; i += 5) {
      const p = sp[i], n = spineNormal(sp, i);
      ctx.beginPath();
      ctx.moveTo(p[0] + n[0] * p[2] * 1.1, p[1] + n[1] * p[2] * 1.1);
      ctx.lineTo(p[0] - n[0] * p[2] * 1.1, p[1] - n[1] * p[2] * 1.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // small pectoral fin behind the cheek
    const i = Math.round(sp.length * AT.pectoral);
    const p = sp[i], n = spineNormal(sp, i);
    ctx.fillStyle = f.accent;
    ctx.strokeStyle = lineOf(f);
    ctx.lineWidth = Math.max(0.4, f.line * 0.8);
    ctx.beginPath();
    ctx.ellipse(p[0] - n[0] * bs * p[2] * 0.55, p[1] - n[1] * bs * p[2] * 0.55,
                S * 0.062, S * 0.036, Math.atan2(n[1], n[0]), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /* ----------------------------------------------------------- the parts */

  function behind(ctx, f, wag) {
    const { sp, w, h } = dims(f);
    if (f.species === 'starfish') return;

    ctx.fillStyle = f.accent;
    ctx.strokeStyle = lineOf(f);
    ctx.lineWidth = f.line;
    ctx.lineJoin = ctx.lineCap = 'round';

    const tri = (a, b, c) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };

    if (f.species === 'whale') {
      // flukes, held flat like a whale's
      ctx.beginPath();
      ctx.moveTo(-w * 0.44, -h * 0.04);
      ctx.bezierCurveTo(-w * 0.62, -h * 0.34 + wag, -w * 0.80, -h * 0.30 + wag, -w * 0.76, -h * 0.06 + wag);
      ctx.bezierCurveTo(-w * 0.80,  h * 0.20 + wag, -w * 0.62,  h * 0.26 + wag, -w * 0.44,  h * 0.04);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      return;
    }

    if (f.species === 'seahorse') { seahorseBehind(ctx, f, w, wag); return; }

    if (f.species === 'shark') {
      // heterocercal tail: a tall upper lobe, a short lower one
      ctx.beginPath();
      ctx.moveTo(-w * 0.44, -h * 0.04);
      ctx.lineTo(-w * 0.74, -h * 0.70 + wag);        // upper lobe tip
      ctx.lineTo(-w * 0.56, -h * 0.06 + wag);        // notch
      ctx.lineTo(-w * 0.66,  h * 0.34 + wag);        // lower lobe tip
      ctx.lineTo(-w * 0.44,  h * 0.06);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // tall dorsal fin on the back
      tri([w * 0.04, -h * 0.34], [-w * 0.10, -h * 0.94], [-w * 0.18, -h * 0.30]);
      // pectoral fin low at the front
      tri([w * 0.16, h * 0.14], [w * 0.00, h * 0.62], [w * 0.28, h * 0.24]);
      // small second dorsal, near the tail
      tri([-w * 0.24, -h * 0.24], [-w * 0.32, -h * 0.52], [-w * 0.36, -h * 0.22]);
      return;
    }

    if (f.species === 'manta') {
      // long whip tail trailing behind
      ctx.strokeStyle = lineOf(f);
      ctx.lineWidth = Math.max(1, f.line * 1.4);
      ctx.beginPath();
      ctx.moveTo(-w * 0.32, 0);
      ctx.quadraticCurveTo(-w * 0.58, h * 0.04 + wag * 0.4, -w * 0.88, h * 0.10 + wag);
      ctx.stroke();
      ctx.lineWidth = f.line;
      // two cephalic fins reaching forward off the head
      tri([w * 0.40, -h * 0.06], [w * 0.62, -h * 0.16], [w * 0.42,  h * 0.02]);
      tri([w * 0.40,  h * 0.06], [w * 0.62,  h * 0.16], [w * 0.42, -h * 0.02]);
      return;
    }

    if (f.species === 'long') {
      const ln = longSpine(w, f.wave);
      const last = ln[ln.length - 1], prev = ln[ln.length - 4];
      ctx.save();
      ctx.translate(last[0], last[1]);
      ctx.rotate(Math.atan2(last[1] - prev[1], last[0] - prev[0]));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.20, -h * 0.62);
      ctx.lineTo(w * 0.12, 0);
      ctx.lineTo(w * 0.20, h * 0.62);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();

      // a ridge fin following the wave along the back
      ctx.beginPath();
      for (let i = 3; i < ln.length - 4; i++) {
        const p = ln[i], n = spineNormal(ln, i);
        const t = i / (ln.length - 1);
        const reach = p[2] + w * 0.085 * Math.sin(t * Math.PI);
        const x = p[0] + n[0] * reach, y = p[1] + n[1] * reach;
        i === 3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let i = ln.length - 5; i >= 3; i--) {
        const p = ln[i], n = spineNormal(ln, i);
        ctx.lineTo(p[0] + n[0] * p[2] * 0.9, p[1] + n[1] * p[2] * 0.9);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      return;
    }

    const tailBack = 0.80;
    tri([-w * 0.40, 0],
        [-w * tailBack, -h * 0.50 + wag],
        [-w * tailBack,  h * 0.50 + wag]);
    // notch the tail so it reads as a fin, not a wedge
    ctx.fillStyle = f.col;
    ctx.beginPath();
    ctx.moveTo(-w * tailBack, -h * 0.50 + wag);
    ctx.lineTo(-w * (tailBack - 0.16), 0 + wag * 0.4);
    ctx.lineTo(-w * tailBack, h * 0.50 + wag);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = f.accent;
    const up = f.species === 'deep' ? 1.15 : 0.86;
    tri([-w * 0.16, -h * 0.40], [-w * 0.02, -h * up], [w * 0.18, -h * 0.36]);
    tri([-w * 0.12,  h * 0.36], [-w * 0.04,  h * (up * 0.85)], [w * 0.16, h * 0.34]);
  }

  /* Ribs across the fins and a gill arc — the hand-inked touch. */
  function front(ctx, f, wag) {
    const { sp, w, h } = dims(f);
    if (f.species === 'seahorse') { seahorseFront(ctx, f, w); return; }
    ctx.strokeStyle = lineOf(f);
    ctx.lineWidth = Math.max(0.35, f.line * 0.55);
    ctx.globalAlpha = 0.55;

    if (f.species !== 'starfish' && f.species !== 'whale' && f.species !== 'long'
        && f.species !== 'shark' && f.species !== 'manta') {
      const tailBack = 0.80;
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(-w * 0.42, 0);
        ctx.lineTo(-w * (0.42 + (tailBack - 0.42) * 0.95),
                   (-h * 0.50 + t * h) * 0.95 + wag);
        ctx.stroke();
      }
    }

    if (f.species === 'whale') {
      // throat grooves
      for (let i = 0; i < 4; i++) {
        const y = h * (0.06 + i * 0.07);
        ctx.beginPath();
        ctx.moveTo(w * 0.04, y);
        ctx.bezierCurveTo(w * 0.22, y + h * 0.06, w * 0.38, y + h * 0.02, w * 0.44, y - h * 0.04);
        ctx.stroke();
      }
      ctx.beginPath();     // pectoral fin
      ctx.globalAlpha = 1;
      ctx.fillStyle = f.accent;
      ctx.lineWidth = f.line;
      ctx.moveTo(w * 0.06, h * 0.18);
      ctx.bezierCurveTo(w * 0.02, h * 0.42, -w * 0.18, h * 0.46, -w * 0.20, h * 0.30);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (f.species === 'shark') {
      // five raked gill slits behind the head
      for (let i = 0; i < 5; i++) {
        const gx = w * (0.16 - i * 0.045);
        ctx.beginPath();
        ctx.moveTo(gx, -h * 0.22);
        ctx.quadraticCurveTo(gx - w * 0.03, 0, gx, h * 0.20);
        ctx.stroke();
      }
    } else if (f.species !== 'starfish' && f.species !== 'manta') {
      // gill arc
      const gx = -w * 0.02, gy = 0, gh = h * 0.32;
      ctx.beginPath();
      ctx.moveTo(gx + w * 0.06, gy - gh);
      ctx.quadraticCurveTo(gx - w * 0.05, gy, gx + w * 0.06, gy + gh);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------- patterning & shading */

  function details(ctx, f) {
    const { sp, w, h } = dims(f);
    ctx.save();
    bodyPath(ctx, f);
    ctx.clip();

    // lit from above: a light top edge, a shadow along the belly
    ctx.fillStyle = f.blend ? 'rgba(150,205,210,0.07)' : 'rgba(255,255,255,0.20)';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.62, w * 0.52, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = f.blend ? 'rgba(4,18,26,0.22)' : 'rgba(18,55,107,0.13)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.66, w * 0.55, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = lineOf(f);
    ctx.fillStyle = patOf(f);
    ctx.lineWidth = Math.max(0.35, f.line * 0.6);

    if (sp.pattern === 'stripes') {
      /* kept behind the eye — a band running under it reads as a mistake */
      for (const dx of [-w * 0.17, w * 0.01]) {
        ctx.beginPath();
        ctx.ellipse(dx, 0, w * 0.048, h * 0.60, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    } else if (sp.pattern === 'spots') {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.7;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * w * 0.30, Math.sin(a * 1.7) * h * 0.28,
                    w * 0.030, w * 0.030, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (sp.pattern === 'band') {
      ctx.beginPath();
      ctx.ellipse(0, h * 0.30, w * 0.60, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (sp.pattern === 'speckle') {
      ctx.fillStyle = f.blend ? patOf(f) : 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 46; i++) {
        const x = ((i * 67.13) % 100) / 100 * w - w / 2;
        const y = ((i * 29.71) % 100) / 100 * h - h / 2;
        ctx.beginPath();
        ctx.ellipse(x, y, w * 0.017, w * 0.017, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (sp.pattern === 'dots') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
        for (let k = 1; k <= 3; k++) {
          const r = w * 0.12 * k;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, w * 0.026, w * 0.026, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (sp.pattern === 'belly') {
      ctx.fillStyle = patOf(f);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(w * 0.06, h * 0.42, w * 0.44, h * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // fine speckle, matching the grain on the water
    ctx.fillStyle = 'rgba(18,55,107,0.16)';
    for (let i = 0; i < 26; i++) {
      const x = ((i * 73.31) % 100) / 100 * w - w / 2;
      const y = ((i * 41.17) % 100) / 100 * h - h / 2;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.008, w * 0.008, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* --------------------------------------------------------------- draw */

  function draw(f) {
    const ctx = drawingContext;
    const { sp, w, h } = dims(f);
    /* Effort is how hard the creature is currently working: a fish that has
       finished its burst and is gliding holds its tail almost still. */
    const effort = f.effort == null ? 1 : f.effort;
    const wag = Math.sin(frameCount * f.wagSpeed + f.phase)
              * (w * 0.09) * (0.18 + 0.82 * effort) * (1 + (f.talk || 0) * 2);

    behind(ctx, f, wag);

    ctx.fillStyle = f.col;
    ctx.strokeStyle = lineOf(f);
    ctx.lineWidth = f.line;
    ctx.lineJoin = ctx.lineCap = 'round';
    bodyPath(ctx, f);
    ctx.fill();
    ctx.stroke();

    details(ctx, f);
    front(ctx, f, wag);

    if (f.species === 'whale' && f.spout) {
      ctx.strokeStyle = f.blend ? SEA.pale : 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(0.4, f.line * 0.7);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.16, -h * 0.44);
        ctx.quadraticCurveTo(w * (0.16 + i * 0.10), -h * 0.72,
                             w * (0.16 + i * 0.18), -h * 0.86);
        ctx.stroke();
      }
    }
  }

  /* A plain drawn eye, for everything that isn't you. Scenery gets the
     turtles' eye from the reference: a dark dot, barely ringed. */
  function drawPlainEye(f) {
    const e = eyeSpot(f);
    noStroke();
    if (f.blend) {
      fill(patOf(f));
      ellipse(e.x, e.y, e.d * 0.8, e.d * 0.8);
      fill(SEA.ink);
      ellipse(e.x + e.d * 0.08, e.y, e.d * 0.42, e.d * 0.42);
      return;
    }
    fill(PAL.cream);
    ellipse(e.x, e.y, e.d, e.d);
    fill(PAL.ink);
    ellipse(e.x + e.d * 0.10, e.y, e.d * 0.48, e.d * 0.48);
    fill(255, 255, 255, 210);
    ellipse(e.x - e.d * 0.06, e.y - e.d * 0.12, e.d * 0.16, e.d * 0.16);
  }

  return { SPECIES, ORDER, get, dims, eyeSpot, tagDrop, draw, drawPlainEye, bodyPath };
})();
