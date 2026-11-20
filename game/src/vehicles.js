// Every car in PORT SABLE: the models (all our own designs and names), the driving model the
// player, the traffic and the police all share, and the knocks they take. A car holds a heading
// plus a velocity vector, and the grip term eats sideways speed, so hard corners slide.
import { collideCircle } from './city.js';
import { pick, range } from './rng.js';

/** The road cars of Port Sable. `plate` is the local three-letter prefix stamped on the boot. */
export const VEHICLE_KINDS = {
  cab: {
    id: 'cab', name: 'Sable Cab', length: 48, width: 21, accel: 310, topSpeed: 268, reverse: 92,
    grip: 7.4, turnRate: 2.5, mass: 1.1, health: 150, body: ['#e8bb48', '#d8a63b'], roof: '#f2d072', livery: 'cab',
  },
  coupe: {
    id: 'coupe', name: 'Coastal Coupe', length: 46, width: 20, accel: 390, topSpeed: 322, reverse: 100,
    grip: 6.2, turnRate: 2.85, mass: 0.95, health: 130, body: ['#34a0a8', '#2b8691', '#b9453f', '#e7e0cf'], roof: '#1f6b74',
  },
  pickup: {
    id: 'pickup', name: 'Dockhand 60', length: 54, width: 23, accel: 290, topSpeed: 246, reverse: 90,
    grip: 8.1, turnRate: 2.25, mass: 1.35, health: 195, body: ['#b4584a', '#7f8a6a', '#4f6675'], roof: '#8a4538', bed: true,
  },
  van: {
    id: 'van', name: 'Gulfline Van', length: 58, width: 25, accel: 255, topSpeed: 228, reverse: 82,
    grip: 8.6, turnRate: 2.0, mass: 1.5, health: 225, body: ['#e4ded0', '#cfd6cf', '#d8c9ad'], roof: '#efeade', boxy: true,
  },
  sedan: {
    id: 'sedan', name: 'Calder Sedan', length: 50, width: 22, accel: 330, topSpeed: 284, reverse: 95,
    grip: 7.1, turnRate: 2.45, mass: 1.15, health: 160, body: ['#5d6f8c', '#8d8477', '#6d7f6a', '#c2bbab'], roof: '#45566e',
  },
  cruiser: {
    id: 'cruiser', name: 'Harbour Patrol', length: 51, width: 22, accel: 405, topSpeed: 330, reverse: 104,
    grip: 7.6, turnRate: 2.7, mass: 1.2, health: 200, body: ['#eef2f5'], roof: '#28303c', livery: 'police', siren: true,
  },
};

/** The civilian models traffic and kerbside parking draw from. */
export const CIVILIAN_KINDS = ['cab', 'coupe', 'pickup', 'van', 'sedan'];

let nextVehicleId = 1;

/** Make one car. `role` is 'parked', 'traffic', 'police', 'mission' or 'player'. */
export function createVehicle(random, kindId, x, y, angle, role) {
  const kind = VEHICLE_KINDS[kindId] ?? VEHICLE_KINDS.sedan;
  return {
    id: nextVehicleId++,
    kind,
    role,
    x, y, angle,
    vx: 0, vy: 0,
    forward: 0,
    lateral: 0,
    steer: 0,
    color: pick(random, kind.body),
    health: kind.health,
    locked: role === 'parked' || role === 'mission',
    driver: role === 'traffic' || role === 'police' ? role : null,
    siren: false,
    lightPhase: random() * Math.PI * 2,
    plate: `PS-${Math.floor(range(random, 100, 999))}`,
    skidTimer: 0,
    smoke: 0,
    node: -1,
    nextNode: -1,
    laneSide: 1,
    stuck: 0,
    wheelSpin: 0,
    dead: false,
  };
}

/** Speed in world units a second, whichever way the car is going. */
export function vehicleSpeed(vehicle) {
  return Math.hypot(vehicle.vx, vehicle.vy);
}

/** The four corners of a car, for drawing and for hit tests. */
export function vehicleCorners(vehicle) {
  const halfLength = vehicle.kind.length / 2;
  const halfWidth = vehicle.kind.width / 2;
  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  const corners = [];
  for (const [fx, fy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) {
    corners.push({
      x: vehicle.x + cos * fx * halfLength - sin * fy * halfWidth,
      y: vehicle.y + sin * fx * halfLength + cos * fy * halfWidth,
    });
  }
  return corners;
}

/** True when a point is inside the car's footprint (bullets, punches, doors). */
export function pointInVehicle(vehicle, x, y) {
  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  const dx = x - vehicle.x;
  const dy = y - vehicle.y;
  const along = dx * cos + dy * sin;
  const across = -dx * sin + dy * cos;
  return Math.abs(along) <= vehicle.kind.length / 2 && Math.abs(across) <= vehicle.kind.width / 2;
}

/**
 * Advance one car for `dt` under `controls` ({ throttle, steer, handbrake }), then slide it out of
 * the city. Returns the impact speed when it hit something solid, else 0.
 */
export function driveVehicle(city, vehicle, dt, controls) {
  const kind = vehicle.kind;
  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  let forward = vehicle.vx * cos + vehicle.vy * sin;
  let lateral = -vehicle.vx * sin + vehicle.vy * cos;

  const throttle = Math.max(-1, Math.min(1, controls.throttle ?? 0));
  const braking = throttle !== 0 && Math.sign(throttle) !== Math.sign(forward) && Math.abs(forward) > 8;
  const push = throttle * (braking ? kind.accel * 2.1 : throttle < 0 && forward <= 8 ? kind.reverse * 2.6 : kind.accel);
  forward += push * dt;
  const limit = throttle < 0 && forward < 0 ? kind.reverse : kind.topSpeed;
  forward = Math.max(-kind.reverse, Math.min(limit, forward));
  // Rolling resistance and drag, plus the handbrake locking the rear.
  const drag = controls.handbrake ? 2.4 : throttle === 0 ? 1.15 : 0.42;
  forward -= forward * drag * dt;
  if (Math.abs(forward) < 2.2 && throttle === 0) forward = 0;

  const grip = controls.handbrake ? 1.7 : kind.grip;
  lateral -= lateral * Math.min(1, grip * dt) ;
  vehicle.lateral = lateral;

  const speedFactor = Math.min(1, Math.abs(forward) / 72);
  const steer = Math.max(-1, Math.min(1, controls.steer ?? 0));
  vehicle.steer += (steer - vehicle.steer) * Math.min(1, dt * 11);
  const turn = vehicle.steer * kind.turnRate * speedFactor * (forward < 0 ? -1 : 1) * (controls.handbrake ? 1.4 : 1);
  vehicle.angle += turn * dt;

  const cos2 = Math.cos(vehicle.angle);
  const sin2 = Math.sin(vehicle.angle);
  vehicle.vx = cos2 * forward - sin2 * lateral;
  vehicle.vy = sin2 * forward + cos2 * lateral;
  vehicle.forward = forward;
  vehicle.wheelSpin += Math.abs(forward) * dt * 0.08;

  const wantX = vehicle.x + vehicle.vx * dt;
  const wantY = vehicle.y + vehicle.vy * dt;
  // Test the nose and the tail so a car cannot clip a corner lengthwise.
  const nose = collideCircle(city, wantX + cos2 * kind.length * 0.3, wantY + sin2 * kind.length * 0.3, kind.width * 0.52);
  const tail = collideCircle(city, wantX - cos2 * kind.length * 0.3, wantY - sin2 * kind.length * 0.3, kind.width * 0.52);
  let impact = 0;
  if (nose.hit || tail.hit) {
    impact = Math.abs(forward);
    vehicle.x = (nose.x + tail.x) / 2;
    vehicle.y = (nose.y + tail.y) / 2;
    vehicle.vx *= -0.22;
    vehicle.vy *= -0.22;
    vehicle.forward = forward * 0.2;
  } else {
    vehicle.x = wantX;
    vehicle.y = wantY;
  }

  const slide = Math.abs(lateral);
  vehicle.skidTimer = slide > 44 || (controls.handbrake && Math.abs(forward) > 60) ? 1 : Math.max(0, vehicle.skidTimer - dt * 3);
  return impact;
}

/** Push two overlapping cars apart and trade some speed, so a pile-up behaves. */
export function separateVehicles(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minimum = (a.kind.length + b.kind.length) * 0.33;
  if (distance >= minimum || distance === 0) return 0;
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minimum - distance;
  const totalMass = a.kind.mass + b.kind.mass;
  a.x -= nx * overlap * (b.kind.mass / totalMass);
  a.y -= ny * overlap * (b.kind.mass / totalMass);
  b.x += nx * overlap * (a.kind.mass / totalMass);
  b.y += ny * overlap * (a.kind.mass / totalMass);
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closing <= 0) return 0;
  const transfer = closing * 0.52;
  a.vx -= nx * transfer;
  a.vy -= ny * transfer;
  b.vx += nx * transfer;
  b.vy += ny * transfer;
  return Math.abs(closing);
}

/** Wear a car down; at zero it smokes, stops and is written off. */
export function damageVehicle(vehicle, amount) {
  vehicle.health -= amount;
  if (vehicle.health <= 60) vehicle.smoke = Math.max(vehicle.smoke, 1 - vehicle.health / 60);
  if (vehicle.health <= 0 && !vehicle.dead) {
    vehicle.dead = true;
    vehicle.health = 0;
    vehicle.driver = null;
    return true;
  }
  return false;
}

/** Fill the city's kerbside bays and lots with parked cars, and return them. */
export function spawnParkedCars(random, city, limit) {
  const parked = [];
  const spots = city.parkingSpots;
  const step = Math.max(1, Math.floor(spots.length / limit));
  for (let index = 0; index < spots.length && parked.length < limit; index += step) {
    const spot = spots[index];
    const kind = pick(random, CIVILIAN_KINDS);
    const vehicle = createVehicle(random, kind, spot.x, spot.y, spot.angle + range(random, -0.03, 0.03), 'parked');
    vehicle.spot = spot;
    parked.push(vehicle);
  }
  return parked;
}

/** The closest car to a point, with an optional filter; used by doors, theft and the police. */
export function nearestVehicle(vehicles, x, y, maxDistance, accept) {
  let best = null;
  let bestDistance = maxDistance;
  for (const vehicle of vehicles) {
    if (accept && !accept(vehicle)) continue;
    const distance = Math.hypot(vehicle.x - x, vehicle.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = vehicle;
    }
  }
  return best;
}
