// The city of PORT SABLE: a seeded gulf-coast grid of avenues and streets, the blocks between
// them, their buildings, props, kerbside parking bays, the piers over the water, and the road
// graph traffic and police drive. Everything here is built once from the seed and then read.
import { DISTRICTS, ROAD, SHORE_Y, WORLD } from './config.js';
import { chance, pick, range, rangeInt } from './rng.js';

/**
 * A block is ringed, from its kerb inward: a parking bay at the kerb, then the sidewalk the crowd
 * walks (see peds.js RING_INSET), then the buildings.
 */
const BAY_DEPTH = 24;
const SIDEWALK_RING = 24;
const BUILDING_INSET = 40;
/** Spatial hash cell for collision lookups. */
const CELL = 140;

/** The district covering a world point. The first rule that matches wins, so the gulf edge is docks. */
export function districtAt(x, y) {
  if (y > 1990) return DISTRICTS[0];
  if (x < 1150) return DISTRICTS[1];
  if (y < 770) return DISTRICTS[2];
  if (x > 2520) return DISTRICTS[3];
  return DISTRICTS[4];
}

/** The shoreline: where the gulf starts at a given x, wobbling so the coast is not a ruled line. */
export function waterEdge(x) {
  return SHORE_Y + 34 * Math.sin(x * 0.0019 + 1.1) + 14 * Math.sin(x * 0.0051 + 0.4);
}

/** Build the whole city from a seeded generator. */
export function buildCity(random) {
  const avenues = [];
  for (let x = 176, index = 0; x < WORLD.width - 210; index += 1) {
    const arterial = index % 3 === 0;
    avenues.push({ x, arterial, half: arterial ? ROAD.arterialHalf : ROAD.half, index });
    x += rangeInt(random, 336, 474);
  }
  const streets = [];
  const lastStreetY = SHORE_Y - 176;
  for (let y = 158, index = 0; y < lastStreetY - 150; index += 1) {
    const arterial = index % 3 === 1;
    streets.push({ y, arterial, half: arterial ? ROAD.arterialHalf : ROAD.half, index });
    y += rangeInt(random, 306, 434);
  }
  // Harbour Road runs the length of the waterfront and is always an arterial.
  streets.push({ y: lastStreetY, arterial: true, half: ROAD.arterialHalf, index: streets.length, harbour: true });

  const roads = [];
  for (const avenue of avenues) {
    roads.push({
      horizontal: false, arterial: avenue.arterial, half: avenue.half,
      x: avenue.x - avenue.half, y: 60, w: avenue.half * 2, h: lastStreetY + avenue.half - 60,
      cx: avenue.x,
    });
  }
  for (const street of streets) {
    roads.push({
      horizontal: true, arterial: street.arterial, half: street.half,
      x: 90, y: street.y - street.half, w: WORLD.width - 180, h: street.half * 2,
      cy: street.y,
    });
  }

  const colEdges = [{ pos: 56, half: 0 }, ...avenues.map((a) => ({ pos: a.x, half: a.half })), { pos: WORLD.width - 56, half: 0 }];
  const rowEdges = [{ pos: 56, half: 0 }, ...streets.map((s) => ({ pos: s.y, half: s.half }))];

  const blocks = [];
  const buildings = [];
  const props = [];
  const parkingSpots = [];
  for (let c = 0; c < colEdges.length - 1; c += 1) {
    for (let r = 0; r < rowEdges.length - 1; r += 1) {
      const left = colEdges[c].pos + colEdges[c].half;
      const right = colEdges[c + 1].pos - colEdges[c + 1].half;
      const top = rowEdges[r].pos + rowEdges[r].half;
      const bottom = rowEdges[r + 1].pos - rowEdges[r + 1].half;
      if (right - left < 90 || bottom - top < 90) continue;
      const block = { x: left, y: top, w: right - left, h: bottom - top, edge: c === 0 || r === 0 || c === colEdges.length - 2 };
      block.district = districtAt(left + block.w / 2, top + block.h / 2);
      const roll = random();
      const sparse = block.edge ? 0.2 : 0;
      block.kind = roll < 0.085 + sparse ? 'park' : roll < 0.155 + sparse ? 'lot' : 'buildings';
      blocks.push(block);
      fillBlock(random, block, buildings, props, parkingSpots);
    }
  }

  // The waterfront strip south of Harbour Road: sheds, containers and cranes, no grid blocks.
  const dockStrip = { y: lastStreetY + ROAD.arterialHalf, district: DISTRICTS[0] };
  for (let x = 150; x < WORLD.width - 150; x += rangeInt(random, 190, 300)) {
    const edge = waterEdge(x);
    const depth = edge - dockStrip.y - 26;
    if (depth < 50) continue;
    if (chance(random, 0.55)) {
      const w = rangeInt(random, 90, 180);
      buildings.push(makeBuilding(random, x, dockStrip.y + 14, w, Math.min(depth, 96), DISTRICTS[0], 'shed'));
    } else {
      for (let k = 0; k < rangeInt(random, 2, 4); k += 1) {
        props.push({
          type: 'container', x: x + k * 46 + range(random, -6, 6), y: dockStrip.y + 30 + (k % 2) * 40,
          w: 42, h: 26, solid: true, hue: pick(random, ['#c2603f', '#3f7f8c', '#c9a23c', '#5c6f54']),
        });
      }
    }
    if (chance(random, 0.3)) props.push({ type: 'crane', x: x + 60, y: dockStrip.y + 70, solid: false });
  }

  const piers = [];
  for (const px of [430, 1210, 2010, 2810]) {
    const edge = waterEdge(px);
    piers.push({ x: px - 44, y: edge - 34, w: 88, h: 268, cx: px, deck: edge - 34 });
    props.push({ type: 'bollard', x: px - 30, y: edge + 160, solid: false });
    props.push({ type: 'bollard', x: px + 30, y: edge + 160, solid: false });
  }
  for (let k = 0; k < 7; k += 1) {
    const px = range(random, 300, WORLD.width - 300);
    props.push({ type: 'boat', x: px, y: waterEdge(px) + range(random, 120, 300), angle: range(random, -0.4, 0.4), solid: false });
  }

  const nodes = [];
  for (let j = 0; j < streets.length; j += 1) {
    for (let i = 0; i < avenues.length; i += 1) {
      nodes.push({ x: avenues[i].x, y: streets[j].y, i, j, links: [], arterial: avenues[i].arterial || streets[j].arterial });
    }
  }
  const nodeAt = (i, j) => (i < 0 || j < 0 || i >= avenues.length || j >= streets.length ? -1 : j * avenues.length + i);
  for (const node of nodes) {
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const other = nodeAt(node.i + di, node.j + dj);
      if (other >= 0) node.links.push(other);
    }
  }

  const city = {
    avenues, streets, roads, blocks, buildings, props, parkingSpots, piers, nodes, nodeAt,
    lastStreetY, width: WORLD.width, height: WORLD.height,
  };
  city.solids = collectSolids(city);
  city.grid = buildGrid(city.solids);
  city.landmarks = chooseLandmarks(random, city);
  city.signs = placeSigns(random, city);
  return city;
}

/** One building record, with a deterministic window pattern the renderer reuses every frame. */
function makeBuilding(random, x, y, w, h, district, style) {
  const tall = range(random, district.height[0], district.height[1]);
  return {
    x, y, w, h,
    height: style === 'shed' ? Math.min(tall, 34) : tall,
    wall: pick(random, district.walls),
    roof: pick(random, district.roofs),
    district: district.id,
    style: style ?? (tall > 110 ? 'tower' : 'block'),
    windowCols: Math.max(2, Math.round(w / 34)),
    windowRows: Math.max(2, Math.round(h / 34)),
    lit: random(),
    trim: chance(random, 0.45),
    // Roof clutter: vents, housings and a water tank, placed once so the renderer stays stateless.
    roofProps: roofClutter(random, w, h, tall),
    solid: true,
  };
}

/** Boxes, vents and tanks scattered on a roof, in fractions of the building's own footprint. */
function roofClutter(random, w, h, tall) {
  const clutter = [];
  const count = tall > 110 ? rangeInt(random, 2, 4) : rangeInt(random, 0, 2);
  for (let index = 0; index < count; index += 1) {
    clutter.push({
      dx: range(random, -0.3, 0.3),
      dy: range(random, -0.3, 0.3),
      w: Math.min(w * 0.3, range(random, 10, 26)),
      h: Math.min(h * 0.3, range(random, 10, 22)),
      tank: chance(random, 0.3),
      rise: range(random, 5, 13),
    });
  }
  return clutter;
}

/** Fill one city block: buildings or a park or a parking lot, plus its sidewalk props and bays. */
function fillBlock(random, block, buildings, props, parkingSpots) {
  const inner = {
    x: block.x + BUILDING_INSET, y: block.y + BUILDING_INSET,
    w: block.w - BUILDING_INSET * 2, h: block.h - BUILDING_INSET * 2,
  };
  if (block.kind === 'park') {
    block.lawn = { x: block.x + SIDEWALK_RING, y: block.y + SIDEWALK_RING, w: block.w - SIDEWALK_RING * 2, h: block.h - SIDEWALK_RING * 2 };
    block.paths = true;
    const count = Math.max(5, Math.round((block.w * block.h) / 8200));
    for (let k = 0; k < count; k += 1) {
      props.push({ type: 'palm', x: range(random, block.x + 34, block.x + block.w - 34), y: range(random, block.y + 34, block.y + block.h - 34), scale: range(random, 0.8, 1.35), solid: false });
    }
    for (let seat = 0; seat < 3; seat += 1) {
      if (!chance(random, 0.55)) continue;
      props.push({ type: 'bench', x: range(random, block.x + 44, block.x + block.w - 44), y: range(random, block.y + 44, block.y + block.h - 44), solid: false });
    }
  } else if (block.kind === 'lot') {
    block.asphalt = { x: block.x + SIDEWALK_RING, y: block.y + SIDEWALK_RING, w: block.w - SIDEWALK_RING * 2, h: block.h - SIDEWALK_RING * 2 };
    const rows = Math.max(1, Math.floor(block.h / 120));
    for (let r = 0; r < rows; r += 1) {
      const y = block.y + 50 + r * 112;
      for (let x = block.x + 42; x < block.x + block.w - 42; x += 34) {
        parkingSpots.push({ x, y, angle: -Math.PI / 2, lot: true, block });
      }
    }
    if (inner.w > 110 && inner.h > 110 && chance(random, 0.5)) {
      buildings.push(makeBuilding(random, inner.x + inner.w / 2, inner.y + 20, Math.min(inner.w, 120), 54, block.district, 'shed'));
    }
  } else {
    const cols = Math.max(1, Math.min(4, Math.round(inner.w / 150)));
    const rows = Math.max(1, Math.min(3, Math.round(inner.h / 150)));
    const cw = inner.w / cols;
    const ch = inner.h / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (!chance(random, block.district.density)) continue;
        const pad = range(random, 3, 9);
        const w = cw - pad * 2;
        const h = ch - pad * 2;
        if (w < 40 || h < 40) continue;
        buildings.push(makeBuilding(random, inner.x + c * cw + cw / 2, inner.y + r * ch + ch / 2, w, h, block.district));
      }
    }
  }
  // Kerbside parking bays and street furniture on the block's own sidewalk ring.
  // Cars park parallel to the kerb, so a bay is only as deep as a car is wide.
  const sides = [
    { horizontal: true, y: block.y + BAY_DEPTH / 2, angle: 0 },
    { horizontal: true, y: block.y + block.h - BAY_DEPTH / 2, angle: Math.PI },
    { horizontal: false, x: block.x + BAY_DEPTH / 2, angle: -Math.PI / 2 },
    { horizontal: false, x: block.x + block.w - BAY_DEPTH / 2, angle: Math.PI / 2 },
  ];
  for (const side of sides) {
    if (!chance(random, 0.6)) continue;
    if (side.horizontal) {
      for (let x = block.x + 64; x < block.x + block.w - 64; x += 62) {
        if (chance(random, 0.55)) parkingSpots.push({ x, y: side.y, angle: side.angle, kerb: true, block });
      }
    } else {
      for (let y = block.y + 64; y < block.y + block.h - 64; y += 62) {
        if (chance(random, 0.55)) parkingSpots.push({ x: side.x, y, angle: side.angle, kerb: true, block });
      }
    }
  }
  for (const type of block.district.props) {
    if (type === 'billboard' || type === 'crane') continue;
    const count = type === 'lamp' ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      if (!chance(random, 0.6)) continue;
      const onTop = chance(random, 0.5);
      const x = range(random, block.x + 30, block.x + block.w - 30);
      const y = onTop ? block.y + 8 : block.y + block.h - 8;
      props.push({
        type, x, y, scale: range(random, 0.85, 1.25),
        solid: type === 'tank' || type === 'container',
        w: type === 'container' ? 42 : 30, h: type === 'container' ? 26 : 30,
        radius: type === 'tank' ? 26 : 14,
        hue: type === 'container' ? '#b2563a' : undefined,
      });
    }
  }
  if (block.district.props.includes('billboard') && chance(random, 0.3)) {
    props.push({ type: 'billboard', x: block.x + block.w / 2, y: block.y + 6, angle: 0, solid: false, text: null });
  }
}

/** Every solid thing in the city, flattened for the collision grid. */
function collectSolids(city) {
  const solids = [];
  for (const building of city.buildings) {
    solids.push({ kind: 'rect', x: building.x - building.w / 2, y: building.y - building.h / 2, w: building.w, h: building.h, building });
  }
  for (const prop of city.props) {
    if (!prop.solid) continue;
    if (prop.type === 'tank') solids.push({ kind: 'circle', x: prop.x, y: prop.y, radius: prop.radius ?? 26 });
    else solids.push({ kind: 'rect', x: prop.x - prop.w / 2, y: prop.y - prop.h / 2, w: prop.w, h: prop.h });
  }
  return solids;
}

function buildGrid(solids) {
  const map = new Map();
  const key = (cx, cy) => cx * 8192 + cy;
  for (let index = 0; index < solids.length; index += 1) {
    const s = solids[index];
    const minX = Math.floor((s.kind === 'circle' ? s.x - s.radius : s.x) / CELL);
    const maxX = Math.floor((s.kind === 'circle' ? s.x + s.radius : s.x + s.w) / CELL);
    const minY = Math.floor((s.kind === 'circle' ? s.y - s.radius : s.y) / CELL);
    const maxY = Math.floor((s.kind === 'circle' ? s.y + s.radius : s.y + s.h) / CELL);
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const k = key(cx, cy);
        let bucket = map.get(k);
        if (!bucket) map.set(k, (bucket = []));
        bucket.push(index);
      }
    }
  }
  return { map, key, solids };
}

/** The solids whose cell a circle touches. */
export function solidsNear(city, x, y, radius) {
  const found = [];
  const seen = new Set();
  const minX = Math.floor((x - radius) / CELL);
  const maxX = Math.floor((x + radius) / CELL);
  const minY = Math.floor((y - radius) / CELL);
  const maxY = Math.floor((y + radius) / CELL);
  for (let cx = minX; cx <= maxX; cx += 1) {
    for (let cy = minY; cy <= maxY; cy += 1) {
      const bucket = city.grid.map.get(city.grid.key(cx, cy));
      if (!bucket) continue;
      for (const index of bucket) {
        if (seen.has(index)) continue;
        seen.add(index);
        found.push(city.grid.solids[index]);
      }
    }
  }
  return found;
}

/** True where a point is over open water and not on a pier deck. */
export function isWater(city, x, y) {
  if (y < waterEdge(x)) return false;
  for (const pier of city.piers) {
    if (x > pier.x && x < pier.x + pier.w && y > pier.y && y < pier.y + pier.h) return false;
  }
  return true;
}

/**
 * Slide a circle out of buildings, solid props, the gulf and the map edge. Returns the corrected
 * centre and whether anything was hit, so cars can take damage from the same call walkers use.
 */
export function collideCircle(city, x, y, radius) {
  let px = x;
  let py = y;
  let hit = false;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const solid of solidsNear(city, px, py, radius + 4)) {
      if (solid.kind === 'circle') {
        const dx = px - solid.x;
        const dy = py - solid.y;
        const distance = Math.hypot(dx, dy) || 1;
        const overlap = solid.radius + radius - distance;
        if (overlap > 0) {
          px += (dx / distance) * overlap;
          py += (dy / distance) * overlap;
          hit = true;
        }
        continue;
      }
      const nearestX = Math.max(solid.x, Math.min(px, solid.x + solid.w));
      const nearestY = Math.max(solid.y, Math.min(py, solid.y + solid.h));
      const dx = px - nearestX;
      const dy = py - nearestY;
      const distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      hit = true;
      if (distance > 0.001) {
        px = nearestX + (dx / distance) * radius;
        py = nearestY + (dy / distance) * radius;
      } else {
        const left = px - solid.x;
        const right = solid.x + solid.w - px;
        const up = py - solid.y;
        const down = solid.y + solid.h - py;
        const least = Math.min(left, right, up, down);
        if (least === left) px = solid.x - radius;
        else if (least === right) px = solid.x + solid.w + radius;
        else if (least === up) py = solid.y - radius;
        else py = solid.y + solid.h + radius;
      }
    }
  }
  if (isWater(city, px, py)) {
    let guard = 0;
    while (isWater(city, px, py) && guard < 60) {
      py -= 4;
      guard += 1;
    }
    hit = true;
  }
  const margin = radius + 20;
  if (px < margin) { px = margin; hit = true; }
  if (px > WORLD.width - margin) { px = WORLD.width - margin; hit = true; }
  if (py < margin) { py = margin; hit = true; }
  if (py > WORLD.height - margin) { py = WORLD.height - margin; hit = true; }
  return { x: px, y: py, hit };
}

/** True where a point lies on a road surface (used for sirens, traffic and police spawns). */
export function onRoad(city, x, y) {
  for (const avenue of city.avenues) if (Math.abs(x - avenue.x) < avenue.half) return true;
  for (const street of city.streets) if (Math.abs(y - street.y) < street.half) return true;
  return false;
}

/** The graph node nearest a point. */
export function nearestNode(city, x, y) {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < city.nodes.length; index += 1) {
    const node = city.nodes[index];
    const distance = (node.x - x) ** 2 + (node.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/** A road point roughly `distance` away from a spot, for spawning police just out of frame. */
export function nodeAtDistance(city, x, y, distance, random) {
  const candidates = [];
  for (let index = 0; index < city.nodes.length; index += 1) {
    const node = city.nodes[index];
    const away = Math.hypot(node.x - x, node.y - y);
    if (away > distance * 0.72 && away < distance * 1.9) candidates.push(index);
  }
  if (candidates.length === 0) return nearestNode(city, x, y);
  return pick(random, candidates);
}

/** Mae's pier, the hideout garage, the mission pickups and drops, all placed on real geometry. */
function chooseLandmarks(random, city) {
  const pier = city.piers[1];
  const inDistrict = (id) => city.blocks.filter((block) => block.district.id === id && block.kind !== 'park');
  const spotIn = (id, fallback) => {
    const list = inDistrict(id);
    if (list.length === 0) return fallback;
    const block = list[Math.floor(random() * list.length) % list.length];
    return { x: block.x + block.w / 2, y: block.y - 30 };
  };
  const docks = inDistrict('docks');
  const hideoutBlock = docks.length > 0 ? docks[Math.floor(random() * docks.length) % docks.length] : null;
  return {
    mae: { x: pier.cx, y: pier.deck + 92, name: 'Mae Calder' },
    maePier: pier,
    dropDocks: { x: city.piers[2].cx, y: city.lastStreetY - 10, name: 'The Docks' },
    hideout: hideoutBlock
      ? { x: hideoutBlock.x + hideoutBlock.w / 2, y: hideoutBlock.y + hideoutBlock.h + 22, name: 'Hideout', block: hideoutBlock }
      : { x: 600, y: city.lastStreetY - 40, name: 'Hideout' },
    pickupMidtown: spotIn('midtown', { x: 1800, y: 1300 }),
    dropPalmReach: spotIn('palmreach', { x: 2900, y: 1200 }),
    dealOldFort: spotIn('oldfort', { x: 2000, y: 420 }),
    refineryYard: spotIn('refinery', { x: 600, y: 900 }),
  };
}

/** District signs at a few intersections, and billboard copy, all written for this city. */
function placeSigns(random, city) {
  const lines = [
    'SABLE GULF REALTY — LOTS FROM $900',
    'CALDER MARINE SUPPLY',
    'TRY THE GROUPER PLATE',
    'PALM REACH — NO VACANCY',
    'SUNSET FERRY · HOURLY',
    'REFINERY ROAD CLOSED 4-6',
  ];
  const signs = [];
  for (const district of DISTRICTS) {
    const nodes = city.nodes.filter((node) => districtAt(node.x, node.y).id === district.id && node.arterial);
    if (nodes.length === 0) continue;
    const node = nodes[Math.floor(random() * nodes.length) % nodes.length];
    signs.push({ x: node.x + 46, y: node.y + 46, text: district.name, district: district.id });
  }
  for (const prop of city.props) {
    if (prop.type === 'billboard') prop.text = pick(random, lines);
  }
  return signs;
}
