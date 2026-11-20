// The story of PORT SABLE in four jobs. Each mission is a list of stages; a stage names its
// objective, puts a waypoint somewhere real in the city, and says what finishes it. The HUD banner
// and the minimap blip both read straight off whatever stage is current, so nothing is faked.
import { clearHeat, addHeat, starsFor } from './wanted.js';
import { WANTED } from './config.js';
import { giveWeapon } from './combat.js';
import { createPed } from './peds.js';
import { spawnTrafficNear } from './traffic.js';
import { range } from './rng.js';

/** Is Riley (on foot or driving) within `radius` of a point? */
function near(game, point, radius) {
  if (!point) return false;
  const player = game.player;
  const x = player.vehicle ? player.vehicle.x : player.x;
  const y = player.vehicle ? player.vehicle.y : player.y;
  return Math.hypot(x - point.x, y - point.y) <= radius;
}

/** Riley has parked a particular car at a destination. */
function delivered(game, vehicle, point) {
  return Boolean(vehicle) && game.player.vehicle === vehicle && near(game, point, 86) && Math.abs(vehicle.forward) < 55;
}

/** The "report to Mae" stage every job opens with, so she is always somewhere to walk to. */
function meetMae(line) {
  return {
    text: 'Meet Mae Calder on Pier Two',
    label: 'MAE',
    point: (game) => game.city.landmarks.mae,
    enter: (game) => game.say('RILEY', 'She only ever calls when she wants something driven.', 4),
    done: (game) => near(game, game.city.landmarks.mae, 62) && !game.player.vehicle,
    exit: (game) => game.say('MAE CALDER', line, 6),
  };
}

export const MISSIONS = [
  {
    id: 'wheels',
    number: 1,
    title: 'Wheels',
    blurb: 'Mae wants a car off the street. You need the money more than she needs the car.',
    reward: 400,
    stages: [
      meetMae('A teal coupe sits on Palm Reach all day. Bring it to the docks and we are square for a week.'),
      {
        text: 'Steal the teal coupe on Palm Reach',
        label: 'COUPE',
        point: (game) => game.missionTargets.coupe,
        enter: (game) => game.toast('Hold F at the driver door to hotwire'),
        done: (game) => game.player.vehicle === game.missionTargets.coupe,
        exit: (game) => game.say('RILEY', 'Still warm. Somebody loves this car.', 3.5),
      },
      {
        text: 'Deliver the coupe to The Docks',
        label: 'DROP',
        point: (game) => game.city.landmarks.dropDocks,
        done: (game) => delivered(game, game.missionTargets.coupe, game.city.landmarks.dropDocks),
        exit: (game) => game.say('MAE CALDER', 'Clean work. Keep your phone on.', 4),
      },
    ],
  },
  {
    id: 'envelope',
    number: 2,
    title: 'Envelope',
    blurb: 'A paper envelope, two miles of traffic, and a man in Palm Reach who does not like waiting.',
    reward: 650,
    stages: [
      meetMae('Envelope in Calder Midtown. On foot for the pickup — nobody hands paper through a car window.'),
      {
        text: 'Collect the envelope in Calder Midtown (on foot)',
        label: 'PICKUP',
        point: (game) => game.city.landmarks.pickupMidtown,
        enter: (game) => {
          // Midtown fills up: a crowd on the pavement and more cars on the road to push through.
          crowdUp(game, game.city.landmarks.pickupMidtown, 22);
          trafficUp(game, game.city.landmarks.pickupMidtown, 10);
          game.toast('Leave the car — he hands it over in person');
        },
        done: (game) => !game.player.vehicle && near(game, game.city.landmarks.pickupMidtown, 34),
        exit: (game) => {
          game.player.carrying = 'envelope';
          game.say('COURIER', 'Palm Reach. Do not read it, do not fold it.', 4);
        },
      },
      {
        text: 'Drop the envelope at Palm Reach',
        label: 'DROP',
        point: (game) => game.city.landmarks.dropPalmReach,
        enter: (game) => {
          crowdUp(game, game.city.landmarks.dropPalmReach, 16);
          trafficUp(game, game.city.landmarks.dropPalmReach, 8);
        },
        done: (game) => near(game, game.city.landmarks.dropPalmReach, 48),
        exit: (game) => {
          game.player.carrying = null;
          game.say('MAE CALDER', 'He paid. That never happens. Get off the street for a bit.', 4.5);
        },
      },
    ],
  },
  {
    id: 'heat',
    number: 3,
    title: 'Heat',
    blurb: 'The buyer at Old Fort brought friends with badges. Lose them and get to the hideout.',
    reward: 900,
    stages: [
      meetMae('Stand in for me at Old Fort. Hand over, take the cash, walk away. Simple.'),
      {
        text: 'Make the handover at Old Fort',
        label: 'DEAL',
        point: (game) => game.city.landmarks.dealOldFort,
        enter: (game) => game.say('RILEY', 'Old Fort. Nothing good has ever happened to me at Old Fort.', 4),
        done: (game) => near(game, game.city.landmarks.dealOldFort, 58),
        exit: (game) => {
          // The deal goes loud: two stars and a cruiser already rolling.
          if ((game.player.arsenal.pistol ?? 0) === 0) giveWeapon(game, 'pistol', 48);
          game.wanted.heat = Math.max(game.wanted.heat, WANTED.thresholds[2] + 22);
          game.wanted.stars = starsFor(game.wanted.heat);
          game.wanted.spawnTimer = 0;
          game.wanted.flash = 1;
          addHeat(game, 'trespass');
          game.audio.missionFail();
          game.say('BUYER', 'Police! It was never my deal, driver!', 4);
          game.toast('Wanted level 2 — lose them');
        },
      },
      {
        text: 'Lose the police and reach the hideout',
        label: 'HIDEOUT',
        point: (game) => game.city.landmarks.hideout,
        done: (game) => near(game, game.city.landmarks.hideout, 70),
        exit: (game) => {
          clearHeat(game);
          game.say('MAE CALDER', 'In. Lights off. You were never at Old Fort.', 4.5);
          game.toast('Heat lost');
        },
      },
    ],
  },
  {
    id: 'lift',
    number: 4,
    title: 'The Lift',
    blurb: 'One van out of the refinery yard and the debt is gone. Mae swears it is the last one.',
    reward: 2600,
    stages: [
      meetMae('Marked van, refinery yard, alarm on the door. Bring it here and your paper is torn up.'),
      {
        text: 'Steal the marked van at The Refinery',
        label: 'VAN',
        point: (game) => game.missionTargets.van,
        enter: (game) => game.toast('The yard van is alarmed — expect company'),
        done: (game) => game.player.vehicle === game.missionTargets.van,
        exit: (game) => {
          game.wanted.heat = Math.max(game.wanted.heat, WANTED.thresholds[3] + 14);
          game.wanted.stars = starsFor(game.wanted.heat);
          game.wanted.spawnTimer = 0;
          game.say('RILEY', 'That is an alarm. Of course it is an alarm.', 3.5);
          game.toast('Wanted level 3');
        },
      },
      {
        text: 'Deliver the van to Mae at The Docks',
        label: 'DROP',
        point: (game) => game.city.landmarks.dropDocks,
        done: (game) => delivered(game, game.missionTargets.van, game.city.landmarks.dropDocks),
        exit: (game) => {
          clearHeat(game);
          game.say('MAE CALDER', 'Debt is paid, Riley. Port Sable will miss you about a week.', 6);
        },
      },
    ],
  },
];

/** Fresh story state. */
export function createMissions() {
  return { index: 0, stage: 0, completed: [], banner: 1.6, cardTimer: 0, card: null, done: false, started: false };
}

/** The mission being played, or null once the story is over. */
export function currentMission(game) {
  return game.missions.done ? null : MISSIONS[game.missions.index] ?? null;
}

/** The stage being played. */
export function currentStage(game) {
  const mission = currentMission(game);
  if (!mission) return null;
  return mission.stages[game.missions.stage] ?? null;
}

/** The objective line the HUD banner shows. */
export function objectiveText(game) {
  const stage = currentStage(game);
  if (!stage) return 'Story complete — Port Sable is yours to drive';
  return stage.text;
}

/** The world waypoint for the current stage, as a point plus a short minimap label. */
export function missionWaypoint(game) {
  const stage = currentStage(game);
  if (!stage) return null;
  const point = stage.point(game);
  if (!point) return null;
  return { x: point.x, y: point.y, label: stage.label };
}

/** Begin the story (or resume it after a load). */
export function beginMission(game, index, stage) {
  game.missions.index = index;
  game.missions.stage = stage ?? 0;
  game.missions.started = true;
  game.missions.banner = 2.4;
  const current = currentStage(game);
  if (current && current.enter) current.enter(game);
}

/** Step the story: check the current stage, advance it, pay out a finished mission. */
export function updateMissions(game, dt) {
  const state = game.missions;
  state.banner = Math.max(0, state.banner - dt);
  if (state.cardTimer > 0) state.cardTimer = Math.max(0, state.cardTimer - dt);
  if (state.done) return;
  const mission = currentMission(game);
  const stage = currentStage(game);
  if (!mission || !stage) return;
  if (!stage.done(game, dt)) return;

  if (stage.exit) stage.exit(game);
  state.stage += 1;
  if (state.stage < mission.stages.length) {
    const next = currentStage(game);
    if (next && next.enter) next.enter(game);
    state.banner = 2.4;
    game.audio.ui();
    return;
  }
  // Mission over: pay, card, next job.
  game.player.money += mission.reward;
  state.completed.push(mission.id);
  game.audio.missionDone();
  state.card = {
    title: `${mission.title} — complete`,
    lines: [`+$${mission.reward}`, mission.id === 'lift' ? 'The debt to Mae Calder is cleared.' : 'Mae will call again.'],
  };
  state.cardTimer = 4.2;
  state.stage = 0;
  if (state.index + 1 >= MISSIONS.length) {
    state.done = true;
    state.card = {
      title: 'THE DEBT IS PAID',
      lines: ['Riley Voss keeps the van, the money and the city.', 'Free roam: Port Sable, any car you like.'],
    };
    state.cardTimer = 7;
  } else {
    state.index += 1;
    state.banner = 2.6;
    const next = currentStage(game);
    if (next && next.enter) next.enter(game);
  }
}

/** Mission 2 needs a busy road too: more cars on the junctions around a point. */
function trafficUp(game, point, count) {
  for (const vehicle of spawnTrafficNear(game.random, game.city, point, 760, count)) {
    game.vehicles.push(vehicle);
  }
}

/** Mission 2 needs a busy street: drop extra walkers onto the blocks around a point. */
function crowdUp(game, point, count) {
  const blocks = game.city.blocks.filter((block) => Math.hypot(block.x + block.w / 2 - point.x, block.y + block.h / 2 - point.y) < 620);
  if (blocks.length === 0) return;
  for (let index = 0; index < count; index += 1) {
    const block = blocks[Math.floor(game.random() * blocks.length) % blocks.length];
    const ped = createPed(game.random, game.city, block);
    ped.speed *= range(game.random, 0.9, 1.25);
    game.peds.push(ped);
  }
}
