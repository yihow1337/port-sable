// PORT SABLE — the make.fun gta6-01 entry program.
//
// The game itself is `game/`: plain static files a desktop browser opens offline. game/index.html
// loads one ES module tree (game/src/*.js) drawn on a 1280x720 Canvas 2D buffer — no library, no
// build step, no network request, every sound synthesised in WebAudio at run time. It is an
// original open-world crime game set in Port Sable, a sun-bleached gulf-coast city: five named
// districts, traffic and a crowd, cars to hotwire and drive, a wanted level with police who chase,
// block and shoot, four story missions for Riley Voss and Mae Calder, fists and two guns, a HUD
// with a minimap, a title card, a pause menu and a save in localStorage.
//
// This program hands that in: it copies game/ and screenshots/ beside it into the output
// directory and writes dossier.json, the summary the judge reads, with the vendored make.fun
// library. The caps below are the scorer's own, from reference/gate.json.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Retake the four screenshots with `tools/shoot.sh` (headless Chrome, deterministic ?shot= scenes).
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Everything is resolved beside this file, so the program runs from any working directory. */
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * The scorer's caps. Only text_max_bytes shapes the bytes written; the rest make this program
 * refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB, more than
 * 993 files or 48 MiB under game/, a path under game/ over 1000 bytes).
 */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
console.log(`PORT SABLE: game, screenshots and dossier.json written to ${out}`);
