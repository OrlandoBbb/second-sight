'use strict';
// The flat on the page. H.load(case) takes a case's rooms and things, splits each room into its walls, its floor and
// its ceiling (three drawings of their own), and sets where-am-I and where-can-I-walk for the world and the director.
(function () {
  const H = WK.Home = {};
  H.load = C => {
    const rooms = C.rooms.map(r => Object.assign({}, r, { parts: r.parts.slice() }));
    const surfaces = [];
    for (const r of rooms) {
      const fl = r.parts.filter(p => p.floor), ce = r.parts.filter(p => p.ceil);
      r.parts = r.parts.filter(p => !p.floor && !p.ceil);
      surfaces.push({ id: r.id + '_f', name: r.name, room: true, surf: 'floor', roomOf: r.id, blob: false, parts: fl });
      if (ce.length) surfaces.push({ id: r.id + '_c', name: r.name, room: true, surf: 'ceil', roomOf: r.id, blob: false, parts: ce });
    }
    H.case = C;
    H.rooms = rooms; H.surfaces = surfaces; H.things = C.things;
    H.all = rooms.concat(surfaces, C.things);
    H.byId = {};
    for (const o of H.all) H.byId[o.id] = o;
    H.zoneAt = (x, y, z) => C.zoneAt(x, z);
    H.walkable = C.walkable || (() => true);
    H.bounds = C.bounds;
  };
  H.floorAt = () => 0;
  H.level = () => 0;
})();
