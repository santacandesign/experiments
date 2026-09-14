/* Fish Friends — the tank.
   Fish with a person behind them — yours, and two stand-in friends — are in
   colour. Everything else is scenery, drawn into the water. */

let grain, bgLayer;
let fishes = [], friends = [], bubbles = [], ghosts = [], stars = [], weeds = [], corals = [], rays = [];
let myFish = null, parts = { right: {}, left: {}, face: null }, myData = null;
let friendParts = [];
let school = { x: 0, y: 0, tx: 0, ty: 0 };

/* Planting: dark sea-greens a shade off the water, as in the reference. */
const PLANT_TONES = ['#14414B', '#1B4F55', '#10363F', '#205A62'];
const CORAL_TONES = [
  'rgba(58,122,134,0.60)',
  'rgba(48,110,124,0.65)',
  'rgba(70,136,146,0.52)'
];
let hintEl, floorY;
let talkLevel = 0, mouthBubbles = [];

/* --------------------------------------------------------------- setup */

function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.parent('tank');
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  useAppFont();
  noiseDetail(2, 0.5);
  grain = makeGrain(220);
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

  document.getElementById('newFish').addEventListener('click', () => {
    location.href = 'index.html';
  });
  ['pointerdown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => Voice.unlock(), { once: true, passive: true })
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildScene();
}

function buildScene() {
  floorY = height * 0.86;
  school = { x: width * 0.5, y: height * 0.35, tx: width * 0.5, ty: height * 0.35 };
  makeBackground();

  const short = Math.min(width, height);

  // the scenery cast — no face, no name, no voice
  const CAST = width < 480
    ? ['fish', 'tiny', 'long', 'fish', 'deep', 'seahorse', 'starfish', 'tiny', 'whale']
    : ['fish', 'tiny', 'long', 'fish', 'deep', 'seahorse', 'starfish', 'tiny',
       'long', 'fish', 'whale', 'tiny', 'deep'];

  /* base width before the species' own sizeMul is applied */
  const BASE = { fish: 0.13, long: 0.12, deep: 0.12, tiny: 0.13,
                 seahorse: 0.17, starfish: 0.13, whale: 0.20 };

  /* Nobody owns these, so they get no colour: water-tone bodies, dark teal
     ink, markings a step lighter — the turtles in the reference. */
  fishes = [];
  CAST.forEach((id, i) => {
    const sp = Creatures.get(id);
    const w = short * BASE[id] * (0.85 + Math.random() * 0.32);
    fishes.push(newSwimmer({
      id: 20 + i * 3,
      species: id,
      w,
      col: SEA.skins[i % SEA.skins.length],
      accent: SEA.skins[(i + 2) % SEA.skins.length],
      lineCol: SEA.ink,
      patCol: SEA.marks,
      blend: true,
      line: Math.max(0.7, w * 0.009),
      speed: (0.5 + Math.random() * 0.8) * sp.speed,
      spout: id === 'whale'
    }));
  });

  // two stand-in friends — painted eyes, full colour
  friends = SampleFriends.FRIENDS.map((fr, i) => {
    const sp = Creatures.get(fr.species);
    const base = Math.min(short * 0.27, 165) / Math.sqrt(sp.sizeMul);
    const f = newSwimmer({
      id: 11 + i * 4,
      species: fr.species,
      w: base,
      col: fr.col,
      accent: fr.accent,
      line: Math.max(0.8, base * 0.007),
      speed: 0.6 * sp.speed
    });
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
      w: base,
      col: myData.col || PAL.orange,
      accent: myData.col || PAL.orange,
      line: Math.max(0.8, base * 0.007),
      speed: 0.55 * mySp.speed,
      spout: myData.species === 'whale'
    });
    myFish.fish = (myData.fishiness == null ? 70 : myData.fishiness) / 100;
    myFish.x = width * 0.5;
    myFish.y = height * 0.45;
  }

  // bubbles
  bubbles = [];
  const nb = width < 480 ? 22 : 32;
  for (let i = 0; i < nb; i++) bubbles.push(newBubble(true));

  // the doodle ghosts from the reference art
  ghosts = [];
  for (let i = 0; i < (width < 480 ? 3 : 5); i++) {
    ghosts.push({
      id: 60 + i,
      x: Math.random() * width,
      y: Math.random() * height * 0.8,
      w: short * (0.13 + Math.random() * 0.09),
      vx: (Math.random() - 0.5) * 0.28,
      vy: -0.08 - Math.random() * 0.12,
      phase: Math.random() * TWO_PI
    });
  }

  // floating star confetti
  stars = [];
  for (let i = 0; i < (width < 480 ? 11 : 16); i++) {
    stars.push({
      x: Math.random() * width,
      y: height * 0.12 + Math.random() * height * 0.66,
      r: short * (0.018 + Math.random() * 0.022),
      rot: Math.random() * TWO_PI,
      spin: (Math.random() - 0.5) * 0.004,
      phase: Math.random() * TWO_PI,
      col: SEA.skins[i % SEA.skins.length]
    });
  }

  // seaweed along the floor
  weeds = [];
  for (let i = 0; i < (width < 480 ? 6 : 9); i++) {
    weeds.push({
      id: 80 + i,
      x: (width / (width < 480 ? 6 : 9)) * (i + 0.5) + (Math.random() - 0.5) * 40,
      h: height * (0.09 + Math.random() * 0.10),
      w: short * (0.034 + Math.random() * 0.026),
      phase: Math.random() * TWO_PI,
      /* Planting sits close to the water on purpose. Outlined, saturated weeds
         competed with the creatures for attention; these recede. */
      col: PLANT_TONES[i % PLANT_TONES.length]
    });
  }

  // coral sprigs
  corals = [];
  for (let i = 0; i < 3; i++) {
    corals.push({
      id: 100 + i,
      x: width * (0.14 + i * 0.34) + (Math.random() - 0.5) * 30,
      h: height * (0.07 + Math.random() * 0.05),
      col: CORAL_TONES[i % CORAL_TONES.length]
    });
  }

  // light shafts from the surface
  rays = [];
  for (let i = 0; i < 4; i++) {
    rays.push({ x: width * (0.1 + i * 0.27), w: width * (0.10 + Math.random() * 0.10), sp: 0.0004 + Math.random() * 0.0006, ph: Math.random() * TWO_PI });
  }
}

function makeBackground() {
  bgLayer = createGraphics(width, height);
  const g = bgLayer.drawingContext;
  const lin = g.createLinearGradient(0, 0, 0, height);
  lin.addColorStop(0.00, SEA.top);
  lin.addColorStop(0.25, SEA.upper);
  lin.addColorStop(0.60, SEA.mid);
  lin.addColorStop(1.00, SEA.low);
  g.fillStyle = lin;
  g.fillRect(0, 0, width, height);

  // a faint moonlit pool near the surface
  const rad = g.createRadialGradient(width * 0.5, -height * 0.1, 10, width * 0.5, height * 0.3, height * 0.7);
  rad.addColorStop(0, 'rgba(90,160,170,0.22)');
  rad.addColorStop(1, 'rgba(90,160,170,0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, width, height);

  // the fine speckle the reference art has all over it
  bgLayer.noStroke();
  for (let i = 0; i < width * height / 2600; i++) {
    bgLayer.fill(150, 205, 210, 8 + Math.random() * 22);
    bgLayer.circle(Math.random() * width, Math.random() * height, Math.random() * 2.2 + 0.5);
  }
  for (let i = 0; i < width * height / 6000; i++) {
    bgLayer.fill(4, 18, 26, 30 + Math.random() * 50);
    bgLayer.circle(Math.random() * width, Math.random() * height, Math.random() * 2.6 + 0.6);
  }
  drawDoodles(bgLayer);
}

/* The confetti the reference is covered in — rings, dots, asterisks, little
   stars and spirals, inked in dark teal with the odd pale one. It never
   moves, so it is baked into the background rather than drawn every frame. */
function drawDoodles(pg) {
  const s = Math.min(width, height);
  const n = Math.round(width * height / 7000);
  pg.strokeJoin(ROUND);
  pg.strokeCap(ROUND);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * width;
    const y = height * 0.04 + Math.random() * (floorY - height * 0.04);
    const r = s * (0.006 + Math.random() * 0.012);
    const c = Math.random() < 0.78 ? 'rgba(8,28,36,0.55)' : 'rgba(150,205,210,0.22)';
    pg.push();
    pg.translate(x, y);
    pg.rotate(Math.random() * TWO_PI);
    pg.stroke(c);
    pg.strokeWeight(Math.max(1, r * 0.22));
    pg.noFill();
    switch (i % 6) {
      case 0:                                         // ring
        pg.circle(0, 0, r * 2);
        break;
      case 1:                                         // dot
        pg.noStroke(); pg.fill(c);
        pg.circle(0, 0, r * 0.9);
        break;
      case 2:                                         // asterisk
        for (let k = 0; k < 3; k++) {
          const a = (k * PI) / 3;
          pg.line(-Math.cos(a) * r, -Math.sin(a) * r, Math.cos(a) * r, Math.sin(a) * r);
        }
        break;
      case 3:                                         // little star
        pg.beginShape();
        for (let k = 0; k < 10; k++) {
          const a = -HALF_PI + (PI * k) / 5, rr = k % 2 ? r * 0.45 : r * 1.1;
          pg.vertex(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        pg.endShape(CLOSE);
        break;
      case 4:                                         // spiral
        pg.beginShape();
        for (let t = 0; t <= 3 * PI; t += 0.35) pg.vertex(Math.cos(t) * r * t / (3 * PI), Math.sin(t) * r * t / (3 * PI));
        pg.endShape();
        break;
      default:                                        // a cluster of tiny rings
        for (let k = 0; k < 3; k++) pg.circle((k - 1) * r * 0.9, (k % 2) * r * 0.6, r * 0.7);
    }
    pg.pop();
  }
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
  f.tx = mx + Math.random() * Math.max(1, width - mx * 2);
  f.ty = top + Math.random() * Math.max(1, bot - top);
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

/* Every species moves the way its real counterpart does. The differences are
   the point: a tank where everything glides at one speed reads as a screensaver. */
function swim(f) {
  const sp = Creatures.get(f.species);
  const dm = Creatures.dims(f);
  const dx = f.tx - f.x, dy = f.ty - f.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  if (d < dm.w * 0.5) pickTarget(f);
  if (f.effort == null) f.effort = 1;

  switch (sp.motion) {

    case 'burst':
      /* Most fish swim in beats: a few hard tail strokes, then a glide. The
         tail goes still during the glide, which is most of the time. */
      if (f.burst > 0) f.burst--;
      else if (Math.random() < (f.species === 'tiny' ? 0.05 : 0.022)) {
        f.burst = (f.species === 'tiny' ? 7 : 15) + Math.random() * 14;
      }
      if (f.burst > 0) {
        f.vx += ux * f.speed * 0.085;
        f.vy += uy * f.speed * 0.065;
      }
      f.vx *= 0.952; f.vy *= 0.952;
      f.effort = lerp(f.effort, f.burst > 0 ? 1 : 0, 0.22);
      break;

    case 'undulate':
      /* Eels never coast — the wave runs continuously down the body, and the
         wave phase is what actually drives the drawing. */
      f.vx = lerp(f.vx, ux * f.speed, 0.022);
      f.vy = lerp(f.vy, uy * f.speed * 0.55, 0.022);
      f.effort = 1;
      f.wave = (f.wave || 0) + 0.17 + Math.hypot(f.vx, f.vy) * 0.06;
      break;

    case 'hover':
      /* Deep-bodied fish row with their pectorals: slow, fussy, and stopping
         constantly to hang in one place. */
      if (f.pause > 0) {
        f.pause--;
        f.effort = lerp(f.effort, 0.12, 0.08);
      } else {
        if (Math.random() < 0.011) f.pause = 40 + Math.random() * 80;
        f.vx += ux * f.speed * 0.024;
        f.vy += uy * f.speed * 0.030;
        f.effort = lerp(f.effort, 0.75, 0.07);
      }
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
      f.vx += ux * f.speed * 0.030 * kick;
      f.vy += uy * f.speed * 0.038 * kick;
      f.vy += Math.sin(frameCount * 0.028 + f.phase) * 0.022;   // gentle bob
      f.vx *= 0.935; f.vy *= 0.935;
      f.effort = 1;                                             // the fin never stops
      break;
    }

    case 'crawl':
      /* A starfish does not swim. It drifts and slowly turns. */
      f.vx = lerp(f.vx, ux * f.speed * 0.45, 0.005);
      f.vy = lerp(f.vy, uy * f.speed * 0.45, 0.005);
      f.effort = 0;
      break;

    case 'cruise':
      /* A whale holds its line and turns slowly; the flukes sweep long and low. */
      f.vx = lerp(f.vx, ux * f.speed, 0.007);
      f.vy = lerp(f.vy, uy * f.speed * 0.40, 0.007);
      f.effort = 0.9;
      break;

    default:
      f.vx = lerp(f.vx, ux * f.speed, 0.018);
      f.vy = lerp(f.vy, uy * f.speed * 0.75, 0.018);
  }

  f.x += f.vx;
  f.y += f.vy;
  if (sp.flips && Math.abs(f.vx) > 0.06) f.dir = f.vx > 0 ? 1 : -1;

  if (sp.spins) {
    f.spin += 0.0035;
    f.tilt = 0;
  } else if (f.species === 'seahorse') {
    /* upright, always — a seahorse leaning into a turn looks broken */
    f.tilt = constrain(f.vy * 0.05, -0.12, 0.12) * f.dir;
  } else {
    f.tilt = constrain(f.vy * 0.16, -0.32, 0.32) * f.dir;
  }
}

/* -------------------------------------------------------------- bubbles */

function newBubble(scatter) {
  const s = Math.min(width, height);
  return {
    x: Math.random() * width,
    y: scatter ? Math.random() * height : height + 20,
    r: s * (0.008 + Math.random() * 0.022),
    sp: 0.5 + Math.random() * 1.1,
    ph: Math.random() * TWO_PI
  };
}

/* ---------------------------------------------------------------- draw */

function draw() {
  /* If the page loads in a background tab the canvas can still be 0x0 when
     setup() runs, which bakes an empty background layer and leaves the tank
     blank for good. Rebuild whenever the layer and the canvas disagree. */
  if (!bgLayer || bgLayer.width !== width || bgLayer.height !== height) {
    if (width < 2 || height < 2) return;
    buildScene();
  }
  image(bgLayer, 0, 0);
  drawRays();
  drawStars();
  drawFloor();
  drawWeeds();
  drawCorals();
  drawGhosts();

  for (const b of bubbles) {
    b.y -= b.sp;
    b.x += Math.sin(frameCount * 0.02 + b.ph) * 0.5;
    if (b.y < -30) Object.assign(b, newBubble(false));
    noFill();
    ink(Math.max(1, b.r * 0.10), SEA.pale);
    circle(b.x, b.y, b.r * 2);
    noStroke();
    fill(150, 205, 210, 45);
    circle(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.4);
  }

  moveSchool();
  for (const f of fishes) { swim(f); drawCreature(f); }

  /* people last, so a friend is never swum over by scenery */
  for (const fr of friends) {
    fr.f.talk = lerp(fr.f.talk, 0, 0.05);
    swim(fr.f);
    drawMyFish(fr.f, fr.parts);
  }

  if (myFish) {
    talkLevel = lerp(talkLevel, Voice.isPlaying() ? Voice.level() : 0, 0.35);
    myFish.talk = talkLevel;
    myFish.speed = Voice.isPlaying() ? 0.2 : 0.55;
    swim(myFish);
    drawMyFish(myFish, parts);
    if (Voice.isPlaying() && frameCount % 7 === 0 && talkLevel > 0.06) spawnMouthBubble(myFish);
  }

  drawMouthBubbles();
  for (const fr of friends) drawNameTag(fr.f, fr.name);
  if (myFish) drawNameTag(myFish, myData ? myData.name : '');

  drawGrain(grain, 26, 1.6);
  vignette();
}

function vignette() {
  const g = drawingContext;
  const r = g.createRadialGradient(
    width / 2, height * 0.44, Math.min(width, height) * 0.26,
    width / 2, height * 0.52, Math.max(width, height) * 0.78
  );
  r.addColorStop(0, 'rgba(4,14,20,0)');
  r.addColorStop(1, 'rgba(4,14,20,0.50)');
  g.fillStyle = r;
  g.fillRect(0, 0, width, height);
}

function drawRays() {
  noStroke();
  for (const r of rays) {
    const off = Math.sin(frameCount * r.sp * 12 + r.ph) * width * 0.03;
    fill(120, 190, 200, 7);
    beginShape();
    vertex(r.x + off - r.w * 0.18, 0);
    vertex(r.x + off + r.w * 0.18, 0);
    vertex(r.x + off + r.w * 0.75, height * 0.82);
    vertex(r.x + off - r.w * 0.75, height * 0.82);
    endShape(CLOSE);
  }
}

function drawStars() {
  for (const s of stars) {
    s.rot += s.spin;
    const y = s.y + Math.sin(frameCount * 0.01 + s.phase) * 7;
    push();
    translate(s.x, y);
    rotate(s.rot);
    ink(1.4, SEA.ink);
    fill(s.col);
    star5(0, 0, s.r * 0.42, s.r);
    pop();
  }
}

function star5(cx, cy, rIn, rOut) {
  beginShape();
  for (let i = 0; i < 10; i++) {
    const a = -HALF_PI + (PI * i) / 5;
    const r = i % 2 === 0 ? rOut : rIn;
    vertex(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  endShape(CLOSE);
}

function drawFloor() {
  ink(1.6, 'rgba(8,28,36,0.6)');
  fill(SEA.bed);
  beginShape();
  vertex(-10, height + 10);
  for (let x = -10; x <= width + 10; x += 26) {
    vertex(x, floorY + Math.sin(x * 0.012 + 1.3) * 9 + noise(x * 0.01, frameCount * 0.0015) * 10);
  }
  vertex(width + 10, height + 10);
  endShape(CLOSE);

  noStroke();
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97.3) % width);
    const y = floorY + 18 + ((i * 53.7) % (height - floorY - 20));
    fill(i % 3 ? 'rgba(150,205,210,0.18)' : 'rgba(8,28,36,0.35)');
    circle(x, y, 2 + (i % 4));
  }

  // a couple of starfish resting on the sand
  for (let i = 0; i < 2; i++) {
    const x = width * (0.24 + i * 0.5);
    const y = floorY + (height - floorY) * 0.45;
    const r = Math.min(width, height) * 0.035;
    push();
    translate(x, y);
    rotate(i ? 0.4 : -0.3);
    ink(1.4, SEA.ink);
    fill(i ? SEA.skins[2] : SEA.skins[4]);
    star5(0, 0, r * 0.46, r);
    noStroke();
    fill(SEA.marks);
    for (let k = 0; k < 4; k++) circle((k - 1.5) * r * 0.24, (k % 2) * r * 0.2 - r * 0.1, r * 0.13);
    pop();
  }
}

function drawWeeds() {
  for (const w of weeds) {
    const sway = Math.sin(frameCount * 0.014 + w.phase) * w.w * 1.9;
    ink(1.2, 'rgba(6,24,32,0.55)');
    fill(w.col);
    beginShape();
    vertex(w.x - w.w * 0.5, floorY + 8);
    bezierVertex(
      w.x - w.w * 0.5 + sway * 0.4, floorY - w.h * 0.45,
      w.x - w.w * 0.2 + sway, floorY - w.h * 0.8,
      w.x + sway * 1.15, floorY - w.h
    );
    bezierVertex(
      w.x + w.w * 0.5 + sway, floorY - w.h * 0.78,
      w.x + w.w * 0.6 + sway * 0.4, floorY - w.h * 0.4,
      w.x + w.w * 0.5, floorY + 8
    );
    endShape(CLOSE);
  }
}

function drawCorals() {
  for (const c of corals) {
    push();
    translate(c.x, floorY + 6);
    ink(Math.max(3, c.h * 0.085), c.col);
    noFill();
    const branches = 5;
    for (let i = 0; i < branches; i++) {
      const a = -HALF_PI + (i - (branches - 1) / 2) * 0.42;
      const len = c.h * (0.65 + (i % 2) * 0.35);
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
      wobblyLine(0, 0, ex, ey, c.id + i, c.h * 0.05, 7);
      wobblyLine(ex, ey, ex + Math.cos(a - 0.6) * len * 0.42, ey + Math.sin(a - 0.6) * len * 0.42, c.id + i + 30, c.h * 0.04, 5);
      wobblyLine(ex * 0.6, ey * 0.6, ex * 0.6 + Math.cos(a + 0.7) * len * 0.36, ey * 0.6 + Math.sin(a + 0.7) * len * 0.36, c.id + i + 60, c.h * 0.04, 5);
    }
    pop();
  }
}

function drawGhosts() {
  for (const g of ghosts) {
    g.x += g.vx + Math.sin(frameCount * 0.008 + g.phase) * 0.25;
    g.y += g.vy;
    if (g.y < -g.w) { g.y = height + g.w * 0.6; g.x = Math.random() * width; }
    if (g.x < -g.w) g.x = width + g.w;
    if (g.x > width + g.w) g.x = -g.w;

    const h = g.w * 1.05;
    push();
    translate(g.x, g.y);
    rotate(Math.sin(frameCount * 0.006 + g.phase) * 0.12);
    /* pale line and almost no fill, like the jellyfish in the reference */
    ink(Math.max(1.4, g.w * 0.022), SEA.pale);
    fill(150, 205, 210, 10);
    wobblyBlob(0, 0, g.w, h, g.id, 24, g.w * 0.035);
    // face
    noStroke();
    fill(150, 205, 210, 55);
    ellipse(-g.w * 0.17, -h * 0.08, g.w * 0.085, g.w * 0.11);
    ellipse(g.w * 0.17, -h * 0.08, g.w * 0.085, g.w * 0.11);
    noFill();
    ink(Math.max(1.2, g.w * 0.02), SEA.pale);
    arc(0, h * 0.06, g.w * 0.3, g.w * 0.2, 0.25, PI - 0.25);
    pop();
  }
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
    noFill();
    ink(1.6, 'rgba(170,220,225,' + (0.6 * b.life).toFixed(2) + ')');
    circle(b.x, b.y, b.r * 2);
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
    if (!Voice.isPlaying()) {
      if (myData && myData.voice) Voice.play();
      else Voice.bubbleBurst(5, 0.4);
    }
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
