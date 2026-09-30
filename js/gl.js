'use strict';
// Thin WebGL2 helpers: programs, buffers, render targets.
(function () {
  const GL = WK.GL = {};
  let gl = null;

  GL.init = canvas => {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    GL.gl = gl;
    return gl;
  };

  function compile(type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error(name + ' shader error\n' + log + '\n' + lines);
      throw new Error(name + ': ' + log);
    }
    return s;
  }

  GL.program = (name, vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs, name + '.vs'));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs, name + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ' link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const key = info.name.replace(/\[0\]$/, '');
      u[key] = gl.getUniformLocation(p, info.name);
    }
    return { p, u, name };
  };

  // layout: [[location, size], ...] interleaved float attributes
  GL.vao = (data, layout, index) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = layout.reduce((s, l) => s + l[1], 0) * 4;
    let off = 0;
    for (const [loc, size] of layout) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
      off += size * 4;
    }
    let ib = null, count = data.length / (stride / 4), type = 0;
    if (index) {
      ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      const arr = count > 65535 ? new Uint32Array(index) : new Uint16Array(index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      type = arr instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      count = index.length;
    }
    gl.bindVertexArray(null);
    return { vao, vb, ib, count, type, bytes: data.byteLength + (index ? index.length * 4 : 0) };
  };

  GL.freeVao = v => {
    if (!v) return;
    gl.deleteVertexArray(v.vao);
    gl.deleteBuffer(v.vb);
    if (v.ib) gl.deleteBuffer(v.ib);
  };

  GL.draw = (v, mode) => {
    gl.bindVertexArray(v.vao);
    if (v.ib) gl.drawElements(mode === undefined ? gl.TRIANGLES : mode, v.count, v.type, 0);
    else gl.drawArrays(mode === undefined ? gl.TRIANGLES : mode, 0, v.count);
  };

  GL.tex = (w, h, ifmt, fmt, type, filter) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  GL.fbo = (colors, depth) => {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    colors.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    gl.drawBuffers(colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete ' + st);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  };
})();
