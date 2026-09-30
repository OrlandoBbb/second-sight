'use strict';
// Boot and frame loop.
(function () {
  const canvas = document.getElementById('gl');
  const inkCv = document.getElementById('ink');
  WK.stats = { fps: 60, ms: 16 };
  function fatal(msg) {
    const el = document.getElementById('fatal');
    el.innerHTML = '<h2 class="hand">This page needs WebGL2</h2><p>' + msg + '</p><p>Try an up-to-date Chrome, Edge or Firefox with hardware acceleration on.</p>';
    el.classList.remove('hidden');
  }
  try { WK.R.init(canvas); } catch (e) { fatal(String(e && e.message || e)); console.error(e); return; }
  WK.Ink.init(inkCv);
  WK.Input.init(canvas);
  WK.Voice.init();
  WK.UI.init();
  WK.Game.boot();
  WK.UI.open('title');
  WK.Input.wantLock = () => WK.Game.mode === 'explore' && !WK.Game.paused && !WK.UI.top();
  WK.Input.onGesture = () => WK.Audio.unlock();
  WK.Input.onDevice = () => document.body.classList.toggle('pad', WK.Input.device === 'pad');

  let cw = 0, ch = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, document.body.classList.contains('touch') || navigator.maxTouchPoints > 0 ? 1.25 : 1.5);
    const q = WK.UI.settings.quality || 1;
    const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    WK.R.resize(Math.round(w * q), Math.round(h * q));
    cw = w; ch = h;
    WK.Ink.resize();
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now(), titleP = 0, sndHintShown = false;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    WK.stats.fps = WK.stats.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    const q = WK.UI.settings.quality || 1;
    if (Math.abs(WK.R.size()[0] - Math.round(canvas.width * q)) > 2) resize();
    WK.Input.update(dt);
    WK.UI.update();
    const G = WK.Game;
    G.update(dt);
    if (!G.paused) WK.World.update(dt * G.timeScale, {});
    WK.Voice.update(G.paused ? 0 : dt);
    const cam = G.camera(canvas.width / canvas.height);
    const f = WK.World.frame({ view: cam.view, proj: cam.proj, vp: cam.vp, eye: cam.eye, fov: cam.fov, near: cam.near, far: cam.far, fogN: 7, fogF: 17, vig: 1, fade: G.mode === 'title' ? 0.35 : 0, flash: 0 });
    WK.R.render(f, canvas.width, canvas.height);
    // pencil overlay
    const S = G.S;
    const ink = {};
    document.body.classList.toggle('inplay', G.mode === 'explore' && !G.paused);
    if (G.mode === 'title') { titleP = Math.min(1, titleP + dt * 0.5); ink.title = { p: titleP }; }
    else titleP = 0;
    if (G.mode === 'explore' && !G.paused && !WK.UI.top()) {
      ink.reticle = { alpha: 0.55, lead: G.canTell() && G.gaze && G.gaze.obj && !G.gaze.obj.def.room, hold: G.holdProgress() };
      ink.tokens = { total: G.C.questions.length, solved: G.C.questions.map(q => !!S.solved[q.id]), pulse: G.holdProgress() > 0 ? 1 : 0 };
    }
    if (G.mode !== 'title' && WK.UI.settings.hand !== false) ink.hand = { x: G.hand.x, y: G.hand.y, pose: G.hand.pose, alpha: G.hand.alpha };
    WK.Ink.frame(dt, ink);
    WK.Audio.update(dt, G.soundState());
    WK.Audio.bgmUpdate(dt);
    if (G.mode === 'explore' && !sndHintShown && !WK.Audio.running() && S && S.t > 1.5) {
      sndHintShown = true;
      G.hint('Sound is off until you click or press a key once (browsers need a keyboard or mouse press to start audio).', 7);
    }
  }
  requestAnimationFrame(frame);
})();
