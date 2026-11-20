#!/usr/bin/env bash
# Take the four PORT SABLE screenshots (title, street, combat, chase) from the real game, then
# build the entry.
#
#   tools/shoot.sh            take the shots and run the build
#   tools/shoot.sh --no-build just the shots
#
# Each shot is a deterministic scene: game/src/shots.js runs the live simulation forward from a
# seeded world until the frame shows the systems it is meant to prove, paints twice and sets
# window.__shotReady. Headless Chrome photographs the page, and the captures are written out as
# JPEGs inside the bounty's caps (<= 256 KiB, long side <= 1280, short side >= 480).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"
port="${PORT:-8099}"
seed="${SEED:-1}"
chrome="${CHROME:-google-chrome}"
build=1
[ "${1:-}" = "--no-build" ] && build=0

command -v "$chrome" >/dev/null || { echo "need google-chrome (set CHROME=...)" >&2; exit 1; }

node serve.ts --port "$port" >/tmp/port-sable-serve.log 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -fsS -o /dev/null "http://localhost:$port/index.html" 2>/dev/null && break
  sleep 0.25
done

shots=(title street combat chase)
names=(1-title 2-street 3-combat 4-chase)
raw="$(mktemp -d)"
mkdir -p screenshots

for index in "${!shots[@]}"; do
  shot="${shots[$index]}"
  url="http://localhost:$port/index.html?shot=$shot&seed=$seed"
  echo "shooting $shot"
  # Virtual time runs the page's frames as fast as it can and stops once the budget is spent,
  # so the capture always lands after the stager has painted its two frames.
  "$chrome" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=1280,720 --virtual-time-budget=15000 \
    --screenshot="$raw/$shot.png" "$url" >/dev/null 2>&1
  # Confirm the page really finished and did not report a crash.
  dom="$("$chrome" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=15000 --dump-dom "$url" 2>/dev/null)"
  case "$dom" in
    *"PORT SABLE error"*) echo "shot $shot crashed:"; echo "$dom" | grep -o 'PORT SABLE error[^<]*'; exit 1 ;;
  esac
  case "$dom" in
    *"shot ready: $shot"*) ;;
    *) echo "shot $shot never set __shotReady" >&2; exit 1 ;;
  esac
  python3 tools/to_jpeg.py "$raw/$shot.png" "screenshots/${names[$index]}.jpg"
done

rm -rf "$raw"
ls -l screenshots

if [ "$build" = 1 ]; then
  echo "building"
  rm -rf out
  mkdir -p out
  MAKEFUN_OUTPUT_DIR=out node main.ts
  ls -l out
fi

exit 0
