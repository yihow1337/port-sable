// The crowd of Port Sable. Each pedestrian walks a loop inset into a block's sidewalk, measured
// as one distance along that block's perimeter, so nobody drifts into the road by accident; they
// step off it only to cross a street, or to run when something frightens them.
import { collideCircle } from './city.js';
import { PED } from './config.js';
import { chance, pick, range, rangeInt } from './rng.js';

const SHIRTS = ['#e46a52', '#4e8fa8', '#e7c35c', '#8e6fa8', '#5fa177', '#d8d2c3', '#c75d86', '#5a6a86'];
const SKINS = ['#f0c8a0', '#d9a271', '#a9703f', '#7b4b2a', '#5a3620', '#f6d9bd'];
/** How far in from the kerb the crowd walks: clear of the parked cars at the edge. */
const RING_INSET = 30;

/** The walkable ring just inside a block's kerb. */
function ringOf(block) {
  return { x: block.x + RING_INSET, y: block.y + RING_INSET, w: Math.max(10, block.w - RING_INSET * 2), h: Math.max(10, block.h - RING_INSET * 2) };
}

/** Turn a distance along a block's sidewalk loop into a point and the direction of travel there. */
export function ringPoint(block, distance) {
  const ring = ringOf(block);
  const perimeter = 2 * (ring.w + ring.h);
  let t = ((distance % perimeter) + perimeter) % perimeter;
  if (t < ring.w) return { x: ring.x + t, y: ring.y, dx: 1, dy: 0, perimeter };
  t -= ring.w;
  if (t < ring.h) return { x: ring.x + ring.w, y: ring.y + t, dx: 0, dy: 1, perimeter };
  t -= ring.h;
  if (t < ring.w) return { x: ring.x + ring.w - t, y: ring.y + ring.h, dx: -1, dy: 0, perimeter };
  t -= ring.w;
  return { x: ring.x, y: ring.y + ring.h - t, dx: 0, dy: -1, perimeter };
}

/** The block and sidewalk distance nearest a loose point, so a runner can rejoin the pavement. */
export function nearestSidewalk(city, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const block of city.blocks) {
    const cx = Math.max(block.x, Math.min(x, block.x + block.w));
    const cy = Math.max(block.y, Math.min(y, block.y + block.h));
    const distance = (cx - x) ** 2 + (cy - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = block;
    }
  }
  if (!best) return null;
  const ring = ringOf(best);
  // Which side of the ring is closest decides the distance along the loop.
  const left = Math.abs(x - ring.x);
  const right = Math.abs(x - (ring.x + ring.w));
  const top = Math.abs(y - ring.y);
  const bottom = Math.abs(y - (ring.y + ring.h));
  const least = Math.min(left, right, top, bottom);
  let along;
  if (least === top) along = Math.max(0, Math.min(ring.w, x - ring.x));
  else if (least === right) along = ring.w + Math.max(0, Math.min(ring.h, y - ring.y));
  else if (least === bottom) along = ring.w + ring.h + Math.max(0, Math.min(ring.w, ring.x + ring.w - x));
  else along = ring.w * 2 + ring.h + Math.max(0, Math.min(ring.h, ring.y + ring.h - y));
  return { block: best, along };
}

/** One pedestrian, dropped onto a random block's sidewalk. */
export function createPed(random, city, block) {
  const home = block ?? pick(random, city.blocks);
  const along = random() * (2 * (home.w + home.h));
  const point = ringPoint(home, along);
  return {
    block: home,
    along,
    heading: chance(random, 0.5) ? 1 : -1,
    x: point.x,
    y: point.y,
    angle: Math.atan2(point.dy, point.dx),
    speed: range(random, PED.walk * 0.74, PED.walk * 1.3),
    state: 'walk',
    timer: range(random, 0, 6),
    shirt: pick(random, SHIRTS),
    skin: pick(random, SKINS),
    trousers: pick(random, ['#3f4756', '#6a5f4e', '#2f3a3f', '#8a7f6c']),
    hat: chance(random, 0.22),
    bag: chance(random, 0.26),
    phase: random() * Math.PI * 2,
    health: PED.health,
    fleeX: 0,
    fleeY: 0,
    scream: 0,
  };
}

/** A crowd spread over the whole city. */
export function spawnPeds(random, city, count) {
  const peds = [];
  for (let index = 0; index < count; index += 1) peds.push(createPed(random, city));
  return peds;
}

/** Frighten everyone within `radius` of a point; they drop what they are doing and run. */
export function alertPeds(peds, x, y, radius, random) {
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const distance = Math.hypot(ped.x - x, ped.y - y);
    if (distance > radius) continue;
    ped.state = 'flee';
    ped.timer = range(random, 2.6, 5.4);
    const away = Math.atan2(ped.y - y, ped.x - x) + range(random, -0.5, 0.5);
    ped.fleeX = Math.cos(away);
    ped.fleeY = Math.sin(away);
    ped.scream = 1;
  }
}

/** Hurt a pedestrian; returns true when this blow put them down. */
export function damagePed(ped, amount, random) {
  if (ped.state === 'down') return false;
  ped.health -= amount;
  ped.scream = 1;
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.timer = 0;
    ped.angle += range(random, -0.8, 0.8);
    return true;
  }
  ped.state = 'flee';
  ped.timer = range(random, 3, 5);
  return false;
}

/** Walk, cross, run and lie still: the whole crowd for one step. */
export function updatePeds(game, dt) {
  const { city, peds, random } = game;
  for (const ped of peds) {
    ped.scream = Math.max(0, ped.scream - dt * 1.6);
    if (ped.state === 'down') {
      ped.timer += dt;
      continue;
    }
    if (ped.state === 'flee') {
      ped.timer -= dt;
      const speed = PED.flee;
      const want = collideCircle(city, ped.x + ped.fleeX * speed * dt, ped.y + ped.fleeY * speed * dt, PED.radius);
      if (want.hit) {
        // Bounced off a wall: pick a new way out.
        const turn = range(random, 1.1, 2.1) * (chance(random, 0.5) ? 1 : -1);
        const angle = Math.atan2(ped.fleeY, ped.fleeX) + turn;
        ped.fleeX = Math.cos(angle);
        ped.fleeY = Math.sin(angle);
      }
      ped.x = want.x;
      ped.y = want.y;
      ped.angle = Math.atan2(ped.fleeY, ped.fleeX);
      ped.phase += dt * 15;
      if (ped.timer <= 0) {
        const spot = nearestSidewalk(city, ped.x, ped.y);
        if (spot) {
          ped.block = spot.block;
          ped.along = spot.along;
        }
        ped.state = 'walk';
        ped.timer = range(random, 3, 9);
      }
      continue;
    }
    if (ped.state === 'cross') {
      const speed = ped.speed * 1.55;
      const dx = ped.crossX - ped.x;
      const dy = ped.crossY - ped.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 6) {
        const spot = nearestSidewalk(city, ped.x, ped.y);
        if (spot) {
          ped.block = spot.block;
          ped.along = spot.along;
        }
        ped.state = 'walk';
        ped.timer = range(random, 4, 11);
      } else {
        ped.x += (dx / distance) * speed * dt;
        ped.y += (dy / distance) * speed * dt;
        ped.angle = Math.atan2(dy, dx);
        ped.phase += dt * 11;
      }
      continue;
    }
    // Walking the sidewalk loop.
    ped.timer -= dt;
    ped.along += ped.heading * ped.speed * dt;
    const point = ringPoint(ped.block, ped.along);
    ped.x = point.x;
    ped.y = point.y;
    ped.angle = Math.atan2(point.dy * ped.heading, point.dx * ped.heading);
    ped.phase += dt * (6 + ped.speed * 0.05);
    if (ped.timer <= 0) {
      ped.timer = range(random, 5, 14);
      if (chance(random, 0.34)) {
        ped.heading = -ped.heading;
      } else if (chance(random, 0.5)) {
        // Step off the kerb and cross to whatever is on the other side of the street.
        const outX = point.dy * ped.heading;
        const outY = -point.dx * ped.heading;
        ped.crossX = ped.x + outX * 118;
        ped.crossY = ped.y + outY * 118;
        ped.state = 'cross';
      }
    }
  }
}

/** Keep the crowd near the action topped up: anyone far away is recycled onto a nearby block. */
export function recyclePeds(game, focusX, focusY) {
  const { city, peds, random } = game;
  for (const ped of peds) {
    if (ped.state === 'down' && ped.timer < 24) continue;
    const distance = Math.hypot(ped.x - focusX, ped.y - focusY);
    if (distance < 1750) continue;
    const near = city.blocks.filter((block) => Math.hypot(block.x + block.w / 2 - focusX, block.y + block.h / 2 - focusY) < 900);
    if (near.length === 0) continue;
    const fresh = createPed(random, city, near[rangeInt(random, 0, near.length - 1)]);
    Object.assign(ped, fresh);
  }
}
