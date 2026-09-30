'use strict';
// Geometry: every drawable object is built from parts in three versions (fine, rough, blob) so the shader can
// morph a loose blob into rough masses and then into the finished form. Also builds the pencil strokes.
(function () {
  const U = WK.U, V = WK.V, M = WK.M;
  const G = WK.Geo = {};
  const MAT = G.MAT = { PAINT: 0, FABRIC: 1, WOOD: 2, APPL: 3, FLOOR: 4, WALL: 5, DARK: 6, RUG: 7, COLOR: 8, PAPER: 9, METAL: 10, GLASS: 11, LEAF: 12, SKIN: 13, COLOR2: 14 };

  // ---------- primitive meshes (sized, local) ----------
  function axisCoords(h, b, n) {
    const out = [];
    if (b > 0.0005) {
      out.push(-h, -h + b * 0.38, -h + b);
      for (let i = 1; i < n; i++) out.push(-h + b + (2 * h - 2 * b) * i / n);
      out.push(h - b, h - b * 0.38, h);
    } else for (let i = 0; i <= n; i++) out.push(-h + 2 * h * i / n);
    return out;
  }
  function boxMesh(s, bevel, counts) {
    const h = [s[0] / 2, s[1] / 2, s[2] / 2];
    const b = Math.max(0, Math.min(bevel || 0, h[0] * 0.95, h[1] * 0.95, h[2] * 0.95));
    const cs = [axisCoords(h[0], b, counts[0]), axisCoords(h[1], b, counts[1]), axisCoords(h[2], b, counts[2])];
    const P = [], N = [], I = [];
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const ua = axis === 0 ? 2 : 0, va = axis === 1 ? 2 : 1;
      const cu = cs[ua], cv = cs[va], W = cu.length, base = P.length / 3;
      for (let j = 0; j < cv.length; j++) for (let i = 0; i < W; i++) {
        const p = [0, 0, 0]; p[axis] = sign * h[axis]; p[ua] = cu[i]; p[va] = cv[j];
        let q = p, n = [0, 0, 0]; n[axis] = sign;
        if (b > 0.0005) {
          const inner = [U.clamp(p[0], -h[0] + b, h[0] - b), U.clamp(p[1], -h[1] + b, h[1] - b), U.clamp(p[2], -h[2] + b, h[2] - b)];
          const d = V.sub(p, inner), dl = V.len(d);
          if (dl > 1e-7) { n = V.mul(d, 1 / dl); q = V.madd(inner, n, b); }
        }
        P.push(q[0], q[1], q[2]); N.push(n[0], n[1], n[2]);
      }
      const flip = (axis === 2 ? 1 : -1) * sign < 0;
      for (let j = 0; j < cv.length - 1; j++) for (let i = 0; i < W - 1; i++) {
        const a = base + j * W + i, c = a + W;
        if (!flip) I.push(a, a + 1, c + 1, a, c + 1, c); else I.push(a, c + 1, a + 1, a, c, c + 1);
      }
    }
    return { p: P, n: N, i: I };
  }
  function cylMesh(r, h, seg, taper, rings) {
    taper = taper === undefined ? 1 : taper; rings = rings || 1;
    const P = [], N = [], I = [];
    const rt = r * taper, slope = (r - rt) / h;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, y = -h / 2 + h * t, rr = r + (rt - r) * t;
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        P.push(c * rr, y, s * rr);
        const n = V.norm([c, slope, s]); N.push(n[0], n[1], n[2]);
      }
    }
    const W = seg + 1;
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * W + i, c = a + W; I.push(a, c, a + 1, a + 1, c, c + 1); }
    for (const top of [0, 1]) {
      const y = top ? h / 2 : -h / 2, rr = top ? rt : r, ny = top ? 1 : -1;
      if (rr < 1e-5) continue;
      const c0 = P.length / 3; P.push(0, y, 0); N.push(0, ny, 0);
      for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; P.push(Math.cos(a) * rr, y, Math.sin(a) * rr); N.push(0, ny, 0); }
      for (let i = 0; i < seg; i++) { if (top) I.push(c0, c0 + 2 + i, c0 + 1 + i); else I.push(c0, c0 + 1 + i, c0 + 2 + i); }
    }
    return { p: P, n: N, i: I };
  }
  function ellMesh(e, seg, rings) {
    const P = [], N = [], I = [];
    for (let j = 0; j <= rings; j++) {
      const th = j / rings * Math.PI, sy = Math.cos(th), sr = Math.sin(th);
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, x = Math.cos(a) * sr, z = Math.sin(a) * sr;
        P.push(x * e[0], sy * e[1], z * e[2]);
        const n = V.norm([x / e[0], sy / e[1], z / e[2]]); N.push(n[0], n[1], n[2]);
      }
    }
    const W = seg + 1;
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * W + i, c = a + W; I.push(a, a + 1, c, a + 1, c + 1, c); }
    return { p: P, n: N, i: I };
  }
  function torusMesh(R, r, seg, sides) {
    const P = [], N = [], I = [];
    for (let j = 0; j <= seg; j++) {
      const u = j / seg * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
      for (let i = 0; i <= sides; i++) {
        const v = i / sides * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
        const n = [cv * cu, sv, cv * su];
        P.push(cu * R + n[0] * r, n[1] * r, su * R + n[2] * r); N.push(n[0], n[1], n[2]);
      }
    }
    const W = sides + 1;
    for (let j = 0; j < seg; j++) for (let i = 0; i < sides; i++) { const a = j * W + i; I.push(a, a + 1, a + W, a + 1, a + W + 1, a + W); }
    return { p: P, n: N, i: I };
  }
  function tubeMesh(pts, r, sides) {
    const P = [], N = [], I = [];
    const n = pts.length;
    const tan = i => V.norm(V.sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    let nrm = V.perp(tan(0));
    for (let i = 0; i < n; i++) {
      const t = tan(i);
      nrm = V.norm(V.sub(nrm, V.mul(t, V.dot(nrm, t))));
      const bin = V.cross(t, nrm);
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * Math.PI * 2, d = V.add(V.mul(nrm, Math.cos(a)), V.mul(bin, Math.sin(a)));
        const p = V.madd(pts[i], d, r);
        P.push(p[0], p[1], p[2]); N.push(d[0], d[1], d[2]);
      }
    }
    const W = sides + 1;
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) { const a = i * W + k; I.push(a, a + 1, a + W, a + 1, a + W + 1, a + W); }
    return { p: P, n: N, i: I };
  }
  function boxCounts(s) { return [Math.max(1, Math.round(s[0] / 0.26)), Math.max(1, Math.round(s[1] / 0.26)), Math.max(1, Math.round(s[2] / 0.26))]; }
  function partMesh(d, counts) {
    switch (d.t) {
      case 'box': return boxMesh(d.s, d.bevel || 0, counts || boxCounts(d.s));
      case 'cyl': return cylMesh(d.rad, d.h, d.seg || 14, d.taper, d.rings || 1);
      case 'ell': return ellMesh(d.e, d.seg || 16, d.rings || 10);
      case 'torus': return torusMesh(d.R, d.rad, d.seg || 20, d.sides || 8);
      case 'tube': return tubeMesh(d.pts, d.rad, d.sides || 6);
    }
    throw new Error('unknown part type ' + d.t);
  }
  function partHalf(d) {
    switch (d.t) {
      case 'box': return V.mul(d.s, 0.5);
      case 'cyl': return [d.rad, d.h / 2, d.rad];
      case 'ell': return d.e.slice();
      case 'torus': return [d.R + d.rad, d.rad, d.R + d.rad];
      case 'tube': {
        let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
        for (const p of d.pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
        return [(hi[0] - lo[0]) / 2 + d.rad, (hi[1] - lo[1]) / 2 + d.rad, (hi[2] - lo[2]) / 2 + d.rad];
      }
    }
    return [0.1, 0.1, 0.1];
  }
  function partCenter(d) {
    if (d.t !== 'tube') return d.p || [0, 0, 0];
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of d.pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    return V.add(d.p || [0, 0, 0], [(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, (hi[2] + lo[2]) / 2]);
  }
  G.partHalf = partHalf;

  // ---------- blobs ----------
  // A blob is a sheet thrown over the thing: a squarish footprint, a flat hem on the floor, a rounded top.
  // Superquadric in the blob's unit box: (|x|^M + |z|^M)^(N/M) + |y|^N = 1, N soft on top, near-flat below.
  const DR_M = 4.2, DR_TOP = 2.4, DR_BOT = 7.0;
  function drapeK(d) {
    const n = d[1] >= 0 ? DR_TOP : DR_BOT;
    const S = Math.pow(Math.abs(d[0]), DR_M) + Math.pow(Math.abs(d[2]), DR_M);
    const F = Math.pow(Math.max(S, 1e-9), n / DR_M) + Math.pow(Math.abs(d[1]), n);
    return Math.pow(Math.max(F, 1e-9), -1 / n);
  }
  G.blobPoint = (b, dir) => {
    const k = drapeK(dir);
    let q = [dir[0] * k, dir[1] * k, dir[2] * k];
    // lumpy on top and sides, the hem stays on the floor and pools out a little
    const lump = 1 + b.amp * 0.7 * (U.noise3(dir[0] * 1.9 + b.seed, dir[1] * 1.9 + b.seed * 0.3, dir[2] * 1.9) - 0.5) * 2 * U.smooth(-0.75, -0.2, q[1]);
    const pool = 1 + 0.07 * U.smooth(-0.55, -0.98, q[1]);
    q = [q[0] * lump * pool, q[1] < 0 ? q[1] : q[1] * lump, q[2] * lump * pool];
    return [b.c[0] + q[0] * b.e[0], b.c[1] + q[1] * b.e[1], b.c[2] + q[2] * b.e[2]];
  };
  G.blobDir = (b, p) => {
    const d = [(p[0] - b.c[0]) / b.e[0], (p[1] - b.c[1]) / b.e[1], (p[2] - b.c[2]) / b.e[2]];
    const l = Math.hypot(d[0], d[1], d[2]);
    return l < 1e-6 ? [0, 1, 0] : [d[0] / l, d[1] / l, d[2] / l];
  };
  G.blobNormal = (b, dir) => {
    const k = drapeK(dir), x = dir[0] * k, y = dir[1] * k, z = dir[2] * k, n = y >= 0 ? DR_TOP : DR_BOT;
    const S = Math.max(Math.pow(Math.abs(x), DR_M) + Math.pow(Math.abs(z), DR_M), 1e-9), f = Math.pow(S, n / DR_M - 1);
    const g = [n * f * Math.pow(Math.abs(x), DR_M - 1) * Math.sign(x), n * Math.pow(Math.abs(y), n - 1) * Math.sign(y), n * f * Math.pow(Math.abs(z), DR_M - 1) * Math.sign(z)];
    return V.norm([g[0] / b.e[0], g[1] / b.e[1], g[2] / b.e[2]]);
  };

  function roughDef(d) { return d.rough ? Object.assign({}, d, d.rough) : d; }

  // ---------- object mesh ----------
  // od: { parts:[...], blob:{c,e,amp,seed}|false }
  // Per-part axis-aligned bounds in object space (rough form unless fine requested)
  function partAABB(d0, fine) {
    const d = fine ? d0 : roughDef(d0);
    const m = M.trs(d.p || [0, 0, 0], d.rot), h = partHalf(d);
    const c0 = d.t === 'tube' ? V.sub(partCenter(d), d.p || [0, 0, 0]) : [0, 0, 0];
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let k = 0; k < 8; k++) {
      const q = M.xp(m, [c0[0] + (k & 1 ? h[0] : -h[0]), c0[1] + (k & 2 ? h[1] : -h[1]), c0[2] + (k & 4 ? h[2] : -h[2])]);
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], q[a]); hi[a] = Math.max(hi[a], q[a]); }
    }
    return { lo, hi, c: V.mul(V.add(lo, hi), 0.5), vol: (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]) };
  }
  const unionBox = boxes => { let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const b of boxes) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.lo[a]); hi[a] = Math.max(hi[a], b.hi[a]); } return { lo, hi, c: V.mul(V.add(lo, hi), 0.5) }; };
  const ellOf = (b, seed, amp) => ({ c: b.c, e: V.sub(b.hi, b.lo).map(x => Math.max(0.05, x * 0.5 * 0.95 + 0.02)), amp, seed });

  // Blob hierarchy: coarse blobs (1-3, split along the longest side) -> finer blobs (one per major part) -> rough -> fine.
  G.clusters = od => {
    const parts = od.parts, infos = parts.map(d => partAABB(d, (d.appear || 2) >= 3));
    const main = infos.map((b, i) => i).filter(i => (parts[i].appear || 2) <= 2);
    if (!main.length) return null;
    const maxVol = Math.max(...main.map(i => infos[i].vol), 1e-6);
    let seeds = main.filter(i => infos[i].vol >= maxVol * 0.08).sort((a, b) => infos[b].vol - infos[a].vol).slice(0, 6);
    if (!seeds.length) seeds = [main[0]];
    const partFine = parts.map((d, i) => {
      let best = 0, bd = 1e9;
      seeds.forEach((s, k) => { const b = infos[s]; const q = infos[i].c; const dx = Math.max(b.lo[0] - q[0], 0, q[0] - b.hi[0]), dy = Math.max(b.lo[1] - q[1], 0, q[1] - b.hi[1]), dz = Math.max(b.lo[2] - q[2], 0, q[2] - b.hi[2]); const dd = Math.hypot(dx, dy, dz); if (dd < bd) { bd = dd; best = k; } });
      return best;
    });
    const seed0 = (U.strSeed(od.id || 'x') % 100) * 0.37;
    const fine = seeds.map((s, k) => ellOf(unionBox(main.filter(i => partFine[i] === k).map(i => infos[i]).concat([infos[s]])), seed0 + k * 1.7, 0.16));
    const all = unionBox(main.map(i => infos[i]));
    const size = V.sub(all.hi, all.lo), ax = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[2] >= size[1] ? 2 : 1;
    const n = size[ax] > 1.3 ? 3 : size[ax] > 0.7 ? 2 : 1;
    const fineCoarse = fine.map(f => U.clamp(Math.floor((f.c[ax] - all.lo[ax]) / Math.max(1e-6, size[ax]) * n), 0, n - 1));
    const coarse = [], remap = {};
    for (let k = 0; k < n; k++) {
      const mem = fine.map((f, i) => i).filter(i => fineCoarse[i] === k);
      if (!mem.length) continue;
      remap[k] = coarse.length;
      coarse.push(ellOf(unionBox(mem.map(i => ({ lo: V.sub(fine[i].c, fine[i].e), hi: V.add(fine[i].c, fine[i].e) }))), seed0 + 9 + k, 0.22));
    }
    return { fine, coarse, partFine, fineCoarse: fineCoarse.map(k => remap[k]) };
  };

  // od: { parts:[...], blob: false for things that are never blobs (rooms, doors) }
  G.buildObject = od => {
    const parts = od.parts;
    const F = [], I = [];
    let vcount = 0;
    od.bounds = G.bounds(od, 2);
    od.fineBounds = G.bounds(od, 3);
    const blobbed = od.blob !== false && parts.length > 0;
    const cl = blobbed ? G.clusters(od) : null;
    od.clusters = cl;
    od.blobDef = cl ? cl.coarse[0] : false;
    const vol = parts.map(d => { const h = partHalf(d); return h[0] * h[1] * h[2]; });
    const order = vol.map((v, i) => i).sort((a, b) => vol[b] - vol[a]);
    const rank = new Array(parts.length);
    order.forEach((pi, r) => { rank[pi] = parts.length > 1 ? r / (parts.length - 1) : 0; });
    const push = (pf, nf, pr, nr, p2, n2, p1, n1, misc) => {
      F.push(pf[0], pf[1], pf[2], nf[0], nf[1], nf[2], pr[0], pr[1], pr[2], nr[0], nr[1], nr[2], p2[0], p2[1], p2[2], n2[0], n2[1], n2[2], p1[0], p1[1], p1[2], n1[0], n1[1], n1[2], misc[0], misc[1], misc[2], misc[3]);
    };
    const proj = (b, p, k) => { const dir = G.blobDir(b, p); return [V.lerp(b.c, G.blobPoint(b, dir), k), G.blobNormal(b, dir)]; };
    parts.forEach((d, pi) => {
      const counts = d.t === 'box' ? boxCounts(d.s) : null;
      const mF = M.trs(d.p || [0, 0, 0], d.rot);
      const meshF = partMesh(d, counts);
      const appear = d.appear || (blobbed ? 2 : 1);
      let meshR = null, mR = mF, collapse = null;
      if (appear >= 3) collapse = M.xp(mF, [0, 0, 0]);
      else if (d.rough) { const rd = roughDef(d); meshR = partMesh(rd, counts); mR = M.trs(rd.p || [0, 0, 0], rd.rot); }
      const cR = M.xp(mR, [0, 0, 0]);
      const st = d.st !== undefined ? d.st : (appear >= 3 ? 0.25 + rank[pi] * 0.35 : rank[pi] * 0.3);
      const misc = [d.g || 0, st, d.tone || 0, d.mat || 0];
      const fb = cl ? cl.fine[cl.partFine[pi]] : null, cb = cl ? cl.coarse[cl.fineCoarse[cl.partFine[pi]]] : null;
      const nv = meshF.p.length / 3;
      for (let v = 0; v < nv; v++) {
        const pf = M.xp(mF, [meshF.p[v * 3], meshF.p[v * 3 + 1], meshF.p[v * 3 + 2]]), nf = V.norm(M.xd(mF, [meshF.n[v * 3], meshF.n[v * 3 + 1], meshF.n[v * 3 + 2]]));
        let pr, nr;
        if (collapse) { pr = collapse; nr = nf; }
        else if (meshR) { pr = M.xp(mR, [meshR.p[v * 3], meshR.p[v * 3 + 1], meshR.p[v * 3 + 2]]); nr = V.norm(M.xd(mR, [meshR.n[v * 3], meshR.n[v * 3 + 1], meshR.n[v * 3 + 2]])); }
        else { pr = pf; nr = nf; }
        let p2 = pr, n2 = nr, p1 = pr, n1 = nr;
        if (cl) { [p2, n2] = proj(fb, pr, 0.955); [p1, n1] = proj(cb, pr, 0.94); }
        else if (appear >= 2) { p2 = p1 = collapse || cR; }
        push(pf, nf, pr, nr, p2, n2, p1, n1, misc);
      }
      for (const ix of meshF.i) I.push(ix + vcount);
      vcount += nv;
    });
    if (cl) {
      // smooth shells: coarse blobs shrink away as the finer blobs split out; finer blobs shrink as the rough shapes form
      const sh = ellMesh([1, 1, 1], 22, 14), nv = sh.p.length / 3;
      const tone = od.blobTone !== undefined ? od.blobTone : 0.12, mat = od.blobMat !== undefined ? od.blobMat : MAT.PAINT;
      cl.coarse.forEach(cb => {
        for (let v = 0; v < nv; v++) {
          const dir = [sh.p[v * 3], sh.p[v * 3 + 1], sh.p[v * 3 + 2]], q = G.blobPoint(cb, dir), n = G.blobNormal(cb, dir);
          push(cb.c, n, cb.c, n, cb.c, n, q, n, [0, 0, tone, mat]);
        }
        for (const ix of sh.i) I.push(ix + vcount);
        vcount += nv;
      });
      cl.fine.forEach((fb, k) => {
        const cb = cl.coarse[cl.fineCoarse[k]];
        for (let v = 0; v < nv; v++) {
          const dir = [sh.p[v * 3], sh.p[v * 3 + 1], sh.p[v * 3 + 2]], q = G.blobPoint(fb, dir), n = G.blobNormal(fb, dir);
          const [p1, n1] = proj(cb, q, 0.975);
          push(fb.c, n, fb.c, n, q, n, p1, n1, [0, 0.05, tone, mat]);
        }
        for (const ix of sh.i) I.push(ix + vcount);
        vcount += nv;
      });
    }
    return { data: new Float32Array(F), index: I, verts: vcount };
  };

  // Axis-aligned bounds (object space) of parts that exist at a stage (2 = rough, 3 = fine)
  G.bounds = (od, stage) => {
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const d0 of od.parts) {
      if (stage < 3 && (d0.appear || 2) >= 3) continue;
      const d = stage < 3 ? roughDef(d0) : d0;
      const m = M.trs(d.p || [0, 0, 0], d.rot), h = partHalf(d);
      const c = d.t === 'tube' ? V.sub(partCenter(d), d.p || [0, 0, 0]) : [0, 0, 0];
      for (let k = 0; k < 8; k++) {
        const q = M.xp(m, [c[0] + (k & 1 ? h[0] : -h[0]), c[1] + (k & 2 ? h[1] : -h[1]), c[2] + (k & 4 ? h[2] : -h[2])]);
        for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], q[a]); hi[a] = Math.max(hi[a], q[a]); }
      }
    }
    if (lo[0] > hi[0]) { lo = [-0.1, 0, -0.1]; hi = [0.1, 0.2, 0.1]; }
    return { lo, hi };
  };

  // Pick volumes per stage: list of {m (frame), h, tag, g}
  G.pickBoxes = (od, stage) => {
    const cl = od.clusters;
    const ellBox = b => { const m = M.trans(b.c[0], b.c[1], b.c[2]); return { m, inv: M.inv(m), h: V.add(V.mul(b.e, 1.08), [0.03, 0.03, 0.03]), tag: null, g: 0 }; };
    if (cl && stage <= 1) return cl.coarse.map(ellBox);
    if (cl && stage === 2) return cl.fine.map(ellBox);
    const out = [];
    for (const d0 of od.parts) {
      if (d0.nopick) continue;
      const ap = d0.appear || (cl ? 2 : 1);
      if (stage < 4 && ap >= 3) continue;
      if (!cl && stage < 3 && ap > Math.max(stage, 1)) continue;
      const d = stage < 4 ? roughDef(d0) : d0;
      let m = M.trs(d.p || [0, 0, 0], d.rot);
      if (d.t === 'tube') { const c = partCenter(d); m = M.trans(c[0], c[1], c[2]); }
      out.push({ m, inv: M.inv(m), h: V.add(partHalf(d), [0.025, 0.025, 0.025]), tag: d.tag || null, g: d.g || 0 });
    }
    return out;
  };

  // ---------- strokes ----------
  function edgeStroke(a, b, o, rnd) {
    const L = V.dist(a, b);
    if (L < 1e-4) return null;
    const dir = V.mul(V.sub(b, a), 1 / L);
    const o1 = (0.25 + rnd() * 0.75) * o.over * (0.6 + Math.min(L, 1.5) * 0.4), o2 = (0.25 + rnd() * 0.75) * o.over * (0.6 + Math.min(L, 1.5) * 0.4);
    const A = V.madd(a, dir, -o1 * (rnd() < 0.5 ? 1 : 0.4)), B = V.madd(b, dir, o2);
    const p1 = V.perp(dir), p2 = V.cross(dir, p1), ang = rnd() * Math.PI * 2;
    const pd = V.add(V.mul(p1, Math.cos(ang)), V.mul(p2, Math.sin(ang))), pd2 = V.cross(dir, pd);
    const bow = (rnd() - 0.5) * 2 * o.bow * L;
    const n = Math.max(3, Math.ceil(V.dist(A, B) / 0.06));
    const seed = rnd() * 100;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let p = V.lerp(A, B, t);
      // a slow wander, a faster hand tremor, and some drift off the line's own plane
      p = V.madd(p, pd, bow * Math.sin(Math.PI * t) + (o.jit ? (U.noise1(t * 4 + seed) - 0.5) * o.jit + (U.noise1(t * 13 + seed * 1.7) - 0.5) * o.jit * 0.45 : 0));
      if (o.jit) p = V.madd(p, pd2, (U.noise1(t * 5 + seed + 40) - 0.5) * o.jit * 0.7);
      pts.push(p);
    }
    return pts;
  }
  function ringStroke(c, u, v, o, rnd) {
    const turns = 1 + o.over * (0.4 + rnd() * 0.6);
    const a0 = rnd() * Math.PI * 2, n = Math.max(12, Math.round(30 * turns));
    const seed = rnd() * 100;
    const drift = (rnd() - 0.5) * o.wob;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = a0 + t * turns * Math.PI * 2;
      const k = 1 + (U.noise1(t * 5 + seed) - 0.5) * o.wob + drift * t;
      pts.push(V.add(c, V.add(V.mul(u, Math.cos(a) * k), V.mul(v, Math.sin(a) * k))));
    }
    return pts;
  }
  G.edgeStroke = edgeStroke;
  G.ringStroke = ringStroke;

  const STYLE = {
    0: { over: 0.34, bow: 0.12, jit: 0.065, dark: 0.36, w: 1.0, speed: 2.4, maxDur: 1.1, wob: 0.28 },
    1: { over: 0.27, bow: 0.075, jit: 0.042, dark: 0.5, w: 1.2, speed: 2.6, maxDur: 1.2, wob: 0.2 },
    2: { over: 0.18, bow: 0.042, jit: 0.024, dark: 0.64, w: 1.4, speed: 2.8, maxDur: 2.6, wob: 0.11 },
    3: { over: 0.09, bow: 0.02, jit: 0.009, dark: 0.84, w: 1.6, speed: 3.4, maxDur: 3.6, wob: 0.055 },
  };
  G.STYLE = STYLE;

  function boxEdgeStrokes(d, o, rnd, out, g, twice) {
    const h = V.mul(d.s, 0.5), b = (d.bevel || 0) * 0.29;
    if (Math.max(d.s[0], d.s[1], d.s[2]) < 0.045) return;
    const m = M.trs(d.p || [0, 0, 0], d.rot);
    const C = (sx, sy, sz) => M.xp(m, [sx * (h[0] - b), sy * (h[1] - b), sz * (h[2] - b)]);
    const edges = [];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      edges.push([C(-1, s1, s2), C(1, s1, s2), d.s[0]]);
      edges.push([C(s1, -1, s2), C(s1, 1, s2), d.s[1]]);
      edges.push([C(s1, s2, -1), C(s1, s2, 1), d.s[2]]);
    }
    for (const [a, bb, len] of edges) {
      if (len < 0.02) continue;
      if (d.skipEdges && d.skipEdges(a, bb)) continue;
      const pts = edgeStroke(a, bb, o, rnd);
      if (pts) out.push({ pts, g, w: 1, d: 1 });
      if (twice && rnd() < twice) { const p2 = edgeStroke(a, bb, o, rnd); if (p2) out.push({ pts: p2, g, w: 0.8, d: 0.7 }); }
    }
  }
  function cylStrokes(d, o, rnd, out, g) {
    const m = M.trs(d.p || [0, 0, 0], d.rot);
    const rt = d.rad * (d.taper === undefined ? 1 : d.taper);
    if (d.rad < 0.02 && d.h > 0.1) {
      out.push({ pts: edgeStroke(M.xp(m, [0, -d.h / 2, 0]), M.xp(m, [0, d.h / 2, 0]), o, rnd), g, w: 1, d: 1 });
      return;
    }
    for (const top of [0, 1]) {
      const rr = top ? rt : d.rad;
      if (rr < 0.012) continue;
      const y = top ? d.h / 2 : -d.h / 2;
      const c = M.xp(m, [0, y, 0]), u = V.sub(M.xp(m, [rr, y, 0]), c), v = V.sub(M.xp(m, [0, y, rr]), c);
      out.push({ pts: ringStroke(c, u, v, { over: o.over * 1.5, wob: o.jit * 2 }, rnd), g, w: 1, d: 1 });
    }
  }
  function ellStrokes(d, o, rnd, out, g) {
    const m = M.trs(d.p || [0, 0, 0], d.rot);
    const c = M.xp(m, [0, 0, 0]);
    const ex = V.sub(M.xp(m, [d.e[0], 0, 0]), c), ey = V.sub(M.xp(m, [0, d.e[1], 0]), c), ez = V.sub(M.xp(m, [0, 0, d.e[2]]), c);
    if (Math.max(d.e[0], d.e[1], d.e[2]) < 0.05) return;
    out.push({ pts: ringStroke(c, ex, ez, { over: o.over, wob: o.jit * 3 }, rnd), g, w: 0.9, d: 0.8 });
  }
  function partStrokes(d, o, rnd, out, twice) {
    const g = d.g || 0;
    if (d.noStroke) return;
    if (d.t === 'box') boxEdgeStrokes(d, o, rnd, out, g, twice);
    else if (d.t === 'cyl') cylStrokes(d, o, rnd, out, g);
    else if (d.t === 'ell') ellStrokes(d, o, rnd, out, g);
    else if (d.t === 'torus') {
      const m = M.trs(d.p || [0, 0, 0], d.rot), c = M.xp(m, [0, 0, 0]);
      out.push({ pts: ringStroke(c, V.sub(M.xp(m, [d.R, 0, 0]), c), V.sub(M.xp(m, [0, 0, d.R]), c), { over: 0.05, wob: 0.01 }, rnd), g, w: 1, d: 1 });
    } else if (d.t === 'tube') {
      const m = M.trs(d.p || [0, 0, 0], d.rot);
      out.push({ pts: d.pts.map(p => M.xp(m, p)), g, w: 1.1, d: 1 });
    }
  }

  // Detail strokes described in object data. Each: {k:'line'|'poly'|'ring'|'rect'|'dash', stage, g, ...}
  function detailStrokes(od, stage, o, rnd, out) {
    for (const s of od.detail || []) {
      if ((s.stage || 3) !== stage) continue;
      const g = s.g || 0, w = s.w || 1, dk = s.d || 1;
      if (s.k === 'line') { const p = edgeStroke(s.a, s.b, o, rnd); if (p) out.push({ pts: p, g, w, d: dk }); }
      else if (s.k === 'poly') { out.push({ pts: s.pts.map(p => p.slice()), g, w, d: dk }); }
      else if (s.k === 'ring') {
        const u = s.u || [s.r, 0, 0], v = s.v || [0, 0, s.r];
        out.push({ pts: ringStroke(s.c, u, v, { over: s.over !== undefined ? s.over : 0.08, wob: s.wob || 0.02 }, rnd), g, w, d: dk });
      } else if (s.k === 'rect') {
        const [c, u, v] = [s.c, s.u, s.v];
        const P = (a, b) => V.add(c, V.add(V.mul(u, a), V.mul(v, b)));
        const corners = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
        for (let i = 0; i < 4; i++) { const p = edgeStroke(corners[i], corners[(i + 1) % 4], o, rnd); if (p) out.push({ pts: p, g, w, d: dk }); }
      } else if (s.k === 'dash') {
        const n = s.n || 8, dir = V.sub(s.b, s.a);
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = t0 + 0.55 / n;
          out.push({ pts: [V.madd(s.a, dir, t0), V.madd(s.a, dir, (t0 + t1) / 2), V.madd(s.a, dir, t1)], g, w, d: dk });
        }
      } else if (s.k === 'scribble') {
        out.push({ pts: scribble(s.c, s.u, s.v, s.n || 7, rnd), g, w: w * 0.9, d: dk * 0.8 });
      }
    }
  }
  function scribble(c, u, v, n, rnd) {
    const pts = [];
    for (let i = 0; i <= n * 2; i++) {
      const t = i / (n * 2), side = i % 2 ? 1 : -1;
      pts.push(V.add(c, V.add(V.mul(u, t * 2 - 1 + (rnd() - 0.5) * 0.08), V.mul(v, side * (0.8 + rnd() * 0.25)))));
    }
    return pts;
  }
  G.scribble = scribble;

  // Contact shadow scribble on the floor, on the side away from the light (object space)
  function groundStrokes(od, stage, rnd, out, lightLocal) {
    if (!od.foot || od.noGround) return;
    const nz = stage >= 3 ? 9 : stage === 2 ? 6 : 4;
    for (const f of od.foot) {
      const [cx, cz, hx, hz] = f;
      const lx = lightLocal[0], lz = lightLocal[2];
      // choose the two edges facing away from light
      const sides = [];
      if (lx > 0.05) sides.push('-x'); else if (lx < -0.05) sides.push('+x');
      if (lz > 0.05) sides.push('-z'); else if (lz < -0.05) sides.push('+z');
      if (!sides.length) sides.push('+z');
      for (const s of sides) {
        let a, b, out1;
        if (s === '-x') { a = [cx - hx, 0.004, cz - hz]; b = [cx - hx, 0.004, cz + hz]; out1 = [-1, 0, 0]; }
        if (s === '+x') { a = [cx + hx, 0.004, cz - hz]; b = [cx + hx, 0.004, cz + hz]; out1 = [1, 0, 0]; }
        if (s === '-z') { a = [cx - hx, 0.004, cz - hz]; b = [cx + hx, 0.004, cz - hz]; out1 = [0, 0, -1]; }
        if (s === '+z') { a = [cx - hx, 0.004, cz + hz]; b = [cx + hx, 0.004, cz + hz]; out1 = [0, 0, 1]; }
        const L = V.dist(a, b), n = Math.max(3, Math.round(L / 0.09 * (nz / 6)));
        const pts = [];
        for (let i = 0; i <= n * 2; i++) {
          const t = i / (n * 2), side = i % 2;
          const p = V.lerp(a, b, U.clamp(t + (rnd() - 0.5) * 0.02, 0, 1));
          pts.push(V.madd(p, out1, side ? 0.03 + rnd() * 0.07 : -0.01));
        }
        out.push({ pts, g: 0, w: 0.9, d: 0.55 });
      }
    }
  }

  function drapeFolds(b, n, rnd, out, w, dk) {
    for (let f = 0; f < n; f++) {
      const a = rnd() * Math.PI * 2, pts = [], wob = (rnd() - 0.5) * 0.5;
      for (let i = 0; i <= 12; i++) {
        const y = 0.75 - i / 12 * 1.73, aa = a + wob * (i / 12), r = Math.sqrt(Math.max(0.02, 1 - Math.min(0.9, y * y)));
        pts.push(V.lerp(b.c, G.blobPoint(b, V.norm([Math.cos(aa) * r, y, Math.sin(aa) * r])), 1.01));
      }
      out.push({ pts, g: 0, w: (w || 1) * 0.8, d: (dk || 1) * 0.7 });
    }
  }
  function ellRings(b, n, rnd, out, w, dk) {
    const lat = n >= 3 ? [-0.93, -0.25, 0.5] : n === 2 ? [-0.9, 0.35] : [-0.9];
    for (const la of lat) {
      const turns = 1.08 + rnd() * 0.2, a0 = rnd() * 6.28, steps = 30, pts = [], tilt = (rnd() - 0.5) * 0.25;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + i / steps * turns * Math.PI * 2, y = la + tilt * Math.cos(a), r = Math.sqrt(Math.max(0.02, 1 - y * y));
        pts.push(V.lerp(b.c, G.blobPoint(b, V.norm([Math.cos(a) * r, y, Math.sin(a) * r])), 1.012));
      }
      out.push({ pts, g: 0, w: w || 1, d: dk || 1 });
    }
  }
  // Stage strokes: 1 coarse blobs, 2 finer blobs, 3 rough masses, 4 finished form. Things without blobs: loose -> firm lines.
  G.makeStrokes = (od, stage, seed, lightLocal) => {
    const rnd = U.rng(seed);
    const st = Math.max(1, Math.min(4, stage));
    const o = STYLE[st - 1] || STYLE[3];
    const out = [];
    if (od.customStrokes) { const r = od.customStrokes(st >= 3 ? st - 1 : st, o, rnd, out); if (r === 'done') return out; }
    const cl = od.clusters;
    if (cl && st <= 2) {
      if (st === 1) cl.coarse.forEach(b => { ellRings(b, 3, rnd, out, 1, 1); drapeFolds(b, 2 + Math.floor(rnd() * 2), rnd, out, 1, 1); });
      else cl.fine.forEach(b => { ellRings(b, V.len(b.e) > 0.4 ? 2 : 1, rnd, out, 0.9, 0.9); drapeFolds(b, 1, rnd, out, 0.9, 0.9); });
      groundStrokes(od, st, rnd, out, lightLocal);
      return out;
    }
    const twice = st === 3 ? 0.3 : st === 1 ? 0.25 : 0;
    const maxAp = cl ? (st >= 4 ? 3 : 2) : (st <= 2 ? 1 : st === 3 ? 2 : 3);
    for (const d0 of od.parts) {
      const ap = d0.appear || (cl ? 2 : 1);
      if (ap > maxAp) continue;
      if (d0.strokeFrom && d0.strokeFrom > st) continue;
      partStrokes(st < 4 ? roughDef(d0) : d0, o, rnd, out, twice);
    }
    groundStrokes(od, st, rnd, out, lightLocal);
    const want = st === 3 ? 2 : st === 4 ? 3 : -1;
    const det = (od.detail || []).filter(s => (s.stage || 3) === want).map(s => Object.assign({}, s, { stage: 9 }));
    if (det.length) detailStrokes({ detail: det }, 9, o, rnd, out);
    return out.filter(s => s.pts && s.pts.length > 1);
  };

  // Order strokes so the drawing hand travels a plausible path, then time them.
  G.orderAndTime = (strokes, stage, opts) => {
    opts = opts || {};
    const o = STYLE[Math.max(0, Math.min(3, stage - 1))];
    if (!strokes.length) return 0;
    const left = strokes.slice();
    // start with the highest stroke
    left.sort((a, b) => Math.max(...b.pts.map(p => p[1])) - Math.max(...a.pts.map(p => p[1])));
    const ordered = [left.shift()];
    let cur = ordered[0].pts[ordered[0].pts.length - 1];
    while (left.length) {
      let best = 0, bd = 1e9, rev = false;
      for (let i = 0; i < left.length; i++) {
        const s = left[i], a = V.dist(cur, s.pts[0]), b = V.dist(cur, s.pts[s.pts.length - 1]);
        if (a < bd) { bd = a; best = i; rev = false; }
        if (b < bd) { bd = b; best = i; rev = true; }
      }
      const s = left.splice(best, 1)[0];
      if (rev) s.pts.reverse();
      ordered.push(s);
      cur = s.pts[s.pts.length - 1];
    }
    let t = 0, prevEnd = null;
    const speed = (opts.speed || 1) * o.speed;
    for (const s of ordered) {
      let L = 0; s.cum = [0];
      for (let i = 1; i < s.pts.length; i++) { L += V.dist(s.pts[i - 1], s.pts[i]); s.cum.push(L); }
      s.len = L;
      if (prevEnd) t += 0.03 + Math.min(0.25, V.dist(prevEnd, s.pts[0]) / 7);
      const dur = U.clamp(L / speed, 0.05, 0.5);
      s.t0 = t; s.t1 = t + dur; t += dur;
      prevEnd = s.pts[s.pts.length - 1];
    }
    const maxDur = opts.maxDur || o.maxDur * (opts.durScale || 1);
    if (t > maxDur) { const k = maxDur / t; for (const s of ordered) { s.t0 *= k; s.t1 *= k; } t = maxDur; }
    strokes.length = 0; for (const s of ordered) strokes.push(s);
    return t;
  };

  // Interleaved vertex data: aP(3) aPrev(3) aNext(3) aT(4: arc, t0, t1, side) aS(4: width, dark, seed, group)
  G.packStrokes = (strokes, style) => {
    const F = [], I = [];
    let vc = 0;
    strokes.forEach((s, si) => {
      const n = s.pts.length, L = s.len || 1;
      const seed = (si * 7.31) % 97;
      const w = style.w * (s.w || 1), dk = Math.min(1, style.dark * (s.d || 1) * (0.82 + 0.18 * U.hash(si + 0.3)));
      for (let i = 0; i < n; i++) {
        const p = s.pts[i], pp = s.pts[Math.max(0, i - 1)], pn = s.pts[Math.min(n - 1, i + 1)];
        const arc = (s.cum ? s.cum[i] : i) / (s.cum ? L : n - 1);
        for (const side of [-1, 1]) {
          F.push(p[0], p[1], p[2], pp[0], pp[1], pp[2], pn[0], pn[1], pn[2], arc, s.t0 || 0, s.t1 || 0.01, side, w, dk, seed, s.g || 0);
        }
      }
      for (let i = 0; i < n - 1; i++) { const a = vc + i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      vc += n * 2;
    });
    return { data: new Float32Array(F), index: I, verts: vc };
  };

  // Head of the drawing at batch time t: returns {p (object/group space), g, stroke index} or null.
  G.headAt = (strokes, t) => {
    let s = null;
    for (let i = 0; i < strokes.length; i++) { if (strokes[i].t0 <= t) s = strokes[i]; else break; }
    if (!s) return null;
    const f = U.sat((t - s.t0) / Math.max(1e-3, s.t1 - s.t0));
    const target = f * s.len;
    let i = 1;
    while (i < s.cum.length - 1 && s.cum[i] < target) i++;
    const seg = Math.max(1e-6, s.cum[i] - s.cum[i - 1]);
    const k = U.sat((target - s.cum[i - 1]) / seg);
    return { p: V.lerp(s.pts[i - 1], s.pts[i], k), g: s.g || 0, drawing: f < 1, speed: s.len / Math.max(0.05, s.t1 - s.t0), s, dur: s.t1 - s.t0 };
  };
})();
