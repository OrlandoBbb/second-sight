'use strict';
// Building kit shared by every case: part shapes, wall runs with openings, window and door frames, floors and
// ceilings, and the furniture (each piece is a function of id and pose, so any flat can place it).
// World: x east, z south, y up (metres).
(function () {
  const G = WK.Geo, MAT = G.MAT;
  const K = WK.Kit = {};
  const PI = Math.PI;
  K.PI = PI;

  const B = K.B = (p, s, o) => Object.assign({ t: 'box', p, s }, o || {});
  const CY = K.CY = (p, rad, h, o) => Object.assign({ t: 'cyl', p, rad, h }, o || {});
  const EL = K.EL = (p, e, o) => Object.assign({ t: 'ell', p, e }, o || {});
  const fab = K.fab = (tone, o) => Object.assign({ mat: MAT.FABRIC, tone }, o || {});
  const wood = K.wood = (tone, o) => Object.assign({ mat: MAT.WOOD, tone }, o || {});
  const paint = K.paint = (tone, o) => Object.assign({ mat: MAT.PAINT, tone }, o || {});
  const metal = K.metal = (tone, o) => Object.assign({ mat: MAT.METAL, tone }, o || {});
  const appl = K.appl = (tone, o) => Object.assign({ mat: MAT.APPL, tone }, o || {});
  const col = K.col = o => Object.assign({ mat: MAT.COLOR }, o || {});
  const col2 = K.col2 = o => Object.assign({ mat: MAT.COLOR2 }, o || {});

  // Wall run with rectangular openings. axis 'x': runs along x at z = c; axis 'z': runs along z at x = c.
  K.wall = (axis, c, a, b, y0, y1, t, openings, o) => {
    const parts = [];
    const ops = (openings || []).slice().sort((p, q) => p.a - q.a);
    let cur = a;
    const mk = (u0, u1, v0, v1) => {
      if (u1 - u0 < 0.005 || v1 - v0 < 0.005) return;
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, lu = u1 - u0, lv = v1 - v0;
      const p = axis === 'x' ? [cu, cv, c] : [c, cv, cu];
      const s = axis === 'x' ? [lu, lv, t] : [t, lv, lu];
      parts.push(B(p, s, Object.assign({ mat: MAT.WALL, tone: 0.03, wall: true }, o || {})));
    };
    for (const op of ops) { mk(cur, op.a, y0, y1); mk(op.a, op.b, y0, op.y0); mk(op.a, op.b, op.y1, y1); cur = op.b; }
    mk(cur, b, y0, y1);
    return parts;
  };
  // Window frame for an opening (appears at stage 2, the cross bars at 3)
  K.windowFrame = (axis, c, a, b, y0, y1, inward) => {
    const p = [], w = 0.05, mid = (a + b) / 2, midy = (y0 + y1) / 2, d = 0.16;
    const P = (u, y, off) => axis === 'x' ? [u, y, c + off] : [c + off, y, u];
    const S = (lu, ly, ld) => axis === 'x' ? [lu, ly, ld] : [ld, ly, lu];
    const o = { mat: MAT.WOOD, tone: 0.08, appear: 2, nocol: true };
    p.push(B(P(mid, y0 - 0.025, inward * 0.05), S(b - a + 0.16, 0.05, d + 0.08), o));
    p.push(B(P(mid, y1 + 0.02, 0), S(b - a + 0.1, w, d), o));
    p.push(B(P(a - 0.02, midy, 0), S(w, y1 - y0, d), o));
    p.push(B(P(b + 0.02, midy, 0), S(w, y1 - y0, d), o));
    const o3 = Object.assign({}, o, { appear: 3 });
    p.push(B(P(mid, midy, 0), S(0.035, y1 - y0, 0.05), o3));
    p.push(B(P(mid, midy, 0), S(b - a, 0.035, 0.05), o3));
    return p;
  };
  K.doorFrame = (axis, c, a, b, h, o) => {
    const p = [], t = 0.06, d = 0.2;
    const P = (u, y) => axis === 'x' ? [u, y, c] : [c, y, u];
    const S = (lu, ly) => axis === 'x' ? [lu, ly, d] : [d, ly, lu];
    const oo = Object.assign({ mat: MAT.WOOD, tone: 0.1, appear: 2, nocol: true }, o || {});
    p.push(B(P(a - t / 2, (o && o.y0 || 0) + h / 2), S(t, h), oo));
    p.push(B(P(b + t / 2, (o && o.y0 || 0) + h / 2), S(t, h), oo));
    p.push(B(P((a + b) / 2, (o && o.y0 || 0) + h + t / 2), S(b - a + 2 * t, t), oo));
    return p;
  };
  K.floorBox = (x0, x1, z0, z1, y) => B([(x0 + x1) / 2, (y || 0) - 0.05, (z0 + z1) / 2], [x1 - x0, 0.1, z1 - z0], { mat: MAT.FLOOR, tone: 0.06, nocol: true, floor: true });
  K.ceilBox = (x0, x1, z0, z1, y) => B([(x0 + x1) / 2, y + 0.05, (z0 + z1) / 2], [x1 - x0, 0.1, z1 - z0], { mat: MAT.PAPER, tone: 0, nocol: true, ceil: true, nopick: true });
  K.skirting = (axis, c, a, b, y, side) => {
    const off = side * 0.012;
    return axis === 'x' ? B([(a + b) / 2, y + 0.05, c + off], [b - a, 0.1, 0.02], { mat: MAT.WOOD, tone: 0.06, appear: 3, nocol: true, nopick: true })
      : B([c + off, y + 0.05, (a + b) / 2], [0.02, 0.1, b - a], { mat: MAT.WOOD, tone: 0.06, appear: 3, nocol: true, nopick: true });
  };
  // a room: its floor box, its ceiling box and the wall runs it owns
  K.room = (id, name, x0, x1, z0, z1, walls, extra) => Object.assign({ id, name, room: true, blob: false, parts: [K.floorBox(x0, x1, z0, z1, 0)].concat(extra && extra.noCeil ? [] : [K.ceilBox(x0, x1, z0, z1, 2.6)], walls) }, extra || {});

  const at = (x, z, yaw) => ({ x, y: 0, z, yaw: yaw || 0 });
  const def = (id, name, x, z, yaw, o, rest) => Object.assign({ id, name, pose: at(x, z, yaw) }, rest, o || {});

  // ---------------- furniture ----------------
  K.frontDoor = (id, x, z, yaw, o) => def(id, 'the front door', x, z, yaw, o, {
    door: { g: 1, hinge: [-0.44, 0, 0], open: -1.6 }, blob: false,
    parts: [
      B([0, 1.01, 0], [0.88, 2.02, 0.05], wood(0.08, { g: 1, tag: 'door' })),
      CY([0.33, 1.3, 0.03], 0.022, 0.022, metal(0.4, { g: 1, appear: 2, rot: [PI / 2, 0, 0], tag: 'lock' })),
      CY([0.33, 1.14, 0.03], 0.022, 0.022, metal(0.4, { g: 1, appear: 2, rot: [PI / 2, 0, 0], tag: 'lock' })),
      B([0.33, 1.2, 0.05], [0.12, 0.022, 0.022], metal(0.3, { g: 1, appear: 2, tag: 'chain' })),
      B([0, 1.55, 0.028], [0.06, 0.06, 0.01], metal(0.6, { g: 1, appear: 3 })),
      B([0, 0.01, 0.5], [0.8, 0.02, 0.5], { mat: MAT.RUG, tone: 0.35, nocol: true, nopick: true }),
    ],
    detail: [{ k: 'rect', stage: 2, g: 1, c: [0, 1.1, 0.027], u: [0.3, 0, 0], v: [0, 0.2, 0] }, { k: 'rect', stage: 2, g: 1, c: [0, 0.4, 0.027], u: [0.3, 0, 0], v: [0, 0.26, 0] }],
    foot: [[0, 0, 0.46, 0.06]],
  });
  K.coatPegs = (id, x, z, yaw, o) => def(id, 'the coat pegs', x, z, yaw, o, {
    parts: [
      B([0, 1.65, 0.012], [0.8, 0.1, 0.024], wood(0.2)),
      B([-0.2, 1.25, 0.1], [0.36, 0.75, 0.12], fab(0.4, { bevel: 0.04 })),
      B([0, 0.08, 0.2], [0.7, 0.16, 0.32], wood(0.3, { appear: 3 })),
    ],
    foot: [[0, 0.2, 0.4, 0.2]],
  });
  K.hallTable = (id, x, z, yaw, o) => def(id, 'the hall table', x, z, yaw, o, {
    parts: [
      B([0, 0.75, 0], [0.6, 0.04, 0.32], wood(0.2)), ...[[-0.26, -0.12], [0.26, -0.12], [-0.26, 0.12], [0.26, 0.12]].map(([a, b]) => B([a, 0.37, b], [0.035, 0.74, 0.035], wood(0.3))),
      B([-0.08, 0.83, 0], [0.2, 0.08, 0.16], appl(0.3, { tag: 'phone', bevel: 0.02 })), B([-0.08, 0.9, -0.01], [0.2, 0.04, 0.05], appl(0.35, { tag: 'phone', bevel: 0.015, appear: 2 })),
      B([0.17, 0.78, 0.02], [0.14, 0.02, 0.2], paint(0.05, { appear: 3, tag: 'pad' })),
    ],
    foot: [[0, 0, 0.3, 0.16]],
  });
  K.keyHooks = (id, x, z, yaw, o) => def(id, 'the key hooks', x, z, yaw, o, {
    blob: false,
    parts: [
      B([0, 1.45, 0.01], [0.42, 0.12, 0.02], wood(0.2)),
      ...[-0.14, -0.05, 0.05, 0.14].map((a, i) => CY([a, 1.42, 0.035], 0.006, 0.05, metal(0.4, { rot: [PI / 2, 0, 0], appear: 2, tag: 'hook' + i }))),
      B([-0.14, 1.34, 0.03], [0.02, 0.06, 0.005], metal(0.45, { appear: 2, tag: 'key' })), B([0.05, 1.34, 0.03], [0.02, 0.06, 0.005], metal(0.45, { appear: 2, tag: 'key' })),
      ...[-0.14, -0.05, 0.05, 0.14].map(a => B([a, 1.49, 0.022], [0.07, 0.025, 0.004], paint(0.0, { appear: 3 }))),
    ],
  });
  K.counter = (id, x, z, yaw, len, o) => def(id, 'the counter', x, z, yaw, o, {
    parts: [
      B([0, 0.44, 0], [len, 0.88, 0.6], paint(0.06)),
      B([0, 0.9, 0.01], [len + 0.06, 0.04, 0.64], wood(0.16)),
      B([len * 0.23, 0.875, 0.02], [0.5, 0.02, 0.36], { mat: MAT.DARK, tone: 0.45, appear: 2, nocol: true, tag: 'sink' }),
      CY([-len * 0.23, 0.93, 0.0], 0.1, 0.02, metal(0.5, { appear: 3 })), CY([-len * 0.33, 0.93, 0.0], 0.08, 0.02, metal(0.5, { appear: 3 })),
      CY([len * 0.23, 1.0, -0.2], 0.014, 0.2, metal(0.3, { appear: 3, tag: 'sink' })),
      B([len * 0.23, 0.45, 0.305], [0.6, 0.7, 0.02], paint(0.1, { appear: 3, g: 1, tag: 'cupboard' })),
    ],
    detail: [
      { k: 'line', stage: 3, a: [-len * 0.25, 0.06, 0.301], b: [-len * 0.25, 0.84, 0.301] }, { k: 'line', stage: 3, a: [0.0, 0.06, 0.301], b: [0.0, 0.84, 0.301] },
      { k: 'line', stage: 3, a: [-len / 2 + 0.02, 0.7, 0.301], b: [len / 2 - 0.02, 0.7, 0.301] },
    ],
    foot: [[0, 0, len / 2 + 0.01, 0.31]],
  });
  K.fridge = (id, x, z, yaw, o) => def(id, 'the fridge', x, z, yaw, o, {
    door: { g: 1, hinge: [0.36, 0, 0.345], open: 1.8 },
    parts: [
      B([0, 0.925, -0.33], [0.72, 1.85, 0.04], appl(0.04)), B([-0.34, 0.925, 0], [0.04, 1.85, 0.66], appl(0.04)), B([0.34, 0.925, 0], [0.04, 1.85, 0.66], appl(0.04)),
      B([0, 1.83, 0], [0.72, 0.04, 0.66], appl(0.04)), B([0, 0.05, 0], [0.72, 0.1, 0.66], appl(0.08)),
      B([0, 0.6, -0.03], [0.64, 0.012, 0.58], appl(0.0, { appear: 2 })), B([0, 1.0, -0.03], [0.64, 0.012, 0.58], appl(0.0, { appear: 2 })),
      B([0, 1.13, 0.36], [0.72, 1.44, 0.05], appl(0.03, { g: 1, tag: 'door' })),
      B([0, 0.21, 0.36], [0.72, 0.36, 0.05], appl(0.05, { g: 2, tag: 'freezer' })),
      B([-0.3, 1.2, 0.41], [0.03, 0.5, 0.03], metal(0.3, { g: 1, appear: 2, tag: 'door' })),
      B([0, 0.36, 0.41], [0.4, 0.03, 0.03], metal(0.3, { g: 2, appear: 2, tag: 'freezer' })),
      B([0.06, 1.3, 0.386], [0.26, 0.2, 0.004], paint(0.0, { g: 1, appear: 3, tag: 'drawing' })),
    ],
    foot: [[0, 0, 0.36, 0.33]],
  });
  K.sash = (id, name, x, z, yaw, w, o) => def(id, name, x, z, yaw, o, {
    blob: false, door: { g: 1, hinge: [-w / 2, 0, 0.02], open: 0.9 },
    parts: [B([0, 1.5, 0.02], [w - 0.12, 0.98, 0.03], { mat: MAT.WOOD, tone: 0.05, g: 1, tag: 'sash' }), B([0, 0.98, 0.09], [w, 0.04, 0.16], wood(0.1, { tag: 'sill' }))],
    detail: [{ k: 'rect', stage: 2, g: 1, c: [0, 1.5, 0.04], u: [w / 2 - 0.1, 0, 0], v: [0, 0.43, 0] }, { k: 'dash', stage: 3, a: [-w / 2 + 0.2, 1.005, 0.12], b: [w / 2 - 0.2, 1.005, 0.12], n: 9 }],
  });
  K.pinRack = (id, x, z, yaw, o) => def(id, 'the rolling-pin rack', x, z, yaw, o, {
    parts: [
      B([0, 1.45, 0.01], [0.5, 0.12, 0.02], wood(0.25)),
      CY([0.15, 1.3, 0.09], 0.028, 0.34, paint(0.08, { rot: [0, 0, PI / 2], tag: 'pin' })), CY([-0.15, 1.3, 0.09], 0.028, 0.34, paint(0.08, { rot: [0, 0, PI / 2], tag: 'pin' })),
    ],
  });
  K.kitchenTable = (id, x, z, yaw, o) => def(id, 'the kitchen table', x, z, yaw, o, {
    parts: [
      B([0, 0.74, 0], [1.1, 0.04, 0.8], wood(0.2, { bevel: 0.01 })),
      ...[[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]].map(([a, b]) => B([a, 0.36, b], [0.05, 0.72, 0.05], wood(0.3))),
      B([-0.25, 0.46, 0.62], [0.42, 0.04, 0.4], wood(0.25, { tag: 'chair' })), B([-0.25, 0.7, 0.8], [0.42, 0.46, 0.04], wood(0.25, { tag: 'chair' })),
      B([0.25, 0.46, -0.62], [0.42, 0.04, 0.4], wood(0.25, { tag: 'chair' })), B([0.25, 0.7, -0.8], [0.42, 0.46, 0.04], wood(0.25, { tag: 'chair' })),
      CY([-0.2, 0.81, 0.1], 0.04, 0.1, paint(0.1, { appear: 3, tag: 'mug' })), CY([0.22, 0.81, -0.12], 0.04, 0.1, paint(0.3, { appear: 3, tag: 'mug' })),
    ],
    foot: [[0, 0, 0.56, 0.41], [-0.25, 0.65, 0.23, 0.22], [0.25, -0.65, 0.23, 0.22]],
  });
  K.bin = (id, x, z, yaw, o) => def(id, 'the bin', x, z, yaw, o, {
    parts: [CY([0, 0.33, 0], 0.17, 0.66, metal(0.25, { taper: 0.95 })), CY([0, 0.68, 0], 0.18, 0.04, metal(0.35, { appear: 2, g: 1 }))],
    foot: [[0, 0, 0.18, 0.18]],
  });
  K.toilet = (id, x, z, yaw, o) => def(id, 'the toilet', x, z, yaw, o, {
    parts: [
      CY([0, 0.2, 0.12], 0.19, 0.4, appl(0.04, { taper: 0.8 })), B([0, 0.42, 0.14], [0.38, 0.05, 0.46], appl(0.03, { bevel: 0.02 })),
      B([0, 0.66, -0.2], [0.44, 0.42, 0.18], appl(0.05, { bevel: 0.02, tag: 'cistern' })), B([0, 0.89, -0.2], [0.46, 0.04, 0.2], appl(0.02, { bevel: 0.01, g: 1, tag: 'cistern' })),
    ],
    foot: [[0, 0, 0.23, 0.36]],
  });
  K.basin = (id, x, z, yaw, o) => def(id, 'the sink', x, z, yaw, o, {
    parts: [
      CY([0, 0.4, -0.06], 0.08, 0.8, appl(0.05)), B([0, 0.84, 0], [0.56, 0.12, 0.42], appl(0.04, { bevel: 0.03 })),
      CY([0, 0.97, -0.16], 0.014, 0.14, metal(0.3, { appear: 3 })), CY([0.2, 0.96, -0.12], 0.035, 0.1, paint(0.15, { tag: 'cup' })),
      CY([0.19, 1.04, -0.12], 0.006, 0.16, paint(0.4, { rot: [0.2, 0, 0.1], tag: 'toothbrush' })),
      B([0, 1.5, -0.2], [0.5, 0.6, 0.03], { mat: MAT.DARK, tone: 0.2, appear: 2, tag: 'mirror' }),
    ],
    foot: [[0, 0, 0.28, 0.21]],
  });
  K.bath = (id, x, z, yaw, o) => def(id, 'the bath', x, z, yaw, o, {
    parts: [B([0, 0.28, 0], [0.7, 0.56, 1.5], appl(0.05, { bevel: 0.05 })), B([0, 0.5, 0], [0.56, 0.1, 1.34], { mat: MAT.DARK, tone: 0.2, appear: 2 })],
    foot: [[0, 0, 0.35, 0.75]],
  });
  K.sofa = (id, x, z, yaw, o) => def(id, 'the couch', x, z, yaw, o, {
    blobTone: 0.2,
    parts: [
      B([0, 0.2, 0.02], [2.0, 0.24, 0.86], fab(0.34, { bevel: 0.03 })),
      B([0, 0.6, -0.34], [2.0, 0.58, 0.2], fab(0.34, { bevel: 0.07, rough: { p: [0, 0.58, -0.32], s: [2.04, 0.66, 0.26] } })),
      B([-0.93, 0.47, 0.02], [0.2, 0.36, 0.86], fab(0.34, { bevel: 0.08 })), B([0.93, 0.47, 0.02], [0.2, 0.36, 0.86], fab(0.34, { bevel: 0.08 })),
      B([-0.42, 0.39, 0.08], [0.82, 0.14, 0.7], fab(0.26, { bevel: 0.05, g: 1, tag: 'cushion1' })),
      B([0.42, 0.39, 0.08], [0.82, 0.14, 0.7], fab(0.26, { bevel: 0.05, g: 2, tag: 'cushion2' })),
      B([-0.42, 0.67, -0.19], [0.8, 0.38, 0.15], fab(0.3, { bevel: 0.07, appear: 3 })), B([0.42, 0.67, -0.19], [0.8, 0.38, 0.15], fab(0.3, { bevel: 0.07, appear: 3 })),
    ],
    search: { g: 1, pivot: [-0.42, 0.32, -0.27], rot: [-0.55, 0, 0], at: [-0.42, 0.45, 0.2] },
    foot: [[0, 0, 1.02, 0.46]],
  });
  K.coffeeTable = (id, x, z, yaw, o) => def(id, 'the coffee table', x, z, yaw, o, {
    parts: [
      B([0, 0.4, 0], [1.0, 0.045, 0.55], wood(0.28, { bevel: 0.01 })),
      ...[[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]].map(([a, b]) => B([a, 0.19, b], [0.05, 0.38, 0.05], wood(0.4))),
      CY([-0.2, 0.47, 0.05], 0.035, 0.1, paint(0.02, { tag: 'glass' })), CY([0.15, 0.47, -0.08], 0.035, 0.1, paint(0.12, { tag: 'glass' })),
    ],
    detail: [{ k: 'ring', stage: 3, c: [0.15, 0.523, -0.08], u: [0.028, 0, 0], v: [0, 0, 0.028] }],
    foot: [[0, 0, 0.52, 0.29]],
  });
  K.rug = (id, x, z, yaw, w, d, o) => def(id, 'the rug', x, z, yaw, o, {
    blob: false, noGround: true,
    parts: [B([0, 0.005, 0], [w, 0.01, d], { mat: MAT.RUG, tone: 0.2, nocol: true, tag: 'rug' })],
    detail: [{ k: 'dash', stage: 3, a: [-w / 2 + 0.02, 0.012, -d / 2 + 0.02], b: [w / 2 - 0.02, 0.012, -d / 2 + 0.02], n: 14 }, { k: 'dash', stage: 3, a: [-w / 2 + 0.02, 0.012, d / 2 - 0.02], b: [w / 2 - 0.02, 0.012, d / 2 - 0.02], n: 14 }],
  });
  K.piano = (id, x, z, yaw, o) => def(id, 'the piano', x, z, yaw, o, {
    parts: [
      B([0, 0.66, -0.05], [1.45, 1.32, 0.52], wood(0.45)), B([0, 0.72, 0.29], [1.4, 0.06, 0.26], wood(0.42)),
      B([0, 0.765, 0.28], [1.3, 0.03, 0.2], paint(0.0, { appear: 2, tag: 'keys' })),
      B([0, 1.33, -0.05], [1.47, 0.04, 0.54], wood(0.4, { tag: 'lid' })), B([0, 1.0, 0.22], [1.3, 0.34, 0.02], wood(0.3, { appear: 3 })),
      B([0, 0.47, 0.72], [0.9, 0.05, 0.35], wood(0.35, { appear: 2, tag: 'stool', g: 1 })), B([0, 0.4, 0.72], [0.86, 0.1, 0.31], wood(0.3, { appear: 2, tag: 'stool' })),
      ...[[-0.4, 0.58], [0.4, 0.58], [-0.4, 0.86], [0.4, 0.86]].map(([a, b]) => B([a, 0.2, b], [0.04, 0.4, 0.04], wood(0.4, { appear: 3 }))),
    ],
    detail: (() => { const d = []; for (let i = 0; i < 22; i++) { const xx = -0.63 + i * 0.06; d.push({ k: 'line', stage: 3, a: [xx, 0.781, 0.2], b: [xx, 0.781, 0.37], w: 0.6 }); } return d; })(),
    search: { g: 1, pivot: [0, 0.495, 0.56], rot: [-1.1, 0, 0], at: [0, 0.45, 0.72] },
    foot: [[0, -0.05, 0.73, 0.28], [0, 0.72, 0.46, 0.18]],
  });
  // Bookcase with two brass owl bookends on the middle shelf (group 1 = the left owl, turned the wrong way in case 1)
  K.bookcase = (id, x, z, yaw, o) => def(id, 'the bookcase', x, z, yaw, o, {
    parts: (() => {
      const p = [B([-0.68, 1.0, 0], [0.03, 2.0, 0.34], wood(0.3)), B([0.68, 1.0, 0], [0.03, 2.0, 0.34], wood(0.3)), B([0, 1.0, -0.16], [1.36, 2.0, 0.02], wood(0.4, { tag: 'back' }))];
      for (const y of [0.02, 0.45, 0.9, 1.35, 1.985]) p.push(B([0, y, 0], [1.36, 0.03, 0.34], wood(0.25)));
      const r = WK.U.rng(21);
      for (const y of [0.04, 0.47, 0.92, 1.37]) {
        let xx = y === 0.92 ? -0.5 : -0.62;
        while (xx < (y === 0.92 ? 0.45 : 0.6)) {
          const w = 0.025 + r() * 0.035, h = 0.22 + r() * 0.14;
          p.push(B([xx + w / 2, y + 0.015 + h / 2, 0.02], [w, h, 0.22], paint(0.15 + r() * 0.45, { appear: 3 })));
          xx += w + 0.003;
        }
      }
      p.push(B([0.55, 1.0, 0.02], [0.08, 0.14, 0.14], metal(0.35, { tag: 'bookend', bevel: 0.02 })));
      p.push(EL([0.55, 1.1, 0.03], [0.045, 0.05, 0.045], metal(0.35, { tag: 'bookend' })));
      p.push(EL([0.53, 1.12, 0.07], [0.012, 0.012, 0.006], metal(0.6, { tag: 'bookend', appear: 3 })));
      p.push(B([-0.6, 1.0, 0.02], [0.08, 0.14, 0.14], metal(0.35, { tag: 'bookend', bevel: 0.02, g: 1 })));
      p.push(EL([-0.6, 1.1, 0.03], [0.045, 0.05, 0.045], metal(0.35, { tag: 'bookend', g: 1 })));
      p.push(EL([-0.58, 1.12, 0.07], [0.012, 0.012, 0.006], metal(0.6, { tag: 'bookend', g: 1, appear: 3 })));
      return p;
    })(),
    foot: [[0, 0, 0.7, 0.18]],
  });
  K.armchair = (id, x, z, yaw, o) => def(id, 'the armchair', x, z, yaw, o, {
    parts: [
      B([0, 0.2, 0.03], [0.84, 0.24, 0.78], fab(0.4, { bevel: 0.03 })), B([0, 0.66, -0.33], [0.84, 0.72, 0.18], fab(0.4, { bevel: 0.07 })),
      B([-0.37, 0.46, 0.03], [0.14, 0.32, 0.78], fab(0.4, { bevel: 0.06 })), B([0.37, 0.46, 0.03], [0.14, 0.32, 0.78], fab(0.4, { bevel: 0.06 })),
      B([0, 0.38, 0.08], [0.58, 0.13, 0.62], fab(0.3, { bevel: 0.05, g: 1, tag: 'cushion' })),
    ],
    search: { g: 1, pivot: [0, 0.32, -0.2], rot: [-0.5, 0, 0], at: [0, 0.3, 0.3] },
    foot: [[0, 0, 0.44, 0.44]],
  });
  K.bed = (id, x, z, yaw, w, o) => def(id, 'the bed', x, z, yaw, o, {
    blobTone: 0.08,
    parts: [
      B([0, 0.17, 0], [w + 0.06, 0.22, 2.06], wood(0.25)), B([0, 0.37, 0], [w, 0.2, 2.0], fab(0.02, { bevel: 0.05 })),
      B([0, 0.49, 0.18], [w + 0.04, 0.1, 1.62], fab(0.1, { bevel: 0.05, g: 1, tag: 'duvet', rough: { s: [w + 0.08, 0.14, 1.7] } })),
      B([-w * 0.24, 0.53, -0.78], [w * 0.41, 0.12, 0.36], fab(0.02, { bevel: 0.06 })), B([w * 0.24, 0.53, -0.78], [w * 0.41, 0.12, 0.36], fab(0.02, { bevel: 0.06 })),
      B([0, 0.62, -1.04], [w + 0.12, 1.0, 0.07], wood(0.22)),
    ],
    search: { g: 1, pivot: [0, 0.5, 1.0], rot: [0.6, 0, 0], at: [0, 0.5, 0.3] },
    foot: [[0, 0, w / 2 + 0.04, 1.04]],
  });
  K.wardrobe = (id, x, z, yaw, o) => def(id, 'the wardrobe', x, z, yaw, o, {
    parts: [B([0, 1.0, 0], [1.3, 2.0, 0.6], wood(0.2)), B([0.33, 1.0, 0.31], [0.63, 1.94, 0.02], wood(0.18, { g: 1, tag: 'door', appear: 2 })), B([0.07, 1.1, 0.33], [0.02, 0.12, 0.03], metal(0.4, { appear: 3, g: 1 }))],
    detail: [{ k: 'line', stage: 2, a: [0, 0.05, 0.302], b: [0, 1.95, 0.302] }],
    search: { g: 1, pivot: [0.645, 1.0, 0.31], rot: [0, -1.2, 0], at: [0.3, 1.1, 0.2] },
    foot: [[0, 0, 0.66, 0.31]],
  });
  K.nightstand = (id, x, z, yaw, o) => def(id, 'the bedside table', x, z, yaw, o, {
    parts: [
      B([0, 0.25, 0], [0.45, 0.5, 0.4], wood(0.22)), B([0, 0.36, 0.2], [0.4, 0.14, 0.02], wood(0.18, { g: 1, tag: 'drawer', appear: 2 })),
      CY([0.08, 0.58, 0], 0.05, 0.14, paint(0.15, { appear: 3 })), CY([0.08, 0.72, 0], 0.13, 0.16, fab(0.04, { taper: 0.6, appear: 2 })),
    ],
    search: { g: 1, trans: [0, 0, 0.22], at: [0, 0.4, 0.25] },
    foot: [[0, 0, 0.23, 0.21]],
  });
  K.innerDoor = (id, name, x, z, yaw, o) => def(id, name, x, z, yaw, o, {
    door: { g: 1, hinge: [-0.43, 0, 0], open: -1.35 }, blob: false,
    parts: [B([0, 1.01, 0], [0.86, 2.02, 0.04], wood(0.1, { g: 1, tag: 'door' })), CY([0.34, 1.0, 0.04], 0.022, 0.05, metal(0.35, { g: 1, rot: [PI / 2, 0, 0], appear: 2 }))],
  });
  K.boxes = (id, x, z, yaw, o) => def(id, 'the boxes', x, z, yaw, o, {
    parts: [
      B([-0.3, 0.25, 0], [0.55, 0.5, 0.45], paint(0.22, { g: 1 })), B([0.3, 0.22, 0.02], [0.5, 0.44, 0.42], paint(0.26, { g: 1 })),
      B([-0.25, 0.72, 0.02], [0.48, 0.44, 0.4], paint(0.2, { g: 1 })), B([0.25, 0.62, 0], [0.4, 0.36, 0.38], paint(0.3, { g: 1 })),
      B([0, 1.05, 0.0], [0.42, 0.24, 0.34], paint(0.24, { g: 1, appear: 2 })),
    ],
    detail: [{ k: 'line', stage: 3, a: [-0.57, 0.5, 0.226], b: [-0.03, 0.5, 0.226], g: 1 }, { k: 'line', stage: 3, a: [-0.49, 0.94, 0.221], b: [-0.01, 0.94, 0.221], g: 1 }],
    search: { g: 1, trans: [0.75, 0, 0.35], at: [0, 0.6, 0] },
    foot: [[0, 0, 0.6, 0.25]],
  });
  K.campBed = (id, x, z, yaw, o) => def(id, 'a camp bed', x, z, yaw, o, {
    parts: [
      B([0, 0.3, 0], [0.7, 0.05, 1.8], fab(0.3)), ...[[-0.33, -0.8], [0.33, -0.8], [-0.33, 0.8], [0.33, 0.8]].map(([a, b]) => B([a, 0.15, b], [0.03, 0.3, 0.03], metal(0.4))),
      B([0, 0.37, 0.1], [0.62, 0.1, 1.5], fab(0.45, { bevel: 0.04, tag: 'sleepingbag' })), B([0, 0.4, -0.72], [0.4, 0.1, 0.26], fab(0.05, { bevel: 0.05 })),
      B([0.55, 0.2, -0.5], [0.4, 0.4, 0.3], fab(0.5, { tag: 'bag', bevel: 0.06, appear: 3 })),
    ],
    foot: [[0, 0, 0.36, 0.9]],
  });
  K.tvUnit = (id, x, z, yaw, o) => def(id, 'the television', x, z, yaw, o, {
    parts: [B([0, 0.25, 0], [1.2, 0.5, 0.42], wood(0.3)), B([0, 0.82, -0.05], [0.9, 0.55, 0.06], { mat: MAT.DARK, tone: 0.5 }), B([0, 0.53, -0.05], [0.25, 0.06, 0.15], metal(0.4, { appear: 2 }))],
    foot: [[0, 0, 0.6, 0.21]],
  });
  K.sideboard = (id, x, z, yaw, o) => def(id, 'the sideboard', x, z, yaw, o, {
    parts: [
      B([0, 0.42, 0], [1.5, 0.84, 0.45], wood(0.28)), B([-0.38, 0.45, 0.23], [0.72, 0.7, 0.02], wood(0.24, { g: 1, appear: 2, tag: 'drawer' })),
      B([-0.45, 0.98, 0], [0.18, 0.24, 0.03], paint(0.2, { appear: 3, tag: 'photo' })), B([0.1, 0.96, 0.02], [0.14, 0.2, 0.03], paint(0.3, { appear: 3, tag: 'photo' })),
      CY([0.5, 0.95, 0], 0.08, 0.22, paint(0.12, { appear: 2, taper: 0.7 })),
    ],
    search: { g: 1, trans: [0, 0, 0.25], at: [-0.38, 0.5, 0.3] },
    foot: [[0, 0, 0.76, 0.23]],
  });
  K.singleBed = (id, x, z, yaw, o) => K.bed(id, x, z, yaw, 0.9, Object.assign({ name: 'the single bed' }, o || {}));
  K.dressingTable = (id, x, z, yaw, o) => def(id, 'the dressing table', x, z, yaw, o, {
    parts: [
      B([0, 0.72, 0], [1.0, 0.04, 0.42], wood(0.2)), B([-0.46, 0.35, 0], [0.05, 0.7, 0.4], wood(0.25)), B([0.46, 0.35, 0], [0.05, 0.7, 0.4], wood(0.25)),
      B([0, 0.64, 0.2], [0.86, 0.1, 0.02], wood(0.22, { g: 1, appear: 2, tag: 'drawer' })), B([0, 1.2, -0.18], [0.6, 0.8, 0.03], { mat: MAT.DARK, tone: 0.2, appear: 2, tag: 'mirror' }),
      B([0.3, 0.8, 0.02], [0.14, 0.12, 0.02], paint(0.3, { appear: 3, tag: 'photo' })),
    ],
    search: { g: 1, trans: [0, 0, 0.22], at: [0, 0.66, 0.25] },
    foot: [[0, 0, 0.5, 0.21]],
  });
  K.plantPot = (id, x, z, yaw, o) => def(id, 'the plant pot', x, z, yaw, o, {
    parts: [CY([0, 0.2, 0], 0.18, 0.4, paint(0.35, { taper: 0.8 })), EL([0, 0.62, 0], [0.24, 0.3, 0.24], fab(0.2, { appear: 2 })), CY([0, 0.39, 0], 0.16, 0.02, fab(0.55, { appear: 3, tag: 'soil', g: 1 }))],
    search: { g: 1, trans: [0, 0.06, 0], at: [0, 0.42, 0] },
    foot: [[0, 0, 0.2, 0.2]],
  });
  K.chair = (id, x, z, yaw, o) => def(id, 'the chair', x, z, yaw, o, {
    parts: [B([0, 0.45, 0], [0.44, 0.04, 0.42], wood(0.25)), B([0, 0.72, -0.2], [0.44, 0.52, 0.04], wood(0.25)), ...[[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].map(([a, b]) => B([a, 0.22, b], [0.035, 0.44, 0.035], wood(0.35, { appear: 2 })))],
    foot: [[0, 0, 0.22, 0.22]],
  });
  K.calendar = (id, x, z, yaw, o) => def(id, 'the calendar', x, z, yaw, o, {
    blob: false, parts: [B([0, 1.5, 0.006], [0.32, 0.44, 0.012], paint(0.0, { tag: 'calendar' })), B([0, 1.74, 0.01], [0.1, 0.04, 0.02], metal(0.4, { appear: 2 }))],
    detail: [{ k: 'rect', stage: 3, c: [0, 1.44, 0.014], u: [0.13, 0, 0], v: [0, 0.14, 0] }, { k: 'line', stage: 3, a: [-0.13, 1.5, 0.014], b: [0.13, 1.5, 0.014] }, { k: 'line', stage: 3, a: [-0.13, 1.38, 0.014], b: [0.13, 1.38, 0.014] }],
  });
  K.radiator = (id, x, z, yaw, w, o) => def(id, 'the radiator', x, z, yaw, o, { blob: false, parts: [B([0, 0.45, 0.05], [w, 0.6, 0.08], metal(0.12))], detail: [{ k: 'dash', stage: 3, a: [-w / 2 + 0.05, 0.45, 0.095], b: [w / 2 - 0.05, 0.45, 0.095], n: Math.round(w * 12) }] });

  // Small things found by searching (drawn in colour), and memory-ink visions (what was there that night)
  K.item = (id, name, x, y, z, yaw, parts, o) => Object.assign({ id, name, item: true, hidden: true, blob: false, pose: { x, y, z, yaw: yaw || 0 }, parts }, o || {});
  K.vision = (id, name, x, y, z, yaw, parts, o) => Object.assign({ id, name, vision: true, hidden: true, blob: false, pose: { x, y, z, yaw: yaw || 0 }, parts }, o || {});
  K.paperBits = {
    ticket: () => [B([0, 0.004, 0], [0.09, 0.006, 0.05], col()), B([-0.02, 0.008, 0], [0.03, 0.002, 0.03], col2())],
    note: () => [B([0, 0.004, 0], [0.15, 0.004, 0.2], col()), B([0, 0.007, -0.03], [0.1, 0.002, 0.004], col2()), B([0, 0.007, 0.0], [0.11, 0.002, 0.004], col2())],
    photo: () => [B([0, 0.004, 0], [0.12, 0.004, 0.16], col()), EL([-0.025, 0.007, -0.02], [0.02, 0.002, 0.025], col2()), EL([0.03, 0.007, -0.02], [0.02, 0.002, 0.025], col2())],
    diary: () => [B([0, 0.02, 0], [0.16, 0.04, 0.22], col()), B([0.075, 0.021, 0], [0.012, 0.042, 0.22], col2())],
    butt: () => [CY([0, 0.01, 0], 0.005, 0.035, col({ rot: [0, 0, PI / 2] })), CY([0.022, 0.01, 0], 0.0055, 0.012, col2({ rot: [0, 0, PI / 2] }))],
    glasses: () => [EL([-0.035, 0.012, 0], [0.028, 0.005, 0.022], col2()), EL([0.035, 0.012, 0], [0.028, 0.005, 0.022], col2()), B([0, 0.012, -0.02], [0.02, 0.004, 0.004], col())],
  };
})();
