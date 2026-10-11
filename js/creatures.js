/* Fish Friends — the cast.

   Every creature in the tank, yours included, is drawn from this registry, so
   the species you pick for yourself is the same code that fills the water
   around you.

   The look is the reference sheet's: flat, very saturated colour, inked in a
   warm near-black. No creature is one colour — each wears a scheme (paint.js)
   of body, belly, head cap, cheek band, contrasting fins, markings and a wet
   gloss streak.

   A species owns its proportions, its silhouette, its fins, its markings and
   where an eye belongs. Bodies are drawn straight into the 2D context rather
   than through p5 shapes, because the same path is needed several times — to
   fill it, to clip the belly / cap / markings inside it, and to ink it.

   Callers apply the transform and draw the eye; draw() only does the creature. */

const Creatures = (() => {

  const ORDER = ['fish', 'deep', 'tiny', 'seahorse', 'starfish', 'whale', 'manta', 'shark'];

  /* faceMul: how large the whole-face patch is drawn, as a multiple of the
     creature's own (pre-sizeMul) width. Kept separate from aspect/sizeMul
     because a tall or spread-out silhouette (seahorse, starfish) needs a much
     smaller face than a stocky one to avoid swallowing the whole body.
     face: where that patch is centred, if not on the eye.

     turn:  how fast it can swing its heading, in radians per frame. This is
            the single number that decides whether something reads as a darting
            little fish or as a whale: a body cannot change direction faster
            than its own length and stiffness allow.
     pitch: how steeply it will point up or down. Fish climb and dive at far
            shallower angles than they turn — a fish standing on its nose to
            reach a target is the main thing that reads as 'wrong'. */
  const SPECIES = {
    fish:     { label: 'fish',     aspect: 0.46, sizeMul: 1.10, flips: true,  spins: false, speed: 1.00,
                motion: 'burst',    beat: 0.20, turn: 0.055, pitch: 0.42, eye: { x: 0.36, y: -0.10, d: 0.15 },
                face: { x: 0.20, y: 0.0 }, faceMul: 0.58 },
    long:     { label: 'long',     aspect: 0.34, sizeMul: 1.25, flips: true,  spins: false, speed: 1.05,
                motion: 'undulate', beat: 0.20, turn: 0.030, pitch: 0.34, eye: { x: 0.36, y: -0.10, d: 0.12 }, faceMul: 0.55 },
    deep:     { label: 'round',    aspect: 0.82, sizeMul: 0.90, flips: true,  spins: false, speed: 0.70,
                motion: 'hover',    beat: 0.11, turn: 0.075, pitch: 0.55, eye: { x: 0.27, y: -0.12, d: 0.18 },
                face: { x: 0.08, y: -0.02 }, faceMul: 0.74 },
    tiny:     { label: 'tiny',     aspect: 0.50, sizeMul: 0.50, flips: true,  spins: false, speed: 1.55,
                motion: 'burst',    beat: 0.34, turn: 0.105, pitch: 0.50, eye: { x: 0.34, y: -0.08, d: 0.19 },
                face: { x: 0.17, y: 0.0 }, faceMul: 0.66 },
    seahorse: { label: 'seahorse', aspect: 1.90, sizeMul: 0.64, flips: true,  spins: false, speed: 0.32,
                motion: 'seahorse', beat: 0.62, turn: 0.022, pitch: 0.10, eye: { x: 0.13, y: -0.335, d: 0.19 }, faceMul: 0.42 },
    starfish: { label: 'starfish', aspect: 1.00, sizeMul: 1.15, flips: false, spins: true,  speed: 0.30,
                motion: 'crawl',    beat: 0.00, turn: 0.030, pitch: 0.00, eye: { x: 0.02, y: 0.00,  d: 0.30 }, faceMul: 0.48 },
    whale:    { label: 'whale',    aspect: 0.60, sizeMul: 1.50, flips: true,  spins: false, speed: 0.48,
                motion: 'cruise',   beat: 0.045, turn: 0.010, pitch: 0.26, eye: { x: 0.30, y: 0.02,  d: 0.10 }, faceMul: 0.60 },
    manta:    { label: 'manta',    aspect: 0.78, sizeMul: 1.45, flips: true,  spins: false, speed: 0.55,
                motion: 'flap',     beat: 0.06, turn: 0.018, pitch: 0.32, eye: { x: 0.24, y: -0.06, d: 0.10 }, faceMul: 0.60 },
    shark:    { label: 'shark',    aspect: 0.44, sizeMul: 1.35, flips: true,  spins: false, speed: 1.00,
                motion: 'patrol',   beat: 0.10, turn: 0.024, pitch: 0.26, eye: { x: 0.32, y: -0.05, d: 0.09 }, faceMul: 0.60 }
  };

  const get = id => SPECIES[id] || SPECIES.fish;

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

  /* Where a whole-face patch is centred — the middle of the head, which on a
     long-snouted fish is further back than the eye. */
  function faceSpot(f) {
    const { sp, w, h } = dims(f);
    const p = sp.face || sp.eye;
    return { x: w * p.x, y: h * p.y };
  }

  /* How far below the origin a name tag should sit. */
  function tagDrop(f) {
    const { h } = dims(f);
    return h * 0.62 + f.w * 0.12;
  }

  /* ------------------------------------------------------------ fatness ---

     Being overfed is a change to the animal, not a sticker on it. Each species
     therefore puts the weight on where that animal actually would, and does it
     by moving its own outline — so the belly band, the markings, the fins and
     the ink all follow, and a fat fish is still unmistakably the same fish.

     `_fatAmt` is eased in draw() so it swells and goes down over about a
     second; every shape below reads it through fatK() and nothing advances it,
     so the half-dozen calls a frame all see the same number. */

  const fatK = f => f._fatAmt || 0;

  /* --------------------------------------------------------- per frame */

  /* Set at the top of draw(): the scheme and the line weight this creature is
     painted with this frame. */
  let S = null, LW = 1;

  function inked(ctx, mul = 1, col) {
    if (LW * mul < 0.05) return false;
    ctx.lineWidth = LW * mul;
    ctx.strokeStyle = col || S.line;
    ctx.lineJoin = ctx.lineCap = 'round';
    return true;
  }
  function inkStroke(ctx, mul = 1, col) {
    if (inked(ctx, mul, col)) ctx.stroke();
  }

  /* --------------------------------------------------- the fish profile ---

     The ordinary fish (fish, round, tiny) are built from a side profile rather
     than an oval: a thickness curve u^a·(1−u)^b running nose (u=0) to the tail
     wrist (u=1), which gives a rounded snout, a high shoulder and a proper
     narrow wrist for the tail to hang off. Fins, belly, cap and markings all
     anchor to the same curve, so nothing floats off the body. `bend` curls the
     back half with the tail beat. */

  const PROFILES = {
    fish: { nose: 0.50, tail: -0.40, a: 0.55, b: 0.95, wrist: 0.15, top: 1.05, bot: 0.95, drop: 0.07,
            cap: 0.27, belly: 0.16, fat: 0.30 },
    deep: { nose: 0.48, tail: -0.36, a: 0.80, b: 0.82, wrist: 0.19, top: 1.06, bot: 0.94, drop: 0.10,
            cap: 0.30, belly: 0.40, fat: 0.26 },
    tiny: { nose: 0.50, tail: -0.38, a: 0.55, b: 0.85, wrist: 0.22, top: 1.03, bot: 0.97, drop: 0.05,
            cap: 0.30, belly: 0.25, fat: 0.28 }
  };
  const isProfile = id => !!PROFILES[id];

  function profileAt(f, w, h) {
    const P = PROFILES[f.species];
    const pk = Math.pow(P.a / (P.a + P.b), P.a) * Math.pow(P.b / (P.a + P.b), P.b);
    const bend = f._bend || 0;
    /* Overfed: the belly drops, the back barely changes. Both edges come off
       the same curve the fins are rooted on, so the pelvic and anal fins ride
       out on the bulge instead of being swallowed by it. */
    const fat = fatK(f) * P.fat;
    return u => {
      const T = (1 - P.wrist) * Math.pow(u, P.a) * Math.pow(1 - u, P.b) / pk + P.wrist * Math.pow(u, 5);
      const x = (P.nose + (P.tail - P.nose) * u) * w;
      const mid = P.drop * h * (1 - u) * (1 - u) + bend * u * u;
      const g = fat * h * Math.pow(Math.sin(Math.min(1, u / 0.94) * Math.PI), 0.85);
      const top = mid - T * h * 0.5 * P.top - g * 0.20;
      const bot = mid + T * h * 0.5 * P.bot + g;
      return { u, x, mid, T, top, bot, half: (bot - top) * 0.5 };
    };
  }

  /* Smooth closed curve through points, by quadratics through the midpoints. */
  function smoothLoop(ctx, pts) {
    const n = pts.length;
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = m(pts[n - 1], pts[0]);
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = m(pts[i], pts[(i + 1) % n]);
      ctx.quadraticCurveTo(p[0], p[1], q[0], q[1]);
    }
    ctx.closePath();
  }

  /* Smooth open curve through points. */
  function smoothOpen(ctx, pts, move = true) {
    if (move) ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
  }

  function profilePath(ctx, f, w, h) {
    const at = profileAt(f, w, h);
    const N = 20;
    const s = boilSeed(f.id);
    const amp = w * 0.005 * wobbleAmt();
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = at(u);
      const n1 = (noise(s + i * 0.6, s + 5) - 0.5) * 2 * amp;
      const n2 = (noise(s + i * 0.6, s + 9) - 0.5) * 2 * amp;
      top.push([p.x, p.top + n1]);
      if (i > 0) bot.push([p.x, p.bot + n2]);
    }
    smoothLoop(ctx, top.concat(bot.reverse()));
  }

  /* ------------------------------------------------------------ outlines */

  /* Wobbly closed path through a list of [x,y] points, using the same boil as
     everything else so outlines shimmer rather than sit dead still. */
  function wobblePath(ctx, pts, id, amp) {
    const s = boilSeed(id);
    amp *= wobbleAmt();
    const out = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const n = noise(s + i * 0.6, s + 5);
      const o = (n - 0.5) * 2 * amp;
      const nx = -(q[1] - p[1]), ny = q[0] - p[0];
      const len = Math.hypot(nx, ny) || 1;
      return [p[0] + (nx / len) * o, p[1] + (ny / len) * o];
    });
    smoothLoop(ctx, out);
  }

  /* Anguilliform swimming: the whole body carries a wave that grows toward the
     tail. Built as a ribbon so the outline genuinely bends, rather than an oval
     that slides sideways. */
  function longSpine(S, phase, fat) {
    const pts = [];
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const t = i / N;                                   // 0 nose, 1 tail tip
      const amp = S * 0.088 * Math.pow(t, 1.4);
      const x = (0.46 - t * 0.92) * S;
      const y = Math.sin(t * Math.PI * 2.4 - (phase || 0)) * amp;
      /* An eel has no belly to hang; it goes fat as one swollen stretch of
         the trunk, the way a snake looks after a meal. */
      const girth = 1 + (fat || 0) * (0.14 + 0.62 * Math.pow(Math.sin(Math.min(1, t / 0.75) * Math.PI), 1.3));
      const r = (S * 0.150 * Math.sin(Math.pow(t, 0.62) * Math.PI) + S * 0.012) * girth;
      pts.push([x, y, r]);
    }
    return pts;
  }

  function bodyPath(ctx, f) {
    const { w, h } = dims(f);
    const amp = w * 0.012;

    if (isProfile(f.species)) { profilePath(ctx, f, w, h); return; }

    if (f.species === 'starfish') {
      /* Seen from above, a starfish cannot have a belly. A fat one is a
         plumper one: the webbing between the arms fills in, the arms thicken
         and shorten, and the tips go from points to blunt fingers. */
      const fat = fatK(f);
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / 5;
        const r = (i % 2 === 0 ? w * (0.50 - 0.035 * fat) : w * (0.22 + 0.13 * fat));
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      /* rounded arm tips: push extra points around each tip */
      const tipR = w * (0.05 + 0.035 * fat);
      const round = [];
      for (let i = 0; i < 10; i++) {
        const p = pts[i];
        if (i % 2 === 0) {
          const a = -Math.PI / 2 + (Math.PI * i) / 5;
          round.push([p[0] + Math.cos(a - 1.2) * tipR, p[1] + Math.sin(a - 1.2) * tipR]);
          round.push([p[0] + Math.cos(a) * w * 0.02, p[1] + Math.sin(a) * w * 0.02]);
          round.push([p[0] + Math.cos(a + 1.2) * tipR, p[1] + Math.sin(a + 1.2) * tipR]);
        } else round.push(p);
      }
      wobblePath(ctx, round, f.id, amp);
      return;
    }

    if (f.species === 'seahorse') {
      ribbonPath(ctx, seahorseSpine(w, f.coil, fatK(f)));
      return;
    }

    if (f.species === 'long') {
      ribbonPath(ctx, longSpine(w, f.wave, fatK(f)));
      return;
    }

    if (f.species === 'whale') {
      /* A whale is already round, so extra weight has to show as depth rather
         than width: the throat and belly drop, the back lifts only slightly,
         and the tail stock stays narrow or it stops reading as a whale. */
      const bb = 1 + fatK(f) * 0.38, tb = 1 + fatK(f) * 0.12;
      ctx.beginPath();
      ctx.moveTo(w * 0.50, h * 0.06 * bb);                                // snout
      ctx.bezierCurveTo(w * 0.44, -h * 0.44 * tb, -w * 0.06, -h * 0.52 * tb, -w * 0.28, -h * 0.30 * tb);
      ctx.bezierCurveTo(-w * 0.42, -h * 0.16, -w * 0.44, -h * 0.06, -w * 0.50, -h * 0.02);
      ctx.bezierCurveTo(-w * 0.44,  h * 0.10,       -w * 0.34,  h * 0.22 * bb, -w * 0.16,  h * 0.34 * bb);
      ctx.bezierCurveTo(w * 0.10,  h * 0.50 * bb,    w * 0.42,  h * 0.34 * bb,  w * 0.50,  h * 0.06 * bb);
      ctx.closePath();
      return;
    }

    if (f.species === 'shark') {
      /* a torpedo with a pointed snout at +x, tapering to a slim tail wrist.
         Fat on a shark is one thing only: a distended gut just behind the
         pectorals, with the snout and the tail stock left as lean as ever. */
      const g = fatK(f) * 0.62;
      ctx.beginPath();
      ctx.moveTo(w * 0.52,  h * 0.04);
      ctx.bezierCurveTo(w * 0.34, -h * (0.34 + 0.04 * g),  w * 0.02, -h * (0.42 + 0.05 * g), -w * 0.30, -h * 0.22);
      ctx.bezierCurveTo(-w * 0.40, -h * 0.16, -w * 0.44, -h * 0.10, -w * 0.46, -h * 0.03);
      ctx.bezierCurveTo(-w * 0.42,  h * 0.06, -w * 0.28,  h * (0.22 + 0.10 * g), -w * 0.04,  h * (0.30 + 0.34 * g));
      ctx.bezierCurveTo(w * 0.20,  h * (0.40 + 0.44 * g),  w * 0.42,  h * (0.24 + 0.22 * g),  w * 0.52,  h * 0.04);
      ctx.closePath();
      return;
    }

    if (f.species === 'manta') {
      /* top-down glider: a swept diamond, its wingtips flapping slowly.
         A manta is seen from above, so a dropped belly would be invisible: it
         goes fat across the central disc between the wings, which broadens
         while the wings keep their span (otherInside adds the hump that makes
         that read as bulk rather than as a bigger manta). */
      const fat = fatK(f);
      const d = 1 + fat * 0.85;                                 // the body disc
      const flap = Math.sin(frameCount * (f.wagSpeed || 0.06) + (f.phase || 0)) * h * 0.18 * (1 - fat * 0.3);
      ctx.beginPath();
      ctx.moveTo(w * 0.46, 0);
      ctx.bezierCurveTo(w * 0.30, -h * 0.16 * d,  w * 0.06, -h * 0.24 * d, -w * 0.14, -h * 0.50 - flap);
      ctx.bezierCurveTo(-w * 0.26, -h * 0.56 - flap, -w * 0.34, -h * 0.40, -w * 0.34, -h * 0.16 * d);
      ctx.bezierCurveTo(-w * 0.40, -h * 0.05 * d, -w * 0.40,  h * 0.05 * d, -w * 0.34,  h * 0.16 * d);
      ctx.bezierCurveTo(-w * 0.34,  h * 0.40, -w * 0.26,  h * 0.56 + flap, -w * 0.14,  h * 0.50 + flap);
      ctx.bezierCurveTo(w * 0.06,  h * 0.24 * d,  w * 0.30,  h * 0.16 * d,  w * 0.46, 0);
      ctx.closePath();
      return;
    }

    blobPath(ctx, 0, 0, w, h, f.id, 30, amp);
  }

  /* --------------------------------------------------------------- fins */

  const cubic = (a, b, c, d, t) => {
    const u = 1 - t;
    return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
            u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
  };

  /* A fin: rooted along b0→b1 on the body, its free edge a cubic b0→c1→c2→b1.
     `scallop` frills the edge (the goldfish and the eel have soft, ruffled
     fins), `rays` is how many pale rays fan across it. Drawn flat in the fin
     colour, inked, rays on top. */
  function fin(ctx, b0, b1, c1, c2, o = {}) {
    const N = 22;
    const edge = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let p = cubic(b0, c1, c2, b1, t);
      if (o.scallop) {
        const base = [b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t];
        let dx = p[0] - base[0], dy = p[1] - base[1];
        const len = Math.hypot(dx, dy) || 1;
        const k = o.scallop * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 * (o.lobes || 5)));
        p = [p[0] + dx / len * k * len * 0.35, p[1] + dy / len * k * len * 0.35];
      }
      edge.push(p);
    }
    ctx.beginPath();
    smoothOpen(ctx, edge);
    ctx.closePath();
    ctx.fillStyle = o.fill || S.fin;
    ctx.fill();
    inkStroke(ctx, 0.85);
    rays(ctx, t => [b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t],
         t => edge[Math.round(t * N)], o.rays == null ? 5 : o.rays);
  }

  /* Pale rays from the root out toward the edge — the fine lines on every fin
     in the reference. */
  function rays(ctx, root, tip, n) {
    const k = Look.v.finRays;
    if (k < 0.01 || n < 1) return;
    ctx.save();
    ctx.strokeStyle = S.finRay;
    ctx.globalAlpha *= Math.min(1, k * 1.2);
    ctx.lineWidth = Math.max(0.5, LW * 0.55);
    ctx.lineCap = 'round';
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const a = root(t), b = tip(t);
      ctx.beginPath();
      ctx.moveTo(a[0] + (b[0] - a[0]) * 0.18, a[1] + (b[1] - a[1]) * 0.18);
      ctx.lineTo(a[0] + (b[0] - a[0]) * 0.80, a[1] + (b[1] - a[1]) * 0.80);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* A forked caudal fin hung off the wrist: two broad lobes with convex
     leading edges and a concave fork between them. `swing` (−1..1) is where
     the tail is in its beat — the lobes sweep up/down and foreshorten as they
     turn. `notch` is how deep the fork cuts (0 none, 1 to the wrist); `round`
     blunts the lobe tips, for the goldfish's fan. */
  function tailFin(ctx, wx, wy, wh, len, spread, swing, o = {}) {
    const L = len * (1 - 0.22 * Math.abs(swing));
    const dy = swing * spread * 0.32;
    const notch = o.notch == null ? 0.55 : o.notch;
    const rd = o.round || 0;
    const b0 = [wx + len * 0.08, wy - wh * 0.9], b1 = [wx + len * 0.08, wy + wh * 0.9];
    const U = [wx - L, wy - spread + dy], D = [wx - L * 0.96, wy + spread * 0.94 + dy];
    const N = [wx - L * (1 - notch), wy + dy * 0.7];
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(b0[0], b0[1]);
      ctx.bezierCurveTo(wx - L * 0.30, wy - wh - spread * 0.25, U[0] + L * (0.30 - rd * 0.1), U[1] - spread * (0.05 + rd * 0.25),
                        U[0], U[1]);
      ctx.bezierCurveTo(U[0] - L * rd * 0.18, U[1] + spread * (0.25 + rd * 0.2), N[0] - L * 0.10, N[1] - spread * 0.35, N[0], N[1]);
      ctx.bezierCurveTo(N[0] - L * 0.10, N[1] + spread * 0.35, D[0] - L * rd * 0.18, D[1] - spread * (0.25 + rd * 0.2), D[0], D[1]);
      ctx.bezierCurveTo(D[0] + L * (0.30 - rd * 0.1), D[1] + spread * (0.05 + rd * 0.25), wx - L * 0.30, wy + wh + spread * 0.25,
                        b1[0], b1[1]);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = S.fin;
    ctx.fill();
    inkStroke(ctx, 0.9);
    // rays fan from the wrist out to the trailing edge
    const k = Look.v.finRays;
    if (k > 0.01) {
      ctx.save();
      path(); ctx.clip();
      ctx.strokeStyle = S.finRay;
      ctx.globalAlpha *= Math.min(1, k * 1.2);
      ctx.lineWidth = Math.max(0.5, LW * 0.55);
      ctx.lineCap = 'round';
      const n = o.rays || 7;
      const edge = t => t < 0.5
        ? [U[0] + (N[0] - U[0]) * t * 2, U[1] + (N[1] - U[1]) * t * 2]
        : [N[0] + (D[0] - N[0]) * (t - 0.5) * 2, N[1] + (D[1] - N[1]) * (t - 0.5) * 2];
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const e = edge(t);
        const sx = wx - len * 0.04, sy = wy + (t - 0.5) * wh * 1.2;
        const ex = sx + (e[0] - sx) * 0.82, ey = sy + (e[1] - sy) * 0.82;
        ctx.beginPath();
        ctx.moveTo(sx + (e[0] - sx) * 0.15, sy + (e[1] - sy) * 0.15);
        ctx.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 + (t - 0.5) * spread * 0.15, ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------------------------------------------- profile fishes */

  /* The fins that hang behind a profile fish: tail, dorsal, and the small
     pelvic and anal fins under the belly. */
  function profileBehind(ctx, f, w, h, wag, swing) {
    const at = profileAt(f, w, h);
    const sp = f.species;
    const end = at(1);
    const pt = (u, side) => { const p = at(u); return [p.x, side < 0 ? p.top : p.bot]; };

    if (sp === 'deep') {
      // a goldfish's flowing double tail and a tall, rounded sail of a dorsal
      tailFin(ctx, end.x, end.mid, end.half, w * 0.44, h * 0.60, swing,
              { notch: 0.38, round: 1, rays: 9 });
      const a = pt(0.30, -1), b = pt(0.70, -1);
      fin(ctx, a, b, [a[0] - w * 0.02, a[1] - h * 0.62], [b[0] - w * 0.02, b[1] - h * 0.40],
          { scallop: 0.35, lobes: 4, rays: 6 });
      const p0 = pt(0.42, 1), p1 = pt(0.56, 1);
      fin(ctx, p0, p1, [p0[0] - w * 0.06, p0[1] + h * 0.36], [p1[0] - w * 0.10, p1[1] + h * 0.30],
          { rays: 3 });
      const q0 = pt(0.72, 1), q1 = pt(0.86, 1);
      fin(ctx, q0, q1, [q0[0] - w * 0.08, q0[1] + h * 0.26], [q1[0] - w * 0.10, q1[1] + h * 0.18],
          { rays: 3, scallop: 0.4, lobes: 2 });
      return;
    }

    if (sp === 'tiny') {
      tailFin(ctx, end.x, end.mid, end.half, w * 0.30, h * 0.52, swing, { notch: 0.5, round: 0.4, rays: 5 });
      const a = pt(0.40, -1), b = pt(0.66, -1);
      fin(ctx, a, b, [a[0] - w * 0.06, a[1] - h * 0.38], [b[0] - w * 0.02, b[1] - h * 0.16], { rays: 3 });
      const q0 = pt(0.62, 1), q1 = pt(0.82, 1);
      fin(ctx, q0, q1, [q0[0] - w * 0.06, q0[1] + h * 0.30], [q1[0] - w * 0.04, q1[1] + h * 0.12], { rays: 2 });
      return;
    }

    // the plain fish: long and lean, a big forked tail and a swept dorsal
    tailFin(ctx, end.x, end.mid, end.half, w * 0.36, h * 0.66, swing, { notch: 0.6, round: 0.3, rays: 8 });
    const a = pt(0.34, -1), b = pt(0.66, -1);
    fin(ctx, a, b, [a[0] - w * 0.04, a[1] - h * 0.62], [b[0] - w * 0.04, b[1] - h * 0.38], { rays: 5 });
    const p0 = pt(0.36, 1), p1 = pt(0.48, 1);
    fin(ctx, p0, p1, [p0[0] - w * 0.08, p0[1] + h * 0.40], [p1[0] - w * 0.10, p1[1] + h * 0.28], { rays: 3 });
    const q0 = pt(0.66, 1), q1 = pt(0.80, 1);
    fin(ctx, q0, q1, [q0[0] - w * 0.06, q0[1] + h * 0.34], [q1[0] - w * 0.08, q1[1] + h * 0.18], { rays: 3 });
  }

  /* Inside the body clip: belly band, a little shading, markings, the head
     cap with its cheek band and gill line, and the gloss. */
  function profileInside(ctx, f, w, h) {
    const at = profileAt(f, w, h);
    const P = PROFILES[f.species];
    const sp = f.species;
    const N = 18;
    const v = Look.v;

    // belly band
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = at(i / N);
      const y = p.mid + p.half * P.belly;
      i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y);
    }
    ctx.lineTo(-w, h); ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = S.belly;
    ctx.fill();

    shading(ctx, w, h);

    // markings
    if (v.marks > 0.01) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, v.marks);
      ctx.strokeStyle = S.mark;
      ctx.fillStyle = S.mark;
      ctx.lineCap = 'round';
      if (sp === 'fish') {
        // rows of little dashes, the lateral-line ticks of the reference
        ctx.lineWidth = Math.max(0.7, LW * 0.75);
        [-0.50, -0.12, 0.30].forEach((r, row) => {
          for (let u = 0.34 + row * 0.035; u < 0.88; u += 0.075) {
            const p = at(u);
            const y = p.mid + p.half * r;
            const dl = w * 0.016;
            ctx.beginPath(); ctx.moveTo(p.x - dl, y); ctx.lineTo(p.x + dl, y); ctx.stroke();
          }
        });
      } else if (sp === 'deep') {
        // red blotches on the shoulder, and rows of scale crescents
        ctx.globalAlpha *= 0.85;
        for (const [u, r, s] of [[0.40, -0.68, 0.11], [0.58, -0.62, 0.08], [0.50, -0.5, 0.05]]) {
          const p = at(u);
          ctx.beginPath(); ctx.ellipse(p.x, p.mid + p.half * r, w * s, w * s * 0.55, -0.15, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha /= 0.85;
        ctx.lineWidth = Math.max(0.8, LW * 0.9);
        const s = w * 0.05;
        [-0.55, -0.22, 0.10, 0.42].forEach((r, row) => {
          for (let u = 0.36 + (row % 2) * 0.05; u < 0.86; u += 0.10) {
            const p = at(u);
            if (Math.abs(r) * p.half > p.half * 0.9) continue;
            const x = p.x, y = p.mid + p.half * r;
            ctx.beginPath();
            ctx.arc(x + s * 0.55, y, s * 0.6, Math.PI * 0.62, Math.PI * 1.38);
            ctx.stroke();
          }
        });
      } else if (sp === 'tiny') {
        // two tiny "3" ticks
        ctx.lineWidth = Math.max(0.6, LW * 0.7);
        for (const u of [0.52, 0.66]) {
          const p = at(u);
          const r = w * 0.025;
          ctx.beginPath();
          ctx.arc(p.x, p.mid - r * 0.9, r, -Math.PI * 0.6, Math.PI * 0.5);
          ctx.arc(p.x, p.mid + r * 0.9, r, -Math.PI * 0.5, Math.PI * 0.6);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    /* The fold where a full belly starts: a short arc at the leading edge of
       the bulge, just behind the pectoral. Any longer and it stops reading as
       a crease in the skin and starts reading as a mark drawn on the fish. */
    const fat = fatK(f);
    if (fat > 0.02) {
      ctx.save();
      ctx.globalAlpha *= 0.30 * fat;
      ctx.strokeStyle = S.shadow;
      ctx.lineWidth = Math.max(0.7, LW * 0.9);
      ctx.lineCap = 'round';
      const cr = [];
      for (let u = P.cap + 0.05; u <= P.cap + 0.19; u += 0.035) {
        const q = at(u);
        cr.push([q.x, q.mid + q.half * (0.34 + 3.4 * (u - P.cap - 0.05))]);
      }
      ctx.beginPath(); smoothOpen(ctx, cr); ctx.stroke();
      ctx.restore();
    }

    // head cap: everything forward of the gill line, with the cheek band behind it
    const c0 = at(P.cap), c1 = at(P.cap + 0.05);
    const bulge = w * 0.07 * (1 + fat * 0.6);
    const gill = () => {
      ctx.moveTo(c0.x, c0.top - h * 0.1);
      ctx.quadraticCurveTo((c0.x + c1.x) / 2 - bulge * 2, (c0.mid + c1.mid) / 2, c1.x, c1.bot + h * 0.1);
    };
    ctx.beginPath(); gill();
    ctx.strokeStyle = S.cheek;
    ctx.lineWidth = w * 0.06;
    ctx.stroke();
    ctx.beginPath(); gill();
    ctx.lineTo(w, h); ctx.lineTo(w, -h);
    ctx.closePath();
    ctx.fillStyle = S.head;
    ctx.fill();
    ctx.beginPath(); gill();
    inkStroke(ctx, 0.8);

    // the wet gloss: a streak along the back and a fleck on the head
    if (v.gloss > 0.01) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, v.gloss);
      ctx.strokeStyle = S.gloss;
      ctx.lineCap = 'round';
      ctx.lineWidth = h * (sp === 'deep' ? 0.06 : 0.075);
      const pts = [];
      for (let u = 0.36; u <= 0.58; u += 0.02) {
        const p = at(u);
        pts.push([p.x, p.top + p.half * 0.32]);
      }
      ctx.beginPath(); smoothOpen(ctx, pts); ctx.stroke();
      const d = at(0.64);
      ctx.beginPath(); ctx.moveTo(d.x + w * 0.005, d.top + d.half * 0.36); ctx.lineTo(d.x - w * 0.01, d.top + d.half * 0.38); ctx.stroke();
      const hd = at(0.10);
      ctx.lineWidth = h * 0.05;
      ctx.beginPath(); ctx.moveTo(hd.x + w * 0.02, hd.top + hd.half * 0.5); ctx.lineTo(hd.x - w * 0.03, hd.top + hd.half * 0.32); ctx.stroke();
      ctx.restore();
    }
  }

  /* Pectoral fin, laid over the body just behind the gill line. */
  function profileFront(ctx, f, w, h, wag) {
    const at = profileAt(f, w, h);
    const P = PROFILES[f.species];
    const p = at(P.cap + 0.07);
    const x = p.x, y = p.mid + p.half * 0.25;
    const flap = Math.sin(frameCount * (f.wagSpeed || 0.2) * 1.3 + (f.phase || 0)) * 0.18;
    const L = w * (f.species === 'deep' ? 0.20 : 0.15);
    const a = 0.55 + flap;
    const tip = [x - Math.cos(a) * L, y + Math.sin(a) * L];
    fin(ctx, [x + w * 0.01, y - h * 0.04], [x, y + h * 0.05],
        [tip[0] + w * 0.02, tip[1] - h * 0.18], [tip[0] - w * 0.02, tip[1] + h * 0.02], { rays: 3 });
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
  function seahorseSpine(S, coil, fat) {
    const c = coil == null ? 1 : Math.max(0, Math.min(1, coil));
    const sp = smoothSpine(SEAHORSE_BODY, 7);
    /* A seahorse carries everything out in front: the back stays the same
       straight armoured line and the belly/pouch swells forward. Widening the
       ribbon and shifting the centreline bellywards by the same amount leaves
       the back edge exactly where it was and pushes only the front out. */
    if (fat > 0.001) {
      const n = sp.length;
      const bs = spineNormal(sp, Math.round(n * 0.22))[0] < 0 ? 1 : -1;
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n - 0.30) / 0.42;                  // the trunk, not the head
        const k = (t < 0 || t > 1) ? 0 : fat * 0.55 * Math.pow(Math.sin(t * Math.PI), 0.8);
        const nr = spineNormal(sp, i);
        out.push([sp[i][0] - nr[0] * bs * sp[i][2] * k,
                  sp[i][1] - nr[1] * bs * sp[i][2] * k,
                  sp[i][2] * (1 + k)]);
      }
      for (let i = 0; i < n; i++) sp[i] = out[i];
    }
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

  /* unit normal at spine index i */
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

  /* One side band along a spine, between offsets k0 and k1 of the half-width,
     over spine indices i0..i1 — bellies, back stripes, cap bands. */
  function sideBand(ctx, sp, i0, i1, k0, k1, sign) {
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const n = spineNormal(sp, i), p = sp[i];
      const x = p[0] + n[0] * sign * p[2] * k0, y = p[1] + n[1] * sign * p[2] * k0;
      i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let i = i1; i >= i0; i--) {
      const n = spineNormal(sp, i), p = sp[i];
      ctx.lineTo(p[0] + n[0] * sign * p[2] * k1, p[1] + n[1] * sign * p[2] * k1);
    }
    ctx.closePath();
  }

  /* Which normal direction is the back? Sampled at the nape, where the back is
     unambiguously the side further from the belly's forward bulge. */
  function backSign(sp) {
    const i = Math.round(sp.length * 0.22);
    return spineNormal(sp, i)[0] < 0 ? 1 : -1;
  }

  function seahorseBehind(ctx, f, W, wag) {
    const sp = seahorseSpine(W, f.coil, fatK(f));
    const bs = backSign(sp);

    // the big dorsal fan, riding the back of the mid body
    const i0 = Math.round(sp.length * AT.finFrom), i1 = Math.round(sp.length * AT.finTo);
    const outer = [];
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const t = (i - i0) / (i1 - i0);
      const bell = Math.pow(Math.sin(t * Math.PI), 0.55);
      const scallop = 1 + 0.07 * Math.sin(t * Math.PI * 7);
      const n = spineNormal(sp, i), p = sp[i];
      const reach = (p[2] + W * (0.05 + 0.235 * bell)) * scallop + wag * 0.22 * bell;
      const x = p[0] + n[0] * bs * reach, y = p[1] + n[1] * bs * reach;
      outer.push([x, y, i]);
      i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let i = i1; i >= i0; i--) {
      const n = spineNormal(sp, i), p = sp[i];
      ctx.lineTo(p[0] + n[0] * bs * p[2] * 0.9, p[1] + n[1] * bs * p[2] * 0.9);
    }
    ctx.closePath();
    ctx.fillStyle = S.fin;
    ctx.fill();
    inkStroke(ctx, 0.85);
    const rayList = outer.filter(o => (o[2] - i0) % 5 === 0);
    rays(ctx, t => {
      const o = rayList[Math.round(t * (rayList.length - 1))];
      const p = sp[o[2]], n = spineNormal(sp, o[2]);
      return [p[0] + n[0] * bs * p[2] * 0.9, p[1] + n[1] * bs * p[2] * 0.9];
    }, t => rayList[Math.round(t * (rayList.length - 1))], Math.max(1, rayList.length - 2));

    // spiny ridge down the nape, and the coronet, in the cheek colour
    const spike = (bx, by, nx, ny, tx, ty, base, len, half) => {
      ctx.beginPath();
      ctx.moveTo(bx + nx * base - tx * half, by + ny * base - ty * half);
      ctx.lineTo(bx + nx * (base + len), by + ny * (base + len));
      ctx.lineTo(bx + nx * base + tx * half, by + ny * base + ty * half);
      ctx.closePath();
      ctx.fillStyle = S.cheek;
      ctx.fill();
      inkStroke(ctx, 0.7);
    };
    for (let k = 0; k < 5; k++) {
      const i = Math.round(sp.length * (AT.napeFrom + k * AT.napeStep));
      const p = sp[i], n = spineNormal(sp, i);
      spike(p[0], p[1], n[0] * bs, n[1] * bs, -n[1] * bs, n[0] * bs,
            p[2] * 0.95, W * (0.075 - k * 0.006), W * 0.035);
    }
    const hi = Math.round(sp.length * AT.crown);
    const hp = sp[hi], hn = spineNormal(sp, hi);
    for (let k = -1; k <= 1; k++) {
      const t = [-hn[1] * bs, hn[0] * bs];
      const off = k * W * 0.055;
      spike(hp[0] + t[0] * off, hp[1] + t[1] * off, hn[0] * bs, hn[1] * bs, t[0], t[1],
            hp[2] * 0.6, hp[2] * 0.4 + W * (k === 0 ? 0.135 : 0.10), W * 0.028);
    }
  }

  function seahorseInside(ctx, f, W) {
    const sp = seahorseSpine(W, f.coil, fatK(f));
    const bs = backSign(sp);
    const n = sp.length;
    // the belly: the front edge of the body, down to the tail
    sideBand(ctx, sp, Math.round(n * 0.16), Math.round(n * 0.62), 0.15, 1.3, -bs);
    ctx.fillStyle = S.belly;
    ctx.fill();
    shading(ctx, W, W * 1.9);
    // the head and snout in the cap colour
    ctx.beginPath();
    const hi = Math.round(n * 0.2);
    const p = sp[hi], nn = spineNormal(sp, hi);
    ctx.moveTo(p[0] + nn[0] * p[2] * 1.4, p[1] + nn[1] * p[2] * 1.4);
    ctx.lineTo(p[0] - nn[0] * p[2] * 1.4, p[1] - nn[1] * p[2] * 1.4);
    ctx.lineTo(W, -W * 1.2); ctx.lineTo(W, -W * 0.2);
    ctx.closePath();
    ctx.fillStyle = S.head;
    ctx.fill();
    // bony segment rings across the spine
    if (Look.v.marks > 0.01) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, Look.v.marks);
      ctx.strokeStyle = S.mark;
      ctx.lineWidth = Math.max(0.6, LW * 0.75);
      ctx.lineCap = 'round';
      for (let i = Math.round(n * AT.rings) + 3; i < n - 2; i += 5) {
        const q = sp[i], m = spineNormal(sp, i);
        ctx.beginPath();
        ctx.moveTo(q[0] + m[0] * q[2] * 0.7, q[1] + m[1] * q[2] * 0.7);
        ctx.lineTo(q[0] - m[0] * q[2] * 0.7, q[1] - m[1] * q[2] * 0.7);
        ctx.stroke();
      }
      ctx.restore();
    }
    // gloss down the back
    if (Look.v.gloss > 0.01) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, Look.v.gloss);
      ctx.strokeStyle = S.gloss;
      ctx.lineCap = 'round';
      ctx.lineWidth = W * 0.035;
      const pts = [];
      for (let i = Math.round(n * 0.22); i < Math.round(n * 0.36); i++) {
        const q = sp[i], m = spineNormal(sp, i);
        pts.push([q[0] + m[0] * bs * q[2] * 0.55, q[1] + m[1] * bs * q[2] * 0.55]);
      }
      ctx.beginPath(); smoothOpen(ctx, pts); ctx.stroke();
      ctx.restore();
    }
  }

  function seahorseFront(ctx, f, W) {
    const sp = seahorseSpine(W, f.coil, fatK(f));
    const bs = backSign(sp);
    const i = Math.round(sp.length * AT.pectoral);
    const p = sp[i], n = spineNormal(sp, i);
    const cx = p[0] - n[0] * bs * p[2] * 0.45, cy = p[1] - n[1] * bs * p[2] * 0.45;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(n[1], n[0]) + Math.sin(frameCount * 0.3 + f.phase) * 0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.065, W * 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = S.fin;
    ctx.fill();
    inkStroke(ctx, 0.7);
    ctx.restore();
  }

  /* -------------------------------------------------------------- eel */

  function longBehind(ctx, f, w, h) {
    const ln = longSpine(w, f.wave, fatK(f));
    const N = ln.length;
    // a frilled fin running the length of the back, and another underneath
    const frill = (from, to, sign, reach, lobes) => {
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const p = ln[i], n = spineNormal(ln, i);
        const t = (i - from) / (to - from);
        const r = p[2] + w * reach * Math.pow(Math.sin(t * Math.PI), 0.7) *
                  (0.82 + 0.18 * Math.cos(t * Math.PI * 2 * lobes));
        const x = p[0] + n[0] * sign * r, y = p[1] + n[1] * sign * r;
        i === from ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let i = to; i >= from; i--) {
        const p = ln[i], n = spineNormal(ln, i);
        ctx.lineTo(p[0] + n[0] * sign * p[2] * 0.8, p[1] + n[1] * sign * p[2] * 0.8);
      }
      ctx.closePath();
      ctx.fillStyle = S.fin;
      ctx.fill();
      inkStroke(ctx, 0.85);
      rays(ctx, t => {
        const i = Math.round(from + t * (to - from)), p = ln[i], n = spineNormal(ln, i);
        return [p[0] + n[0] * sign * p[2], p[1] + n[1] * sign * p[2]];
      }, t => {
        const i = Math.round(from + t * (to - from)), p = ln[i], n = spineNormal(ln, i);
        const r = p[2] + w * reach * Math.pow(Math.sin(t * Math.PI), 0.7);
        return [p[0] + n[0] * sign * r, p[1] + n[1] * sign * r];
      }, 9);
    };
    frill(6, N - 6, 1, 0.075, 4);
    frill(13, N - 4, -1, 0.06, 3);
    // a rounded tail fin
    const last = ln[N - 1], prev = ln[N - 4];
    ctx.save();
    ctx.translate(last[0], last[1]);
    ctx.rotate(Math.atan2(last[1] - prev[1], last[0] - prev[0]));
    ctx.beginPath();
    ctx.moveTo(-w * 0.02, -h * 0.08);
    ctx.bezierCurveTo(w * 0.12, -h * 0.42, w * 0.20, -h * 0.10, w * 0.15, 0);
    ctx.bezierCurveTo(w * 0.20, h * 0.10, w * 0.12, h * 0.42, -w * 0.02, h * 0.08);
    ctx.closePath();
    ctx.fillStyle = S.fin;
    ctx.fill();
    inkStroke(ctx, 0.85);
    ctx.restore();
  }

  function longInside(ctx, f, w, h) {
    const ln = longSpine(w, f.wave, fatK(f));
    const N = ln.length;
    // the pale belly stripe all the way along
    sideBand(ctx, ln, 0, N - 1, 0.25, 1.4, -1);
    ctx.fillStyle = S.belly;
    ctx.fill();
    // a dark mark line along the flank, as on the reference's eel
    if (Look.v.marks > 0.01) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, Look.v.marks);
      sideBand(ctx, ln, 7, N - 8, -0.05, 0.22, -1);
      ctx.fillStyle = S.mark;
      ctx.fill();
      ctx.restore();
    }
    shading(ctx, w, h);
    // head in the cap colour, cheek band behind it
    const ci = 5, p = ln[ci], n = spineNormal(ln, ci);
    const cut = () => {
      ctx.moveTo(p[0] + n[0] * p[2] * 1.3, p[1] + n[1] * p[2] * 1.3);
      ctx.quadraticCurveTo(p[0] - w * 0.04, p[1], p[0] - n[0] * p[2] * 1.3, p[1] - n[1] * p[2] * 1.3);
    };
    ctx.beginPath(); cut();
    ctx.strokeStyle = S.cheek; ctx.lineWidth = w * 0.035; ctx.stroke();
    ctx.beginPath(); cut(); ctx.lineTo(w, h); ctx.lineTo(w, -h); ctx.closePath();
    ctx.fillStyle = S.head; ctx.fill();
    ctx.beginPath(); cut(); inkStroke(ctx, 0.8);
    // gloss: two streaks on the back
    if (Look.v.gloss > 0.01) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, Look.v.gloss);
      ctx.strokeStyle = S.gloss;
      ctx.lineCap = 'round';
      ctx.lineWidth = h * 0.08;
      for (const [a, b] of [[7, 12], [14, 16]]) {
        const pts = [];
        for (let i = a; i <= b; i++) {
          const q = ln[i], m = spineNormal(ln, i);
          pts.push([q[0] + m[0] * q[2] * 0.5, q[1] + m[1] * q[2] * 0.5]);
        }
        ctx.beginPath(); smoothOpen(ctx, pts); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------- whale, shark, manta, star */

  function otherBehind(ctx, f, w, h, wag) {
    ctx.fillStyle = S.fin;
    if (f.species === 'whale') {
      ctx.beginPath();
      ctx.moveTo(-w * 0.44, -h * 0.04);
      ctx.bezierCurveTo(-w * 0.62, -h * 0.34 + wag, -w * 0.80, -h * 0.30 + wag, -w * 0.76, -h * 0.06 + wag);
      ctx.bezierCurveTo(-w * 0.80,  h * 0.20 + wag, -w * 0.62,  h * 0.26 + wag, -w * 0.44,  h * 0.04);
      ctx.closePath();
      ctx.fill(); inkStroke(ctx, 0.9);
      return;
    }
    if (f.species === 'shark') {
      tailFin(ctx, -w * 0.44, 0, h * 0.08, w * 0.28, h * 0.62, Math.max(-1, Math.min(1, wag / (w * 0.09))), { notch: 0.5, rays: 5 });
      fin(ctx, [w * 0.04, -h * 0.36], [-w * 0.18, -h * 0.30], [-w * 0.02, -h * 0.80], [-w * 0.12, -h * 1.0], { rays: 4 });
      fin(ctx, [-w * 0.24, -h * 0.24], [-w * 0.34, -h * 0.20], [-w * 0.28, -h * 0.44], [-w * 0.34, -h * 0.52], { rays: 2 });
      return;
    }
    if (f.species === 'manta') {
      ctx.beginPath();
      ctx.moveTo(-w * 0.32, 0);
      ctx.quadraticCurveTo(-w * 0.58, h * 0.04 + wag * 0.4, -w * 0.88, h * 0.10 + wag);
      inkStroke(ctx, 1.4);
      fin(ctx, [w * 0.40, -h * 0.06], [w * 0.42, h * 0.02], [w * 0.56, -h * 0.20], [w * 0.64, -h * 0.12], { rays: 0 });
      fin(ctx, [w * 0.42, -h * 0.02], [w * 0.40, h * 0.06], [w * 0.64, h * 0.12], [w * 0.56, h * 0.20], { rays: 0 });
    }
  }

  function otherInside(ctx, f, w, h) {
    const v = Look.v;
    if (f.species === 'starfish') {
      // pale ridges down each arm, a centre disc, rows of bumps
      ctx.strokeStyle = S.belly;
      ctx.lineCap = 'round';
      ctx.lineWidth = w * 0.08;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * w * 0.44, Math.sin(a) * w * 0.44); ctx.stroke();
      }
      shading(ctx, w, h);
      ctx.fillStyle = S.head;
      ctx.beginPath(); ctx.arc(0, 0, w * (0.13 + 0.075 * fatK(f)), 0, Math.PI * 2); ctx.fill();
      if (v.marks > 0.01) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, v.marks);
        ctx.fillStyle = S.mark;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
          for (let k = 1; k <= 3; k++) {
            const r = w * (0.12 + 0.1 * k);
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, Math.sin(a) * r, w * (0.026 - k * 0.004), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      return;
    }

    if (f.species === 'whale') {
      const bb = 1 + fatK(f) * 0.38;
      ctx.beginPath();
      ctx.moveTo(w * 0.52, h * 0.08 * bb);
      ctx.bezierCurveTo(w * 0.2, h * 0.16 * bb, -w * 0.2, h * 0.14 * bb, -w * 0.5, h * 0.0);
      ctx.lineTo(-w * 0.5, h); ctx.lineTo(w * 0.6, h); ctx.closePath();
      ctx.fillStyle = S.belly; ctx.fill();
      gutCrease(ctx, f, w, h, 0.34, 1.0 + fatK(f) * 0.4);
      if (v.marks > 0.01) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, v.marks);
        ctx.strokeStyle = S.mark;
        ctx.lineWidth = Math.max(0.6, LW * 0.7);
        for (let i = 0; i < 5; i++) {
          const y = h * (0.20 + i * 0.065);
          ctx.beginPath();
          ctx.moveTo(w * 0.02, y);
          ctx.bezierCurveTo(w * 0.2, y + h * 0.05, w * 0.36, y + h * 0.02, w * 0.44, y - h * 0.04);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (f.species === 'shark') {
      const g = fatK(f) * 0.62;
      ctx.beginPath();
      ctx.moveTo(w * 0.54, h * 0.05);
      ctx.bezierCurveTo(w * 0.2, h * (0.02 + 0.26 * g), -w * 0.2, h * (0.06 + 0.16 * g), -w * 0.5, 0);
      ctx.lineTo(-w * 0.5, h); ctx.lineTo(w * 0.6, h); ctx.closePath();
      ctx.fillStyle = S.belly; ctx.fill();
      gutCrease(ctx, f, w, h, 0.30, 1.0 + fatK(f) * 1.1);
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const gx = w * (0.18 - i * 0.04);
        ctx.beginPath();
        ctx.moveTo(gx, -h * 0.18);
        ctx.quadraticCurveTo(gx - w * 0.025, 0, gx, h * 0.16);
        inkStroke(ctx, 0.7);
      }
      ctx.restore();
    } else if (f.species === 'manta') {
      if (v.marks > 0.01) {
        ctx.fillStyle = S.belly;
        for (const [x, y, r] of [[0.08, -0.18, 0.05], [0.0, 0.2, 0.045], [-0.12, -0.08, 0.035], [0.14, 0.08, 0.03]]) {
          ctx.beginPath(); ctx.arc(w * x, h * y, w * r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = S.head;
      ctx.beginPath(); ctx.ellipse(w * 0.30, 0, w * 0.12, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      /* Seen from above, bulk can only show as a dome, and a dome reads as a
         lit top falling away to shade where it meets the wings. A ring of
         shadow around a clear centre is the whole of that. */
      const fat = fatK(f);
      if (fat > 0.01) {
        ctx.save();
        ctx.globalAlpha *= 0.55 * fat;
        const R = w * 0.34;
        const g = ctx.createRadialGradient(-w * 0.02, 0, R * 0.25, -w * 0.02, 0, R);
        g.addColorStop(0, Col.rgba(S.shadow, 0));
        g.addColorStop(0.65, Col.rgba(S.shadow, 0.35));
        g.addColorStop(1, Col.rgba(S.shadow, 0.85));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(-w * 0.02, 0, R, h * 0.40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    shading(ctx, w, h);
    if (v.gloss > 0.01 && f.species !== 'manta') {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, v.gloss);
      ctx.strokeStyle = S.gloss;
      ctx.lineCap = 'round';
      ctx.lineWidth = h * 0.06;
      ctx.beginPath();
      ctx.moveTo(w * 0.22, -h * 0.30);
      ctx.quadraticCurveTo(w * 0.05, -h * 0.40, -w * 0.12, -h * 0.34);
      ctx.stroke();
      ctx.restore();
    }
  }

  function otherFront(ctx, f, w, h) {
    if (f.species === 'whale') {
      fin(ctx, [w * 0.08, h * 0.16], [-w * 0.02, h * 0.22],
          [w * 0.04, h * 0.52], [-w * 0.18, h * 0.50], { rays: 0 });
    } else if (f.species === 'shark') {
      fin(ctx, [w * 0.20, h * 0.14], [w * 0.08, h * 0.20],
          [w * 0.12, h * 0.56], [-w * 0.02, h * 0.64], { rays: 3 });
    }
  }

  /* The fold a full gut makes against the flank. Drawn inside the body clip,
     in the body's own shadow colour, so it reads as the skin creasing rather
     than as a line drawn on top of the animal. */
  function gutCrease(ctx, f, w, h, x0, depth) {
    const fat = fatK(f);
    if (fat < 0.02 || Look.v.ink < 0.01) return;
    ctx.save();
    ctx.globalAlpha *= 0.30 * fat;
    ctx.strokeStyle = S.shadow;
    ctx.lineWidth = Math.max(0.7, LW * 0.9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * x0, h * 0.08 * depth);
    ctx.quadraticCurveTo(w * (x0 - 0.04), h * 0.30 * depth, w * (x0 - 0.16), h * 0.40 * depth);
    ctx.stroke();
    ctx.restore();
  }

  /* A soft bottom-side shade inside the body, so the flat colour still reads
     as round. Dialled by 'shading'. */
  function shading(ctx, w, h) {
    const k = Look.v.shading;
    if (k < 0.01) return;
    const g = ctx.createLinearGradient(0, -h * 0.1, 0, h * 0.6);
    g.addColorStop(0, Col.rgba(S.shadow, 0));
    g.addColorStop(1, Col.rgba(S.shadow, Math.min(0.8, 0.9 * k)));
    ctx.fillStyle = g;
    ctx.fillRect(-w, -h, w * 2, h * 2);
  }

  /* --------------------------------------------------------------- draw */

  function draw(f) {
    const ctx = drawingContext;
    const { w, h } = dims(f);
    /* Advance the fat ease once per frame, here, so every shape drawn this
       frame agrees about how fat the animal currently is. */
    const wantFat = f.fat ? 1 : 0;
    f._fatAmt = f._fatAmt == null ? wantFat : f._fatAmt + (wantFat - f._fatAmt) * 0.04;
    /* Effort is how hard the creature is currently working: a fish that has
       finished its burst and is gliding holds its tail almost still. */
    const effort = f.effort == null ? 1 : f.effort;
    /* Carrying the weight costs something: the tail beats harder and slower. */
    const beat = frameCount * f.wagSpeed * (1 - 0.25 * fatK(f)) + f.phase;
    const amt = (0.18 + 0.82 * effort) * (1 + (f.talk || 0) * 2) * (1 + 0.35 * fatK(f));
    const wag = Math.sin(beat) * (w * 0.09) * amt;
    const swing = Math.max(-1, Math.min(1, Math.sin(beat) * amt));
    f._bend = Math.sin(beat - 0.9) * h * 0.10 * amt;

    S = Paint.scheme(f);
    LW = Math.max(0.7, w * 0.0115) * Look.v.ink * (f.blend ? 1 - 0.45 * (f.depth || 0) : 1);

    ctx.save();
    ctx.lineJoin = ctx.lineCap = 'round';

    // behind the body
    if (isProfile(f.species)) profileBehind(ctx, f, w, h, wag, swing);
    else if (f.species === 'seahorse') seahorseBehind(ctx, f, w, wag);
    else if (f.species === 'long') longBehind(ctx, f, w, h);
    else otherBehind(ctx, f, w, h, wag);

    // the body, flat
    bodyPath(ctx, f);
    ctx.fillStyle = S.body;
    ctx.fill();

    // inside the body
    ctx.save();
    bodyPath(ctx, f);
    ctx.clip();
    if (isProfile(f.species)) profileInside(ctx, f, w, h);
    else if (f.species === 'seahorse') seahorseInside(ctx, f, w);
    else if (f.species === 'long') longInside(ctx, f, w, h);
    else otherInside(ctx, f, w, h);
    Paint.grainIn(ctx, -w, -h * 1.2, w * 2, h * 2.4, Look.v.texture * 0.75, f.id);
    ctx.restore();

    // ink
    bodyPath(ctx, f);
    inkStroke(ctx, 1);

    // in front of the body
    if (isProfile(f.species)) profileFront(ctx, f, w, h, wag);
    else if (f.species === 'seahorse') seahorseFront(ctx, f, w);
    else otherFront(ctx, f, w, h);

    if (f.species === 'whale' && f.spout) {
      ctx.strokeStyle = Col.rgba('#FFFFFF', 0.8);
      ctx.lineWidth = Math.max(0.6, LW * 0.8);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.16, -h * 0.44);
        ctx.quadraticCurveTo(w * (0.16 + i * 0.10), -h * 0.72, w * (0.16 + i * 0.18), -h * 0.86);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* A plain drawn eye, for everything that isn't you: a white disc, a thick
     ink ring, a big pupil looking forward and a catchlight — the reference's
     eye. */
  function drawPlainEye(f) {
    const e = eyeSpot(f);
    const ctx = drawingContext;
    const sc = Paint.scheme(f);
    const lw = Math.max(0.7, f.w * get(f.species).sizeMul * 0.0115) * Look.v.ink;
    const r = e.d / 2;
    ctx.save();
    ctx.fillStyle = sc.eye;
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
    if (lw > 0.05) {
      ctx.strokeStyle = sc.line;
      ctx.lineWidth = Math.max(lw * 0.9, e.d * 0.10);
      ctx.stroke();
    }
    ctx.fillStyle = sc.pupil;
    ctx.beginPath(); ctx.ellipse(e.x + r * 0.18, e.y + r * 0.02, r * 0.46, r * 0.54, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Col.rgba(sc.eye, 0.95);
    ctx.beginPath(); ctx.arc(e.x + r * 0.02, e.y - r * 0.22, r * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  return { SPECIES, ORDER, get, dims, eyeSpot, faceSpot, tagDrop, draw, drawPlainEye, bodyPath, fatK };
})();
