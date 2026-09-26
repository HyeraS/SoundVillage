#!/usr/bin/env python3
"""Create the final small removal mask for the east-edge ground fragment."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/urban-city-v3/ground/masks-cleanup/east-edge-repair.png"


def main() -> None:
    mask = Image.new("L", (1448, 1086), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle((1330, 530, 1447, 715), fill=255)
    mask.save(OUT, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
