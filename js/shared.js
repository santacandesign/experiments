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

/* Body colours my fish can be given — the `body` of each scheme in paint.js,
   which supplies the belly, head, cheek, fin and marking colours to go with it. */
const BODY_COLOURS = ['#FF4A1C', '#FF8A12', '#FFC612', '#FF8FB8', '#0F8A4B', '#10B4CC', '#93A9FF', '#8C9C14'];

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
   shimmer at ~10fps the way hand-inked animation does, instead of buzzing.
   The rate is the 'line boil' dial (paint.js); 6 frames is its default. */
const BOIL_FRAMES = 6;
function boilSeed(id) {
  const frames = typeof Look !== 'undefined' ? Look.boilFrames() : BOIL_FRAMES;
  return id * 137.7 + (frames === Infinity ? 0 : Math.floor(frameCount / frames)) * 11.3;
}

/* the 'line wobble' dial, scaling every hand-drawn wobble */
function wobbleAmt() {
  return typeof Look !== 'undefined' ? Look.v.wobble : 1;
}

/* Closed wobbly blob — the workhorse for every organic shape here. */
function wobblyBlob(x, y, w, h, id, steps = 26, amp = 2.2) {
  const s = boilSeed(id);
  amp *= wobbleAmt();
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
  amp *= wobbleAmt();
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

function ink(weight = 2.4, col = PAL.ink) {
  stroke(col);
  strokeWeight(weight);
  strokeJoin(ROUND);
  strokeCap(ROUND);
}

/* ------------------------------------------------------------- creatures */

/* How much of its width the creature is showing. Turning around is animated
   (aquarium.js), so this runs from +1 through nearly nothing to −1: a fish
   mid-turn is edge-on and foreshortened, rather than mirrored between two
   frames. It never reaches zero, or the animal would vanish. */
function bodyFlip(f) {
  const v = f.flip == null ? f.dir : f.flip;
  return (v < 0 ? -1 : 1) * Math.max(0.16, Math.abs(v));
}

/* Anything in the tank that isn't you: body from the registry, drawn eye. */
function drawCreature(f) {
  const sp = Creatures.get(f.species);
  push();
  translate(f.x, f.y);
  if (sp.flips) scale(bodyFlip(f), 1);
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
  if (sp.flips) scale(bodyFlip(f), 1);
  rotate(f.tilt + (f.spin || 0));

  if (f.lifeState === 'dead') {
    drawDeadBody(f);
    pop();
    return;
  }

  Creatures.draw(f);

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
    const c = Creatures.faceSpot(f);
    blit(parts.face, c.x, c.y, d);
  } else {
    /* Which side the eye is on follows the drawn body, not the heading: the
       turn takes a moment, and swapping the eye the instant the fish decides
       to come about would move it across a face still pointing the old way.
       Keyed off the flip, it changes at the one frame the fish is edge-on. */
    const side = (f.flip == null ? f.dir : f.flip) > 0;
    const set = !parts ? null
      : (side ? (parts.right || parts.left) : (parts.left || parts.right));
    if (set && set.eye) {
      blit(set.eye, e.x, e.y, e.d * (1.02 + 0.46 * fish) * (1 + (f.talk || 0) * 0.10));
    } else {
      Creatures.drawPlainEye(f);
    }
  }
  pop();
}

/* Being overfed is handled in creatures.js, by the animal's own outline: each
   species puts the weight where that animal actually would, so the belly
   band, the markings, the fins and the ink all move with it. A bulge drawn on
   top here, as this used to do, read as a sticker on every species but one. */

/* The fish, dead: its own body drawn in grey instead of its owner's colour,
   settled where it sank, with the eye replaced by a plain crossed-out dot —
   no face patch, no eye photo, since neither means anything any more. */
function drawDeadBody(f) {
  Creatures.draw(f);                     // lifeState 'dead' paints it in grey

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
