// AIR ONE — Harbour Patrol's spotter. Once the dispatcher is out of cars (four stars) it puts a
// helicopter over Riley: it flies a lead on whatever he is driving, holds a slow orbit above him
// and drags a spotlight across the street. While the beam is on him the heat never cools, so the
// air unit is the thing that makes a four-star chase feel different from a three-star one.
import { AIR } from './config.js';

/** One helicopter, entering from off the map. */
export function createAir(x, y, angle) {
  return {
    x, y, angle,
    vx: Math.cos(angle) * AIR.speed,
    vy: Math.sin(angle) * AIR.speed,
    rotor: 0,
    strobe: 0,
    beamX: x,
    beamY: y,
    orbit: 0,
    altitude: 190,
    leaving: false,
    callsign: AIR.callsign,
  };
}

/** Where the air unit is trying to be: a lead on Riley, offset around a slow orbit. */
function station(game, air) {
  const player = game.player;
  const target = player.vehicle ?? player;
  const leadX = target.x + (target.vx ?? 0) * AIR.lead;
  const leadY = target.y + (target.vy ?? 0) * AIR.lead;
  return {
    x: leadX + Math.cos(air.orbit) * AIR.hover,
    y: leadY + Math.sin(air.orbit) * AIR.hover * 0.7,
    leadX,
    leadY,
  };
}

/** Fly the air unit for one step, and say whether its beam is on Riley. */
export function updateAir(game, dt) {
  const air = game.air;
  if (!air) return false;
  air.rotor += dt * 34;
  air.strobe += dt * 4.4;
  air.orbit += dt * (air.leaving ? 0 : 0.5);
  const spot = station(game, air);
  const toX = air.leaving ? air.x + Math.cos(air.angle) * 600 : spot.x;
  const toY = air.leaving ? air.y + Math.sin(air.angle) * 600 : spot.y;
  const dx = toX - air.x;
  const dy = toY - air.y;
  const distance = Math.hypot(dx, dy) || 1;
  // A helicopter leans into its heading, so the turn is eased rather than snapped.
  const want = Math.atan2(dy, dx);
  const difference = ((want - air.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  air.angle += difference * Math.min(1, dt * 2.2);
  const push = Math.min(AIR.speed, distance * 1.8);
  air.vx += (Math.cos(air.angle) * push - air.vx) * Math.min(1, dt * 1.6);
  air.vy += (Math.sin(air.angle) * push - air.vy) * Math.min(1, dt * 1.6);
  air.x += air.vx * dt;
  air.y += air.vy * dt;
  // The beam trails the car it is hunting, so it sweeps the road instead of sticking to him.
  air.beamX += (spot.leadX - air.beamX) * Math.min(1, dt * 1.5);
  air.beamY += (spot.leadY - air.beamY) * Math.min(1, dt * 1.5);
  const player = game.player;
  const lit = !air.leaving && Math.hypot(air.beamX - player.x, air.beamY - player.y) < AIR.beam * 0.55;
  if (air.leaving && Math.hypot(air.x - player.x, air.y - player.y) > 2200) game.air = null;
  return lit;
}

/** Send the air unit home; it flies off rather than blinking out. */
export function dismissAir(game) {
  if (game.air) game.air.leaving = true;
}
