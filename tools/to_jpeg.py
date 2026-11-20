#!/usr/bin/env python3
"""Turn a PNG capture into a JPEG inside the bounty's screenshot caps.

Caps: at most 262144 bytes, long side at most 1280, short side at least 480. Quality is stepped
down (and only then the image scaled) until it fits, so the screenshots stay as sharp as the cap
allows. Usage: to_jpeg.py <input.png> <output.jpg>
"""
import sys
from PIL import Image

MAX_BYTES = 262144
MAX_LONG = 1280
MIN_SHORT = 480


def main(source: str, target: str) -> int:
    image = Image.open(source).convert("RGB")
    if max(image.size) > MAX_LONG:
        scale = MAX_LONG / max(image.size)
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    for scale in (1.0, 0.92, 0.84, 0.76):
        frame = image if scale == 1.0 else image.resize(
            (round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
        if min(frame.size) < MIN_SHORT:
            continue
        for quality in range(92, 39, -3):
            frame.save(target, "JPEG", quality=quality, optimize=True, progressive=False)
            size = len(open(target, "rb").read())
            if size <= MAX_BYTES:
                print(f"{target}: {frame.width}x{frame.height} q{quality} {size} bytes")
                return 0
    print(f"{target}: could not fit under {MAX_BYTES} bytes", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1], sys.argv[2]))
