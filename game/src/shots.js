// The four screenshot scenes. Each one teleports Riley into a legal spot, sets the story to the
// stage that belongs in the picture, then runs the real simulation forward with scripted input
// until the frame is alive: the crowd is mid-stride, the traffic is rolling, the sirens are lit.
// Nothing here paints anything itself, and nothing is faked over the top of the game.
import { PLAYER, WANTED } from './config.js';
import { collideCircle } from './city.js';
import { emptyInput } from './input.js';
import { snapCamera } from './camera.js';
import { beginMission } from './missions.js';
import { createPed, nearestSidewalk } from './peds.js';
import { createVehicle, vehicleSpeed } from './vehicles.js';
import { starsFor } from './wanted.js';
import { copFire } from './combat.js';
import { enterVehicle, stepGame } from './world.js';
import { spawnSkid } from './effects.js';
import { pick, range } from './rng.js';

const SHOT_STEP = 1 / 60;

/** Run the real step() for `seconds`, with `script(time)` deciding the input each step. */
function simulate(game, seconds, script) {
  const steps = Math.round(seconds / SHOT_STEP);
  for (let index = 0; index < steps; index += 1) {
    const time = index * SHOT_STEP;
    const input = emptyInput();
    if (script) script(input, time, game);
    stepGame(game, SHOT_STEP, input);
  }
}

/** Drop extra walkers on the blocks around a point, so the street is busy where the camera is. */
function crowd(game, x, y, count, radius) {
  const blocks = game.city.blocks.filter((block) =>
    Math.hypot(block.x + block.w / 2 - x, block.y + block.h / 2 - y) < (radius ?? 520));
  if (blocks.length === 0) return;
  for (let index = 0; index < count; index += 1) {
    const block = blocks[index % blocks.length];
    const ped = createPed(game.random, game.city, block);
    // Spread them along the block's sidewalk rather than all at one corner.
    ped.along = (index / count) * 2 * (block.w + block.h) + range(game.random, -40, 40);
    game.peds.push(ped);
  }
}

/** A lane down an avenue: its centre line and the heading along it. */
function laneOnAvenue(game, avenue, y, southbound) {
  const offset = southbound ? avenue.half * 0.45 : -avenue.half * 0.45;
  return { x: avenue.x + offset, y, angle: southbound ? Math.PI / 2 : -Math.PI / 2 };
}

/** The same for a street running east-west. */
function laneOnStreet(game, street, x, eastbound) {
  const offset = eastbound ? street.half * 0.45 : -street.half * 0.45;
  return { x, y: street.y + offset, angle: eastbound ? 0 : Math.PI };
}

/**
 * Steer a driven car along a lane: project it onto the lane's centre line, aim at a point further
 * down that line and feed the difference back as steering. This is the real input path, so a shot
 * that drives is driving the game.
 */
function laneAutopilot(input, game, lane, speed) {
  const vehicle = game.player.vehicle;
  if (!vehicle) return;
  const dirX = Math.cos(lane.angle);
  const dirY = Math.sin(lane.angle);
  const along = (vehicle.x - lane.x) * dirX + (vehicle.y - lane.y) * dirY;
  const targetX = lane.x + dirX * (along + 240);
  const targetY = lane.y + dirY * (along + 240);
  const want = Math.atan2(targetY - vehicle.y, targetX - vehicle.x);
  const difference = ((want - vehicle.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  input.moveX = Math.max(-1, Math.min(1, difference * 1.9));
  input.moveY = vehicleSpeed(vehicle) < speed ? -1 : -0.3;
}

/**
 * Frame the shot: put the camera `ahead` units in front of a car at a fixed zoom. The live game
 * leads the camera by the car's velocity, which is right in motion but throws a still frame off,
 * so the stagers set it once at the end instead.
 */
function frameOn(game, thing, ahead, zoom) {
  if (!thing) return;
  const angle = thing.angle ?? 0;
  game.camera.x = thing.x + Math.cos(angle) * ahead;
  game.camera.y = thing.y + Math.sin(angle) * ahead;
  game.camera.zoom = zoom;
  game.camera.targetZoom = zoom;
}

/** Put Riley on the pavement beside a car, facing it. */
function standBeside(game, vehicle) {
  const city = game.city;
  let inward = { x: 0, y: -1 };
  let bestDistance = Infinity;
  for (const block of city.blocks) {
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;
    const distance = Math.hypot(cx - vehicle.x, cy - vehicle.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      const length = distance || 1;
      inward = { x: (cx - vehicle.x) / length, y: (cy - vehicle.y) / length };
    }
  }
  const spot = collideCircle(city, vehicle.x + inward.x * 27, vehicle.y + inward.y * 27, PLAYER.radius);
  game.player.x = spot.x;
  game.player.y = spot.y;
  game.player.angle = Math.atan2(-inward.y, -inward.x);
  game.player.aimAngle = game.player.angle;
}

/**
 * Stage one scene. Returns the screen to paint and the clock the title pulse should be at.
 * Names: title, street, drive, wanted.
 */
export function stageShot(name, game) {
  if (name === 'street') return stageStreet(game);
  if (name === 'drive') return stageDrive(game);
  if (name === 'wanted') return stageWanted(game);
  return { screen: 'title', clock: 0.42 };
}

/** On foot in Palm Reach, mid-hotwire, mission 1 live, the street full of people. */
function stageStreet(game) {
  const coupe = game.missionTargets.coupe;
  beginMission(game, 0, 1);
  game.player.money = 240;
  game.player.health = 92;
  standBeside(game, coupe);
  crowd(game, coupe.x, coupe.y, 26, 460);
  // A handful of walkers right on this stretch of pavement, so the street is busy where the
  // camera is rather than busy somewhere off screen.
  const here = nearestSidewalk(game.city, coupe.x, coupe.y);
  if (here) {
    for (let index = 0; index < 9; index += 1) {
      const ped = createPed(game.random, game.city, here.block);
      ped.along = here.along + (index - 4) * 46 + range(game.random, -12, 12);
      ped.heading = index % 2 === 0 ? 1 : -1;
      ped.phase = index * 1.3;
      game.peds.push(ped);
    }
  }
  // A few more cars at the kerb nearby, so the street is lined rather than bare.
  for (const spot of game.city.parkingSpots) {
    if (Math.hypot(spot.x - coupe.x, spot.y - coupe.y) > 300) continue;
    if (game.vehicles.some((vehicle) => Math.hypot(vehicle.x - spot.x, vehicle.y - spot.y) < 34)) continue;
    const vehicle = createVehicle(game.random, pick(game.random, ['cab', 'sedan', 'pickup', 'van']), spot.x, spot.y, spot.angle, 'parked');
    game.vehicles.push(vehicle);
  }
  snapCamera(game.camera, game);
  game.say('MAE CALDER', 'Teal coupe, Palm Reach. Bring it to the docks.', 9);
  // Let the crowd get walking, then lean on F until the bar is about half full.
  simulate(game, 1.5, (input, time) => {
    if (time > 1.2) input.interact = true;
  });
  simulate(game, 0.78, (input) => { input.interact = true; });
  // Sit the camera between Riley and the car he is working on, close enough to read the pair.
  frameOn(game, { x: (game.player.x + coupe.x) / 2, y: (game.player.y + coupe.y) / 2 - 26, angle: 0 }, 0, 1.62);
  return { screen: 'play', clock: game.time };
}

/** Place a car relative to the car Riley is driving: `forward` up the road, `side` across it. */
function placeRelative(game, kindId, forward, side, role, speed, reversed) {
  const driven = game.player.vehicle;
  if (!driven) return null;
  const cos = Math.cos(driven.angle);
  const sin = Math.sin(driven.angle);
  const x = driven.x + cos * forward - sin * side;
  const y = driven.y + sin * forward + cos * side;
  // Clear whatever is already standing there, so nothing is staged inside another car.
  for (let index = game.vehicles.length - 1; index >= 0; index -= 1) {
    const other = game.vehicles[index];
    if (other === driven || other.role === 'mission' || other.role === 'police') continue;
    if (Math.hypot(other.x - x, other.y - y) < 74) game.vehicles.splice(index, 1);
  }
  const angle = driven.angle + (reversed ? Math.PI : 0);
  const vehicle = createVehicle(game.random, kindId, x, y, angle, role);
  vehicle.driver = role === 'police' ? 'police' : 'traffic';
  vehicle.cruise = speed;
  vehicle.vx = Math.cos(angle) * speed;
  vehicle.vy = Math.sin(angle) * speed;
  if (role === 'police') {
    vehicle.siren = true;
    vehicle.mode = 'chase';
    // Stagger the bars so the cruisers are not all flashing the same colour at once.
    vehicle.lightPhase = (game.vehicles.length % 4) * 1.7;
  } else {
    vehicle.nextNode = nearestNodeAhead(game, vehicle);
    vehicle.node = -1;
  }
  game.vehicles.push(vehicle);
  return vehicle;
}

/** The graph node a staged traffic car should aim at, so it keeps driving after it is placed. */
function nearestNodeAhead(game, vehicle) {
  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < game.city.nodes.length; index += 1) {
    const node = game.city.nodes[index];
    const along = (node.x - vehicle.x) * cos + (node.y - vehicle.y) * sin;
    const across = Math.abs(-(node.x - vehicle.x) * sin + (node.y - vehicle.y) * cos);
    if (along < 60 || across > 70) continue;
    if (along < bestDistance) {
      bestDistance = along;
      best = index;
    }
  }
  return best;
}

/** Driving the stolen coupe east along Harbour Road, the gulf off the near side, mission 2 live. */
function stageDrive(game) {
  const city = game.city;
  const harbour = city.streets[city.streets.length - 1];
  const startX = city.avenues[1].x + 90;
  const lane = laneOnStreet(game, harbour, startX, true);
  const coupe = game.missionTargets.coupe;
  coupe.x = lane.x;
  coupe.y = lane.y;
  coupe.angle = lane.angle;
  coupe.locked = false;
  enterVehicle(game, coupe);
  game.player.money = 1240;
  game.player.health = 78;
  game.player.carrying = 'envelope';
  beginMission(game, 1, 2);
  crowd(game, lane.x + 320, lane.y - 60, 24, 700);
  snapCamera(game.camera, game);
  // Get the coupe up to speed and let the camera settle behind it.
  simulate(game, 2.9, (input, time, state) => {
    laneAutopilot(input, state, { x: lane.x, y: lane.y, angle: lane.angle }, 235);
    if (time > 2.2 && time < 2.42) input.moveX = 0.7;
  });
  // Then compose the traffic around him: oncoming in the far lane, one car up ahead in his own.
  const oncomingSide = -(harbour.half * 0.95);
  placeRelative(game, 'cab', 118, oncomingSide, 'traffic', 150, true);
  placeRelative(game, 'pickup', 252, oncomingSide - 4, 'traffic', 140, true);
  placeRelative(game, 'van', 392, oncomingSide + 3, 'traffic', 130, true);
  placeRelative(game, 'sedan', 176, 4, 'traffic', 190, false);
  placeRelative(game, 'coupe', 326, -2, 'traffic', 200, false);
  placeRelative(game, 'cab', 462, 2, 'traffic', 195, false);
  placeRelative(game, 'pickup', -124, 6, 'traffic', 210, false);
  // Tyre marks from the lane change he just made.
  const driven = game.player.vehicle;
  for (let index = 0; index < 6; index += 1) {
    spawnSkid(game.effects, driven.x - Math.cos(driven.angle) * (40 + index * 15), driven.y - Math.sin(driven.angle) * (40 + index * 15), driven.angle, driven.kind.width, 0.55);
  }
  // No subtitle here: the road ahead is the picture.
  game.dialog = null;
  game.toasts.length = 0;
  game.toast('Envelope collected');
  // Only a few frames now, so nothing drifts out of the composition that was just set up.
  simulate(game, 0.1, (input, time, state) => {
    laneAutopilot(input, state, { x: lane.x, y: lane.y, angle: lane.angle }, 235);
  });
  frameOn(game, game.player.vehicle, 86, 1.12);
  return { screen: 'play', clock: game.time };
}

/** Three stars, cruisers on his tail, an officer firing, the crowd scattering. */
function stageWanted(game) {
  const city = game.city;
  const avenue = city.avenues.find((candidate) => candidate.arterial && candidate.x > 1300) ?? city.avenues[1];
  // Southbound, so the cruisers on his tail sit in the clear top half of the frame.
  const startY = city.streets[1].y + 140;
  const lane = laneOnAvenue(game, avenue, startY, true);
  const coupe = game.missionTargets.coupe;
  coupe.x = lane.x;
  coupe.y = lane.y;
  coupe.angle = lane.angle;
  coupe.locked = false;
  enterVehicle(game, coupe);
  game.player.money = 1865;
  game.player.health = 54;
  beginMission(game, 2, 2);
  game.wanted.heat = WANTED.thresholds[3] + 24;
  game.wanted.stars = starsFor(game.wanted.heat);
  game.wanted.spawnTimer = 99;
  crowd(game, lane.x, lane.y - 260, 26, 640);
  snapCamera(game.camera, game);
  simulate(game, 2.9, (input, time, state) => {
    laneAutopilot(input, state, { x: lane.x, y: lane.y, angle: lane.angle }, 250);
    if (time > 2.2 && time < 2.42) input.moveX = -0.75;
  });

  // Compose the chase: two cruisers in the mirror, one swinging up alongside.
  const speed = Math.max(170, vehicleSpeed(game.player.vehicle));
  placeRelative(game, 'cruiser', -88, -28, 'police', speed * 1.06, false);
  placeRelative(game, 'cruiser', -158, 26, 'police', speed * 1.03, false);
  placeRelative(game, 'cruiser', -124, -62, 'police', speed * 1.08, false);
  // One more up on the kerb ahead, with two officers out of it, firing across the road.
  const roadblock = placeRelative(game, 'cruiser', 126, -84, 'police', 0, false);
  if (roadblock) {
    roadblock.angle += Math.PI / 2;
    roadblock.vx = 0;
    roadblock.vy = 0;
    roadblock.driver = null;
    roadblock.deployed = true;
    roadblock.blocking = true;
    const aim = Math.atan2(game.player.y - roadblock.y, game.player.x - roadblock.x);
    game.cops.push({
      x: roadblock.x - Math.cos(aim) * 24, y: roadblock.y - Math.sin(aim) * 24,
      angle: aim, aimAngle: aim, health: 58, fireTimer: 0.3, state: 'chase', phase: 1.2, timer: 0, scream: 0,
    });
    game.cops.push({
      x: roadblock.x - Math.cos(aim) * 24 + 26, y: roadblock.y - Math.sin(aim) * 24 + 18,
      angle: aim, aimAngle: aim, health: 58, fireTimer: 0.38, state: 'chase', phase: 2.4, timer: 0, scream: 0,
    });
  }
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - game.player.x, ped.y - game.player.y) > 460) continue;
    ped.state = 'flee';
    ped.timer = 4;
    const away = Math.atan2(ped.y - game.player.y, ped.x - game.player.x);
    ped.fleeX = Math.cos(away);
    ped.fleeY = Math.sin(away);
    ped.scream = 1;
  }
  // Tyre marks from the swerve he just made.
  const vehicle = game.player.vehicle;
  for (let index = 0; index < 9; index += 1) {
    spawnSkid(game.effects, vehicle.x - Math.cos(vehicle.angle) * index * 15, vehicle.y - Math.sin(vehicle.angle) * index * 15, vehicle.angle, vehicle.kind.width, 0.85);
  }
  // No subtitle here: the bottom of the frame belongs to the cruisers.
  game.dialog = null;
  game.wanted.heat = WANTED.thresholds[3] + 24;
  game.wanted.stars = 3;
  game.toasts.length = 0;
  game.toast('Wanted level 3');
  // The officers open fire, then a handful of frames put the tracers and the muzzle smoke in the
  // picture without letting anything drift out of the composition just set up.
  for (const cop of game.cops) {
    cop.fireTimer = 0;
    copFire(game, cop, SHOT_STEP);
  }
  simulate(game, 0.07, (input, time, state) => {
    laneAutopilot(input, state, { x: lane.x, y: lane.y, angle: lane.angle }, 250);
  });
  game.wanted.heat = WANTED.thresholds[3] + 24;
  game.wanted.stars = 3;
  // Hold the camera on Riley with no velocity lead, so the cars on his tail stay in frame.
  frameOn(game, game.player.vehicle, 0, 1.4);
  return { screen: 'play', clock: game.time };
}
