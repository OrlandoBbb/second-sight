'use strict';
// Input: gamepad (two sticks + one face button), keyboard and mouse. Produces move/look vectors,
// the interact button state, and menu edges. A virtual pad can be injected for tests.
(function () {
  const U = WK.U;
  const I = WK.Input = {};
  I.keys = {};
  I.tapped = {};
  I.mouse = { dx: 0, dy: 0, left: false, right: false, locked: false };
  I.device = 'kbm';
  I.padType = 'xbox';
  I.padConnected = false;
  I.virtualPad = null;
  I.settings = { sens: 1, invert: false };
  I.move = [0, 0];
  I.look = [0, 0];
  I.act = { down: false, pressed: false, released: false };
  I.ask = { down: false, pressed: false };
  // touch: a thumb stick on the left, drag anywhere else to look, on-screen buttons
  I.touch = { on: false, stick: null, look: null, lookDX: 0, lookDY: 0, move: [0, 0], act: false, ask: false, menu: false };
  I.menu = { up: false, down: false, left: false, right: false, ok: false, back: false, pause: false };
  I.onGesture = null;
  I.onDevice = null;
  let prevPad = [], prevKeys = {}, prevMouseLeft = false, navHold = { dir: null, t: 0 };
  let canvasEl = null, suppressClick = false;

  const MOVE_KEYS = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] };
  const LOOK_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

  function setDevice(d) {
    if (I.device !== d) { I.device = d; if (I.onDevice) I.onDevice(d); }
  }

  I.init = canvas => {
    canvasEl = canvas;
    window.addEventListener('keydown', e => {
      if (e.code === 'Tab') e.preventDefault();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) I.tapped[e.code] = true;
      I.keys[e.code] = true;
      setDevice('kbm');
      if (I.onGesture) I.onGesture('key');
    });
    window.addEventListener('keyup', e => { I.keys[e.code] = false; });
    window.addEventListener('blur', () => { I.keys = {}; I.mouse.left = false; I.mouse.right = false; });
    initTouch(canvas);
    canvas.addEventListener('mousedown', e => {
      if (I.touch.on) return;
      setDevice('kbm');
      if (I.onGesture) I.onGesture('mouse');
      if (e.button === 0) {
        if (!I.mouse.locked && I.wantLock && I.wantLock()) { suppressClick = true; I.lock(); return; }
        I.mouse.left = true;
      }
      if (e.button === 2) { I.mouse.right = true; if (I.mouse.locked) I.mouse.rightClick = true; }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) { I.mouse.left = false; suppressClick = false; }
      if (e.button === 2) I.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mousemove', e => {
      if (I.mouse.locked || I.mouse.right) { I.mouse.dx += e.movementX || 0; I.mouse.dy += e.movementY || 0; setDevice('kbm'); }
    });
    document.addEventListener('pointerlockchange', () => { I.mouse.locked = document.pointerLockElement === canvas; });
    window.addEventListener('gamepadconnected', e => { I.padConnected = true; I.padType = padType(e.gamepad.id); setDevice('pad'); });
    window.addEventListener('gamepaddisconnected', () => { I.padConnected = !!firstPad(); });
  };
  I.lock = () => { try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } };
  I.unlock = () => { if (document.pointerLockElement) document.exitPointerLock(); };

  function padType(id) {
    id = (id || '').toLowerCase();
    if (/054c|dualsense|dualshock|playstation|wireless controller/.test(id)) return 'ps';
    if (/057e|pro controller|nintendo|joy-con/.test(id)) return 'nintendo';
    return 'xbox';
  }
  function firstPad() {
    if (I.virtualPad) return I.virtualPad;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  const dz = (x, y, d) => {
    const m = Math.hypot(x, y);
    if (m < d) return [0, 0];
    const k = Math.min(1, (m - d) / (1 - d)) / m;
    return [x * k, y * k];
  };
  const btn = (p, i) => !!(p && p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));

  I.update = dt => {
    const p = firstPad();
    if (p && !I.virtualPad) { I.padConnected = true; I.padType = padType(p.id); }
    // --- move
    let mx = 0, my = 0;
    for (const k in MOVE_KEYS) if (I.keys[k]) { mx += MOVE_KEYS[k][0]; my += MOVE_KEYS[k][1]; }
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    let lx = 0, ly = 0;
    for (const k in LOOK_KEYS) if (I.keys[k]) { lx += LOOK_KEYS[k][0]; ly += LOOK_KEYS[k][1]; }
    let look = [lx * 1.9 * dt, ly * 1.4 * dt];
    if (p) {
      const L = dz(p.axes[0] || 0, p.axes[1] || 0, 0.16), Rr = dz(p.axes[2] || 0, p.axes[3] || 0, 0.14);
      if (Math.hypot(L[0], L[1]) > 0 || Math.hypot(Rr[0], Rr[1]) > 0) setDevice('pad');
      mx += L[0]; my += -L[1];
      const curve = v => Math.sign(v) * Math.pow(Math.abs(v), 1.7);
      look[0] += curve(Rr[0]) * 2.5 * I.settings.sens * dt;
      look[1] += -curve(Rr[1]) * 1.7 * I.settings.sens * dt;
      for (let i = 0; i < 16; i++) if (btn(p, i)) setDevice('pad');
    }
    const ml2 = Math.hypot(mx, my); if (ml2 > 1) { mx /= ml2; my /= ml2; }
    I.move = [mx, my];
    look[0] += I.mouse.dx * 0.0022 * I.settings.sens;
    look[1] += -I.mouse.dy * 0.0022 * I.settings.sens;
    I.mouse.dx = 0; I.mouse.dy = 0;
    // touch contributions
    if (I.touch.on) {
      mx += I.touch.move[0]; my += I.touch.move[1];
      look[0] += I.touch.lookDX * 0.0042 * I.settings.sens; look[1] += -I.touch.lookDY * 0.0042 * I.settings.sens;
      I.touch.lookDX = 0; I.touch.lookDY = 0;
      const tl = Math.hypot(mx, my); if (tl > 1) { mx /= tl; my /= tl; }
      I.move = [mx, my];
    }
    if (I.settings.invert) look[1] = -look[1];
    I.look = look;
    // --- interact (A / E / Space / left mouse)
    const mouseAct = I.mouse.left && I.mouse.locked && !suppressClick;
    // a press that starts and ends between two frames still counts as one frame held
    const quick = (I.tapped.KeyE && !I.keys.KeyE) || (I.tapped.Space && !I.keys.Space);
    // touch: a finger held still on the view becomes a hold on that point
    const TL = I.touch.look;
    if (TL && !TL.moved && !TL.hold && performance.now() - TL.t0 > 330) { TL.hold = true; I.touch.act2 = true; I.aimPoint = { x: TL.x0, y: TL.y0 }; }
    const down = btn(p, 0) || !!I.keys.KeyE || !!I.keys.Space || mouseAct || (quick && !I.act.down) || I.touch.act || !!I.touch.act2;
    I.act.pressed = down && !I.act.down;
    I.act.released = !down && I.act.down;
    I.act.down = down;
    const askDown = btn(p, 2) || !!I.keys.KeyQ;
    I.ask.pressed = (askDown && !I.ask.down) || !!I.tapped.KeyQ && !prevKeys.KeyQ || !!I.mouse.rightClick || !!I.touch.askTap;
    I.ask.at = I.touch.askTap ? I.touch.tapAt : null;
    I.ask.down = askDown; I.mouse.rightClick = false; I.touch.askTap = false;
    // --- menu edges
    const kEdge = code => (!!I.keys[code] && !prevKeys[code]) || (!!I.tapped[code] && !prevKeys[code]);
    const pEdge = i => btn(p, i) && !prevPad[i];
    let dir = null;
    if (I.keys.ArrowUp || I.keys.KeyW || btn(p, 12) || (p && (p.axes[1] || 0) < -0.6)) dir = 'up';
    else if (I.keys.ArrowDown || I.keys.KeyS || btn(p, 13) || (p && (p.axes[1] || 0) > 0.6)) dir = 'down';
    else if (I.keys.ArrowLeft || I.keys.KeyA || btn(p, 14) || (p && (p.axes[0] || 0) < -0.6)) dir = 'left';
    else if (I.keys.ArrowRight || I.keys.KeyD || btn(p, 15) || (p && (p.axes[0] || 0) > 0.6)) dir = 'right';
    I.menu.up = I.menu.down = I.menu.left = I.menu.right = false;
    if (dir) {
      if (navHold.dir !== dir) { navHold.dir = dir; navHold.t = 0.42; I.menu[dir] = true; }
      else { navHold.t -= dt; if (navHold.t <= 0) { navHold.t = 0.12; I.menu[dir] = true; } }
    } else navHold.dir = null;
    I.menu.ok = kEdge('Enter') || kEdge('Space') || kEdge('KeyE') || pEdge(0);
    I.menu.back = kEdge('Escape') || kEdge('Backspace') || pEdge(1);
    I.menu.pause = kEdge('Escape') || kEdge('KeyP') || pEdge(9) || !!I.touch.menuTap;
    I.touch.menuTap = false;
    I.menu.memories = kEdge('Tab') || kEdge('KeyM') || pEdge(8);
    I.menu.any = I.menu.ok || kEdge('Enter') || pEdge(0) || pEdge(9);
    prevKeys = Object.assign({}, I.keys);
    I.tapped = {};
    prevPad = [];
    if (p) for (let i = 0; i < 17; i++) prevPad[i] = btn(p, i);
  };

  // Glyph for the interact button and the ask button, per device
  I.glyph = () => {
    if (I.device === 'touch') return '✎';
    if (I.device === 'pad') return I.padType === 'ps' ? '✕' : I.padType === 'nintendo' ? 'B' : 'A';
    return 'E';
  };
  I.askGlyph = () => {
    if (I.device === 'touch') return '✎';
    if (I.device === 'pad') return I.padType === 'ps' ? '□' : I.padType === 'nintendo' ? 'Y' : 'X';
    return 'Q';
  };

  function initTouch(canvas) {
    const T = I.touch;
    const ui = document.getElementById('touch');
    const stickEl = document.getElementById('t-stick'), knob = document.getElementById('t-knob');
    const enable = () => { if (!T.on) { T.on = true; document.body.classList.add('touch'); } setDevice('touch'); };
    window.addEventListener('touchstart', () => { enable(); if (I.onGesture) I.onGesture('touch'); }, { passive: true, capture: true });
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0) enable();
    const stickR = 60;
    canvas.addEventListener('touchstart', e => {
      enable();
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.42 && t.clientY > window.innerHeight * 0.35;
        if (left && !T.stick) { T.stick = { id: t.identifier, x: t.clientX, y: t.clientY }; stickEl.style.left = (t.clientX - stickR) + 'px'; stickEl.style.top = (t.clientY - stickR) + 'px'; stickEl.classList.add('on'); }
        else if (!T.look) T.look = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now(), moved: false, hold: false };
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (T.stick && t.identifier === T.stick.id) {
          let dx = t.clientX - T.stick.x, dy = t.clientY - T.stick.y; const l = Math.hypot(dx, dy);
          if (l > stickR) { dx *= stickR / l; dy *= stickR / l; }
          T.move = [dx / stickR, -dy / stickR];
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (T.look && t.identifier === T.look.id) {
          if (Math.hypot(t.clientX - T.look.x0, t.clientY - T.look.y0) > 12) T.look.moved = true;
          // a finger resting on something is naming it, not looking around
          if (T.look.moved && !T.look.hold) { T.lookDX += t.clientX - T.look.x; T.lookDY += t.clientY - T.look.y; }
          T.look.x = t.clientX; T.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (T.stick && t.identifier === T.stick.id) { T.stick = null; T.move = [0, 0]; knob.style.transform = ''; stickEl.classList.remove('on'); }
        if (T.look && t.identifier === T.look.id) {
          // a quick tap asks about what is under the finger; a hold names it (released here)
          if (T.look.hold) T.act2 = false;
          else if (!T.look.moved && performance.now() - T.look.t0 < 350) { T.tapAt = { x: T.look.x0, y: T.look.y0 }; T.askTap = true; }
          T.look = null;
        }
      }
    };
    canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { enable(); on(); el.classList.add('down'); e.preventDefault(); e.stopPropagation(); if (I.onGesture) I.onGesture('touch'); }, { passive: false });
      const up = e => { off(); el.classList.remove('down'); e.preventDefault(); };
      el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
    };
    hold('t-act', () => { T.act = true; }, () => { T.act = false; });
    hold('t-menu', () => { T.menuTap = true; }, () => {});
  }
  I.glyphClass = () => (I.device === 'pad' ? 'pad ' + I.padType : 'key');
})();
