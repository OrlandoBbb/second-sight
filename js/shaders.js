'use strict';
// GLSL for the pencil renderer: drawn surfaces (G-buffer), outline composite, pencil strokes, particles, page finish.
(function () {
  const COMMON = `
float h11(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float a = h31(i), b = h31(i + vec3(1,0,0)), c = h31(i + vec3(0,1,0)), d = h31(i + vec3(1,1,0));
  float e = h31(i + vec3(0,0,1)), f1 = h31(i + vec3(1,0,1)), g = h31(i + vec3(0,1,1)), h = h31(i + vec3(1,1,1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z); }
float paperGrain(vec2 fc){ return vn2(fc * 0.7) * 0.45 + vn2(fc * 0.23 + 7.1) * 0.35 + vn2(fc * 0.061 + 3.3) * 0.2; }
`;

  const SURF_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPF;
layout(location=1) in vec3 aNF;
layout(location=2) in vec3 aPR;
layout(location=3) in vec3 aNR;
layout(location=4) in vec3 aPB;
layout(location=5) in vec3 aNB;
layout(location=6) in vec3 aPB1;
layout(location=7) in vec3 aNB1;
layout(location=8) in vec4 aMisc;
uniform mat4 uVP;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uGroup[16];
uniform float uM0;
uniform float uM1;
uniform float uM2;
uniform float uWob;
uniform float uBoil;
out vec3 vWP; out vec3 vWN; out vec3 vOP; out vec3 vON; out vec3 vVN;
out float vTone; out float vMat; out float vGroup;
${COMMON}
void main(){
  float st = aMisc.y;
  float k0 = clamp((uM0 - st) / max(1.0 - st, 0.001), 0.0, 1.0); k0 = k0 * k0 * (3.0 - 2.0 * k0);
  float k1 = clamp((uM1 - st) / max(1.0 - st, 0.001), 0.0, 1.0); k1 = k1 * k1 * (3.0 - 2.0 * k1);
  float k2 = clamp((uM2 - st) / max(1.0 - st, 0.001), 0.0, 1.0); k2 = k2 * k2 * (3.0 - 2.0 * k2);
  vec3 p = mix(mix(mix(aPB1, aPB, k0), aPR, k1), aPF, k2);
  vec3 n = mix(mix(mix(aNB1, aNB, k0), aNR, k1), aNF, k2);
  n = normalize(n + vec3(0.0, 1e-4, 0.0));
  if (uWob > 0.0) p += n * (vn3(p * 3.1 + vec3(uBoil)) - 0.5) * uWob;
  mat4 G = uGroup[int(aMisc.x + 0.5)];
  vec4 wp = uModel * (G * vec4(p, 1.0));
  vec3 wn = normalize(mat3(uModel) * (mat3(G) * n));
  vWP = wp.xyz; vWN = wn; vOP = p; vON = n; vVN = mat3(uView) * wn;
  vTone = aMisc.z; vMat = aMisc.w; vGroup = aMisc.x;
  gl_Position = uVP * wp;
}`;

  const SURF_FS = `#version 300 es
precision highp float;
in vec3 vWP; in vec3 vWN; in vec3 vOP; in vec3 vON; in vec3 vVN;
in float vTone; in float vMat; in float vGroup;
layout(location=0) out vec4 oCol;
layout(location=1) out vec4 oNid;
uniform vec3 uKey;
uniform vec3 uEye;
uniform float uReveal;
uniform float uConf;
uniform float uInk;
uniform float uErase;
uniform float uObjId;
uniform float uHatchAng;
uniform float uColorAmt;
uniform float uDetail;
uniform float uLit;
uniform float uTint;
uniform vec3 uTintCol;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec4 uShadow[24];
uniform int uNShadow;
${COMMON}
float hatch(vec2 uv, float ang, float sp, float w, float seed, float conf, float rev){
  vec2 d = vec2(cos(ang), sin(ang));
  float u = dot(uv, d) / sp;
  float v = dot(uv, vec2(-d.y, d.x)) / sp;
  float li = floor(u);
  float r1 = h11(li * 1.37 + seed);
  float wav = (vn2(vec2(li * 0.71 + seed, v * 0.09)) - 0.5) * mix(0.9, 0.16, conf);
  float uu = u + wav + (r1 - 0.5) * mix(0.55, 0.1, conf);
  float f = abs(fract(uu) - 0.5);
  float segL = mix(5.0, 12.0, h11(li * 3.1 + seed * 1.7));
  float sv = v / segL + h11(li * 7.7 + seed) * 4.0;
  float si = floor(sv);
  float sf = fract(sv);
  float r2 = h21(vec2(li, si) + seed);
  float present = step(r2, rev);
  float taper = smoothstep(0.0, 0.08, sf) * smoothstep(1.0, 0.84, sf);
  float aa = fwidth(u) * 0.8;
  float r3 = h21(vec2(si * 1.3, li * 0.7) + seed * 2.1);
  float slant = (r3 - 0.5) * mix(0.09, 0.03, conf) * (v - (si - h11(li * 7.7 + seed) * 4.0) * segL);
  float f2 = abs(fract(uu + slant + (r3 - 0.5) * 0.25) - 0.5);
  f = f2;
  float lw = w * (0.6 + 0.4 * h11(li + si * 3.7 + seed)) * taper;
  float cov = 1.0 - smoothstep(lw - aa, lw + aa, f);
  float avg = clamp(lw * 2.0, 0.0, 1.0) * 0.75;
  cov = mix(cov, avg, smoothstep(0.25, 0.7, aa));
  return cov * present;
}
float hatchLv(vec2 uv, float ang, float w, float seed, float conf, float rev, float fp){
  float base = 0.011;
  float lv = log2(max(fp * 5.5 / base, 1.0));
  float l0 = floor(lv);
  float t = smoothstep(0.15, 0.85, fract(lv));
  float s0 = base * exp2(l0);
  float a = hatch(uv, ang, s0, w, seed + l0 * 13.1, conf, rev);
  float b = hatch(uv, ang, s0 * 2.0, w, seed + (l0 + 1.0) * 13.1, conf, rev);
  return mix(a, b, t);
}
float gridLine(float x, float wpx){ float d = abs(fract(x + 0.5) - 0.5); float aa = max(fwidth(x), 1e-5); return 1.0 - smoothstep(aa * wpx * 0.5, aa * (wpx * 0.5 + 1.0), d); }
void main(){
  if (uErase > 0.001) { float e = h21(floor(gl_FragCoord.xy * 0.5) + uObjId * 7.0); if (e < uErase) discard; }
  vec3 N = normalize(vWN);
  vec3 ON = normalize(vON);
  vec3 an = abs(ON);
  vec2 uv; float ax;
  if (an.y >= an.x && an.y >= an.z) { uv = vOP.xz; ax = 1.0; }
  else if (an.x >= an.z) { uv = vOP.zy; ax = 2.0; }
  else { uv = vOP.xy; ax = 3.0; }
  float fp = length(fwidth(uv));
  int mat = int(vMat + 0.5);
  float ndl = dot(N, uKey);
  float fill = dot(N, normalize(vec3(0.55, 0.3, -0.7)));
  float light = clamp(0.58 + 0.3 * ndl + 0.14 * fill + 0.08 * N.y, 0.0, 1.0);
  float dark = vTone * 0.75 + (1.0 - light) * 0.62;
  float floorY = vWP.y < 2.7 ? 0.0 : 2.8;
  if (mat == 5) dark = 0.05 + (1.0 - light) * 0.34 + 0.24 * (1.0 - smoothstep(0.0, 0.5, vWP.y - floorY)) + 0.12 * smoothstep(2.3, 2.6, vWP.y - floorY);
  if (mat == 4) dark = (1.0 - light) * 0.3 + 0.05;
  dark *= mix(0.62, 1.0, uConf);
  if (mat == 4 || mat == 7) {
    float sh = 0.0;
    for (int i = 0; i < 24; i++) {
      if (i >= uNShadow) break;
      vec4 s = uShadow[i];
      float fy = s.w < 0.0 ? 2.8 : 0.0;
      if (abs(floorY - fy) > 0.5) continue;
      vec2 q = (vWP.xz - s.xy) / vec2(s.z, abs(s.w));
      sh = max(sh, 1.0 - smoothstep(0.5, 1.0, length(q)));
    }
    dark += sh * 0.42;
  }
  dark = clamp(dark * (1.0 - uLit * 0.55), 0.0, 1.0);
  if (mat == 9) dark = 0.0;
  float conf = uConf, rev = uReveal;
  float ang = uHatchAng + ax * 0.83;
  float seed = uObjId * 3.7 + ax * 11.0 + vGroup * 5.3;
  float d1 = smoothstep(0.1, 0.62, dark);
  float d2 = smoothstep(0.46, 0.86, dark);
  float d3 = smoothstep(0.72, 1.0, dark);
  float c1 = hatchLv(uv, ang, mix(0.04, 0.16, d1), seed, conf, rev, fp) * step(0.001, d1);
  float c2 = hatchLv(uv, ang + mix(1.15, 1.5708, conf), mix(0.04, 0.14, d2), seed + 17.0, conf, rev * 0.95, fp) * step(0.001, d2);
  float c3 = hatchLv(uv, ang + 0.785, mix(0.04, 0.12, d3), seed + 31.0, conf, rev * 0.9, fp) * step(0.001, d3);
  float ink = 1.0 - (1.0 - c1) * (1.0 - c2) * (1.0 - c3);
  if (mat == 5) ink *= 0.62;
  float det = uDetail * (0.55 + 0.45 * vn2(vWP.xz * 2.3 + vWP.y));
  if (mat == 4) {
    float bw = 0.145;
    float bi = floor(vWP.z / bw);
    float seam = gridLine(vWP.z / bw, 1.1);
    float joint = gridLine((vWP.x + h11(bi) * 1.9) / 1.9, 1.1) * (1.0 - seam);
    ink = max(ink, (seam * 0.5 + joint * 0.42) * det);
  } else if (mat == 2) {
    float g = gridLine(uv.y * 26.0 + (vn2(uv * vec2(1.3, 7.0)) - 0.5) * 3.0, 0.8);
    ink = max(ink, g * 0.28 * det);
  } else if (mat == 6) {
    float s = fract((vWP.x + vWP.y * 0.8 + vWP.z) * 1.4);
    float streak = smoothstep(0.08, 0.14, s) * (1.0 - smoothstep(0.22, 0.28, s));
    ink *= 1.0 - streak * 0.8 * rev;
  }
  vec3 paper = vec3(0.957, 0.945, 0.918);
  vec3 graph = vec3(0.19, 0.195, 0.215);
  float smudge = dark * 0.3 * clamp(rev * 1.3, 0.0, 1.0);
  vec3 col = paper * (1.0 - smudge * 0.42);
  col = mix(col, graph, clamp(ink, 0.0, 1.0) * mix(0.5, 0.82, conf));
  if (mat == 8 || mat == 14) {
    vec3 base = mat == 8 ? uColor : uColor2;
    vec3 Vd = normalize(uEye - vWP);
    float spec = pow(max(dot(reflect(-uKey, N), Vd), 0.0), 28.0) + 0.6 * pow(max(dot(reflect(-normalize(vec3(-0.3, 0.8, 0.5)), N), Vd), 0.0), 40.0);
    vec3 cc = base * (0.5 + 0.62 * light) + spec * (mat == 8 ? 0.5 : 0.15);
    col = mix(col, cc, uColorAmt);
  }
  if (uTint > 0.0) col *= mix(vec3(1.0), uTintCol * 1.18, uTint);
  oCol = vec4(col, 1.0);
  vec3 vn = normalize(vVN);
  float idv = fract((uObjId * 16.0 + vGroup) * 0.61803398875);
  oNid = vec4(vn.xy * 0.5 + 0.5, idv, uInk);
}`;

  const QUAD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
void main(){ gl_Position = vec4(aQ, 0.0, 1.0); }`;

  const COMP_FS = `#version 300 es
precision highp float;
uniform sampler2D tCol;
uniform sampler2D tNid;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uBoil;
uniform float uFogN;
uniform float uFogF;
uniform float uLineW;
out vec4 oCol;
${COMMON}
float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
vec3 dn(vec4 n){ vec3 N = vec3(n.xy * 2.0 - 1.0, 0.0); N.z = sqrt(max(0.0, 1.0 - dot(N.xy, N.xy))); return N; }
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec2 fc = gl_FragCoord.xy;
  ivec2 lim = ivec2(uRes) - 1;
  vec2 w = vec2(vn2(fc / 31.0 + uBoil * 3.1), vn2(fc / 29.0 - uBoil * 2.3)) - 0.5;
  ivec2 c = clamp(ip + ivec2(round(w * 2.6)), ivec2(0), lim);
  float d0 = lin(texelFetch(tDepth, c, 0).r);
  vec4 n0 = texelFetch(tNid, c, 0);
  vec3 N0 = dn(n0);
  float edge = 0.0;
  int R = int(uLineW + 0.5);
  for (int i = 0; i < 8; i++) {
    ivec2 o = i == 0 ? ivec2(1, 0) : i == 1 ? ivec2(-1, 0) : i == 2 ? ivec2(0, 1) : i == 3 ? ivec2(0, -1) : i == 4 ? ivec2(1, 1) : i == 5 ? ivec2(-1, -1) : i == 6 ? ivec2(1, -1) : ivec2(-1, 1);
    ivec2 q = clamp(c + o * R, ivec2(0), lim);
    float d = lin(texelFetch(tDepth, q, 0).r);
    vec4 n = texelFetch(tNid, q, 0);
    float dd = abs(d - d0) / (0.02 + 0.035 * min(d, d0));
    float nd = 1.0 - dot(dn(n), N0);
    float idd = abs(n.z - n0.z) > 0.003 ? 1.0 : 0.0;
    float de = smoothstep(0.7, 1.3, dd) * step(d0, d);
    float se = max(smoothstep(0.12, 0.32, nd), idd * 0.85) * 0.9;
    float ink = d0 <= d ? n0.w : n.w;
    edge = max(edge, max(de * n0.w, se * ink));
  }
  float brk = vn2(fc / 7.0 + n0.z * 91.0 + uBoil * 5.0);
  edge *= mix(smoothstep(0.35, 0.65, brk + n0.w * 0.55), 1.0, smoothstep(0.55, 0.85, n0.w));
  vec4 col = texelFetch(tCol, ip, 0);
  vec3 graph = vec3(0.17, 0.175, 0.195);
  float a = clamp(edge, 0.0, 1.0) * (0.55 + 0.45 * paperGrain(fc));
  vec3 outc = mix(col.rgb, graph, a * 0.92);
  float dd0 = lin(texelFetch(tDepth, ip, 0).r);
  vec3 paper = vec3(0.957, 0.945, 0.918);
  outc = mix(outc, paper, smoothstep(uFogN, uFogF, dd0) * 0.92);
  oCol = vec4(outc, 1.0);
}`;

  const STROKE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aP;
layout(location=1) in vec3 aPrev;
layout(location=2) in vec3 aNext;
layout(location=3) in vec4 aT;
layout(location=4) in vec4 aS;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat4 uModel;
uniform mat4 uGroup[16];
uniform vec2 uRes;
uniform float uClock;
uniform float uWobble;
uniform float uBoil;
uniform float uBias;
uniform float uWidth;
out float vArc; out float vRev; out float vDist; out float vHW; out float vDark; out float vSeed; out float vFog;
${COMMON}
vec3 wob(vec3 p, float seed){
  if (uWobble <= 0.0) return p;
  return p + (vec3(vn3(p * 2.7 + seed + uBoil), vn3(p * 2.7 + seed + 17.0 + uBoil), vn3(p * 2.7 + seed + 31.0 + uBoil)) - 0.5) * uWobble;
}
vec4 toView(vec3 p){ mat4 G = uGroup[int(aS.w + 0.5)]; return uView * (uModel * (G * vec4(p, 1.0))); }
void main(){
  vec4 v = toView(wob(aP, aS.z));
  vec4 vp = toView(wob(aPrev, aS.z));
  vec4 vn = toView(wob(aNext, aS.z));
  float dist = -v.z;
  float b = uBias * (1.0 + 0.04 * max(dist, 0.0));
  v.xyz += normalize(-v.xyz) * b;
  vp.xyz += normalize(-vp.xyz) * b;
  vn.xyz += normalize(-vn.xyz) * b;
  vec4 c = uProj * v, cp = uProj * vp, cn = uProj * vn;
  vec2 s0 = cp.xy / max(cp.w, 0.02), s1 = cn.xy / max(cn.w, 0.02);
  vec2 dir = (s1 - s0) * uRes;
  float dl = length(dir);
  dir = dl > 1e-5 ? dir / dl : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float hw = aS.x * uWidth * 0.5 + 1.0;
  c.xy += nrm * hw * aT.w * 2.0 / uRes * c.w;
  gl_Position = c;
  vDist = aT.w * hw;
  vHW = aS.x * uWidth * 0.5;
  vRev = clamp((uClock - aT.y) / max(aT.z - aT.y, 1e-3), 0.0, 1.0);
  vArc = aT.x; vDark = aS.y; vSeed = aS.z; vFog = dist;
}`;

  const STROKE_FS = `#version 300 es
precision highp float;
in float vArc; in float vRev; in float vDist; in float vHW; in float vDark; in float vSeed; in float vFog;
uniform float uErase;
uniform float uAlpha;
uniform float uFogN;
uniform float uFogF;
uniform vec3 uInkCol;
out vec4 oCol;
${COMMON}
void main(){
  if (vRev <= 0.0 || vArc > vRev + 0.0005) discard;
  float cov = clamp(vHW + 0.5 - abs(vDist), 0.0, 1.0);
  if (cov <= 0.003) discard;
  float taper = smoothstep(0.0, 0.05, vArc) * smoothstep(1.0, 0.9, vArc);
  float head = (1.0 - smoothstep(0.0, 0.06, vRev - vArc)) * step(vRev, 0.999);
  vec2 fc = gl_FragCoord.xy;
  float g = paperGrain(fc);
  float a = cov * vDark * uAlpha * (0.42 + 0.58 * g) * (0.5 + 0.5 * taper) * (1.0 + head * 0.45);
  if (uErase > 0.0) {
    float e = h21(floor(fc * 0.6) + vSeed * 13.0);
    if (e < uErase) discard;
    a *= 1.0 - uErase * 0.6;
  }
  a *= 1.0 - smoothstep(uFogN, uFogF, vFog) * 0.9;
  oCol = vec4(uInkCol, clamp(a, 0.0, 1.0));
}`;

  const PART_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aP;
layout(location=1) in vec4 aC;
uniform mat4 uVP;
uniform float uScale;
out float vA; out float vType;
void main(){
  vec4 c = uVP * vec4(aP.xyz, 1.0);
  gl_Position = c;
  gl_PointSize = clamp(aP.w * uScale / max(c.w, 0.05), 1.0, 48.0);
  vA = aC.x; vType = aC.y;
}`;

  const PART_FS = `#version 300 es
precision highp float;
in float vA; in float vType;
out vec4 oCol;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float a;
  if (vType > 0.5) {
    a = (1.0 - smoothstep(0.03, 0.08, abs(q.x))) * (1.0 - smoothstep(0.3, 0.5, abs(q.y)));
    oCol = vec4(0.36, 0.37, 0.41, a * vA * 0.6);
  } else {
    a = 1.0 - smoothstep(0.25, 0.5, length(q));
    oCol = vec4(0.32, 0.32, 0.34, a * vA);
  }
  if (oCol.a < 0.01) discard;
}`;

  const FINAL_FS = `#version 300 es
precision highp float;
uniform sampler2D tF;
uniform vec2 uRes;
uniform float uFlash;
uniform float uVig;
uniform float uFade;
out vec4 oCol;
${COMMON}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  vec3 col = texture(tF, uv).rgb;
  vec3 paper = vec3(0.957, 0.945, 0.918);
  float g = paperGrain(fc);
  vec3 ink = paper - col;
  col = paper - ink * (0.74 + 0.26 * g);
  float fib = vn2(vec2(fc.x * 0.02, fc.y * 0.6)) * vn2(vec2(fc.x * 0.6, fc.y * 0.02) + 11.0);
  col -= (g - 0.5) * 0.018 + fib * 0.012;
  vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float v = smoothstep(0.45, 1.05, length(q));
  col *= 1.0 - v * 0.1 * uVig;
  col = mix(col, col * vec3(1.0, 0.972, 0.925), v * uVig);
  col = mix(col, paper, uFlash);
  col = mix(col, paper, uFade);
  oCol = vec4(col, 1.0);
}`;

  WK.Shaders = { COMMON, SURF_VS, SURF_FS, QUAD_VS, COMP_FS, STROKE_VS, STROKE_FS, PART_VS, PART_FS, FINAL_FS };
})();
