/* Fish Friends — voice capture and the "bubbly cartoon fish" playback filter.
   Recording: MediaRecorder, hold-to-record, hard 5s cap.
   Playback:  pitched up + warbled + band-limited, with bubble pops on top. */

const Voice = (() => {
  const MAX_MS = 5000;

  let ctx = null;
  let buffer = null;          // decoded clip, ready to play
  let analyser = null;
  let timeData = null;
  let playing = false;

  let recorder = null, chunks = [], stream = null, stopTimer = null;

  /* ------------------------------------------------------------- context */

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.connect(ctx.destination);
      timeData = new Uint8Array(analyser.fftSize);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* iOS will not make a sound until an AudioContext is resumed inside a
     real user gesture, so every page calls this on first touch. */
  function unlock() { try { audio(); } catch (e) {} }

  /* ----------------------------------------------------------- recording */

  function pickMime() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus'
    ];
    if (typeof MediaRecorder === 'undefined') return '';
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  async function startRecording(onAutoStop) {
    if (recorder) return;
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.start();
    stopTimer = setTimeout(() => { if (onAutoStop) onAutoStop(); }, MAX_MS);
  }

  /* Resolves with a data URL, or null if nothing usable was captured. */
  function stopRecording() {
    return new Promise(resolve => {
      if (!recorder) return resolve(null);
      clearTimeout(stopTimer);
      const rec = recorder;
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (stream) stream.getTracks().forEach(t => t.stop());
        recorder = null; stream = null;
        if (!blob.size) return resolve(null);
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.readAsDataURL(blob);
      };
      try { rec.stop(); } catch (e) { recorder = null; resolve(null); }
    });
  }

  function cancelRecording() {
    clearTimeout(stopTimer);
    if (recorder) { try { recorder.stop(); } catch (e) {} }
    if (stream) stream.getTracks().forEach(t => t.stop());
    recorder = null; stream = null; chunks = [];
  }

  /* ------------------------------------------------------------ decoding */

  async function load(dataUrl) {
    if (!dataUrl) { buffer = null; return false; }
    try {
      const res = await fetch(dataUrl);
      const arr = await res.arrayBuffer();
      buffer = await audio().decodeAudioData(arr);
      return true;
    } catch (e) {
      console.warn('could not decode voice clip', e);
      buffer = null;
      return false;
    }
  }

  function hasClip() { return !!buffer; }

  /* --------------------------------------------------------- the filter */

  /* Short synthetic room so the voice sounds like it is in water,
     not recorded two inches from a phone. */
  function makeImpulse(c, seconds = 0.4, decay = 3.2) {
    const len = Math.floor(c.sampleRate * seconds);
    const imp = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return imp;
  }

  /* A single bubble: a sine sweeping upward under a very fast envelope. */
  function bubble(c, at, out, base = 260) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, at);
    o.frequency.exponentialRampToValueAtTime(base * 3.4, at + 0.055);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.13, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 0.09);
  }

  function bubbleBurst(count = 5, spread = 0.5) {
    const c = audio();
    const g = c.createGain();
    g.gain.value = 0.9;
    g.connect(analyser);
    const now = c.currentTime;
    for (let i = 0; i < count; i++) {
      bubble(c, now + Math.random() * spread, g, 200 + Math.random() * 260);
    }
  }

  function play(onEnd) {
    if (!buffer) { bubbleBurst(3, 0.25); if (onEnd) setTimeout(onEnd, 400); return false; }
    const c = audio();

    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 1.42;      // pitch up — the cartoon-fish move

    // warble: an LFO nudging a tiny delay line, so the pitch swims
    const delay = c.createDelay();
    delay.delayTime.value = 0.006;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 6.5;
    lfoGain.gain.value = 0.0022;
    lfo.connect(lfoGain).connect(delay.delayTime);

    // band-limit it: no rumble underneath, no crisp highs on top
    const hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 320;
    const peak = c.createBiquadFilter();
    peak.type = 'peaking'; peak.frequency.value = 2100; peak.Q.value = 1.1; peak.gain.value = 7;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.8;

    const wet = c.createConvolver();
    wet.buffer = makeImpulse(c);
    const wetGain = c.createGain(); wetGain.gain.value = 0.28;
    const dryGain = c.createGain(); dryGain.gain.value = 0.95;
    const outGain = c.createGain(); outGain.gain.value = 1.0;

    src.connect(delay);
    delay.connect(hp); hp.connect(peak); peak.connect(lp);
    lp.connect(dryGain).connect(outGain);
    lp.connect(wet).connect(wetGain).connect(outGain);
    outGain.connect(analyser);

    const dur = buffer.duration / src.playbackRate.value;
    playing = true;
    src.onended = () => { playing = false; if (onEnd) onEnd(); };
    lfo.start();
    src.start();
    try { lfo.stop(c.currentTime + dur + 0.2); } catch (e) {}

    // bubbles bracketing the line
    bubbleBurst(4, 0.3);
    setTimeout(() => bubbleBurst(3, 0.25), Math.max(120, dur * 1000 - 250));
    return true;
  }

  function isPlaying() { return playing; }

  /* 0..1 loudness, for driving the wiggle while the fish talks. */
  function level() {
    if (!analyser || !playing) return 0;
    analyser.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / timeData.length) * 3.2);
  }

  return {
    MAX_MS, unlock, startRecording, stopRecording, cancelRecording,
    load, play, hasClip, isPlaying, level, bubbleBurst
  };
})();
