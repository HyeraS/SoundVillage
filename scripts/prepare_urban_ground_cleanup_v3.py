#!/usr/bin/env python3
"""Prepare non-overlapping second-pass masks for ground-only cleanup."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
OUT = V3 / "ground/masks-cleanup"

REGIONS = {
    "north": (0, 0, 1448, 340),
    "west-mid": (0, 340, 620, 680),
    "center-mid": (620, 340, 830, 680),
    "east-mid": (830, 340, 1448, 680),
    "west-south": (0, 680, 620, 1086),
    "center-south": (620, 680, 830, 1086),
    "east-south": (830, 680, 1448, 1086),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for region_id, box in REGIONS.items():
        mask = Image.new("L", (1448, 1086), 0)
        ImageDraw.Draw(mask).rectangle((box[0], box[1], box[2] - 1, box[3] - 1), fill=255)
        mask.save(OUT / f"{region_id}.png", optimize=True)
        (V3 / "prompts" / f"ground-cleanup-{region_id}.md").write_text(
            f"""Use case: precise-object-edit
Asset type: second-pass ground-only cleanup for Urban v3
Input images: Image 1 is the rejected first-pass ground plate; Image 2 is the non-overlapping `{region_id}` correction mask.
Primary request: Within the white region only, remove all remaining object fragments, trees, buildings, vehicles, furniture, shadows, seams, abrupt exposure rectangles and broken curbs. Reconstruct a coherent ground-only continuation of the approved road and plaza geometry visible at the region boundaries.
Constraints: no standing objects; no buildings; no transit; no vegetation; no props; preserve exact 1448x1086 dimensions and orthographic crisp pixel art.
"""
        )


if __name__ == "__main__":
    main()
