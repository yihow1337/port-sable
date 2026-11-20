// Fists, guns and what they hit. Bullets are stepped segments: each one is swept a short way and
// tested against people, police, cars and the city itself, so nothing is hit through a wall.
import { collideCircle } from './city.js';
import { COP, PED, PLAYER, WEAPONS } from './config.js';
import { alertPeds, damagePed } from './peds.js';
import { range, pick } from './rng.js';
import { pointInVehicle, damageVehicle } from './vehicles.js';
import { spawnBlood, spawnCasing, spawnDust, spawnMuzzleFlash, spawnSparks } from './effects.js';
import { addHeat } from './wanted.js';

/** The order Q cycles through, once Riley has found the guns. */
export const WEAPON_ORDER = ['fists', 'pistol', 'smg'];

/** Hand Riley a weapon and its ammunition. */
export function giveWeapon(game, id, ammo) {
  const weapon = WEAPONS[id];
  if (!weapon) return;
  game.player.arsenal[id] = (game.player.arsenal[id] ?? 0) + ammo;
  game.player.weapon = id;
  game.player.fireTimer = 0;
}

/** Switch to the next weapon Riley actually carries. */
export function cycleWeapon(game) {
  const owned = WEAPON_ORDER.filter((id) => id === 'fists' || (game.player.arsenal[id] ?? 0) > 0);
  const at = owned.indexOf(game.player.weapon);
  game.player.weapon = owned[(at + 1) % owned.length];
}

/** The rounds left for the held weapon, or -1 for fists. */
export function heldAmmo(player) {
  if (player.weapon === 'fists') return -1;
  return player.arsenal[player.weapon] ?? 0;
}

/** Spawn one bullet. `hostile` marks police fire, which is the only kind that can hurt Riley. */
export function spawnBullet(game, x, y, angle, weapon, hostile, owner) {
  const spread = (weapon.spread ?? 0.04) * (game.random() * 2 - 1);
  const heading = angle + spread;
  game.bullets.push({
    x, y,
    vx: Math.cos(heading) * weapon.speed,
    vy: Math.sin(heading) * weapon.speed,
    angle: heading,
    travelled: 0,
    range: weapon.range,
    damage: weapon.damage,
    hostile,
    owner,
  });
  spawnMuzzleFlash(game.effects, game.random, x, y, heading);
  spawnCasing(game.effects, game.random, x, y, heading);
}

/** Riley pulls the trigger (or throws a punch). Returns true when a shot or swing happened. */
export function playerAttack(game, dt) {
  const player = game.player;
  player.fireTimer -= dt;
  if (player.fireTimer > 0) return false;
  const weapon = WEAPONS[player.weapon];
  if (weapon.melee) {
    player.fireTimer = weapon.rate;
    player.punch = PLAYER.punchTime;
    punch(game);
    return true;
  }
  if ((player.arsenal[player.weapon] ?? 0) <= 0) {
    player.weapon = 'fists';
    return false;
  }
  player.arsenal[player.weapon] -= 1;
  player.fireTimer = weapon.rate;
  const muzzle = 15;
  spawnBullet(game, player.x + Math.cos(player.aimAngle) * muzzle, player.y + Math.sin(player.aimAngle) * muzzle, player.aimAngle, weapon, false, 'player');
  player.recoil = weapon.kick ?? 2;
  game.audio.gunshot(player.weapon);
  addHeat(game, 'gunshot');
  alertPeds(game.peds, player.x, player.y, PED.panicRadius, game.random);
  return true;
}

/** A swing of the fists: the nearest person or officer in front of Riley takes it. */
export function punch(game) {
  const player = game.player;
  const hitX = player.x + Math.cos(player.aimAngle) * PLAYER.punchRange * 0.7;
  const hitY = player.y + Math.sin(player.aimAngle) * PLAYER.punchRange * 0.7;
  game.audio.punch();
  let landed = false;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - hitX, ped.y - hitY) > PLAYER.punchRange * 0.72) continue;
    const killed = damagePed(ped, PLAYER.punchDamage, game.random);
    spawnBlood(game.effects, game.random, ped.x, ped.y, player.aimAngle);
    addHeat(game, killed ? 'killPed' : 'punchPed');
    alertPeds(game.peds, ped.x, ped.y, 150, game.random);
    landed = true;
    break;
  }
  if (!landed) {
    for (const cop of game.cops) {
      if (cop.health <= 0) continue;
      if (Math.hypot(cop.x - hitX, cop.y - hitY) > PLAYER.punchRange * 0.72) continue;
      damageCop(game, cop, PLAYER.punchDamage, player.aimAngle);
      landed = true;
      break;
    }
  }
  if (!landed) spawnDust(game.effects, game.random, hitX, hitY);
  return landed;
}

/** Hurt an officer, and add the heat for putting one down. */
export function damageCop(game, cop, amount, angle) {
  cop.health -= amount;
  spawnBlood(game.effects, game.random, cop.x, cop.y, angle);
  if (cop.health <= 0) {
    cop.health = 0;
    cop.state = 'down';
    addHeat(game, 'killCop');
    game.player.money += 25;
    game.toast('Officer down');
  }
}

/** Hurt Riley, and end the run when he drops. */
export function damagePlayer(game, amount, angle) {
  const player = game.player;
  if (player.dead) return;
  player.health -= amount;
  player.hurt = 1;
  spawnBlood(game.effects, game.random, player.x, player.y, angle ?? 0);
  game.camera.shake = Math.min(14, game.camera.shake + 3.5);
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    game.onBusted('wasted');
  }
}

/** Move every bullet and resolve the first thing it meets. */
export function updateBullets(game, dt) {
  const bullets = game.bullets;
  for (let index = bullets.length - 1; index >= 0; index -= 1) {
    const bullet = bullets[index];
    const steps = 3;
    let done = false;
    for (let step = 0; step < steps && !done; step += 1) {
      const sub = dt / steps;
      bullet.x += bullet.vx * sub;
      bullet.y += bullet.vy * sub;
      bullet.travelled += Math.hypot(bullet.vx, bullet.vy) * sub;
      if (bullet.travelled > bullet.range) done = true;

      if (!done && bullet.hostile) {
        const player = game.player;
        const target = player.vehicle ?? player;
        const radius = player.vehicle ? player.vehicle.kind.width * 0.6 : PLAYER.radius + 2;
        if (Math.hypot(bullet.x - target.x, bullet.y - target.y) < radius) {
          if (player.vehicle) {
            damageVehicle(player.vehicle, bullet.damage * 0.8);
            damagePlayer(game, bullet.damage * 0.35, bullet.angle);
            spawnSparks(game.effects, game.random, bullet.x, bullet.y, bullet.angle);
          } else {
            damagePlayer(game, bullet.damage, bullet.angle);
          }
          done = true;
        }
      }
      if (!done && !bullet.hostile) {
        for (const ped of game.peds) {
          if (ped.state === 'down') continue;
          if (Math.hypot(bullet.x - ped.x, bullet.y - ped.y) > PED.radius + 2) continue;
          const killed = damagePed(ped, bullet.damage, game.random);
          spawnBlood(game.effects, game.random, bullet.x, bullet.y, bullet.angle);
          addHeat(game, killed ? 'killPed' : 'punchPed');
          alertPeds(game.peds, ped.x, ped.y, PED.panicRadius, game.random);
          done = true;
          break;
        }
        for (const cop of game.cops) {
          if (done || cop.health <= 0) continue;
          if (Math.hypot(bullet.x - cop.x, bullet.y - cop.y) > PED.radius + 3) continue;
          damageCop(game, cop, bullet.damage, bullet.angle);
          done = true;
        }
      }
      if (!done) {
        for (const vehicle of game.vehicles) {
          if (vehicle === game.player.vehicle && !bullet.hostile) continue;
          if (!pointInVehicle(vehicle, bullet.x, bullet.y)) continue;
          damageVehicle(vehicle, bullet.damage);
          spawnSparks(game.effects, game.random, bullet.x, bullet.y, bullet.angle);
          done = true;
          break;
        }
      }
      if (!done && collideCircle(game.city, bullet.x, bullet.y, 1.5).hit) {
        spawnSparks(game.effects, game.random, bullet.x, bullet.y, bullet.angle);
        done = true;
      }
    }
    if (done) bullets.splice(index, 1);
  }
}

/** An officer takes a shot at Riley when he is in range and in the open. */
export function copFire(game, cop, dt) {
  cop.fireTimer -= dt;
  if (cop.fireTimer > 0) return;
  const player = game.player;
  const distance = Math.hypot(player.x - cop.x, player.y - cop.y);
  if (distance > COP.range) return;
  cop.fireTimer = COP.rate * range(game.random, 0.8, 1.4);
  const angle = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.aimAngle = angle;
  spawnBullet(game, cop.x + Math.cos(angle) * 14, cop.y + Math.sin(angle) * 14, angle, { damage: COP.damage, spread: COP.spread, speed: COP.speed, range: COP.range + 90 }, true, 'cop');
  game.audio.gunshot('pistol');
  alertPeds(game.peds, cop.x, cop.y, PED.panicRadius, game.random);
}

/** The things lying around the city to pick up. */
export function spawnPickups(random, city) {
  const marks = city.landmarks;
  return [
    { type: 'pistol', x: marks.pickupMidtown.x + 70, y: marks.pickupMidtown.y + 46, ammo: 54, bob: 0, taken: false },
    { type: 'pistol', x: marks.hideout.x - 54, y: marks.hideout.y + 26, ammo: 42, bob: 1.1, taken: false },
    { type: 'smg', x: marks.refineryYard.x + 46, y: marks.refineryYard.y + 58, ammo: 140, bob: 2.2, taken: false },
    { type: 'health', x: marks.dropPalmReach.x - 60, y: marks.dropPalmReach.y + 40, bob: 0.6, taken: false },
    { type: 'health', x: marks.dealOldFort.x + 58, y: marks.dealOldFort.y + 52, bob: 1.8, taken: false },
    { type: 'cash', x: marks.dropDocks.x - 90, y: marks.dropDocks.y - 46, amount: 180, bob: 3, taken: false },
    { type: 'cash', x: marks.pickupMidtown.x - 110, y: marks.pickupMidtown.y + 74, amount: 120, bob: 2.6, taken: false },
    { type: 'smg', x: marks.dealOldFort.x - 74, y: marks.dealOldFort.y + 30, ammo: 90, bob: 0.3, taken: false },
  ];
}

/** Bob the pickups and collect any Riley walks over. */
export function updatePickups(game, dt) {
  const player = game.player;
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    pickup.bob += dt * 2.6;
    if (player.vehicle) continue;
    if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > 22) continue;
    pickup.taken = true;
    if (pickup.type === 'cash') {
      player.money += pickup.amount;
      game.toast(`+$${pickup.amount}`);
    } else if (pickup.type === 'health') {
      player.health = Math.min(PLAYER.health, player.health + 40);
      game.toast('Patched up');
    } else {
      giveWeapon(game, pickup.type, pickup.ammo);
      game.toast(`${WEAPONS[pickup.type].name} — ${pickup.ammo} rounds`);
    }
    game.audio.pickup();
  }
}
