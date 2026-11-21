// The heads-up display. PORT SABLE's own layout: squared-off slabs with a thin amber rule along
// the top edge, stacked into four corners so the middle of the screen is always the city. It
// carries Riley's vitals and rank, the job and its stage, the wanted stars, the live dispatch
// board, the speedometer and the car he is in, the radio line, the four weapon slots, a portrait
// beside every line of dialogue, and the north-up minimap. Everything on it is read off the game.
import { PLAYER, RANKS, VIEW, WEAPONS, WANTED, WORLD } from './config.js';
import { waterEdge } from './city.js';
import { currentMission, missionWaypoint, objectiveText, stageProgress } from './missions.js';
import { WEAPON_ORDER } from './combat.js';
import { dispatchList } from './wanted.js';
import { vehicleSpeed } from './vehicles.js';
import { roundRect } from './draw.js';

const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MAP = { size: 206, pad: 20, span: 1750 };
const PANEL = 'rgba(17, 19, 23, 0.68)';
const AMBER = '#ffd48a';

/** Every slab on the HUD is the same shape: dark plate, thin amber rule along its top edge. */
function slab(ctx, x, y, w, h, rule) {
  ctx.fillStyle = PANEL;
  roundRect(ctx, x, y, w, h, 7);
  ctx.fill();
  ctx.fillStyle = rule ?? 'rgba(255, 196, 104, 0.55)';
  roundRect(ctx, x, y, w, 2.5, 1.5);
  ctx.fill();
}

/** A labelled bar: the HUD's only meter shape, reused for health, armour, respect and condition. */
function meter(ctx, x, y, w, h, fraction, from, to) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, Math.max(2.5, w * Math.max(0, Math.min(1, fraction))), h, h / 2);
  ctx.fill();
}

/** A five-pointed star path. */
function starPath(ctx, x, y, radius) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const r = point % 2 === 0 ? radius : radius * 0.46;
    const angle = (point / 10) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Money with thousands separators. */
function money(amount) {
  return `$${Math.max(0, Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** The rank Riley's respect has bought him, and how far it is to the next one. */
export function rankOf(respect) {
  let at = RANKS[0];
  let next = null;
  for (let index = 0; index < RANKS.length; index += 1) {
    if (respect >= RANKS[index].at) {
      at = RANKS[index];
      next = RANKS[index + 1] ?? null;
    }
  }
  const span = next ? next.at - at.at : 1;
  return { name: at.name, next, fraction: next ? Math.min(1, (respect - at.at) / span) : 1 };
}

/** Everything on top of the world for one frame. */
export function drawHud(ctx, game) {
  drawVitals(ctx, game);
  drawWantedStars(ctx, game);
  drawDispatch(ctx, game);
  drawObjective(ctx, game);
  drawWeaponRack(ctx, game);
  drawDrivePanel(ctx, game);
  drawRadio(ctx, game);
  drawMinimap(ctx, game);
  drawPrompt(ctx, game);
  drawDialog(ctx, game);
  drawToasts(ctx, game);
  drawOverlay(ctx, game);
}

/** Name, rank, health, armour, cash, district and whatever Riley is carrying. Top left. */
function drawVitals(ctx, game) {
  const player = game.player;
  const rank = rankOf(player.respect);
  ctx.save();
  slab(ctx, 20, 16, 300, 96);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.78)';
  ctx.fillText('RILEY VOSS', 33, 36);
  ctx.textAlign = 'right';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = 'rgba(255, 196, 120, 0.85)';
  ctx.fillText(rank.name.toUpperCase(), 307, 36);
  // Health, then the dock vest under it, then the thin respect rule under both.
  meter(ctx, 33, 44, 182, 11, player.health / PLAYER.health, player.health > 35 ? '#5fd39a' : '#e4594f', player.health > 35 ? '#a6ecaa' : '#f3906d');
  meter(ctx, 33, 59, 182, 7, player.armour / PLAYER.armour, '#6f9fd8', '#b7d6f2');
  meter(ctx, 33, 70, 182, 4, rank.fraction, '#b58a4a', '#ffd48a');
  ctx.font = `800 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(14, 16, 18, 0.85)';
  ctx.fillText(`${Math.ceil(player.health)}`, 39, 53);
  ctx.textAlign = 'right';
  ctx.font = `800 27px ${FONT}`;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(money(player.money), 307, 66);
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(240, 228, 206, 0.62)';
  ctx.fillText(player.district.toUpperCase(), 33, 92);
  ctx.fillStyle = 'rgba(180, 206, 232, 0.72)';
  ctx.fillText(`VEST ${Math.round(player.armour)}`, 33, 106);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(240, 228, 206, 0.62)';
  ctx.fillText(`RESPECT ${Math.round(player.respect)}`, 307, 92);
  if (player.carrying) {
    ctx.fillStyle = AMBER;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(`CARRYING: ${player.carrying.toUpperCase()}`, 307, 106);
  }
  ctx.restore();
}

/** Wanted level, top right: five stars, lit to the current level. */
function drawWantedStars(ctx, game) {
  const wanted = game.wanted;
  ctx.save();
  const width = 206;
  const x = VIEW.width - width - 20;
  slab(ctx, x, 16, width, 62);
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.74)';
  ctx.textAlign = 'left';
  ctx.fillText('WANTED', x + 14, 34);
  if (wanted.stars > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = wanted.lit ? '#ffe08a' : wanted.seen ? '#ff8c6a' : 'rgba(246, 232, 206, 0.55)';
    ctx.fillText(wanted.lit ? 'LIT UP' : wanted.seen ? 'IN SIGHT' : 'COOLING', x + width - 14, 34);
  }
  const pulse = wanted.flash > 0 ? 1 + Math.sin(game.time * 24) * 0.14 : 1;
  for (let index = 0; index < 5; index += 1) {
    const cx = x + 28 + index * 38;
    const cy = 58;
    const lit = index < wanted.stars;
    if (lit) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffbe4a';
      starPath(ctx, cx, cy, 17 * pulse);
      ctx.fill();
      ctx.restore();
    }
    starPath(ctx, cx, cy, 13 * (lit ? pulse : 1));
    ctx.fillStyle = lit ? '#ffd45e' : 'rgba(255, 255, 255, 0.11)';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = lit ? 'rgba(120, 72, 10, 0.8)' : 'rgba(255, 240, 210, 0.22)';
    ctx.stroke();
  }
  ctx.restore();
}

/** The live dispatch board, under the stars: who is on the chase, doing what, how far out. */
function drawDispatch(ctx, game) {
  if (game.wanted.stars <= 0) return;
  const units = dispatchList(game);
  if (units.length === 0) return;
  ctx.save();
  const width = 238;
  const x = VIEW.width - width - 20;
  const y = 86;
  const height = 30 + units.length * 19;
  slab(ctx, x, y, width, height, 'rgba(120, 170, 255, 0.6)');
  ctx.textAlign = 'left';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = 'rgba(190, 214, 255, 0.85)';
  ctx.fillText('HARBOUR PATROL · DISPATCH', x + 13, y + 20);
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const lineY = y + 38 + index * 19;
    // A flashing pip per unit: blue for a car, amber for the air unit, grey once it is out.
    ctx.fillStyle = unit.down ? 'rgba(150, 150, 150, 0.5)' : unit.air ? '#ffd45e'
      : Math.sin(game.time * 7 + index) > 0 ? '#6ea4ff' : '#ff6a56';
    ctx.fillRect(x + 13, lineY - 7, 5, 7);
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = unit.down ? 'rgba(220, 214, 204, 0.45)' : '#f2ecdf';
    ctx.fillText(unit.callsign, x + 25, lineY);
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = unit.down ? 'rgba(220, 214, 204, 0.4)' : 'rgba(214, 226, 240, 0.78)';
    ctx.fillText(unit.role, x + 82, lineY);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(240, 230, 212, 0.6)';
    ctx.fillText(`${unit.metres} m`, x + width - 13, lineY);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** The job banner: which job of how many, which stage of it, and the objective. */
function drawObjective(ctx, game) {
  const mission = currentMission(game);
  const progress = stageProgress(game);
  const text = objectiveText(game);
  ctx.save();
  ctx.font = `600 17px ${FONT}`;
  const width = Math.max(392, ctx.measureText(text).width + 132);
  const x = VIEW.width / 2 - width / 2;
  const grow = game.missions.banner > 0 ? Math.min(1, game.missions.banner / 0.4) : 0;
  ctx.fillStyle = 'rgba(16, 18, 22, 0.7)';
  roundRect(ctx, x, 16, width, 64, 7);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 206, 110, ${0.5 + grow * 0.5})`;
  roundRect(ctx, x, 16, width, 2.5, 1.5);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `800 12px ${FONT}`;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(mission ? `JOB ${mission.number} OF ${game.missions.total} · ${mission.title.toUpperCase()}` : 'FREE ROAM · PORT SABLE', x + 16, 38);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(246, 232, 206, 0.62)';
  ctx.fillText(mission ? `STAGE ${progress.stage}/${progress.total}` : 'STORY COMPLETE', x + width - 16, 38);
  ctx.textAlign = 'center';
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = '#f6efe2';
  ctx.fillText(text, VIEW.width / 2, 66);
  ctx.restore();
}

/** Four weapon slots, bottom right: what Riley carries, what is loaded, what is in his hands. */
function drawWeaponRack(ctx, game) {
  const player = game.player;
  ctx.save();
  const width = 300;
  const x = VIEW.width - width - 20;
  const y = VIEW.height - 92;
  slab(ctx, x, y, width, 76);
  ctx.textAlign = 'left';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.55)';
  ctx.fillText('WEAPONS · Q', x + 13, y + 18);
  ctx.textAlign = 'right';
  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = '#f6efe2';
  const held = WEAPONS[player.weapon] ?? WEAPONS.fists;
  ctx.fillText(held.melee ? held.name : `${held.name}  ·  ${player.arsenal[player.weapon] ?? 0}`, x + width - 13, y + 19);
  const slotW = (width - 26 - 18) / 4;
  for (let index = 0; index < WEAPON_ORDER.length; index += 1) {
    const id = WEAPON_ORDER[index];
    const weapon = WEAPONS[id];
    const rounds = id === 'fists' ? -1 : player.arsenal[id] ?? 0;
    const owned = id === 'fists' || rounds > 0;
    const active = player.weapon === id;
    const slotX = x + 13 + index * (slotW + 6);
    ctx.fillStyle = active ? 'rgba(255, 206, 110, 0.2)' : 'rgba(0, 0, 0, 0.34)';
    roundRect(ctx, slotX, y + 28, slotW, 36, 5);
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255, 212, 128, 0.9)' : 'rgba(246, 232, 206, 0.16)';
    ctx.lineWidth = active ? 1.6 : 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = active ? '#ffe3ab' : owned ? 'rgba(240, 232, 216, 0.74)' : 'rgba(240, 232, 216, 0.26)';
    ctx.fillText(weapon.short, slotX + slotW / 2, y + 44);
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = active ? 'rgba(255, 226, 170, 0.9)' : 'rgba(240, 232, 216, 0.42)';
    ctx.fillText(rounds < 0 ? '—' : `${rounds}`, slotX + slotW / 2, y + 58);
  }
  ctx.restore();
}

/** Speedometer, car and condition, bottom left of centre — only while Riley is driving. */
function drawDrivePanel(ctx, game) {
  const vehicle = game.player.vehicle;
  if (!vehicle) return;
  ctx.save();
  const x = MAP.pad + MAP.size + 16;
  const width = 212;
  const y = VIEW.height - 92;
  slab(ctx, x, y, width, 76);
  // Speed in km/h: a world unit is about nine centimetres of Port Sable.
  const kph = Math.round(vehicleSpeed(vehicle) * 0.324);
  const top = Math.round(vehicle.kind.topSpeed * 0.324);
  ctx.textAlign = 'left';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.55)';
  ctx.fillText(vehicle.kind.name.toUpperCase(), x + 13, y + 18);
  ctx.textAlign = 'right';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = kph > top * 0.8 ? '#ffb96a' : '#f6efe2';
  ctx.fillText(`${kph}`, x + width - 40, y + 44);
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.6)';
  ctx.fillText('KM/H', x + width - 13, y + 44);
  // The needle: a bar of ticks that fills with speed, so a still frame reads as fast.
  for (let tick = 0; tick < 18; tick += 1) {
    const on = tick / 18 < kph / Math.max(1, top);
    ctx.fillStyle = on ? (tick > 13 ? '#ff8b5a' : AMBER) : 'rgba(255, 236, 200, 0.14)';
    ctx.fillRect(x + 13 + tick * 10.6, y + 50, 7, 6);
  }
  ctx.textAlign = 'left';
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.5)';
  ctx.fillText(`PLATE ${vehicle.plate}`, x + 13, y + 72);
  ctx.textAlign = 'right';
  const condition = Math.max(0, vehicle.health / vehicle.kind.health);
  ctx.fillStyle = condition > 0.4 ? 'rgba(246, 232, 206, 0.5)' : '#ff8b6a';
  ctx.fillText(`BODY ${Math.round(condition * 100)}%`, x + width - 13, y + 72);
  meter(ctx, x + 13, y + 60, width - 26, 4, condition, condition > 0.4 ? '#7fb88a' : '#e4594f', condition > 0.4 ? '#cfe8b4' : '#ffa07a');
  ctx.restore();
}

/** The radio line: one thin plate along the bottom, on while the engine is. */
function drawRadio(ctx, game) {
  if (!game.player.vehicle) return;
  ctx.save();
  const width = 396;
  const x = 478;
  const y = VIEW.height - 32;
  ctx.fillStyle = 'rgba(17, 19, 23, 0.6)';
  roundRect(ctx, x, y, width, 24, 5);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `800 10px ${FONT}`;
  ctx.fillStyle = '#7fe3d2';
  ctx.fillText(game.radio.station, x + 12, y + 16);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(240, 232, 216, 0.8)';
  ctx.fillText(game.radio.track, x + 132, y + 16);
  ctx.restore();
}

/** Where a world point sits on the minimap, and whether it is inside the dial. */
function mapPoint(game, x, y) {
  const scale = MAP.size / MAP.span;
  const centreX = MAP.pad + MAP.size / 2;
  const centreY = VIEW.height - MAP.pad - MAP.size / 2;
  return {
    x: centreX + (x - game.player.x) * scale,
    y: centreY + (y - game.player.y) * scale,
    centreX,
    centreY,
    scale,
  };
}

/** The minimap: water, the road grid, district tints, blips, and Riley's arrow at the centre. */
export function drawMinimap(ctx, game) {
  const city = game.city;
  const left = MAP.pad;
  const top = VIEW.height - MAP.pad - MAP.size;
  const scale = MAP.size / MAP.span;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 12, 14, 0.8)';
  roundRect(ctx, left - 4, top - 4, MAP.size + 8, MAP.size + 8, 11);
  ctx.fill();
  roundRect(ctx, left, top, MAP.size, MAP.size, 8);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#6b6255';
  ctx.fillRect(left, top, MAP.size, MAP.size);
  const southEdge = mapPoint(game, 0, waterEdge(game.player.x));
  if (southEdge.y < top + MAP.size) {
    ctx.fillStyle = '#1f7781';
    ctx.beginPath();
    ctx.moveTo(left, Math.max(top, southEdge.y));
    for (let px = left; px <= left + MAP.size; px += 8) {
      const worldX = game.player.x + (px - southEdge.centreX) / scale;
      const point = mapPoint(game, worldX, waterEdge(worldX));
      ctx.lineTo(px, point.y);
    }
    ctx.lineTo(left + MAP.size, top + MAP.size);
    ctx.lineTo(left, top + MAP.size);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(186, 172, 146, 0.5)';
  for (const block of city.blocks) {
    const a = mapPoint(game, block.x, block.y);
    if (a.x > left + MAP.size || a.y > top + MAP.size || a.x + block.w * scale < left || a.y + block.h * scale < top) continue;
    ctx.fillRect(a.x, a.y, block.w * scale, block.h * scale);
  }
  ctx.strokeStyle = 'rgba(42, 38, 32, 0.85)';
  for (const avenue of city.avenues) {
    const a = mapPoint(game, avenue.x, 0);
    ctx.lineWidth = avenue.arterial ? 3.4 : 2;
    ctx.beginPath();
    ctx.moveTo(a.x, top);
    ctx.lineTo(a.x, top + MAP.size);
    ctx.stroke();
  }
  for (const street of city.streets) {
    const a = mapPoint(game, 0, street.y);
    ctx.lineWidth = street.arterial ? 3.4 : 2;
    ctx.beginPath();
    ctx.moveTo(left, a.y);
    ctx.lineTo(left + MAP.size, a.y);
    ctx.stroke();
  }
  ctx.font = `700 8px ${FONT}`;
  ctx.textAlign = 'center';
  for (const sign of city.signs) {
    const point = mapPoint(game, sign.x, sign.y);
    if (point.x < left || point.x > left + MAP.size || point.y < top || point.y > top + MAP.size) continue;
    ctx.fillStyle = 'rgba(255, 246, 224, 0.78)';
    ctx.fillText(sign.text.toUpperCase(), point.x, point.y);
  }
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const point = mapPoint(game, pickup.x, pickup.y);
    ctx.fillStyle = pickup.type === 'cash' ? '#6fc08a' : pickup.type === 'health' ? '#e8625c'
      : pickup.type === 'armour' ? '#8fb6e4' : '#e3cf8e';
    ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
  }
  for (const npc of game.npcs) {
    const point = mapPoint(game, npc.x, npc.y);
    ctx.fillStyle = '#ff9fc4';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const vehicle of game.vehicles) {
    const point = mapPoint(game, vehicle.x, vehicle.y);
    if (point.x < left || point.x > left + MAP.size || point.y < top || point.y > top + MAP.size) continue;
    if (vehicle.role === 'police') {
      ctx.fillStyle = Math.sin(vehicle.lightPhase) > 0 ? '#5a8cff' : '#ff5a4a';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (vehicle.missionTag) {
      ctx.fillStyle = '#ffd36a';
      ctx.fillRect(point.x - 2.6, point.y - 2.6, 5.2, 5.2);
    } else if (vehicle.driver === 'traffic') {
      ctx.fillStyle = 'rgba(236, 228, 210, 0.7)';
      ctx.fillRect(point.x - 1.4, point.y - 1.4, 2.8, 2.8);
    }
  }
  // Officers on foot, then the air unit's search circle.
  for (const cop of game.cops) {
    if (cop.health <= 0) continue;
    const point = mapPoint(game, cop.x, cop.y);
    ctx.fillStyle = '#9fc0ff';
    ctx.fillRect(point.x - 1.8, point.y - 1.8, 3.6, 3.6);
  }
  if (game.air) {
    const point = mapPoint(game, game.air.x, game.air.y);
    ctx.strokeStyle = 'rgba(255, 224, 138, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6 + Math.sin(game.time * 5) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
  }
  const waypoint = missionWaypoint(game);
  if (waypoint) {
    const point = mapPoint(game, waypoint.x, waypoint.y);
    const dx = point.x - point.centreX;
    const dy = point.y - point.centreY;
    const limit = MAP.size / 2 - 10;
    const distance = Math.hypot(dx, dy);
    const clampedX = distance > limit ? point.centreX + (dx / distance) * limit : point.x;
    const clampedY = distance > limit ? point.centreY + (dy / distance) * limit : point.y;
    ctx.fillStyle = '#ffd36a';
    ctx.beginPath();
    ctx.moveTo(clampedX, clampedY - 7);
    ctx.lineTo(clampedX + 6, clampedY);
    ctx.lineTo(clampedX, clampedY + 7);
    ctx.lineTo(clampedX - 6, clampedY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 36, 8, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  const centreX = left + MAP.size / 2;
  const centreY = top + MAP.size / 2;
  ctx.save();
  ctx.translate(centreX, centreY);
  ctx.rotate(game.player.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6.4, 7);
  ctx.lineTo(0, 3.6);
  ctx.lineTo(-6.4, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 24, 28, 0.9)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 232, 194, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, MAP.size, MAP.size, 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(12, 14, 16, 0.85)';
  roundRect(ctx, centreX - 13, top - 9, 26, 18, 5);
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', centreX, top + 5);
  ctx.fillStyle = 'rgba(12, 14, 16, 0.82)';
  roundRect(ctx, left, top + MAP.size - 20, MAP.size, 20, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(248, 238, 220, 0.9)';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText(game.player.district.toUpperCase(), centreX, top + MAP.size - 6);
  ctx.restore();
}

/** The hold-to-steal prompt, with the bar that fills while F is held. */
function drawPrompt(ctx, game) {
  const prompt = game.prompt;
  if (!prompt) return;
  ctx.save();
  const text = prompt.text;
  ctx.font = `700 18px ${FONT}`;
  const width = Math.max(260, ctx.measureText(text).width + 56);
  const x = VIEW.width / 2 - width / 2;
  const y = VIEW.height - 182;
  ctx.fillStyle = 'rgba(14, 16, 20, 0.78)';
  roundRect(ctx, x, y, width, prompt.progress > 0 ? 62 : 46, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 214, 120, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f8efdf';
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW.width / 2, y + 30);
  if (prompt.progress > 0) {
    const barX = x + 20;
    const barW = width - 40;
    meter(ctx, barX, y + 42, barW, 9, Math.min(1, prompt.progress), '#ffb63a', '#ffe7a0');
  }
  ctx.restore();
}

/** A vector portrait of whoever is talking, drawn from the speaker's own palette. */
const FACES = {
  'MAE CALDER': { skin: '#c58a5d', hair: '#2c2026', shirt: '#c75d86', accent: '#7fe3d2' },
  RILEY: { skin: '#e8bd94', hair: '#3b2a1e', shirt: '#ef9b3a', accent: '#ffd48a' },
  COURIER: { skin: '#a9703f', hair: '#1f1b1a', shirt: '#5fa177', accent: '#9fe0b4' },
  BUYER: { skin: '#f0c8a0', hair: '#5b4a3a', shirt: '#5a6a86', accent: '#9fb6e4' },
  DISPATCH: { skin: '#d9a271', hair: '#2a2a2e', shirt: '#3d5a8a', accent: '#8fb6e4' },
};

/** Head, shoulders and a shadow, inside the dialogue plate's square. */
function portrait(ctx, who, x, y, size) {
  const face = FACES[who] ?? FACES.RILEY;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, size, size, 6);
  ctx.clip();
  const back = ctx.createLinearGradient(x, y, x, y + size);
  back.addColorStop(0, 'rgba(46, 38, 46, 0.95)');
  back.addColorStop(1, 'rgba(22, 20, 26, 0.95)');
  ctx.fillStyle = back;
  ctx.fillRect(x, y, size, size);
  const cx = x + size / 2;
  // Shoulders.
  ctx.fillStyle = face.shirt;
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 1.08, size * 0.46, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = face.skin;
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 0.47, size * 0.26, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair, swept to the sunward side.
  ctx.fillStyle = face.hair;
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 0.33, size * 0.28, size * 0.19, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - size * 0.28, y + size * 0.3, size * 0.09, size * 0.26);
  // Eyes and a mouth line, enough to read as a face at this size.
  ctx.fillStyle = 'rgba(26, 22, 24, 0.85)';
  ctx.fillRect(cx - size * 0.14, y + size * 0.45, size * 0.07, size * 0.04);
  ctx.fillRect(cx + size * 0.07, y + size * 0.45, size * 0.07, size * 0.04);
  ctx.fillStyle = 'rgba(120, 60, 54, 0.7)';
  ctx.fillRect(cx - size * 0.06, y + size * 0.58, size * 0.12, size * 0.03);
  ctx.restore();
  ctx.strokeStyle = face.accent;
  ctx.lineWidth = 1.4;
  roundRect(ctx, x, y, size, size, 6);
  ctx.stroke();
}

/** Mae and the rest of the cast, in a plate with their portrait beside it. */
function drawDialog(ctx, game) {
  const dialog = game.dialog;
  if (!dialog) return;
  ctx.save();
  ctx.font = `600 16px ${FONT}`;
  const height = 72;
  const width = Math.min(720, Math.max(380, ctx.measureText(dialog.text).width + 132));
  const x = VIEW.width / 2 - width / 2;
  const y = VIEW.height - 268;
  ctx.fillStyle = 'rgba(14, 16, 20, 0.82)';
  roundRect(ctx, x, y, width, height, 7);
  ctx.fill();
  const face = FACES[dialog.who] ?? FACES.RILEY;
  ctx.fillStyle = face.accent;
  roundRect(ctx, x, y, width, 2.5, 1.5);
  ctx.fill();
  portrait(ctx, dialog.who, x + 10, y + 10, 52);
  ctx.textAlign = 'left';
  ctx.font = `800 12px ${FONT}`;
  ctx.fillStyle = face.accent;
  ctx.fillText(dialog.who, x + 76, y + 28);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = '#f4ecdd';
  ctx.fillText(dialog.text, x + 76, y + 52);
  ctx.restore();
}

/** Short notices stacked above the weapon rack. */
function drawToasts(ctx, game) {
  ctx.save();
  ctx.textAlign = 'right';
  for (let index = 0; index < game.toasts.length; index += 1) {
    const toast = game.toasts[index];
    const y = VIEW.height - 108 - index * 28;
    const alpha = Math.min(1, toast.life / 0.8);
    ctx.font = `700 15px ${FONT}`;
    const width = ctx.measureText(toast.text).width + 28;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(14, 16, 20, 0.7)';
    roundRect(ctx, VIEW.width - 20 - width, y - 18, width, 24, 5);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(toast.text, VIEW.width - 34, y - 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** BUSTED, WASTED and mission cards, centred. */
function drawOverlay(ctx, game) {
  const card = game.overlay ?? (game.missions.cardTimer > 0 ? { ...game.missions.card, life: game.missions.cardTimer } : null);
  if (!card || !card.title) return;
  ctx.save();
  ctx.textAlign = 'center';
  const alpha = Math.min(1, card.life / 0.6);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10, 10, 12, 0.55)';
  ctx.fillRect(0, VIEW.height / 2 - 92, VIEW.width, 184);
  ctx.fillStyle = 'rgba(255, 206, 110, 0.9)';
  ctx.fillRect(0, VIEW.height / 2 - 92, VIEW.width, 3);
  ctx.fillRect(0, VIEW.height / 2 + 89, VIEW.width, 3);
  ctx.font = `900 54px ${FONT}`;
  ctx.fillStyle = '#ffe3ab';
  ctx.fillText(card.title.toUpperCase(), VIEW.width / 2, VIEW.height / 2 + 4);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 238, 222, 0.9)';
  const lines = card.lines ?? [];
  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], VIEW.width / 2, VIEW.height / 2 + 40 + index * 24);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Used by the title screen to show the wanted scale in the controls block. */
export const WANTED_MAX = WANTED.thresholds.length - 1;
/** The world size, handy for the title screen's painted map. */
export const MAP_WORLD = WORLD;
