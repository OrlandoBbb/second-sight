'use strict';
// 2D pencil overlay: the sketching hand, the reticle and hold ring, guess tokens, and title lettering.
// Everything here is re-drawn with a little jitter ~11 times a second so it "boils" like pencil animation.
(function () {
  const U = WK.U;
  const Ink = WK.Ink = {};
  let cv, ctx, off, octx, W = 0, H = 0, dpr = 1;
  let boilT = 0, boilSeed = 1;
  const INK = 'rgba(38,40,46,';

  Ink.init = canvas => {
    cv = canvas; ctx = cv.getContext('2d');
    off = document.createElement('canvas'); octx = off.getContext('2d');
    Ink.resize();
  };
  Ink.resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const s = Math.round(Math.min(W, H) * 0.62 * dpr);
    off.width = s; off.height = s;
  };

  // jitter helpers (stable within a boil frame)
  const jit = (i, k, amp) => [(U.hash(i * 7.1 + k * 13.3 + boilSeed) - 0.5) * 2 * amp, (U.hash(i * 3.7 + k * 5.9 + boilSeed * 1.7) - 0.5) * 2 * amp];
  function spline(ctrl, n) {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }
  function pencil(c, pts, o) {
    const passes = o.passes || 2;
    for (let k = 0; k < passes; k++) {
      c.beginPath();
      pts.forEach((p, i) => { const j = jit(i + (o.seed || 0), k, o.jit || 0.8); const x = p[0] + j[0], y = p[1] + j[1]; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.strokeStyle = INK + ((o.alpha || 0.85) * (k ? 0.5 : 1)) + ')';
      c.lineWidth = (o.w || 1.5) * (k ? 0.65 : 1);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.stroke();
    }
  }
  Ink.pencil = pencil;
  Ink.spline = spline;

  // ---------- the hand ----------
  // Screen-space hand units: pencil tip (or push contact) at the origin, ~1 unit = the hand's length.
  // Right hand holding the pencil (tip at origin), drawn like a quick life study: a filled silhouette,
  // an outline made of separate loose strokes, and a few interior lines.
  const PENCIL_HAND = [[0.12, -0.25], [0.2, -0.36], [0.27, -0.46], [0.42, -0.59], [0.6, -0.63], [0.77, -0.57], [0.9, -0.45], [0.97, -0.3],
    [1.25, -0.1], [1.6, 0.14], [1.66, 0.3], [1.4, 0.45], [1.15, 0.27], [1.04, 0.15], [0.9, 0.12], [0.78, 0.1], [0.7, 0.03], [0.56, -0.08], [0.4, -0.1], [0.24, -0.12], [0.18, -0.17]];
  const PENCIL_OUTLINE = [
    [[0.19, -0.18], [0.12, -0.25], [0.2, -0.36], [0.27, -0.46], [0.42, -0.59], [0.6, -0.64]],
    [[0.56, -0.63], [0.77, -0.57], [0.9, -0.45], [0.97, -0.3], [1.0, -0.2]],
    [[0.96, -0.24], [1.25, -0.1], [1.55, 0.12]],
    [[1.36, 0.43], [1.15, 0.27], [1.04, 0.15], [0.9, 0.12], [0.78, 0.1], [0.7, 0.03]],
    [[0.72, 0.05], [0.56, -0.08], [0.4, -0.1], [0.24, -0.12], [0.18, -0.17]],
  ];
  const PENCIL_DETAIL = [
    [[0.21, -0.2], [0.38, -0.26], [0.55, -0.31], [0.66, -0.26], [0.72, -0.14]],
    [[0.19, -0.23], [0.3, -0.33], [0.42, -0.42]],
    [[0.41, -0.55], [0.46, -0.52]], [[0.58, -0.59], [0.63, -0.56]],
    [[0.79, 0.1], [0.81, 0.0]], [[0.91, 0.12], [0.93, 0.02]],
    [[1.18, -0.07], [1.15, 0.1], [1.17, 0.29]],
    [[1.27, -0.02], [1.24, 0.15], [1.26, 0.35]],
  ];
  const PUSH_FINGERS = [[-0.29, 0.62, -0.31, 0.05, 0.075], [-0.1, 0.6, -0.1, -0.03, 0.078], [0.1, 0.6, 0.11, 0.0, 0.075], [0.28, 0.64, 0.31, 0.16, 0.066]];
  const PUSH_PALM = [[-0.37, 0.42], [-0.38, 0.8], [-0.24, 1.1], [0.22, 1.1], [0.37, 0.84], [0.39, 0.46], [0.0, 0.4]];
  function polyPath(c, pts) { const sp = spline(pts.concat([pts[0], pts[1]]), 5).slice(0, -5); c.beginPath(); sp.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
  function capsulePath(c, p, q, r) {
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    c.moveTo(q[0] + Math.cos(ang - Math.PI / 2) * r, q[1] + Math.sin(ang - Math.PI / 2) * r);
    c.arc(q[0], q[1], r, ang - Math.PI / 2, ang + Math.PI / 2, false);
    c.arc(p[0], p[1], r, ang + Math.PI / 2, ang + Math.PI * 1.5, false);
    c.closePath();
  }
  function drawPencil(c, eraserDown, lw) {
    const A = [0.482, -0.876], N = [0.876, 0.482], w = 0.036;
    const P = (u, v) => [A[0] * u + N[0] * v, A[1] * u + N[1] * v];
    const quads = eraserDown ? [
      ['rgba(214,196,190,1)', [P(0.0, -w * 0.85), P(0.02, 0), P(0.0, w * 0.85), P(0.1, w), P(0.1, -w)]],
      ['rgba(196,194,186,1)', [P(0.1, -w), P(0.2, -w), P(0.2, w), P(0.1, w)]],
      ['rgba(238,234,226,1)', [P(0.2, -w), P(1.05, -w), P(1.05, w), P(0.2, w)]],
      ['rgba(240,230,208,1)', [P(1.05, -w), P(1.2, -w * 0.3), P(1.2, w * 0.3), P(1.05, w)]],
      ['rgba(70,72,80,0.9)', [P(1.2, -w * 0.3), P(1.26, 0), P(1.2, w * 0.3)]],
    ] : [
      ['rgba(70,72,80,0.9)', [P(0, 0), P(0.055, -w * 0.3), P(0.055, w * 0.3)]],
      ['rgba(240,230,208,1)', [P(0.055, -w * 0.3), P(0.19, -w), P(0.19, w), P(0.055, w * 0.3)]],
      ['rgba(238,234,226,1)', [P(0.19, -w), P(1.06, -w), P(1.06, w), P(0.19, w)]],
      ['rgba(196,194,186,1)', [P(1.06, -w), P(1.15, -w), P(1.15, w), P(1.06, w)]],
      ['rgba(214,196,190,1)', [P(1.15, -w), P(1.22, -w * 0.9), P(1.24, 0), P(1.22, w * 0.9), P(1.15, w)]],
    ];
    for (const [fill, pts] of quads) {
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
      c.fillStyle = fill; c.fill(); c.strokeStyle = INK + '0.8)'; c.lineWidth = lw; c.stroke();
    }
    // a hexagon edge line along the body
    c.beginPath(); const a = P(0.2, w * 0.25), b = P(1.05, w * 0.25); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.strokeStyle = INK + '0.3)'; c.lineWidth = lw * 0.7; c.stroke();
  }

  // draw the hand into the offscreen canvas; returns the origin (pencil tip) in offscreen pixels
  function drawHand(pose, scale) {
    const c = octx, S = off.width;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, S, S);
    const push = pose === 'push';
    const ox = push ? S * 0.5 : S * 0.2, oy = push ? S * 0.3 : S * 0.62;
    c.setTransform(scale, 0, 0, scale, ox, oy);
    const lw = 1.5 * dpr / scale;
    const j = (k, a) => (U.hash(boilSeed * 3.1 + k) - 0.5) * a;
    if (!push) drawPencil(c, pose === 'eraser', lw);
    const path = () => {
      if (!push) { polyPath(c, PENCIL_HAND.map((p, i) => [p[0] + j(i, 0.012), p[1] + j(i + 40, 0.012)])); return; }
      c.beginPath();
      for (const f of PUSH_FINGERS) capsulePath(c, [f[0], f[1]], [f[2] + j(f[0] * 10, 0.02), f[3] + j(f[1] * 10, 0.02)], f[4]);
      capsulePath(c, [-0.34, 0.8], [-0.62, 0.42 + j(3, 0.03)], 0.085);
      const pp = spline(PUSH_PALM.concat([PUSH_PALM[0], PUSH_PALM[1]]), 5).slice(0, -5); c.moveTo(pp[0][0], pp[0][1]); for (const p of pp) c.lineTo(p[0], p[1]); c.closePath();
    };
    // silhouette: for the open hand a thick outline then a paper fill leaves only the outer contour;
    // the pencil hand gets a soft fill and loose separate strokes (drawn after the shading)
    if (push) {
      path(); c.strokeStyle = INK + '0.85)'; c.lineWidth = lw * 2.3; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = 'rgba(247,243,234,1)';
      for (const f of PUSH_FINGERS) { c.beginPath(); capsulePath(c, [f[0], f[1]], [f[2] + j(f[0] * 10, 0.02), f[3] + j(f[1] * 10, 0.02)], f[4]); c.fill(); }
      c.beginPath(); capsulePath(c, [-0.34, 0.8], [-0.62, 0.42 + j(3, 0.03)], 0.085); c.fill();
      const pp = spline(PUSH_PALM.concat([PUSH_PALM[0], PUSH_PALM[1]]), 5).slice(0, -5); c.beginPath(); c.moveTo(pp[0][0], pp[0][1]); for (const p of pp) c.lineTo(p[0], p[1]); c.closePath(); c.fill();
    } else { path(); c.fillStyle = 'rgba(247,243,234,0.96)'; c.fill(); }
    // graphite shading
    c.save(); path(); c.clip();
    c.strokeStyle = INK + '0.22)'; c.lineWidth = lw * 0.8;
    const sh = push ? [[0.2, 0.55], [0.45, 1.0]] : [[0.3, -0.12], [1.05, 0.25]];
    for (let i = 0; i < 26; i++) {
      const t = i / 25, x = sh[0][0] + (sh[1][0] - sh[0][0]) * t, y = sh[0][1] + (sh[1][1] - sh[0][1]) * t;
      c.beginPath(); c.moveTo(x - 0.06, y + 0.12); c.lineTo(x + 0.08, y - 0.1); c.stroke();
    }
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!push) PENCIL_OUTLINE.forEach((d, i) => {
      const pts = spline(d, 6).map(p => [ox + (p[0] + j(i * 7, 0.01)) * scale, oy + (p[1] + j(i * 9, 0.01)) * scale]);
      pencil(c, pts, { w: 1.9 * dpr, alpha: i === 2 || i === 3 ? 0.62 : 0.85, jit: 0.7 * dpr, passes: 2, seed: i * 13 });
    });
    const det = push ? [[[-0.2, 0.52], [0.0, 0.49], [0.2, 0.54]], [[-0.3, 0.98], [-0.26, 1.3]], [[0.3, 0.98], [0.27, 1.3]], [[-0.1, 0.08], [-0.1, 0.12]]] : PENCIL_DETAIL;
    det.forEach((d, i) => {
      const pts = spline(d, 5).map(p => [ox + p[0] * scale, oy + p[1] * scale]);
      pencil(c, pts, { w: 1.1 * dpr, alpha: 0.5, jit: 0.6 * dpr, passes: 1, seed: i * 11 });
    });
    return [ox, oy];
  }
  Ink.debugHand = (pose, x, y, sc) => { const scale = Math.min(W, H) * 0.24 * dpr * (sc || 1); const [ox, oy] = drawHand(pose, scale); ctx.drawImage(off, x * dpr - ox, y * dpr - oy); };

  // ---------- public draw ----------
  Ink.frame = (dt, st) => {
    boilT -= dt;
    if (boilT <= 0) { boilT = 1 / 11; boilSeed = (boilSeed * 1.37 + 0.71) % 97; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (st.title) drawTitle(st.title);
    if (st.reticle) drawReticle(st.reticle);
    if (st.tokens) drawTokens(st.tokens);
    if (st.hand && st.hand.alpha > 0.01) {
      const h = st.hand;
      const scale = Math.min(W, H) * 0.2 * dpr * (h.scale || 1);
      const [ox, oy] = drawHand(h.pose, scale);
      ctx.globalAlpha = h.alpha * 0.92;
      ctx.drawImage(off, h.x * dpr - ox, h.y * dpr - oy);
      ctx.globalAlpha = 1;
    }
  };

  function drawReticle(r) {
    const cx = W / 2 * dpr, cy = H / 2 * dpr;
    const a = r.alpha === undefined ? 0.55 : r.alpha;
    const circ = (rad, n, seed, o) => {
      const pts = [];
      const turns = o.turns || 1.08;
      for (let i = 0; i <= n; i++) { const t = i / n * turns, ang = t * Math.PI * 2 - Math.PI / 2 + (o.a0 || 0); pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]); }
      pencil(ctx, pts, { w: o.w || 1.3 * dpr, alpha: o.alpha || a, jit: 0.6 * dpr, passes: 2, seed });
    };
    circ(3.2 * dpr, 10, 1, { w: 1.4 * dpr, alpha: a * 0.9 });
    if (r.lead) circ(12 * dpr, 22, 3, { alpha: a * 0.8, turns: 1.02 });
    if (r.hold > 0) {
      const rad = 26 * dpr;
      circ(rad, Math.max(3, Math.round(40 * r.hold)), 5, { turns: r.hold * 1.05, w: 2.4 * dpr, alpha: 0.95 });
      if (r.hold > 0.04) circ(rad + 3 * dpr, Math.max(3, Math.round(40 * r.hold)), 9, { turns: r.hold * 0.98, w: 1.1 * dpr, alpha: 0.5, a0: 0.2 });
    }
  }

  function drawTokens(t) {
    const x0 = 34 * dpr, y0 = 38 * dpr, gap = 44 * dpr, rr = 13 * dpr;
    for (let i = 0; i < t.total; i++) {
      const cx = x0 + i * gap, cy = y0;
      // one eye per question: open and dark once it's answered
      const done = t.solved ? !!t.solved[i] : false, used = t.solved ? !done : i < t.used;
      const pulse = t.pulse > 0 && !done ? 1 + 0.12 * Math.sin(performance.now() / 90) * t.pulse : 1;
      const pts = [];
      for (let k = 0; k <= 20; k++) { const ang = k / 20 * Math.PI * 2.1; pts.push([cx + Math.cos(ang) * rr * pulse, cy + Math.sin(ang) * rr * pulse]); }
      pencil(ctx, pts, { w: 1.5 * dpr, alpha: used ? 0.35 : 0.8, jit: 0.5 * dpr, seed: i * 5 });
      // a tiny eye doodle inside: one try at naming the place
      const ea = used ? 0.3 : 0.75, top = [], bot = [], iris = [];
      for (let k = 0; k <= 8; k++) { const u = k / 8, x = cx + (u - 0.5) * 15 * dpr, h = Math.sin(u * Math.PI) * 4.6 * dpr; top.push([x, cy - h]); bot.push([x, cy + h]); }
      for (let k = 0; k <= 10; k++) { const ang = k / 10 * Math.PI * 2; iris.push([cx + Math.cos(ang) * 2.4 * dpr, cy + Math.sin(ang) * 2.4 * dpr]); }
      pencil(ctx, top, { w: 1.2 * dpr, alpha: ea, jit: 0.3 * dpr, passes: 1, seed: i * 7 });
      pencil(ctx, bot, { w: 1.2 * dpr, alpha: ea, jit: 0.3 * dpr, passes: 1, seed: i * 9 });
      pencil(ctx, iris, { w: (done ? 3 : 1.6) * dpr, alpha: done ? 0.9 : ea, jit: 0.2 * dpr, passes: 1, seed: i * 3 });
      if (used && !t.solved) {
        const k = t.crossT && t.crossT[i] !== undefined ? U.sat(t.crossT[i]) : 1;
        const a1 = [cx - rr * 1.1, cy - rr * 1.1], b1 = [cx + rr * 1.1, cy + rr * 1.1];
        pencil(ctx, [a1, [a1[0] + (b1[0] - a1[0]) * Math.min(1, k * 2), a1[1] + (b1[1] - a1[1]) * Math.min(1, k * 2)]], { w: 2 * dpr, alpha: 0.85, jit: 0.4 * dpr, seed: i * 17 });
        if (k > 0.5) {
          const a2 = [cx + rr * 1.1, cy - rr * 1.1], b2 = [cx - rr * 1.1, cy + rr * 1.1], kk = (k - 0.5) * 2;
          pencil(ctx, [a2, [a2[0] + (b2[0] - a2[0]) * kk, a2[1] + (b2[1] - a2[1]) * kk]], { w: 2 * dpr, alpha: 0.85, jit: 0.4 * dpr, seed: i * 19 });
        }
      }
    }
  }

  // Title lettering is HTML; the ink canvas adds a scribbled underline and an eye doodle drawn in over time.
  function drawTitle(t) {
    const p = U.sat(t.p);
    const el = document.getElementById('title-h');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = (r.bottom + 6) * dpr, x0 = r.left * dpr, x1 = r.right * dpr;
    const pts = [];
    const n = 30;
    for (let i = 0; i <= n * Math.min(1, p * 1.6); i++) { const u = i / n; pts.push([x0 + (x1 - x0) * u, y + Math.sin(u * 7 + 1) * 2 * dpr]); }
    if (pts.length > 1) pencil(ctx, pts, { w: 2.2 * dpr, alpha: 0.75, jit: 0.8 * dpr });
    // an eye doodle to the right of the title, drawn in over time
    const ex = x1 + 40 * dpr, ey = (r.top + r.height * 0.55) * dpr, s = r.height * 0.28 * dpr;
    const q = U.sat((p - 0.3) / 0.7);
    if (q > 0) {
      const lid = sign => { const pts = []; for (let k = 0; k <= 16 * Math.min(1, q * 2); k++) { const u = k / 16; pts.push([ex + (u - 0.5) * s * 2.6, ey + sign * Math.sin(u * Math.PI) * s * 0.7]); } return pts; };
      const t1 = lid(-1); if (t1.length > 1) pencil(ctx, t1, { w: 2 * dpr, alpha: 0.8, jit: 0.6 * dpr, seed: 3 });
      if (q > 0.35) { const t2 = lid(1); if (t2.length > 1) pencil(ctx, t2, { w: 2 * dpr, alpha: 0.8, jit: 0.6 * dpr, seed: 5 }); }
      if (q > 0.6) {
        const k2 = (q - 0.6) / 0.4, ring = [];
        for (let k = 0; k <= 20 * k2; k++) { const ang = k / 20 * Math.PI * 2.1; ring.push([ex + Math.cos(ang) * s * 0.36, ey + Math.sin(ang) * s * 0.36]); }
        if (ring.length > 1) pencil(ctx, ring, { w: 2.4 * dpr, alpha: 0.85, jit: 0.4 * dpr, seed: 7 });
      }
    }
  }
})();
