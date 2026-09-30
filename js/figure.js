'use strict';
// Gesture-drawing mannequins: the remembered "past me" and Biscuit the dog. Each body part is a group so
// the same mesh and strokes can be posed every frame.
(function () {
  const G = WK.Geo, MAT = G.MAT, M = WK.M, V = WK.V, U = WK.U;
  const F = WK.Fig = {};
  const EL = (p, e, o) => Object.assign({ t: 'ell', p, e, seg: 12, rings: 8 }, o || {});
  const P = o => Object.assign({ mat: MAT.FABRIC, tone: 0.06, nopick: true }, o);

  // ---------- person ----------
  F.personDef = id => ({
    id, name: 'me, earlier', figure: 'person', blob: false, noGround: true,
    parts: [
      EL([0, 0.11, 0.01], [0.092, 0.112, 0.102], P({ g: 1 })),
      EL([0, 0.095, 0.095], [0.014, 0.02, 0.02], P({ g: 1 })),
      EL([0, 0.2, 0], [0.17, 0.25, 0.11], P({ g: 2, tone: 0.12 })),
      EL([0, 0.0, 0], [0.155, 0.12, 0.1], P({ g: 3, tone: 0.2 })),
      EL([0, -0.14, 0], [0.047, 0.15, 0.047], P({ g: 4, tone: 0.12 })),
      EL([0, -0.13, 0], [0.04, 0.14, 0.04], P({ g: 5, tone: 0.12 })),
      EL([0, -0.06, 0], [0.034, 0.065, 0.02], P({ g: 6, tone: 0.02 })),
      EL([0, -0.14, 0], [0.047, 0.15, 0.047], P({ g: 7, tone: 0.12 })),
      EL([0, -0.13, 0], [0.04, 0.14, 0.04], P({ g: 8, tone: 0.12 })),
      EL([0, -0.06, 0], [0.034, 0.065, 0.02], P({ g: 9, tone: 0.02 })),
      EL([0, -0.22, 0], [0.068, 0.235, 0.068], P({ g: 10, tone: 0.3 })),
      EL([0, -0.21, 0], [0.05, 0.225, 0.05], P({ g: 11, tone: 0.3 })),
      EL([0, -0.035, 0.055], [0.05, 0.045, 0.12], P({ g: 12, tone: 0.5 })),
      EL([0, -0.22, 0], [0.068, 0.235, 0.068], P({ g: 13, tone: 0.3 })),
      EL([0, -0.21, 0], [0.05, 0.225, 0.05], P({ g: 14, tone: 0.3 })),
      EL([0, -0.035, 0.055], [0.05, 0.045, 0.12], P({ g: 15, tone: 0.5 })),
    ],
    customStrokes: (stage, o, rnd, out) => {
      // gesture rings around each limb, in group space so they follow the pose
      const rings = [[1, [0, 0.11, 0.01], [0.095, 0.115, 0.105]], [2, [0, 0.2, 0], [0.17, 0.25, 0.11]], [3, [0, 0, 0], [0.155, 0.12, 0.1]],
        [4, [0, -0.14, 0], [0.047, 0.15, 0.047]], [5, [0, -0.13, 0], [0.04, 0.14, 0.04]], [7, [0, -0.14, 0], [0.047, 0.15, 0.047]], [8, [0, -0.13, 0], [0.04, 0.14, 0.04]],
        [10, [0, -0.22, 0], [0.068, 0.235, 0.068]], [11, [0, -0.21, 0], [0.05, 0.225, 0.05]], [13, [0, -0.22, 0], [0.068, 0.235, 0.068]], [14, [0, -0.21, 0], [0.05, 0.225, 0.05]]];
      for (const [g, c, e] of rings) {
        out.push({ pts: G.ringStroke(c, [e[0] * 1.03, 0, 0], [0, 0, e[2] * 1.03], { over: 0.15, wob: 0.08 }, rnd), g, w: 0.8, d: 0.7 });
        out.push({ pts: G.ringStroke(c, [0, e[1] * 1.02, 0], [0, 0, e[2] * 1.02], { over: 0.1, wob: 0.06 }, rnd), g, w: 0.9, d: 0.85 });
      }
      return 'done';
    },
  });

  // Base pose values
  F.basePose = () => ({ x: 0, y: 0, z: 0, yaw: 0, lean: 0, twist: 0, bob: 0, hp: 0, hy: 0,
    aL: [0.05, 0.12, 0.15], aR: [0.05, 0.12, 0.15], lL: [0, 0], lR: [0, 0], crouch: 0 });

  const POSES = {
    stand: {},
    reach: { aR: [1.45, 0.12, 0.25], lean: 0.05, hp: -0.15 },
    phone: { aL: [0.35, 0.45, 2.35], hp: 0.12, hy: 0.2 },
    carry: { aL: [0.55, 0.12, 1.25] },
    keys: { aR: [0.4, 0.16, 0.95] },
    toss: { aR: [1.25, 0.55, 0.3], twist: 0.35 },
    lock: { aR: [0.95, 0.1, 0.75], lean: 0.08, hp: 0.25 },
    leash: { aR: [0.9, 0.1, 0.2], lean: 0.45, hp: 0.3, crouch: 0.12 },
    pick: { aL: [1.05, 0.1, 0.35], lean: 0.2, hp: 0.35 },
    place: { aR: [1.15, 0.05, 0.45], aL: [1.2, 0.05, 0.35], lean: 0.22, hp: 0.3 },
    open: { aL: [1.1, 0.35, 0.6], lean: 0.05 },
  };
  F.POSES = POSES;

  // Compose a pose from named layers: e.g. pose('walk', {phase}, 'phone', 'keys')
  F.pose = (base, layers, walkPhase, walkAmt) => {
    const p = Object.assign(F.basePose(), base || {});
    p.aL = p.aL.slice(); p.aR = p.aR.slice(); p.lL = p.lL.slice(); p.lR = p.lR.slice();
    for (const name of layers || []) {
      const L = POSES[name]; if (!L) continue;
      for (const k in L) p[k] = Array.isArray(L[k]) ? L[k].slice() : L[k];
    }
    if (walkAmt > 0) {
      const s = Math.sin(walkPhase), c = Math.cos(walkPhase);
      p.lL = [p.lL[0] + 0.42 * s * walkAmt, p.lL[1] + Math.max(0, -c) * 0.7 * walkAmt];
      p.lR = [p.lR[0] - 0.42 * s * walkAmt, p.lR[1] + Math.max(0, c) * 0.7 * walkAmt];
      if (!(layers || []).some(n => POSES[n] && POSES[n].aL)) p.aL[0] += -0.32 * s * walkAmt;
      if (!(layers || []).some(n => POSES[n] && POSES[n].aR)) p.aR[0] += 0.32 * s * walkAmt;
      p.bob += Math.abs(Math.sin(walkPhase)) * 0.025 * walkAmt;
      p.lean += 0.05 * walkAmt;
    }
    return p;
  };

  // Fill group matrices (Float32Array(256)) for the person; returns hand positions (object space)
  F.poseGroups = (p, out) => {
    const set = (g, m) => out.set(m, g * 16);
    const root = M.mul(M.trans(0, 0.93 + p.bob - p.crouch, 0), M.rotY(p.twist * 0.3));
    const pelvis = M.mul(root, M.rotX(p.lean * 0.3));
    set(3, pelvis);
    const chest = M.mul(pelvis, M.mul(M.trans(0, 0.1, 0), M.mul(M.rotY(p.twist * 0.7), M.rotX(p.lean * 0.8))));
    set(2, chest);
    const head = M.mul(chest, M.mul(M.trans(0, 0.47, 0.01), M.mul(M.rotY(p.hy), M.rotX(p.hp))));
    set(1, head);
    const arm = (side, a, gU, gF, gH) => {
      const sh = M.mul(chest, M.trans(side * 0.19, 0.4, 0));
      const up = M.mul(sh, M.mul(M.rotZ(side * a[1]), M.rotX(-a[0])));
      set(gU, up);
      const fore = M.mul(up, M.mul(M.trans(0, -0.29, 0), M.rotX(-a[2])));
      set(gF, fore);
      const hand = M.mul(fore, M.trans(0, -0.27, 0));
      set(gH, hand);
      return M.xp(hand, [0, -0.07, 0]);
    };
    const hl = arm(-1, p.aL, 4, 5, 6), hr = arm(1, p.aR, 7, 8, 9);
    const leg = (side, l, gT, gS, gF) => {
      const hip = M.mul(root, M.trans(side * 0.095, -0.04, 0));
      const th = M.mul(hip, M.rotX(-l[0]));
      set(gT, th);
      const sh = M.mul(th, M.mul(M.trans(0, -0.44, 0), M.rotX(l[1])));
      set(gS, sh);
      const ft = M.mul(sh, M.mul(M.trans(0, -0.44, 0), M.rotX(l[0] - l[1])));
      set(gF, ft);
    };
    leg(-1, p.lL, 10, 11, 12); leg(1, p.lR, 13, 14, 15);
    return { handL: hl, handR: hr, head: M.xp(head, [0, 0.11, 0.05]), ear: M.xp(head, [-0.1, 0.1, 0.02]) };
  };

  // ---------- dog ----------
  F.dogDef = id => ({
    id, name: 'Biscuit', figure: 'dog', blobTone: 0.3,
    blob: { c: [0, 0.2, 0], e: [0.2, 0.16, 0.36], amp: 0.2 },
    parts: [
      EL([0, 0, 0], [0.14, 0.13, 0.3], P({ g: 1, tone: 0.34, tag: 'dog' })),
      EL([0, 0.02, 0.2], [0.13, 0.14, 0.13], P({ g: 1, tone: 0.34, tag: 'dog' })),
      EL([0, 0.03, 0.04], [0.1, 0.1, 0.11], P({ g: 2, tone: 0.34, tag: 'dog' })),
      EL([0, -0.01, 0.14], [0.055, 0.05, 0.075], P({ g: 2, tone: 0.3, tag: 'dog' })),
      EL([0, 0.01, 0.21], [0.02, 0.018, 0.018], P({ g: 2, tone: 0.9, appear: 3 })),
      EL([-0.085, 0.02, 0.0], [0.02, 0.085, 0.05], P({ g: 2, tone: 0.55, rot: [0.1, 0, 0.35] })),
      EL([0.085, 0.02, 0.0], [0.02, 0.085, 0.05], P({ g: 2, tone: 0.55, rot: [0.1, 0, -0.35] })),
      EL([-0.04, 0.05, 0.1], [0.012, 0.012, 0.01], P({ g: 2, tone: 0.95, appear: 3 })),
      EL([0.04, 0.05, 0.1], [0.012, 0.012, 0.01], P({ g: 2, tone: 0.95, appear: 3 })),
      EL([0, -0.12, 0], [0.034, 0.14, 0.038], P({ g: 3, tone: 0.34 })), EL([0, -0.25, 0.025], [0.038, 0.024, 0.05], P({ g: 3, tone: 0.34 })),
      EL([0, -0.12, 0], [0.034, 0.14, 0.038], P({ g: 4, tone: 0.34 })), EL([0, -0.25, 0.025], [0.038, 0.024, 0.05], P({ g: 4, tone: 0.34 })),
      EL([0, -0.12, 0], [0.04, 0.14, 0.045], P({ g: 5, tone: 0.34 })), EL([0, -0.25, 0.025], [0.038, 0.024, 0.05], P({ g: 5, tone: 0.34 })),
      EL([0, -0.12, 0], [0.04, 0.14, 0.045], P({ g: 6, tone: 0.34 })), EL([0, -0.25, 0.025], [0.038, 0.024, 0.05], P({ g: 6, tone: 0.34 })),
      EL([0, 0.08, -0.05], [0.024, 0.1, 0.024], P({ g: 7, tone: 0.4, rot: [-0.6, 0, 0] })),
    ],
    customStrokes: (stage, o, rnd, out) => {
      if (stage < 2) return;
      const rings = [[1, [0, 0, 0], [0.14, 0.13, 0.3]], [2, [0, 0.03, 0.04], [0.1, 0.1, 0.11]], [3, [0, -0.12, 0], [0.034, 0.14, 0.038]], [4, [0, -0.12, 0], [0.034, 0.14, 0.038]],
        [5, [0, -0.12, 0], [0.04, 0.14, 0.045]], [6, [0, -0.12, 0], [0.04, 0.14, 0.045]]];
      for (const [g, c, e] of rings) out.push({ pts: G.ringStroke(c, [e[0], 0, 0], [0, 0, e[2]], { over: 0.12, wob: 0.06 }, rnd), g, w: 0.8, d: 0.7 });
      if (stage === 3) {
        for (let i = 0; i < 5; i++) {
          const z = -0.22 + i * 0.1;
          out.push({ pts: [[-0.03, 0.12, z], [0, 0.132, z + 0.03], [0.03, 0.12, z + 0.05]], g: 1, w: 0.6, d: 0.6 });
        }
      }
    },
  });

  F.dogPose = (kind, t, wag) => {
    const q = { body: [0, 0.34, 0], bodyRot: [0, 0, 0], head: [0, 0.14, 0.33], hp: 0, hy: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], tail: 0.4, wag: wag || 0 };
    if (kind === 'lie') {
      q.body = [0, 0.14, 0]; q.head = [0.03, 0.05, 0.3]; q.hp = 0.25; q.hy = 0.25;
      q.legs = [[1.35, 0], [1.35, 0], [-1.4, 0], [-1.4, 0]]; q.tail = -0.2;
    } else if (kind === 'walk') {
      const s = Math.sin(t * 9), c = Math.cos(t * 9);
      q.legs = [[0.45 * s, 0], [-0.45 * s, 0], [-0.45 * s, 0], [0.45 * s, 0]];
      q.body[1] += Math.abs(c) * 0.015; q.hp = -0.1;
    } else if (kind === 'dance') {
      const s = Math.sin(t * 10);
      q.body = [0, 0.38 + Math.max(0, s) * 0.06, 0]; q.bodyRot = [-0.2 - Math.max(0, s) * 0.15, 0, 0];
      q.legs = [[0.7 + 0.3 * s, 0], [0.7 - 0.3 * s, 0], [0.1, 0], [0.1, 0]]; q.hp = -0.3; q.tail = 0.9;
    } else if (kind === 'sit') {
      q.body = [0, 0.3, 0.02]; q.bodyRot = [-0.55, 0, 0]; q.head = [0, 0.2, 0.3];
      q.legs = [[0.1, 0], [0.1, 0], [-1.2, 0], [-1.2, 0]]; q.tail = -0.3;
    }
    return q;
  };
  F.dogGroups = (q, out, time) => {
    const set = (g, m) => out.set(m, g * 16);
    const body = M.mul(M.trans(q.body[0], q.body[1], q.body[2]), M.mul(M.rotY(q.bodyRot[1]), M.rotX(q.bodyRot[0])));
    set(1, body);
    set(2, M.mul(body, M.mul(M.trans(q.head[0], q.head[1], q.head[2]), M.mul(M.rotY(q.hy), M.rotX(q.hp)))));
    const legPos = [[-0.08, -0.06, 0.2], [0.08, -0.06, 0.2], [-0.08, -0.06, -0.2], [0.08, -0.06, -0.2]];
    for (let i = 0; i < 4; i++) set(3 + i, M.mul(body, M.mul(M.trans(legPos[i][0], legPos[i][1], legPos[i][2]), M.rotX(-q.legs[i][0]))));
    set(7, M.mul(body, M.mul(M.trans(0, 0.06, -0.3), M.mul(M.rotY(Math.sin(time * 14) * 0.6 * q.wag), M.rotX(-q.tail)))));
  };
})();
