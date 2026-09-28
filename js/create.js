/* Fish Friends — the make-a-fish flow: face → name → voice → tank. */

const draft = {
  faceR: null,
  faceL: null,
  name: '',
  voice: null,
  col: BODY_COLOURS[Math.floor(Math.random() * BODY_COLOURS.length)]
};

let step = 0;
const steps = document.querySelectorAll('.step');
const dots  = document.querySelectorAll('#dots span');

function go(n) {
  step = n;
  steps.forEach(s => s.classList.toggle('active', +s.dataset.step === n));
  dots.forEach((d, i) => d.classList.toggle('on', i <= n));
  if (n === 1) setTimeout(() => document.getElementById('name').focus(), 250);
}
document.querySelectorAll('[data-back]').forEach(b => {
  b.addEventListener('click', () => {
    const n = +b.dataset.back;
    /* stepping back to the face screen means starting the camera over, not
       staring at the snap you already took */
    if (n === 0 && typeof retake === 'function') retake();
    go(n);
  });
});

/* Unlock audio on the very first touch, so iOS will play the preview later. */
['pointerdown', 'touchstart'].forEach(ev =>
  window.addEventListener(ev, () => Voice.unlock(), { once: true, passive: true })
);

/* -------------------------------------------------------- ambient bubbles */

(function seedDrift() {
  const wrap = document.getElementById('drift');
  for (let i = 0; i < 14; i++) {
    const b = document.createElement('i');
    const s = 8 + Math.random() * 26;
    b.style.width = s + 'px';
    b.style.height = s * 0.92 + 'px';
    b.style.left = Math.random() * 100 + '%';
    b.style.animationDuration = (11 + Math.random() * 13) + 's';
    b.style.animationDelay = (-Math.random() * 18) + 's';
    wrap.appendChild(b);
  }
})();

/* --------------------------------------------------------------- 1. face */

const cam     = document.getElementById('cam');
const lens    = document.getElementById('lens');
const lensCv  = document.getElementById('lensCanvas');
const shoot   = document.getElementById('shoot');
const camNote = document.getElementById('camNote');
const pick    = document.getElementById('pick');

/* the after-snap review, where you pick whole-face vs eyes and bulge your eyes */
const snapRow   = document.getElementById('snapRow');
const reviewRow = document.getElementById('reviewRow');
const bulgeRow  = document.getElementById('bulgeRow');
const bulgeIn   = document.getElementById('eyeBulge');
const bulgeOut  = document.getElementById('bulgeOut');
const sizeIn    = document.getElementById('eyeSize');
const sizeOut   = document.getElementById('eyeSizeOut');

const LIVE = 260;   // the viewfinder canvas
const BAKE = 460;   // the face crop the fragments are cut from

const bake = document.createElement('canvas'); bake.width = bake.height = BAKE;
const bakeCtx = bake.getContext('2d', { willReadFrequently: true });
lensCv.width = lensCv.height = LIVE;
const lensCtx = lensCv.getContext('2d');

let liveOn = false, liveLandmarks = null, lastDetect = 0, lastSeen = 0, noteState = '';
let shotA = null;                    // anchors of the captured face
let parts = null;                    // { right: {eye,brow,lips}, left: {...} }
let reviewOn = false;                // the snap review (eye bulge + eye size) is showing
let eyeBulge = +bulgeIn.value / 100; // how far the eyes swell in the whole-face cut
let eyeSize  = +sizeIn.value / 100;  // how large the eye lenses are drawn (0.5..1.5)

document.getElementById('pickBtn').addEventListener('click', () => pick.click());

/* Square centre-crop of a video or image, optionally mirrored. */
function drawCrop(ctx, source, size, mirror) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  const side = Math.min(sw, sh);
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  if (mirror) { ctx.translate(size, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
  ctx.restore();
}

/* Landmarks into the space of that centre crop — used for the live markers. */
function centreMapper(sw, sh, mirror) {
  const side = Math.min(sw, sh);
  const ox = (sw - side) / 2, oy = (sh - side) / 2;
  return lm => {
    const x = (lm.x * sw - ox) / side;
    return { x: mirror ? 1 - x : x, y: (lm.y * sh - oy) / side };
  };
}

/* Square crop centred on the detected face, so the fragments are cut from as
   many pixels as possible whether they're at arm's length or across the room. */
function faceCropInto(ctx, source, lms, size, mirror) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;

  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of lms) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  let side = Math.max((maxX - minX) * sw, (maxY - minY) * sh) * 1.45;
  side = Math.min(side, Math.min(sw, sh));
  let sx = ((minX + maxX) / 2) * sw - side / 2;
  let sy = ((minY + maxY) / 2) * sh - side / 2;
  sx = Math.max(0, Math.min(sw - side, sx));
  sy = Math.max(0, Math.min(sh - side, sy));

  ctx.save();
  ctx.clearRect(0, 0, size, size);
  if (mirror) { ctx.translate(size, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  ctx.restore();

  return lm => {
    const x = (lm.x * sw - sx) / side;
    return { x: mirror ? 1 - x : x, y: (lm.y * sh - sy) / side };
  };
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    camNote.innerHTML = 'no camera here — tap <b>use a photo</b>';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      audio: false
    });
    cam.srcObject = stream;
    await cam.play().catch(() => {});
    lens.classList.remove('empty');
    lens.classList.add('live');
    shoot.disabled = false;
    liveOn = true;
    requestAnimationFrame(liveFrame);
  } catch (e) {
    camNote.innerHTML = 'camera said no — tap <b>use a photo</b> instead';
  }
}
startCamera();

function stopLive() {
  liveOn = false;
  if (cam.srcObject) cam.srcObject.getTracks().forEach(t => t.stop());
}

function liveFrame(ts) {
  if (!liveOn) return;
  requestAnimationFrame(liveFrame);
  if (!cam.videoWidth) return;

  const rig = window.FaceRig;
  if (rig && rig.status === 'ready' && ts - lastDetect > 60) {
    lastDetect = ts;
    const lms = rig.detectVideo(cam, ts);
    if (lms) { liveLandmarks = lms; lastSeen = ts; }
    else if (ts - lastSeen > 700) liveLandmarks = null;
  }

  drawCrop(lensCtx, cam, LIVE, true);

  let A = null;
  if (liveLandmarks) {
    A = FaceParts.anchors(liveLandmarks, centreMapper(cam.videoWidth, cam.videoHeight, true));
    FaceParts.drawMarkers(lensCtx, A, LIVE);
  }
  updateNote(rig, !!A);
}

function updateNote(rig, seen) {
  const s = !rig ? 'loading'
          : rig.status === 'failed' ? 'failed'
          : rig.status !== 'ready' ? 'loading'
          : seen ? 'seen' : 'searching';
  if (s === noteState) return;
  noteState = s;
  if (s === 'loading')        camNote.innerHTML = 'looking good — <b>face tracking</b> still loading…';
  else if (s === 'failed')    camNote.innerHTML = "face tracking didn't load — the fish will get drawn eyes";
  else if (s === 'searching') camNote.innerHTML = "can't find a face — more light, or come closer";
  else                        camNote.innerHTML = 'got your eyes, brows and mouth';
}

/* Cut a fresh set of fragments from the captured face. Cheap enough to redo
   every time a control moves, which is why the controls live next to the fish. */
function rebake() {
  if (!shotA) { parts = null; return; }
  parts = { face: FaceParts.bake(bake, shotA, { fish: fishiness, mode: 'face', eyeBulge, eyeSize }).face };
  previewFish.species = species;
}

/* Redraw the just-snapped whole-face patch (with the eye bulge and eye size
   you're dialling) inside the lens. Only meaningful while the review is up. */
function renderReview() {
  lensCtx.clearRect(0, 0, LIVE, LIVE);
  if (parts && parts.face) lensCtx.drawImage(parts.face, 0, 0, LIVE, LIVE);
  else                     lensCtx.drawImage(bake, 0, 0, LIVE, LIVE);
}

/* Called by the snap-step dials (eye bulge, eye size): re-cut the face patch
   and, while the review is up, repaint the lens. */
function onSnapControlChange() {
  rebake();
  if (reviewOn) renderReview();
}

function captured(A) {
  shotA = A;
  rebake();
  stopLive();
  lens.classList.remove('empty', 'live');
  lens.classList.add('snapped');
  enterReview();
}

/* Show the snapped face and the controls that shape it — this is where the
   whole face is enlarged, so the eye bulge is dialled here rather than later on
   the fish-attributes screen. */
function enterReview() {
  reviewOn = true;
  snapRow.hidden = true;
  reviewRow.hidden = false;
  renderReview();
  noteState = 'review';
  camNote.innerHTML = 'happy with it? <b>use this</b>, or retake';
}

/* Back to the live viewfinder for another go. */
function retake() {
  reviewOn = false;
  shotA = null;
  parts = null;
  reviewRow.hidden = true;
  snapRow.hidden = false;
  lens.classList.remove('snapped');
  lens.classList.add('empty');
  noteState = '';
  startCamera();
}

shoot.addEventListener('click', () => {
  if (!cam.videoWidth) return;
  let A = null;
  if (liveLandmarks) {
    const map = faceCropInto(bakeCtx, cam, liveLandmarks, BAKE, true);
    A = FaceParts.anchors(liveLandmarks, map);
  }
  if (!A) drawCrop(bakeCtx, cam, BAKE, true);
  captured(A);
});

document.getElementById('useFace').addEventListener('click', () => {
  reviewOn = false;
  go(1);
});
document.getElementById('retake').addEventListener('click', retake);

bulgeIn.addEventListener('input', () => {
  eyeBulge = +bulgeIn.value / 100;
  bulgeOut.textContent = bulgeIn.value;
  onSnapControlChange();
});

sizeIn.addEventListener('input', () => {
  eyeSize = +sizeIn.value / 100;
  sizeOut.textContent = sizeIn.value;
  onSnapControlChange();
});

pick.addEventListener('change', () => {
  const file = pick.files && pick.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = async () => {
    stopLive();                     // detectImage switches running mode
    const rig = window.FaceRig;
    const lms = rig && rig.status === 'ready' ? await rig.detectImage(img) : null;
    let A = null;
    if (lms) A = FaceParts.anchors(lms, faceCropInto(bakeCtx, img, lms, BAKE, false));
    if (!A) drawCrop(bakeCtx, img, BAKE, false);
    captured(A);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
});

/* ------------------------------------------------------- 2. name and look */

const nameInput = document.getElementById('name');
const toVoice   = document.getElementById('toVoice');

/* fishiness no longer has a dial on the picking screen — every fish is made
   at the same middling setting, which is what most people landed on anyway. */
let fishiness = 0.65;
let species = 'fish';
/* The whole face is the only cut now — your photo always rides the fish as a
   single face patch, so there's no capture-mode toggle to build. */

nameInput.addEventListener('input', () => {
  draft.name = nameInput.value.trim();
  toVoice.disabled = draft.name.length === 0;
});
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && draft.name) { nameInput.blur(); go(2); }
});
toVoice.addEventListener('click', () => go(2));

/* species picker — same registry the tank draws from */
(function buildSpecies() {
  const wrap = document.getElementById('speciesRow');
  Creatures.ORDER.forEach(id => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small mode' + (id === species ? ' on' : '');
    b.textContent = Creatures.get(id).label;
    b.addEventListener('click', () => {
      species = id;
      wrap.querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b));
    });
    wrap.appendChild(b);
  });
})();

/* colour picker — so the fish can be chosen in the room, not rolled at random */
(function buildSwatches() {
  const wrap = document.getElementById('swatches');
  BODY_COLOURS.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (c === draft.col ? ' on' : '');
    b.style.background = c;
    b.setAttribute('aria-label', 'fish colour ' + (i + 1));
    b.addEventListener('click', () => {
      draft.col = c;
      wrap.querySelectorAll('.swatch').forEach(o => o.classList.toggle('on', o === b));
    });
    wrap.appendChild(b);
  });
})();

/* -------------------------------------------------------------- 3. voice */

const mic       = document.getElementById('mic');
const micLabel  = document.getElementById('micLabel');
const bar       = document.getElementById('bar');
const afterRec  = document.getElementById('afterRec');
const voiceNote = document.getElementById('voiceNote');

let recording = false, recStart = 0, barTimer = null;

async function beginRec() {
  if (recording) return;
  Voice.unlock();
  try {
    await Voice.startRecording(endRec);
  } catch (e) {
    voiceNote.innerHTML = 'no microphone — you can <b>skip</b> and the fish stays quiet';
    return;
  }
  recording = true;
  recStart = performance.now();
  mic.classList.add('rec');
  micLabel.innerHTML = 'listening…';
  afterRec.style.display = 'none';
  barTimer = setInterval(() => {
    const pct = Math.min(100, ((performance.now() - recStart) / Voice.MAX_MS) * 100);
    bar.style.width = pct + '%';
  }, 40);
}

async function endRec() {
  if (!recording) return;
  recording = false;
  clearInterval(barTimer);
  mic.classList.remove('rec');
  micLabel.innerHTML = 'hold<br />to talk';
  const dataUrl = await Voice.stopRecording();
  bar.style.width = '0%';
  if (!dataUrl) { voiceNote.textContent = 'nothing came through — try again'; return; }
  draft.voice = dataUrl;
  await Voice.load(dataUrl);
  afterRec.style.display = 'flex';
  voiceNote.innerHTML = 'got it. tap <b>hear it</b> to check the bubbles';
}

mic.addEventListener('pointerdown', e => { e.preventDefault(); beginRec(); });
mic.addEventListener('pointerup', endRec);
mic.addEventListener('pointercancel', endRec);
mic.addEventListener('pointerleave', () => { if (recording) endRec(); });
mic.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('hear').addEventListener('click', () => {
  Voice.unlock();
  Voice.play();
});
document.getElementById('redo').addEventListener('click', () => {
  draft.voice = null;
  afterRec.style.display = 'none';
  voiceNote.textContent = 'go on then';
});

document.getElementById('release').addEventListener('click', () => {
  const out = {};
  if (parts && parts.face) {
    out.face = parts.face.toDataURL('image/png');
  } else if (parts) {
    for (const side of ['right', 'left']) {
      out[side] = {};
      if (parts[side] && parts[side].eye) out[side].eye = parts[side].eye.toDataURL('image/png');
    }
  }
  Store.save({
    parts: parts ? out : null,
    name: draft.name || 'Bubbles',
    voice: draft.voice,
    col: draft.col,
    species: species,
    fishiness: Math.round(fishiness * 100),
    eyeBulge: Math.round(eyeBulge * 100),
    eyeSize: Math.round(eyeSize * 100),
    made: Date.now()
  });
  location.href = 'aquarium.html';
});

/* ------------------------------------------------- live fish preview (p5) */

const previewFish = {
  x: 0, y: 0, w: 118, dir: 1, tilt: 0, spin: 0, id: 4,
  species: 'fish', col: draft.col, accent: draft.col, line: 1.0,
  wagSpeed: 0.20, phase: 0, talk: 0, fish: 0.65, effort: 1, wave: 0, coil: 1
};

/* How far each species' fins/tail reach above its own centre, as a multiple
   of its raw (pre-sizeMul) width — a round "deep" fish's dorsal fin reaches
   almost twice as far as a plain fish's, and a whale is wide before it's
   tall. Keeps the preview from poking its head through the top of the card;
   the tank doesn't need this because it has room to spare. */
const PREVIEW_VREACH = { fish: 0.62, long: 0.50, deep: 1.05, tiny: 0.28,
                          seahorse: 0.50, starfish: 0.45, whale: 0.48,
                          manta: 0.42, shark: 0.60 };

function setup() {
  const holder = document.getElementById('preview');
  const c = createCanvas(holder.clientWidth || 360, 176);
  c.parent(holder);
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  useAppFont();
  noiseDetail(2, 0.5);
}

function windowResized() {
  const holder = document.getElementById('preview');
  if (holder) resizeCanvas(holder.clientWidth || 360, 176);
}

function draw() {
  clear();
  /* The preview fish swims back and forth on purpose: turning is what shows off
     the eye swapping from one side of the face to the other. */
  const t = frameCount * 0.011;
  const sp = Creatures.get(species);
  previewFish.y = 66;
  const headroom = previewFish.y - 6;
  const vreach = PREVIEW_VREACH[species] || PREVIEW_VREACH.fish;
  previewFish.w = Math.min(130, width * 0.36, headroom / vreach);
  /* Tail/fluke reach is a fairly steady ~0.8 of the actual (post-sizeMul)
     width across species, so keep the swim amplitude clear of it too. */
  const amp = Math.max(0, width / 2 - previewFish.w * sp.sizeMul * 0.8);
  previewFish.x = width / 2 + Math.sin(t) * amp;
  previewFish.dir = Math.cos(t) >= 0 ? 1 : -1;
  previewFish.tilt = Math.sin(frameCount * 0.02) * 0.06;
  previewFish.col = previewFish.accent = draft.col;
  previewFish.species = species;
  previewFish.fish = fishiness;
  /* parts are raw canvases here — no encode/decode round trip while tuning */
  drawMyFish(previewFish, parts);
  drawNameTag(previewFish, draft.name || nameInput.value.trim());
}
