'use strict';
// Math, noise and small helpers shared by every module.
window.WK = window.WK || {};
(function () {
  const U = WK.U = {};
  U.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  U.sat = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (a, b, x) => { const t = U.sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  U.easeInOut = t => { t = U.sat(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  U.easeOut = t => 1 - Math.pow(1 - U.sat(t), 3);
  U.easeIn = t => Math.pow(U.sat(t), 3);
  U.approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  U.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  U.hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
  U.hash2 = (x, y) => U.hash(x * 12.9898 + y * 78.233);
  U.hash3 = (x, y, z) => U.hash(x * 12.9898 + y * 78.233 + z * 37.719);
  U.rng = seed => {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.strSeed = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  U.noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return U.lerp(U.hash(i), U.hash(i + 1), u); };
  U.noise3 = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const h = (a, b, c) => U.hash3(ix + a, iy + b, iz + c);
    const x00 = U.lerp(h(0, 0, 0), h(1, 0, 0), ux), x10 = U.lerp(h(0, 1, 0), h(1, 1, 0), ux);
    const x01 = U.lerp(h(0, 0, 1), h(1, 0, 1), ux), x11 = U.lerp(h(0, 1, 1), h(1, 1, 1), ux);
    return U.lerp(U.lerp(x00, x10, uy), U.lerp(x01, x11, uy), uz);
  };
  U.pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

  const V = WK.V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    perp: d => { const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; return V.norm(V.cross(d, a)); },
  };

  // 4x4 matrices, column-major Float32Array.
  const M = WK.M = {};
  M.ident = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  const tmp = new Float32Array(16);
  M.mul = (a, b, out) => {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      tmp[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    out = out || new Float32Array(16); out.set(tmp); return out;
  };
  M.persp = (fovy, asp, n, f) => {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  };
  M.lookAt = (e, c, up) => {
    const z = V.norm(V.sub(e, c)), x = V.norm(V.cross(up, z)), y = V.cross(z, x), m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -V.dot(x, e); m[13] = -V.dot(y, e); m[14] = -V.dot(z, e); m[15] = 1; return m;
  };
  M.rotY = a => { const c = Math.cos(a), s = Math.sin(a), m = M.ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
  M.rotX = a => { const c = Math.cos(a), s = Math.sin(a), m = M.ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
  M.rotZ = a => { const c = Math.cos(a), s = Math.sin(a), m = M.ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };
  M.trans = (x, y, z) => { const m = M.ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
  M.scale = (x, y, z) => { const m = M.ident(); m[0] = x; m[5] = y; m[10] = z; return m; };
  // Euler order: R = Ry * Rx * Rz
  M.rot = (rx, ry, rz) => M.mul(M.rotY(ry || 0), M.mul(M.rotX(rx || 0), M.rotZ(rz || 0)));
  M.trs = (p, r, s) => {
    let m = M.trans(p[0], p[1], p[2]);
    if (r) m = M.mul(m, M.rot(r[0], r[1], r[2]));
    if (s) m = M.mul(m, M.scale(s[0], s[1], s[2]));
    return m;
  };
  M.pose = (x, y, z, yaw) => M.mul(M.trans(x, y, z), M.rotY(yaw || 0));
  M.inv = m => {
    const a = m, o = new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M.ident();
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  };
  M.xp = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  M.xd = (m, d) => [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
  M.x4 = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]];

  // Ray vs oriented box given as inverse matrix of the box frame and half extents. Returns t or -1.
  U.rayBox = (inv, h, o, d) => {
    const lo = M.xp(inv, o), ld = M.xd(inv, d);
    let t0 = -Infinity, t1 = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ld[i]) < 1e-9) { if (lo[i] < -h[i] || lo[i] > h[i]) return -1; continue; }
      let a = (-h[i] - lo[i]) / ld[i], b = (h[i] - lo[i]) / ld[i];
      if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a; if (b < t1) t1 = b;
      if (t0 > t1) return -1;
    }
    if (t1 < 0) return -1;
    return t0 > 0 ? t0 : 0;
  };
  U.now = () => performance.now() / 1000;
})();
