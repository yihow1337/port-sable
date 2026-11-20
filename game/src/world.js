// The world: one object holding the city, Riley, every car, the crowd, the police, the story and
// the effects, plus the single step() that advances all of it. Both the live loop in main.js and
// the screenshot stagers in shots.js drive the game only through this file.
import { buildCity, collideCircle, districtAt } from './city.js';
import { PED, PLAYER, START_MONEY, TRAFFIC } from './config.js';
import { createRandom, pick } from './rng.js';
import { createCamera, snapCamera, updateCamera } from './camera.js';
import { createEffects, spawnBurst, spawnDust, spawnSkid, spawnSmoke, updateEffects } from './effects.js';
import { CIVILIAN_KINDS, createVehicle, damageVehicle, driveVehicle, nearestVehicle, separateVehicles, spawnParkedCars, vehicleSpeed } from './vehicles.js';
import { recycleTraffic, spawnTraffic, updateTraffic } from './traffic.js';
import { alertPeds, damagePed, recyclePeds, spawnPeds, updatePeds } from './peds.js';
import { addHeat, clearHeat, createWanted, updateWanted } from './wanted.js';
import { playerAttack, spawnPickups, updateBullets, updatePickups, cycleWeapon, heldAmmo } from './combat.js';
import { beginMission, createMissions, currentStage, updateMissions } from './missions.js';
import { createSilentAudio } from './audio.js';

/** How close Riley must be to a door to open or force it. */
const DOOR_RANGE = 46;

/** A new game of PORT SABLE, built from one seed. */
export function createGame(seed, options) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const start = { x: city.landmarks.mae.x + 120, y: city.lastStreetY - 56 };

  const game = {
    seed,
    random,
    city,
    time: 0,
    stamp: 0,
    audio: options?.audio ?? createSilentAudio(),
    effects: createEffects(),
    wanted: createWanted(),
    missions: createMissions(),
    bullets: [],
    cops: [],
    toasts: [],
    dialog: null,
    prompt: null,
    overlay: null,
    paused: false,
    player: {
      x: start.x,
      y: start.y,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      aimAngle: -Math.PI / 2,
      health: PLAYER.health,
      money: START_MONEY,
      weapon: 'fists',
      arsenal: { fists: 0 },
      vehicle: null,
      hotwire: null,
      punch: 0,
      recoil: 0,
      hurt: 0,
      dead: false,
      hiding: false,
      carrying: null,
      phase: 0,
      fireTimer: 0,
      running: false,
      district: city.landmarks.mae ? 'docks' : 'docks',
    },
    missionTargets: { coupe: null, van: null },
    // Mae Calder waits on her pier the whole game, so there is always a face to walk to.
    npcs: [{
      x: city.landmarks.mae.x, y: city.landmarks.mae.y, angle: -Math.PI / 2, phase: 0,
      name: 'Mae Calder', shirt: '#c75d86', skin: '#c58a5d', trousers: '#39404f', scream: 0,
    }],
  };

  game.collide = (x, y, radius) => collideCircle(city, x, y, radius);
  game.toast = (text) => {
    game.toasts.push({ text, life: 3.4 });
    if (game.toasts.length > 4) game.toasts.shift();
  };
  game.say = (who, text, seconds) => {
    game.dialog = { who, text, life: seconds ?? 4 };
  };
  game.onBusted = (reason) => bust(game, reason);
  game.camera = createCamera(start.x, start.y);

  game.vehicles = spawnParkedCars(random, city, 96);
  for (const vehicle of spawnTraffic(random, city, TRAFFIC.count)) game.vehicles.push(vehicle);
  game.peds = spawnPeds(random, city, PED.count);
  game.pickups = spawnPickups(random, city);
  placeMissionVehicles(game);
  beginMission(game, 0, 0);
  snapCamera(game.camera, game);
  return game;
}

/** The teal coupe of mission 1 and the marked yard van of mission 4, on real parking geometry. */
function placeMissionVehicles(game) {
  const { city, random } = game;
  // The kerb bay with the most city around it, so the car is parked on a street with walls on
  // both sides rather than against the back of a park.
  const spotIn = (districtId) => {
    const spots = city.parkingSpots.filter((spot) =>
      spot.kerb && spot.block && spot.block.kind === 'buildings' && districtAt(spot.x, spot.y).id === districtId);
    let best = null;
    let bestScore = -1;
    for (const spot of spots) {
      let score = 0;
      for (const building of city.buildings) {
        if (Math.abs(building.x - spot.x) < 300 && Math.abs(building.y - spot.y) < 300) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }
    return best;
  };
  const coupeSpot = spotIn('palmreach') ?? { x: city.landmarks.dropPalmReach.x, y: city.landmarks.dropPalmReach.y + 40, angle: 0 };
  // Clear any ordinary parked car sitting in the bay we want.
  game.vehicles = game.vehicles.filter((vehicle) => Math.hypot(vehicle.x - coupeSpot.x, vehicle.y - coupeSpot.y) > 30);
  const coupe = createVehicle(random, 'coupe', coupeSpot.x, coupeSpot.y, coupeSpot.angle ?? 0, 'mission');
  coupe.color = '#2fb7c2';
  coupe.missionTag = 'coupe';
  game.vehicles.push(coupe);
  game.missionTargets.coupe = coupe;

  const yard = city.landmarks.refineryYard;
  const van = createVehicle(random, 'van', yard.x + 54, yard.y + 64, 0.2, 'mission');
  van.color = '#e9e3d4';
  van.marked = true;
  van.missionTag = 'van';
  const settled = collideCircle(game.city, van.x, van.y, 26);
  van.x = settled.x;
  van.y = settled.y;
  game.vehicles.push(van);
  game.missionTargets.van = van;
}

/** Riley gets into a car: the driver (if any) bails out and the engine is his. */
export function enterVehicle(game, vehicle) {
  const player = game.player;
  if (vehicle.driver === 'traffic') {
    const bail = createThrownPed(game, vehicle);
    game.peds.push(bail);
    alertPeds(game.peds, vehicle.x, vehicle.y, 190, game.random);
  }
  vehicle.driver = 'player';
  vehicle.role = vehicle.role === 'mission' ? 'mission' : 'player';
  vehicle.locked = false;
  vehicle.abandoned = false;
  player.vehicle = vehicle;
  player.hotwire = null;
  player.x = vehicle.x;
  player.y = vehicle.y;
  game.audio.unlock();
  return vehicle;
}

/** Riley gets out, on the kerb side when there is room. */
export function exitVehicle(game) {
  const player = game.player;
  const vehicle = player.vehicle;
  if (!vehicle) return;
  const side = vehicle.angle + Math.PI / 2;
  let x = vehicle.x + Math.cos(side) * (vehicle.kind.width / 2 + 14);
  let y = vehicle.y + Math.sin(side) * (vehicle.kind.width / 2 + 14);
  let spot = collideCircle(game.city, x, y, PLAYER.radius);
  if (spot.hit) {
    x = vehicle.x - Math.cos(side) * (vehicle.kind.width / 2 + 14);
    y = vehicle.y - Math.sin(side) * (vehicle.kind.width / 2 + 14);
    spot = collideCircle(game.city, x, y, PLAYER.radius);
  }
  player.x = spot.x;
  player.y = spot.y;
  player.vx = vehicle.vx * 0.2;
  player.vy = vehicle.vy * 0.2;
  player.vehicle = null;
  vehicle.driver = null;
  vehicle.role = 'player';
  game.audio.idle();
}

/** A traffic driver thrown out of their own car, already running. */
function createThrownPed(game, vehicle) {
  const side = vehicle.angle - Math.PI / 2;
  const ped = {
    block: game.city.blocks[0],
    along: 0,
    heading: 1,
    x: vehicle.x + Math.cos(side) * 22,
    y: vehicle.y + Math.sin(side) * 22,
    angle: side,
    speed: PED.walk,
    state: 'flee',
    timer: 4.5,
    shirt: '#d8d2c3',
    skin: '#d9a271',
    trousers: '#3f4756',
    hat: false,
    bag: false,
    phase: 0,
    health: PED.health,
    fleeX: Math.cos(side),
    fleeY: Math.sin(side),
    scream: 1,
  };
  return ped;
}

/** The door prompt: what is in reach, and how far the hotwire has got. */
function updateDoorPrompt(game, input, dt) {
  const player = game.player;
  game.prompt = null;
  if (player.vehicle) {
    game.prompt = { text: 'Press F to get out', progress: 0 };
    if (input.interactPressed) exitVehicle(game);
    return;
  }
  // A hotwire in progress keeps its car even if a van rolls past closer: the bar should not
  // reset itself because the nearest vehicle changed for a frame.
  const held = player.hotwire?.vehicle;
  const stillThere = held && !held.dead && Math.hypot(held.x - player.x, held.y - player.y) < DOOR_RANGE * 1.3;
  const vehicle = stillThere
    ? held
    : nearestVehicle(game.vehicles, player.x, player.y, DOOR_RANGE, (candidate) => !candidate.dead && candidate.driver !== 'player' && candidate.driver !== 'police');
  if (!vehicle) {
    player.hotwire = null;
    return;
  }
  const name = vehicle.kind.name;
  if (!vehicle.locked) {
    game.prompt = { text: `Press F to drive the ${name}`, progress: 0, vehicle };
    if (input.interactPressed) enterVehicle(game, vehicle);
    return;
  }
  // Locked: hold the key, watch the bar fill, then it is yours and the heat lands.
  if (!player.hotwire || player.hotwire.vehicle !== vehicle) player.hotwire = { vehicle, progress: 0 };
  if (input.interact) {
    player.hotwire.progress += dt / PLAYER.hotwireTime;
    if (player.hotwire.progress >= 1) {
      enterVehicle(game, vehicle);
      addHeat(game, 'hotwire');
      game.toast(`${name} hotwired`);
      game.audio.pickup();
      if (vehicle.marked) game.audio.wantedUp(3);
      return;
    }
  } else {
    player.hotwire.progress = Math.max(0, player.hotwire.progress - dt * 1.6);
  }
  game.prompt = {
    text: player.hotwire.progress > 0.02 ? `Hotwiring the ${name}…` : `Hold F to steal the ${name}`,
    progress: player.hotwire.progress,
    vehicle,
  };
}

/** Riley on foot: move, aim, swing or shoot. */
function updateOnFoot(game, input, dt) {
  const player = game.player;
  const length = Math.hypot(input.moveX, input.moveY);
  const speed = input.run ? PLAYER.run : PLAYER.walk;
  player.running = input.run && length > 0;
  const wantX = length > 0 ? (input.moveX / length) * speed : 0;
  const wantY = length > 0 ? (input.moveY / length) * speed : 0;
  const ease = Math.min(1, (PLAYER.accel / Math.max(1, speed)) * dt);
  player.vx += (wantX - player.vx) * ease;
  player.vy += (wantY - player.vy) * ease;
  const moved = collideCircle(game.city, player.x + player.vx * dt, player.y + player.vy * dt, PLAYER.radius);
  player.x = moved.x;
  player.y = moved.y;
  if (length > 0) {
    player.angle = Math.atan2(player.vy, player.vx);
    player.phase += dt * (input.run ? 16 : 10);
  }
  player.aimAngle = input.aimActive
    ? Math.atan2(input.aimWorldY - player.y, input.aimWorldX - player.x)
    : player.angle;
  player.punch = Math.max(0, player.punch - dt);
  player.recoil = Math.max(0, player.recoil - dt * 12);
  if (input.fire) playerAttack(game, dt);
  else player.fireTimer = Math.max(0, player.fireTimer - dt);
  game.audio.idle();
}

/** Riley driving: throttle, steering, skids, and whatever he runs into. */
function updateDriving(game, input, dt) {
  const player = game.player;
  const vehicle = player.vehicle;
  const controls = { throttle: -input.moveY, steer: input.moveX, handbrake: input.handbrake };
  const impact = driveVehicle(game.city, vehicle, dt, controls);
  player.x = vehicle.x;
  player.y = vehicle.y;
  player.vx = vehicle.vx;
  player.vy = vehicle.vy;
  player.angle = vehicle.angle;
  player.aimAngle = vehicle.angle;
  if (impact > 70) {
    const hurt = (impact - 70) * 0.045;
    player.health = Math.max(1, player.health - hurt);
    damageVehicle(vehicle, impact * 0.09);
    game.camera.shake = Math.min(15, game.camera.shake + impact * 0.03);
    game.audio.crash(impact);
    spawnDust(game.effects, game.random, vehicle.x, vehicle.y);
  }
  if (vehicle.skidTimer > 0 && Math.abs(vehicle.forward) > 40) {
    spawnSkid(game.effects, vehicle.x, vehicle.y, vehicle.angle, vehicle.kind.width, Math.min(1, Math.abs(vehicle.lateral) / 120));
  }
  const speed = vehicleSpeed(vehicle);
  // Dust off the back tyres at speed, so a fast car looks fast even in a still frame.
  if (speed > 170 && game.random() < 0.5) {
    const back = vehicle.kind.length * 0.42;
    spawnBurst(game.effects, game.random, vehicle.x - Math.cos(vehicle.angle) * back, vehicle.y - Math.sin(vehicle.angle) * back, {
      count: 1, spread: 0.7, angle: vehicle.angle + Math.PI, speed: 40, life: 0.32, size: 3.4,
      color: 'rgba(214, 196, 164, 0.42)', drag: 3.4,
    });
  }
  game.audio.drive(Math.min(1, speed / vehicle.kind.topSpeed), Math.abs(controls.throttle), vehicle.skidTimer > 0 ? Math.min(1, Math.abs(vehicle.lateral) / 140) : 0);
  if (vehicle.dead) {
    spawnSmoke(game.effects, game.random, vehicle.x, vehicle.y, 1);
    exitVehicle(game);
  }
}

/** Cars against people: anything over walking pace knocks a pedestrian down. */
function runDownPeds(game, dt) {
  for (const vehicle of game.vehicles) {
    const speed = vehicleSpeed(vehicle);
    if (speed < 48) continue;
    const reach = vehicle.kind.length * 0.52;
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - vehicle.x, ped.y - vehicle.y) > reach) continue;
      const killed = damagePed(ped, 18 + speed * 0.22, game.random);
      ped.x += (vehicle.vx / speed) * 16;
      ped.y += (vehicle.vy / speed) * 16;
      alertPeds(game.peds, ped.x, ped.y, PED.panicRadius, game.random);
      if (vehicle === game.player.vehicle) addHeat(game, killed ? 'killPed' : 'hitPed');
      game.audio.punch();
    }
    for (const cop of game.cops) {
      if (cop.health <= 0) continue;
      if (Math.hypot(cop.x - vehicle.x, cop.y - vehicle.y) > reach) continue;
      cop.health -= 30 + speed * 0.3;
      if (cop.health <= 0) {
        cop.state = 'down';
        if (vehicle === game.player.vehicle) addHeat(game, 'killCop');
      }
    }
  }
}

/** Every pair of moving cars pushed apart, so collisions read as collisions. */
function resolveVehiclePairs(game) {
  const list = game.vehicles;
  for (let a = 0; a < list.length; a += 1) {
    const first = list[a];
    const firstDriven = first.driver !== null || first === game.player.vehicle;
    for (let b = a + 1; b < list.length; b += 1) {
      const second = list[b];
      if (!firstDriven && second.driver === null && second !== game.player.vehicle) continue;
      if (Math.abs(first.x - second.x) > 70 || Math.abs(first.y - second.y) > 70) continue;
      const closing = separateVehicles(first, second);
      if (closing > 120) {
        damageVehicle(first, closing * 0.045);
        damageVehicle(second, closing * 0.045);
        if (first === game.player.vehicle || second === game.player.vehicle) {
          game.camera.shake = Math.min(13, game.camera.shake + closing * 0.025);
          game.audio.crash(closing);
        }
      }
    }
  }
}

/** Busted or wasted: lose the car, lose some money, wake up at the hideout, keep the mission. */
function bust(game, reason) {
  const player = game.player;
  const spot = reason === 'busted' ? game.city.landmarks.hideout : game.city.landmarks.mae;
  if (player.vehicle) exitVehicle(game);
  clearHeat(game);
  game.cops.length = 0;
  for (let index = game.vehicles.length - 1; index >= 0; index -= 1) {
    if (game.vehicles[index].role === 'police') game.vehicles.splice(index, 1);
  }
  const fee = reason === 'busted' ? Math.min(player.money, 250) : Math.min(player.money, 120);
  player.money -= fee;
  player.health = PLAYER.health;
  player.dead = false;
  player.carrying = null;
  const safe = collideCircle(game.city, spot.x, spot.y - 40, PLAYER.radius);
  player.x = safe.x;
  player.y = safe.y;
  player.vx = 0;
  player.vy = 0;
  game.overlay = {
    title: reason === 'busted' ? 'BUSTED' : 'WASTED',
    lines: [reason === 'busted' ? `Night in the cells. -$${fee}` : `Patched up at the dock clinic. -$${fee}`, 'Objective restarted'],
    life: 3.4,
  };
  game.missions.banner = 2.6;
  const stage = currentStage(game);
  if (stage && stage.enter) stage.enter(game);
  game.audio.missionFail();
  snapCamera(game.camera, game);
}

/** One simulation step. `input` is an input.js snapshot; everything else is derived. */
export function stepGame(game, dt, input) {
  game.time += dt;
  game.stamp += 1;
  const player = game.player;
  input.aimWorldX = input.aimWorldX ?? player.x + Math.cos(player.aimAngle) * 200;
  input.aimWorldY = input.aimWorldY ?? player.y + Math.sin(player.aimAngle) * 200;

  if (input.switchPressed) cycleWeapon(game);
  updateDoorPrompt(game, input, dt);
  if (player.vehicle) updateDriving(game, input, dt);
  else updateOnFoot(game, input, dt);

  updateTraffic(game, dt);
  resolveVehiclePairs(game);
  runDownPeds(game, dt);
  updatePeds(game, dt);
  updateWanted(game, dt);
  updateBullets(game, dt);
  updatePickups(game, dt);
  updateMissions(game, dt);
  updateEffects(game.effects, dt);

  for (const vehicle of game.vehicles) {
    if (vehicle.smoke > 0) {
      spawnSmoke(game.effects, game.random, vehicle.x, vehicle.y, vehicle.smoke);
      if (vehicle.dead) vehicle.smoke = Math.min(1.4, vehicle.smoke + dt * 0.1);
    }
    if (vehicle.driver === 'traffic' && vehicle.skidTimer > 0) {
      spawnSkid(game.effects, vehicle.x, vehicle.y, vehicle.angle, vehicle.kind.width, 0.4);
    }
  }
  for (const cruiser of game.vehicles) {
    if (cruiser.role === 'police' && cruiser.siren && Math.hypot(cruiser.x - player.x, cruiser.y - player.y) < 620) {
      game.audio.siren(true);
      break;
    }
  }

  const hideout = game.city.landmarks.hideout;
  player.hiding = Math.hypot(player.x - hideout.x, player.y - hideout.y) < 92;
  player.district = districtAt(player.x, player.y).name;
  player.hurt = Math.max(0, player.hurt - dt * 2);

  for (let index = game.toasts.length - 1; index >= 0; index -= 1) {
    game.toasts[index].life -= dt;
    if (game.toasts[index].life <= 0) game.toasts.splice(index, 1);
  }
  if (game.dialog) {
    game.dialog.life -= dt;
    if (game.dialog.life <= 0) game.dialog = null;
  }
  if (game.overlay) {
    game.overlay.life -= dt;
    if (game.overlay.life <= 0) game.overlay = null;
  }
  if (game.stamp % 90 === 0) {
    recycleTraffic(game, player.x, player.y);
    recyclePeds(game, player.x, player.y);
    prunePolice(game);
  }
  updateCamera(game.camera, game, dt);
}

/** Drop wrecked or forgotten cruisers so the chase does not pile up for ever. */
function prunePolice(game) {
  for (let index = game.vehicles.length - 1; index >= 0; index -= 1) {
    const vehicle = game.vehicles[index];
    if (vehicle.role !== 'police') continue;
    const away = Math.hypot(vehicle.x - game.player.x, vehicle.y - game.player.y);
    if ((vehicle.dead && away > 900) || away > 2400 || (game.wanted.stars === 0 && away > 700)) game.vehicles.splice(index, 1);
  }
}

/** Put a loaded save back into a fresh world. */
export function applySave(game, data) {
  const player = game.player;
  player.x = data.x;
  player.y = data.y;
  player.health = data.health;
  player.money = data.money;
  player.weapon = data.weapon ?? 'fists';
  player.arsenal = { fists: 0, ...(data.arsenal ?? {}) };
  game.wanted.heat = data.heat ?? 0;
  game.time = data.time ?? 0;
  if (Array.isArray(data.pickups)) {
    for (let index = 0; index < game.pickups.length && index < data.pickups.length; index += 1) {
      game.pickups[index].taken = data.pickups[index] === 1;
    }
  }
  game.missions.completed = data.completed ?? [];
  game.missions.done = (data.mission ?? 0) >= 4;
  beginMission(game, Math.min(3, data.mission ?? 0), data.stage ?? 0);
  if (data.inVehicle) {
    const vehicle = createVehicle(game.random, data.inVehicle, player.x, player.y, player.angle, 'player');
    game.vehicles.push(vehicle);
    enterVehicle(game, vehicle);
  }
  snapCamera(game.camera, game);
}

/** A loose car near a point, for the shot stagers and the "any car you like" free roam. */
export function placeVehicleNear(game, kindId, x, y, angle, role) {
  const kind = kindId ?? pick(game.random, CIVILIAN_KINDS);
  const vehicle = createVehicle(game.random, kind, x, y, angle, role ?? 'parked');
  const settled = collideCircle(game.city, x, y, kind === 'van' ? 26 : 22);
  vehicle.x = settled.x;
  vehicle.y = settled.y;
  game.vehicles.push(vehicle);
  return vehicle;
}

/** Riley's ammunition for the HUD. */
export function playerAmmo(game) {
  return heldAmmo(game.player);
}

