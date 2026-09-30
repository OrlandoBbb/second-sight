'use strict';
// Narration: plays local voice files (HTML audio works from file://), one line at a time with a short human
// pause between lines, fires cue callbacks at timed words, and draws synchronized subtitles.
(function () {
  const Vo = WK.Voice = {};
  const D = () => (WK.VOICE_DATA ? WK.VOICE_DATA.lines : {});
  Vo.cur = null;
  Vo.queue = [];
  Vo.log = [];
  Vo.rate = 1;
  Vo.subsOn = true;
  Vo.subScale = 1;
  Vo.gapLeft = 0;
  Vo.lastEnd = -99;
  const pool = {};
  let subEl = null, lastHtml = '';

  Vo.init = () => { subEl = document.getElementById('subs-line'); };
  Vo.has = id => !!D()[id];
  Vo.dur = id => (D()[id] ? D()[id].d : 0);
  Vo.busy = () => !!Vo.cur || Vo.queue.length > 0;
  Vo.playing = () => (Vo.cur ? Vo.cur.id : null);

  function audioFor(id) {
    const d = D()[id];
    if (!d || !d.f) return null;
    if (!pool[id]) { const a = new Audio(); a.preload = 'auto'; a.src = d.f; pool[id] = a; }
    return pool[id];
  }
  Vo.preload = ids => { for (const id of ids) audioFor(id); };

  // o: {pri (0 idle .. 3 must), interrupt, onCue(name), onStart, onEnd, gap}
  Vo.play = (id, o) => {
    o = o || {};
    if (!D()[id]) { console.warn('missing line', id); if (o.onStart) o.onStart(); if (o.onCue) for (const k of ['flash', 'move']) o.onCue(k); if (o.onEnd) o.onEnd(); return; }
    const item = { id, pri: o.pri === undefined ? 1 : o.pri, onCue: o.onCue, onStart: o.onStart, onEnd: o.onEnd, onDrop: o.onDrop, gap: o.gap === undefined ? 0.45 : o.gap, tag: o.tag, expire: o.expire || 0, queuedAt: WK.U.now() };
    if (o.interrupt) { Vo.stop(true); Vo.queue = Vo.queue.filter(q => q.pri >= 3); Vo.queue.unshift(item); Vo.gapLeft = 0.12; return item; }
    if (Vo.cur && Vo.cur.pri === 0 && item.pri > 0) { Vo.stop(true); Vo.queue.unshift(item); Vo.gapLeft = 0.25; return item; }
    // keep the queue short: drop idle chatter first
    Vo.queue = Vo.queue.filter(q => !(q.pri === 0 && item.pri > 0));
    if (Vo.queue.length >= 3 && item.pri <= 1) return null;
    let i = Vo.queue.findIndex(q => q.pri < item.pri);
    if (i < 0) i = Vo.queue.length;
    Vo.queue.splice(i, 0, item);
    return item;
  };

  function start(item) {
    const d = D()[item.id];
    item.data = d; item.fired = {}; item.t = 0; item.fb = false; item.started = WK.U.now();
    const a = audioFor(item.id);
    item.audio = a;
    if (a) {
      try {
        a.currentTime = 0;
        a.volume = WK.Audio.voiceVolume();
        a.playbackRate = Vo.rate;
        const p = a.play();
        if (p && p.catch) p.catch(() => { item.fb = true; });
      } catch (e) { item.fb = true; }
    } else item.fb = true;
    Vo.cur = item;
    Vo.log.push({ id: item.id, at: WK.U.now(), fb: item.fb });
    WK.Audio.duck = 0.55; WK.Audio.apply();
    if (item.onStart) item.onStart();
  }
  function finish(item, cut) {
    if (item.audio && !item.audio.paused) { try { item.audio.pause(); } catch (e) { /* ignore */ } }
    if (item.onCue && item.data) for (const k in item.data.cue) if (!item.fired[k]) { item.fired[k] = true; item.onCue(k); }
    Vo.cur = null;
    Vo.lastEnd = WK.U.now();
    const log = Vo.log[Vo.log.length - 1];
    if (log && log.id === item.id) { log.end = Vo.lastEnd; log.cut = !!cut; log.fb = item.fb; }
    Vo.gapLeft = item.gap;
    WK.Audio.duck = 1; WK.Audio.apply();
    if (item.onEnd) item.onEnd(cut);
  }
  Vo.stop = cut => { if (Vo.cur) finish(Vo.cur, cut); };
  Vo.clear = () => { Vo.queue = []; Vo.stop(true); };

  Vo.time = () => {
    const c = Vo.cur;
    if (!c) return 0;
    if (c.fb) return c.t;
    return c.audio ? c.audio.currentTime : c.t;
  };

  Vo.update = dt => {
    if (!Vo.cur) {
      Vo.gapLeft -= dt;
      while (Vo.gapLeft <= 0 && Vo.queue.length) {
        const q = Vo.queue.shift();
        if (q.expire && WK.U.now() - q.queuedAt > q.expire) { Vo.log.push({ id: q.id, at: WK.U.now(), dropped: true }); if (q.onDrop) q.onDrop(); continue; }
        start(q); break;
      }
    }
    const c = Vo.cur;
    if (c) {
      if (c.fb) c.t += dt * Vo.rate;
      else if (c.audio) {
        c.audio.volume = WK.Audio.voiceVolume();
        c.audio.playbackRate = Vo.rate;
        // an element that never starts (blocked or failed) falls back to the text clock
        if (c.audio.paused && !c.audio.ended && WK.U.now() - c.started > 1.2 && c.audio.currentTime === 0) { c.fb = true; c.t = WK.U.now() - c.started; }
      }
      const t = Vo.time();
      for (const k in c.data.cue) if (!c.fired[k] && t >= c.data.cue[k]) { c.fired[k] = true; if (c.onCue) c.onCue(k); }
      const done = c.fb ? t >= c.data.d : (c.audio.ended || t >= c.data.d + 0.25);
      if (done) finish(c, false);
    }
    drawSubs();
  };

  function drawSubs() {
    if (!subEl) return;
    let html = '';
    const c = Vo.cur;
    if (c && Vo.subsOn) {
      const t = Vo.time(), d = c.data;
      const ch = d.ch.find(x => t >= x[0] && t <= x[1]) || (t < (d.ch[0] || [0])[0] ? null : null);
      if (ch) {
        const parts = [];
        for (let i = ch[2]; i <= ch[3]; i++) {
          const w = d.w[i];
          const txt = d.sub.slice(w[2], w[3]).replace(/&/g, '&amp;').replace(/</g, '&lt;');
          const key = d.hl && d.hl.some(h => w[2] < h[1] && w[3] > h[0]);
          parts.push('<span class="w' + (t >= w[0] - 0.02 ? ' on' : '') + (key ? ' k' : '') + '">' + txt + '</span>');
        }
        const who = d.who && Vo.names ? Vo.names[d.who] : '';
        html = (who ? '<span class="who">' + who + '</span> ' : '') + parts.join(' ');
        const cls = Vo.lineClass ? Vo.lineClass(c.id) : '';
        if (cls) html = '<span class="' + cls + '">' + html + '</span>';
        Vo.subChunk = ch;
      } else Vo.subChunk = null;
    } else Vo.subChunk = null;
    if (html !== lastHtml) {
      subEl.innerHTML = html;
      subEl.parentElement.classList.toggle('show', !!html);
      lastHtml = html;
    }
  }
  Vo.subText = () => (subEl ? subEl.textContent : '');
})();
