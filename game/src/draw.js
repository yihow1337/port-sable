// Canvas helpers shared by the world renderer, the actors and the interface: colour arithmetic,
// rounded rectangles and the height projection, so none of those files has to import another.
import { VIEW } from './config.js';
import { worldToScreen } from './camera.js';

/**
 * How much a unit of height pushes a roof outward from the middle of the screen. The camera
 * floats about 430 units up, so a thing of height H shifts by H/430 of its screen offset.
 */
export const PARALLAX = 1 / 430;

/** #rrggbb to [r, g, b]. */
function rgbOf(hex) {
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Scale a colour, and optionally pull it toward the low warm sun. */
export function shade(hex, factor, warmth) {
  const [r, g, b] = rgbOf(hex);
  const warm = warmth ?? 0;
  const mix = (channel, target) => Math.round(Math.max(0, Math.min(255, channel * factor * (1 - warm) + target * warm)));
  return `rgb(${mix(r, 255)}, ${mix(g, 192)}, ${mix(b, 128)})`;
}

/** A rounded rectangle path, written out so no canvas extension is needed. */
export function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Project a world point, then push it outward by `height` to fake elevation. */
export function lift(camera, x, y, height) {
  const point = worldToScreen(camera, x, y);
  const k = height * PARALLAX;
  return { x: point.x + (point.x - VIEW.width / 2) * k, y: point.y + (point.y - VIEW.height / 2) * k };
}
