'use strict';
// Web Audio: pencil scratch and eraser that follow the drawing hand, the house (rain, fridge, clock, dog),
// one-shot sounds, and a small music-box theme for the ending. All synthesized; no files.
(function () {
  const U = WK.U;
  const A = WK.Audio = {};
  let ctx = null, master, comp, sfx, amb, mus, noiseBuf, verb, verbIn, drawBus;
  const vol = { master: 0.9, voice: 1, sfx: 0.8, amb: 0.7, music: 0.7, muted: false };
  A.vol = vol;
  try { Object.assign(vol, JSON.parse(localStorage.getItem('wamk_audio') || '{}')); } catch (e) { /* storage off */ }
  A.save = () => { try { localStorage.setItem('wamk_audio', JSON.stringify(vol)); } catch (e) { /* ignore */ } A.apply(); };
  A.running = () => !!ctx && ctx.state === 'running';
  // Recorded one-shots (ElevenLabs takes sliced by tools/slice_sfx.py), decoded once from js/sfx_data.js
  const bufs = {}, bags = {};
  A.sampleLog = [];
  let lastStrokeAt = 0;
  function loadSamples() {
    const D = WK.SFX_DATA; if (!D) return;
    for (const kind in D) {
      bufs[kind] = [];
      D[kind].forEach((c, i) => {
        const bin = atob(c.b64), u8 = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
        ctx.decodeAudioData(u8.buffer).then(b => { bufs[kind][i] = b; }).catch(() => {});
      });
    }
  }
  function draw(kind) {
    const list = (bufs[kind] || []).map((b, i) => i).filter(i => bufs[kind][i]);
    if (!list.length) return null;
    let bag = bags[kind];
    if (!bag || !bag.items.length) {
      const items = list.slice();
      for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
      if (bag && items[items.length - 1] === bag.last && items.length > 1) [items[0], items[items.length - 1]] = [items[items.length - 1], items[0]];
      bag = bags[kind] = { items, last: bag ? bag.last : -1 };
    }
    const i = bag.items.pop(); bag.last = i;
    return bufs[kind][i];
  }
  A.sample = (kind, o) => {
    if (!A.running()) return;
    o = o || {};
    const b = draw(kind); if (!b) return;
    A.sampleLog.push(kind + ':' + bufs[kind].indexOf(b)); if (A.sampleLog.length > 400) A.sampleLog.shift();
    const t = ctx.currentTime, src = ctx.createBufferSource();
    src.buffer = b; src.playbackRate.value = o.rate || (0.93 + Math.random() * 0.16);
    const g = ctx.createGain(); g.gain.value = (o.gain || 1) * 0.55;
    const p = ctx.createStereoPanner(); p.pan.value = o.pan || 0;
    src.connect(g); g.connect(p); p.connect(o.bus === 'sfx' ? sfx : drawBus);
    src.start(t, 0, o.max || b.duration);
    if (o.max && o.max < b.duration) { g.gain.setValueAtTime(g.gain.value, t + o.max - 0.05); g.gain.linearRampToValueAtTime(0, t + o.max); }
  };
  A.stroke = (dur, pan) => {
    if (!A.running()) return;
    const now = ctx.currentTime;
    if (now - lastStrokeAt < 0.06) return;
    lastStrokeAt = now;
    const long = dur > 0.32 && bufs.pencil_long && bufs.pencil_long.length;
    A.sample(long ? 'pencil_long' : 'pencil', { pan, gain: long ? 0.9 : 1, max: Math.max(0.2, dur + 0.12), rate: 0.95 + Math.random() * 0.14 });
  };

  // Background music (audio/music.mp3): starts on the first click or key, loops, dips while someone talks
  let bgm = null;
  A.bgmStart = () => {
    if (!bgm) { bgm = new Audio('audio/music.mp3'); bgm.loop = true; bgm.volume = 0; }
    if (bgm.paused) { const p = bgm.play(); if (p && p.catch) p.catch(() => {}); }
  };
  A.bgmUpdate = dt => {
    if (!bgm) return;
    const talking = WK.Voice && WK.Voice.playing && WK.Voice.playing();
    const want = vol.muted ? 0 : vol.master * vol.music * 0.42 * (talking ? 0.55 : 1);
    bgm.volume = Math.max(0, Math.min(1, bgm.volume + (want - bgm.volume) * Math.min(1, dt * 2)));
  };
  A.unlock = () => {
    A.bgmStart();
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      build();
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  };

  function build() {
    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); amb = ctx.createGain(); mus = ctx.createGain();
    sfx.connect(master); amb.connect(master); mus.connect(master);
    drawBus = ctx.createGain(); drawBus.connect(sfx);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // small room reverb
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 0.9), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.6; }
    verb.buffer = ir;
    verbIn = ctx.createGain(); verbIn.gain.value = 0.22;
    verbIn.connect(verb); verb.connect(sfx);
    A.apply();
    buildLoops();
    loadSamples();
  }
  A.apply = () => {
    if (!ctx) return;
    const m = vol.muted ? 0 : vol.master;
    master.gain.setTargetAtTime(m, ctx.currentTime, 0.05);
    sfx.gain.setTargetAtTime(vol.sfx, ctx.currentTime, 0.05);
    amb.gain.setTargetAtTime(vol.amb * (A.duck || 1), ctx.currentTime, 0.2);
    mus.gain.setTargetAtTime(vol.music, ctx.currentTime, 0.05);
  };
  A.voiceVolume = () => (vol.muted ? 0 : vol.master * vol.voice);

  function noise(dest, o) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = o && o.rate || 1;
    src.start(0, Math.random() * 1.5);
    let node = src;
    if (o && o.filters) for (const f of o.filters) { const bq = ctx.createBiquadFilter(); bq.type = f[0]; bq.frequency.value = f[1]; bq.Q.value = f[2] || 0.7; node.connect(bq); node = bq; }
    const g = ctx.createGain(); g.gain.value = o && o.gain !== undefined ? o.gain : 0;
    node.connect(g);
    let out = g;
    if (o && o.pan !== undefined) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
    out.connect(dest);
    return { src, g, out };
  }

  // ---------- loops ----------
  let pen, pen2, eraser, rainN, room, fridgeOsc = [], fridgeG, snoreN, penPan;
  function buildLoops() {
    penPan = ctx.createStereoPanner(); penPan.connect(drawBus);
    pen = noise(penPan, { filters: [['bandpass', 2600, 0.8], ['highshelf', 5000, 0.7]], gain: 0 });
    pen2 = noise(penPan, { filters: [['highpass', 5200, 0.6]], gain: 0 });
    eraser = noise(penPan, { filters: [['bandpass', 850, 0.6]], gain: 0 });
    room = noise(amb, { filters: [['lowpass', 260, 0.5]], gain: 0.05, rate: 0.5 });
    rainN = noise(amb, { filters: [['bandpass', 1500, 0.35], ['lowpass', 5000, 0.5]], gain: 0.0 });
    fridgeG = ctx.createGain(); fridgeG.gain.value = 0; fridgeG.connect(amb);
    for (const [f, a] of [[58, 0.5], [116, 0.35], [174, 0.18], [232, 0.08]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine';
      const g = ctx.createGain(); g.gain.value = a; o.connect(g); g.connect(fridgeG); o.start(); fridgeOsc.push(o);
    }
    snoreN = noise(amb, { filters: [['lowpass', 420, 1.2]], gain: 0 });
  }

  let penLevel = 0, erLevel = 0, crackT = 0, tickT = 0, snoreT = 0, dripT = 0;
  // state: {pen: 0..1, penSpeed, pan, eraser: 0..1, fridgeDist, clockDist, dogDist, fridgeOpen, rain: 0..1}
  A.update = (dt, s) => {
    if (!A.running()) return;
    const t = ctx.currentTime;
    penLevel = U.approach(penLevel, s.pen || 0, 25, dt);
    erLevel = U.approach(erLevel, s.eraser || 0, 18, dt);
    crackT -= dt;
    let crack = 1;
    if (crackT <= 0) { crackT = 0.02 + Math.random() * 0.05; crack = 0.6 + Math.random() * 0.8; }
    // the drawing sits under the voices: pull it down while anyone is talking
    const talking = WK.Voice && WK.Voice.playing && WK.Voice.playing();
    drawBus.gain.setTargetAtTime(talking ? 0.32 : 1, t, talking ? 0.06 : 0.5);
    const bed = WK.SFX_DATA ? 0.25 : 1;
    pen.g.gain.setTargetAtTime(penLevel * 0.2 * crack * bed, t, 0.012);
    pen2.g.gain.setTargetAtTime(penLevel * 0.07 * (Math.random() < 0.3 ? 1.8 : 0.6) * bed, t, 0.008);
    const sp = U.clamp((s.penSpeed || 1) / 3, 0.4, 1.6);
    pen.src.playbackRate.setTargetAtTime(0.85 + sp * 0.25, t, 0.05);
    eraser.g.gain.setTargetAtTime(erLevel * 0.22 * (0.6 + 0.4 * Math.sin(t * 55)) * (WK.SFX_DATA ? 0.2 : 1), t, 0.01);
    penPan.pan.setTargetAtTime(U.clamp(s.pan || 0, -0.8, 0.8), t, 0.05);
    rainN.g.gain.setTargetAtTime((s.rain || 0) * 0.05, t, 0.3);
    const fd = s.fridgeDist === undefined ? 20 : s.fridgeDist;
    fridgeG.gain.setTargetAtTime(U.clamp(1 - fd / 5, 0, 1) * 0.035 * (s.fridgeOpen ? 2.2 : 1), t, 0.2);
    // clock ticks in the living room
    tickT -= dt;
    if (tickT <= 0) {
      tickT += 1;
      const cd = s.clockDist === undefined ? 20 : s.clockDist;
      const a = U.clamp(1 - cd / 7, 0, 1) * 0.12;
      if (a > 0.003) click(3200, 0.012, a, amb);
    }
    // Biscuit snoring
    snoreT -= dt;
    const dd = s.dogDist === undefined ? 20 : s.dogDist;
    if (snoreT <= 0) {
      snoreT = 3.6 + Math.random() * 0.8;
      const a = U.clamp(1 - dd / 5, 0, 1) * 0.16 * (s.dogAsleep === false ? 0 : 1);
      if (a > 0.003) { snoreN.g.gain.cancelScheduledValues(t); snoreN.g.gain.setValueAtTime(0, t); snoreN.g.gain.linearRampToValueAtTime(a, t + 1.1); snoreN.g.gain.linearRampToValueAtTime(0, t + 2.2); }
    }
    dripT -= dt;
    if (dripT <= 0) { dripT = 0.4 + Math.random() * 1.6; if (s.rain) blip(1800 + Math.random() * 2400, 0.03, 0.02 * s.rain, amb); }
  };

  // ---------- one shots ----------
  function env(g, t, a, atk, dec) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec); }
  function click(freq, dec, a, dest) {
    const t = ctx.currentTime;
    const n = noise(dest || sfx, { filters: [['bandpass', freq, 3]], gain: 0 });
    env(n.g, t, a, 0.001, dec); n.src.stop(t + dec + 0.05);
  }
  function blip(freq, dec, a, dest, type) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); o.connect(g); g.connect(dest || sfx);
    env(g, t, a, 0.002, dec); o.start(t); o.stop(t + dec + 0.05);
  }
  function thump(freq, dec, a, noiseA, lp) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    const g = ctx.createGain(); o.connect(g); g.connect(sfx); g.connect(verbIn);
    env(g, t, a, 0.004, dec); o.start(t); o.stop(t + dec + 0.1);
    if (noiseA) { const n = noise(sfx, { filters: [['lowpass', lp || 700, 0.7]], gain: 0 }); env(n.g, t, noiseA, 0.003, dec * 0.8); n.src.stop(t + dec + 0.1); }
  }
  A.play = (name, o) => {
    if (!A.running()) return;
    o = o || {};
    const t = ctx.currentTime;
    switch (name) {
      case 'step': {
        const soft = o.surface === 'rug' ? 0.5 : 1;
        thump(64 + Math.random() * 12, 0.09, 0.2 * soft * (o.a || 1), 0.05 * soft, o.surface === 'stairs' ? 520 : 900);
        break;
      }
      case 'doorOpen': {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(170, t); osc.frequency.linearRampToValueAtTime(240, t + 0.5); osc.frequency.linearRampToValueAtTime(205, t + 0.8);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 6;
        const g = ctx.createGain(); osc.connect(bp); bp.connect(g); g.connect(sfx); g.connect(verbIn);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.15); g.gain.linearRampToValueAtTime(0.02, t + 0.6); g.gain.linearRampToValueAtTime(0, t + 0.85);
        osc.start(t); osc.stop(t + 0.9);
        click(1800, 0.03, 0.25);
        break;
      }
      case 'ding': {
        // a small bell: two bright partials, a soft second strike
        for (const [f, a, d, at] of [[1318.5, 0.16, 1.6, 0], [2637, 0.05, 0.7, 0], [3950, 0.018, 0.35, 0], [1975.5, 0.1, 1.4, 0.11], [3951, 0.03, 0.5, 0.11]]) {
          const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
          const g = ctx.createGain(); osc.connect(g); g.connect(sfx); g.connect(verbIn);
          env(g, t + at, a, 0.004, d); osc.start(t + at); osc.stop(t + at + d + 0.1);
        }
        break;
      }
      case 'thud': thump(52, 0.3, 0.55, 0.22, 420); break;
      case 'doorClose': thump(90, 0.14, 0.35, 0.12, 600); click(2400, 0.02, 0.2); break;
      case 'fridgeOpen': { const n = noise(sfx, { filters: [['lowpass', 500, 0.7]], gain: 0 }); env(n.g, t, 0.18, 0.01, 0.25); n.src.stop(t + 0.4); click(4200, 0.01, 0.08); break; }
      case 'fridgeClose': thump(80, 0.18, 0.4, 0.15, 400); break;
      case 'hangers': for (let i = 0; i < 4; i++) setTimeout(() => blip(2300 + Math.random() * 1400, 0.03 + Math.random() * 0.02, 0.05, sfx, 'triangle'), i * 45 + Math.random() * 40); break;
      case 'cushion': thump(55, 0.16, 0.12, 0.18, 300); break;
      case 'pat': thump(70, 0.07, 0.08, 0.1, 500); setTimeout(() => A.running() && thump(70, 0.07, 0.07, 0.09, 500), 160); break;
      case 'wag': thump(48, 0.08, 0.08, 0.06, 300); setTimeout(() => A.running() && thump(48, 0.08, 0.07, 0.05, 300), 220); break;
      case 'jingle': {
        const n = o.n || 11;
        for (let i = 0; i < n; i++) {
          setTimeout(() => {
            if (!A.running()) return;
            const base = 2200 + Math.random() * 3200;
            for (const k of [1, 2.76, 5.4]) if (base * k < 16000) blip(base * k, 0.12 + Math.random() * 0.15, 0.03 / k, sfx);
          }, i * (40 + Math.random() * 45));
        }
        break;
      }
      case 'circle': { // pencil circling for a committed guess
        const n = noise(sfx, { filters: [['bandpass', 2800, 0.8]], gain: 0 });
        n.g.gain.setValueAtTime(0, t);
        for (let i = 0; i < 10; i++) n.g.gain.linearRampToValueAtTime(0.12 + 0.05 * Math.sin(i * 1.3), t + i * 0.06);
        n.g.gain.linearRampToValueAtTime(0, t + 0.66); n.src.stop(t + 0.7);
        setTimeout(() => A.running() && click(1500, 0.03, 0.35), 680);
        break;
      }
      case 'wrong': {
        const n = noise(sfx, { filters: [['bandpass', 800, 0.6]], gain: 0 });
        n.g.gain.setValueAtTime(0, t);
        for (let i = 0; i < 12; i++) n.g.gain.linearRampToValueAtTime(i % 2 ? 0.05 : 0.16, t + i * 0.05);
        n.g.gain.linearRampToValueAtTime(0, t + 0.65); n.src.stop(t + 0.7);
        blip(147, 0.6, 0.08, sfx, 'triangle');
        break;
      }
      case 'found': {
        const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
        notes.forEach((f, i) => setTimeout(() => A.running() && bell(f, 2.6, 0.06), i * 110));
        setTimeout(() => A.play('jingle', { n: 14 }), 200);
        break;
      }
      case 'flash': { for (let i = 0; i < 3; i++) setTimeout(() => A.running() && bell(1318.5 * (1 + i * 0.25), 1.2, 0.02), i * 90); break; }
      case 'paper': { const n = noise(sfx, { filters: [['highpass', 1200, 0.5]], gain: 0 }); env(n.g, t, 0.07, 0.005, 0.18); n.src.stop(t + 0.3); break; }
      case 'tick': click(2600, 0.02, 0.12); break;
      case 'tap': click(1400, 0.025, 0.25); break;
    }
  };
  function bell(f, dec, a) {
    const t = ctx.currentTime;
    for (const [k, amp] of [[1, 1], [2, 0.35], [3.01, 0.12]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * k;
      const g = ctx.createGain(); o.connect(g); g.connect(mus); g.connect(verbIn);
      env(g, t, a * amp, 0.005, dec / k); o.start(t); o.stop(t + dec + 0.1);
    }
  }

  // ---------- music box for the replay and ending ----------
  const THEME = [[0, 72, 0.5], [0.5, 76, 0.5], [1, 79, 0.5], [1.5, 76, 0.5], [2, 74, 1], [3, 71, 0.5], [3.5, 74, 0.5], [4, 72, 1.5],
    [6, 69, 0.5], [6.5, 72, 0.5], [7, 76, 0.5], [7.5, 74, 0.5], [8, 72, 0.75], [8.75, 71, 0.25], [9, 72, 2]];
  let musicTimer = null;
  A.music = (on, o) => {
    if (musicTimer) { musicTimer.forEach(clearTimeout); musicTimer = null; }
    if (!on || !A.running()) return;
    const beat = (o && o.beat) || 0.42;
    musicTimer = [];
    const loops = (o && o.loops) || 3;
    for (let L = 0; L < loops; L++) {
      for (const [b, n, len] of THEME) {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        musicTimer.push(setTimeout(() => A.running() && bell(f, 1.6 + len, 0.045), (L * 11 + b) * beat * 1000));
        if (b % 2 === 0) musicTimer.push(setTimeout(() => A.running() && bell(f / 2, 2.4, 0.025), (L * 11 + b) * beat * 1000));
      }
    }
  };
})();
