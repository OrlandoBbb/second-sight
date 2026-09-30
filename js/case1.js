'use strict';
// Case 1 — Flat 4B. Daniel Mercer, 41, piano teacher, killed with one blow in his living room.
// What really happened: his younger brother Owen, hiding from people he owed, had been living secretly in the
// storage room for two months. Daniel was ashamed of him and protected him: he told no one, pawned their mother's
// watch to pay part of the debt. That night Daniel phoned their sister Claire and asked her to come on Saturday:
// he was going to tell her everything. Owen panicked, hit him once with a brass owl bookend, washed it in the
// kitchen sink, put it back on the shelf the wrong way round, took his bag and left through the kitchen window.
// The front door stayed chained. The first officer shut the window because of the rain.
(function () {
  const K = WK.Kit, PI = K.PI, B = K.B, EL = K.EL, CY = K.CY;
  const W = (...a) => K.wall(...a);
  const rooms = [
    K.room('r_hall', 'the hall', 0, 3.2, 4.6, 7.0, [
      ...W('x', 7.07, -0.14, 3.2, 0, 2.6, 0.14, [{ a: 1.2, b: 2.1, y0: 0, y1: 2.05 }]),
      ...W('z', -0.07, 4.6, 7.14, 0, 2.6, 0.14),
      ...W('x', 4.6, 0, 3.2, 0, 2.6, 0.12, [{ a: 1.0, b: 2.3, y0: 0, y1: 2.1 }]),
      ...W('z', 3.2, 4.6, 7.0, 0, 2.6, 0.12, [{ a: 5.0, b: 6.3, y0: 0, y1: 2.1 }]),
      ...K.doorFrame('x', 6.99, 1.2, 2.1, 2.05),
      K.skirting('x', 7.0, 0, 1.2, 0, -1), K.skirting('x', 7.0, 2.1, 3.2, 0, -1),
    ]),
    K.room('r_kitchen', 'the kitchen', 0, 3.2, 0, 4.6, [
      ...W('x', -0.07, -0.14, 3.2, 0, 2.6, 0.14, [{ a: 0.9, b: 2.0, y0: 1.0, y1: 2.0 }]),
      ...W('z', -0.07, -0.14, 4.6, 0, 2.6, 0.14),
      ...W('z', 3.2, 2.4, 4.6, 0, 2.6, 0.12, [{ a: 3.1, b: 3.9, y0: 0, y1: 2.1 }]),
      ...K.windowFrame('x', -0.07, 0.9, 2.0, 1.0, 2.0, 1),
    ]),
    K.room('r_bath', 'the bathroom', 3.2, 5.4, 0, 2.4, [
      ...W('x', -0.07, 3.2, 5.4, 0, 2.6, 0.14, [{ a: 4.0, b: 4.8, y0: 1.6, y1: 2.15 }]),
      ...W('z', 3.2, 0, 2.4, 0, 2.6, 0.12),
      ...W('x', 2.4, 3.2, 5.4, 0, 2.6, 0.12, [{ a: 3.7, b: 4.5, y0: 0, y1: 2.05 }]),
      ...K.doorFrame('x', 2.46, 3.7, 4.5, 2.05),
    ]),
    K.room('r_store', 'the storage room', 5.4, 7.4, 0, 2.4, [
      ...W('x', -0.07, 5.4, 7.4, 0, 2.6, 0.14, [{ a: 6.0, b: 6.9, y0: 1.2, y1: 2.0 }]),
      ...W('z', 5.4, 0, 2.4, 0, 2.6, 0.12),
      ...W('x', 2.4, 5.4, 7.4, 0, 2.6, 0.12, [{ a: 5.9, b: 6.7, y0: 0, y1: 2.05 }]),
      ...K.windowFrame('x', -0.07, 6.0, 6.9, 1.2, 2.0, 1),
      ...K.doorFrame('x', 2.46, 5.9, 6.7, 2.05),
    ]),
    K.room('r_living', 'the living room', 3.2, 7.4, 2.4, 7.0, [
      ...W('x', 7.07, 3.2, 7.54, 0, 2.6, 0.14, [{ a: 5.0, b: 6.3, y0: 0.9, y1: 2.05 }]),
      ...W('z', 7.4, 2.4, 7.0, 0, 2.6, 0.12, [{ a: 4.4, b: 5.3, y0: 0, y1: 2.05 }]),
      ...K.windowFrame('x', 7.07, 5.0, 6.3, 0.9, 2.05, -1),
      ...K.doorFrame('z', 7.34, 4.4, 5.3, 2.05),
      B([6.9, 1.4, 6.95], [0.06, 1.9, 0.34], { appear: 3, mat: WK.Geo.MAT.FABRIC, tone: 0.22, nocol: true, tag: 'curtain' }),
      K.skirting('x', 7.0, 3.2, 5.0, 0, -1), K.skirting('x', 7.0, 6.3, 7.4, 0, -1),
    ]),
    K.room('r_bed', 'the bedroom', 7.4, 10, 0, 7.0, [
      ...W('x', -0.07, 7.4, 10.14, 0, 2.6, 0.14),
      ...W('x', 7.07, 7.4, 10.14, 0, 2.6, 0.14),
      ...W('z', 10.07, -0.14, 7.14, 0, 2.6, 0.14, [{ a: 2.5, b: 3.7, y0: 0.9, y1: 2.05 }]),
      ...W('z', 7.4, 0, 2.4, 0, 2.6, 0.12),
      ...K.windowFrame('z', 10.07, 2.5, 3.7, 0.9, 2.05, -1),
    ]),
  ];
  const things = [
    // hall
    K.frontDoor('front_door', 1.65, 6.985, PI),
    K.coatPegs('coats', 0.02, 5.8, PI / 2),
    K.hallTable('hall_table', 2.75, 4.84, 0, { name: 'the phone' }),
    // kitchen
    K.counter('counter', 0.31, 2.0, PI / 2, 2.6, { name: 'the kitchen sink' }),
    K.fridge('fridge', 0.38, 3.95, PI / 2),
    K.sash('window', 'the kitchen window', 1.45, 0.0, 0, 1.2),
    K.pinRack('rack', 2.65, 0.02, 0),
    K.kitchenTable('table', 1.9, 2.3, 0),
    K.bin('bin', 2.9, 0.35, 0),
    // bathroom
    K.toilet('toilet', 3.62, 0.34, 0),
    K.basin('basin', 4.85, 0.26, 0),
    K.bath('bath', 3.58, 1.55, 0),
    // storage room: boxes in front of the camp bed
    K.boxes('boxes', 6.75, 1.25, PI / 2, { search: { g: 1, trans: [0.3, 0, -0.9], at: [0, 0.6, 0], keep: true } }),
    K.boxes('boxes2', 5.9, 0.4, 0, { name: 'more boxes', search: null }),
    Object.assign(K.campBed('campbed', 6.95, 1.2, 0), { hidden: true }),
    // living room
    K.sofa('sofa', 4.9, 5.2, PI),
    K.coffeeTable('coffee_table', 4.9, 4.35, 0),
    K.rug('rug', 5.2, 4.6, 0, 2.6, 1.9),
    K.piano('piano', 4.2, 6.72, PI),
    K.bookcase('bookcase', 7.16, 3.4, -PI / 2),
    K.armchair('armchair', 6.75, 6.2, -2.4),
    K.innerDoor('bed_door', 'the bedroom door', 7.4, 4.85, PI / 2),
    // bedroom
    K.bed('bed', 9.0, 1.1, 0, 1.5),
    K.wardrobe('wardrobe', 9.0, 6.68, PI),
    K.nightstand('nightstand', 8.0, 0.35, 0),
    // found by searching (in colour)
    K.item('ticket', 'a pawn ticket', 0, 0, 0, 0.3, K.paperBits.ticket(), { attach: 'sofa', localPos: [-0.42, 0.47, 0.15, 0.3], colors: [[0.93, 0.83, 0.5], [0.5, 0.2, 0.15]] }),
    K.item('note', 'a note', 0, 0, 0, -0.2, K.paperBits.note(), { attach: 'piano', localPos: [0, 0.5, 0.72, -0.2], colors: [[0.95, 0.93, 0.85], [0.2, 0.25, 0.55]] }),
    // memory ink: what was there that night and isn't now
    K.vision('coat2', 'a second coat', 0, 0, 0, 0, [B([0.2, 1.28, 0.1], [0.32, 0.7, 0.12], K.fab(0.3, { bevel: 0.04 }))], { attach: 'coats', localPos: [0, 0, 0, 0] }),
    K.vision('toothbrush2', 'a second toothbrush', 0, 0, 0, 0, [CY([0.215, 1.02, -0.11], 0.005, 0.14, K.paint(0.3, { rot: [-0.25, 0, -0.2] }))], { attach: 'basin', localPos: [0, 0, 0, 0] }),
    // the weapon in the replay (the left owl, in his hand)
    Object.assign(K.item('owl_prop', 'the brass owl', 0, 0, 0, 0, [B([0, 0.07, 0], [0.08, 0.14, 0.14], K.col({ bevel: 0.02 })), EL([0, 0.17, 0.01], [0.045, 0.05, 0.045], K.col())]), { prop: true, colors: [[0.86, 0.64, 0.22], [0.2, 0.15, 0.1]] }),
  ];

  WK.Cases = WK.Cases || {};
  WK.Cases.c1 = {
    id: 'c1', title: 'Flat 4B', victim: 'Daniel Mercer', next: 'c2',
    rooms, things,
    bounds: [0.25, 0.25, 9.75, 6.75],
    zoneAt: (x, z) => {
      if (x < 3.2) return z < 4.6 ? 'r_kitchen' : 'r_hall';
      if (x < 7.4) { if (z < 2.4) return x < 5.4 ? 'r_bath' : 'r_store'; return 'r_living'; }
      return 'r_bed';
    },
    walkable: (x, z) => x > 0.2 && x < 9.8 && z > 0.2 && z < 6.8,
    start: { pos: [1.65, 0, 6.35], yaw: PI + 0.35, pitch: -0.12, zone: 'r_hall' },
    sceneHint: 'Where was he found? Go into the living room.',
    rain: [{ lo: [0.9, 0.9, -0.9], hi: [2.0, 2.2, -0.2], room: 'r_kitchen' }, { lo: [5.0, 0.8, 7.2], hi: [6.3, 2.2, 8.0], room: 'r_living' }, { lo: [10.2, 0.8, 2.5], hi: [11.0, 2.2, 3.7], room: 'r_bed' }],
    // the left owl was put back facing the wrong way
    setup(api) { api.turnGroup('bookcase', 1, [-0.6, 1.05, 0.03], PI); },
    // ---------- the story ----------
    intro: ['m1_b1', 'm1_b2', 'm1_b3', 'm1_b4', 'm1_b5', 'm1_b6', 'm1_b7'],
    enterRoom: { r_living: 'm1_found' },
    chalk: { head: [5.95, 4.05], dir: [-0.8, 0.6], lines: { m1_found: 1, m1_rug_r: 1, m1_a_rug: 1 } },
    claims: {
      noweapon: { text: 'No weapon was found.', line: 'm1_b3' },
      shut: { text: 'The windows were latched from the inside.', line: 'm1_b4' },
      alone: { text: 'He lived alone.', line: 'm1_b5' },
    },
    questions: [
      { id: 'weapon', text: 'What was he hit with?', needs: ['washed', 'owls'], objs: ['bookcase'], accept: ['m1_t_w1', 'm1_t_w2', 'm1_t_w3'], claim: 'noweapon', tint: 'bookcase', more: 'm1_p_w',
        solved: 'The brass owl bookend. Washed, and put back on the shelf.',
        hints: { washed: 'Where did the footprints go first?', owls: 'Something was put back. Look closely at the shelves.' } },
      { id: 'who', text: 'Who did it?', needs: ['lodger', 'owen'], objs: ['campbed', 'boxes', 'piano', 'note'], accept: ['m1_t_o1', 'm1_t_o2', 'm1_t_o3'], more: 'm1_p_o',
        solved: 'Owen Mercer, his brother. He was living in the storage room.',
        hints: { lodger: 'Someone else was here. Where would they sleep?', owen: 'Who was it? Look for a name. Search his things.' } },
      { id: 'why', text: 'Why?', needs: ['owen', 'pawn', 'call'], objs: ['hall_table', 'ticket', 'sofa'], accept: ['m1_t_y1', 'm1_t_y2', 'm1_t_y3'], more: 'm1_p_y',
        solved: 'Owen owed money. Daniel paid what he could, and was about to tell their sister.',
        hints: { pawn: 'Where did the money go? Search where he sat.', call: 'He called someone that night. Who?' } },
    ],
    facts: {
      scene: 'He was found face down on the living room rug. One blow, from behind.',
      glasses: 'Two glasses. One was washed. No prints.',
      argued: 'They argued at the kitchen table. Quietly.',
      tooth: 'There were two toothbrushes. One is gone.',
      coat: 'A second coat hung in the hall that night.',
      lodger: 'Someone was living in the storage room: a camp bed behind the boxes.',
      owen: 'A note in the piano stool: “Owen — this is the last time. D.” Owen is his younger brother.',
      owls: 'The two brass owls face the same way. One was put back wrong.',
      washed: 'Someone washed something heavy in the kitchen sink.',
      window: 'The kitchen window was open. The first officer shut it.',
      pawn: 'A pawn ticket: their mother’s watch, £1,100, two weeks ago.',
      call: 'At 9:40 he phoned his sister Claire and asked her to come on Saturday.',
      trail: 'Someone walked away from him, fast, toward the kitchen.',
      shelf: 'Afterwards they went back to the bookcase.',
      lived: 'They went into the storage room like someone who lived there.',
      out: 'They left through the kitchen window, into the rain.',
      lessons: 'He taught piano. Twelve pupils.',
      books: 'He kept everything in order.',
    },
    important: { scene: 1, glasses: 1, tooth: 1, coat: 1, lodger: 1, owen: 1, owls: 1, washed: 1, window: 1, pawn: 1, call: 1, trail: 1, lived: 1, out: 1 },
    notices: [
      { id: 'rug', obj: 'rug', stage: 1, lines: ['m1_rug', 'm1_rug_r'], fact: 'scene' },
      { id: 'door', obj: 'front_door', stage: 1, lines: ['m1_door'] },
      { id: 'piano', obj: 'piano', stage: 1, lines: ['m1_piano', 'm1_piano_r'], fact: 'lessons' },
      { id: 'sofa', obj: 'sofa', stage: 1, lines: ['m1_sofa'] },
      { id: 'glasses', obj: 'coffee_table', stage: 3, lines: ['m1_glass', 'm1_glass_r'], fact: 'glasses' },
      { id: 'table', obj: 'table', stage: 1, lines: ['m1_table'], fact: 'argued' },
      { id: 'books', obj: 'bookcase', stage: 2, lines: ['m1_books', 'm1_books_r'], fact: 'books' },
      { id: 'owls', obj: 'bookcase', stage: 3, lines: ['m1_owls', 'm1_owls_r', 'm1_owls2'], fact: 'owls', tint: 'bookcase' },
      { id: 'sink', obj: 'counter', stage: 2, lines: ['m1_sink'], fact: 'washed' },
      { id: 'window', obj: 'window', stage: 1, lines: ['m1_win', 'm1_win_r', 'm1_win_r2'], fact: 'window', claim: 'shut', tint: 'window', vision: { open: 'window' } },
      { id: 'tooth', obj: 'basin', stage: 2, lines: ['m1_tooth', 'm1_tooth_r'], fact: 'tooth', vision: 'toothbrush2' },
      { id: 'coat', obj: 'coats', stage: 2, lines: ['m1_coat', 'm1_coat_r'], fact: 'coat', vision: 'coat2' },
      { id: 'phone', obj: 'hall_table', stage: 2, lines: ['m1_phone', 'm1_phone_r', 'm1_phone_r2'], fact: 'call' },
      { id: 'bed', obj: 'bed', stage: 1, lines: ['m1_bed'] },
      { id: 'wardrobe', obj: 'wardrobe', stage: 2, lines: ['m1_wardrobe'] },
      { id: 'store', obj: 'boxes', stage: 1, lines: ['m1_store'] },
    ],
    searches: {
      sofa: { item: 'ticket', lines: ['m1_pawn', 'm1_pawn_r', 'm1_pawn_r2'], fact: 'pawn' },
      piano: { item: 'note', lines: ['m1_note', 'm1_note_r'], fact: 'owen' },
      boxes: { reveal: 'campbed', lines: ['m1_camp', 'm1_camp_r', 'm1_camp_r2'], fact: 'lodger', claim: 'alone', tint: 'campbed' },
    },
    answers: {
      front_door: 'm1_a_door', coats: 'm1_a_coats', hall_table: 'm1_a_phone', counter: 'm1_a_counter', fridge: 'm1_a_fridge', window: 'm1_a_window', rack: 'm1_a_rack',
      table: 'm1_a_table', bin: 'm1_a_bin', toilet: 'm1_a_toilet', basin: 'm1_a_basin', bath: 'm1_a_bath', boxes: 'm1_a_boxes', boxes2: 'm1_a_boxes',
      sofa: 'm1_a_sofa', coffee_table: 'm1_a_ctable', rug: 'm1_a_rug', piano: 'm1_a_piano', bookcase: 'm1_a_bookcase', armchair: 'm1_a_armchair', bed_door: 'm1_a_beddoor',
      bed: 'm1_a_bed', wardrobe: 'm1_a_wardrobe', nightstand: 'm1_a_nightstand',
      r_hall: 'm1_a_r_hall', r_kitchen: 'm1_a_r_kitchen', r_bath: 'm1_a_r_bath', r_store: 'm1_a_r_store', r_living: 'm1_a_r_living', r_bed: 'm1_a_r_bed',
    },
    middle: { coffee_table: 1, rug: 1, table: 1 },
    // footprints only she can see: from him, to the sink, back to the shelf, into the storage room, out of the window
    trail: [
      { pts: [[5.6, 4.2], [3.8, 3.5], [2.9, 3.5]], line: 'm1_pr_a', fact: 'trail' },
      { pts: [[2.9, 3.5], [1.1, 1.6]], line: 'm1_pr_b', fact: 'washed' },
      { pts: [[1.1, 1.6], [2.9, 3.4], [3.8, 3.4], [6.6, 3.3]], line: 'm1_pr_c', fact: 'shelf' },
      { pts: [[6.6, 3.3], [6.3, 2.8], [6.3, 1.9], [6.4, 1.3]], line: 'm1_pr_d', fact: 'lived' },
      { pts: [[6.4, 1.3], [6.3, 2.8], [3.8, 3.5], [2.9, 3.5], [1.6, 0.75]], line: 'm1_pr_e', fact: 'out' },
    ],
    idle: ['m1_i1', 'm1_i2', 'm1_i3', 'm1_i4'],
    finale: ['m1_f1', 'm1_f2', 'm1_f3', 'm1_f4', 'm1_f5', 'm1_f6'],
    endTitle: 'Owen Mercer',
    endText: 'Owen had been hiding in the storage room from the people he owed. Daniel kept him secret, paid what he could, and was ashamed of him. The night Daniel called their sister to tell her, Owen killed him with the brass owl, washed it, put it back, and left through the kitchen window.',
    victims: { killer: 'Owen', victim: 'Daniel' },
    // the night, replayed while she tells it
    replay(R) {
      R.show('ghostB', 2.75, 5.35, PI, ['stand']);
      R.show('ghostA', 3.7, 5.6, -PI / 2, ['stand']);
      R.cam(0, [1.2, 1.7, 6.6], [2.8, 1.1, 5.0]);
      let t = 0;
      R.at(0.2, () => R.say('m1_f1'));
      t = R.pose('ghostB', 0, 3.5, [2.75, 0, 5.35], PI, ['stand']);
      R.cam(3.6, [3.4, 1.7, 6.6], [5.2, 1.0, 4.4]);
      t = R.walk('ghostB', t, [[2.75, 0, 5.35], [3.6, 0, 5.7], [5.0, 0, 4.0], [5.6, 0, 4.05]], 1.1);
      R.walk('ghostA', 3.8, [[3.7, 0, 5.6], [4.6, 0, 4.2], [6.7, 0, 3.4]], 1.3);
      R.at(t - 1.0, () => R.hideGroups('bookcase', [1]));
      R.prop('owl_prop', 'ghostA', t - 1.0);
      R.at(t, () => R.say('m1_f2'));
      const t2 = R.walk('ghostA', t + 0.4, [[6.7, 0, 3.4], [6.2, 0, 3.8]], 1.5);
      R.at(t2, () => { R.hide('ghostB'); R.sound('thud'); });
      R.cam(t2 - 0.5, [2.4, 1.7, 3.8], [1.2, 0.9, 1.8]);
      const t3 = R.walk('ghostA', t2 + 0.8, [[6.2, 0, 3.8], [3.8, 0, 3.5], [2.9, 0, 3.5], [1.2, 0, 1.7]], 1.6);
      R.at(t3, () => R.say('m1_f3'));
      const t4 = R.pose('ghostA', t3, t3 + 2.2, [1.2, 0, 1.7], -PI / 2, ['reach']);
      R.cam(t4, [4.2, 1.7, 5.0], [6.9, 1.1, 3.3]);
      const t5 = R.walk('ghostA', t4, [[1.2, 0, 1.7], [2.9, 0, 3.4], [3.8, 0, 3.4], [6.6, 0, 3.35]], 1.7);
      R.at(t5, () => { R.prop('owl_prop', null, t5); R.hideGroups('bookcase', null); });
      R.at(t5 + 0.3, () => R.say('m1_f4'));
      R.cam(t5 + 1.0, [2.4, 1.6, 3.7], [1.45, 1.3, 0.2]);
      const t6 = R.walk('ghostA', t5 + 1.0, [[6.6, 0, 3.35], [6.3, 0, 2.6], [6.4, 0, 1.4], [6.3, 0, 2.8], [3.8, 0, 3.5], [2.9, 0, 3.5], [1.5, 0, 0.7]], 1.9);
      R.at(t6, () => { R.openWindow('window'); R.hide('ghostA'); });
      return t6 + 1.5;
    },
  };
})();
