// The front of the game: the painted title card (the cover), the pause menu with its save slots,
// and the controls block. The skyline is generated from the seed, so the title always paints the
// same waterfront for the same ?seed=.
import { VIEW } from './config.js';
import { createRandom, range, rangeInt } from './rng.js';
import { roundRect } from './draw.js';

const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The menu, in order. */
export const PAUSE_ITEMS = ['Continue', 'Save game', 'Load game', 'Quit to title'];

/** The controls, as shown on the title card and in the pause menu. */
export const CONTROLS = [
  ['W A S D / ARROWS', 'walk · drive'],
  ['SHIFT', 'run · handbrake'],
  ['F', 'enter car · hold to steal'],
  ['SPACE / CLICK', 'punch · fire'],
  ['MOUSE', 'aim'],
  ['Q', 'switch weapon'],
  ['ESC', 'pause · save'],
];

/** Draw a word letter by letter so the title has real letter-spacing at any size. */
function spacedText(ctx, text, x, y, spacing) {
  let total = 0;
  for (const character of text) total += ctx.measureText(character).width + spacing;
  total -= spacing;
  let cursor = x - total / 2;
  for (const character of text) {
    const width = ctx.measureText(character).width;
    ctx.fillText(character, cursor + width / 2, y);
    cursor += width + spacing;
  }
  return total;
}

/** Same, but stroked, for the title's dark outline. */
function spacedStroke(ctx, text, x, y, spacing) {
  let total = 0;
  for (const character of text) total += ctx.measureText(character).width + spacing;
  total -= spacing;
  let cursor = x - total / 2;
  for (const character of text) {
    const width = ctx.measureText(character).width;
    ctx.strokeText(character, cursor + width / 2, y);
    cursor += width + spacing;
  }
}

/** Build the cover's skyline, palms and boats once, from the seed. */
export function createTitleArt(seed) {
  const random = createRandom(seed + 7717);
  const far = [];
  for (let x = -40; x < VIEW.width + 60; ) {
    const width = rangeInt(random, 34, 96);
    far.push({ x, w: width, h: range(random, 44, 132), tower: random() < 0.3 });
    x += width + rangeInt(random, 4, 18);
  }
  const near = [];
  for (let x = -60; x < VIEW.width + 80; ) {
    const width = rangeInt(random, 54, 134);
    near.push({
      x, w: width, h: range(random, 62, 186),
      windows: rangeInt(random, 2, 5),
      floors: rangeInt(random, 3, 9),
      lit: random(),
    });
    x += width + rangeInt(random, 10, 34);
  }
  // The harbour mouth: a gap in both skylines, so the setting sun has clear sky to sit in.
  const gap = { x: VIEW.width * 0.26 - 128, w: 256 };
  const clears = (slab) => slab.x + slab.w < gap.x || slab.x > gap.x + gap.w;
  for (const slab of far) if (!clears(slab)) slab.h = Math.min(slab.h, 34);
  const nearOpen = near.filter(clears);
  near.length = 0;
  for (const slab of nearOpen) near.push(slab);
  const palms = [
    { x: 118, y: 690, scale: 1.5, lean: -0.2 },
    { x: 1178, y: 706, scale: 1.75, lean: 0.24 },
    { x: 1052, y: 664, scale: 1.05, lean: 0.1 },
  ];
  const boats = [];
  for (let index = 0; index < 4; index += 1) {
    boats.push({ x: range(random, 120, VIEW.width - 120), y: range(random, 452, 520), scale: range(random, 0.5, 1.05) });
  }
  return { far, near, palms, boats, gap, glints: Array.from({ length: 46 }, () => ({ x: range(random, 0, VIEW.width), y: range(random, 440, 600), w: range(random, 10, 70) })) };
}

/** A palm in silhouette, for the foreground of the cover. */
function titlePalm(ctx, palm, colour) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 9 * palm.scale;
  ctx.lineCap = 'round';
  const topX = palm.x + palm.lean * 150 * palm.scale;
  const topY = palm.y - 240 * palm.scale;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.quadraticCurveTo(palm.x + palm.lean * 40 * palm.scale, palm.y - 140 * palm.scale, topX, topY);
  ctx.stroke();
  for (let frond = 0; frond < 9; frond += 1) {
    const angle = Math.PI + (frond / 8) * Math.PI;
    const length = 96 * palm.scale;
    ctx.lineWidth = 7 * palm.scale;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(angle) * length * 0.6,
      topY + Math.sin(angle) * length * 0.6 - 26 * palm.scale,
      topX + Math.cos(angle) * length,
      topY + Math.sin(angle) * length + 34 * palm.scale,
    );
    ctx.stroke();
  }
}

/** A side-on coupe in silhouette, parked in the cover's foreground. */
function titleCar(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(9, 11, 15, 0.98)';
  roundRect(ctx, -92, -26, 184, 30, 11);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-50, -24);
  ctx.quadraticCurveTo(-30, -56, 6, -57);
  ctx.quadraticCurveTo(44, -56, 56, -24);
  ctx.closePath();
  ctx.fill();
  for (const wheelX of [-54, 54]) {
    ctx.beginPath();
    ctx.arc(wheelX, 4, 19, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tail-light, the one warm spot in the silhouette.
  ctx.fillStyle = 'rgba(226, 86, 62, 0.92)';
  ctx.fillRect(-94, -19, 8, 7);
  ctx.restore();
}

/**
 * The title card: sunset sky, two layers of skyline, the gulf, a pier, palms, the name PORT SABLE
 * and the controls. `state` carries the art, whether a save exists and a clock for the pulse.
 */
export function drawTitle(ctx, state) {
  const { art, time } = state;
  const horizon = 430;
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 60);
  sky.addColorStop(0, '#3c2b52');
  sky.addColorStop(0.32, '#b4577a');
  sky.addColorStop(0.62, '#ef9158');
  sky.addColorStop(1, '#f8c976');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, horizon + 60);
  // Cloud streaks.
  for (let index = 0; index < 9; index += 1) {
    const y = 60 + index * 34;
    ctx.fillStyle = `rgba(${index % 2 ? 255 : 240}, ${150 + index * 6}, ${120 + index * 4}, ${0.1 + (index % 3) * 0.05})`;
    roundRect(ctx, 90 + ((index * 173) % 700), y, 300 + (index % 4) * 180, 12 + (index % 3) * 5, 8);
    ctx.fill();
  }
  // The sun sits low, so the skyline in front of it reads as a silhouette.
  const sunX = VIEW.width * 0.26;
  const sunY = horizon - 36;
  const halo = ctx.createRadialGradient(sunX, sunY, 14, sunX, sunY, 340);
  halo.addColorStop(0, 'rgba(255, 240, 192, 0.95)');
  halo.addColorStop(0.28, 'rgba(255, 196, 126, 0.45)');
  halo.addColorStop(1, 'rgba(255, 170, 110, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, VIEW.width, horizon + 60);
  ctx.fillStyle = '#fff3cd';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 64, 0, Math.PI * 2);
  ctx.fill();
  // A scrim behind the title block, so the type holds against a busy sky.
  const scrim = ctx.createLinearGradient(0, 108, 0, 392);
  scrim.addColorStop(0, 'rgba(24, 10, 24, 0)');
  scrim.addColorStop(0.45, 'rgba(24, 10, 24, 0.5)');
  scrim.addColorStop(1, 'rgba(24, 10, 24, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 108, VIEW.width, 284);
  // Far skyline.
  ctx.fillStyle = 'rgba(70, 52, 78, 0.78)';
  for (const slab of art.far) {
    ctx.fillRect(slab.x, horizon - slab.h, slab.w, slab.h + 10);
    if (slab.tower) ctx.fillRect(slab.x + slab.w / 2 - 4, horizon - slab.h - 26, 8, 26);
  }
  // Near skyline, with windows catching the last of the sun.
  for (const slab of art.near) {
    ctx.fillStyle = '#3b2a3f';
    ctx.fillRect(slab.x, horizon - slab.h, slab.w, slab.h + 14);
    ctx.fillStyle = 'rgba(255, 198, 128, 0.16)';
    ctx.fillRect(slab.x, horizon - slab.h, 5, slab.h);
    for (let floor = 0; floor < slab.floors; floor += 1) {
      for (let column = 0; column < slab.windows; column += 1) {
        if (((floor * 5 + column * 3 + Math.floor(slab.lit * 53)) % 7) > 2) continue;
        ctx.fillStyle = 'rgba(255, 216, 150, 0.82)';
        ctx.fillRect(
          slab.x + 10 + column * ((slab.w - 20) / slab.windows),
          horizon - slab.h + 14 + floor * (slab.h / (slab.floors + 1)),
          Math.max(3, (slab.w - 20) / slab.windows - 7),
          6,
        );
      }
    }
  }
  // The gulf.
  const water = ctx.createLinearGradient(0, horizon, 0, VIEW.height);
  water.addColorStop(0, '#2f8a90');
  water.addColorStop(0.45, '#1f7781');
  water.addColorStop(1, '#10414c');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon + 4, VIEW.width, VIEW.height - horizon);
  // Sun's road and glitter.
  // Three stacked wedges instead of one, so the sun's road has a soft edge.
  for (const [spread, alpha] of [[360, 0.16], [230, 0.2], [120, 0.26]]) {
    const road = ctx.createLinearGradient(sunX, horizon, sunX, VIEW.height);
    road.addColorStop(0, `rgba(255, 230, 170, ${alpha + 0.2})`);
    road.addColorStop(1, `rgba(255, 190, 120, 0)`);
    ctx.fillStyle = road;
    ctx.beginPath();
    ctx.moveTo(sunX - spread * 0.14, horizon + 4);
    ctx.lineTo(sunX + spread * 0.14, horizon + 4);
    ctx.lineTo(sunX + spread, VIEW.height);
    ctx.lineTo(sunX - spread, VIEW.height);
    ctx.closePath();
    ctx.fill();
  }
  for (const glint of art.glints) {
    const sway = Math.sin(time * 1.6 + glint.x * 0.01) * 7;
    ctx.fillStyle = `rgba(255, 238, 198, ${0.1 + ((glint.w % 7) / 24)})`;
    ctx.fillRect(glint.x + sway, glint.y, glint.w, 2.4);
  }
  for (const boat of art.boats) {
    ctx.fillStyle = 'rgba(16, 36, 42, 0.75)';
    ctx.beginPath();
    ctx.ellipse(boat.x, boat.y, 26 * boat.scale, 6 * boat.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(boat.x - 3 * boat.scale, boat.y - 24 * boat.scale, 2.5 * boat.scale, 24 * boat.scale);
  }
  // A pier running out over the water, and the dark shore the camera stands on.
  ctx.fillStyle = 'rgba(20, 22, 28, 0.92)';
  ctx.fillRect(700, 496, 560, 15);
  for (let post = 0; post < 11; post += 1) ctx.fillRect(716 + post * 50, 508, 9, 38);
  ctx.fillStyle = 'rgba(12, 14, 18, 0.96)';
  ctx.beginPath();
  ctx.moveTo(0, VIEW.height);
  ctx.lineTo(0, 662);
  ctx.quadraticCurveTo(VIEW.width * 0.5, 644, VIEW.width, 672);
  ctx.lineTo(VIEW.width, VIEW.height);
  ctx.closePath();
  ctx.fill();
  // Palms, and a coupe parked on the shore, all in silhouette.
  for (const palm of art.palms) titlePalm(ctx, palm, 'rgba(10, 13, 17, 0.97)');
  titleCar(ctx, 1016, 672, 1.06);

  // The name.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 112px ${FONT}`;
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(30, 14, 26, 0.85)';
  ctx.shadowColor = 'rgba(40, 10, 24, 0.6)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 8;
  spacedStroke(ctx, 'PORT SABLE', VIEW.width / 2, 258, 7);
  const letters = ctx.createLinearGradient(0, 160, 0, 266);
  letters.addColorStop(0, '#fff4d2');
  letters.addColorStop(0.5, '#ffd072');
  letters.addColorStop(1, '#f2804f');
  ctx.fillStyle = letters;
  spacedText(ctx, 'PORT SABLE', VIEW.width / 2, 258, 7);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = 'rgba(255, 238, 206, 0.95)';
  spacedText(ctx, 'A SUN-BLEACHED GULF-COAST CRIME STORY', VIEW.width / 2, 296, 4.4);
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = 'rgba(252, 232, 206, 0.86)';
  ctx.fillText('Riley Voss drives for Mae Calder to clear a debt he cannot pay.', VIEW.width / 2, 332);
  ctx.fillText('Five districts. Any car on the street. Five stars of trouble.', VIEW.width / 2, 356);

  // Start line.
  const pulse = 0.62 + 0.38 * Math.sin(time * 3.4);
  ctx.fillStyle = `rgba(20, 22, 28, ${0.5 + pulse * 0.2})`;
  roundRect(ctx, VIEW.width / 2 - 196, 416, 392, 54, 12);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 214, 120, ${0.4 + pulse * 0.5})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 238, 198, ${0.75 + pulse * 0.25})`;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText('PRESS ENTER TO START', VIEW.width / 2, 452);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = 'rgba(248, 230, 200, 0.8)';
  ctx.fillText(state.hasSave ? 'or press L to continue your saved run' : 'or click anywhere to start', VIEW.width / 2, 492);

  // Controls.
  ctx.fillStyle = 'rgba(10, 12, 16, 0.62)';
  roundRect(ctx, 150, 516, VIEW.width - 300, 100, 12);
  ctx.fill();
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'left';
  for (let index = 0; index < CONTROLS.length; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 176 + column * 236;
    const y = 544 + row * 36;
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(CONTROLS[index][0], x, y);
    ctx.fillStyle = 'rgba(240, 232, 216, 0.8)';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(CONTROLS[index][1], x, y + 16);
    ctx.font = `700 12px ${FONT}`;
  }
  ctx.textAlign = 'left';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(236, 222, 202, 0.6)';
  ctx.fillText('An original game — every street, car, face and sound in it was written for this city. No trademarks, no borrowed assets.', 24, 698);
  ctx.fillText('Canvas 2D · seeded world · offline · press ESC in game to pause and save', 24, 713);
}

/** The pause menu over a dimmed, frozen world. */
export function drawPause(ctx, game, selected, saveNote) {
  ctx.fillStyle = 'rgba(8, 9, 12, 0.66)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const panelW = 520;
  const panelH = 420;
  const x = VIEW.width / 2 - panelW / 2;
  const y = VIEW.height / 2 - panelH / 2;
  ctx.fillStyle = 'rgba(16, 18, 24, 0.94)';
  roundRect(ctx, x, y, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 206, 110, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `900 40px ${FONT}`;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('PAUSED', VIEW.width / 2, y + 60);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = 'rgba(240, 230, 212, 0.7)';
  ctx.fillText('PORT SABLE — Riley Voss', VIEW.width / 2, y + 84);

  for (let index = 0; index < PAUSE_ITEMS.length; index += 1) {
    const itemY = y + 118 + index * 48;
    const active = index === selected;
    if (active) {
      ctx.fillStyle = 'rgba(255, 206, 110, 0.16)';
      roundRect(ctx, x + 40, itemY - 24, panelW - 80, 38, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 206, 110, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.font = `${active ? 800 : 600} 20px ${FONT}`;
    ctx.fillStyle = active ? '#ffe3ab' : 'rgba(238, 230, 216, 0.72)';
    ctx.fillText(PAUSE_ITEMS[index], VIEW.width / 2, itemY);
  }
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = 'rgba(236, 226, 206, 0.6)';
  ctx.fillText('W/S or arrows to choose · ENTER to pick · ESC to go back', VIEW.width / 2, y + 330);
  if (saveNote) {
    ctx.fillStyle = '#7fe3d2';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(saveNote, VIEW.width / 2, y + 356);
  }
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = 'rgba(240, 230, 212, 0.8)';
  const mission = game.missions.done ? 'Story complete' : `Mission ${game.missions.index + 1} of 4`;
  ctx.fillText(`${mission}  ·  $${Math.round(game.player.money)}  ·  wanted ${game.wanted.stars}/5`, VIEW.width / 2, y + 388);
}
