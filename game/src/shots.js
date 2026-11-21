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
import { spawnTrafficNear } from './traffic.js';
import { starsFor } from './wanted.js';
import { copFire, giveWeapon, playerAttack } from './combat.js';
import { enterVehicle, stepGame } from './world.js';
import { spawnSkid } from './effects.js';
import { createAir } from './air.js';
import { clearSave, saveGame } from './save.js';
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
  if (name === 'combat') return stageCombat(game);
  if (name === 'chase' || name === 'wanted') return stageChase(game);
  return stageTitle(game);
}

/**
 * The cover. Two runs are played into save slots 1 and 2 through the game's own save code, so the
 * slot panel on the title card is reading real localStorage rather than a drawing of one.
 */
function stageTitle(game) {
  const runs = [
    { slot: 0, mission: 1, stage: 2, money: 1240, health: 78, armour: 0, respect: 104, time: 437, district: 'The Docks', weapon: 'pistol', arsenal: { fists: 0, pistol: 31 } },
    { slot: 1, mission: 3, stage: 2, money: 1865, health: 54, armour: 42, respect: 311, time: 1126, district: 'Calder Midtown', weapon: 'smg', arsenal: { fists: 0, pistol: 12, shotgun: 8, smg: 96 } },
  ];
  for (const run of runs) {
    const player = game.player;
    player.money = run.money;
    player.health = run.health;
    player.armour = run.armour;
    player.respect = run.respect;
    player.weapon = run.weapon;
    player.arsenal = run.arsenal;
    player.district = run.district;
    game.missions.index = run.mission;
    game.missions.stage = run.stage;
    game.time = run.time;
    game.stamp = run.slot + 1;
    saveGame(game, run.slot);
  }
  // The third slot stays open, so the card shows both states of the save system.
  clearSave(2);
  return { screen: 'title', clock: 0.42 };
}

/** On foot in Palm Reach, mid-hotwire, mission 1 live, the street full of people. */
function stageStreet(game) {
  const coupe = game.missionTargets.coupe;
  beginMission(game, 0, 1);
  game.player.money = 240;
  game.player.health = 92;
  game.player.armour = 35;
  game.player.respect = 72;
  game.player.arsenal.pistol = 31;
  standBeside(game, coupe);
  crowd(game, coupe.x, coupe.y, 40, 520);
  // A handful of walkers right on this stretch of pavement, so the street is busy where the
  // camera is rather than busy somewhere off screen.
  const here = nearestSidewalk(game.city, coupe.x, coupe.y);
  if (here) {
    for (let index = 0; index < 15; index += 1) {
      const ped = createPed(game.random, game.city, here.block);
      ped.along = here.along + (index - 7) * 34 + range(game.random, -10, 10);
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
  // Cars actually rolling past the theft, not just parked around it.
  for (const vehicle of spawnTrafficNear(game.random, game.city, coupe, 620, 9)) game.vehicles.push(vehicle);
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


/**
 * A gunfight on foot in Palm Reach: job 5 has gone loud, Riley is behind the Harbour SMG with the
 * muzzle lit, two officers are firing back across the junction and the crowd is running. Every
 * round in the air was fired by the game's own trigger code a few hundredths of a second ago.
 */
function stageCombat(game) {
  const city = game.city;
  const player = game.player;
  beginMission(game, 4, 2);
  player.money = 3120;
  player.respect = 364;
  player.arsenal.pistol = 18;
  player.arsenal.shotgun = 11;
  giveWeapon(game, 'smg', 96);
  game.wanted.heat = WANTED.thresholds[3] + 20;
  game.wanted.stars = starsFor(game.wanted.heat);
  game.wanted.spawnTimer = 0.5;
  // A clear stretch of a Palm Reach arterial, so both halves of the firefight stand on asphalt
  // with the kerb behind the officers and nothing parked between the two of them.
  const street = city.streets.find((candidate) => !candidate.arterial && candidate.y > 820 && candidate.y < 1900) ?? city.streets[4];
  const avenue = city.avenues.find((candidate) => candidate.x > 2520) ?? city.avenues[city.avenues.length - 2];
  const centre = { x: avenue.x + 232, y: street.y };
  const stand = collideCircle(city, centre.x - 52, centre.y + 56, PLAYER.radius);
  player.x = stand.x;
  player.y = stand.y;
  const enemyX = centre.x + 52;
  const enemyY = centre.y - 26;
  const aim = Math.atan2(enemyY - player.y, enemyX - player.x);
  player.angle = aim;
  player.aimAngle = aim;
  // Nothing parked on top of either side: a door prompt or a kerbside car would hide the fight.
  game.vehicles = game.vehicles.filter((vehicle) =>
    Math.hypot(vehicle.x - player.x, vehicle.y - player.y) > 60 && Math.hypot(vehicle.x - enemyX, vehicle.y - enemyY) > 70);
  crowd(game, centre.x, centre.y - 160, 26, 560);
  // The cruiser the officers came in, slewed onto the kerb, and the two of them behind it.
  const cruiser = createVehicle(game.random, 'cruiser', enemyX + 30, enemyY - 24, aim + Math.PI / 2 + 0.3, 'police');
  cruiser.siren = true;
  cruiser.deployed = true;
  cruiser.driver = null;
  cruiser.callsign = 'HP-23';
  cruiser.lightPhase = 0.6;
  game.vehicles.push(cruiser);
  const back = aim + Math.PI;
  for (const [offX, offY, timer] of [[0, 0, 0.3], [10, 22, 0.44]]) {
    game.cops.push({
      x: enemyX + offX, y: enemyY + offY, angle: back, aimAngle: back,
      health: 58, fireTimer: timer, state: 'chase', phase: 1.4 + offY, timer: 0, scream: 0, muzzle: 0,
    });
  }
  // One already down in the road, so the fight reads as having been going on.
  game.cops.push({
    x: enemyX - 8, y: enemyY + 42, angle: aim, aimAngle: aim,
    health: 0, state: 'down', phase: 0, timer: 1.4, scream: 0, muzzle: 0,
  });
  // Traffic stopped further up the street, and the crowd on the pavement behind him.
  for (const vehicle of spawnTrafficNear(game.random, game.city, { x: centre.x - 470, y: centre.y }, 360, 5)) game.vehicles.push(vehicle);
  // Kerbside cars either side of the fight, well clear of both, so the street is lined.
  for (const spot of city.parkingSpots) {
    const away = Math.hypot(spot.x - centre.x, spot.y - centre.y);
    if (away > 300 || away < 110) continue;
    if (game.vehicles.some((vehicle) => Math.hypot(vehicle.x - spot.x, vehicle.y - spot.y) < 34)) continue;
    game.vehicles.push(createVehicle(game.random, pick(game.random, ['cab', 'coupe', 'pickup', 'van']), spot.x, spot.y, spot.angle, 'parked'));
  }
  snapCamera(game.camera, game);
  simulate(game, 1.1, null);
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - player.x, ped.y - player.y) > 460) continue;
    ped.state = 'flee';
    ped.timer = 4;
    const away = Math.atan2(ped.y - player.y, ped.x - player.x);
    ped.fleeX = Math.cos(away);
    ped.fleeY = Math.sin(away);
    ped.scream = 1;
  }
  game.say('MAE CALDER', 'Do not argue with them, Riley. Get to the garage.', 9);
  // Three rounds out of the SMG and two back from the officers, a few hundredths of a second
  // apart, so the frame holds tracers travelling both ways and a muzzle still lit.
  for (let shot = 0; shot < 2; shot += 1) {
    player.angle = aim;
    player.aimAngle = aim;
    player.fireTimer = 0;
    playerAttack(game, SHOT_STEP);
    if (shot === 0) for (const cop of game.cops) { cop.fireTimer = 0; copFire(game, cop, SHOT_STEP); }
    simulate(game, 0.032, (input, time, state) => {
      state.player.aimAngle = aim;
      state.player.angle = aim;
    });
  }
  game.wanted.seen = true;
  player.health = 61;
  player.armour = 58;
  player.x = stand.x;
  player.y = stand.y;
  player.angle = aim;
  player.aimAngle = aim;
  game.prompt = null;
  game.toasts.length = 0;
  game.toast('Wanted level 3');
  frameOn(game, { x: centre.x, y: centre.y + 48, angle: 0 }, 0, 2.6);
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
    // Every staged cruiser is a numbered unit, the same way dispatchCruiser numbers a live one.
    game.wanted.unit = (game.wanted.unit % 89) + 1;
    vehicle.callsign = `HP-${String(game.wanted.unit).padStart(2, '0')}`;
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

/**
 * Four stars on Sable Avenue: the coupe flat out, civilian traffic either side, three cruisers in
 * the mirror, a fourth slewed across the kerb with its officers out and firing, and AIR ONE
 * overhead with its lamp on the road. The dispatch board in the corner is the same four units.
 */
function stageChase(game) {
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
  game.player.armour = 46;
  game.player.respect = 311;
  game.player.arsenal.pistol = 12;
  game.player.arsenal.shotgun = 8;
  game.player.arsenal.smg = 96;
  game.player.weapon = 'smg';
  beginMission(game, 3, 2);
  game.wanted.heat = WANTED.thresholds[4] + 30;
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
  // AIR ONE overhead, its lamp on the road just behind him: four stars buys the helicopter, and
  // the stager puts it where the live dispatcher would have flown it.
  const driven = game.player.vehicle;
  game.air = createAir(driven.x - 104, driven.y - 89, Math.PI / 2);
  game.air.beamX = driven.x - 26;
  game.air.beamY = driven.y - 54;
  game.air.rotor = 1.1;
  game.air.strobe = 1.2;
  game.wanted.lit = true;

  // Tyre marks from the swerve he just made.
  const vehicle = game.player.vehicle;
  for (let index = 0; index < 9; index += 1) {
    spawnSkid(game.effects, vehicle.x - Math.cos(vehicle.angle) * index * 15, vehicle.y - Math.sin(vehicle.angle) * index * 15, vehicle.angle, vehicle.kind.width, 0.85);
  }
  // No subtitle here: the bottom of the frame belongs to the cruisers.
  game.dialog = null;
  game.wanted.heat = WANTED.thresholds[4] + 30;
  game.wanted.stars = 4;
  game.toasts.length = 0;
  game.toast('AIR ONE is up');
  // The officers open fire, then a handful of frames put the tracers and the muzzle smoke in the
  // picture without letting anything drift out of the composition just set up.
  for (const cop of game.cops) {
    cop.fireTimer = 0;
    copFire(game, cop, SHOT_STEP);
  }
  simulate(game, 0.07, (input, time, state) => {
    laneAutopilot(input, state, { x: lane.x, y: lane.y, angle: lane.angle }, 250);
  });
  game.wanted.heat = WANTED.thresholds[4] + 30;
  game.wanted.stars = 4;
  game.wanted.lit = true;
  // Hold the camera on Riley with no velocity lead, so the cars on his tail stay in frame.
  frameOn(game, game.player.vehicle, 0, 1.4);
  return { screen: 'play', clock: game.time };
}
