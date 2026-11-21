// Three save slots in localStorage. A slot holds enough of the run to put Riley back where he
// was — his money, armour, guns, respect, heat and the job he is on — plus the short summary the
// title card and the pause menu print beside the slot number.
import { SAVE_KEY, SAVE_SLOTS } from './config.js';
import { MISSIONS } from './missions.js';

/** The storage key of one slot. */
function keyOf(slot) {
  return `${SAVE_KEY}.${slot}`;
}

/** Minutes and seconds of play, for the slot line. */
function clockOf(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Boil the live game down to a small plain object. */
export function snapshot(game) {
  const player = game.player;
  const mission = MISSIONS[game.missions.index];
  return {
    version: 3,
    seed: game.seed,
    time: Math.round(game.time * 10) / 10,
    x: Math.round(player.x),
    y: Math.round(player.y),
    health: Math.round(player.health),
    armour: Math.round(player.armour),
    money: player.money,
    respect: Math.round(player.respect),
    weapon: player.weapon,
    arsenal: { ...player.arsenal },
    heat: Math.round(game.wanted.heat),
    mission: game.missions.index,
    stage: game.missions.stage,
    completed: game.missions.completed.slice(),
    inVehicle: player.vehicle ? player.vehicle.kind.id : null,
    pickups: game.pickups.map((pickup) => (pickup.taken ? 1 : 0)),
    stamp: game.stamp,
    // Printed straight onto the slot, so the menus never have to rebuild a world to read one.
    label: game.missions.done ? 'Story complete' : `Job ${(mission?.number ?? 1)} of ${MISSIONS.length} · ${mission?.title ?? 'Wheels'}`,
    district: player.district,
    clock: clockOf(game.time),
  };
}

/** Write one slot. Returns true when it stuck. */
export function saveGame(game, slot) {
  try {
    window.localStorage.setItem(keyOf(slot ?? 0), JSON.stringify(snapshot(game)));
    return true;
  } catch {
    return false;
  }
}

/** Read one slot, or null when there is nothing (or nothing usable) there. */
export function loadSave(slot) {
  try {
    const raw = window.localStorage.getItem(keyOf(slot ?? 0));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 3 || typeof data.x !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Every slot, in order, as `null` or a save — what the title card and the pause menu draw. */
export function readSlots() {
  const slots = [];
  for (let index = 0; index < SAVE_SLOTS; index += 1) slots.push(loadSave(index));
  return slots;
}

/** The slot a Continue should resume: the one played most recently. */
export function latestSlot() {
  const slots = readSlots();
  let best = -1;
  for (let index = 0; index < slots.length; index += 1) {
    if (!slots[index]) continue;
    if (best < 0 || (slots[index].stamp ?? 0) > (slots[best].stamp ?? 0)) best = index;
  }
  return best;
}

/** Is there any run to continue? */
export function hasSave() {
  return latestSlot() >= 0;
}

/** Throw one slot away. */
export function clearSave(slot) {
  try {
    window.localStorage.removeItem(keyOf(slot ?? 0));
  } catch {
    // Nothing to do: storage is unavailable, so there was no save anyway.
  }
}
