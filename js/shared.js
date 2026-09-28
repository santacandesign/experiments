/* Fish Friends — shared palette, storage and hand-drawn drawing helpers.
   Palette lifted from the reference illustration.
   Every draw helper below assumes p5 global mode. */

const PAL = {
  deep:   '#12376B',
  blue:   '#2C7FD4',
  mid:    '#4FA3DE',
  cyan:   '#7FD3EE',
  pale:   '#BFEAF7',
  ink:    '#152F5E',
  cream:  '#F7F0E4',
  blush:  '#F4A9C0',
  coral:  '#E8452E',
  orange: '#F5883E',
  yellow: '#F6D046',
  mint:   '#A8DFA0',
  lime:   '#C7E86B',
  teal:   '#3FB6C4',
  sand:   '#EBDCC0'
};

/* The water, and everything that belongs to it.

   Taken from the dark reference: a deep petrol teal, where the planting, the
   bubbles and every fish nobody owns are drawn a shade or two off the water and
   inked in a darker teal. Colour is reserved for fish with a person behind them,
   so a friend is the first thing you find in the tank. */
const SEA = {
  top:    '#0C2431',
  upper:  '#133746',
  mid:    '#1A4A59',
  low:    '#215766',
  bed:    '#2E6776',
  ink:    '#0A222C',                       // doodle line, a notch under the water
  pale:   'rgba(150,205,210,0.30)',        // bubbles, jelly outlines
  /* fills for scenery creatures — each a step either side of the water */
  skins:  ['#1E5463', '#245D6C', '#2A6574', '#1B4D5C', '#2F6C7A'],
  marks:  '#3A7B89'                        // their stripes and spots
};

/* Body colours my fish can be given. */
const BODY_COLOURS = [PAL.orange, PAL.coral, PAL.yellow, PAL.blush, PAL.teal, PAL.lime];

/* A dead fish loses its owner colour — grey is the "this is nobody now" signal,
   the inverse of [[fish-friends-colour-rule]]. */
const DEAD = { col: '#82878A', accent: '#6E7376', line: '#454A4C' };

/* ---------------------------------------------------------------- storage */

const Store = (() => {
  const KEY = 'fishfriends.myfish.v1';
  return {
    save(fish) {
      try { localStorage.setItem(KEY, JSON.stringify(fish)); return true; }
      catch (e) { console.warn('could not save fish', e); return false; }
    },
    load() {
      try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
      catch (e) { return null; }
    },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();

/* ------------------------------------------------- hand-drawn line helpers */

/* The "boil": the wobble seed only changes every few frames, so outlines
   shimmer at ~10fps the way hand-inked animation does, instead of buzzing. */
const BOIL_FRAMES = 6;
function boilSeed(id) {
  return id * 137.7 + Math.floor(frameCount / BOIL_FRAMES) * 11.3;
}

/* Closed wobbly blob — the workhorse for every organic shape here. */
function wobblyBlob(x, y, w, h, id, steps = 26, amp = 2.2) {
  const s = boilSeed(id);
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (TWO_PI * i) / steps;
    const n = noise(s + Math.cos(a) * 1.5, s + Math.sin(a) * 1.5);
    const r = (n - 0.5) * 2 * amp;
    pts.push([x + Math.cos(a) * (w / 2 + r), y + Math.sin(a) * (h / 2 + r)]);
  }
  beginShape();
  curveVertex(pts[steps - 1][0], pts[steps - 1][1]);
  for (const p of pts) curveVertex(p[0], p[1]);
  curveVertex(pts[0][0], pts[0][1]);
  curveVertex(pts[1][0], pts[1][1]);
  endShape();
}

/* Same shape, but emitted straight into the 2D context so it can be a clip. */
function blobPath(ctx, x, y, w, h, id, steps = 26, amp = 2.2) {
  const s = boilSeed(id);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (TWO_PI * i) / steps;
    const n = noise(s + Math.cos(a) * 1.5, s + Math.sin(a) * 1.5);
    const r = (n - 0.5) * 2 * amp;
    const px = x + Math.cos(a) * (w / 2 + r);
    const py = y + Math.sin(a) * (h / 2 + r);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* A wobbly stroke from a to b. */
function wobblyLine(x1, y1, x2, y2, id, amp = 1.6, steps = 8) {
  const s = boilSeed(id);
  beginShape();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const n = noise(s + t * 3, s + 40);
    const off = (n - 0.5) * 2 * amp * Math.sin(t * PI);
    const nx = -(y2 - y1), ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    vertex(lerp(x1, x2, t) + (nx / len) * off, lerp(y1, y2, t) + (ny / len) * off);
  }
  endShape();
}

/* A darker version of a colour, for its own outline.

   The reference art inks everything in navy, but a stark near-black line at full
   weight makes every creature read as a sticker laid on the water. Mixing the
   body colour toward a deep blue gives a line that still separates the shape
   without shouting, and never goes actually black. */
function shade(hex, amt = 0.5) {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return PAL.ink;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const m = (c, t) => Math.round(c + (t - c) * amt);
  return 'rgb(' + m(r, 26) + ',' + m(g, 48) + ',' + m(b, 82) + ')';
}

function ink(weight = 2.4, col = PAL.ink) {
  stroke(col);
  strokeWeight(weight);
  strokeJoin(ROUND);
  strokeCap(ROUND);
}

/* ------------------------------------------------------------------ grain */

function makeGrain(size = 220) {
  const g = createGraphics(size, size);
  g.loadPixels();
  for (let i = 0; i < g.pixels.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 235;
    g.pixels[i] = g.pixels[i + 1] = g.pixels[i + 2] = v;
    g.pixels[i + 3] = 255;
  }
  g.updatePixels();
  return g;
}

function drawGrain(g, alpha = 30, scale = 1.7) {
  if (!g) return;
  push();
  blendMode(OVERLAY);
  tint(255, alpha);
  const s = g.width * scale;
  for (let x = 0; x < width; x += s) {
    for (let y = 0; y < height; y += s) image(g, x, y, s, s);
  }
  pop();
  blendMode(BLEND);
  noTint();
}

/* ------------------------------------------------------------- creatures */

/* Anything in the tank that isn't you: body from the registry, drawn eye. */
function drawCreature(f) {
  const sp = Creatures.get(f.species);
  push();
  translate(f.x, f.y);
  if (sp.flips) scale(f.dir, 1);
  rotate(f.tilt + (f.spin || 0));
  Creatures.draw(f);
  Creatures.drawPlainEye(f);
  pop();
}

/* You. Same body as everyone else — the only photographic thing on it is
   either one eye or the whole face, whichever you picked when you made the
   fish. `parts` is { right: {eye}, left: {eye} } for the eye-only cut — the
   set matching the swim direction is used, so the eye changes side when you
   turn around — or { face } for the whole-face cut, which needs no side
   since the fish's own left/right flip mirrors it along with the body.
   Entries may be a p5.Image (from storage) or a raw canvas (freshly baked in
   the preview). */
function drawMyFish(f, parts) {
  const sp = Creatures.get(f.species);

  push();
  translate(f.x, f.y);
  if (sp.flips) scale(f.dir, 1);
  rotate(f.tilt + (f.spin || 0));

  if (f.lifeState === 'dead') {
    drawDeadBody(f);
    pop();
    return;
  }

  Creatures.draw(f);
  if (f.fat) drawBellyBulge(f);

  const fish = f.fish == null ? 0.7 : f.fish;
  const e = Creatures.eyeSpot(f);

  if (parts && parts.face) {
    /* the whole face rides at one fixed size — the eyes are enlarged inside the
       patch at snap time, so the face itself doesn't grow with fishiness.
       Sized off the body's own (pre-aspect) width rather than its longer
       dimension, so a tall or spread-out silhouette (seahorse, starfish)
       doesn't inflate the face along with it — each species' faceMul (in
       creatures.js) tunes how much of that width the face actually covers, so
       the snout, arms, etc. stay visible around it. */
    const { w } = Creatures.dims(f);
    const faceMul = sp.faceMul == null ? 1.12 : sp.faceMul;
    const d = w * faceMul * (1 + (f.talk || 0) * 0.06);
    blit(parts.face, e.x, e.y, d);
  } else {
    const set = !parts ? null
      : (f.dir > 0 ? (parts.right || parts.left) : (parts.left || parts.right));
    if (set && set.eye) {
      blit(set.eye, e.x, e.y, e.d * (1.02 + 0.46 * fish) * (1 + (f.talk || 0) * 0.10));
    } else {
      Creatures.drawPlainEye(f);
    }
  }
  pop();
}

/* A puffed-up belly for a fish that's been fed past the fat threshold — a
   soft bulge layered on top of the body, in the same colours, so it reads as
   swollen rather than as a different creature. */
function drawBellyBulge(f) {
  const { w, h } = Creatures.dims(f);
  noStroke();
  ink(Math.max(0.8, f.line * 0.9), shade(f.col, 0.42));
  fill(f.col);
  wobblyBlob(-w * 0.02, h * 0.28, w * 0.62, h * 0.58, f.id + 500, 22, w * 0.02);
}

/* The fish, dead: its own body drawn in grey instead of its owner's colour,
   settled where it sank, with the eye replaced by a plain crossed-out dot —
   no face patch, no eye photo, since neither means anything any more. */
function drawDeadBody(f) {
  const oc = f.col, oa = f.accent, ol = f.lineCol;
  f.col = DEAD.col; f.accent = DEAD.accent; f.lineCol = DEAD.line;
  Creatures.draw(f);
  f.col = oc; f.accent = oa; f.lineCol = ol;

  const e = Creatures.eyeSpot(f);
  noStroke();
  fill(DEAD.line);
  ellipse(e.x, e.y, e.d * 0.72, e.d * 0.72);
  ink(Math.max(1.4, e.d * 0.16), PAL.cream);
  const r = e.d * 0.36;
  line(e.x - r, e.y - r, e.x + r, e.y + r);
  line(e.x - r, e.y + r, e.x + r, e.y - r);
}

/* Draw a p5.Image or a raw canvas centred at (x, y) at the given width, keeping
   the source's own aspect. p5's image() will not take a bare HTMLCanvasElement,
   hence going through drawingContext — which still honours the p5 transform. */
function blit(src, x, y, w) {
  if (!src) return;
  const c = src.canvas || src;
  if (!c || !c.width || !c.height) return;
  const h = w * (c.height / c.width);
  drawingContext.drawImage(c, x - w / 2, y - h / 2, w, h);
}

/* Name tag under the creature. Drawn unmirrored so it stays readable. */
function drawNameTag(f, name) {
  if (!name) return;
  push();
  translate(f.x, f.y + Creatures.tagDrop(f));
  rotate(Math.sin(f.id + frameCount * 0.004) * 0.05);
  textAlign(CENTER, CENTER);
  textSize(Math.max(13, f.w * 0.15));
  const padW = textWidth(name) + f.w * 0.20;
  const padH = f.w * 0.24;
  ink(2.2, PAL.ink);
  fill(PAL.cream);
  wobblyBlob(0, 0, padW, padH, f.id + 9, 22, 1.6);
  noStroke();
  fill(PAL.ink);
  text(name, 0, padH * 0.04);
  pop();
}

/* p5 hands the whole string to the canvas font shorthand, so a quoted
   multi-family stack silently falls back to the 2D default serif. One family,
   applied again once the webfont has actually arrived. */
function useAppFont() {
  const apply = () => { try { textFont('Gaegu'); } catch (e) {} };
  apply();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 16px Gaegu').then(apply).catch(() => {});
    document.fonts.ready.then(apply).catch(() => {});
  }
}
