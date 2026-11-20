// The heads-up display: health, money, wanted stars, the held weapon, the mission banner, the
// hold-to-steal prompt, Mae's dialogue, toasts and the north-up minimap with its blips. Drawn in
// screen pixels over the finished world, and sized to stay legible in a screenshot.
import { PLAYER, WANTED, VIEW, WEAPONS, WORLD } from './config.js';
import { waterEdge } from './city.js';
import { currentMission, missionWaypoint, objectiveText } from './missions.js';
import { roundRect } from './draw.js';

/** The weapon name and round count under the HUD's weapon panel. */
function weaponLabel(player) {
  const weapon = WEAPONS[player.weapon];
  if (!weapon) return 'Fists';
  return weapon.melee ? weapon.name : `${weapon.name}  ${player.arsenal[player.weapon] ?? 0}`;
}

const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MAP = { size: 212, pad: 22, span: 1750 };
const PANEL = 'rgba(18, 20, 24, 0.62)';

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

/** Everything on top of the world for one frame. */
export function drawHud(ctx, game) {
  drawVitals(ctx, game);
  drawWantedStars(ctx, game);
  drawObjective(ctx, game);
  drawWeapon(ctx, game);
  drawMinimap(ctx, game);
  drawPrompt(ctx, game);
  drawDialog(ctx, game);
  drawToasts(ctx, game);
  drawOverlay(ctx, game);
}

/** Health and cash, top left. */
function drawVitals(ctx, game) {
  const player = game.player;
  ctx.save();
  ctx.fillStyle = PANEL;
  roundRect(ctx, 20, 18, 286, 76, 10);
  ctx.fill();
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.72)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('RILEY VOSS', 34, 38);
  // Health bar.
  const barX = 34;
  const barY = 46;
  const barW = 180;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  roundRect(ctx, barX, barY, barW, 12, 6);
  ctx.fill();
  const fraction = Math.max(0, player.health / PLAYER.health);
  const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  gradient.addColorStop(0, fraction > 0.35 ? '#5fd39a' : '#e4594f');
  gradient.addColorStop(1, fraction > 0.35 ? '#9fe8a8' : '#f08b6a');
  ctx.fillStyle = gradient;
  roundRect(ctx, barX, barY, Math.max(3, barW * fraction), 12, 6);
  ctx.fill();
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = 'rgba(16, 18, 20, 0.8)';
  ctx.fillText(`${Math.ceil(player.health)}`, barX + 8, barY + 10);
  // Cash.
  ctx.textAlign = 'right';
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(money(player.money), 292, 56);
  ctx.textAlign = 'left';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(240, 228, 206, 0.6)';
  ctx.fillText(player.district.toUpperCase(), 34, 80);
  if (player.carrying) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(`CARRYING: ${player.carrying.toUpperCase()}`, 292, 80);
  }
  ctx.restore();
}

/** Wanted level, top right: five stars, lit to the current level. */
function drawWantedStars(ctx, game) {
  const wanted = game.wanted;
  ctx.save();
  const width = 206;
  const x = VIEW.width - width - 20;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x, 18, width, 62, 10);
  ctx.fill();
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.7)';
  ctx.textAlign = 'left';
  ctx.fillText('WANTED', x + 14, 36);
  if (wanted.stars > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = wanted.seen ? '#ff8c6a' : 'rgba(246, 232, 206, 0.55)';
    ctx.fillText(wanted.seen ? 'SPOTTED' : 'COOLING', x + width - 14, 36);
  }
  const pulse = wanted.flash > 0 ? 1 + Math.sin(game.time * 24) * 0.14 : 1;
  for (let index = 0; index < 5; index += 1) {
    const cx = x + 28 + index * 38;
    const cy = 60;
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

/** The mission banner: number, title and the current objective. */
function drawObjective(ctx, game) {
  const mission = currentMission(game);
  const text = objectiveText(game);
  const title = mission ? `MISSION ${mission.number} · ${mission.title.toUpperCase()}` : 'FREE ROAM · PORT SABLE';
  ctx.save();
  ctx.textAlign = 'center';
  const width = Math.max(360, ctx.measureText(text).width + 120, text.length * 9.6 + 60);
  const x = VIEW.width / 2 - width / 2;
  const grow = game.missions.banner > 0 ? Math.min(1, game.missions.banner / 0.4) : 0;
  ctx.fillStyle = 'rgba(16, 18, 22, 0.66)';
  roundRect(ctx, x, 18, width, 62, 10);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 206, 110, ${0.5 + grow * 0.5})`;
  roundRect(ctx, x, 18, width, 3, 2);
  ctx.fill();
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(title, VIEW.width / 2, 42);
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = '#f6efe2';
  ctx.fillText(text, VIEW.width / 2, 68);
  ctx.restore();
}

/** Held weapon and ammunition, bottom right. */
function drawWeapon(ctx, game) {
  ctx.save();
  const width = 232;
  const x = VIEW.width - width - 20;
  const y = VIEW.height - 76;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x, y, width, 56, 10);
  ctx.fill();
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(246, 232, 206, 0.62)';
  ctx.textAlign = 'left';
  ctx.fillText('WEAPON  (Q TO SWITCH)', x + 14, y + 20);
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = '#f6efe2';
  ctx.fillText(weaponLabel(game.player), x + 14, y + 44);
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
  // Dial.
  ctx.fillStyle = 'rgba(10, 12, 14, 0.8)';
  roundRect(ctx, left - 4, top - 4, MAP.size + 8, MAP.size + 8, 14);
  ctx.fill();
  roundRect(ctx, left, top, MAP.size, MAP.size, 11);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#6b6255';
  ctx.fillRect(left, top, MAP.size, MAP.size);
  // Water.
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
  // Blocks, faintly, so districts read as city rather than empty ground.
  ctx.fillStyle = 'rgba(186, 172, 146, 0.5)';
  for (const block of city.blocks) {
    const a = mapPoint(game, block.x, block.y);
    if (a.x > left + MAP.size || a.y > top + MAP.size || a.x + block.w * scale < left || a.y + block.h * scale < top) continue;
    ctx.fillRect(a.x, a.y, block.w * scale, block.h * scale);
  }
  // Roads.
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
  // District labels.
  ctx.font = `700 8px ${FONT}`;
  ctx.textAlign = 'center';
  for (const sign of city.signs) {
    const point = mapPoint(game, sign.x, sign.y);
    if (point.x < left || point.x > left + MAP.size || point.y < top || point.y > top + MAP.size) continue;
    ctx.fillStyle = 'rgba(255, 246, 224, 0.78)';
    ctx.fillText(sign.text.toUpperCase(), point.x, point.y);
  }
  // Pickups.
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const point = mapPoint(game, pickup.x, pickup.y);
    ctx.fillStyle = pickup.type === 'cash' ? '#6fc08a' : pickup.type === 'health' ? '#e8625c' : '#e3cf8e';
    ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
  }
  // Mae.
  for (const npc of game.npcs) {
    const point = mapPoint(game, npc.x, npc.y);
    ctx.fillStyle = '#ff9fc4';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Traffic, then the police, which flash.
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
  // The mission waypoint, clamped to the rim when it is off the dial.
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
  // Riley, always at the middle, pointing where he is headed.
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
  // Rim, north mark and the district name.
  ctx.strokeStyle = 'rgba(255, 232, 194, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, MAP.size, MAP.size, 11);
  ctx.stroke();
  ctx.fillStyle = 'rgba(12, 14, 16, 0.85)';
  roundRect(ctx, centreX - 13, top - 9, 26, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', centreX, top + 5);
  ctx.fillStyle = 'rgba(12, 14, 16, 0.8)';
  roundRect(ctx, left, top + MAP.size - 20, MAP.size, 20, 6);
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
  const y = VIEW.height - 168;
  ctx.fillStyle = 'rgba(14, 16, 20, 0.76)';
  roundRect(ctx, x, y, width, prompt.progress > 0 ? 62 : 46, 10);
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    roundRect(ctx, barX, y + 42, barW, 9, 5);
    ctx.fill();
    ctx.fillStyle = '#ffd04a';
    roundRect(ctx, barX, y + 42, Math.max(4, barW * Math.min(1, prompt.progress)), 9, 5);
    ctx.fill();
  }
  ctx.restore();
}

/** Mae and the rest of the cast, in a subtitle plate. */
function drawDialog(ctx, game) {
  const dialog = game.dialog;
  if (!dialog) return;
  ctx.save();
  ctx.font = `600 16px ${FONT}`;
  const width = Math.min(700, Math.max(320, ctx.measureText(dialog.text).width + 60));
  const x = VIEW.width / 2 - width / 2;
  const y = VIEW.height - 248;
  ctx.fillStyle = 'rgba(14, 16, 20, 0.78)';
  roundRect(ctx, x, y, width, 60, 10);
  ctx.fill();
  ctx.fillStyle = '#7fe3d2';
  roundRect(ctx, x, y, 4, 60, 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `800 12px ${FONT}`;
  ctx.fillStyle = '#7fe3d2';
  ctx.fillText(dialog.who, x + 18, y + 22);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = '#f4ecdd';
  ctx.fillText(dialog.text, x + 18, y + 45);
  ctx.restore();
}

/** Short notices stacked above the weapon panel. */
function drawToasts(ctx, game) {
  ctx.save();
  ctx.textAlign = 'right';
  for (let index = 0; index < game.toasts.length; index += 1) {
    const toast = game.toasts[index];
    const y = VIEW.height - 96 - index * 28;
    const alpha = Math.min(1, toast.life / 0.8);
    ctx.font = `700 15px ${FONT}`;
    const width = ctx.measureText(toast.text).width + 28;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(14, 16, 20, 0.66)';
    roundRect(ctx, VIEW.width - 20 - width, y - 18, width, 24, 6);
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
