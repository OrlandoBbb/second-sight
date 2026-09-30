'use strict';
// Case 2 — Harrow Court, flat 3. Margaret Hale, 74, retired pharmacist, found on her kitchen floor; ruled a fall.
// What really happened: her granddaughter Lily's boyfriend, Karl Brandt, had been taking money from Margaret for
// months. Lily gave him her key (and is ashamed of it). Margaret hid her savings in a tin in the freezer and wrote in
// her diary that Lily must never know. On Sunday night Karl let himself in, searched the sideboard, and when she
// told him no he knocked her glasses off; she ran to the kitchen phone, he grabbed her arm and threw her against the
// counter. He took the tin from the freezer, smoked a cigarette on her balcony, and walked out of the front door.
// Plan (a real flat): a corridor hall from the front door; off it Lily's small room, the bathroom and the kitchen-
// diner; at the end the living room with a balcony, and Margaret's bedroom beyond.
(function () {
  const K = WK.Kit, PI = K.PI, B = K.B, CY = K.CY;
  const W = (...a) => K.wall(...a);
  const rooms = [
    K.room('r2_hall', 'the hall', 3.4, 4.8, 3.4, 8.0, [
      ...W('z', 3.4, 3.4, 8.0, 0, 2.6, 0.12, [{ a: 4.2, b: 5.0, y0: 0, y1: 2.05 }, { a: 6.6, b: 7.4, y0: 0, y1: 2.05 }]),
      ...W('z', 4.8, 3.4, 8.0, 0, 2.6, 0.12, [{ a: 5.0, b: 5.8, y0: 0, y1: 2.05 }]),
      ...W('x', 8.07, 3.26, 4.94, 0, 2.6, 0.14, [{ a: 3.65, b: 4.55, y0: 0, y1: 2.05 }]),
      ...W('x', 3.4, 3.4, 4.8, 0, 2.6, 0.12, [{ a: 3.5, b: 4.7, y0: 0, y1: 2.2 }]),
      ...K.doorFrame('x', 7.99, 3.65, 4.55, 2.05), ...K.doorFrame('z', 3.4, 4.2, 5.0, 2.05), ...K.doorFrame('z', 3.4, 6.6, 7.4, 2.05), ...K.doorFrame('z', 4.8, 5.0, 5.8, 2.05),
    ]),
    K.room('r2_living', 'the living room', 0, 6.4, 0, 3.4, [
      ...W('x', -0.07, -0.14, 6.4, 0, 2.6, 0.14, [{ a: 2.3, b: 3.5, y0: 0, y1: 2.15 }, { a: 4.4, b: 5.8, y0: 0.9, y1: 2.05 }]),
      ...W('z', -0.07, -0.14, 3.4, 0, 2.6, 0.14),
      ...W('x', 3.4, 0, 3.4, 0, 2.6, 0.12),
      ...W('z', 6.4, 0, 3.4, 0, 2.6, 0.12, [{ a: 2.3, b: 3.1, y0: 0, y1: 2.05 }]),
      ...K.windowFrame('x', -0.07, 4.4, 5.8, 0.9, 2.05, 1), ...K.doorFrame('x', -0.01, 2.3, 3.5, 2.15), ...K.doorFrame('z', 6.4, 2.3, 3.1, 2.05),
      K.skirting('x', 3.34, 0, 3.4, 0, -1),
    ]),
    K.room('r2_bed', 'her bedroom', 6.4, 10, 0, 3.4, [
      ...W('x', -0.07, 6.4, 10.14, 0, 2.6, 0.14, [{ a: 7.6, b: 9.0, y0: 0.9, y1: 2.05 }]),
      ...W('z', 10.07, -0.14, 3.54, 0, 2.6, 0.14),
      ...W('x', 3.47, 6.4, 10.14, 0, 2.6, 0.14),
      ...K.windowFrame('x', -0.07, 7.6, 9.0, 0.9, 2.05, 1),
    ]),
    K.room('r2_lily', 'Lily’s room', 0, 3.4, 3.4, 5.8, [
      ...W('z', -0.07, 3.4, 5.8, 0, 2.6, 0.14, [{ a: 4.1, b: 5.1, y0: 0.9, y1: 2.0 }]),
      ...W('x', 5.8, 0, 3.4, 0, 2.6, 0.12),
      ...K.windowFrame('z', -0.07, 4.1, 5.1, 0.9, 2.0, 1),
    ]),
    K.room('r2_bath', 'the bathroom', 0, 3.4, 5.8, 8.0, [
      ...W('z', -0.07, 5.8, 8.14, 0, 2.6, 0.14, [{ a: 6.6, b: 7.3, y0: 1.5, y1: 2.1 }]),
      ...W('x', 8.07, -0.14, 3.4, 0, 2.6, 0.14),
    ]),
    K.room('r2_kitchen', 'the kitchen', 4.8, 8.2, 3.4, 8.0, [
      ...W('x', 3.4, 4.8, 6.4, 0, 2.6, 0.12),
      ...W('z', 8.27, 3.4, 8.14, 0, 2.6, 0.14, [{ a: 5.2, b: 6.6, y0: 1.0, y1: 2.0 }]),
      ...W('x', 8.07, 4.8, 8.34, 0, 2.6, 0.14),
      ...K.windowFrame('z', 8.27, 5.2, 6.6, 1.0, 2.0, -1),
    ]),
    K.room('r2_balc', 'the balcony', 1.8, 4.2, -1.3, 0, [
      ...W('x', -1.3, 1.8, 4.2, 0, 1.05, 0.08), ...W('z', 1.8, -1.3, 0, 0, 1.05, 0.08), ...W('z', 4.2, -1.3, 0, 0, 1.05, 0.08),
    ], { noCeil: true }),
  ];
  const things = [
    // hall
    K.frontDoor('front_door2', 4.1, 7.985, PI),
    K.keyHooks('hooks', 3.47, 7.55, PI / 2),
    K.coatPegs('coats2', 4.73, 6.6, -PI / 2),
    // living room
    K.sofa('sofa2', 1.7, 2.92, PI, { search: null }),
    K.coffeeTable('coffee_table2', 1.7, 1.9, 0),
    K.rug('rug2', 2.1, 1.7, 0, 2.6, 1.7),
    K.tvUnit('tv2', 0.28, 1.6, PI / 2),
    K.armchair('armchair2', 4.9, 1.1, -2.6),
    K.sideboard('sideboard', 6.11, 1.05, -PI / 2),
    // kitchen-diner
    K.counter('counter2', 7.89, 6.0, -PI / 2, 2.4, { name: 'the counter' }),
    K.counter('counter3', 6.6, 7.69, PI, 1.6, { name: 'the cooker side' }),
    K.fridge('fridge2', 5.25, 7.66, PI, { name: 'the fridge-freezer', search: { g: 2, trans: [0, 0, 0.35], at: [0, 0.25, 0.45] } }),
    K.kitchenTable('table2', 6.0, 4.6, 0),
    K.calendar('calendar', 5.6, 3.47, 0),
    K.bin('bin2', 5.15, 3.8, 0),
    // her bedroom
    K.bed('bed2', 8.6, 1.15, 0, 1.4),
    K.nightstand('nightstand2', 7.55, 0.3, 0),
    K.wardrobe('wardrobe2', 9.62, 2.6, -PI / 2),
    // Lily's room
    K.singleBed('lilybed', 1.2, 4.6, PI / 2),
    K.dressingTable('dressing', 2.7, 3.67, 0),
    // bathroom
    K.bath('bath2', 0.45, 6.9, 0),
    K.toilet('toilet2', 1.4, 7.7, PI),
    K.basin('basin2', 2.6, 7.75, PI),
    // balcony
    K.plantPot('plant', 2.15, -1.0, 0),
    K.chair('balc_chair', 3.6, -0.75, -2.5),
    // found by searching (in colour)
    K.item('glasses', 'her glasses', 0, 0, 0, 0.6, K.paperBits.glasses(), { attach: 'armchair2', localPos: [0.1, 0.0, 0.5, 0.6], colors: [[0.55, 0.45, 0.35], [0.25, 0.2, 0.18]] }),
    K.item('butt', 'a cigarette end', 0, 0, 0, 0.9, K.paperBits.butt(), { attach: 'plant', localPos: [0.03, 0.4, 0.02, 0.9], colors: [[0.95, 0.93, 0.88], [0.85, 0.55, 0.25]] }),
    K.item('photo', 'a photo', 0, 0, 0, 0.2, K.paperBits.photo(), { attach: 'dressing', localPos: [0, 0.65, 0.3, 0.2], colors: [[0.9, 0.88, 0.8], [0.4, 0.35, 0.3]] }),
    K.item('diary', 'her diary', 0, 0, 0, -0.3, K.paperBits.diary(), { attach: 'nightstand2', localPos: [0, 0.34, 0.3, -0.3], colors: [[0.35, 0.5, 0.35], [0.8, 0.75, 0.6]] }),
    // memory ink
    K.vision('key2', 'Lily’s key', 0, 0, 0, 0, [B([-0.05, 1.34, 0.03], [0.02, 0.06, 0.005], K.metal(0.45)), B([-0.05, 1.39, 0.03], [0.012, 0.05, 0.004], K.fab(0.6))], { attach: 'hooks', localPos: [0, 0, 0, 0] }),
    K.vision('tin', 'a cash tin', 0, 0, 0, 0, [B([0, 0.22, 0.05], [0.26, 0.12, 0.2], K.metal(0.3, { bevel: 0.01 }))], { attach: 'fridge2', localPos: [0, 0, 0, 0] }),
    Object.assign(K.item('tin_prop', 'the cash tin', 0, 0, 0, 0, [B([0, 0.06, 0], [0.26, 0.12, 0.2], K.col({ bevel: 0.01 }))]), { prop: true, colors: [[0.35, 0.45, 0.55], [0.2, 0.2, 0.2]] }),
  ];

  WK.Cases = WK.Cases || {};
  WK.Cases.c2 = {
    id: 'c2', title: 'Harrow Court', victim: 'Margaret Hale', next: null,
    rooms, things,
    bounds: [0.2, -1.25, 9.8, 7.8],
    zoneAt: (x, z) => {
      if (z < 0) return 'r2_balc';
      if (z < 3.4) return x < 6.4 ? 'r2_living' : 'r2_bed';
      if (x < 3.4) return z < 5.8 ? 'r2_lily' : 'r2_bath';
      if (x < 4.8) return 'r2_hall';
      return 'r2_kitchen';
    },
    walkable: (x, z) => (z > -1.2 && z < 0 && x > 1.95 && x < 4.05) || (z >= 0 && z < 3.4 && x > 0.2 && x < 9.8) || (z >= 3.4 && z < 7.8 && x > 0.2 && x < 8.0),
    start: { pos: [4.1, 0, 7.35], yaw: PI + 0.08, pitch: -0.1, zone: 'r2_hall' },
    sceneHint: 'Where was she found? Go into the kitchen.',
    rain: [{ lo: [4.4, 0.9, -0.9], hi: [5.8, 2.2, -0.2], room: 'r2_living' }, { lo: [1.9, 0.2, -1.6], hi: [4.1, 2.4, -1.4], room: 'r2_balc' }],
    setup() {},
    intro: ['m2_b1', 'm2_b2', 'm2_b3', 'm2_b4', 'm2_b5', 'm2_b6', 'm2_b7'],
    enterRoom: { r2_kitchen: 'm2_found' },
    chalk: { head: [7.15, 6.25], dir: [-0.8, -0.6], lines: { m2_found: 1, m2_a_counter: 1 } },
    claims: {
      fell: { text: 'She fell and hit her head on the counter.', line: 'm2_b2' },
      nokey: { text: 'Only the carer had a key.', line: 'm2_b4' },
      taken: { text: 'Nothing was taken.', line: 'm2_b4' },
    },
    questions: [
      { id: 'how', text: 'What happened to her?', needs: ['glasses', 'grab'], objs: ['counter2', 'armchair2', 'glasses'], accept: ['m2_t_h1', 'm2_t_h2', 'm2_t_h3'], claim: 'fell', tint: 'counter2', more: 'm2_p_h',
        solved: 'She was grabbed and thrown against the counter. It wasn’t a fall.',
        hints: { glasses: 'Where did it start? Search where she sat.', grab: 'What happened at the counter?' } },
      { id: 'who', text: 'Who was here?', needs: ['key', 'karl'], objs: ['hooks', 'dressing', 'photo', 'plant', 'butt'], accept: ['m2_t_o1', 'm2_t_o2', 'm2_t_o3'], more: 'm2_p_o',
        solved: 'Karl Brandt, Lily’s boyfriend. He had Lily’s key.',
        hints: { key: 'How did they get in? Look by the front door.', karl: 'Who? Lily’s room might know.' } },
      { id: 'why', text: 'Why?', needs: ['karl', 'money', 'diary'], objs: ['fridge2', 'nightstand2', 'diary'], accept: ['m2_t_y1', 'm2_t_y2', 'm2_t_y3'], more: 'm2_p_y',
        solved: 'Money. She had hidden her savings from him, to protect Lily.',
        hints: { money: 'Something was taken after all. Follow the footprints.', diary: 'What did she write down? Search her bedroom.' } },
    ],
    facts: {
      scene: 'She was found by the kitchen counter. A head injury.',
      glasses: 'Her glasses were under her armchair, two rooms from where she died.',
      grab: 'A hand gripped her arm, hard, by the counter.',
      key: 'Lily’s key is missing from the hooks. Lily reported it lost two weeks ago.',
      smoker: 'A cigarette pushed into the balcony plant pot. No one here smoked.',
      karl: 'A photo of Lily with her boyfriend, Karl Brandt, his face scratched out. He has a record for theft.',
      money: 'A square shape in the freezer frost: a cash tin, kept there for years, now gone.',
      diary: 'Her diary: “He came again. I told him no. Lily must never know.”',
      calendar: '“K — Sun 9” on the kitchen calendar.',
      mugs: 'Two mugs on the table. She made him tea.',
      trail: 'Someone let themselves in and went straight to the sideboard.',
      chase: 'He followed her into the kitchen.',
      freezer: 'He went to the freezer.',
      balcony: 'He stood on the balcony a while.',
      left: 'He left by the front door and pulled it shut.',
    },
    important: { scene: 1, glasses: 1, grab: 1, key: 1, smoker: 1, karl: 1, money: 1, diary: 1, calendar: 1, mugs: 1, trail: 1, chase: 1, freezer: 1, balcony: 1, left: 1 },
    notices: [
      { id: 'door', obj: 'front_door2', stage: 1, lines: ['m2_door'] },
      { id: 'chair', obj: 'armchair2', stage: 1, lines: ['m2_chair'] },
      { id: 'side', obj: 'sideboard', stage: 2, lines: ['m2_side'] },
      { id: 'tv', obj: 'tv2', stage: 1, lines: ['m2_tv'] },
      { id: 'grab', obj: 'counter2', stage: 2, lines: ['m2_grab', 'm2_grab_r'], fact: 'grab', vision: { ghost: [6.9, 6.1, -2.2, ['reach']] } },
      { id: 'mugs', obj: 'table2', stage: 3, lines: ['m2_mugs', 'm2_mugs_r'], fact: 'mugs' },
      { id: 'cal', obj: 'calendar', stage: 2, lines: ['m2_cal', 'm2_cal_r'], fact: 'calendar' },
      { id: 'key', obj: 'hooks', stage: 2, lines: ['m2_key', 'm2_key_r', 'm2_key_r2'], fact: 'key', vision: 'key2', claim: 'nokey', tint: 'hooks' },
      { id: 'bed', obj: 'bed2', stage: 1, lines: ['m2_bed'] },
      { id: 'lily', obj: 'lilybed', stage: 1, lines: ['m2_lily'] },
    ],
    searches: {
      armchair2: { item: 'glasses', lines: ['m2_glasses', 'm2_glasses_r', 'm2_glasses2'], fact: 'glasses' },
      plant: { item: 'butt', lines: ['m2_butt', 'm2_butt_r'], fact: 'smoker' },
      dressing: { item: 'photo', lines: ['m2_photo', 'm2_photo_r', 'm2_photo_r2'], fact: 'karl' },
      fridge2: { vision: 'tin', lines: ['m2_tin', 'm2_tin_r', 'm2_tin_r2'], fact: 'money', claim: 'taken', tint: 'fridge2' },
      nightstand2: { item: 'diary', lines: ['m2_diary', 'm2_diary_r'], fact: 'diary' },
    },
    answers: {
      front_door2: 'm2_a_door', hooks: 'm2_a_hooks', coats2: 'm2_a_coats', sofa2: 'm2_a_sofa', coffee_table2: 'm2_a_ctable', rug2: 'm2_a_rug', tv2: 'm2_a_tv',
      armchair2: 'm2_a_armchair', sideboard: 'm2_a_side', counter2: 'm2_a_counter', counter3: 'm2_a_cooker', fridge2: 'm2_a_fridge', table2: 'm2_a_table',
      calendar: 'm2_a_cal', bin2: 'm2_a_bin', bed2: 'm2_a_bed', nightstand2: 'm2_a_night', wardrobe2: 'm2_a_wardrobe', lilybed: 'm2_a_lilybed', dressing: 'm2_a_dressing',
      bath2: 'm2_a_bath', toilet2: 'm2_a_toilet', basin2: 'm2_a_basin', plant: 'm2_a_plant', balc_chair: 'm2_a_bchair',
      r2_hall: 'm2_a_r_hall', r2_living: 'm2_a_r_living', r2_kitchen: 'm2_a_r_kitchen', r2_bed: 'm2_a_r_bed', r2_lily: 'm2_a_r_lily', r2_bath: 'm2_a_r_bath', r2_balc: 'm2_a_r_balc',
    },
    middle: { coffee_table2: 1, rug2: 1, table2: 1 },
    trail: [
      { pts: [[4.1, 7.5], [4.1, 4.0], [4.6, 2.6], [5.7, 1.3]], line: 'm2_pr_a', fact: 'trail' },
      { pts: [[5.7, 1.3], [4.4, 2.8], [4.1, 4.6], [4.4, 5.4], [5.6, 5.5], [6.9, 6.1]], line: 'm2_pr_b', fact: 'chase' },
      { pts: [[6.9, 6.1], [6.0, 6.8], [5.3, 6.9]], line: 'm2_pr_c', fact: 'freezer' },
      { pts: [[5.3, 6.9], [4.4, 5.4], [4.1, 3.9], [3.2, 1.6], [2.9, -0.2], [3.0, -0.8]], line: 'm2_pr_d', fact: 'balcony' },
      { pts: [[3.0, -0.8], [2.9, 0.5], [4.1, 3.3], [4.1, 7.4]], line: 'm2_pr_e', fact: 'left' },
    ],
    idle: ['m2_i1', 'm2_i2', 'm2_i3', 'm2_i4'],
    finale: ['m2_f1', 'm2_f2', 'm2_f3', 'm2_f4', 'm2_f5', 'm2_f6'],
    endTitle: 'Karl Brandt',
    endText: 'Karl had Lily’s key and had been taking Margaret’s money for months. She hid her savings in the freezer and told him no, to protect Lily. He grabbed her and threw her against the counter, took the tin, smoked on her balcony, and walked out of the front door. Lily knew he had her key. That is what she is ashamed of.',
    replay(R) {
      R.show('ghostB', 4.9, 1.1, -2.6, ['stand']);
      R.show('ghostA', 4.1, 7.6, PI, ['stand']);
      R.cam(0, [4.1, 1.7, 3.2], [4.1, 1.2, 7.8]);
      R.at(0.2, () => { R.say('m2_f1'); R.door('front_door2', true); });
      let t = R.walk('ghostA', 0.6, [[4.1, 0, 7.6], [4.1, 0, 4.0], [4.6, 0, 2.6], [5.6, 0, 1.3]], 1.3);
      R.at(t - 1.5, () => R.door('front_door2', false));
      R.cam(t - 0.8, [2.2, 1.7, 2.6], [5.4, 1.0, 1.0]);
      R.at(t + 0.2, () => R.say('m2_f2'));
      const t2 = R.walk('ghostB', t + 1.8, [[4.9, 0, 1.1], [4.3, 0, 2.8], [4.1, 0, 4.6], [4.4, 0, 5.4], [5.6, 0, 5.5], [7.0, 0, 6.1]], 1.6);
      R.walk('ghostA', t + 2.4, [[5.6, 0, 1.3], [4.4, 0, 2.8], [4.1, 0, 4.6], [4.4, 0, 5.4], [5.6, 0, 5.5], [6.6, 0, 5.8]], 1.7);
      R.cam(t + 2.6, [5.2, 1.7, 4.2], [7.2, 0.9, 6.2]);
      R.at(t2 + 0.5, () => { R.hide('ghostB'); R.sound('thud'); R.say('m2_f3'); });
      const t3 = R.walk('ghostA', t2 + 1.4, [[6.6, 0, 5.8], [5.9, 0, 6.8], [5.3, 0, 6.9]], 1.2);
      R.prop('tin_prop', 'ghostA', t3 + 0.6);
      R.cam(t3 + 1.2, [2.6, 1.7, 2.4], [2.9, 1.2, -0.8]);
      const t4 = R.walk('ghostA', t3 + 1.2, [[5.3, 0, 6.9], [4.4, 0, 5.4], [4.1, 0, 3.9], [3.2, 0, 1.6], [2.9, 0, -0.3], [3.0, 0, -0.8]], 1.6);
      R.at(t4, () => R.say('m2_f4'));
      const t5 = R.pose('ghostA', t4, t4 + 3.0, [3.0, 0, -0.8], PI, ['stand']);
      R.cam(t5, [4.1, 1.7, 3.2], [4.1, 1.2, 7.8]);
      const t6 = R.walk('ghostA', t5, [[3.0, 0, -0.8], [2.9, 0, 0.5], [4.1, 0, 3.3], [4.1, 0, 7.6]], 1.8);
      R.at(t6 - 0.4, () => R.door('front_door2', true));
      R.at(t6 + 0.2, () => { R.hide('ghostA'); R.door('front_door2', false); R.sound('doorClose'); });
      return t6 + 1.4;
    },
  };
})();
