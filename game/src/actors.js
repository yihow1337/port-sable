// Drawing everything that moves: cars (with their liveries, lights and sirens), Riley, the crowd,
// the police, pickups, the mission waypoint, tracer fire and particles, then the golden-hour grade
// laid over the lot. Shapes only — no state is touched here.
import { worldToScreen } from './camera.js';
import { LIGHT, VIEW } from './config.js';
import { lift, roundRect, shade } from './draw.js';

/**
 * Cars and people are only a few pixels tall, so stacking them with the buildings' parallax would
 * pull a head clean off its shoulders near the edge of the screen. They lean outward by a fixed
 * amount instead: enough to read as solid, never enough to come apart.
 */
function outward(camera, x, y) {
  const base = worldToScreen(camera, x, y);
  const dx = base.x - VIEW.width / 2;
  const dy = base.y - VIEW.height / 2;
  const length = Math.hypot(dx, dy) || 1;
  return { base, ux: dx / length, uy: dy / length };
}

/** A point `height` "up" from an actor's feet, in the fixed outward sense. */
function stack(camera, x, y, height) {
  const { base, ux, uy } = outward(camera, x, y);
  const rise = height * 0.3 * camera.zoom;
  return { x: base.x + ux * rise, y: base.y + uy * rise };
}

/** A soft blob of shade under an actor, offset away from the sun. */
function groundShadow(ctx, camera, x, y, radiusX, radiusY, angle) {
  const point = worldToScreen(camera, x - LIGHT.sun.x * 9, y - LIGHT.sun.y * 9);
  ctx.fillStyle = 'rgba(38, 28, 22, 0.32)';
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radiusX * camera.zoom, radiusY * camera.zoom, angle, 0, Math.PI * 2);
  ctx.fill();
}

/** Every car in view, nearest the screen centre last. */
export function drawVehicles(ctx, game, bounds) {
  const camera = game.camera;
  const list = game.vehicles.filter((vehicle) =>
    vehicle.x > bounds.x - 70 && vehicle.x < bounds.x + bounds.w + 70 && vehicle.y > bounds.y - 70 && vehicle.y < bounds.y + bounds.h + 70);
  list.sort((a, b) => a.y - b.y);
  for (const vehicle of list) drawVehicle(ctx, game, vehicle, vehicle === game.player.vehicle);
}

function drawVehicle(ctx, game, vehicle, isPlayer) {
  const camera = game.camera;
  const zoom = camera.zoom;
  const kind = vehicle.kind;
  const length = kind.length * zoom;
  const width = kind.width * zoom;
  groundShadow(ctx, camera, vehicle.x, vehicle.y, kind.length * 0.5, kind.width * 0.52, vehicle.angle);

  // The sill: the same body shape at ground level, so the roof above it reads as a solid car.
  const body = stack(camera, vehicle.x, vehicle.y, 13);
  const sill = worldToScreen(camera, vehicle.x, vehicle.y);
  for (const [point, colour, inset] of [[sill, shade(vehicle.color, 0.52), 0], [body, vehicle.color, 0]]) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(vehicle.angle);
    roundRect(ctx, -length / 2 + inset, -width / 2 + inset, length - inset * 2, width - inset * 2, Math.min(width * 0.34, 7 * zoom));
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(vehicle.angle);
  // Wheels peek out at ground level.
  ctx.fillStyle = '#20242a';
  for (const [wx, wy] of [[0.3, -0.56], [0.3, 0.56], [-0.32, -0.56], [-0.32, 0.56]]) {
    const steerAngle = wx > 0 ? vehicle.steer * 0.4 : 0;
    ctx.save();
    ctx.translate(length * wx, width * wy);
    ctx.rotate(steerAngle);
    ctx.fillRect(-length * 0.1, -width * 0.1, length * 0.2, width * 0.2);
    ctx.restore();
  }
  // Glass.
  ctx.fillStyle = 'rgba(86, 128, 140, 0.85)';
  roundRect(ctx, length * 0.06, -width * 0.38, length * 0.2, width * 0.76, 2 * zoom);
  ctx.fill();
  roundRect(ctx, -length * 0.3, -width * 0.38, length * 0.14, width * 0.76, 2 * zoom);
  ctx.fill();
  // Roof panel, lighter on the sunlit side.
  ctx.fillStyle = shade(kind.roof ?? vehicle.color, 1.08, 0.12);
  roundRect(ctx, -length * 0.16, -width * 0.42, length * 0.22, width * 0.84, 2.5 * zoom);
  ctx.fill();
  if (kind.bed) {
    ctx.fillStyle = shade(vehicle.color, 0.74);
    roundRect(ctx, -length * 0.46, -width * 0.42, length * 0.28, width * 0.84, 2 * zoom);
    ctx.fill();
  }
  // Lights.
  ctx.fillStyle = 'rgba(255, 242, 196, 0.95)';
  ctx.fillRect(length * 0.42, -width * 0.42, length * 0.06, width * 0.2);
  ctx.fillRect(length * 0.42, width * 0.22, length * 0.06, width * 0.2);
  ctx.fillStyle = 'rgba(206, 70, 52, 0.9)';
  ctx.fillRect(-length * 0.48, -width * 0.42, length * 0.05, width * 0.2);
  ctx.fillRect(-length * 0.48, width * 0.22, length * 0.05, width * 0.2);
  if (kind.livery === 'cab') {
    ctx.fillStyle = '#2d3038';
    ctx.fillRect(-length * 0.02, -width * 0.5, length * 0.1, width);
    ctx.fillStyle = '#f6e9b8';
    ctx.fillRect(-length * 0.1, -width * 0.16, length * 0.08, width * 0.32);
  }
  if (kind.livery === 'police') {
    // Dark door panels on a white car, the Harbour Patrol scheme.
    ctx.fillStyle = '#28303c';
    ctx.fillRect(-length * 0.3, -width * 0.5, length * 0.44, width * 0.22);
    ctx.fillRect(-length * 0.3, width * 0.28, length * 0.44, width * 0.22);
    ctx.fillStyle = '#f4f7f8';
    ctx.font = `bold ${Math.max(4, 5.2 * zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('PATROL', -length * 0.08, -width * 0.33);
  }
  if (vehicle.marked) {
    ctx.fillStyle = '#c4583d';
    ctx.fillRect(-length * 0.46, -width * 0.12, length * 0.92, width * 0.1);
    ctx.fillStyle = '#2f5f68';
    ctx.fillRect(-length * 0.2, -width * 0.44, length * 0.16, width * 0.18);
  }
  ctx.restore();

  // Siren bar: two lamps alternating, with a wash of colour thrown on the road.
  if (kind.siren && vehicle.siren) {
    const flash = Math.sin(vehicle.lightPhase) > 0;
    const bar = stack(camera, vehicle.x, vehicle.y, 22);
    ctx.save();
    ctx.translate(bar.x, bar.y);
    ctx.rotate(vehicle.angle);
    // Both lamps are always lit; the flashing swaps which one is bright, so a cruiser always
    // reads as red-and-blue rather than as a plain car caught on the dark half of its cycle.
    for (const [side, colour] of [[-1, '#4d82ff'], [1, '#ff4a3c']]) {
      const on = (side === -1) === flash;
      ctx.fillStyle = on ? colour : shade(colour, 0.62);
      ctx.fillRect(-length * 0.13, side * width * 0.32 - width * 0.17, length * 0.26, width * 0.34);
      {
        // A soft wash of colour thrown on the road, not a flat disc.
        const glow = ctx.createRadialGradient(0, side * width * 0.32, 2, 0, side * width * 0.32, length * 0.95);
        glow.addColorStop(0, colour);
        glow.addColorStop(0.35, colour);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.save();
        ctx.globalAlpha = on ? 0.34 : 0.17;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, side * width * 0.32, length * 0.95, width * 1.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  if (isPlayer) {
    // A thin warm outline, so the car Riley is in reads at a glance in a crowded street.
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(vehicle.angle);
    roundRect(ctx, -length / 2 - 1.5, -width / 2 - 1.5, length + 3, width + 3, Math.min(width * 0.34, 8 * zoom));
    ctx.strokeStyle = 'rgba(255, 232, 186, 0.75)';
    ctx.lineWidth = Math.max(1.4, 2 * zoom);
    ctx.stroke();
    ctx.restore();
  }
  if (vehicle.dead) {
    ctx.fillStyle = 'rgba(26, 22, 20, 0.45)';
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(vehicle.angle);
    roundRect(ctx, -length / 2, -width / 2, length, width, 6 * zoom);
    ctx.fill();
    ctx.restore();
  }
}

/** One walking figure: shadow, legs, body, head, and whatever is in their hands. */
function drawFigure(ctx, camera, person, palette, options) {
  const zoom = camera.zoom;
  groundShadow(ctx, camera, person.x, person.y, 10.5, 7, 0);
  const base = worldToScreen(camera, person.x, person.y);
  const top = stack(camera, person.x, person.y, 17);
  const stride = Math.sin(person.phase) * 4 * zoom;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(person.angle + Math.PI / 2);
  ctx.fillStyle = palette.trousers;
  ctx.fillRect(-4.2 * zoom, -1 * zoom + stride * 0.2, 3.4 * zoom, 10 * zoom + stride);
  ctx.fillRect(0.8 * zoom, -1 * zoom - stride * 0.2, 3.4 * zoom, 10 * zoom - stride);
  ctx.restore();

  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.rotate(person.angle + Math.PI / 2);
  ctx.fillStyle = palette.shirt;
  roundRect(ctx, -5.8 * zoom, -5.2 * zoom, 11.6 * zoom, 11.6 * zoom, 3.6 * zoom);
  ctx.fill();
  if (palette.vest) {
    ctx.fillStyle = palette.vest;
    ctx.fillRect(-5.8 * zoom, -2.8 * zoom, 11.6 * zoom, 4 * zoom);
  }
  // Arms, swung or thrown forward for a punch or a shot.
  ctx.fillStyle = palette.skin;
  const reach = options?.reach ?? 0;
  ctx.fillRect(-7.9 * zoom, -3.6 * zoom - reach * 5 * zoom, 2.6 * zoom, 7.8 * zoom);
  ctx.fillRect(5.3 * zoom, -3.6 * zoom - reach * 5 * zoom, 2.6 * zoom, 7.8 * zoom);
  ctx.restore();

  const head = stack(camera, person.x, person.y, 27);
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 5.3 * zoom, 0, Math.PI * 2);
  ctx.fill();
  if (palette.hat) {
    ctx.fillStyle = palette.hat;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 6 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  if (options?.gun) {
    const muzzle = stack(camera, person.x + Math.cos(person.aimAngle ?? person.angle) * 15, person.y + Math.sin(person.aimAngle ?? person.angle) * 15, 17);
    ctx.strokeStyle = '#2b2e33';
    ctx.lineWidth = Math.max(1.6, 3 * zoom);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(muzzle.x, muzzle.y);
    ctx.stroke();
  }
  if (person.scream > 0.1) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * person.scream})`;
    ctx.font = `bold ${Math.max(8, 11 * zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', head.x, head.y - 9 * zoom);
  }
}

/** A body on the ground. */
function drawDown(ctx, camera, person) {
  const zoom = camera.zoom;
  const base = worldToScreen(camera, person.x, person.y);
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(person.angle);
  ctx.fillStyle = 'rgba(120, 36, 30, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.shirt ?? '#9aa0a6';
  roundRect(ctx, -9 * zoom, -3.6 * zoom, 18 * zoom, 7.2 * zoom, 3 * zoom);
  ctx.fill();
  ctx.fillStyle = person.skin ?? '#d9a271';
  ctx.beginPath();
  ctx.arc(10 * zoom, 0, 4 * zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The crowd, the officers, Mae and Riley, in that order so Riley is always on top. */
export function drawPeople(ctx, game, bounds) {
  const camera = game.camera;
  for (const ped of game.peds) {
    if (ped.x < bounds.x - 40 || ped.x > bounds.x + bounds.w + 40 || ped.y < bounds.y - 40 || ped.y > bounds.y + bounds.h + 40) continue;
    if (ped.state === 'down') drawDown(ctx, camera, ped);
    else drawFigure(ctx, camera, ped, { shirt: ped.shirt, skin: ped.skin, trousers: ped.trousers, hat: ped.hat ? '#e2d8c2' : null });
  }
  for (const npc of game.npcs) {
    drawFigure(ctx, camera, npc, { shirt: npc.shirt, skin: npc.skin, trousers: npc.trousers, hat: null });
    const head = stack(camera, npc.x, npc.y, 44);
    const bob = Math.sin(game.time * 2.4) * 3 * camera.zoom;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.moveTo(head.x, head.y + 9 * camera.zoom + bob);
    ctx.lineTo(head.x - 7 * camera.zoom, head.y - 2 * camera.zoom + bob);
    ctx.lineTo(head.x + 7 * camera.zoom, head.y - 2 * camera.zoom + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#20211d';
    ctx.font = `bold ${Math.max(8, 10 * camera.zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(npc.name.toUpperCase(), head.x, head.y - 7 * camera.zoom + bob);
  }
  for (const cop of game.cops) {
    if (cop.health <= 0) {
      drawDown(ctx, camera, { ...cop, shirt: '#3d5a8a', skin: '#e0b48c' });
      continue;
    }
    drawFigure(ctx, camera, cop, { shirt: '#3d5a8a', skin: '#e0b48c', trousers: '#232c3d', vest: '#e8edf2', hat: '#1b2334' }, { gun: true, reach: 0.6 });
  }
  if (!game.player.vehicle) drawPlayer(ctx, game);
}

/** Riley Voss. */
function drawPlayer(ctx, game) {
  const player = game.player;
  const camera = game.camera;
  const reach = player.punch > 0 ? 1 : player.weapon === 'fists' ? 0 : 0.5;
  drawFigure(ctx, camera, { ...player, phase: player.phase, aimAngle: player.aimAngle }, {
    shirt: '#ef9b3a', skin: '#e8bd94', trousers: '#2b303b', hat: null,
  }, { gun: player.weapon !== 'fists', reach });
  // A thin warm ring at his feet, the on-foot twin of the outline round the car he is driving.
  const feet = worldToScreen(camera, player.x, player.y);
  ctx.strokeStyle = 'rgba(255, 228, 174, 0.55)';
  ctx.lineWidth = Math.max(1.2, 1.8 * camera.zoom);
  ctx.beginPath();
  ctx.ellipse(feet.x, feet.y + 2 * camera.zoom, 11 * camera.zoom, 6 * camera.zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (player.hurt > 0.05) {
    const point = worldToScreen(camera, player.x, player.y);
    ctx.strokeStyle = `rgba(220, 70, 60, ${0.5 * player.hurt})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 16 * camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Weapons, cash and medkits waiting on the ground, bobbing. */
export function drawPickups(ctx, game) {
  const camera = game.camera;
  const zoom = camera.zoom;
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const bob = Math.sin(pickup.bob) * 4;
    const point = stack(camera, pickup.x, pickup.y, 30 + bob * 2);
    const colour = pickup.type === 'cash' ? '#6fc08a' : pickup.type === 'health' ? '#e8625c' : '#d8c27a';
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 15 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = colour;
    if (pickup.type === 'cash') {
      ctx.fillRect(point.x - 8 * zoom, point.y - 4 * zoom, 16 * zoom, 8 * zoom);
      ctx.fillStyle = '#20402c';
      ctx.font = `bold ${Math.max(6, 8 * zoom)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', point.x, point.y);
    } else if (pickup.type === 'health') {
      ctx.fillRect(point.x - 7 * zoom, point.y - 2.4 * zoom, 14 * zoom, 4.8 * zoom);
      ctx.fillRect(point.x - 2.4 * zoom, point.y - 7 * zoom, 4.8 * zoom, 14 * zoom);
    } else {
      ctx.fillRect(point.x - 9 * zoom, point.y - 2.4 * zoom, 18 * zoom, 4.4 * zoom);
      ctx.fillRect(point.x - 2 * zoom, point.y, 4 * zoom, 6 * zoom);
    }
  }
}

/** The mission destination: a ring on the ground and a tall beam you can see over the roofs. */
export function drawWaypoint(ctx, game, waypoint) {
  if (!waypoint) return;
  const camera = game.camera;
  const zoom = camera.zoom;
  const base = worldToScreen(camera, waypoint.x, waypoint.y);
  const pulse = 0.6 + 0.4 * Math.sin(game.time * 3.4);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 214, 110, ${0.55 + 0.35 * pulse})`;
  ctx.lineWidth = 3 * zoom;
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, (30 + pulse * 9) * zoom, (18 + pulse * 5) * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The beam rises up the screen rather than outward: a destination under the camera would
  // otherwise have no lean at all and disappear behind whatever is standing on it.
  const top = { x: base.x, y: base.y - 190 * 0.52 * zoom };
  const gradient = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
  gradient.addColorStop(0, 'rgba(255, 206, 96, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 206, 96, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(base.x - 13 * zoom, base.y);
  ctx.lineTo(base.x + 13 * zoom, base.y);
  ctx.lineTo(top.x + 7 * zoom, top.y);
  ctx.lineTo(top.x - 7 * zoom, top.y);
  ctx.closePath();
  ctx.fill();
  // The floating marker itself.
  const marker = { x: base.x, y: base.y - (62 + pulse * 8) * 0.52 * zoom };
  ctx.fillStyle = '#ffd36a';
  ctx.beginPath();
  ctx.moveTo(marker.x, marker.y + 11 * zoom);
  ctx.lineTo(marker.x - 9 * zoom, marker.y - 3 * zoom);
  ctx.lineTo(marker.x, marker.y - 13 * zoom);
  ctx.lineTo(marker.x + 9 * zoom, marker.y - 3 * zoom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 48, 10, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (waypoint.label) {
    ctx.fillStyle = '#2a1f10';
    ctx.font = `bold ${Math.max(8, 10 * zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(waypoint.label, marker.x, marker.y - 18 * zoom);
  }
  ctx.restore();
}

/** Tracer fire. */
export function drawBullets(ctx, game) {
  const camera = game.camera;
  for (const bullet of game.bullets) {
    const head = worldToScreen(camera, bullet.x, bullet.y);
    const tail = worldToScreen(camera, bullet.x - bullet.vx * 0.034, bullet.y - bullet.vy * 0.034);
    // A warm trail with a bright core, so a round in flight is legible in a still frame.
    ctx.strokeStyle = bullet.hostile ? 'rgba(255, 150, 96, 0.55)' : 'rgba(255, 224, 150, 0.6)';
    ctx.lineWidth = Math.max(2.6, 4.4 * camera.zoom);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 248, 224, 0.95)';
    ctx.lineWidth = Math.max(1.2, 1.8 * camera.zoom);
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
  }
}

/** Sparks, blood, dust, smoke and spent cases. */
export function drawParticles(ctx, game) {
  const camera = game.camera;
  for (const casing of game.effects.casings) {
    const point = worldToScreen(camera, casing.x, casing.y);
    ctx.fillStyle = 'rgba(198, 164, 86, 0.8)';
    ctx.fillRect(point.x - 1, point.y - 1, 2.4, 1.6);
  }
  for (const particle of game.effects.particles) {
    const fade = 1 - particle.age / particle.life;
    const point = worldToScreen(camera, particle.x, particle.y);
    const size = particle.size * camera.zoom * (particle.glow ? fade : 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.fillStyle = particle.color;
    if (particle.glow) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

/** The look: warm light, a vignette, a muzzle-flash lift and the red edge when Riley is hit. */
export function drawGrade(ctx, game) {
  ctx.fillStyle = LIGHT.warm;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const glow = ctx.createRadialGradient(VIEW.width * 0.26, VIEW.height * 0.1, 40, VIEW.width * 0.26, VIEW.height * 0.1, VIEW.height * 1.05);
  glow.addColorStop(0, 'rgba(255, 214, 150, 0.17)');
  glow.addColorStop(0.45, 'rgba(255, 186, 120, 0.04)');
  glow.addColorStop(1, 'rgba(255, 186, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const vignette = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95);
  vignette.addColorStop(0, 'rgba(24, 14, 10, 0)');
  vignette.addColorStop(1, 'rgba(24, 14, 10, 0.47)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (game.effects.flash > 0.01) {
    ctx.fillStyle = `rgba(255, 228, 176, ${game.effects.flash * 0.12})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  const player = game.player;
  const lowHealth = Math.max(0, 1 - player.health / 38);
  const hurt = Math.max(player.hurt * 0.5, lowHealth * (0.3 + 0.1 * Math.sin(game.time * 5)));
  if (hurt > 0.01) {
    const edge = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.3, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
    edge.addColorStop(0, 'rgba(150, 20, 16, 0)');
    edge.addColorStop(1, `rgba(150, 20, 16, ${Math.min(0.55, hurt)})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}
