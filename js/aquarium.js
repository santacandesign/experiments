/* Fish Friends — the tank.
   The water, planting and light are all reef.js; this file is the cast and
   what they do. Fish with a person behind them — yours, and two stand-in
   friends — swim in front, in full colour. The scenery cast swims further
   back, sunk into the water by the 'scenery colour' and haze dials. */

let fishes = [], friends = [];
let myFish = null, parts = { right: {}, left: {}, face: null }, myData = null;
let friendParts = [];
let school = { x: 0, y: 0, tx: 0, ty: 0 };
let hintEl, floorY, builtW = 0, builtH = 0;
let talkLevel = 0, mouthBubbles = [];

/* ------------------------------------------------------- demo fish states
   Overfeeding, death and being stuck in seaweed are all app mechanics that
   don't exist yet — these are hand-triggered stand-ins so the look can be
   shown before the real feeding/health logic is built. They only ever act
   on myFish, and each one is an independent override: switching to a new
   state (button or click) always starts that state fresh. */
let myLife = { mode: 'normal', fat: false, feedCount: 0, stuckWeed: null };
let fallingFood = [];
let dayNight = 'day';

/* --------------------------------------------------------------- setup */

function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.parent('tank');
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  useAppFont();
  noiseDetail(2, 0.5);
  hintEl = document.getElementById('hint');

  myData = Store.load();
  if (myData && myData.parts) {
    if (myData.parts.face) {
      loadImage(myData.parts.face, img => { parts.face = img; });
    } else {
      for (const side of ['right', 'left']) {
        const set = myData.parts[side];
        if (!set) continue;
        if (set.eye) loadImage(set.eye, img => { parts[side].eye = img; });
      }
    }
  }
  if (myData && myData.voice) Voice.load(myData.voice);
  if (!myData) hintEl.textContent = 'no fish yet — tap ＋ new fish';

  /* painted once — resizing rebuilds the scene but the faces don't change */
  friendParts = SampleFriends.FRIENDS.map(fr => {
    try { return SampleFriends.build(fr); } catch (e) { console.warn('friend eye', e); return null; }
  });

  buildScene();

  dayNight = istDayNight();
  updateDayNightBtn();

  Look.mountPanel(document.getElementById('newFish'));

  document.getElementById('newFish').addEventListener('click', () => {
    location.href = 'index.html';
  });
  document.getElementById('fatBtn').addEventListener('click', setFatPreview);
  document.getElementById('seaweedBtn').addEventListener('click', stickFish);
  document.getElementById('deathBtn').addEventListener('click', killFish);
  document.getElementById('dayNightBtn').addEventListener('click', () => {
    dayNight = dayNight === 'day' ? 'night' : 'day';
    updateDayNightBtn();
  });
  ['pointerdown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => Voice.unlock(), { once: true, passive: true })
  );
}

/* Real time of day, in India — the app has no other timezone concept yet, so
   this is the one reasonable default rather than something worth a setting. */
function istDayNight() {
  let h;
  try {
    h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }), 10) % 24;
  } catch (e) {
    h = new Date().getHours();
  }
  return (h >= 6 && h < 19) ? 'day' : 'night';
}

function updateDayNightBtn() {
  const btn = document.getElementById('dayNightBtn');
  if (btn) btn.textContent = dayNight === 'day' ? '☀️ day' : '🌙 night';
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildScene();
}

function buildScene() {
  if (width < 2 || height < 2) return;
  builtW = width; builtH = height;
  floorY = height * 0.84;
  school = { x: width * 0.5, y: height * 0.35, tx: width * 0.5, ty: height * 0.35 };
  Reef.build(width, height, floorY);
  buildCast();

  const short = Math.min(width, height);
  const size = Look.v.fishSize;

  // two stand-in friends — painted eyes, full colour
  friends = SampleFriends.FRIENDS.map((fr, i) => {
    const sp = Creatures.get(fr.species);
    const base = Math.min(short * 0.27, 165) / Math.sqrt(sp.sizeMul) * size;
    const f = newSwimmer({
      id: 11 + i * 4,
      species: fr.species,
      w: base,
      col: fr.col,
      speed: 0.6 * sp.speed
    });
    f.base = base / size;
    f.fish = fr.fish;
    f.x = width * (i ? 0.72 : 0.28);
    f.y = height * (i ? 0.62 : 0.28);
    return { f, name: fr.name, parts: friendParts[i] };
  });

  // you — same registry, the species you picked
  if (myData) {
    const mySp = Creatures.get(myData.species);
    /* Divide part of the species' own size multiplier back out, so choosing a
       whale doesn't fill the tank and choosing a tiny fish is still findable. */
    const base = Math.min(short * 0.34, 200) / Math.sqrt(mySp.sizeMul);
    myFish = newSwimmer({
      id: 7,
      species: myData.species || 'fish',
      w: base * size,
      col: myData.col || BODY_COLOURS[1],
      speed: 0.55 * mySp.speed,
      spout: myData.species === 'whale'
    });
    myFish.base = base;
    myFish.fish = (myData.fishiness == null ? 70 : myData.fishiness) / 100;
    myFish.x = width * 0.5;
    myFish.y = height * 0.45;
  }
}

/* The scenery cast — no face, no name, no voice. Each is given a depth: the
   further back, the smaller, the hazier and the thinner its ink. */
function buildCast() {
  const short = Math.min(width, height);
  const ALL = ['fish', 'tiny', 'long', 'deep', 'tiny', 'seahorse', 'fish', 'starfish', 'tiny',
               'whale', 'long', 'deep', 'tiny', 'fish', 'manta', 'tiny', 'shark', 'tiny'];
  const n = Math.round((width < 480 ? 10 : 16) * Look.v.cast * 1.25);
  const CAST = ALL.slice(0, Math.min(ALL.length, n));

  /* base width before the species' own sizeMul is applied */
  const BASE = { fish: 0.13, long: 0.12, deep: 0.12, tiny: 0.13, seahorse: 0.17,
                 starfish: 0.13, whale: 0.20, manta: 0.15, shark: 0.15 };

  fishes = [];
  CAST.forEach((id, i) => {
    const sp = Creatures.get(id);
    const depth = 0.15 + Math.random() * 0.7;
    const w = short * BASE[id] * (0.85 + Math.random() * 0.3) * (1 - depth * 0.35) * Look.v.fishSize;
    fishes.push(newSwimmer({
      id: 20 + i * 3,
      species: id,
      w,
      col: BODY_COLOURS[(i * 3 + Math.floor(Math.random() * 3)) % BODY_COLOURS.length],
      blend: true,
      depth,
      speed: (0.5 + Math.random() * 0.8) * sp.speed,
      spout: id === 'whale'
    }));
  });
  /* far ones first, so nearer ones swim over them */
  fishes.sort((a, b) => b.depth - a.depth);
}

/* the fish-size dial, applied to the friends and you without moving anyone */
function resizePeople() {
  const size = Look.v.fishSize;
  for (const fr of friends) if (fr.f.base) fr.f.w = fr.f.base * size;
  if (myFish && myFish.base) myFish.w = myFish.base * size;
}

/* ------------------------------------------------------------ swimmers */

function newSwimmer(o) {
  const f = Object.assign({
    x: Math.random() * width,
    y: height * 0.15 + Math.random() * height * 0.6,
    vx: 0, vy: 0,
    dir: Math.random() < 0.5 ? 1 : -1,
    tilt: 0,
    spin: 0,
    species: 'fish',
    head: 0,
    flip: 1,
    phase: Math.random() * TWO_PI,
    talk: 0,
    effort: 1,
    burst: 0,
    pause: 0,
    wave: Math.random() * TWO_PI,
    coilPhase: Math.random() * TWO_PI
  }, o);
  /* tail beat rate is a property of the animal, not a random number */
  f.wagSpeed = Creatures.get(f.species).beat * (0.85 + Math.random() * 0.3);
  /* only a creature that actually spins starts at a random angle — everyone
     else must stay the way up they were drawn */
  if (Creatures.get(f.species).spins) f.spin = Math.random() * TWO_PI;
  f.head = f.dir > 0 ? 0 : Math.PI;
  f.flip = f.dir;
  /* the two that belong on the bottom start there, instead of spending their
     first minute of a very slow life sinking from wherever they spawned */
  if (f.species === 'seahorse' || f.species === 'starfish') {
    f.y = height * 0.55 + Math.random() * Math.max(0, floorY - height * 0.55) * 0.85;
  }
  pickTarget(f);
  return f;
}

function pickTarget(f) {
  /* margins come from the species' real dimensions — a seahorse is twice as
     tall as it is wide, so using the base size lets it wander off the edge */
  const dm = Creatures.dims(f);
  const mx = dm.w * 0.75, my = dm.h * 0.65;
  const top = height * 0.10 + my;
  const bot = Math.max(top + 1, floorY - my);

  if (f.species === 'tiny') {
    // small fish hold together — pick a spot near where the shoal is heading
    f.tx = constrain(school.x + (Math.random() - 0.5) * width * 0.22, mx, width - mx);
    f.ty = constrain(school.y + (Math.random() - 0.5) * height * 0.14, top, bot);
    return;
  }
  if (f.species === 'starfish') {
    // stays down where a starfish would actually be
    f.tx = mx + Math.random() * Math.max(1, width - mx * 2);
    f.ty = lerp(bot, top, Math.random() * 0.28);
    return;
  }
  if (f.species === 'seahorse') {
    // hangs about in the weeds, and barely goes anywhere
    f.tx = constrain(f.x + (Math.random() - 0.5) * width * 0.30, mx, width - mx);
    f.ty = constrain(f.y + (Math.random() - 0.5) * height * 0.18, height * 0.35, bot);
    return;
  }
  if (f.species === 'whale') {
    // long crossings rather than pottering about
    f.tx = f.x < width / 2 ? width - mx : mx;
    f.ty = top + Math.random() * (bot - top) * 0.7;
    return;
  }
  /* Pick somewhere ahead four times out of five. A fish that picks a new spot
     uniformly at random spends half its life doubling back on itself, which is
     the single thing that makes a tank look like a screensaver rather than
     like animals getting on with something. */
  const ahead = Math.random() < 0.8;
  const reach = width * (0.25 + Math.random() * 0.45);
  if (ahead) {
    f.tx = constrain(f.x + Math.cos(f.head) * reach, mx, width - mx);
    f.ty = constrain(f.y + Math.sin(f.head) * reach * 0.5 +
                     (Math.random() - 0.5) * height * 0.30, top, bot);
  } else {
    f.tx = mx + Math.random() * Math.max(1, width - mx * 2);
    f.ty = top + Math.random() * Math.max(1, bot - top);
  }
}

/* Where the shoal of small fish is drifting. */
function moveSchool() {
  if (Math.hypot(school.tx - school.x, school.ty - school.y) < 40) {
    school.tx = width * (0.15 + Math.random() * 0.7);
    school.ty = height * (0.18 + Math.random() * 0.5);
  }
  school.x = lerp(school.x, school.tx, 0.004);
  school.y = lerp(school.y, school.ty, 0.004);
}

/* ------------------------------------------------------------- steering

   One rule underpins everything here: a creature cannot slide sideways. It
   points where it is going, it swings that heading no faster than its own
   body allows, and the thrust always comes out of the back. Arcs instead of
   corners, banking into a turn, overshooting a target and coming back round
   — none of that is animated, it all falls out of that one constraint.

   Every species then differs in how hard it can turn, how steeply it will
   point up or down, and how its thrust arrives: in beats, continuously, in
   wingbeats, or barely at all. The differences are the point — a tank where
   everything glides at one speed reads as a screensaver. */

function angleWrap(a) {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

/* Clamp how steeply a heading points up or down, without changing which way
   along the tank it faces. */
function clampPitch(a, m) {
  const left = Math.cos(a) < 0;
  const p = constrain(left ? angleWrap(Math.PI - a) : a, -m, m);
  return left ? angleWrap(Math.PI - p) : p;
}

/* Small fish hold station on each other, not just on the shoal's centre: they
   keep a body's length apart and point the way their neighbours point. Both
   are needed — separation alone gives a cloud, alignment alone gives a clump
   that drifts through itself. */
function shoalForce(f, dm) {
  let sx = 0, sy = 0, hx = 0, hy = 0, n = 0;
  const R = dm.w * 2.0;
  for (const o of fishes) {
    if (o === f || o.species !== 'tiny') continue;
    const dx = f.x - o.x, dy = f.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d > R || d < 0.01) continue;
    const k = 1 - d / R;
    sx += (dx / d) * k; sy += (dy / d) * k;
    hx += Math.cos(o.head); hy += Math.sin(o.head);
    n++;
  }
  return n ? { sx, sy, hx: hx / n, hy: hy / n, n } : null;
}

function swim(f) {
  const sp = Creatures.get(f.species);
  const dm = Creatures.dims(f);
  const dx = f.tx - f.x, dy = f.ty - f.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < dm.w * 0.6) pickTarget(f);
  if (f.effort == null) f.effort = 1;

  /* Weight costs speed and agility — an overfed fish is visibly labouring. */
  const fat = Creatures.fatK(f);
  const spd = f.speed * Look.v.speed * (1 - 0.34 * fat);

  /* ---- where it wants to be pointing: the target, the walls, the shoal */
  let wx = dx / d, wy = (dy / d) * 0.55;

  const mx = dm.w * 1.6, my = dm.h * 1.2;
  const top = height * 0.10, bot = floorY;
  if (f.x < mx)          wx += (1 - f.x / mx) * 2.6;
  if (f.x > width - mx)  wx -= (1 - (width - f.x) / mx) * 2.6;
  if (f.y < top + my)    wy += (1 - (f.y - top) / my) * 2.6;
  if (f.y > bot - my)    wy -= (1 - (bot - f.y) / my) * 2.6;

  if (f.species === 'tiny') {
    const sh = shoalForce(f, dm);
    if (sh) {
      wx += sh.sx * 1.5; wy += sh.sy * 1.5;
      wx += sh.hx * 0.9; wy += sh.hy * 0.9;
    }
  }

  const want = clampPitch(Math.atan2(wy, wx), sp.pitch == null ? 0.4 : sp.pitch);
  const rate = (sp.turn == null ? 0.05 : sp.turn) *
               (0.5 + 0.5 * f.effort) * (1 - 0.3 * fat);
  f.head = angleWrap(f.head + constrain(angleWrap(want - f.head), -rate, rate));

  const hx = Math.cos(f.head), hy = Math.sin(f.head);

  /* ---- how the thrust arrives */
  switch (sp.motion) {

    case 'burst': {
      /* Most fish swim in beats: a few hard tail strokes, then a glide. The
         tail goes still during the glide, which is most of the time. A fish
         with somewhere to be starts a new beat sooner. */
      const small = f.species === 'tiny';
      if (f.burst > 0) f.burst--;
      else if (Math.random() < (small ? 0.055 : 0.028) + (d > width * 0.3 ? 0.02 : 0)) {
        f.burst = (small ? 6 : 12) + Math.random() * 14;
      }
      if (f.burst > 0) {
        const thr = spd * (small ? 0.10 : 0.105);
        f.vx += hx * thr; f.vy += hy * thr;
      }
      f.vx *= 0.948; f.vy *= 0.948;
      f.effort = lerp(f.effort, f.burst > 0 ? 1 : 0.05, 0.20);
      break;
    }

    case 'undulate':
      /* Eels never coast — the wave runs continuously down the body, and the
         wave phase is what actually drives the drawing, so the thrust has to
         come from the same phase or the body slides along without pushing. */
      f.wave = (f.wave || 0) + 0.15 + Math.hypot(f.vx, f.vy) * 0.05;
      {
        const thr = spd * 0.050 * (0.55 + 0.45 * Math.abs(Math.sin(f.wave)));
        f.vx += hx * thr; f.vy += hy * thr;
      }
      f.vx *= 0.935; f.vy *= 0.935;
      f.effort = 1;
      break;

    case 'hover':
      /* Deep-bodied fish row with their pectorals: slow, fussy, and stopping
         constantly to hang in one place — but never quite still, because
         holding station takes constant small corrections. */
      if (f.pause > 0) {
        f.pause--;
        f.effort = lerp(f.effort, 0.15, 0.08);
      } else {
        if (Math.random() < 0.011) f.pause = 40 + Math.random() * 80;
        const thr = spd * 0.032;
        f.vx += hx * thr; f.vy += hy * thr;
        f.effort = lerp(f.effort, 0.78, 0.07);
      }
      f.vy += Math.sin(frameCount * 0.045 + f.phase) * 0.012;   // never quite still
      f.vx *= 0.90; f.vy *= 0.90;
      break;

    case 'seahorse': {
      /* Seahorses are famously bad swimmers. They hover almost still, flutter
         the dorsal fin non-stop, and reposition by rolling and unrolling the
         tail — so the thrust comes on the unroll, and the tail drawing is
         driven by the same phase. */
      f.coilPhase = (f.coilPhase || 0) + 0.011;
      const roll = (Math.sin(f.coilPhase) + 1) / 2;
      f.coil = 0.30 + 0.70 * roll;
      const kick = Math.max(0, Math.cos(f.coilPhase));
      const thr = spd * 0.036 * kick;
      f.vx += hx * thr; f.vy += hy * thr;
      f.vy += Math.sin(frameCount * 0.028 + f.phase) * 0.022;   // gentle bob
      f.vx *= 0.935; f.vy *= 0.935;
      f.effort = 1;                                             // the fin never stops
      break;
    }

    case 'crawl':
      /* A starfish does not swim. It drifts and slowly turns. */
      f.vx = lerp(f.vx, hx * spd * 0.40, 0.006);
      f.vy = lerp(f.vy, hy * spd * 0.40, 0.006);
      f.effort = 0;
      break;

    case 'cruise': {
      /* A whale holds its line and turns slowly; the flukes sweep long and
         low, and it rises and sinks in a long shallow arc rather than
         levelling off the way a fish does. */
      const thr = spd * 0.016;
      f.vx += hx * thr; f.vy += hy * thr;
      f.vy += Math.sin(frameCount * 0.004 + f.phase) * 0.0022;
      f.vx *= 0.985; f.vy *= 0.985;
      f.effort = 0.9;
      break;
    }

    case 'patrol': {
      /* A shark cannot stop — it has no swim bladder and must keep moving to
         breathe. Constant speed, no glide, wide slow turns. */
      const thr = spd * 0.030;
      f.vx += hx * thr; f.vy += hy * thr;
      f.vx *= 0.972; f.vy *= 0.972;
      f.effort = 0.85 + 0.15 * Math.sin(frameCount * 0.01 + f.phase);
      break;
    }

    case 'flap': {
      /* A manta flies rather than swims: thrust arrives in a pulse on each
         downstroke and it coasts between them, rising slightly as the wings
         come down. Driven off the same phase the wings are drawn from. */
      const ph = frameCount * (f.wagSpeed || 0.06) + f.phase;
      const pulse = Math.max(0, Math.sin(ph));
      const thr = spd * 0.038 * pulse;
      f.vx += hx * thr; f.vy += hy * thr;
      f.vy -= Math.cos(ph) * 0.02;
      f.vx *= 0.976; f.vy *= 0.976;
      f.effort = 0.45 + 0.55 * pulse;
      break;
    }

    default:
      f.vx += hx * spd * 0.03;
      f.vy += hy * spd * 0.03;
      f.vx *= 0.96; f.vy *= 0.96;
  }

  f.x += f.vx;
  f.y += f.vy;

  /* A fat fish sags. As a trim on the position rather than a push on the
     velocity: added to velocity it would be divided by the drag and the fish
     would simply sink to the floor and stay there. */
  if (fat > 0.01) f.y += fat * 0.07;

  /* The steering above keeps everyone inside the tank in the ordinary case;
     this is only for the overshoot at the end of a hard burst, so that
     nothing is ever drawn buried in the sand or clipped off the top. */
  const lo = height * 0.06 + dm.h * 0.3;
  const hi = floorY - dm.h * (f.species === 'starfish' ? 0.02 : 0.15);
  if (f.y < lo) { f.y = lo; f.vy = Math.max(0, f.vy); }
  if (f.y > hi) { f.y = hi; f.vy = Math.min(0, f.vy); }
  const lx = dm.w * 0.45, rx = width - dm.w * 0.45;
  if (f.x < lx) { f.x = lx; f.vx = Math.max(0, f.vx); }
  if (f.x > rx) { f.x = rx; f.vx = Math.min(0, f.vx); }

  /* ---- which way it is facing, and how it sits in the water */

  /* The flip is animated rather than snapped. A fish turning around passes
     through edge-on, where it is foreshortened to almost nothing — which is
     exactly what a real one does, and is the difference between a turn and
     the whole animal being mirrored between two frames. The dead zone around
     vertical stops a hovering creature flickering between the two. */
  if (sp.flips) {
    if (hx > 0.25) f.dir = 1;
    else if (hx < -0.25) f.dir = -1;
    f.flip += constrain(f.dir - f.flip, -0.15, 0.15);
  }

  if (sp.spins) {
    f.spin += 0.0035 + Math.hypot(f.vx, f.vy) * 0.0012;
    f.tilt = 0;
  } else if (f.species === 'seahorse') {
    /* upright, always — a seahorse leaning into a turn looks broken */
    f.tilt = lerp(f.tilt, constrain(f.vy * 0.05, -0.12, 0.12), 0.1);
  } else {
    /* Point the body along the velocity. Measuring the angle in the creature's
       own mirrored frame is what keeps a fish swimming down-and-left nose
       down: taking it from vy alone tilts it the wrong way on one of the two
       headings. */
    const v = Math.hypot(f.vx, f.vy);
    const lim = (sp.pitch == null ? 0.4 : sp.pitch) + 0.12;
    const aim = v > 0.06 ? constrain(Math.atan2(f.vy, f.vx * f.dir), -lim, lim) : 0;
    /* the eased pitch is kept apart from the yaw, or each frame's yaw is eased
       into the next frame's starting pitch and the creature slowly rolls */
    f._pitch = lerp(f._pitch || 0, aim, 0.08);
    /* the body yaws a little against the tail beat, the way a swimming fish's
       head does — only while it is actually working */
    f.tilt = f._pitch + Math.sin(frameCount * f.wagSpeed + f.phase) * 0.035 * (f.effort || 0);
  }
}

/* ------------------------------------------------------- demo state ops */

function setFatPreview() {
  if (!myFish) return;
  myLife = { mode: 'normal', fat: true, feedCount: 3, stuckWeed: null };
}

function killFish() {
  if (!myFish) return;
  myLife = { mode: 'dead', fat: false, feedCount: 0, stuckWeed: null };
  myFish._deadStart = millis();
  myFish._deadFromY = myFish.y;
  myFish._deadFromTilt = myFish.tilt;
  myFish.vx = myFish.vy = 0;
}

function reviveFish() {
  myLife = { mode: 'normal', fat: false, feedCount: 0, stuckWeed: null };
  myFish.tilt = 0;
  myFish.spin = 0;
  pickTarget(myFish);
}

function stickFish() {
  if (!myFish) return;
  const weeds = Reef.anchors();
  let best = weeds[0], bestD = Infinity;
  for (const w of weeds) {
    const d = Math.abs(w.x - myFish.x);
    if (d < bestD) { bestD = d; best = w; }
  }
  myLife = { mode: 'stuck', fat: false, feedCount: 0, stuckWeed: best };
  if (best) {
    myFish.x = best.x;
    myFish.y = Math.min(floorY - Creatures.dims(myFish).h * 0.4, best.base - best.h * 0.5);
  }
  myFish.vx = myFish.vy = 0;
}

function releaseFish() {
  myLife.mode = 'normal';
  myLife.stuckWeed = null;
  pickTarget(myFish);
}

/* One tap = one pellet, dropped a little above wherever the fish currently
   is. It's caught almost immediately — this is a feeding gesture, not a
   physics puzzle — and the bite is what actually advances the count. */
function feedFish() {
  if (!myFish || myLife.mode !== 'normal') return;
  const dm = Creatures.dims(myFish);
  fallingFood.push({
    x: myFish.x + (Math.random() - 0.5) * dm.w * 0.25,
    y: myFish.y - dm.h * 0.9 - 40,
    vy: 0
  });
}

function updateFood() {
  for (let i = fallingFood.length - 1; i >= 0; i--) {
    const fd = fallingFood[i];
    fd.vy += 0.18;
    fd.y += fd.vy;
    const targetY = myFish ? myFish.y : fd.y;
    if (fd.y >= targetY) {
      fallingFood.splice(i, 1);
      onBiteComplete();
    }
  }
}

function drawFood() {
  noStroke();
  for (const fd of fallingFood) {
    ink(1.2, PAL.ink);
    fill('#C9A25C');
    circle(fd.x, fd.y, 8);
  }
}

/* The bite: advance the count, cross the fat and death thresholds, then talk
   — feeding finishes before the fish has anything to say. */
function onBiteComplete() {
  if (!myFish || myLife.mode !== 'normal') return;
  myLife.feedCount++;
  if (myLife.feedCount >= 6) { killFish(); return; }
  if (myLife.feedCount >= 3) myLife.fat = true;
  spawnMouthBubble(myFish);
  if (!Voice.isPlaying()) {
    if (myData && myData.voice) Voice.play();
    else Voice.bubbleBurst(5, 0.4);
  }
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

/* Sinking, in place of swim() — straight down onto the floor over ~2s,
   settling on its side, no more drifting once it lands. */
function updateDeadFish(f) {
  const dm = Creatures.dims(f);
  const t = Math.min(1, (millis() - f._deadStart) / 2000);
  const e = easeOutCubic(t);
  f.y = lerp(f._deadFromY, floorY - dm.h * 0.32, e);
  f.tilt = lerp(f._deadFromTilt, HALF_PI * 0.55, e);
}

/* Struggling in place, in place of swim(). */
function updateStuckFish(f) {
  const w = myLife.stuckWeed;
  if (!w) return;
  f.x = w.x + Math.sin(frameCount * 0.5) * 2.5;
  f.tilt = Math.sin(frameCount * 0.35) * 0.20;
  f.vx = f.vy = 0;
}

/* A strand or two drawn over the fish, so it reads as tangled rather than
   merely parked next to the weeds. */
function drawStuckWeeds(f) {
  const w = myLife.stuckWeed;
  if (!w) return;
  const dm = Creatures.dims(f);
  const base = f.y + dm.h * 0.5;
  Reef.strand(drawingContext, f.x - dm.w * 0.12, base, dm.h * 1.3, dm.w * 0.07, w.phase, -0.18);
  Reef.strand(drawingContext, f.x + dm.w * 0.18, base, dm.h * 1.4, dm.w * 0.06, w.phase + 1.3, 0.22);
}

/* ---------------------------------------------------------------- draw */

function draw() {
  /* If the page loads in a background tab the canvas can still be 0x0 when
     setup() runs. Rebuild whenever the scene and the canvas disagree. */
  if (builtW !== width || builtH !== height) {
    if (width < 2 || height < 2) return;
    buildScene();
  }
  if (Look.takeSceneDirty()) {
    Look.takeBgDirty();
    Reef.relayout();
    buildCast();
    resizePeople();
  } else if (Look.takeBgDirty()) {
    Reef.rebake();
  }

  const ctx = drawingContext;
  const night = dayNight === 'night';

  Reef.drawBack(ctx);
  Reef.drawFloor(ctx, night);
  Reef.drawRays(ctx, night);

  moveSchool();
  for (const f of fishes) { swim(f); drawCreature(f); }

  Reef.drawFront(ctx);
  if (night) Reef.night(ctx, 0.6);

  /* people last, so a friend is never swum over by scenery */
  for (const fr of friends) {
    fr.f.talk = lerp(fr.f.talk, 0, 0.05);
    swim(fr.f);
    drawMyFish(fr.f, fr.parts);
  }

  if (myFish) {
    if (myLife.mode === 'dead') {
      updateDeadFish(myFish);
    } else if (myLife.mode === 'stuck') {
      updateStuckFish(myFish);
    } else {
      talkLevel = lerp(talkLevel, Voice.isPlaying() ? Voice.level() : 0, 0.35);
      myFish.talk = talkLevel;
      myFish.speed = Voice.isPlaying() ? 0.2 : 0.55;
      swim(myFish);
    }
    myFish.fat = myLife.fat;
    myFish.lifeState = myLife.mode;

    updateFood();
    drawMyFish(myFish, parts);
    if (myLife.mode === 'stuck') drawStuckWeeds(myFish);
    drawFood();
    if (myLife.mode === 'normal' && Voice.isPlaying() && frameCount % 7 === 0 && talkLevel > 0.06) spawnMouthBubble(myFish);
  }

  drawMouthBubbles();
  for (const fr of friends) drawNameTag(fr.f, fr.name);
  if (myFish) drawNameTag(myFish, myData ? myData.name : '');

  Reef.drawBubbles(ctx);
  Reef.drawParticles(ctx);
  if (night) Reef.night(ctx, 0.22);
  Reef.drawOverlay(ctx);
}

/* --------------------------------------------------- talking + tapping */

function spawnMouthBubble(f) {
  if (!f) return;
  const dm = Creatures.dims(f);
  const mx = f.x + f.dir * dm.w * 0.5;
  const my = f.y + dm.h * 0.06;
  mouthBubbles.push({ x: mx, y: my, r: f.w * (0.03 + Math.random() * 0.05), life: 1, vx: f.dir * (0.4 + Math.random()), vy: -0.9 - Math.random() });
}

function drawMouthBubbles() {
  for (let i = mouthBubbles.length - 1; i >= 0; i--) {
    const b = mouthBubbles[i];
    b.x += b.vx; b.y += b.vy; b.life -= 0.012; b.r *= 1.004;
    if (b.life <= 0) { mouthBubbles.splice(i, 1); continue; }
    Reef.bubble(drawingContext, b.x, b.y, b.r, Math.min(1, b.life * 1.4));
  }
}

function tapped(px, py) {
  const hit = f => {
    const dm = Creatures.dims(f);
    return Math.hypot(px - f.x, py - f.y) < Math.max(dm.w, dm.h) * 0.6;
  };
  if (myFish && hit(myFish)) {
    Voice.unlock();
    hintEl.classList.add('gone');
    if (myLife.mode === 'dead') reviveFish();
    else if (myLife.mode === 'stuck') releaseFish();
    else feedFish();
    return;
  }
  /* the stand-ins have no voice — a poke gets a wiggle and some bubbles */
  for (const fr of friends) {
    if (!hit(fr.f)) continue;
    Voice.unlock();
    Voice.bubbleBurst(4, 0.35);
    fr.f.talk = 0.9;
    for (let k = 0; k < 4; k++) spawnMouthBubble(fr.f);
    return;
  }
}

function mousePressed() { tapped(mouseX, mouseY); }
function touchStarted() {
  if (touches.length) tapped(touches[0].x, touches[0].y);
  return true;
}
