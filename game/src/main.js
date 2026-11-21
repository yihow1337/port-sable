// Boot and the one loop. Input is read once a frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), then the city, the actors and the HUD are painted.
// The game moves between three screens: the title card, play, and the pause menu.
//
// ?seed=N fixes the whole city and everything in it. ?shot=title|street|combat|chase (with &seed=N)
// stages that scene from the real simulation, paints it twice and sets window.__shotReady, which is
// what tools/shoot.sh waits for before it takes the screenshot.
import { SAVE_SLOTS, STEP, VIEW } from './config.js';
import { createInput } from './input.js';
import { createGame, stepGame, applySave } from './world.js';
import { hasSave, latestSlot, loadSave, readSlots, saveGame } from './save.js';
import { createAudio, createSilentAudio } from './audio.js';
import { drawHud } from './hud.js';
import { createTitleArt, drawPause, drawTitle, PAUSE_ITEMS } from './screens.js';
import { stageShot } from './shots.js';
import { screenToWorld } from './camera.js';
import { createRenderer } from './render.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 2147483647);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const ctx = renderer.ctx;
const titleArt = createTitleArt(seed);

/** Scale the fixed 1280x720 buffer to the window without stretching it. */
function fit() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.round(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.round(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

/** Shout any crash onto the page and the canvas, so a failed screenshot run is obvious. */
function reportCrash(message) {
  const box = document.getElementById('crash');
  if (box) {
    box.textContent = `PORT SABLE error: ${message}`;
    box.style.display = 'block';
  }
  try {
    ctx.fillStyle = '#1b0e0e';
    ctx.fillRect(0, 0, VIEW.width, 90);
    ctx.fillStyle = '#ff8c7a';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`error: ${message}`.slice(0, 120), 24, 50);
  } catch {
    // The context itself is gone; the page text is the report.
  }
  window.__shotReady = true;
}
window.addEventListener('error', (event) => reportCrash(event.message ?? 'unknown'));
window.addEventListener('unhandledrejection', (event) => reportCrash(String(event.reason).slice(0, 160)));

const audio = shot ? createSilentAudio() : createAudio(true);
let game = createGame(seed, { audio });
let screen = 'title';
let selected = 0;
let slot = 0;
let saveNote = '';
let clock = 0;

function announce(text) {
  if (status) status.textContent = text;
}

/** Paint whichever screen is current. */
function paint() {
  if (screen === 'title') {
    drawTitle(ctx, { art: titleArt, time: clock, hasSave: hasSave(), slots: readSlots() });
    return;
  }
  renderer.drawWorld(game);
  drawHud(ctx, game);
  if (screen === 'paused') drawPause(ctx, game, { selected, slot, slots: readSlots(), note: saveNote });
}

/** Start a fresh run, or resume the run in one slot. */
function startGame(fromSlot) {
  const data = fromSlot === undefined || fromSlot < 0 ? null : loadSave(fromSlot);
  game = createGame(data?.seed ?? seed, { audio });
  if (data) {
    applySave(game, data);
    slot = fromSlot;
    game.toast(`Slot ${fromSlot + 1} restored`);
  }
  screen = 'play';
  announce(data ? `Saved run restored from slot ${fromSlot + 1}` : 'Port Sable: new game started');
}

/** The pause menu's four choices. */
function choosePauseItem() {
  const item = PAUSE_ITEMS[selected];
  audio.ui();
  if (item === 'Continue') {
    screen = 'play';
  } else if (item === 'Save game') {
    saveNote = saveGame(game, slot) ? `Run written to slot ${slot + 1}` : 'Saving is unavailable here';
  } else if (item === 'Load game') {
    if (loadSave(slot)) {
      startGame(slot);
      saveNote = '';
    } else {
      saveNote = `Slot ${slot + 1} is empty`;
    }
  } else {
    screen = 'title';
    selected = 0;
    saveNote = '';
  }
}

if (shot) {
  // A screenshot: stage the scene from the real simulation, paint twice, then stop.
  const scene = stageShot(shot, game);
  screen = scene.screen;
  clock = scene.clock ?? 0;
  let painted = 0;
  const paintShot = () => {
    paint();
    painted += 1;
    if (painted < 2) {
      window.requestAnimationFrame(paintShot);
    } else {
      // tools/shoot.sh reads both of these to be sure it photographed a finished frame.
      window.__shotReady = true;
      document.title = `PORT SABLE shot ready: ${shot}`;
    }
  };
  window.requestAnimationFrame(paintShot);
} else {
  const input = createInput(canvas);
  let last = performance.now();
  let accumulator = 0;
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('mousedown', unlock, { once: true });

  const menuHeld = { down: false, side: false };
  const frame = (now) => {
    const delta = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    clock += delta;
    const snapshot = input.read();
    if (screen === 'title') {
      if (snapshot.confirmPressed || snapshot.interactPressed) startGame(-1);
    } else if (screen === 'play') {
      if (snapshot.pausePressed) {
        screen = 'paused';
        selected = 0;
        saveNote = '';
        audio.idle();
        audio.siren(false);
      } else {
        const aim = screenToWorld(game.camera, snapshot.aimX, snapshot.aimY);
        snapshot.aimWorldX = aim.x;
        snapshot.aimWorldY = aim.y;
        accumulator += delta;
        let steps = 0;
        while (accumulator >= STEP && steps < 5) {
          stepGame(game, STEP, steps === 0 ? snapshot : { ...snapshot, firePressed: false, interactPressed: false, switchPressed: false });
          accumulator -= STEP;
          steps += 1;
        }
        if (steps === 5) accumulator = 0;
      }
    } else if (screen === 'paused') {
      if (snapshot.pausePressed) screen = 'play';
      if (snapshot.moveY < 0 && !menuHeld.down) {
        selected = (selected + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
        menuHeld.down = true;
      } else if (snapshot.moveY > 0 && !menuHeld.down) {
        selected = (selected + 1) % PAUSE_ITEMS.length;
        menuHeld.down = true;
      } else if (snapshot.moveY === 0) {
        menuHeld.down = false;
      }
      if (snapshot.moveX < 0 && !menuHeld.side) {
        slot = (slot + SAVE_SLOTS - 1) % SAVE_SLOTS;
        menuHeld.side = true;
      } else if (snapshot.moveX > 0 && !menuHeld.side) {
        slot = (slot + 1) % SAVE_SLOTS;
        menuHeld.side = true;
      } else if (snapshot.moveX === 0) {
        menuHeld.side = false;
      }
      if (snapshot.confirmPressed) choosePauseItem();
    }
    paint();
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
  announce('Port Sable title screen. Press Enter to start.');
}

// Slots by number: load one straight from the title card, or aim a save at one while paused.
// L on the title picks up the most recent run, whichever slot it is in.
window.addEventListener('keydown', (event) => {
  const digit = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
  if (screen === 'title') {
    if (event.code === 'KeyL' && hasSave()) startGame(latestSlot());
    else if (digit >= 0 && loadSave(digit)) startGame(digit);
  } else if (screen === 'paused' && digit >= 0) {
    slot = digit;
    saveNote = '';
    audio.ui();
  }
});
