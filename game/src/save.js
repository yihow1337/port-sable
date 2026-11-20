// The single save slot in localStorage: enough of the run to put Riley back where he was, with
// his money, his guns, his heat and the story he has got through.
import { SAVE_KEY } from './config.js';

/** Boil the live game down to a small plain object. */
export function snapshot(game) {
  const player = game.player;
  return {
    version: 2,
    seed: game.seed,
    time: Math.round(game.time * 10) / 10,
    x: Math.round(player.x),
    y: Math.round(player.y),
    health: Math.round(player.health),
    money: player.money,
    weapon: player.weapon,
    arsenal: { ...player.arsenal },
    heat: Math.round(game.wanted.heat),
    mission: game.missions.index,
    stage: game.missions.stage,
    completed: game.missions.completed.slice(),
    inVehicle: player.vehicle ? player.vehicle.kind.id : null,
    pickups: game.pickups.map((pickup) => (pickup.taken ? 1 : 0)),
    stamp: game.stamp,
  };
}

/** Write the slot. Returns true when it stuck. */
export function saveGame(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(game)));
    return true;
  } catch {
    return false;
  }
}

/** Read the slot, or null when there is nothing (or nothing usable) there. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 2 || typeof data.x !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Is there a run to continue? */
export function hasSave() {
  return loadSave() !== null;
}

/** Throw the slot away. */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do: storage is unavailable, so there was no save anyway.
  }
}
