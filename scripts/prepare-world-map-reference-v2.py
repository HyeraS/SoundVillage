#!/usr/bin/env python3
"""Build the v2 world-map master without allowing image-edit drift outside the player."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png"
ASSET_DIR = ROOT / "public/assets/world/sound-archive-garden-v2"
REVIEW_DIR = ROOT / "_review/world-map-reference-match-v2"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("edited", type=Path, help="ImageGen precise-object-edit result")
    args = parser.parse_args()

    source = Image.open(REFERENCE).convert("RGB")
    edited = Image.open(args.edited).convert("RGB")
    if edited.size != source.size:
        raise SystemExit(f"edit size {edited.size} does not match reference {source.size}")

    # The character occupies x=713..740, y=522..572.  A softly feathered polygon
    # takes only the restored paving from ImageGen and retains every other source
    # pixel verbatim, preventing layout/style drift from entering production.
    mask = Image.new("L", source.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(711, 520), (741, 520), (746, 547), (741, 574), (711, 574), (706, 547)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3.0))
    clean = Image.composite(edited, source, mask)

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    clean.save(REVIEW_DIR / "01-reference-clean.png", optimize=True)

    # Exact 2x replication preserves the source pixels when the browser downsamples
    # the 2896x2172 master into the 1448x1086 normalized QA viewport.
    master = clean.resize((2896, 2172), Image.Resampling.NEAREST)
    master.save(ASSET_DIR / "world-base-clean.png", optimize=True)

    delta = ImageChops.difference(source, clean)
    mean_error = sum(ImageStat.Stat(delta).mean) / 3 / 255
    changed = delta.getbbox()
    print({
        "reference": str(REFERENCE),
        "master": str(ASSET_DIR / "world-base-clean.png"),
        "size": master.size,
        "changed_bbox": changed,
        "mean_rgb_absolute_error": mean_error,
    })


if __name__ == "__main__":
    main()
