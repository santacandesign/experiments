/* Fish Friends — taking only the parts of a face that carry identity.

   The previous version wrapped a whole photographic head onto the fish, which
   fought the flat illustrated palette: it read as a photo pasted on a drawing.
   This one cuts a single fragment — one eye — and leaves the creature itself
   drawn. The eye keeps its fisheye dome and a hand-drawn ink ring, since eyes
   have real outlines anyway.

   Everything is baked at capture and re-baked whenever a control moves, which is
   cheap: three small patches instead of two 460px heads.

   `fish` is 0..1 and drives how far the eye bulges. */

const FaceParts = (() => {

  const IDX = {
    irisA: 468, irisB: 473,
    eyeAouter: 33, eyeAinner: 133,
    eyeBinner: 362, eyeBouter: 263,
    mouthL: 61, mouthR: 291, mouthTop: 13, mouthBot: 14,
    noseTip: 1, cheekL: 234, cheekR: 454, chin: 152, brow: 10
  };

  /* the two eyebrow rings, upper and lower edges of each */
  const BROW_A = [70, 63, 105, 66, 107, 46, 53, 52, 65, 55];
  const BROW_B = [336, 296, 334, 293, 300, 276, 283, 282, 295, 285];

  /* the face silhouette (MediaPipe FACE_OVAL), so the whole-face cut can be
     clipped to just the face and not the room behind it */
  const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109
  ];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function bounds(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }

  /* ------------------------------------------------------------- anchors */

  function anchors(lms, map) {
    if (!lms || lms.length < 468) return null;
    const P = i => map(lms[i]);

    const hasIris = lms.length >= 478;
    const eA = hasIris ? P(IDX.irisA) : mid(P(IDX.eyeAouter), P(IDX.eyeAinner));
    const eB = hasIris ? P(IDX.irisB) : mid(P(IDX.eyeBinner), P(IDX.eyeBouter));
    const eyeL = eA.x <= eB.x ? eA : eB;
    const eyeR = eA.x <= eB.x ? eB : eA;

    const bA = bounds(BROW_A.map(P));
    const bB = bounds(BROW_B.map(P));
    const browL = bA.cx <= bB.cx ? bA : bB;
    const browR = bA.cx <= bB.cx ? bB : bA;

    const mL = P(IDX.mouthL), mR = P(IDX.mouthR);
    const chin = P(IDX.chin), brow = P(IDX.brow);
    const cL = P(IDX.cheekL), cR = P(IDX.cheekR);

    return {
      eyeL, eyeR, browL, browR,
      mouthL: mL.x <= mR.x ? mL : mR,
      mouthR: mL.x <= mR.x ? mR : mL,
      mouthC: mid(P(IDX.mouthTop), P(IDX.mouthBot)),
      mouthH: Math.abs(P(IDX.mouthBot).y - P(IDX.mouthTop).y),
      faceC: { x: (cL.x + cR.x) / 2, y: (brow.y + chin.y) / 2 },
      faceW: Math.abs(cR.x - cL.x) || 0.5,
      faceH: Math.abs(chin.y - brow.y) || 0.6,
      eyeGap: Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y) || 0.18,
      oval: FACE_OVAL.map(P)
    };
  }

  /* --------------------------------------------------------------- bake */

  /* Returns { eye } or { face } as canvases, ready to composite onto the fish.
     `mode: 'eye'` (default) cuts one eye — `side` picks which, so the fish can
     show one at a time and swap when it turns. `mode: 'face'` cuts a single
     round patch spanning both eyes, nose and mouth instead; it doesn't need a
     side, since the fish's own left/right flip mirrors it along with the body. */
  function bake(src, A, opts) {
    const fish = clamp(opts && opts.fish != null ? opts.fish : 0.65, 0, 1);
    const side = opts && opts.side === 'left' ? 'left' : 'right';
    const mode = (opts && opts.mode === 'face') ? 'face' : 'eye';
    const scale = (opts && opts.scale) || 1;
    const eyeBulge = clamp(opts && opts.eyeBulge != null ? opts.eyeBulge : 0, 0, 1);
    if (!A) return null;

    const sw = src.width, sh = src.height;
    const sd = src.getContext('2d', { willReadFrequently: true })
                  .getImageData(0, 0, sw, sh).data;
    const S = { sd, sw, sh };

    if (mode === 'face') return { face: facePatch(S, A, fish, Math.round(320 * scale), eyeBulge) };

    const eye = side === 'left' ? A.eyeL : A.eyeR;
    return { eye: eyePatch(S, A, eye, fish, Math.round(240 * scale)) };
  }

  /* The eye: sampled through a fisheye so the middle magnifies, shaded like a
     sphere, finished with a wobbly ink ring. */
  function eyePatch(S, A, eye, fish, size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = new ImageData(size, size);
    const d = img.data;

    const rFace = A.eyeGap * 0.32;      // how much of the photo the dome covers
    const R = size * 0.43;              // dome radius in patch pixels
    const k = 1 + 0.85 * fish;
    const c0 = size / 2;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const o = (py * size + px) * 4;
        const nx = (px + 0.5 - c0) / R, ny = (py + 0.5 - c0) / R;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) { d[o + 3] = 0; continue; }
        const r = Math.sqrt(r2);
        const m = r < 1e-5 ? 0 : Math.pow(r, k) / r;
        const c = sample(S, eye.x + nx * rFace * m, eye.y + ny * rFace * m);
        const shade = (1 - 0.22 * fish) + 0.22 * fish * Math.sqrt(1 - r2);
        const hx = nx + 0.40, hy = ny + 0.44;
        const spec = Math.max(0, 1 - (hx * hx + hy * hy) / 0.05) * 70 * (0.35 + 0.65 * fish);
        d[o]     = clamp(c[0] * shade + spec, 0, 255);
        d[o + 1] = clamp(c[1] * shade + spec, 0, 255);
        d[o + 2] = clamp(c[2] * shade + spec, 0, 255);
        /* one-pixel softness at the rim so the cut doesn't alias */
        d[o + 3] = 255 * clamp((1 - r) * R * 1.2, 0, 1);
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.save();
    ctx.strokeStyle = 'rgba(28,54,88,0.62)';
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, size * 0.016);
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = (Math.PI * 2 * i) / 32;
      const wob = R * 0.030 * Math.sin(a * 3 + 1.1);
      const x = c0 + Math.cos(a) * (R + wob - ctx.lineWidth * 0.35);
      const y = c0 + Math.sin(a) * (R + wob - ctx.lineWidth * 0.35);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return cv;
  }

  /* The whole face: the flat face, clipped to the face silhouette so only the
     face rides the fish and not the room behind it, with a circular fisheye lens
     dropped straight over each eye — a magnifier with its own ink ring, the way
     a goggle bulges the eye behind it. The photo is sampled a touch narrower
     across (`spread`) so the eyes sit farther apart. Everything outside the
     lenses is the plain flat face (forehead, nose, mouth, cheeks). `bulge`
     (0..1) drives how hard the lenses magnify; `fish` adds the sphere shading.

     The face is clipped to the tracked oval (A.oval) when a real capture
     provides one; a stand-in with no oval falls back to an ellipse on the face
     box. Seam: at a lens rim (rn → 1) the remap factor rn^(k-1) → 1, so the
     sample point equals the flat-face sample there — the magnified eye blends
     into the face with no tear, and the ring is drawn on top of that join. */
  function facePatch(S, A, fish, size, bulge) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = new ImageData(size, size);
    const d = img.data;

    const R = size * 0.46;                             // pixel scale for the mapping
    const c0 = size / 2;
    const c = A.faceC;
    const spread = 1.12;                               // eyes pushed a little farther apart
    const rY = Math.max(A.faceW, A.faceH) * 0.60;      // vertical reach on the photo
    const rX = rY / spread;                            // narrower source across → wider apart in the cut

    /* face-space (0..1 on the photo) → patch pixel, and the eyes' pixel centres */
    const toPx = (u, v) => [c0 + ((u - c.x) / rX) * R, c0 + ((v - c.y) / rY) * R];
    const eyes = [A.eyeL, A.eyeR].map(E => {
      const p = toPx(E.x, E.y);
      return { E, ex: p[0], ey: p[1] };
    });
    const gapPx = Math.hypot(eyes[1].ex - eyes[0].ex, eyes[1].ey - eyes[0].ey);
    const lensR = gapPx * 0.47;                        // small enough that the two lenses read apart
    const kBulge = 1 + 0.6 * fish + 2.2 * bulge;       // >1 shrinks source near centre → eye grows

    /* the face silhouette in patch pixels — a real capture clips to the tracked
       oval (so the room behind you is dropped); a stand-in with no oval falls
       back to an ellipse on the face box, grown to hold the eye lenses */
    const faceAx = (A.faceW * 0.5 / rX) * R, faceAy = (A.faceH * 0.5 / rY) * R;
    const lensAx = Math.max(Math.abs(eyes[0].ex - c0), Math.abs(eyes[1].ex - c0)) + lensR;
    const axPx = Math.max(faceAx * 1.05, lensAx * 1.02);
    const ayPx = Math.max(faceAy * 1.12, lensR * 1.02);

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const o = (py * size + px) * 4;
        const nx = (px + 0.5 - c0) / R, ny = (py + 0.5 - c0) / R;

        /* inside an eye lens? pick the nearer eye */
        let lens = null, lr = 1e9;
        for (const e of eyes) {
          const dd = Math.hypot(px + 0.5 - e.ex, py + 0.5 - e.ey);
          if (dd < lensR && dd < lr) { lr = dd; lens = e; }
        }

        let su, sv, shade = 1, spec = 0;
        if (lens) {
          const dx = px + 0.5 - lens.ex, dy = py + 0.5 - lens.ey;
          const rn = lr / lensR;                       // 0 centre .. 1 rim
          const m = rn < 1e-5 ? 0 : Math.pow(rn, kBulge) / rn;   // ≤1, →1 at rim
          su = lens.E.x + (dx / R) * rX * m;
          sv = lens.E.y + (dy / R) * rY * m;
          const q = Math.max(0, 1 - rn * rn);
          shade = (1 - 0.20 * fish) + 0.20 * fish * Math.sqrt(q);
          const hx = dx / lensR + 0.40, hy = dy / lensR + 0.44;
          spec = Math.max(0, 1 - (hx * hx + hy * hy) / 0.05) * 60 * (0.35 + 0.65 * fish);
        } else {
          su = c.x + nx * rX;                           // flat face, no dome
          sv = c.y + ny * rY;
        }

        const col = sample(S, su, sv);
        d[o]     = clamp(col[0] * shade + spec, 0, 255);
        d[o + 1] = clamp(col[1] * shade + spec, 0, 255);
        d[o + 2] = clamp(col[2] * shade + spec, 0, 255);
        d[o + 3] = 255;                                 // masked to the face below, not here
      }
    }

    /* stamp the sampled face, then keep only what's inside the face silhouette */
    const tcv = document.createElement('canvas');
    tcv.width = tcv.height = size;
    tcv.getContext('2d').putImageData(img, 0, 0);

    const facePath = new Path2D();
    if (A.oval && A.oval.length > 2) {
      A.oval.forEach((p, i) => {
        const q = toPx(p.x, p.y);
        i === 0 ? facePath.moveTo(q[0], q[1]) : facePath.lineTo(q[0], q[1]);
      });
      facePath.closePath();
    } else {
      facePath.ellipse(c0, c0, axPx, ayPx, 0, 0, Math.PI * 2);
    }
    ctx.save();
    ctx.clip(facePath);
    ctx.drawImage(tcv, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(28,54,88,0.62)';
    ctx.lineJoin = ctx.lineCap = 'round';

    /* a ring around each eye lens */
    ctx.lineWidth = Math.max(1, size * 0.012);
    for (const e of eyes) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (Math.PI * 2 * i) / 40;
        const wob = lensR * 0.02 * Math.sin(a * 3 + 1.1);
        const x = e.ex + Math.cos(a) * (lensR + wob);
        const y = e.ey + Math.sin(a) * (lensR + wob);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    /* and the face outline itself */
    ctx.lineWidth = Math.max(1, size * 0.016);
    ctx.stroke(facePath);
    ctx.restore();
    return cv;
  }

  /* Brow and lips: straight sample inside an ellipse, alpha falling away to
     nothing at the edge so they melt into the fish's flat colour. */
  function sample(S, u, v) {
    const { sd, sw, sh } = S;
    const fx = clamp(u * sw - 0.5, 0, sw - 1.001);
    const fy = clamp(v * sh - 0.5, 0, sh - 1.001);
    const x0 = fx | 0, y0 = fy | 0;
    const ax = fx - x0, ay = fy - y0;
    const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
    const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
    return [
      sd[i00]     * w00 + sd[i10]     * w10 + sd[i01]     * w01 + sd[i11]     * w11,
      sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11,
      sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11
    ];
  }

  /* Where the tracker thinks your features are — drawn over the live camera so
     you can see what is about to be taken. */
  function drawMarkers(ctx, A, size) {
    if (!A) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(247,240,228,0.95)';
    ctx.lineWidth = Math.max(1.5, size * 0.008);
    ctx.lineJoin = ctx.lineCap = 'round';
    const ell = (cx, cy, rx, ry) => {
      ctx.beginPath();
      ctx.ellipse(cx * size, cy * size, rx * size, ry * size, 0, 0, Math.PI * 2);
      ctx.stroke();
    };
    for (const e of [A.eyeL, A.eyeR]) ell(e.x, e.y, A.eyeGap * 0.30, A.eyeGap * 0.30);
    ctx.restore();
  }

  return { anchors, bake, drawMarkers };
})();
