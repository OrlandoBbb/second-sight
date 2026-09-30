'use strict';
// Pencil renderer: drawn surfaces into a G-buffer, outlines + fog composite, depth-tested pencil strokes,
// particles (eraser dust, rain), then a paper finish to the canvas.
(function () {
  const R = WK.R = {};
  const GL = WK.GL, S = WK.Shaders;
  let gl, P = {}, quad, W = 0, H = 0;
  let texCol, texNid, texDepth, fbG, texF, fbF, fbFD;
  let partVao, partBuf, partCap = 0;
  const PAPER = [0.957, 0.945, 0.918, 1];
  R.stats = { draws: 0, strokes: 0, tris: 0 };

  R.init = canvas => {
    gl = GL.init(canvas);
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    P.surf = GL.program('surf', S.SURF_VS, S.SURF_FS);
    P.comp = GL.program('comp', S.QUAD_VS, S.COMP_FS);
    P.stroke = GL.program('stroke', S.STROKE_VS, S.STROKE_FS);
    P.part = GL.program('part', S.PART_VS, S.PART_FS);
    P.fin = GL.program('final', S.QUAD_VS, S.FINAL_FS);
    quad = GL.vao(new Float32Array([-1, -1, 3, -1, -1, 3]), [[0, 2]]);
    partVao = gl.createVertexArray();
    partBuf = gl.createBuffer();
    gl.bindVertexArray(partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
    R.gl = gl;
  };

  R.resize = (w, h) => {
    w = Math.max(16, w | 0); h = Math.max(16, h | 0);
    if (w === W && h === H) return;
    W = w; H = h;
    [texCol, texNid, texDepth, texF].forEach(t => t && gl.deleteTexture(t));
    [fbG, fbF, fbFD].forEach(f => f && gl.deleteFramebuffer(f));
    texCol = GL.tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    texNid = GL.tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    texDepth = GL.tex(W, H, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    texF = GL.tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    fbG = GL.fbo([texCol, texNid], texDepth);
    fbF = GL.fbo([texF], null);
    fbFD = GL.fbo([texF], texDepth);
  };
  R.size = () => [W, H];

  R.uploadMesh = built => GL.vao(built.data, [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 4]], built.index);
  R.uploadStrokes = packed => GL.vao(packed.data, [[0, 3], [1, 3], [2, 3], [3, 4], [4, 4]], packed.index);
  R.free = v => GL.freeVao(v);

  const IDENT16 = (() => { const a = new Float32Array(256); for (let i = 0; i < 16; i++) { a[i * 16] = a[i * 16 + 5] = a[i * 16 + 10] = a[i * 16 + 15] = 1; } return a; })();
  R.IDENT16 = IDENT16;

  // f: frame description (see WK.World.frame)
  R.render = (f, canvasW, canvasH) => {
    R.stats.draws = 0; R.stats.strokes = 0;
    // ---- G pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbG);
    gl.viewport(0, 0, W, H);
    gl.clearBufferfv(gl.COLOR, 0, PAPER);
    gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 0, 0]);
    gl.clearBufferfv(gl.DEPTH, 0, [1]);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
    let p = P.surf, u = p.u;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(u.uVP, false, f.vp);
    gl.uniformMatrix4fv(u.uView, false, f.view);
    gl.uniform3fv(u.uKey, f.key);
    gl.uniform3fv(u.uEye, f.eye);
    gl.uniform1f(u.uBoil, f.boil);
    gl.uniform4fv(u.uShadow, f.shadows);
    gl.uniform1i(u.uNShadow, f.nShadows);
    for (const o of f.objects) {
      gl.uniformMatrix4fv(u.uModel, false, o.model);
      gl.uniformMatrix4fv(u.uGroup, false, o.groups || IDENT16);
      gl.uniform1f(u.uM0, o.m0 || 0); gl.uniform1f(u.uM1, o.m1); gl.uniform1f(u.uM2, o.m2); gl.uniform1f(u.uWob, o.wob || 0);
      gl.uniform1f(u.uReveal, o.reveal); gl.uniform1f(u.uConf, o.conf); gl.uniform1f(u.uInk, o.ink);
      gl.uniform1f(u.uErase, o.erase || 0); gl.uniform1f(u.uObjId, o.idn); gl.uniform1f(u.uHatchAng, o.hatchAng || 0.6);
      gl.uniform1f(u.uColorAmt, o.colorAmt || 0); gl.uniform1f(u.uDetail, o.detail || 0); gl.uniform1f(u.uLit, o.lit || 0);
      gl.uniform1f(u.uTint, o.tint || 0); gl.uniform3fv(u.uTintCol, o.tintCol || [0.8, 0.18, 0.15]);
      gl.uniform3fv(u.uColor, o.color || [0.86, 0.64, 0.22]);
      gl.uniform3fv(u.uColor2, o.color2 || [0.74, 0.16, 0.13]);
      GL.draw(o.mesh);
      R.stats.draws++;
    }
    // ---- composite: outlines + fog
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbF);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    p = P.comp; u = p.u;
    gl.useProgram(p.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texCol); gl.uniform1i(u.tCol, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texNid); gl.uniform1i(u.tNid, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDepth); gl.uniform1i(u.tDepth, 2);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uNear, f.near); gl.uniform1f(u.uFar, f.far);
    gl.uniform1f(u.uBoil, f.boil); gl.uniform1f(u.uFogN, f.fogN); gl.uniform1f(u.uFogF, f.fogF);
    gl.uniform1f(u.uLineW, Math.max(1, Math.round(H / 1150)));
    GL.draw(quad);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    // ---- strokes (depth tested against the drawn surfaces)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbFD);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    p = P.stroke; u = p.u;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(u.uView, false, f.view);
    gl.uniformMatrix4fv(u.uProj, false, f.proj);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uWidth, Math.max(0.85, H / 1080));
    gl.uniform1f(u.uFogN, f.fogN); gl.uniform1f(u.uFogF, f.fogF);
    for (const b of f.batches) {
      if (!b.vao) continue;
      gl.uniformMatrix4fv(u.uModel, false, b.model);
      gl.uniformMatrix4fv(u.uGroup, false, b.groups || IDENT16);
      gl.uniform1f(u.uClock, b.clock);
      gl.uniform1f(u.uWobble, b.wobble || 0);
      gl.uniform1f(u.uBoil, b.boil || 0);
      gl.uniform1f(u.uBias, b.bias !== undefined ? b.bias : 0.012);
      gl.uniform1f(u.uErase, b.erase || 0);
      gl.uniform1f(u.uAlpha, b.alpha !== undefined ? b.alpha : 1);
      gl.uniform3fv(u.uInkCol, b.inkCol || [0.16, 0.165, 0.19]);
      GL.draw(b.vao);
      R.stats.strokes++;
    }
    // ---- particles
    if (f.nParticles > 0) {
      p = P.part; u = p.u;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(u.uVP, false, f.vp);
      gl.uniform1f(u.uScale, H / (2 * Math.tan(f.fov / 2)));
      gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
      const need = f.nParticles * 8;
      if (need > partCap) { partCap = Math.max(need, partCap * 2, 4096); gl.bufferData(gl.ARRAY_BUFFER, partCap * 4, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, f.particles, 0, need);
      gl.bindVertexArray(partVao);
      gl.drawArrays(gl.POINTS, 0, f.nParticles);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    // ---- final page
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    p = P.fin; u = p.u;
    gl.useProgram(p.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texF); gl.uniform1i(u.tF, 0);
    gl.uniform2f(u.uRes, canvasW, canvasH);
    gl.uniform1f(u.uFlash, f.flash || 0); gl.uniform1f(u.uVig, f.vig !== undefined ? f.vig : 1); gl.uniform1f(u.uFade, f.fade || 0);
    GL.draw(quad);
    gl.bindVertexArray(null);
  };
})();
