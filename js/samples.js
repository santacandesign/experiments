/* Fish Friends — two stand-in friends.

   Until other people have made fish, the tank needs somebody in it to show what
   a friend looks like against the scenery. There are no photos in the
   prototype, so each friend's face is *painted*: skin, lids, lashes, iris
   fibres, a wet catchlight — laid out like a real capture, then handed to
   FaceParts.bake exactly as a camera frame would be. Same fisheye, same dome,
   same ink ring as your own eye, so they read as the same kind of thing.

   Everything is seeded, so a friend looks the same on every load. */

const SampleFriends = (() => {

  const SIZE = 720;                  // the painted "photo"
  const EYES = [0.30, 0.70];         // eye centres across it
  const ROW  = 0.50;
  const GAP  = EYES[1] - EYES[0];

  /* `mode` is the same choice you get when making your own fish: 'eye' wears a
     single eye that swaps side as it turns, 'face' wears the whole face with the
     eyes bulged (`bulge` 0..1). One of each here so the tank shows both cuts
     living side by side. */
  const FRIENDS = [
    { name: 'maya', species: 'fish', col: PAL.coral,  accent: PAL.orange, fish: 0.72, seed: 7,
      mode: 'eye',
      skin: [172, 116, 86],  iris: [98, 60, 28],   rim: [34, 19, 10], hair: [30, 20, 15] },
    { name: 'theo', species: 'deep', col: PAL.yellow, accent: PAL.orange, fish: 0.60, seed: 19,
      mode: 'face', bulge: 0.7,
      skin: [230, 188, 160], iris: [92, 132, 116], rim: [28, 52, 48], hair: [96, 66, 42] }
  ];

  /* xorshift, so the painting is repeatable */
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  const rgba = (c, a = 1) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const mix = (c, d, t) => [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t];
  const WHITE = [255, 255, 255], BLACK = [0, 0, 0];

  /* One cubic, for the lid curves and anything that has to sit on them. */
  function bez(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    ];
  }

  /* ---------------------------------------------------------------- face */

  function paintFace(fr) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const R = rng(fr.seed);
    const G = GAP * SIZE;                         // eye-to-eye, in pixels

    // skin, lit from the upper left
    const lit = g.createLinearGradient(0, 0, SIZE, SIZE);
    lit.addColorStop(0, rgba(mix(fr.skin, WHITE, 0.10)));
    lit.addColorStop(1, rgba(mix(fr.skin, BLACK, 0.12)));
    g.fillStyle = lit;
    g.fillRect(0, 0, SIZE, SIZE);

    // blotchy undertone, so it isn't a flat card
    for (let i = 0; i < 40; i++) {
      const x = R() * SIZE, y = R() * SIZE, r = SIZE * (0.04 + R() * 0.10);
      const tone = R() < 0.5 ? mix(fr.skin, [190, 90, 80], 0.35) : mix(fr.skin, BLACK, 0.2);
      soft(g, x, y, r, tone, 0.10);
    }

    EYES.forEach((ex, i) => paintEye(g, fr, ex * SIZE, ROW * SIZE, G, i === 0 ? 1 : -1, R));
    /* a nose shadow and mouth, so the whole-face cut reads as a face and not a
       blank oval with eyes. The eye-only cut never samples this low, so it's
       harmless there. */
    paintMouth(g, fr);
    grain(g, R);
    return cv;
  }

  /* A soft closed-lip smile below the eyes, plus a hint of nostril shadow. Sits
     at the mouth row the face anchors below expect. */
  function paintMouth(g, fr) {
    const cx = SIZE * 0.5, cy = SIZE * 0.72;
    const w = SIZE * 0.15, h = SIZE * 0.05;
    const lip     = mix(fr.skin, [176, 82, 86], 0.55);
    const lipDark = mix(lip, BLACK, 0.35);

    // nose: a soft central shadow with two nostril dabs
    soft(g, cx, cy - h * 2.6, SIZE * 0.055, mix(fr.skin, BLACK, 0.40), 0.16);
    soft(g, cx - w * 0.42, cy - h * 2.1, SIZE * 0.024, mix(fr.skin, BLACK, 0.38), 0.14);
    soft(g, cx + w * 0.42, cy - h * 2.1, SIZE * 0.024, mix(fr.skin, BLACK, 0.38), 0.14);

    // lower lip, fuller
    g.fillStyle = rgba(lip);
    g.beginPath();
    g.moveTo(cx - w, cy);
    g.bezierCurveTo(cx - w * 0.4, cy + h * 1.6, cx + w * 0.4, cy + h * 1.6, cx + w, cy);
    g.bezierCurveTo(cx + w * 0.4, cy + h * 0.3, cx - w * 0.4, cy + h * 0.3, cx - w, cy);
    g.closePath();
    g.fill();

    // upper lip, a touch darker with a soft cupid's bow
    g.fillStyle = rgba(mix(lip, BLACK, 0.14));
    g.beginPath();
    g.moveTo(cx - w, cy);
    g.bezierCurveTo(cx - w * 0.5, cy - h * 0.9, cx - w * 0.15, cy - h * 0.2, cx, cy - h * 0.02);
    g.bezierCurveTo(cx + w * 0.15, cy - h * 0.2, cx + w * 0.5, cy - h * 0.9, cx + w, cy);
    g.bezierCurveTo(cx + w * 0.4, cy + h * 0.2, cx - w * 0.4, cy + h * 0.2, cx - w, cy);
    g.closePath();
    g.fill();

    // the seam between the lips
    g.strokeStyle = rgba(lipDark, 0.6);
    g.lineWidth = SIZE * 0.006;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - w, cy);
    g.quadraticCurveTo(cx, cy + h * 0.45, cx + w, cy);
    g.stroke();

    // a wet highlight on the lower lip
    soft(g, cx, cy + h * 0.75, w * 0.5, WHITE, 0.12);
  }

  function soft(g, x, y, r, col, alpha) {
    const rad = g.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, rgba(col, alpha));
    rad.addColorStop(1, rgba(col, 0));
    g.fillStyle = rad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* `inward` is the direction of the nose: +1 for the eye on the left of the
     picture, -1 for the one on the right. It decides which corner gets the
     pink caruncle and which way the lashes and brow hairs sweep. */
  function paintEye(g, fr, cx, cy, G, inward, R) {
    const a   = G * 0.25;                          // half the eye's width
    const up  = G * 0.078, low = G * 0.080;        // how far the lids open
    const ir  = G * 0.092;                         // iris radius
    const dark  = mix(fr.skin, BLACK, 0.45);
    const flush = mix(fr.skin, [200, 96, 92], 0.4);
    const out = -inward;                           // toward the temple

    const inner = [cx + inward * a, cy + G * 0.012];
    const outer = [cx - inward * a * 0.96, cy - G * 0.010];
    const U1 = [cx + inward * a * 0.50, cy - up * 1.40], U2 = [cx - inward * a * 0.42, cy - up * 1.30];
    const L1 = [cx - inward * a * 0.40, cy + low * 1.28], L2 = [cx + inward * a * 0.48, cy + low * 1.32];
    const upperAt = t => bez(inner, U1, U2, outer, t);
    const lowerAt = t => bez(outer, L1, L2, inner, t);

    const opening = () => {
      g.beginPath();
      g.moveTo(inner[0], inner[1]);
      g.bezierCurveTo(U1[0], U1[1], U2[0], U2[1], outer[0], outer[1]);
      g.bezierCurveTo(L1[0], L1[1], L2[0], L2[1], inner[0], inner[1]);
      g.closePath();
    };

    // the socket: shadow under the brow ridge and down beside the nose
    soft(g, cx, cy - G * 0.10, G * 0.36, dark, 0.28);
    soft(g, cx + inward * a * 1.05, cy + G * 0.02, G * 0.12, dark, 0.22);
    soft(g, cx, cy + G * 0.12, G * 0.22, flush, 0.14);                       // under-eye
    soft(g, cx - inward * a * 0.1, cy - up * 1.9, G * 0.14, mix(fr.skin, WHITE, 0.35), 0.22);  // lid catches light

    // lid crease, soft by stacking strokes rather than blurring (Safari has no canvas filter)
    const cIn = [cx + inward * a * 0.82, cy - up * 0.9], cOut = [cx - inward * a * 1.08, cy - up * 0.35];
    const C1 = [cx + inward * a * 0.45, cy - up * 2.55], C2 = [cx - inward * a * 0.55, cy - up * 2.45];
    g.lineCap = g.lineJoin = 'round';
    [[G * 0.05, 0.07], [G * 0.022, 0.14], [G * 0.008, 0.28]].forEach(([wd, al]) => {
      g.strokeStyle = rgba(dark, al);
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(cIn[0], cIn[1]);
      g.bezierCurveTo(C1[0], C1[1], C2[0], C2[1], cOut[0], cOut[1]);
      g.stroke();
    });

    /* the brow sits right on the rim of what the dome takes, so the fisheye
       curls it round the top of the eye */
    for (let k = 0; k < 170; k++) {
      const t = R();
      const bx = cx + inward * a * (0.95 - t * 2.15);
      const by = cy - G * (0.27 + 0.07 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.9))
               + (R() - 0.5) * G * 0.05 * (1 - t * 0.6);
      const len = G * (0.03 + R() * 0.03);
      const th = (80 - 65 * t) * Math.PI / 180;    // upright by the nose, flat by the temple
      const dx = out * Math.cos(th) * len, dy = -Math.sin(th) * len;
      g.strokeStyle = rgba(mix(fr.hair, fr.skin, R() * 0.3), 0.35 + R() * 0.3);
      g.lineWidth = G * (0.004 + R() * 0.004);
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + dx * 0.6, by + dy * 0.4, bx + dx, by + dy);
      g.stroke();
    }

    /* ------------------------------------------------- inside the lids */
    g.save();
    opening();
    g.clip();

    // the white of the eye — never actually white
    const scl = g.createRadialGradient(cx, cy, ir * 0.8, cx, cy, a * 1.05);
    scl.addColorStop(0, 'rgb(238,232,226)');
    scl.addColorStop(0.6, 'rgb(222,212,206)');
    scl.addColorStop(1, 'rgb(176,150,146)');
    g.fillStyle = scl;
    g.fillRect(cx - a * 1.2, cy - G * 0.2, a * 2.4, G * 0.4);

    soft(g, inner[0] - inward * G * 0.025, inner[1], G * 0.045, [206, 120, 118], 0.9);   // caruncle

    // a few veins, from the corners in
    for (let k = 0; k < 7; k++) {
      const fromIn = k % 2 === 0;
      const sx = fromIn ? inner[0] - inward * G * 0.02 : outer[0] + inward * G * 0.01;
      const sy = cy + (R() - 0.5) * up * 1.2;
      const ex = cx + (fromIn ? inward : out) * ir * (1.1 + R() * 0.3);
      const ey = cy + (R() - 0.5) * ir;
      g.strokeStyle = 'rgba(178,64,60,' + (0.12 + R() * 0.16).toFixed(2) + ')';
      g.lineWidth = G * (0.002 + R() * 0.002);
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo((sx + ex) / 2 + (R() - 0.5) * G * 0.03, (sy + ey) / 2 + (R() - 0.5) * G * 0.03, ex, ey);
      g.stroke();
    }

    paintIris(g, fr, cx, cy, ir, R);

    // shadow the upper lid casts across the ball, and the corners falling away
    const lid = g.createLinearGradient(0, cy - up * 1.1, 0, cy - up * 1.1 + G * 0.085);
    lid.addColorStop(0, 'rgba(40,20,14,0.55)');
    lid.addColorStop(1, 'rgba(40,20,14,0)');
    g.fillStyle = lid;
    g.fillRect(cx - a * 1.2, cy - G * 0.2, a * 2.4, G * 0.4);
    soft(g, outer[0], outer[1], G * 0.09, [60, 34, 30], 0.35);

    // wet catchlights — the thing that makes it read as alive
    soft(g, cx - ir * 0.34, cy - ir * 0.36, ir * 0.30, WHITE, 0.95);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(cx - ir * 0.34, cy - ir * 0.36, ir * 0.13, ir * 0.10, -0.4, 0, Math.PI * 2);
    g.fill();
    soft(g, cx + ir * 0.42, cy + ir * 0.40, ir * 0.12, WHITE, 0.45);

    g.restore();

    /* ----------------------------------------------------- the lids */
    // waterline, then the lower lid edge
    g.strokeStyle = rgba([232, 170, 162], 0.55);
    g.lineWidth = G * 0.008;
    g.beginPath();
    g.moveTo(outer[0], outer[1]);
    g.bezierCurveTo(L1[0], L1[1] - G * 0.004, L2[0], L2[1] - G * 0.004, inner[0], inner[1]);
    g.stroke();
    g.strokeStyle = rgba(dark, 0.35);
    g.lineWidth = G * 0.005;
    g.beginPath();
    g.moveTo(outer[0], outer[1] + G * 0.004);
    g.bezierCurveTo(L1[0], L1[1] + G * 0.006, L2[0], L2[1] + G * 0.006, inner[0], inner[1] + G * 0.004);
    g.stroke();

    // lash line
    [[G * 0.018, 0.45], [G * 0.010, 0.9]].forEach(([wd, al]) => {
      g.strokeStyle = rgba(fr.hair, al);
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(inner[0], inner[1]);
      g.bezierCurveTo(U1[0], U1[1], U2[0], U2[1], outer[0], outer[1]);
      g.stroke();
    });

    // upper lashes, longer and curlier toward the outer corner
    for (let k = 0; k < 44; k++) {
      const t = 0.06 + (k / 43) * 0.92 + (R() - 0.5) * 0.015;
      const p = upperAt(t), q = upperAt(Math.min(1, t + 0.01));
      let tx = q[0] - p[0], ty = q[1] - p[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      let nx = ty, ny = -tx;
      if (ny > 0) { nx = -nx; ny = -ny; }          // away from the eyeball
      const len = G * (0.035 + 0.055 * t) * (0.8 + R() * 0.4);
      const ex = p[0] + nx * len * 0.75 + out * len * (0.25 + 0.45 * t);
      const ey = p[1] + ny * len * 0.85;
      g.strokeStyle = rgba(fr.hair, 0.7 + R() * 0.25);
      g.lineWidth = G * (0.004 + R() * 0.003);
      g.beginPath();
      g.moveTo(p[0], p[1]);
      g.quadraticCurveTo(p[0] + nx * len * 0.55, p[1] + ny * len * 0.55, ex, ey);
      g.stroke();
    }

    // a few short, faint lower lashes on the outer half
    for (let k = 0; k < 14; k++) {
      const p = lowerAt(0.12 + (k / 13) * 0.6);
      const len = G * (0.012 + R() * 0.012);
      g.strokeStyle = rgba(fr.hair, 0.28 + R() * 0.2);
      g.lineWidth = G * 0.003;
      g.beginPath();
      g.moveTo(p[0], p[1] + G * 0.006);
      g.lineTo(p[0] + out * len * 0.4, p[1] + G * 0.006 + len);
      g.stroke();
    }
  }

  function paintIris(g, fr, cx, cy, ir, R) {
    const light = mix(fr.iris, [214, 170, 96], 0.40);    // amber toward the pupil
    const base = g.createRadialGradient(cx, cy, ir * 0.25, cx, cy, ir);
    base.addColorStop(0, rgba(light));
    base.addColorStop(0.45, rgba(fr.iris));
    base.addColorStop(0.85, rgba(mix(fr.iris, fr.rim, 0.45)));
    base.addColorStop(1, rgba(fr.rim));
    g.fillStyle = base;
    g.beginPath();
    g.arc(cx, cy, ir, 0, Math.PI * 2);
    g.fill();

    // stroma: radial fibres, light and dark
    for (let k = 0; k < 220; k++) {
      const ang = R() * Math.PI * 2;
      const r0 = ir * (0.34 + R() * 0.12), r1 = ir * (0.70 + R() * 0.28);
      const bend = (R() - 0.5) * 0.18, mr = (r0 + r1) / 2;
      g.strokeStyle = R() < 0.55
        ? rgba(mix(fr.iris, WHITE, 0.45), (0.16 + R() * 0.14).toFixed(2))
        : rgba(fr.rim, (0.18 + R() * 0.2).toFixed(2));
      g.lineWidth = ir * (0.015 + R() * 0.025);
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      g.quadraticCurveTo(cx + Math.cos(ang + bend) * mr, cy + Math.sin(ang + bend) * mr,
                         cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      g.stroke();
    }

    // crypts
    for (let k = 0; k < 14; k++) {
      const ang = R() * Math.PI * 2, rr = ir * (0.5 + R() * 0.3);
      g.fillStyle = rgba(fr.rim, (0.22 + R() * 0.2).toFixed(2));
      g.beginPath();
      g.ellipse(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr,
                ir * (0.03 + R() * 0.05), ir * (0.02 + R() * 0.03), ang, 0, Math.PI * 2);
      g.fill();
    }

    // collarette: the ragged ring around the pupil
    g.strokeStyle = rgba(mix(light, WHITE, 0.2), 0.35);
    g.lineWidth = ir * 0.035;
    g.beginPath();
    for (let k = 0; k <= 48; k++) {
      const ang = (k / 48) * Math.PI * 2, rr = ir * (0.50 + (R() - 0.5) * 0.08);
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      k === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();

    // limbal ring, soft on both sides
    const limb = g.createRadialGradient(cx, cy, ir * 0.80, cx, cy, ir * 1.03);
    limb.addColorStop(0, rgba(fr.rim, 0));
    limb.addColorStop(0.75, rgba(fr.rim, 0.75));
    limb.addColorStop(1, rgba(fr.rim, 0));
    g.fillStyle = limb;
    g.beginPath();
    g.arc(cx, cy, ir * 1.03, 0, Math.PI * 2);
    g.fill();

    // pupil
    const pr = ir * 0.36;
    const pup = g.createRadialGradient(cx, cy, pr * 0.7, cx, cy, pr * 1.12);
    pup.addColorStop(0, 'rgba(8,6,6,1)');
    pup.addColorStop(1, 'rgba(8,6,6,0)');
    g.fillStyle = pup;
    g.beginPath();
    g.arc(cx, cy, pr * 1.12, 0, Math.PI * 2);
    g.fill();
  }

  /* Sensor noise — without it the painting reads as a painting. */
  function grain(g, R) {
    const img = g.getImageData(0, 0, SIZE, SIZE), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (R() - 0.5) * 14;
      d[i]     += n + (R() - 0.5) * 4;
      d[i + 1] += n;
      d[i + 2] += n + (R() - 0.5) * 4;
    }
    g.putImageData(img, 0, 0);
  }

  /* --------------------------------------------------------------- bake */

  /* Either { right: {eye}, left: {eye} } for the eye cut, or { face } for the
     whole-face cut — the same two shapes a real capture produces, so the tank
     draws a stand-in exactly as it draws a fish somebody made. */
  function build(fr) {
    const face = paintFace(fr);
    const A = {
      eyeL: { x: EYES[0], y: ROW }, eyeR: { x: EYES[1], y: ROW }, eyeGap: GAP,
      /* the box the whole-face cut samples: centred between eyes and mouth, wide
         enough to take the cheeks, tall enough for forehead-to-chin */
      faceC: { x: 0.5, y: 0.60 }, faceW: 0.62, faceH: 0.70
    };
    if (fr.mode === 'face') {
      return { face: FaceParts.bake(face, A, { fish: fr.fish, mode: 'face', eyeBulge: fr.bulge || 0 }).face };
    }
    return {
      right: FaceParts.bake(face, A, { fish: fr.fish, side: 'right' }),
      left:  FaceParts.bake(face, A, { fish: fr.fish, side: 'left' })
    };
  }

  return { FRIENDS, build, paintFace };
})();
