'use strict';
// Director for Second Sight. A case is a flat and a story (js/case*.js). She walks the flat in her mind while two
// detectives talk: the page fills in as she walks and looks, things they mention are drawn as they say them, a tap
// asks about what she points at (and draws it further, then searches it), and holding on something tells them
// "this is the answer". Contradictions are called out in red until they admit it. Three questions; when all three
// are answered she tells the whole story while the night replays.
(function () {
  const U = WK.U, V = WK.V, M = WK.M, W = WK.World, H = WK.Home, F = WK.Fig, I = WK.Input, A = WK.Audio, Vo = WK.Voice, MEM = WK.Mem;
  const Gm = WK.Game = {};
  Gm.mode = 'title';
  Gm.paused = false;
  Gm.events = [];
  Gm.timeScale = 1;
  const log = (type, data) => { Gm.events.push(Object.assign({ type, t: +((Gm.S && Gm.S.t) || 0).toFixed(2) }, data || {})); if (Gm.events.length > 2000) Gm.events.shift(); };
  Gm.log = log;
  let S = null, CS = null;
  const P = Gm.P = { pos: [1.6, 0, 6.3], yaw: Math.PI, pitch: -0.1, vel: [0, 0, 0], bobT: 0, stepAcc: 0, zone: '' };
  Gm.camOverride = null;
  Gm.gaze = null;
  const hold = { active: false, t: 0, objId: null, committed: false };
  Gm.hold = hold;
  const hand = { x: 0, y: 0, alpha: 0, pose: 'pencil', speed: 0 };
  Gm.hand = hand;
  const search = { active: false, p: null, t: 0 };
  Gm.search = search;
  let lastGazeId = null;
  const EYE = 1.62;
  const RED = [0.82, 0.2, 0.16];
  const MEMORY_INK = [0.26, 0.42, 0.78];
  const NAMES = { iris: '', doyle: 'Doyle', ruiz: 'Ruiz' };
  Vo.names = NAMES;
  Vo.lineClass = id => (Gm.S && Gm.S.calloutLive && Gm.S.calloutLines && Gm.S.calloutLines[id] ? 'callout' : '');

  const O = id => W.objs[id];
  Gm.O = O;
  const lookDir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const eyePos = () => [P.pos[0], P.pos[1] + EYE + Math.sin(P.bobT) * 0.018, P.pos[2]];
  const G = () => `<span class="glyph ${I.glyphClass()}">${I.glyph()}</span>`;
  const tapWord = () => (I.device === 'touch' ? 'Tap' : I.device === 'pad' ? 'Point at' : 'Click');

  // ---------- lines ----------
  // a line from a group of wordings, never the same one twice in a row
  function vary(g) {
    const all = MEM.VARIANTS[g] || [g];
    const have = all.filter(id => WK.VOICE_DATA && WK.VOICE_DATA.lines[id]);
    const list = have.length ? have : all;
    let bag = S.bags[g];
    if (!bag || !bag.length) { bag = S.bags[g] = list.slice().sort(() => Math.random() - 0.5); if (bag.length > 1 && bag[0] === S.bags[g + '_last']) bag.push(bag.shift()); }
    const id = bag.shift(); S.bags[g + '_last'] = id;
    return id;
  }
  Gm.vary = g => vary(g);
  function say(id, o) {
    o = o || {};
    const onStart = o.onStart;
    S.played[id] = (S.played[id] || 0) + 1;
    return Vo.play(id, Object.assign({}, o, { onStart: () => {
      S.lastLineT = S.t; log('line', { id });
      drawKeywords(id);
      if (CS.chalk && CS.chalk.lines[id]) setTimeout(drawChalk, 500);
      if (onStart) onStart();
    } }));
  }
  function seq(ids, o) {
    o = o || {};
    ids = ids.filter(Boolean);
    if (!ids.length) { if (o.onEnd) o.onEnd(); return; }
    ids.forEach((id, i) => say(id, Object.assign({ pri: o.pri || 2, gap: i < ids.length - 1 ? 0.3 : 0.45 }, i === ids.length - 1 ? { onEnd: o.onEnd, onCue: o.onCue } : { onCue: o.onCue }, i === 0 && o.onStart ? { onStart: o.onStart } : {})));
  }
  Gm.say = say;

  // A thing named in a line starts drawing when the line starts, and is about 70% drawn when the word is spoken
  function drawKeywords(id) {
    const d = WK.VOICE_DATA && WK.VOICE_DATA.lines[id];
    if (!d || !d.cue) return;
    for (const k in d.cue) {
      if (k[0] !== '@') continue;
      const oid = k.slice(1), o = O(oid);
      if (!o || o.hidden) continue;
      const to = o.def.room ? Math.min(2, o.stage + 1) : o.stage < 2 ? 2 : Math.min(4, o.stage + 1);
      if (to <= o.stage) continue;
      const b = refine(oid, to, { delay: 0 });
      if (!b) continue;
      b.eager = true;
      const tw = Math.max(0.35, d.cue[k] / Math.max(0.2, Vo.rate));
      b.rate = U.clamp(0.7 * b.dur / (tw * W.speed), 0.5, 9);
      log('keyword', { line: id, id: oid, stage: to, t: +tw.toFixed(2) });
    }
  }

  // ---------- screen helpers ----------
  function project(p) {
    const c = Gm.cam; if (!c) return { vis: false };
    const q = M.x4(c.vp, p);
    if (q[3] <= 0.05) return { vis: false };
    const x = (q[0] / q[3] * 0.5 + 0.5) * window.innerWidth, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * window.innerHeight;
    return { vis: x > -80 && x < window.innerWidth + 80 && y > -80 && y < window.innerHeight + 80, x, y, z: q[3] };
  }
  Gm.project = project;
  let memoT = 0;
  function memo(text, kind) {
    if (!text) return;
    const el = document.getElementById('memo');
    el.innerHTML = '<span class="k">' + (kind || 'confirmed') + '</span> ' + text;
    el.classList.toggle('red', kind === 'they admitted');
    el.classList.add('show'); memoT = 6;
  }
  let hintT = 0;
  function hint(html, secs) { const el = document.getElementById('hint'); el.innerHTML = html; el.classList.add('show'); hintT = secs || 6; }
  Gm.hint = hint;
  let ideaT = 0;
  function goodIdea() {
    A.play('ding'); S.ideas++;
    const el = document.getElementById('idea');
    if (el) { el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); ideaT = 1.6; }
    log('idea');
  }
  Gm.goodIdea = goodIdea;

  // ---------- drawing ----------
  function stageNow(id, n) { const o = O(id); if (!o) return; W.setStage(o, n, { instant: true }); o.stageT = 1; o.from = null; o.cur = Object.assign({}, W.look(o)); W.finishDrawing(o); }
  function refine(id, to, opts) {
    const o = O(id); if (!o) return null;
    const n = Math.min(4, to !== undefined ? Math.max(o.stage, to) : o.stage + 1);
    if (n <= o.stage) return null;
    const b = W.setStage(o, n, opts || {});
    o.auto = (b ? b.dur / Math.max(0.3, b.rate || 1) : 1) + 2.5;
    S.lastProgressT = S.t;
    log('stage', { id, stage: n });
    // a thing on the page puts its room's floor on the page
    if (!o.def.room) { const c = W.center(o), f = O(H.zoneAt(c[0], 0, c[2]) + '_f'); if (f && f.stage < 1) refine(f.id, 1); }
    if (o.def.surf === 'floor' && S.printsReady) showPrints(o.def.roomOf);
    return b;
  }
  Gm.refine = refine;

  // ---------- facts, contradictions, visions ----------
  function learn(f, quiet, viaAsk) {
    if (!MEM.addFact(S, f)) return false;
    log('fact', { id: f, ask: !!viaAsk });
    S.lastProgressT = S.t;
    if (viaAsk && MEM.IMPORTANT[f]) goodIdea();
    if (!quiet && MEM.FACTS[f]) memo(MEM.FACTS[f]);
    if (WK.UI) WK.UI.refreshNotes();
    return true;
  }
  Gm.learn = learn;
  function tintOn(id, col) { const o = O(id); if (o) { o.tintCol = col || RED; o.tintTarget = 1; } }
  function tintOff(id, delay) { const o = O(id); if (o) { o.tintTarget = 0; o.tintDelay = delay || 0; } }
  // What was there that night and isn't now, drawn in memory ink for a while
  function showVision(v, secs) {
    if (!v) return;
    secs = secs || 9;
    if (typeof v === 'string') {
      const o = O(v); if (!o) return;
      o.hidden = false; o.eraseSurf = undefined; o.erase = 0;
      W.clearBatches(o); o.stage = 0;
      refine(v, 3, { delay: 0 }); o.drawRate = 1.8;
      o.tintCol = MEMORY_INK; o.tint = 1; o.tintTarget = 1;
      S.visions.push({ o, t: secs, kind: 'obj' });
    } else if (v.open) {
      const o = O(v.open); o.doorTarget = o.def.door.open; o.tintCol = MEMORY_INK; o.tintTarget = 1;
      W.rainOn = true; S.visions.push({ o, t: secs, kind: 'open' });
    } else if (v.ghost) {
      const [x, z, yaw, layers] = v.ghost;
      ghostShow('ghostA', x, 0, z, yaw, layers, { silent: true });
      const g = O('ghostA'); g.tintCol = MEMORY_INK; g.tint = 1; g.tintTarget = 1;
      S.visions.push({ o: g, t: secs, kind: 'ghost' });
    }
    A.play('flash');
    log('vision', { v: typeof v === 'string' ? v : Object.keys(v)[0] });
  }
  function updateVisions(dt) {
    for (const vz of S.visions) {
      vz.t -= dt;
      if (vz.t > 0 || vz.gone) continue;
      vz.gone = true;
      if (vz.kind === 'obj') { vz.o.eraseSurf = 0; for (const b of vz.o.batches) if (b.eraseT < 0) b.eraseT = 0; }
      else if (vz.kind === 'open') { vz.o.doorTarget = 0; vz.o.tintTarget = 0; }
      else if (vz.kind === 'ghost') { vz.o.tintTarget = 0; ghostHide('ghostA'); }
    }
    S.visions = S.visions.filter(v => !v.gone);
  }
  // One exchange: what she sees, what they say, what it proves; a contradiction is red until they admit it
  function exchange(ex, anchor, viaAsk, lead) {
    const lines = (lead ? [lead] : []).concat(MEM.val(S, ex.lines) || []);
    const fact = MEM.val(S, ex.fact), claim = MEM.val(S, ex.claim);
    if (claim) {
      S.calloutLive = true; S.calloutLines = {};
      for (const l of lines) S.calloutLines[l] = 1;
      if (ex.tint) tintOn(ex.tint);
    } else if (ex.tint) { tintOn(ex.tint); tintOff(ex.tint, 5); }
    if (ex.vision) showVision(ex.vision, 4 + lines.length * 3.2);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      if (ex.id) delete S.inflight[ex.id];
      if (anchor && S.pend[anchor.id] === ex.id) S.pend[anchor.id] = false;
      if (fact) learn(fact, false, viaAsk);
      if (claim) contradicted(claim, ex.tint);
    };
    seq(lines, { pri: claim ? 2.5 : 2, onEnd: finish });
  }
  function contradicted(claim, tint) {
    if (S.contradicted[claim]) return;
    S.contradicted[claim] = true; S.calloutLive = false;
    if (tint) tintOff(tint, 0.4);
    if (CS.claims[claim]) memo(CS.claims[claim].text, 'they admitted');
    log('contradiction', { claim });
    if (WK.UI) WK.UI.refreshNotes();
  }
  function fireNotice(n, o, viaAsk, lead) {
    S.fired[n.id] = true; S.inflight[n.id] = true; S.pend[o.id] = n.id;
    log('notice', { id: n.id, obj: o.id, ask: !!viaAsk });
    exchange(n, o, viaAsk, lead);
  }
  // looking alone brings out the small things; discoveries and contradictions need a question
  function progress(o, tag) {
    if (S.pend[o.id] || !S.introDone) return;
    for (const n of MEM.NOTICES) {
      if (n.obj !== o.id || o.stage < n.stage || !MEM.eligible(S, n)) continue;
      if (MEM.IMPORTANT[MEM.val(S, n.fact)] || n.claim || n.vision) continue;
      if (S.eligibleAt[n.id] === undefined) S.eligibleAt[n.id] = o.attTotal;
      if (o.attTotal - S.eligibleAt[n.id] >= 1.1 && W.batchDone(o) && !Vo.busy()) { fireNotice(n, o, false); return; }
      return;
    }
  }

  // ---------- asking: tap / click on anything ----------
  function roomBeyond(eye, dir) {
    const tf = dir[1] < -0.02 ? -eye[1] / dir[1] : 99;
    const hit = W.raycast(eye, dir, Math.min(7, tf), o => o.def.room && !o.def.surf);
    if (!hit) return null;
    const b = V.madd(hit.p, dir, 0.35), z = H.zoneAt(b[0], 0, b[2]);
    if (z === P.zone || !H.walkable(b[0], b[2])) return null;
    const f = O(z + '_f');
    if (f && f.stage >= 1) return null;
    return { o: O(z), d: hit.t };
  }
  function undrawnTarget(eye, dir) {
    let best = null;
    const seen = o => { const c = W.center(o), z = H.zoneAt(c[0], 0, c[2]); return z === P.zone || (O(z + '_f') && O(z + '_f').stage >= 1); };
    const ok = o => o.stage < 1 && !o.hidden && !o.def.room && !o.def.ghost && !o.def.prop && !o.def.item && !o.def.vision && seen(o);
    const hit = W.raycast(eye, dir, 8, ok);
    if (hit) best = { o: hit.o, d: hit.t, direct: true };
    for (const o of W.list) {
      if (!ok(o) || !MEM.ANSWERS[o.id]) continue;
      const c = W.center(o), v = V.sub(c, eye), d = V.len(v);
      if (d > 7.5) continue;
      const ang = Math.acos(U.clamp(V.dot(V.mul(v, 1 / d), dir), -1, 1));
      if (ang < 0.2 && (!best || d < best.d - 0.3)) best = { o, d };
    }
    const rb = roomBeyond(eye, dir);
    if (rb && (!best || rb.d < best.d)) best = Object.assign(rb, { direct: true });
    return best;
  }
  function floorPoint(eye, dir, dh) {
    if (dh && dh.o.def.surf === 'floor') return dh.p;
    if (dir[1] > -0.02) return null;
    const t = -eye[1] / dir[1];
    if (t > 9 || (dh && dh.t < t - 0.05)) return null;
    return V.madd(eye, dir, t);
  }
  function printNear(p) {
    let best = null;
    for (const q of S.trail) { if (!q.shown) continue; const d = Math.hypot(q.c[0] - p[0], q.c[2] - p[2]); if (d < 0.5 && (!best || d < best.d)) best = { q, d }; }
    return best ? best.q : null;
  }
  function ask(dirOverride) {
    if (Gm.mode !== 'explore') return;
    // asking while they're talking just waits for its turn (no scolding)
    const eye = eyePos(), dir = dirOverride || lookDir(P.yaw, P.pitch);
    const dh = W.raycast(eye, dir, 9, o => o.stage >= 1 && !o.def.ghost);
    const ut = undrawnTarget(eye, dir);
    const fp = floorPoint(eye, dir, dh), pr = fp ? printNear(fp) : null;
    S.lastAskT = S.t;
    const thing = dh && !dh.o.def.room ? dh : null;
    if (thing && (!ut || thing.t < ut.d + 0.2)) return askAbout(thing.o, thing);
    if (pr && (!ut || !ut.direct || V.dist(eye, pr.c) < ut.d)) return askPrints(pr);
    if (ut) return askUndrawn(ut.o);
    if (dh && dh.o.def.room) return askSurface(dh.o);
    log('ask', { kind: 'none' });
    if (S.t - (S.lastNoneT || -9) > 3 && Vo.queue.length < 2) { S.lastNoneT = S.t; seq([vary('q_here'), vary('a_none')], { pri: 2 }); }
  }
  Gm.ask = ask;
  const noticeFor = o => MEM.NOTICES.find(q => q.obj === o.id && o.stage >= q.stage && MEM.eligible(S, q));
  // something drawn: each tap draws it a little further; a drawn thing gets searched; a question if there is one
  function askAbout(o, hit) {
    const drawing = o.stage < 4 && W.batchProgress(o) < 0.55;
    const target = o.stage < 3 ? o.stage + 1 : 4;
    if (!drawing && target > o.stage) refine(o.id, target);
    log('ask', { kind: 'about', id: o.id, stage: o.stage });
    const n = noticeFor(o);
    if (n) { fireNotice(n, o, true, vary('q_about')); return; }
    if (o.stage >= 3 && MEM.SEARCHES[o.id] !== undefined && !S.searched[o.id]) return doSearch(o);
    if (o.stage >= 3 && o.def.search && !S.searched[o.id]) return doSearch(o);
    if ((o.def.door && !o.def.search) && hit.t < 2.9 && o.id !== 'window') { toggleDoor(o); return; }
    if (o.stage >= 4 && !drawing && S.t - (S.lastMoreT || -9) > 6 && Vo.queue.length < 2) { S.lastMoreT = S.t; seq([vary('q_about'), vary('a_more')], { pri: 2 }); }
  }
  function askSurface(o) {
    const drawing = o.stage < 4 && W.batchProgress(o) < 0.55;
    if (!drawing) refine(o.id);
    log('ask', { kind: 'surface', id: o.id, stage: o.stage });
    const room = o.def.roomOf ? O(o.def.roomOf) : o;
    const n = noticeFor(room);
    if (n) { fireNotice(n, room, true, vary('q_about')); return; }
    if (S.t - (S.lastNoneT || -9) > 3 && Vo.queue.length < 2) { S.lastNoneT = S.t; seq([vary('q_here'), vary('a_none')], { pri: 2 }); }
  }
  function askUndrawn(t) {
    const isRoom = !!t.def.room;
    const q = isRoom ? vary('q_room') : MEM.MIDDLE[t.id] ? vary('q_middle') : vary('q_here');
    log('ask', { kind: isRoom ? 'room' : 'thing', id: t.id });
    const ans = MEM.ANSWERS[t.id];
    // the answer names it: it draws as they say it (keyword); without a keyword, draw it now
    const hasKey = ans && WK.VOICE_DATA && WK.VOICE_DATA.lines[ans] && Object.keys(WK.VOICE_DATA.lines[ans].cue || {}).some(k => k === '@' + t.id || k === '@' + t.id + '_f');
    if (!hasKey) refine(isRoom ? t.id + '_f' : t.id, isRoom ? 1 : 2, { delay: 0.2 });
    seq([q, ans || vary('a_none')], { pri: 2 });
  }
  function askPrints(q) {
    log('ask', { kind: 'prints', seg: q.seg });
    const sg = CS.trail[q.seg];
    if (!S.prSaid[q.seg]) { S.prSaid[q.seg] = true; seq([sg.line], { pri: 2, onEnd: () => learn(sg.fact, false, true) }); return; }
    if (Vo.queue.length < 2) seq([vary('pr_again')], { pri: 2 });
  }

  // ---------- searching with the hand ----------
  function doSearch(o) {
    S.searched[o.id] = true;
    const sd = o.def.search, res = MEM.SEARCHES[o.id];
    log('search', { id: o.id, found: !!res });
    if (sd && sd.g) { o.searchTarget = 1; A.play('cushion'); }
    search.active = true; search.t = 0; search.obj = o; search.p = M.xp(o.model, (sd && sd.at) || [0, 0.5, 0]);
    setTimeout(() => {
      if (!res) { seq([vary('s_none')], { pri: 2, onEnd: () => { if (sd && sd.g && !sd.keep) o.searchTarget = 0; } }); return; }
      if (res.item) { const it = O(res.item); it.hidden = false; W.clearBatches(it); it.stage = 0; refine(res.item, 4, { delay: 0 }); it.drawRate = 2.2; it.colorAmt = 0; it.colorIn = true; }
      if (res.reveal) { const rv = O(res.reveal); rv.hidden = false; refine(res.reveal, 3, { delay: 0 }); rv.drawRate = 1.6; }
      if (res.vision) showVision(res.vision, 12);
      exchange(res, o, true);
      if (sd && sd.g && !sd.keep) setTimeout(() => { o.searchTarget = 0; }, 7000);
    }, 900);
  }
  function toggleDoor(o) {
    const open = Math.abs(o.doorTarget) < 0.01;
    o.doorTarget = open ? o.def.door.open : 0;
    A.play(open ? 'doorOpen' : 'doorClose');
    log('door', { id: o.id, open });
  }

  // ---------- telling them: hold on something ----------
  function tell(o) {
    hold.committed = true;
    const open = CS.questions.filter(q => !S.solved[q.id]);
    const qs = open.filter(q => q.objs.includes(o.id));
    const c = W.center(o), r = Math.min(0.9, Math.max(0.25, W.radius(o) * 0.7));
    if (Gm.cam) W.addMark('circle', { c, u: V.mul(Gm.cam.right, r * 1.15), v: V.mul(Gm.cam.up, r * 0.8), dur: 1.0, life: 5, bias: 0.3 });
    A.play('circle');
    log('tell', { id: o.id, q: qs.map(q => q.id) });
    if (!qs.length) { seq([vary('tell_no')], { pri: 2.5 }); return; }
    const q = qs.find(x => MEM.ready(S, x)) || qs[0];
    if (!MEM.ready(S, q)) { seq([q.more], { pri: 2.5 }); return; }
    if (q.claim) { S.calloutLive = true; S.calloutLines = {}; for (const l of q.accept) S.calloutLines[l] = 1; if (q.tint) tintOn(q.tint); }
    seq(q.accept, { pri: 3, onEnd: () => {
      S.solved[q.id] = true; S.answered++;
      if (q.claim) contradicted(q.claim, q.tint);
      memo(q.solved, 'answered');
      A.play('found');
      log('solved', { q: q.id });
      if (WK.UI) WK.UI.refreshNotes();
      if (CS.questions.every(x => S.solved[x.id])) setTimeout(startFinale, 1200);
    } });
  }
  Gm.tell = id => tell(O(id));
  Gm.canTell = () => CS && S && CS.questions.some(q => !S.solved[q.id] && MEM.ready(S, q));

  // ---------- the page fills in: floors as you walk, walls and ceilings when you look, and more the longer you stay ----------
  function updateSurfaces(dt) {
    const zf = O(P.zone + '_f');
    if (zf && zf.stage < 1) refine(zf.id, 1);
    if (!S.introDone) return;
    const eye = eyePos(), dir = lookDir(P.yaw, P.pitch);
    if (dir[1] < -0.05) {
      const t = -eye[1] / dir[1];
      if (t < 6.5) {
        const p = V.madd(eye, dir, t);
        if (H.walkable(p[0], p[2]) && !W.raycast(eye, dir, t - 0.1, o => o.stage >= 1 && !o.def.surf && !o.def.room)) {
          const f = O(H.zoneAt(p[0], 0, p[2]) + '_f');
          if (f && f.stage < 1) refine(f.id, 1);
        }
      }
    }
    const wh = W.raycast(eye, dir, 4.8, o => o.def.room && !o.def.surf && o.stage < 1);
    for (const k in S.wallLook) if (!wh || wh.o.id !== k) S.wallLook[k] = Math.max(0, S.wallLook[k] - dt);
    if (wh) { S.wallLook[wh.o.id] = (S.wallLook[wh.o.id] || 0) + dt; if (S.wallLook[wh.o.id] > 0.45) refine(wh.o.id, 1); }
    const zc = O(P.zone + '_c');
    if (P.pitch > 0.3 && zc && zc.stage < 1) { S.ceilLook[P.zone] = (S.ceilLook[P.zone] || 0) + dt; if (S.ceilLook[P.zone] > 0.5) refine(zc.id, 1); }
  }
  // The longer she is in the flat, the more of it quietly draws itself in: lumpy, vague shapes first
  function updateAmbient(dt) {
    if (!S.introDone) return;
    S.ambT -= dt;
    if (S.ambT > 0) return;
    const el = S.t - S.introEndT;
    S.ambT = Math.max(1.6, 5.5 - el * 0.035) * (0.75 + Math.random() * 0.5);
    const eye = eyePos(), fwd = lookDir(P.yaw, 0);
    let best = null;
    for (const o of W.list) {
      if (o.hidden || o.def.ghost || o.def.prop || o.def.item || o.def.vision || o.def.player) continue;
      const room = !!o.def.room;
      const cap = room ? (el > 90 ? 2 : 1) : (el > 150 ? 3 : el > 60 ? 2 : 1);
      if (o.stage >= cap) continue;
      if (o.def.surf === 'ceil' && o.def.roomOf !== P.zone) continue;
      const c = W.center(o), d = Math.hypot(c[0] - eye[0], c[2] - eye[2]);
      if (d > 8) continue;
      const v = V.norm([c[0] - eye[0], 0, c[2] - eye[2]]), facing = V.dot(v, fwd);
      const score = facing * 1.4 - d * 0.35 - o.stage * 0.8 + Math.random() * 0.8 + (room ? 0.3 : 0);
      if (!best || score > best.s) best = { o, s: score };
    }
    if (!best) return;
    const b = refine(best.o.id, best.o.stage + 1, { delay: 0 });
    if (b) { b.ambient = true; best.o.auto = b.dur + 1; }
    log('ambient', { id: best.o.id, stage: best.o.stage });
  }

  // ---------- where the body was: a chalk outline ----------
  const BODY = [[0.24, 0.07], [0.3, 0.22], [0.12, 0.4], [-0.05, 0.52], [0, 0.58], [0.18, 0.47], [0.38, 0.3], [0.62, 0.26], [0.9, 0.24], [1.0, 0.3], [1.35, 0.42], [1.72, 0.46], [1.75, 0.38], [1.4, 0.3], [1.08, 0.14],
    [1.08, 0.02], [1.38, -0.1], [1.72, -0.12], [1.74, -0.2], [1.35, -0.22], [1.0, -0.2], [0.9, -0.22], [0.62, -0.24], [0.48, -0.3], [0.62, -0.52], [0.78, -0.66], [0.72, -0.72], [0.52, -0.58], [0.36, -0.4], [0.3, -0.22], [0.24, -0.07]];
  function drawChalk() {
    if (!S || S.chalk || !CS.chalk) return;
    S.chalk = true;
    const hd = CS.chalk.head, ax = V.norm([CS.chalk.dir[0], 0, CS.chalk.dir[1]]), sd = [-ax[2], 0, ax[0]];
    const at = (u, v, j) => [hd[0] + ax[0] * u + sd[0] * v + (Math.random() - 0.5) * j, 0.018, hd[1] + ax[2] * u + sd[2] * v + (Math.random() - 0.5) * j];
    const dense = pts => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 4; k++) { const t = k / 4; out.push(at(U.lerp(pts[i][0], pts[i + 1][0], t), U.lerp(pts[i][1], pts[i + 1][1], t), 0.022)); } const l = pts[pts.length - 1]; out.push(at(l[0], l[1], 0.02)); return out; };
    const half = Math.floor(BODY.length / 2);
    const lines = [dense(BODY.slice(0, half + 1)), dense(BODY.slice(half))];
    const ring = { c: at(0.12, 0, 0), u: V.mul(ax, 0.12), v: V.mul(sd, 0.1) };
    W.addMark('chalk', { lines, ring, dur: 2.4, wMul: 2.6, dark: 0.42, bias: 0.03, id: 'chalk_shadow' });
    W.addMark('chalk', { lines, ring, dur: 2.4, wMul: 1.5, dark: 1, bias: 0.035, inkCol: [0.985, 0.98, 0.955], id: 'chalk' });
    const f = O(H.zoneAt(hd[0], 0, hd[1]) + '_f'); if (f && f.stage < 1) refine(f.id, 1);
    learn('scene', true);
    log('chalk');
  }
  Gm.drawChalk = () => drawChalk();

  // ---------- footprints only she can see ----------
  function makeTrail(C) {
    const out = [], r = U.rng(7);
    let foot = 0, total = 0;
    const segs = C.trail.map(sg => { let L = 0; for (let i = 1; i < sg.pts.length; i++) L += Math.hypot(sg.pts[i][0] - sg.pts[i - 1][0], sg.pts[i][1] - sg.pts[i - 1][1]); total += L; return L; });
    let acc0 = 0;
    C.trail.forEach((sg, si) => {
      const pts = sg.pts, seg = [];
      for (let i = 1; i < pts.length; i++) seg.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      let s = 0.2;
      while (s < segs[si] - 0.05) {
        let i = 0, acc = 0;
        while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; }
        const t = (s - acc) / seg[i], a = pts[i], b = pts[i + 1];
        const dx = (b[0] - a[0]) / seg[i], dz = (b[1] - a[1]) / seg[i], side = foot % 2 ? 1 : -1, u = (acc0 + s) / total;
        const x = a[0] + (b[0] - a[0]) * t + dz * 0.09 * side, z = a[1] + (b[1] - a[1]) * t - dx * 0.09 * side;
        if (u < 0.3 || r() > 0.3) out.push({ c: [x, 0.018, z], yaw: Math.atan2(dx, dz), d: 1 - 0.45 * u, u, seg: si, zone: H.zoneAt(x, 0, z), shown: false });
        s += 0.36; foot++;
      }
      acc0 += segs[si];
    });
    return out;
  }
  function showPrints(zone) {
    if (!S.printsReady) return;
    const list = S.trail.filter(q => !q.shown && q.zone === zone);
    if (!list.length) return;
    for (const q of list) q.shown = true;
    W.addMark('prints', { prints: list, dur: Math.min(3.5, 0.18 * list.length), bias: 0.03, id: 'prints_' + zone, delay: 0.6, inkCol: [0.3, 0.38, 0.55] });
    log('prints', { zone, n: list.length });
  }

  // ---------- what to do next (upper-left corner) ----------
  function nextStep() {
    if (!S || Gm.mode !== 'explore' || !S.introDone) return '';
    const tap = tapWord();
    if (!S.chalk) return CS.sceneHint || 'Where was the body found? Go and see.';
    if (!S.f.trail) return `There are footprints only you can see. ${tap} them.`;
    for (const q of CS.questions) {
      if (S.solved[q.id]) continue;
      if (MEM.ready(S, q)) return `<b>${q.text}</b> You know. Hold ${G()} on it to tell them.`;
      const miss = q.needs.find(f => !S.f[f]);
      return `<b>${q.text}</b> ${(q.hints && q.hints[miss]) || ''} <span class="dim">(${MEM.have(S, q)} of ${q.needs.length})</span>`;
    }
    return '';
  }
  let nextHtml = null;
  function updateNext() {
    const html = nextStep();
    if (html === nextHtml) return;
    nextHtml = html;
    const el = document.getElementById('next');
    if (!el) return;
    el.innerHTML = html ? '<span class="k">next</span> ' + html : '';
    el.classList.remove('show'); void el.offsetWidth; if (html) el.classList.add('show');
  }

  // ---------- touch: turn toward the tapped point ----------
  function screenDir(pt) {
    const c = Gm.cam; if (!c || !pt) return null;
    const w = window.innerWidth, h = window.innerHeight, t = Math.tan(c.fov / 2), asp = w / h;
    const nx = (pt.x / w) * 2 - 1, ny = 1 - (pt.y / h) * 2;
    return V.norm(V.add(c.fwd, V.add(V.mul(c.right, nx * t * asp), V.mul(c.up, ny * t))));
  }
  function aimAt(d) { if (d) P.aim = { yaw: Math.atan2(d[0], d[2]), pitch: Math.asin(U.clamp(d[1], -1, 1)) }; }

  // ---------- figures (visions, the replay) ----------
  function ghostShow(id, x, y, z, yaw, layers, o) {
    o = o || {};
    const g = O(id);
    g.pose = { x, y, z, yaw }; g.overrideModel = null; g.model = W.poseModel(g);
    g.fig = F.pose({}, layers || []);
    g.hidden = false; g.eraseSurf = undefined; g.fadeIn = 0; g.erase = 1; g.tint = 0; g.tintTarget = 0;
    W.clearBatches(g);
    g.stage = 2; g.cur = Object.assign({}, W.LOOK[2]); g.from = null; g.stageT = 1;
    g.revealMul = 0.55; g.inkMul = 0.85; g.strokeAlpha = 0.9; g.ghostVeil = o.solid ? 0 : 0.3;
    W.addBatch(g, 2, { speed: 2.6 }); g.auto = 3;
    if (!o.silent) A.play('flash');
  }
  function ghostHide(id) {
    const g = O(id);
    if (g.hidden || g.eraseSurf !== undefined) return;
    g.eraseSurf = 0;
    for (const b of g.batches) if (b.eraseT < 0) { b.eraseT = 0; W.dust(g, b, 24); }
  }
  function moveGhost(g, act, t, dt) {
    let p, yaw, walkAmt = 0, phase = 0;
    if (act.kind === 'walk') {
      const d = U.sat((t - act.t0) / (act.t1 - act.t0)) * act.L;
      let acc = 0, i = 0;
      while (i < act.seg.length - 1 && acc + act.seg[i] < d) { acc += act.seg[i]; i++; }
      const k = act.seg[i] > 0 ? U.sat((d - acc) / act.seg[i]) : 1;
      const a = act.pts[i], b = act.pts[i + 1];
      p = V.lerp(a, b, k);
      yaw = g.pose.yaw + U.angDiff(g.pose.yaw, Math.atan2(b[0] - a[0], b[2] - a[2])) * Math.min(1, dt * 10);
      walkAmt = t < act.t1 ? 1 : 0; phase = d * 5.2;
    } else { p = act.p; yaw = g.pose.yaw + U.angDiff(g.pose.yaw, act.yaw) * Math.min(1, dt * 8); }
    g.pose = { x: p[0], y: p[1], z: p[2], yaw };
    g.model = W.poseModel(g);
    g.fig = F.pose({}, act.layers || [], phase, walkAmt);
  }
  function camAt(cams, t) {
    let i = 0;
    while (i < cams.length - 1 && cams[i + 1].t <= t) i++;
    const a = cams[i], b = cams[Math.min(i + 1, cams.length - 1)];
    if (a === b || t <= a.t) return { eye: a.eye, at: a.at };
    const k = U.easeInOut(U.sat((t - a.t) / Math.max(0.1, b.t - a.t)));
    return { eye: V.lerp(a.eye, b.eye, k), at: V.lerp(a.at, b.at, k) };
  }

  // ---------- the finale: she tells it, the night replays ----------
  function startFinale() {
    if (Gm.mode !== 'explore') return;
    Gm.mode = 'replay';
    log('finale');
    Vo.clear();
    for (const o of W.list) if (!o.hidden && o.stage < 4 && !o.def.ghost && !o.def.prop && !o.def.player && !o.def.vision) { W.setStage(o, 4, { delay: 0 }); o.auto = 8; o.drawRate = 2.6; }
    for (const id of ['ghostA', 'ghostB']) { O(id).tint = 0; O(id).tintTarget = 0; }
    const acts = { ghostA: [], ghostB: [] }, cams = [], ats = [], props = [];
    const R = {
      show: (id, x, z, yaw, layers) => ghostShow(id, x, 0, z, yaw, layers, { solid: true, silent: true }),
      hide: id => ghostHide(id),
      cam: (t, eye, at) => cams.push({ t, eye, at }),
      at: (t, fn) => ats.push({ t, fn, done: false }),
      say: id => say(id, { pri: 3 }),
      walk: (id, t0, pts, speed) => { let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = V.dist(pts[i - 1], pts[i]); seg.push(d); L += d; } acts[id].push({ t0, t1: t0 + L / speed, kind: 'walk', pts, seg, L, layers: id === 'ghostA' && props.some(p => p.ghost === id && p.t <= t0) ? ['carry'] : [] }); return t0 + L / speed; },
      pose: (id, t0, t1, p, yaw, layers) => { acts[id].push({ t0, t1, kind: 'pose', p, yaw, layers }); return t1; },
      prop: (pid, ghost, t) => props.push({ t, id: pid, ghost }),
      hideGroups: (id, gs) => { O(id).hideGroups = gs; },
      sound: n => A.play(n),
      openWindow: id => { const o = O(id); o.doorTarget = o.def.door.open; },
      door: (id, open) => { const o = O(id); o.doorTarget = open ? o.def.door.open : 0; },
    };
    const end = CS.replay(R);
    Gm.replay = { t: 0, acts, cams, ats, props, end: Math.max(end, 4) };
    A.music(true, { beat: 0.5, loops: 3 });
  }
  function updateReplay(dt) {
    const R = Gm.replay;
    R.t += dt;
    for (const a of R.ats) if (!a.done && R.t >= a.t) { a.done = true; a.fn(); }
    for (const id in R.acts) {
      const g = O(id);
      let act = null;
      for (const a of R.acts[id]) if (a.t0 <= R.t) act = a;
      if (act && !g.hidden) moveGhost(g, act, R.t, dt);
    }
    const last = {};
    for (const pr of R.props) if (pr.t <= R.t) last[pr.id] = pr;
    for (const id in last) {
      const pr = last[id], o = O(id);
      if (!pr.ghost) { o.hidden = true; continue; }
      const g = O(pr.ghost);
      o.hidden = g.hidden; o.colorAmt = 1;
      if (o.stage < 4) { o.stage = 4; o.cur = Object.assign({}, W.look(o)); o.stageT = 1; }
      const wp = M.xp(g.model, (g.hands || { handR: [0.25, 1.0, 0.2] }).handR);
      o.overrideModel = M.pose(wp[0], wp[1] - 0.08, wp[2], g.pose.yaw);
    }
    const c = camAt(R.cams, R.t);
    Gm.camOverride = { eye: c.eye, at: c.at, fov: 60 };
    if (R.t >= R.end && !Vo.busy()) finishReplay();
  }
  function finishReplay() {
    Gm.mode = 'end';
    log('replayEnd');
    seq(CS.finale.slice(-2), { pri: 3, onEnd: () => { log('end'); A.music(false); if (WK.UI) WK.UI.showEnd(S, CS); } });
    Gm.endCam = { t: 0, from: Gm.camOverride };
  }
  function updateEnd(dt) {
    const e = Gm.endCam; if (!e) return;
    e.t += dt;
    const hd = CS.chalk.head, at = [hd[0], 0.1, hd[1]];
    const stand = [hd[0] + 1.4, 2.6, hd[1] + 1.4];
    const k = U.easeInOut(U.sat(e.t / 3));
    Gm.camOverride = { eye: V.lerp(e.from.eye, stand, k), at: V.lerp(e.from.at, at, k), fov: U.lerp(60, 50, k) };
  }

  // ---------- starting a case ----------
  function load(id) {
    CS = WK.Cases[id] || WK.Cases.c1;
    Gm.caseId = CS.id; Gm.C = CS;
    H.load(CS); MEM.use(CS);
    W.init(); W.buildCollision(); W.bounds = CS.bounds;
    S = Gm.S = MEM.newState(CS);
    S.visions = []; S.trail = makeTrail(CS); S.ambT = 3;
    if (CS.setup) CS.setup({ O, turnGroup: (oid, g, c, ang) => { const o = O(oid); o.staticGroups = o.staticGroups || {}; o.staticGroups[g] = M.mul(M.trans(c[0], c[1], c[2]), M.mul(M.rotY(ang), M.trans(-c[0], -c[1], -c[2]))); } });
    const st = CS.start;
    P.pos = st.pos.slice(); P.yaw = st.yaw; P.pitch = st.pitch; P.vel = [0, 0, 0]; P.zone = st.zone; P.aim = null;
    // the opening: the floor and ceiling of the room she stands in, nothing drawing yet
    stageNow(st.zone + '_f', 1); stageNow(st.zone + '_c', 1);
    Vo.preload(CS.intro);
  }
  Gm.boot = id => {
    Vo.clear(); A.music(false);
    load(id || Gm.caseId || 'c1');
    Gm.mode = 'title'; Gm.camOverride = null;
  };
  Gm.start = id => {
    Vo.clear(); A.music(false);
    load(id || Gm.caseId || 'c1');
    Gm.camOverride = null; Gm.mode = 'explore'; Gm.paused = false; Gm.replay = null; Gm.endCam = null;
    hold.active = false; hold.t = 0; search.active = false; nextHtml = null;
    document.getElementById('end').classList.add('hidden');
    S.visited[P.zone] = true;
    log('start', { case: CS.id });
    seq(CS.intro, { pri: 2, onEnd: () => {
      S.introDone = true; S.introEndT = S.t; S.printsReady = true;
      for (const r of H.rooms) if (O(r.id + '_f').stage >= 1) showPrints(r.id);
      hint(`${tapWord()} anything to ask about it; each ${tapWord().toLowerCase()} draws it more, and something fully drawn gets searched. Hold on something to tell them it’s the answer.`, 11);
    } });
    if (WK.UI) WK.UI.refreshNotes();
  };
  Gm.nextCase = () => (CS && CS.next) || null;

  // ---------- per frame ----------
  function updatePlayer(dt) {
    const lockMove = hold.active && hold.t > 0.25;
    P.yaw -= I.look[0];
    P.pitch = U.clamp(P.pitch + I.look[1], -1.35, 1.15);
    if (P.aim) {
      let dy = P.aim.yaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const dp = P.aim.pitch - P.pitch, k = Math.min(1, dt * 12);
      P.yaw += dy * k; P.pitch = U.clamp(P.pitch + dp * k, -1.35, 1.15);
      if ((Math.abs(dy) < 0.01 && Math.abs(dp) < 0.01) || Math.abs(I.look[0]) + Math.abs(I.look[1]) > 0.02) P.aim = null;
    }
    const fwd = [Math.sin(P.yaw), 0, Math.cos(P.yaw)], right = [-Math.cos(P.yaw), 0, Math.sin(P.yaw)];
    const sp = lockMove ? 0 : 2.05;
    const want = V.add(V.mul(fwd, I.move[1] * sp), V.mul(right, I.move[0] * sp));
    P.vel = [U.approach(P.vel[0], want[0], 11, dt), 0, U.approach(P.vel[2], want[2], 11, dt)];
    const np = [P.pos[0] + P.vel[0] * dt, 0, P.pos[2] + P.vel[2] * dt];
    W.prevPos = P.pos;
    const c = W.collide(np, 0.22);
    const moved = Math.hypot(c[0] - P.pos[0], c[2] - P.pos[2]);
    P.pos = c;
    P.bobT += moved * 5.5; P.stepAcc += moved;
    if (P.stepAcc > 0.62) { P.stepAcc = 0; A.play('step', { surface: 'wood' }); }
    const zone = H.zoneAt(P.pos[0], 0, P.pos[2]);
    if (zone !== P.zone) {
      P.zone = zone;
      if (!S.visited[zone]) { S.visited[zone] = true; log('room', { id: zone }); const el = document.getElementById('room'); el.textContent = (H.byId[zone] && H.byId[zone].name) || ''; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
    }
    const er = CS.enterRoom && CS.enterRoom[zone];
    if (er && S.introDone && !S.saidRoom[zone]) { S.saidRoom[zone] = true; say(er, { pri: 2.2 }); }
  }
  function updateGaze(dt) {
    const eye = eyePos(), dir = lookDir(P.yaw, P.pitch);
    const hit = W.raycast(eye, dir, 9, o => o.stage >= 1 && !o.def.ghost);
    if (hit) {
      Gm.gaze = { obj: hit.o, tag: hit.tag, g: hit.g, dist: hit.t, p: hit.p };
      if (lastGazeId !== hit.o.id) { lastGazeId = hit.o.id; log('gaze', { id: hit.o.id, tag: hit.tag }); }
    } else Gm.gaze = null;
    for (const o of W.list) o.drawing = false;
    const g = Gm.gaze;
    if (!g || g.obj.def.room) return;
    const o = g.obj;
    const rate = g.dist < 4.5 ? 1 : U.lerp(1, 0.4, U.sat((g.dist - 4.5) / 4));
    o.att += dt * rate; o.attTotal = (o.attTotal || 0) + dt * rate;
    progress(o, g.tag);
  }
  function updateHold(dt) {
    const g = Gm.gaze;
    const obj = g && g.obj && !g.obj.def.room ? g.obj : null;
    if (I.act.pressed) { hold.active = true; hold.t = 0; hold.objId = obj ? obj.id : null; hold.committed = false; }
    if (hold.active && I.act.down) {
      hold.t += dt;
      if (!hold.objId && hold.t < 0.3 && obj) hold.objId = obj.id;
      if (hold.objId && (!obj || obj.id !== hold.objId) && hold.t > 0.3) { hold.active = false; hold.t = 0; log('holdCancel'); }
      else if (hold.objId && !hold.committed && hold.t >= 1.3) tell(O(hold.objId));
    }
    if (hold.active && I.act.released) {
      if (!hold.committed && hold.t < 0.3) ask();
      hold.active = false; hold.t = 0;
    }
    if (!I.act.down && hold.active) { hold.active = false; hold.t = 0; }
  }
  Gm.holdProgress = () => (hold.active && hold.objId && !hold.committed ? U.sat((hold.t - 0.3) / 1.0) : 0);
  function suggestion() {
    const lvl = (WK.UI && WK.UI.settings.suggest) || 'gentle';
    if (lvl === 'off' || !S.introDone) return;
    const wait = lvl === 'often' ? 40 : 80;
    if (S.t - (S.lastProgressT || 0) < wait || S.t - (S.lastSuggestT || -99) < wait) return;
    // the next thing that would move the case on
    let id = null;
    for (const q of CS.questions) {
      if (S.solved[q.id]) continue;
      const miss = q.needs.find(f => !S.f[f]);
      const src = MEM.NOTICES.find(n => MEM.val(S, n.fact) === miss) || Object.keys(MEM.SEARCHES).map(k => Object.assign({ obj: k }, MEM.SEARCHES[k])).find(sr => sr.fact === miss);
      if (src) { id = src.obj; break; }
      if (!miss) { id = q.objs[0]; break; }
    }
    const o = id && O(id); if (!o || o.hidden) return;
    S.lastSuggestT = S.t;
    const c = W.center(o), cam = Gm.cam, r = 0.45 + Math.random() * 0.2;
    const cc = V.add(c, [(Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3]);
    W.addMark('circle', { c: cc, u: V.mul(cam.right, r), v: V.mul(cam.up, r * 0.8), dur: 2.2, life: 16, id: 'suggest', bias: 0.3, dark: 0.45, wMul: 1.8, wobble: 0.035 });
    W.addMark('circle', { c: cc, u: V.mul(cam.right, r * 1.12), v: V.mul(cam.up, r * 0.9), dur: 2.6, life: 16, id: 'suggest', bias: 0.3, dark: 0.3, wMul: 1.2, wobble: 0.05 });
    log('suggest', { id });
  }
  function updateIdle() {
    if (Gm.mode === 'explore') suggestion();
    if (Vo.busy() || Gm.mode !== 'explore' || !S.introDone) return;
    const quiet = S.t - Math.max(S.lastLineT, S.lastFactT);
    if (quiet > 35 && S.t - S.lastIdleT > 40) {
      const left = MEM.IDLE.filter(id => !S.idleUsed[id]);
      if (!left.length) return;
      const id = left[Math.floor(Math.random() * left.length)];
      S.idleUsed[id] = true; S.lastIdleT = S.t;
      say(id, { pri: 0 });
    }
  }
  function updateHand(dt) {
    let tgt = null;
    const g = Gm.gaze;
    if (search.active && search.p) {
      search.t += dt;
      tgt = { p: V.add(search.p, [Math.sin(search.t * 7) * 0.05, 0, Math.cos(search.t * 5) * 0.04]), pose: 'push' };
      if (search.t > 2.2) search.active = false;
    } else if (g && g.obj) {
      const o = g.obj;
      const er = o.batches.find(b => b.eraseT >= 0 && b.eraseT < 0.65 && b.loud);
      if (er) tgt = { p: W.center(o), pose: 'eraser', scrub: true };
      else { const ab = W.activeBatch(o); const h = ab && !ab.ambient ? W.headWorld(o) : null; if (h) tgt = { p: h.p, pose: 'pencil', speed: h.speed, stroke: h.stroke, dur: h.dur }; }
    }
    if (!tgt) {
      let best = null;
      const consider = (p, pose, speed, stroke, dur) => {
        const s = project(p); if (!s.vis) return;
        const d = Math.hypot(s.x - window.innerWidth / 2, s.y - window.innerHeight / 2);
        if (!best || d < best.d) best = { p, pose, speed, d, stroke, dur };
      };
      for (const o of W.list) {
        if (o.hidden) continue;
        if (o.ghost && o.ghost.t < 0.8) consider(M.xp(o.ghost.model, V.mul(V.add(o.def.bounds.lo, o.def.bounds.hi), 0.5)), 'eraser');
        if (o.auto > 0) { const ab = W.activeBatch(o); if (ab && !ab.ambient) { const h = W.headWorld(o); if (h) consider(h.p, 'pencil', h.speed, h.stroke, h.dur); } }
      }
      for (const m of W.marks) { const h = W.markHead(m); if (h) consider(h.p, 'pencil', h.speed, h.stroke, h.dur); }
      tgt = best;
    }
    if (tgt) {
      const s = project(tgt.p);
      if (s.vis) {
        let x = s.x, y = s.y;
        if (tgt.pose === 'eraser') { x += Math.sin(S.t * 22) * 14; y += Math.cos(S.t * 17) * 6; }
        if (hand.alpha < 0.05) { hand.x = x + 120; hand.y = y + 140; }
        const r = tgt.pose === 'pencil' ? 30 : 14;
        hand.x = U.approach(hand.x, x, r, dt); hand.y = U.approach(hand.y, y, r, dt);
        hand.alpha = U.approach(hand.alpha, 1, 9, dt);
        hand.pose = tgt.pose; hand.speed = tgt.speed || 0;
      } else hand.alpha = U.approach(hand.alpha, 0, 6, dt);
    } else hand.alpha = U.approach(hand.alpha, 0, 3.5, dt);
    hand.drawing = !!tgt && tgt.pose === 'pencil';
    const wasErasing = hand.erasing;
    hand.erasing = !!tgt && tgt.pose === 'eraser';
    const pan = U.clamp((hand.x / window.innerWidth - 0.5) * 1.6, -0.8, 0.8);
    if (hand.drawing && tgt.stroke && tgt.stroke !== hand.lastStroke && hand.alpha > 0.3 && !Gm.paused) { hand.lastStroke = tgt.stroke; A.stroke(tgt.dur || 0.3, pan); }
    if (hand.erasing && (!wasErasing || S.t - (hand.eraseT || 0) > 0.55) && hand.alpha > 0.3) { hand.eraseT = S.t; A.sample('eraser', { pan, gain: 0.8 }); }
  }
  function updatePrompt() {
    const el = document.getElementById('prompt');
    let html = '';
    const g = Gm.gaze;
    if (Gm.mode === 'explore' && g && g.obj && !g.obj.def.room && !Gm.paused && Gm.canTell() && g.dist < 5) html = `hold ${G()} <b>tell them: ${g.obj.def.name || 'this'}</b>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; el.classList.toggle('show', !!html); }
    el.classList.toggle('holding', Gm.holdProgress() > 0);
  }
  function updateTints(dt) {
    for (const o of W.list) {
      if (o.tintTarget === undefined) continue;
      if (o.tintDelay > 0) { o.tintDelay -= dt; continue; }
      o.tint = U.approach(o.tint || 0, o.tintTarget, o.tintTarget > (o.tint || 0) ? 5 : 0.9, dt);
    }
  }

  Gm.update = rawDt => {
    const dt = rawDt * Gm.timeScale;
    if (!S) return;
    if (Gm.mode === 'title') { P.yaw += dt * 0.05; return; }
    if (Gm.paused) return;
    S.t += dt;
    if (Gm.mode === 'explore') {
      if (I.aimPoint) { aimAt(screenDir(I.aimPoint)); I.aimPoint = null; }
      updatePlayer(dt); updateSurfaces(dt); updateAmbient(dt); updateGaze(dt); updateHold(dt);
      if (I.ask.pressed) { const d = I.ask.at ? screenDir(I.ask.at) : null; if (d) aimAt(d); ask(d); }
      updateIdle();
    } else if (Gm.mode === 'replay') updateReplay(dt);
    else if (Gm.mode === 'end') updateEnd(dt);
    for (const o of W.list) if (o.colorIn) { o.colorAmt = U.approach(o.colorAmt || 0, 1, 0.8, dt); if (o.colorAmt >= 1) o.colorIn = false; }
    updateVisions(dt);
    updateTints(dt);
    updateHand(dt);
    updateNext();
    updatePrompt();
    if (memoT > 0) { memoT -= dt; if (memoT <= 0) document.getElementById('memo').classList.remove('show'); }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) document.getElementById('hint').classList.remove('show'); }
    if (ideaT > 0) { ideaT -= dt; if (ideaT <= 0) document.getElementById('idea').classList.remove('show'); }
  };

  Gm.camera = aspect => {
    let eye, at, fov = 58;
    if (Gm.mode === 'title') { eye = [P.pos[0], 1.62, P.pos[2]]; at = V.add(eye, lookDir(P.yaw, -0.08)); }
    else if (Gm.camOverride) { eye = Gm.camOverride.eye; at = Gm.camOverride.at; fov = Gm.camOverride.fov || 58; }
    else { eye = eyePos(); at = V.add(eye, lookDir(P.yaw, P.pitch)); }
    if (aspect < 1) fov = Math.min(80, fov / Math.max(0.6, aspect) * 0.8);
    const fovR = fov * Math.PI / 180;
    const view = M.lookAt(eye, at, [0, 1, 0]), proj = M.persp(fovR, aspect, 0.04, 40), vp = M.mul(proj, view);
    const fwd = V.norm(V.sub(at, eye)), right = V.norm(V.cross(fwd, [0, 1, 0])), up = V.cross(right, fwd);
    Gm.cam = { eye, at, view, proj, vp, fov: fovR, near: 0.04, far: 40, fwd, right, up };
    return Gm.cam;
  };
  Gm.soundState = () => {
    const pan = hand.alpha > 0.1 ? U.clamp((hand.x / window.innerWidth - 0.5) * 1.6, -0.8, 0.8) : 0;
    return { pen: hand.drawing ? hand.alpha * (Gm.paused ? 0 : 1) : 0, penSpeed: hand.speed, pan, eraser: hand.erasing ? hand.alpha : 0,
      rain: Gm.mode === 'title' ? 0.6 : 1, fridgeDist: 20, fridgeOpen: false, clockDist: 20, dogDist: 99 };
  };

  Gm.dbg = {
    state: () => ({
      mode: Gm.mode, case: CS && CS.id, t: +S.t.toFixed(2), pos: P.pos.map(v => +v.toFixed(2)), yaw: +P.yaw.toFixed(2), pitch: +P.pitch.toFixed(2), zone: P.zone,
      gaze: Gm.gaze ? { id: Gm.gaze.obj.id, tag: Gm.gaze.tag, d: +Gm.gaze.dist.toFixed(2) } : null,
      facts: S.order.slice(), contradicted: Object.keys(S.contradicted), solved: Object.keys(S.solved), ideas: S.ideas,
      voice: Vo.playing(), queue: Vo.queue.map(q => q.id), sub: Vo.subText(), hand: { a: +hand.alpha.toFixed(2), pose: hand.pose },
      stages: Object.fromEntries(W.list.filter(o => !o.def.ghost && !o.def.prop).map(o => [o.id, o.stage])),
      tints: Object.fromEntries(W.list.filter(o => o.tint > 0.01).map(o => [o.id, +o.tint.toFixed(2)])),
      prompt: document.getElementById('prompt').textContent, hold: +Gm.holdProgress().toFixed(2), next: (document.getElementById('next') || {}).textContent || '',
      prints: S.trail.filter(q => q.shown).length, chalk: !!S.chalk, replay: Gm.replay ? +Gm.replay.t.toFixed(2) : null, fps: WK.stats ? Math.round(WK.stats.fps) : 0,
    }),
    aimAt: (id, tag) => {
      const o = O(id);
      let target = W.center(o);
      if (tag) { const pb = WK.Geo.pickBoxes(o.def, 3).find(b => b.tag === tag); if (pb) target = M.xp(o.model, M.xp(pb.m, [0, 0, 0])); }
      const e = eyePos(), d = V.sub(target, e);
      return { yaw: Math.atan2(d[0], d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])), dist: V.len(d), target };
    },
    face: (id, tag) => { const a = Gm.dbg.aimAt(id, tag); P.yaw = a.yaw; P.pitch = a.pitch; P.aim = null; return a; },
    teleport: (x, y, z, yaw, pitch) => { P.pos = [x, 0, z]; if (yaw !== undefined) P.yaw = yaw; if (pitch !== undefined) P.pitch = pitch; P.vel = [0, 0, 0]; },
    events: since => Gm.events.filter(e => e.t >= (since || 0)),
    speed: k => { W.speed = k; },
    solveAll: () => { for (const q of CS.questions) for (const f of q.needs) learn(f, true); },
  };
})();
