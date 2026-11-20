[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yihow1337/port-sable/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yihow1337/port-sable/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# PORT SABLE — 6 jobs, 18 stages, dispatch, AIR ONE, 4 weapons, 3 save slots

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
| `F` (hold) | enter a car — hold to hotwire a locked one | get out (when you have slowed down) |
| `Space` / click | punch or fire | — |
| mouse | aim | — |
| `Q` | cycle the four weapon slots | — |
| `Esc` | pause: save, load, career, quit | |
| `Enter` / `L` / `1` `2` `3` | title: new game · continue · load a slot | |

## The story

Six jobs, eighteen stages. Every stage names an objective, puts a waypoint in the world and a blip
on the minimap, and the HUD banner counts them off (`JOB 4 OF 6 · HEAT`, `STAGE 3/3`).

1. **Wheels** — steal the teal coupe on Palm Reach and deliver it to the docks.
2. **Envelope** — collect a package in Calder Midtown on foot and drop it in Palm Reach.
3. **Low Tide** — lift a crate out of the refinery yard, then shake the patrol before you deliver.
4. **Heat** — the handover at Old Fort goes loud: survive the stars and reach the hideout.
5. **Last Call** — somebody put money on the driver. Walk into Palm Reach and end it.
6. **The Lift** — take the marked van out of the refinery yard and bring it home.

## The systems

| system | what it does |
| --- | --- |
| wanted 1–5 | heat per crime, cooling only once nothing has a line on you, five star tiers |
| dispatch | every cruiser is a numbered unit (`HP-14`) with a job — pursuit, ramming, roadblock, on foot — listed live in the HUD with its distance |
| **AIR ONE** | at four stars Harbour Patrol puts up a helicopter: it flies a lead on your car, drags a spotlight along the street, and while the beam is on you the heat never cools |
| weapons | four slots — fists, Sable .38, Dock 12 (a fan of pellets), Harbour SMG — with ammo, tracers, muzzle flare and spent cases |
| vests | a dock vest soaks most of a hit until it is gone, on its own HUD bar |
| respect | earned from jobs and from what the police want you for; five ranks, from Nobody to Port Sable Legend |
| driving | six car models on one driving model, hotwiring with a hold-to-steal bar, body damage, skids, a speedometer and the car's plate and condition |
| traffic & crowd | drivers following the road graph in lane, a crowd on the pavement that crosses, panics and flees |
| radio | KSBL 92.4 Gulf Gold picks a new track every time you take a car |
| saves | three localStorage slots, written and read from the pause menu and shown on the title card with the job, district, rank, cash and time played |

## What is in the box

| file | job |
| --- | --- |
| `game/src/city.js` | the seeded city: avenues, streets, blocks, buildings, piers, signals, road graph |
| `game/src/vehicles.js` | six car models and the driving model they all share |
| `game/src/traffic.js` | civilian drivers following the road graph in lane |
| `game/src/peds.js` | the crowd walking the pavement, crossing, fleeing |
| `game/src/wanted.js` | wanted level 0–5, the dispatch board, pursuit, roadblocks, losing the heat |
| `game/src/air.js` | AIR ONE: the air unit, its orbit and its spotlight |
| `game/src/combat.js` | fists, three guns, bullets, vests, pickups |
| `game/src/missions.js` | the six-job story and its eighteen stages |
| `game/src/hud.js` | vitals, rank, job and stage, stars, dispatch, speedo, radio, weapon rack, portraits, minimap |
| `game/src/screens.js` | the title card, the save slots and the pause menu with its career panel |
| `game/src/render.js`, `actors.js` | the city and everything moving in it, at golden hour |
| `game/src/audio.js` | engine, tyres, siren, gunfire and menus, synthesised |
| `game/src/save.js` | the three save slots |
| `game/src/shots.js` | the four deterministic screenshot scenes |
| `tools/shoot.sh` | takes those four shots in headless Chrome and builds the entry |
| `tools/compact.py` | the whitespace-and-comments pass the shipped modules go through |

The world is seeded: `?seed=1` always builds the same Port Sable, which is what makes
`?shot=title|street|combat|chase` repeatable. Each shot runs the real simulation forward from a
seeded world until the frame shows what it is meant to prove — the title card's save slots are
written through the game's own save code, the tracers in the gunfight were fired by the trigger
code a few hundredths of a second earlier, and nothing is composited over the top.

The modules are shipped compacted (`tools/compact.py`): comments other than each file's opening
description are dropped and whitespace is collapsed, so the whole game fits in the entry's source
outline. No identifier is renamed and no statement is rewritten.

---

<sub>Entered on [make.fun](https://make.fun/?ref=j5ka5y6n&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
