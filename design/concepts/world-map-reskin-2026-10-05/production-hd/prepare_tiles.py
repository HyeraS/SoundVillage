#!/usr/bin/env python3
"""Prepare overlap-aware ImageGen guide tiles from the approved composition.

The resized image and crops produced here are guides only. They are never used as
pixels in the final master; final pixels come from ImageGen tile outputs.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "01-spring-sound-archive-garden-final-v2.png"
TILES = ROOT / "tiles"
GUIDES = TILES / "guides"

FINAL_W = 7680
FINAL_H = 5760
CORE_W = 1280
CORE_H = 768
OVERLAP = 128
TILE_W = CORE_W + 2 * OVERLAP
TILE_H = CORE_H + 2 * OVERLAP
COLS = 6
ROWS = 8


def main() -> None:
    GUIDES.mkdir(parents=True, exist_ok=True)
    approved = Image.open(SOURCE).convert("RGB")
    guide = approved.resize((FINAL_W, FINAL_H), Image.Resampling.LANCZOS)
    padded = ImageOps.expand(guide, border=OVERLAP)

    manifest: list[dict[str, int | str]] = []
    for row in range(ROWS):
        for col in range(COLS):
            core_x = col * CORE_W
            core_y = row * CORE_H
            core_w = min(CORE_W, FINAL_W - core_x)
            core_h = min(CORE_H, FINAL_H - core_y)
            if core_w <= 0 or core_h <= 0:
                continue

            tile = padded.crop(
                (
                    core_x,
                    core_y,
                    core_x + TILE_W,
                    core_y + TILE_H,
                )
            )
            name = f"guide-r{row:02d}-c{col:02d}.png"
            tile.save(GUIDES / name, optimize=True)
            manifest.append(
                {
                    "row": row,
                    "col": col,
                    "guide": f"guides/{name}",
                    "core_x": core_x,
                    "core_y": core_y,
                    "core_w": core_w,
                    "core_h": core_h,
                    "tile_w": TILE_W,
                    "tile_h": TILE_H,
                    "overlap": OVERLAP,
                }
            )

    (TILES / "tile-manifest.json").write_text(
        json.dumps(
            {
                "source": str(SOURCE),
                "final_size": [FINAL_W, FINAL_H],
                "core_size": [CORE_W, CORE_H],
                "tile_size": [TILE_W, TILE_H],
                "overlap": OVERLAP,
                "columns": COLS,
                "rows": ROWS,
                "tiles": manifest,
                "note": "Guides are interpolated composition references only; do not composite them into the final master.",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"prepared {len(manifest)} guide tiles at {TILE_W}x{TILE_H}")


if __name__ == "__main__":
    main()
