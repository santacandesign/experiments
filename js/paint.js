/* Fish Friends — the paint box.

   How everything is *coloured* — never what it does — lives here:

   - `Look`  the dial values, persisted under fishfriends.look.v2, plus presets
             and a slide-out panel (mounted by the tank page only).
   - `Col`   small colour maths: parse, mix, hue/saturation shifts.
   - `Paint` fish colour schemes, and the few textures shared by the fish and
             the tank (grain, bubble, light shaft, caustic net, a soft mote).

   The look is flat, saturated, inked: every body colour comes with its own
   accents — a belly, a head cap, a cheek band, fins in a contrasting colour —
   the way the reference fish are painted. Loaded after shared.js and before
   creatures.js on both pages, so the make-a-fish preview uses the same dials. */

/* ----------------------------------------------------------------- dials */

const Look = (() => {
  const KEY = 'fishfriends.look.v2';

  /* bg: true    → baked into the background, so moving it rebakes that
     scene: true → changes what is in the tank, so moving it rebuilds the cast */
  const DIALS = [
    { group: 'water' },
    { key: 'waterHue',   label: 'water hue',        min: -60, max: 60, step: 1, def: 0, bg: true },
    { key: 'waterDepth', label: 'water depth',      def: 0.45, bg: true },
    { key: 'waterSat',   label: 'water saturation', def: 0.8,  bg: true },
    { key: 'haze',       label: 'distance haze',    def: 0.55, bg: true },
    { key: 'rays',       label: 'light shafts',     def: 0.6 },
    { key: 'caustics',   label: 'caustics',         def: 0.45 },
    { key: 'bubbles',    label: 'bubbles',          def: 0.6 },
    { key: 'particles',  label: 'floating specks',  def: 0.4 },
    { key: 'vignette',   label: 'vignette',         def: 0.35 },
    { key: 'grain',      label: 'paper grain',      def: 0.3 },

    { group: 'plants' },
    { key: 'plants',     label: 'plant density',    def: 0.7, bg: true, scene: true },
    { key: 'plantHue',   label: 'plant hue',        min: -50, max: 50, step: 1, def: 0, bg: true },
    { key: 'plantVivid', label: 'plant saturation', min: 0.3, max: 1.5, def: 1.0, bg: true },
    { key: 'redPlants',  label: 'red stems',        def: 0.5, bg: true, scene: true },
    { key: 'sway',       label: 'plant sway',       def: 0.5 },
    { key: 'sand',       label: 'sand warmth',      def: 0.6, bg: true },

    { group: 'fish' },
    { key: 'vivid',      label: 'saturation',       min: 0.4, max: 1.6, def: 1.15 },
    { key: 'bright',     label: 'brightness',       min: -0.25, max: 0.25, def: 0 },
    { key: 'ink',        label: 'outline weight',   min: 0, max: 2, def: 1 },
    { key: 'inkDark',    label: 'outline darkness', def: 0.85 },
    { key: 'marks',      label: 'markings',         def: 0.85 },
    { key: 'gloss',      label: 'gloss',            def: 0.8 },
    { key: 'finRays',    label: 'fin rays',         def: 0.7 },
    { key: 'shading',    label: 'shading',          def: 0.22 },
    { key: 'texture',    label: 'riso texture',     def: 0.35 },
    { key: 'wobble',     label: 'line wobble',      min: 0, max: 2, def: 0.55 },
    { key: 'boil',       label: 'line boil',        def: 0.4 },

    { group: 'tank' },
    { key: 'scenery',    label: 'scenery colour',   def: 0.8 },
    { key: 'cast',       label: 'scenery fish',     def: 0.6, scene: true },
    { key: 'farFish',    label: 'distant shoals',   def: 0.5 },
    { key: 'fishSize',   label: 'fish size',        min: 0.6, max: 1.5, def: 1, scene: true },
    { key: 'speed',      label: 'swim speed',       min: 0.2, max: 2.5, def: 1 }
  ];
  DIALS.forEach(d => {
    if (!d.key) return;
    if (d.min == null) d.min = 0;
    if (d.max == null) d.max = 1;
    if (d.step == null) d.step = (d.max - d.min) / 100;
  });

  const DEF = {};
  DIALS.forEach(d => { if (d.key) DEF[d.key] = d.def; });

  /* Each preset only lists what it changes from the defaults. */
  const PRESETS = {
    reference: {},
    neon: {
      vivid: 1.55, bright: 0.04, inkDark: 1, waterDepth: 0.8, waterSat: 1, haze: 0.7,
      rays: 0.85, plantVivid: 1.4, redPlants: 0.8, gloss: 1, texture: 0.15, grain: 0.15,
      vignette: 0.55
    },
    pastel: {
      vivid: 0.7, bright: 0.16, ink: 0.6, inkDark: 0.35, waterDepth: 0.12, waterSat: 0.5,
      haze: 0.8, plantVivid: 0.6, shading: 0.08, texture: 0.25, rays: 0.8, vignette: 0.15,
      sand: 0.85
    },
    storybook: {
      ink: 1.5, wobble: 1.4, boil: 0.75, texture: 0.75, grain: 0.75, marks: 1,
      shading: 0.1, vivid: 1.05, haze: 0.4
    },
    clean: {
      wobble: 0, boil: 0, texture: 0, grain: 0, shading: 0.3, particles: 0.25,
      ink: 0.85, vignette: 0.2
    },
    deep: {
      waterHue: 18, waterDepth: 0.95, waterSat: 0.9, haze: 0.85, rays: 0.95, caustics: 0.2,
      particles: 0.8, vignette: 0.7, plantVivid: 0.85, scenery: 0.4, farFish: 0.9
    }
  };

  const v = Object.assign({}, DEF);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) for (const k in DEF) if (typeof saved[k] === 'number') v[k] = saved[k];
  } catch (e) {}

  let gen = 0, bgDirty = false, sceneDirty = false, saveTimer = 0;
  const listeners = [];

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }
  function changed(d) {
    gen++;
    if (!d || d.bg) bgDirty = true;
    if (!d || d.scene) sceneDirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 200);
    listeners.forEach(fn => { try { fn(); } catch (e) {} });
  }
  function set(key, val) {
    v[key] = val;
    changed(DIALS.find(x => x.key === key));
  }
  function apply(preset) {
    for (const k in DEF) v[k] = (preset && k in preset) ? preset[k] : DEF[k];
    changed(null);
  }
  /* each true once after a dial of that kind moves */
  function takeBgDirty() { const d = bgDirty; bgDirty = false; return d; }
  function takeSceneDirty() { const d = sceneDirty; sceneDirty = false; return d; }

  /* line boil: 0 freezes the wobble, 1 re-inks every other frame */
  function boilFrames() {
    return v.boil < 0.02 ? Infinity : Math.round(14 - 12 * v.boil);
  }

  return {
    DIALS, DEF, PRESETS, v, set, apply, takeBgDirty, takeSceneDirty, boilFrames,
    get gen() { return gen; },
    onChange(fn) { listeners.push(fn); }
  };
})();

/* ---------------------------------------------------------------- colour */

const Col = (() => {
  const cache = new Map();

  function parse(c) {
    if (Array.isArray(c)) return c;
    let out = cache.get(c);
    if (out) return out;
    out = [0, 0, 0, 1];
    if (typeof c === 'string') {
      const s = c.trim();
      if (s[0] === '#') {
        let h = s.slice(1);
        if (h.length === 3) h = h.split('').map(x => x + x).join('');
        out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
               h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
      } else {
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (m) {
          const p = m[1].split(',').map(x => parseFloat(x));
          out = [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
        }
      }
    }
    if (cache.size > 3000) cache.clear();
    cache.set(c, out);
    return out;
  }

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const hex = c => {
    const p = parse(c);
    return '#' + [0, 1, 2].map(i => clamp(Math.round(p[i]), 0, 255).toString(16).padStart(2, '0')).join('');
  };
  const rgba = (c, a) => {
    const p = parse(c);
    const al = a == null ? p[3] : a * p[3];
    return 'rgba(' + Math.round(p[0]) + ',' + Math.round(p[1]) + ',' + Math.round(p[2]) + ',' +
           clamp(al, 0, 1).toFixed(3) + ')';
  };
  const mix = (a, b, t) => {
    const p = parse(a), q = parse(b);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t,
            p[2] + (q[2] - p[2]) * t, p[3] + (q[3] - p[3]) * t];
  };

  function toHsl(c) {
    const p = parse(c);
    const r = p[0] / 255, g = p[1] / 255, b = p[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l, p[3]];
  }
  function fromHsl(h, s, l, a = 1) {
    h = ((h % 360) + 360) % 360;
    const k = n => (n + h / 30) % 12;
    const A = s * Math.min(l, 1 - l);
    const f = n => l - A * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255, a];
  }
  /* shift hue (degrees), scale saturation, add lightness (0..1) */
  function adjust(c, dh, sMul, dl) {
    const [h, s, l, a] = toHsl(c);
    return fromHsl(h + dh, clamp(s * sMul, 0, 1), clamp(l + dl, 0, 1), a);
  }

  return { parse, hex, rgba, mix, adjust, toHsl, fromHsl };
})();

/* ----------------------------------------------------------------- paint */

const Paint = (() => {
  const L = Look.v;
  const memo = new Map();
  function remember(key, fn) {
    let r = memo.get(key);
    if (r === undefined) {
      if (memo.size > 6000) memo.clear();
      r = fn();
      memo.set(key, r);
    }
    return r;
  }

  /* The ink every line is drawn in: a warm near-black, as in the reference. */
  const INK = '#22151B';

  /* ------------------------------------------------------- schemes ---

     A fish is never one colour. Each scheme is a body colour plus the accents
     that go with it, picked off the reference sheet:

       body   the main coat          belly  the lower band
       head   the snout cap          cheek  the band behind the gill line
       fin    every fin              mark   dashes, scales, rings
       gloss  the wet highlight

     The make-a-fish swatches are the `body` colours, so a stored fish keeps
     only its body hex and gets its accents back from here. */
  const SCHEMES = [
    { name: 'ember',     body: '#FF4A1C', belly: '#FF7DAE', head: '#FFB0BC', cheek: '#FF9020', fin: '#8A9A1C', mark: '#A8170A' },
    { name: 'goldie',    body: '#FF8A12', belly: '#FFD08A', head: '#FF8A12', cheek: '#FFDE3A', fin: '#E596F0', mark: '#E1240F' },
    { name: 'sunny',     body: '#FFC612', belly: '#FF6528', head: '#FFC612', cheek: '#FF3F6A', fin: '#16AEDC', mark: '#D77800' },
    { name: 'bubblegum', body: '#FF8FB8', belly: '#FFD3E2', head: '#FF8FB8', cheek: '#FF5530', fin: '#0F8F4E', mark: '#D93A7A' },
    { name: 'lagoon',    body: '#0F8A4B', belly: '#7EC4FF', head: '#0F8A4B', cheek: '#FF8A1E', fin: '#FF86BE', mark: '#064D29' },
    { name: 'reef',      body: '#10B4CC', belly: '#FFE04A', head: '#10B4CC', cheek: '#FF4F7E', fin: '#FF4F7E', mark: '#05748A' },
    { name: 'periwinkle',body: '#93A9FF', belly: '#D2DCFF', head: '#FF5A1C', cheek: '#FFD43C', fin: '#11904A', mark: '#3F52C8' },
    { name: 'moss',      body: '#8C9C14', belly: '#FF6A1C', head: '#E79CF2', cheek: '#FF6A1C', fin: '#94B4FF', mark: '#55600B' }
  ];
  const GREY = { name: 'grey', body: '#8A8F92', belly: '#A9ADAF', head: '#9A9EA1', cheek: '#777C7F',
                 fin: '#6F7476', mark: '#55595B' };

  /* Older fish were saved with a single colour; find the scheme closest in hue.
     Anything nearly grey is grey. */
  function baseScheme(col) {
    return remember('base|' + col, () => {
      const hit = SCHEMES.find(s => s.body.toLowerCase() === String(col).toLowerCase());
      if (hit) return hit;
      const [h, s] = Col.toHsl(col);
      if (s < 0.12) return GREY;
      let best = SCHEMES[0], bd = 999;
      for (const sc of SCHEMES) {
        const hh = Col.toHsl(sc.body)[0];
        const d = Math.min(Math.abs(hh - h), 360 - Math.abs(hh - h));
        if (d < bd) { bd = d; best = sc; }
      }
      return best;
    });
  }

  /* The colours a creature is actually painted in this frame, after the
     saturation / brightness dials, and — for scenery — the haze that sinks it
     back into the water. Memoised: this runs for every fish every frame. */
  function scheme(f) {
    const dead = f.lifeState === 'dead';
    const base = dead ? GREY : baseScheme(f.col);
    const haze = f.blend ? Math.max(0, Math.min(0.92, (1 - L.scenery) * 0.85 + (f.depth || 0) * L.haze * 0.35)) : 0;
    const water = f.blend ? Reef_waterMid() : '#000000';
    const key = base.name + '|' + L.vivid + '|' + L.bright + '|' + L.inkDark + '|' + haze.toFixed(2) + '|' + water;
    return remember('sch|' + key, () => {
      const v = c => {
        let out = Col.adjust(c, 0, dead ? 0 : L.vivid, L.bright);
        if (haze) out = Col.mix(out, water, haze);
        return Col.hex(out);
      };
      const out = {};
      for (const k of ['body', 'belly', 'head', 'cheek', 'fin', 'mark']) out[k] = v(base[k]);
      out.finRay = Col.hex(Col.mix(out.fin, '#FFFFFF', 0.45));
      out.gloss = Col.rgba(Col.mix('#FFFFFF', out.body, haze * 0.6), 1 - haze * 0.6);
      out.shadow = Col.hex(Col.mix(out.body, '#2A0E3A', 0.38));
      /* the outline: a warm near-black, or — dialled down — a deep shade of the
         body's own colour */
      const own = Col.mix(base.body, INK, 0.72);
      let line = Col.mix(own, INK, L.inkDark);
      if (haze) line = Col.mix(line, water, haze * 0.9);
      out.line = Col.hex(line);
      out.eye = Col.hex(Col.mix('#FFFFFF', water, haze * 0.7));
      out.pupil = Col.hex(Col.mix(INK, water, haze * 0.8));
      return out;
    });
  }
  /* set by reef.js, so scenery hazes toward the actual water colour */
  let waterMid = '#0E7D98';
  function Reef_waterMid() { return waterMid; }
  function setWater(c) { waterMid = c; }

  const BODY = SCHEMES.map(s => s.body);

  /* -------------------------------------------------------- textures */

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0 || 1;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  /* tileable value noise, `period` lattice cells across the tile */
  function tileNoise(size, period, seed) {
    const r = rng(seed);
    const lat = new Float32Array(period * period);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const out = new Float32Array(size * size);
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * period, y0 = Math.floor(fy), ty = sm(fy - y0);
      const ya = y0 % period, yb = (y0 + 1) % period;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * period, x0 = Math.floor(fx), tx = sm(fx - x0);
        const xa = x0 % period, xb = (x0 + 1) % period;
        const a = lat[ya * period + xa], b = lat[ya * period + xb];
        const c = lat[yb * period + xa], d = lat[yb * period + xb];
        out[y * size + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
      }
    }
    return out;
  }
  function fbm(size, periods, amps, seed) {
    const out = new Float32Array(size * size);
    let tot = 0;
    periods.forEach((p, i) => {
      const n = tileNoise(size, p, seed + i * 31);
      for (let k = 0; k < out.length; k++) out[k] += n[k] * amps[i];
      tot += amps[i];
    });
    for (let k = 0; k < out.length; k++) out[k] /= tot;
    return out;
  }
  function canvasOf(w, h, fill) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    fill(img.data);
    g.putImageData(img, 0, 0);
    return c;
  }

  let T = null;
  function tex() {
    if (T) return T;
    T = {};

    /* riso grain: fine speckle over a soft blotch, grey around mid so it
       works as an overlay */
    {
      const S = 192;
      const n = fbm(S, [6, 16], [0.6, 0.4], 11);
      const r = rng(5);
      T.grain = canvasOf(S, S, d => {
        for (let i = 0; i < S * S; i++) {
          let g = 128 + (n[i] - 0.5) * 70 + (r() - 0.5) * 120;
          if (r() < 0.04) g -= 60;
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.max(0, Math.min(255, g));
          d[i * 4 + 3] = 255;
        }
      });
    }

    /* caustics: the edges of a wrapped, warped voronoi — bright where two
       cells meet, which is what refracted sunlight on a floor looks like */
    {
      const S = 256, N = 13;
      const r = rng(23);
      const pts = [];
      for (let i = 0; i < N; i++) pts.push([r(), r()]);
      const warp = fbm(S, [3, 6], [0.7, 0.3], 41);
      const warp2 = fbm(S, [3, 6], [0.7, 0.3], 57);
      T.caustic = canvasOf(S, S, d => {
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const u = x / S + (warp[i] - 0.5) * 0.10;
            const v = y / S + (warp2[i] - 0.5) * 0.10;
            let f1 = 9, f2 = 9;
            for (const p of pts) {
              for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                const dx = u - (p[0] + ox), dy = v - (p[1] + oy);
                const dd = dx * dx + dy * dy;
                if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
              }
            }
            const e = Math.sqrt(f2) - Math.sqrt(f1);
            const line = Math.max(0, 1 - e / 0.035);
            const glow = Math.max(0, 1 - e / 0.14);
            const a = Math.min(1, Math.pow(line, 1.6) * 0.95 + glow * glow * 0.22);
            d[i * 4] = 235; d[i * 4 + 1] = 255; d[i * 4 + 2] = 240;
            d[i * 4 + 3] = a * 255;
          }
        }
      });
    }

    /* a soft light shaft, tinted, fading with depth */
    function ray(col) {
      const p = Col.parse(col);
      return canvasOf(128, 512, d => {
        for (let y = 0; y < 512; y++) {
          const ty = y / 511;
          const fall = Math.pow(1 - ty, 1.5) * (0.55 + 0.45 * Math.min(1, ty * 6));
          for (let x = 0; x < 128; x++) {
            const tx = (x / 127 - 0.5) * 2;
            const prof = Math.exp(-tx * tx * 3.2) * (0.85 + 0.15 * Math.cos(tx * 9 + ty * 4));
            const i = (y * 128 + x) * 4;
            d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2];
            d[i + 3] = Math.max(0, prof * fall) * 255;
          }
        }
      });
    }
    T.rayDay = ray('#FFF6CF');
    T.rayNight = ray('#A9BEF0');

    /* a bubble in the flat style: a pale ring with a bright window */
    {
      const S = 96, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const R = S / 2 - 4;
      g.fillStyle = 'rgba(220,250,255,0.16)';
      g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(235,255,255,0.85)';
      g.lineWidth = S * 0.06;
      g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.ellipse(S * 0.36, S * 0.34, S * 0.12, S * 0.07, -0.7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = S * 0.035;
      g.lineCap = 'round';
      g.beginPath(); g.arc(S / 2, S / 2, R * 0.7, 0.3, 1.1); g.stroke();
      T.bubble = c;
    }

    /* a soft mote, for floating specks */
    {
      const S = 32, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(240,255,245,1)');
      gr.addColorStop(0.35, 'rgba(225,250,240,0.55)');
      gr.addColorStop(1, 'rgba(225,250,240,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      T.mote = c;
    }
    return T;
  }

  const patterns = new WeakMap();
  function pattern(ctx, name) {
    let m = patterns.get(ctx);
    if (!m) { m = {}; patterns.set(ctx, m); }
    if (!m[name]) m[name] = ctx.createPattern(tex()[name], 'repeat');
    return m[name];
  }
  function placePattern(p, scale, ox = 0, oy = 0) {
    if (p && p.setTransform && typeof DOMMatrix !== 'undefined') {
      p.setTransform(new DOMMatrix([scale, 0, 0, scale, ox, oy]));
    }
  }

  /* Riso grain over whatever is currently clipped; moves with the fish since
     it is painted on. */
  function grainIn(ctx, x, y, w, h, amount, seed = 0) {
    if (amount < 0.01) return;
    const p = pattern(ctx, 'grain');
    placePattern(p, Math.max(0.35, Math.min(w, h) / 220), seed * 13, seed * 7);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(1, amount);
    ctx.fillStyle = p;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  return {
    INK, SCHEMES, BODY, scheme, setWater,
    tex, pattern, placePattern, grainIn, rng, hash
  };
})();

/* ------------------------------------------------------------ dial panel */

/* A slide-out panel of every dial, grouped, with presets. Only the tank page
   mounts it; the make-a-fish page just reads the saved values. */
Look.mountPanel = function (anchor) {
  if (document.getElementById('lookPanel')) return;

  const btn = document.createElement('button');
  btn.className = 'btn small icon ghost';
  btn.id = 'lookBtn';
  btn.title = 'Dials';
  btn.textContent = '🎛 dials';
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor);
  else document.body.appendChild(btn);

  const panel = document.createElement('aside');
  panel.className = 'look-panel';
  panel.id = 'lookPanel';
  panel.hidden = true;

  const head = document.createElement('div');
  head.className = 'look-head';
  head.innerHTML = '<b>dials</b>';
  const close = document.createElement('button');
  close.className = 'look-x';
  close.textContent = '×';
  close.title = 'Close';
  head.appendChild(close);
  panel.appendChild(head);

  const presets = document.createElement('div');
  presets.className = 'look-presets';
  Object.keys(Look.PRESETS).forEach(name => {
    const b = document.createElement('button');
    b.className = 'look-chip';
    b.textContent = name;
    b.addEventListener('click', () => { Look.apply(Look.PRESETS[name]); sync(); });
    presets.appendChild(b);
  });
  panel.appendChild(presets);

  const rows = {};
  let body = null;
  Look.DIALS.forEach(d => {
    if (d.group) {
      const sec = document.createElement('details');
      sec.className = 'look-sec';
      sec.open = true;
      const sum = document.createElement('summary');
      sum.textContent = d.group;
      sec.appendChild(sum);
      panel.appendChild(sec);
      body = sec;
      return;
    }
    const row = document.createElement('label');
    row.className = 'look-row';
    const name = document.createElement('span');
    name.textContent = d.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = d.min; input.max = d.max; input.step = d.step;
    input.value = Look.v[d.key];
    const out = document.createElement('output');
    const show = () => {
      const x = Look.v[d.key];
      out.textContent = d.max > 2 || d.min < -1 ? Math.round(x) : x.toFixed(2);
    };
    /* background dials rebake the whole backdrop, so those apply when the
       thumb settles rather than on every pixel of the drag */
    let pend = 0;
    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      if (d.bg || d.scene) {
        Look.v[d.key] = val; show();
        clearTimeout(pend);
        pend = setTimeout(() => Look.set(d.key, val), 90);
      } else {
        Look.set(d.key, val); show();
      }
    });
    input.addEventListener('dblclick', () => { Look.set(d.key, d.def); input.value = d.def; show(); });
    row.append(name, input, out);
    body.appendChild(row);
    rows[d.key] = { input, show };
    show();
  });

  const foot = document.createElement('div');
  foot.className = 'look-foot';
  const reset = document.createElement('button');
  reset.className = 'look-chip';
  reset.textContent = 'reset';
  reset.addEventListener('click', () => { Look.apply({}); sync(); });
  const copy = document.createElement('button');
  copy.className = 'look-chip';
  copy.textContent = 'copy values';
  copy.addEventListener('click', () => {
    const txt = JSON.stringify(Look.v, null, 2);
    const done = () => { copy.textContent = 'copied ✓'; setTimeout(() => { copy.textContent = 'copy values'; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done).catch(() => console.log(txt));
    else console.log(txt);
  });
  const tip = document.createElement('span');
  tip.className = 'look-tip';
  tip.textContent = 'double-click a dial to reset it';
  foot.append(reset, copy, tip);
  panel.appendChild(foot);

  function sync() {
    for (const k in rows) { rows[k].input.value = Look.v[k]; rows[k].show(); }
  }

  /* p5 listens on window, so taps on the panel must not reach the tank */
  ['mousedown', 'pointerdown', 'touchstart', 'click'].forEach(ev =>
    panel.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  ['mousedown', 'pointerdown', 'touchstart'].forEach(ev =>
    btn.addEventListener(ev, e => e.stopPropagation(), { passive: true }));

  btn.addEventListener('click', e => { e.stopPropagation(); panel.hidden = !panel.hidden; });
  close.addEventListener('click', () => { panel.hidden = true; });
  document.body.appendChild(panel);
};
