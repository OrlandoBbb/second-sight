'use strict';
// Menus (title, pause, what I remember, settings, end) with controller, keyboard and mouse navigation.
(function () {
  const I = WK.Input, A = WK.Audio, Vo = WK.Voice, MEM = WK.Mem;
  const UI = WK.UI = {};
  UI.stack = [];
  UI.settings = { subs: true, subSize: 1, sens: 1, invert: false, quality: ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 0.7 : 1, hand: true, suggest: 'gentle' };
  try { Object.assign(UI.settings, JSON.parse(localStorage.getItem('wamk_settings') || '{}')); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem('wamk_settings', JSON.stringify(UI.settings)); } catch (e) { /* ignore */ } apply(); };
  function apply() {
    I.settings.sens = UI.settings.sens; I.settings.invert = UI.settings.invert;
    Vo.subsOn = UI.settings.subs;
    document.documentElement.style.setProperty('--sub-scale', String(UI.settings.subSize));
    document.body.classList.toggle('look-red', UI.settings.look === 'red');
    document.body.classList.toggle('look-white', UI.settings.look === 'white');
  }
  UI.open = id => {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    UI.stack.push(id);
    UI.focus = 0;
    refreshItems();
    if (id === 'memories') UI.refreshNotes();
    syncSettings();
    focusItem();
    I.unlock();
  };
  UI.close = () => {
    const id = UI.stack.pop();
    if (id) document.getElementById(id).classList.add('hidden');
    const prev = UI.stack[UI.stack.length - 1];
    if (prev) { document.getElementById(prev).classList.remove('hidden'); UI.focus = 0; refreshItems(); focusItem(); }
    return prev;
  };
  UI.top = () => UI.stack[UI.stack.length - 1] || null;
  UI.closeAll = () => { while (UI.stack.length) UI.close(); };
  let items = [];
  function refreshItems() {
    const id = UI.top(); if (!id) { items = []; return; }
    items = Array.from(document.getElementById(id).querySelectorAll('.item')).filter(e => !e.classList.contains('hidden'));
  }
  function focusItem() {
    items.forEach((e, i) => e.classList.toggle('focus', i === UI.focus));
  }

  function act(name, el) {
    A.play('paper');
    const G = WK.Game;
    switch (name) {
      case 'start': UI.closeAll(); document.getElementById('hud').classList.remove('hidden'); G.start(el && el.dataset.case); if (el && el.__clicked && !I.touch.on) I.lock(); break;
      case 'next': UI.closeAll(); A.music(false); document.getElementById('hud').classList.remove('hidden'); G.start(G.nextCase() || 'c1'); break;
      case 'resume': UI.resume(); break;
      case 'memories': UI.open('memories'); break;
      case 'settings': UI.open('settings'); break;
      case 'back': UI.back(); break;
      case 'restart': UI.closeAll(); G.start(G.caseId); break;
      case 'title': UI.closeAll(); Vo.clear(); A.music(false); G.boot(); document.getElementById('hud').classList.add('hidden'); UI.open('title'); break;
      case 'again': UI.closeAll(); A.music(false); G.start(G.caseId); break;
      case 'toggle': toggle(el.dataset.key); break;
    }
  }
  UI.act = act;
  UI.back = () => {
    const top = UI.top();
    if (top === 'pause') { UI.resume(); return; }
    if (top === 'title' || top === 'end') return;
    UI.close();
  };
  UI.pause = () => {
    if (WK.Game.mode !== 'explore' || WK.Game.paused) return;
    WK.Game.paused = true;
    if (Vo.cur && Vo.cur.audio) try { Vo.cur.audio.pause(); } catch (e) { /* ignore */ }
    UI.open('pause');
  };
  UI.resume = () => {
    UI.closeAll();
    WK.Game.paused = false;
    if (Vo.cur && Vo.cur.audio && !Vo.cur.fb) Vo.cur.audio.play().catch(() => {});
  };
  function toggle(key) {
    const s = UI.settings;
    if (key === 'subs') s.subs = !s.subs;
    if (key === 'invert') s.invert = !s.invert;
    if (key === 'mute') { A.vol.muted = !A.vol.muted; A.save(); }
    if (key === 'subSize') s.subSize = s.subSize >= 1.3 ? 0.85 : s.subSize >= 1 ? 1.3 : 1;
    if (key === 'quality') s.quality = s.quality >= 1 ? 0.7 : 1;
    if (key === 'look') s.look = s.look === 'red' ? 'white' : s.look === 'white' ? 'pencil' : 'red';
    if (key === 'suggest') s.suggest = s.suggest === 'gentle' ? 'often' : s.suggest === 'often' ? 'off' : 'gentle';
    save(); syncSettings();
  }
  function syncSettings() {
    const s = UI.settings;
    for (const el of document.querySelectorAll('#settings input[type=range]')) {
      const k = el.dataset.key;
      el.value = k === 'sens' ? s.sens : A.vol[k];
    }
    const lab = (k, v) => { for (const e of document.querySelectorAll(`[data-key="${k}"] .val`)) e.textContent = v; };
    lab('subs', s.subs ? 'on' : 'off'); lab('invert', s.invert ? 'on' : 'off'); lab('mute', A.vol.muted ? 'on' : 'off');
    lab('subSize', s.subSize >= 1.3 ? 'large' : s.subSize >= 1 ? 'medium' : 'small');
    lab('quality', s.quality >= 1 ? 'full' : 'lighter');
    lab('suggest', s.suggest || 'gentle');
    const lk = { pencil: 'pencil on paper', red: 'red on dark', white: 'white on dark' };
    for (const e of document.querySelectorAll('[data-key="look"] .val')) e.textContent = lk[s.look || 'pencil'];
  }

  UI.refreshNotes = () => {
    const G = WK.Game, S = G.S, C = G.C, el = document.getElementById('mem-list');
    if (!S || !el || !C) return;
    const qs = C.questions.map(q => {
      if (S.solved[q.id]) return `<li class="q done"><b>${q.text}</b> ${q.solved}</li>`;
      const have = MEM.have(S, q), ready = MEM.ready(S, q);
      return `<li class="q"><b>${q.text}</b> <span class="${ready ? 'ready' : 'dim'}">${ready ? 'You know. Hold on it to tell them.' : have + ' of ' + q.needs.length + ' things that prove it'}</span></li>`;
    }).join('');
    const told = Object.keys(C.claims).filter((k, i, a) => a.findIndex(x => C.claims[x].text === C.claims[k].text) === i)
      .map(k => `<li class="claim ${S.contradicted[k] ? 'struck' : ''}">“${C.claims[k].text}”${S.contradicted[k] ? ' <span class="took">they took it back</span>' : ''}</li>`).join('');
    const seen = S.order.filter(f => MEM.FACTS[f]).map(f => `<li>${MEM.FACTS[f]}</li>`).join('');
    el.innerHTML = `<li class="head">${C.title} &middot; ${C.victim}</li>` + qs + '<li class="head">What they told me</li>' + told + '<li class="head">What I found</li>' + (seen || '<li class="empty">Nothing yet. Tap things to ask about them.</li>');
    const g = document.getElementById('mem-guesses');
    if (g) g.textContent = '';
  };
  UI.refreshMemories = UI.refreshNotes;

  UI.showEnd = (S, C) => {
    const secs = Math.round(S.t);
    document.getElementById('end-stars').innerHTML = `<p class="dim">Case closed</p><h2 class="hand">${C.endTitle}</h2>`;
    document.getElementById('end-body').innerHTML = `<p>${C.endText}</p>
      <p class="dim">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} in the flat &nbsp;·&nbsp; ${S.ideas} good ideas &nbsp;·&nbsp; ${Object.keys(S.contradicted).length} things they took back</p>`;
    document.getElementById('end-next').classList.toggle('hidden', !C.next);
    UI.open('end');
  };

  UI.init = () => {
    for (const el of document.querySelectorAll('[data-act]')) {
      el.addEventListener('click', e => { e.stopPropagation(); A.unlock(); el.__clicked = true; act(el.dataset.act, el); el.__clicked = false; });
      el.addEventListener('mouseenter', () => { const i = items.indexOf(el); if (i >= 0) { UI.focus = i; focusItem(); } });
    }
    for (const el of document.querySelectorAll('#settings input[type=range]')) {
      el.addEventListener('input', () => {
        const k = el.dataset.key, v = parseFloat(el.value);
        if (k === 'sens') { UI.settings.sens = v; save(); } else { A.vol[k] = v; A.save(); }
      });
    }
    apply(); syncSettings();
  };

  UI.update = () => {
    const top = UI.top();
    if (!top) {
      if (I.menu.pause && WK.Game.mode === 'explore') UI.pause();
      else if (I.menu.memories && WK.Game.mode === 'explore') { UI.pause(); UI.open('memories'); }
      return;
    }
    if (!items.length) refreshItems();
    if (I.menu.up) { UI.focus = (UI.focus + items.length - 1) % items.length; focusItem(); A.play('tick'); }
    if (I.menu.down) { UI.focus = (UI.focus + 1) % items.length; focusItem(); A.play('tick'); }
    const el = items[UI.focus];
    if (el && (I.menu.left || I.menu.right)) {
      const r = el.querySelector('input[type=range]');
      if (r) { const st = parseFloat(r.step) || 0.1; r.value = Math.min(parseFloat(r.max), Math.max(parseFloat(r.min), parseFloat(r.value) + (I.menu.right ? st : -st))); r.dispatchEvent(new Event('input')); }
      else if (el.dataset.act === 'toggle') act('toggle', el);
    }
    if (I.menu.ok && el) { if (!el.querySelector('input[type=range]')) act(el.dataset.act, el); }
    else if (I.menu.back || (I.menu.pause && top === 'pause')) UI.back();
  };
})();
