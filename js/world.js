'use strict';
// Runtime world: objects with drawing stages, stroke batches drawn by the hand, erasing, moves, doors,
// automatic searches, memory ghosts, marks, particles, gaze picking and collision.
(function () {
  const U = WK.U, V = WK.V, M = WK.M, G = WK.Geo, R = WK.R, H = WK.Home, F = WK.Fig;
  const W = WK.World = {};
  const KEY = V.norm([-0.42, 0.78, 0.46]);
  W.KEY = KEY;
  W.objs = {};
  W.list = [];
  W.marks = [];
  W.particles = [];
  W.time = 0;
  W.speed = 1;   // drawing speed multiplier (tests)

  // 0 not yet mentioned (blank page), 1 one loose blob, 2 a cluster of blobs, 3 rough masses, 4 finished
  const LOOK = {
    0: { m0: 0, m1: 0, m2: 0, reveal: 0, conf: 0.1, ink: 0, detail: 0, wob: 0 },
    1: { m0: 0, m1: 0, m2: 0, reveal: 0.22, conf: 0.1, ink: 0.3, detail: 0, wob: 0.014 },
    2: { m0: 1, m1: 0, m2: 0, reveal: 0.38, conf: 0.28, ink: 0.44, detail: 0, wob: 0.01 },
    3: { m0: 1, m1: 1, m2: 0, reveal: 0.64, conf: 0.58, ink: 0.64, detail: 0, wob: 0 },
    4: { m0: 1, m1: 1, m2: 1, reveal: 1, conf: 1, ink: 0.92, detail: 1, wob: 0 },
  };
  const LOOK_ROOM = {
    0: { m0: 0, m1: 0, m2: 0, reveal: 0, conf: 0.12, ink: 0, detail: 0, wob: 0 },
    1: { m0: 0, m1: 0, m2: 0, reveal: 0.12, conf: 0.2, ink: 0.36, detail: 0, wob: 0 },
    2: { m0: 1, m1: 0, m2: 0, reveal: 0.35, conf: 0.4, ink: 0.52, detail: 0, wob: 0 },
    3: { m0: 1, m1: 1, m2: 0, reveal: 0.65, conf: 0.65, ink: 0.7, detail: 0, wob: 0 },
    4: { m0: 1, m1: 1, m2: 1, reveal: 1, conf: 1, ink: 0.9, detail: 1, wob: 0 },
  };
  W.LOOK = LOOK;

  let idCounter = 1;
  function makeObj(def) {
    const built = G.buildObject(def);
    const o = {
      id: def.id, def, idn: idCounter++, mesh: built.verts ? R.uploadMesh(built) : null,
      stage: 0, cur: Object.assign({}, def.room ? LOOK_ROOM[0] : LOOK[0]), from: null, stageT: 1,
      pose: Object.assign({ x: 0, y: 0, z: 0, yaw: 0 }, def.pose), model: null, groups: new Float32Array(R.IDENT16),
      batches: [], att: 0, hidden: !!def.hidden, erase: 0, colorAmt: 0, ghost: null, colOff: false,
      doorAng: 0, doorTarget: 0, lift: {}, garOff: {}, pat: 0, drawing: false, auto: 0, lastDrawT: -9,
      picks: {}, circle: null,
    };
    o.model = W.poseModel(o);
    return o;
  }
  W.poseModel = o => {
    const d = o.def;
    if (d.attach) {
      const par = W.objs[d.attach];
      const lp = d.localPos || [0, 0, 0, 0];
      return M.mul(par.model, M.pose(lp[0], lp[1], lp[2], lp[3]));
    }
    return M.pose(o.pose.x, o.pose.y, o.pose.z, o.pose.yaw);
  };

  W.dispose = () => {
    for (const o of W.list) { if (o.mesh) R.free(o.mesh); for (const b of o.batches) R.free(b.vao); }
    for (const m of W.marks) R.free(m.vao);
  };
  W.init = () => {
    W.dispose();
    W.objs = {}; W.list = []; W.marks = []; W.particles = []; idCounter = 1; W.freeze = false;
    for (const def of H.all) { const o = makeObj(def); W.objs[o.id] = o; W.list.push(o); }
    // figures: two ghosts of "me", the live dog and a ghost dog
    for (const id of ['ghostA', 'ghostB']) { const def = F.personDef(id); def.ghost = true; if (id === 'ghostA') def.parts.forEach(p => { p.tone = Math.min(0.45, (p.tone || 0) + 0.15); }); const o = makeObj(def); o.hidden = true; o.fig = F.basePose(); W.objs[id] = o; W.list.push(o); }
    for (const o of W.list) o.model = W.poseModel(o);
    // the page starts blank: nothing is drawn until it is mentioned
  };

  function lightLocal(o) {
    const yaw = o.def.attach ? 0 : (o.pose.yaw || 0);
    const c = Math.cos(-yaw), s = Math.sin(-yaw);
    return [c * KEY[0] + s * KEY[2], KEY[1], -s * KEY[0] + c * KEY[2]];
  }

  // Build a stroke batch for a stage. Returns batch.
  W.addBatch = (o, stage, opts) => {
    opts = opts || {};
    const def = o.def;
    let strokes;
    if (stage <= 0) return null;
    if (def.room && stage === 1) strokes = def.surf ? surfGesture(def, U.rng(o.idn * 31 + 7)) : roomGesture(def, U.rng(o.idn * 31 + 7));
    else strokes = G.makeStrokes(def, stage, o.idn * 97 + stage * 13 + (opts.seed || 0), lightLocal(o));
    if (!strokes.length) return null;
    const bb = def.bounds, diag = bb ? V.len(V.sub(bb.hi, bb.lo)) : 1;
    const sizeScale = def.room ? 3.2 : U.clamp(diag / 1.6, 0.35, 1.15);
    const dur = G.orderAndTime(strokes, stage, { durScale: sizeScale * (opts.durScale || 1.35), speed: (opts.speed || 1) * 0.8 });
    const style = G.STYLE[Math.max(0, Math.min(3, stage - 1))];
    const packed = G.packStrokes(strokes, { w: style.w * (def.room ? 0.9 : 1), dark: style.dark * (def.ghost ? 0.75 : 1) });
    const b = { obj: o, stage, strokes, vao: R.uploadStrokes(packed), dur, clock: -(opts.delay !== undefined ? opts.delay : 0.45), erase: 0, eraseT: -1, model: null, wobble: stage <= 2 ? 0.02 : stage === 3 ? 0.008 : 0, boil: stage <= 3, alpha: 1 };
    o.batches.push(b);
    return b;
  };

  // A floor or ceiling: its outline, loose, and (floors) a few board lines, never all of them
  function surfGesture(def, rnd) {
    const out = [];
    for (const p of def.parts) {
      const h = V.mul(p.s, 0.5), y = def.surf === 'floor' ? p.p[1] + h[1] + 0.004 : p.p[1] - h[1] - 0.004;
      const c = [[p.p[0] - h[0], y, p.p[2] - h[2]], [p.p[0] + h[0], y, p.p[2] - h[2]], [p.p[0] + h[0], y, p.p[2] + h[2]], [p.p[0] - h[0], y, p.p[2] + h[2]]];
      for (let i = 0; i < 4; i++) { const pts = G.edgeStroke(c[i], c[(i + 1) % 4], { over: 0.35, bow: 0.05, jit: 0.06 }, rnd); if (pts) out.push({ pts, g: 0, w: 1, d: 0.85 }); }
      if (def.surf !== 'floor') continue;
      const alongX = h[0] > h[2], n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5 + (rnd() - 0.5) * 0.6) / n, a0 = rnd() * 0.3, a1 = 0.55 + rnd() * 0.45;
        const A = alongX ? [p.p[0] - h[0] + a0 * 2 * h[0], y, p.p[2] - h[2] + f * 2 * h[2]] : [p.p[0] - h[0] + f * 2 * h[0], y, p.p[2] - h[2] + a0 * 2 * h[2]];
        const Bp = alongX ? [p.p[0] - h[0] + a1 * 2 * h[0], y, A[2]] : [A[0], y, p.p[2] - h[2] + a1 * 2 * h[2]];
        const pts = G.edgeStroke(A, Bp, { over: 0.1, bow: 0.03, jit: 0.04 }, rnd); if (pts) out.push({ pts, g: 0, w: 0.7, d: 0.5 });
      }
    }
    return out;
  }

  function roomGesture(def, rnd) {
    const out = [];
    const walls = def.parts.filter(p => p.wall && p.s[1] > 1.5);
    const o = G.STYLE[0];
    for (const w of walls) {
      if (rnd() < 0.35) continue;
      const h = V.mul(w.s, 0.5);
      const alongX = w.s[0] > w.s[2];
      const y = w.p[1] - h[1] + 0.01;
      for (const side of [-1, 1]) {
        const a = alongX ? [w.p[0] - h[0], y, w.p[2] + side * h[2]] : [w.p[0] + side * h[0], y, w.p[2] - h[2]];
        const b = alongX ? [w.p[0] + h[0], y, w.p[2] + side * h[2]] : [w.p[0] + side * h[0], y, w.p[2] + h[2]];
        const pts = G.edgeStroke(a, b, { over: 0.3, bow: 0.05, jit: 0.04 }, rnd);
        if (pts) out.push({ pts, g: 0, w: 1, d: 0.9 });
      }
      if (rnd() < 0.5) {
        const c = alongX ? [w.p[0] + (rnd() < 0.5 ? -h[0] : h[0]), 0, w.p[2]] : [w.p[0], 0, w.p[2] + (rnd() < 0.5 ? -h[2] : h[2])];
        const pts = G.edgeStroke([c[0], y, c[2]], [c[0], y + Math.min(2.4, w.s[1]), c[2]], { over: 0.2, bow: 0.04, jit: 0.03 }, rnd);
        if (pts) out.push({ pts, g: 0, w: 0.9, d: 0.8 });
      }
    }
    return out;
  }

  // ---------- stages ----------
  W.look = o => (o.def.room ? LOOK_ROOM : LOOK)[o.stage];
  W.setStage = (o, stage, opts) => {
    opts = opts || {};
    if (stage === o.stage && !opts.force) return;
    const prev = o.stage;
    o.from = Object.assign({}, o.cur);
    o.stage = stage;
    o.stageT = 0;
    o.att = 0;
    // earlier lines fade quietly; only a story change brings out the eraser
    for (const b of o.batches) if (b.eraseT < 0) { b.eraseT = 0; b.quiet = !opts.loud; if (opts.loud) { b.loud = true; W.dust(o, b, 22); } }
    const nb = W.addBatch(o, stage, opts);
    o.cur_batch = nb;
    if (opts.instant && nb) nb.clock = nb.dur;
    o.stageFrom = prev;
    if (W.onStage) W.onStage(o, prev, stage);
    return nb;
  };
  W.activeBatch = o => {
    for (let i = o.batches.length - 1; i >= 0; i--) { const b = o.batches[i]; if (b.eraseT < 0 && b.stage === o.stage) return b; }
    return null;
  };
  W.batchDone = o => { const b = W.activeBatch(o); return !b || b.clock >= b.dur - 1e-3; };
  W.batchProgress = o => { const b = W.activeBatch(o); return b ? U.sat(b.clock / Math.max(0.01, b.dur)) : 1; };
  W.clearBatches = o => { for (const b of o.batches) R.free(b.vao); o.batches = []; };
  W.finishDrawing = o => { for (const b of o.batches) if (b.eraseT < 0) b.clock = b.dur; o.stageT = 1; };

  // Move an object to a new pose: erase it where it was (a ghost stays briefly), redraw it at the new place.
  W.movePose = (o, pose, opts) => {
    opts = opts || {};
    o.ghost = { model: new Float32Array(o.model), cur: Object.assign({}, o.cur), erase: 0, t: 0, groups: new Float32Array(o.groups) };
    for (const b of o.batches) { if (!b.model) b.model = new Float32Array(o.model); if (b.eraseT < 0) { b.eraseT = 0; b.loud = true; } W.dust(o, b, 30); }
    o.pose = Object.assign({}, pose);
    o.model = W.poseModel(o);
    o.colOff = true; // collision re-enabled once the player is clear
    o.cur = Object.assign({}, o.def.room ? LOOK_ROOM[0] : LOOK[0]);
    o.from = Object.assign({}, o.cur);
    o.stageT = 0;
    const st = opts.stage !== undefined ? opts.stage : Math.max(2, o.stage);
    o.stage = st;
    const nb = W.addBatch(o, st, { speed: 1.4 });
    o.cur_batch = nb;
    o.auto = Math.max(o.auto, opts.autoDraw !== false ? 6 : 0);
    if (W.onStage) W.onStage(o, st, st, 'move');
  };

  // ---------- per frame ----------
  W.update = (dt, ctx) => {
    W.time += dt;
    if (!W.freeze) W.boilTime = (W.boilTime || 0) + dt;
    const boilStep = Math.floor((W.boilTime || 0) * 7);
    W.boil = (boilStep % 17) * 0.618;
    for (const o of W.list) {
      if (o.overrideModel) o.model = o.overrideModel;
      else if (o.def.attach || o.def.player) o.model = W.poseModel(o);
      if (o.fadeIn !== undefined) { o.fadeIn += dt / 0.45; o.erase = 1 - U.sat(o.fadeIn); if (o.fadeIn >= 1) { o.fadeIn = undefined; o.erase = 0; } }
      // stage visuals follow the drawing progress
      const look = W.look(o);
      o.stageT = Math.min(1, o.stageT + dt / 1.4);
      const morph = U.easeInOut(o.stageT);
      const from = o.from || look;
      const prog = W.batchProgress(o);
      o.cur.m0 = U.lerp(from.m0 || 0, look.m0, morph);
      o.cur.m1 = U.lerp(from.m1, look.m1, morph);
      o.cur.m2 = U.lerp(from.m2, look.m2, morph);
      o.cur.wob = look.wob;
      const k = U.smooth(0.05, 0.95, prog);
      o.cur.reveal = U.lerp(from.reveal, look.reveal, Math.min(k, morph));
      o.cur.conf = U.lerp(from.conf, look.conf, Math.min(k, morph));
      o.cur.ink = U.lerp(from.ink, look.ink, Math.min(U.smooth(0, 0.6, prog), morph));
      o.cur.detail = U.lerp(from.detail, look.detail, Math.min(k, morph));
      // drawing clocks: only while looked at (or auto-drawing)
      const active = o.drawing || o.auto > 0;
      if (o.auto > 0) o.auto -= dt;
      for (const b of o.batches) {
        if (b.eraseT >= 0) {
          b.eraseT += dt;
          if (b.quiet) b.erase = b.eraseT < 1.6 ? U.smooth(0, 1.6, b.eraseT) : 1;
          else b.erase = b.eraseT < 0.7 ? U.easeOut(b.eraseT / 0.7) * 0.86 : b.eraseT < 7 ? 0.86 : 0.86 + (b.eraseT - 7) / 4 * 0.14;
          continue;
        }
        if (b.clock < b.dur && (active || b.eager) && (o.stageT > 0.45 || b.eager)) { b.clock = Math.min(b.dur, b.clock + dt * W.speed * (o.drawRate || 1) * (b.rate || 1)); if (b.clock > 0) o.lastDrawT = W.time; }
      }
      o.batches = o.batches.filter(b => { if (b.eraseT >= 11) { R.free(b.vao); return false; } return true; });
      if (o.ghost) {
        o.ghost.t += dt;
        o.ghost.erase = U.sat(o.ghost.t / 1.1);
        if (o.ghost.t > 1.2) o.ghost = null;
      }
      if (o.eraseSurf !== undefined) {
        o.eraseSurf += dt / 1.0;
        o.erase = U.sat(o.eraseSurf);
        if (o.erase >= 1) { o.hidden = true; o.eraseSurf = undefined; o.erase = 0; for (const b of o.batches) { R.free(b.vao); } o.batches = []; }
      }
      animateGroups(o, dt, ctx);
    }
    for (const m of W.marks) {
      if (m.eraseT >= 0) { m.eraseT += dt; m.erase = U.sat(m.eraseT / 1.2); }
      else if (m.clock < m.dur) m.clock = Math.min(m.dur, m.clock + dt * (m.rate || 1));
      if (m.life !== undefined) { m.life -= dt; if (m.life <= 0 && m.eraseT < 0) m.eraseT = 0; }
    }
    W.marks = W.marks.filter(m => { if (m.eraseT >= 1.3) { R.free(m.vao); return false; } return true; });
    // particles
    if (W.freeze) return;
    for (const p of W.particles) { p.v[1] -= p.g * dt; p.p = V.madd(p.p, p.v, dt); p.life -= dt; if (p.p[1] < p.floor) { p.p[1] = p.floor; p.v = [p.v[0] * 0.3, 0, p.v[2] * 0.3]; } }
    W.particles = W.particles.filter(p => p.life > 0);
    rain(dt);
  };

  // ---------- groups: doors, garments, cushions, figures ----------
  function hingeMat(h, ang) { return M.mul(M.trans(h[0], h[1], h[2]), M.mul(M.rotY(ang), M.trans(-h[0], -h[1], -h[2]))); }
  function setGroup(o, g, m) { o.groups.set(m, g * 16); }
  function animateGroups(o, dt, ctx) {
    const d = o.def;
    if (d.door) {
      o.doorAng = U.approach(o.doorAng, o.doorTarget, 5.5, dt);
      setGroup(o, d.door.g, hingeMat(d.door.hinge, o.doorAng));
    }
    if (d.garments) {
      for (const gm of d.garments) {
        const off = o.garOff[gm.g] || (o.garOff[gm.g] = { x: 0, v: 0, target: 0 });
        const acc = (off.target - off.x) * 60 - off.v * 11;
        off.v += acc * dt; off.x += off.v * dt;
        const swing = U.clamp(off.v * 0.35, -0.25, 0.25);
        const m = M.mul(M.trans(0, 0, off.x), M.mul(M.trans(-0.05, 1.72, gm.z), M.mul(M.rotZ(0), M.mul(M.rotX(swing), M.trans(0.05, -1.72, -gm.z)))));
        setGroup(o, gm.g, m);
      }
    }
    if (o.openLift !== undefined) {
      o.openK = U.approach(o.openK || 0, o.openLift, 4, dt);
      const k = o.openK, g = o.openGroup || 1;
      if (o.id === 'piano') setGroup(o, g, M.mul(M.trans(0, 1.33, -0.32), M.mul(M.rotX(-1.2 * k), M.trans(0, -1.33, 0.32))));
      else if (o.id === 'toilet') setGroup(o, g, M.mul(M.trans(0.05 * k, 0.28 * k, 0.08 * k), M.rotZ(0.25 * k)));
      else setGroup(o, g, M.mul(M.trans(0, 0.16 * k, 0), M.rotX(0.5 * k)));
    }
    if (o.staticGroups) for (const g in o.staticGroups) setGroup(o, +g, o.staticGroups[g]);
    const sd = d.search;
    if (sd && sd.g && (o.searchK || o.searchTarget)) {
      o.searchK = U.approach(o.searchK || 0, o.searchTarget || 0, 3.2, dt);
      const k = U.easeInOut(o.searchK);
      let m = M.trans((sd.trans || [0, 0, 0])[0] * k, (sd.trans || [0, 0, 0])[1] * k, (sd.trans || [0, 0, 0])[2] * k);
      if (sd.rot) { const pv = sd.pivot || [0, 0, 0]; m = M.mul(m, M.mul(M.trans(pv[0], pv[1], pv[2]), M.mul(M.rotY(sd.rot[1] * k), M.mul(M.rotX(sd.rot[0] * k), M.trans(-pv[0], -pv[1], -pv[2]))))); }
      setGroup(o, sd.g, m);
    }
    if (o.hideGroups) for (const g of o.hideGroups) setGroup(o, g, M.scale(0, 0, 0));
    if (o.id === 'jacket' || o.id === 'closet') {
      const g = o.id === 'jacket' ? 1 : 5;
      if (o.pat > 0) {
        o.pat = Math.max(0, o.pat - dt);
        const k = Math.sin(o.pat * 18) * 0.012 * Math.min(1, o.pat);
        if (o.id === 'jacket') setGroup(o, g, M.trans(0, k, 0));
      }
    }
    if (d.figure === 'person' && o.fig) {
      o.hands = F.poseGroups(o.fig, o.groups);
    }
    if (d.figure === 'dog') {
      const q = F.dogPose(o.dogKind || 'lie', W.time, o.wag || 0);
      F.dogGroups(q, o.groups, W.time);
      if (o.wag > 0) o.wag = Math.max(0, o.wag - dt * 0.35);
    }
  }

  // ---------- marks (circles, crosses, prints) ----------
  W.addMark = (kind, p) => {
    const rnd = U.rng(Math.floor(W.time * 1000) + W.marks.length * 7);
    let strokes = [];
    const st = G.STYLE[3];
    if (kind === 'circle') {
      const c = p.c, u = p.u, v = p.v;
      strokes.push({ pts: G.ringStroke(c, u, v, { over: 0.25, wob: 0.06 }, rnd), g: 0, w: 1.6, d: 1.1 });
      strokes.push({ pts: G.ringStroke(c, V.mul(u, 1.06), V.mul(v, 1.06), { over: 0.15, wob: 0.08 }, rnd), g: 0, w: 1.0, d: 0.7 });
    } else if (kind === 'cross') {
      const c = p.c, u = p.u, v = p.v;
      strokes.push({ pts: G.edgeStroke(V.sub(V.sub(c, u), v), V.add(V.add(c, u), v), { over: 0.02, bow: 0.03, jit: 0.005 }, rnd), g: 0, w: 1.9, d: 1.1 });
      strokes.push({ pts: G.edgeStroke(V.add(V.sub(c, u), v), V.sub(V.add(c, u), v), { over: 0.02, bow: 0.03, jit: 0.005 }, rnd), g: 0, w: 1.9, d: 1.1 });
    } else if (kind === 'prints') {
      for (const pr of p.prints) {
        const c = pr.c, yaw = pr.yaw, s = pr.s || 1;
        const fx = [Math.cos(yaw), 0, -Math.sin(yaw)], fz = [Math.sin(yaw), 0, Math.cos(yaw)];
        if (pr.paw) {
          strokes.push({ pts: G.ringStroke(c, V.mul(fx, 0.022 * s), V.mul(fz, 0.02 * s), { over: 0.1, wob: 0.1 }, rnd), g: 0, w: 0.9, d: 0.8 });
          for (const [a, b] of [[-0.022, 0.032], [0, 0.04], [0.022, 0.032]]) strokes.push({ pts: G.ringStroke(V.add(c, V.add(V.mul(fx, a * s), V.mul(fz, b * s))), V.mul(fx, 0.007), V.mul(fz, 0.008), { over: 0.1, wob: 0.1 }, rnd), g: 0, w: 0.8, d: 0.8 });
        } else {
          const d = 0.8 * (pr.d !== undefined ? pr.d : 1);
          strokes.push({ pts: G.ringStroke(V.add(c, V.mul(fz, 0.05)), V.mul(fx, 0.045), V.mul(fz, 0.08), { over: 0.2, wob: 0.14 }, rnd), g: 0, w: 1.0, d });
          strokes.push({ pts: G.ringStroke(V.sub(c, V.mul(fz, 0.09)), V.mul(fx, 0.04), V.mul(fz, 0.045), { over: 0.2, wob: 0.14 }, rnd), g: 0, w: 1.0, d });
        }
      }
    } else if (kind === 'chalk') {
      // a body outline: one loose polyline plus the head
      for (const line of p.lines) strokes.push({ pts: line, g: 0, w: 1, d: 1 });
      if (p.ring) strokes.push({ pts: G.ringStroke(p.ring.c, p.ring.u, p.ring.v, { over: 0.18, wob: 0.1 }, rnd), g: 0, w: 1, d: 1 });
    } else if (kind === 'buzz') {
      const c = p.c, r = p.r || 0.08;
      for (const k of [1, 1.6, 2.2]) {
        const pts = [];
        for (let i = 0; i <= 8; i++) { const a = -0.8 + i / 8 * 1.6; pts.push(V.add(c, V.add(V.mul(p.u, Math.cos(a) * r * k), V.mul(p.v, Math.sin(a) * r * k)))); }
        strokes.push({ pts, g: 0, w: 1.1, d: 0.9 });
      }
    } else if (kind === 'drips') {
      for (let i = 0; i < 7; i++) {
        const x = p.c[0] + (rnd() - 0.5) * p.w, y = p.c[1] - rnd() * p.h, z = p.c[2];
        strokes.push({ pts: [[x, y, z], [x, y - 0.03, z]], g: 0, w: 1, d: 0.8 });
      }
    }
    strokes = strokes.filter(s => s.pts && s.pts.length > 1);
    if (!strokes.length) return null;
    const dur = G.orderAndTime(strokes, 3, { maxDur: p.dur || 1.2 });
    const packed = G.packStrokes(strokes, { w: st.w * (p.wMul || 1), dark: p.dark || 0.9 });
    const m = { kind, strokes, vao: R.uploadStrokes(packed), dur, clock: p.delay ? -p.delay : 0, erase: 0, eraseT: -1, model: p.model || M.ident(), groups: p.groups || null, rate: p.rate || 1, life: p.life, id: p.id, bias: p.bias, focus: p.focus, inkCol: p.inkCol, wobble: p.wobble || 0 };
    W.marks.push(m);
    return m;
  };
  W.eraseMark = id => { for (const m of W.marks) if (m.id === id && m.eraseT < 0) m.eraseT = 0; };

  // ---------- particles ----------
  W.dust = (o, b, n) => {
    if (!b.strokes || !b.strokes.length) return;
    const model = b.model || o.model;
    for (let i = 0; i < n; i++) {
      const s = b.strokes[Math.floor(Math.random() * b.strokes.length)];
      const p = s.pts[Math.floor(Math.random() * s.pts.length)];
      let wp = M.xp(model, p);
      if (s.g) { const gm = o.groups.subarray(s.g * 16, s.g * 16 + 16); wp = M.xp(model, M.xp(gm, p)); }
      const fl = wp[1] > 2.75 ? 2.8 : 0;
      W.particles.push({ p: wp, v: [(Math.random() - 0.5) * 0.4, Math.random() * 0.35, (Math.random() - 0.5) * 0.4], g: 1.3, life: 1.2 + Math.random() * 1.4, size: 0.005 + Math.random() * 0.006, type: 0, floor: fl });
    }
  };
  const RAIN = () => (H.case && H.case.rain) || [];
  let rainAcc = 0;
  function rain(dt) {
    if (!W.rainOn) return;
    rainAcc += dt * 70;
    while (rainAcc > 1) {
      rainAcc -= 1;
      const RL = RAIN(); if (!RL.length) return;
      const r = RL[Math.floor(Math.random() * RL.length)];
      if (W.objs[r.room] && W.objs[r.room].stage < 1) continue;
      const p = [U.lerp(r.lo[0], r.hi[0], Math.random()), r.hi[1], U.lerp(r.lo[2], r.hi[2], Math.random())];
      W.particles.push({ p, v: [0, -5.5, 0], g: 0, life: (r.hi[1] - r.lo[1]) / 5.5, size: 0.05, type: 1, floor: -9 });
    }
  }
  W.rainOn = true;

  // ---------- picking ----------
  function pickList(o) {
    const st = Math.max(0, Math.min(3, o.stage));
    if (!o.picks[st]) o.picks[st] = G.pickBoxes(o.def, st);
    return o.picks[st];
  }
  W.pickable = o => !o.hidden && !o.def.ghost && !o.def.prop && !o.def.player && !(o.def.attach && o.stage === 0) && o.id !== 'keys';
  W.raycast = (orig, dir, maxT, filter) => {
    let best = null;
    for (const o of W.list) {
      if (!W.pickable(o)) continue;
      if (filter && !filter(o)) continue;
      const boxes = pickList(o);
      for (const pb of boxes) {
        let m = M.mul(o.model, pb.m);
        if (pb.g) m = M.mul(o.model, M.mul(o.groups.subarray(pb.g * 16, pb.g * 16 + 16), pb.m));
        const t = U.rayBox(M.inv(m), pb.h, orig, dir);
        if (t >= 0 && t < maxT && (!best || t < best.t)) best = { o, t, tag: pb.tag, g: pb.g, room: !!o.def.room };
      }
    }
    if (best) best.p = V.madd(orig, dir, best.t);
    return best;
  };

  // ---------- collision ----------
  W.wallBoxes = [];
  W.buildCollision = () => {
    W.wallBoxes = [];
    for (const r of H.rooms) for (const p of r.parts) {
      if (!p.wall || p.nocol) continue;
      const h = V.mul(p.s, 0.5);
      W.wallBoxes.push({ room: r.id, x0: p.p[0] - h[0], x1: p.p[0] + h[0], z0: p.p[2] - h[2], z1: p.p[2] + h[2], y0: p.p[1] - h[1], y1: p.p[1] + h[1], armed: false });
    }
  };
  function footBoxes(o) {
    const out = [];
    if (!o.def.foot || o.hidden) return out;
    const yaw = o.pose.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
    for (const f of o.def.foot) {
      const wx = o.pose.x + c * f[0] + s * f[1], wz = o.pose.z - s * f[0] + c * f[1];
      out.push({ cx: wx, cz: wz, hx: f[2], hz: f[3], yaw, y: o.pose.y });
    }
    return out;
  }
  function doorBox(o) {
    const d = o.def.door;
    if (!d || Math.abs(o.doorAng) < 0.12) return null;
    // slab endpoints in object space, through the hinge transform
    const gm = o.groups.subarray(d.g * 16, d.g * 16 + 16);
    const part = o.def.parts.find(p => (p.g || 0) === d.g && p.t === 'box' && p.s[1] > 1.5);
    if (!part) return null;
    const h = V.mul(part.s, 0.5);
    const long = h[0] > h[2] ? [h[0], 0, 0] : [0, 0, h[2]];
    const a = M.xp(o.model, M.xp(gm, V.sub(part.p, long))), b = M.xp(o.model, M.xp(gm, V.add(part.p, long)));
    return { a, b, r: 0.04 };
  }
  W.overlapsObj = (o, x, z, y, r) => {
    for (const f of footBoxes(o)) {
      if (Math.abs(f.y - (y > 1.4 ? 2.8 : 0)) > 0.5) continue;
      const dx = x - f.cx, dz = z - f.cz, c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
      const lx = c * dx + s * dz, lz = -s * dx + c * dz;
      if (Math.abs(lx) < f.hx + r && Math.abs(lz) < f.hz + r) return true;
    }
    return false;
  };
  W.collide = (pos, r) => {
    const y = pos[1];
    let x = pos[0], z = pos[2];
    for (let it = 0; it < 3; it++) {
      x = U.clamp(x, (W.bounds || [0.25, 0.25, 9.75, 6.75])[0], (W.bounds || [0.25, 0.25, 9.75, 6.75])[2]);
      z = U.clamp(z, (W.bounds || [0.25, 0.25, 9.75, 6.75])[1], (W.bounds || [0.25, 0.25, 9.75, 6.75])[3]);
      for (const b of W.wallBoxes) {
        if (b.y1 < y + 0.35 || b.y0 > y + 1.7) continue;
        const ro = W.objs[b.room];
        if (!ro || ro.stage < 1) { b.armed = false; continue; }
        const cx = U.clamp(x, b.x0, b.x1), cz = U.clamp(z, b.z0, b.z1);
        const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
        if (!b.armed) { if (d2 < r * r) continue; b.armed = true; }
        if (d2 < r * r) {
          if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; x += dx * k; z += dz * k; }
          else { const pens = [x - b.x0, b.x1 - x, z - b.z0, b.z1 - z]; const m = Math.min(...pens); if (m === pens[0]) x = b.x0 - r; else if (m === pens[1]) x = b.x1 + r; else if (m === pens[2]) z = b.z0 - r; else z = b.z1 + r; }
        }
      }
      for (const o of W.list) {
        if (!o.def.foot || o.hidden || o.def.ghost) continue;
        if (o.stage < 1 && !o.def.room && o.id !== 'front_door' && o.id !== 'closet') continue;
        if (!o.colOff && W.overlapsObj(o, x, z, y, 0.02)) o.colOff = true;
        if (o.colOff) { if (W.overlapsObj(o, x, z, y, r)) continue; o.colOff = false; }
        for (const f of footBoxes(o)) {
          if (Math.abs(f.y - (y > 1.4 ? 2.8 : 0)) > 0.5) continue;
          const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
          const dx = x - f.cx, dz = z - f.cz;
          const lx = c * dx + s * dz, lz = -s * dx + c * dz;
          const qx = U.clamp(lx, -f.hx, f.hx), qz = U.clamp(lz, -f.hz, f.hz);
          let ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
          if (d2 < r * r) {
            let nx, nz, pen;
            if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; pen = r - d; }
            else { const px = f.hx - Math.abs(lx), pz = f.hz - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; pen = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; pen = pz + r; } }
            const wx = c * nx - s * nz, wz = s * nx + c * nz;
            x += wx * pen; z += wz * pen;
          }
        }
      }
      for (const o of W.list) {
        const db = doorBox(o);
        if (!db) continue;
        if (Math.abs(db.a[1] - y) > 1.5 && Math.abs(db.a[1] - (y + 1)) > 1.5) continue;
        const ax = db.a[0], az = db.a[2], bx = db.b[0], bz = db.b[2];
        const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez;
        const t = U.sat(((x - ax) * ex + (z - az) * ez) / L2);
        const px = ax + ex * t, pz = az + ez * t, dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz, rr = r + db.r;
        if (d2 < rr * rr && d2 > 1e-9) { const d = Math.sqrt(d2), k = (rr - d) / d; x += dx * k; z += dz * k; }
      }
    }
    if (H.walkable && !H.walkable(x, z) && W.prevPos) {
      if (H.walkable(x, W.prevPos[2])) z = W.prevPos[2];
      else if (H.walkable(W.prevPos[0], z)) x = W.prevPos[0];
      else { x = W.prevPos[0]; z = W.prevPos[2]; }
    }
    return [x, pos[1], z];
  };

  // ---------- frame assembly ----------
  W.frame = cam => {
    const objects = [], batches = [];
    const shadows = new Float32Array(96);
    let ns = 0;
    for (const o of W.list) {
      if (o.hidden) continue;
      if (o.def.player && !o.show) continue;
      const surf = o.stage >= 1 || o.def.ghost || o.def.prop || (o.eraseSurf !== undefined);
      if (surf && o.mesh) {
        objects.push({ mesh: o.mesh, model: o.model, groups: o.groups, m0: o.cur.m0 || 0, m1: o.cur.m1, m2: o.cur.m2, wob: o.cur.wob, reveal: o.cur.reveal * (o.revealMul || 1), conf: o.cur.conf, ink: o.cur.ink * (o.inkMul || 1), erase: o.def.ghost ? Math.max(o.erase, o.ghostVeil !== undefined ? o.ghostVeil : 0.3) : o.erase, tint: o.tint || 0, tintCol: o.tintCol, idn: o.idn, detail: o.cur.detail, colorAmt: o.colorAmt, lit: o.lit || 0, hatchAng: 0.5 + (o.idn % 5) * 0.23, color: o.def.colors && o.def.colors[0], color2: o.def.colors && o.def.colors[1] });
      }
      if (o.ghost) objects.push({ mesh: o.mesh, model: o.ghost.model, groups: o.ghost.groups, m0: o.ghost.cur.m0 || 0, m1: o.ghost.cur.m1, m2: o.ghost.cur.m2, wob: 0, reveal: o.ghost.cur.reveal, conf: o.ghost.cur.conf, ink: o.ghost.cur.ink, erase: o.ghost.erase, idn: o.idn + 200, detail: o.ghost.cur.detail });
      for (const b of o.batches) {
        if (b.clock <= 0 || b.erase >= 0.999) continue;
        const tc = o.tint > 0 ? V.lerp([0.16, 0.165, 0.19], V.mul(o.tintCol || [0.8, 0.18, 0.15], 0.8), o.tint) : null;
        batches.push({ vao: b.vao, model: b.model || o.model, groups: o.groups, clock: b.clock, erase: b.erase, wobble: b.wobble, boil: b.boil ? W.boil : 0, alpha: (o.strokeAlpha !== undefined ? o.strokeAlpha : 1) * (b.alpha || 1) * (b.ambient ? 0.72 : 1), bias: o.def.room ? 0.02 : 0.012, inkCol: tc });
      }
      if (o.def.foot && o.stage >= 1 && !o.def.ghost && ns < 24) {
        for (const f of o.def.foot) {
          if (ns >= 24) break;
          const yaw = o.pose.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
          const wx = o.pose.x + c * f[0] + s * f[1], wz = o.pose.z - s * f[0] + c * f[1];
          const ex = Math.abs(c) * f[2] + Math.abs(s) * f[3], ez = Math.abs(s) * f[2] + Math.abs(c) * f[3];
          const k = o.stage >= 2 ? 1.25 : 1.1;
          shadows[ns * 4] = wx + 0.06; shadows[ns * 4 + 1] = wz + 0.05; shadows[ns * 4 + 2] = ex * k + 0.06; shadows[ns * 4 + 3] = (ez * k + 0.06) * (o.pose.y > 1.4 ? -1 : 1);
          ns++;
        }
      }
    }
    for (const m of W.marks) if (m.clock > 0) batches.push({ vao: m.vao, model: m.model, groups: m.groups, clock: m.clock, erase: m.erase, wobble: m.wobble || 0, boil: m.wobble ? W.boil : 0, alpha: 1, bias: m.bias !== undefined ? m.bias : 0.02, inkCol: m.inkCol });
    const np = W.particles.length;
    const parts = new Float32Array(np * 8);
    W.particles.forEach((p, i) => {
      parts[i * 8] = p.p[0]; parts[i * 8 + 1] = p.p[1]; parts[i * 8 + 2] = p.p[2]; parts[i * 8 + 3] = p.size;
      parts[i * 8 + 4] = p.type ? 1 : Math.min(1, p.life); parts[i * 8 + 5] = p.type; parts[i * 8 + 6] = 0; parts[i * 8 + 7] = 0;
    });
    return Object.assign({ objects, batches, shadows, nShadows: ns, particles: parts, nParticles: np, key: KEY, boil: W.boil }, cam);
  };

  // World position of the active drawing head for an object (or null)
  W.headWorld = o => {
    const b = W.activeBatch(o);
    if (!b || b.clock <= 0 || b.clock >= b.dur) return null;
    const h = G.headAt(b.strokes, b.clock);
    if (!h) return null;
    let p = h.p;
    if (h.g) p = M.xp(o.groups.subarray(h.g * 16, h.g * 16 + 16), p);
    return { p: M.xp(b.model || o.model, p), speed: h.speed, drawing: h.drawing, stroke: h.s, dur: h.dur };
  };
  W.markHead = m => {
    if (m.clock <= 0 || m.clock >= m.dur) return null;
    const h = G.headAt(m.strokes, m.clock);
    return h ? { p: M.xp(m.model, h.p), speed: h.speed, stroke: h.s, dur: h.dur } : null;
  };

  W.center = o => {
    const bb = o.stage >= 3 ? (o.def.fineBounds || o.def.bounds) : o.def.bounds;
    return M.xp(o.model, V.mul(V.add(bb.lo, bb.hi), 0.5));
  };
  W.radius = o => { const bb = o.def.bounds; return V.len(V.sub(bb.hi, bb.lo)) * 0.5; };
})();
