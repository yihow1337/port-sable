[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yihow1337/port-sable/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yihow1337/port-sable/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# PORT SABLE

A sun-bleached gulf-coast crime story. **Riley Voss** drives for dockside fixer **Mae Calder** to
clear a debt he cannot pay. Five districts — **The Docks**, **Calder Midtown**, **Palm Reach**,
**The Refinery** and **Old Fort** — one city you can cross on foot or in anything parked at the
kerb, and five stars of trouble when you take it.

An original open-world crime game: every street, car, face, line and sound in it was written for
this city. No trademarks and no borrowed assets.

## Run it

```
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. Static files only — no build step, no
network request, no libraries: `game/index.html` loads one tree of ES modules drawn on a 1280×720
Canvas 2D buffer, and every engine note, siren, gunshot and skid is synthesised in WebAudio when
you first press a key.

## Controls

| key | on foot | driving |
| --- | --- | --- |
| `W A S D` / arrows | walk | throttle, brake, steer |
| `Shift` | run | handbrake |
| `F` (hold) | enter a car — hold to hotwire a locked one | get out |
| `Space` / click | punch or fire | — |
| mouse | aim | — |
| `Q` | switch weapon | — |
| `Esc` | pause, save, load, quit to title | |

## The story

Four jobs, each with a named objective, a world waypoint and a blip on the minimap:

1. **Wheels** — steal the teal coupe on Palm Reach and deliver it to the docks.
2. **Envelope** — collect a package in Calder Midtown on foot and drop it in Palm Reach.
3. **Heat** — the handover at Old Fort goes loud: survive two stars and reach the hideout.
4. **The Lift** — take the marked van out of the refinery yard and bring it home.

## What is in the box

| file | job |
| --- | --- |
| `game/src/city.js` | the seeded city: avenues, streets, blocks, buildings, piers, road graph |
| `game/src/vehicles.js` | six car models and the driving model they all share |
| `game/src/traffic.js` | civilian drivers following the road graph in lane |
| `game/src/peds.js` | the crowd walking the pavement, crossing, fleeing |
| `game/src/wanted.js` | wanted level 0–5, dispatch, pursuit, roadblocks, losing the heat |
| `game/src/combat.js` | fists, two guns, bullets, pickups |
| `game/src/missions.js` | the four-mission story and its objectives |
| `game/src/hud.js` | health, money, stars, weapon, minimap, prompts |
| `game/src/render.js`, `actors.js` | the city and everything moving in it, at golden hour |
| `game/src/audio.js` | engine, tyres, siren, gunfire and menus, synthesised |
| `game/src/save.js` | the single `localStorage` slot |
| `game/src/shots.js` | the four deterministic screenshot scenes |
| `tools/shoot.sh` | takes those four shots in headless Chrome and builds the entry |

The world is seeded: `?seed=1` always builds the same Port Sable, which is what makes
`?shot=title|street|drive|wanted` repeatable. Each shot runs the real simulation forward from a
seeded world until the frame shows what it is meant to prove — nothing is composited over the top.

---

<sub>Entered on [make.fun](https://make.fun/?ref=j5ka5y6n&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
