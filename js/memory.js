'use strict';
// Case memory: the tables of the case on the page (MEM.use), the wordings shared by every case, and the state of
// one playthrough (what she has seen, what they admitted, which questions are answered).
(function () {
  const MEM = WK.Mem = {};

  MEM.use = C => {
    MEM.C = C;
    MEM.FACTS = C.facts; MEM.NOTICES = C.notices; MEM.CLAIMS = C.claims; MEM.QUESTIONS = C.questions;
    MEM.ANSWERS = C.answers || {}; MEM.MIDDLE = C.middle || {}; MEM.IMPORTANT = C.important || {};
    MEM.SEARCHES = C.searches || {}; MEM.IDLE = C.idle || [];
  };

  // Every line that can come up more than once has several wordings; a shuffle bag picks among them
  MEM.VARIANTS = {
    q_here: ['q_here', 'q_here2', 'q_here3', 'q_here4', 'q_here5', 'q_here6'],
    q_middle: ['q_middle', 'q_middle2', 'q_middle3'],
    q_room: ['q_room', 'q_room2', 'q_room3'],
    q_about: ['q_about', 'q_about2', 'q_about3', 'q_about4'],
    a_none: ['a_none1', 'a_none2', 'a_none3', 'a_none4', 'a_none5', 'a_none6'],
    a_more: ['a_more1', 'a_more2', 'a_more3', 'a_more4', 'a_more5'],
    s_none: ['s_none1', 's_none2', 's_none3', 's_none4', 's_none5'],
    tell_no: ['tell_no1', 'tell_no2', 'tell_no3', 'tell_no4'],
    pr_again: ['pr_again1', 'pr_again2', 'pr_again3'],
  };

  MEM.newState = C => ({
    C, f: {}, order: [], fired: {}, played: {}, solved: {}, t: 0, lastFactT: 0, lastLineT: 0, lastIdleT: 0, lastHintT: 0,
    idleUsed: {}, searched: {}, eligibleAt: {}, pend: {}, inflight: {}, visited: {}, contradicted: {}, bags: {},
    wallLook: {}, ceilLook: {}, saidRoom: {}, prSaid: {}, ideas: 0, answered: 0,
  });
  MEM.val = (S, v) => (typeof v === 'function' ? v(S.C, S) : v);
  MEM.eligible = (S, n) => {
    if (S.inflight[n.id] || S.fired[n.id]) return false;
    if (n.when && !n.when(S.C)) return false;
    if (n.need && n.need.some(f => !S.f[f])) return false;
    if (n.not && n.not.some(f => S.f[f])) return false;
    return true;
  };
  MEM.addFact = (S, id) => {
    if (!id || S.f[id]) return false;
    S.f[id] = S.t; S.order.push(id); S.lastFactT = S.t;
    return true;
  };
  MEM.ready = (S, q) => q.needs.every(f => S.f[f]);
  MEM.have = (S, q) => q.needs.filter(f => S.f[f]).length;
})();
