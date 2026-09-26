#!/usr/bin/env python3
"""Compose isolated QA plates from the provisional v3 manifest layers."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
OUT = V3 / "playtest"


def main() -> None:
    manifest = json.loads((V3 / "manifest.json").read_text())
    width = manifest["worldPixels"]["width"]
    height = manifest["worldPixels"]["height"]
    base = Image.open(V3 / manifest["ground"]["file"]).convert("RGBA")
    foreground = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    for asset in manifest["runtimeAssets"]:
        bounds = asset["worldBounds"]
        sprite = Image.open(V3 / asset["file"]).convert("RGBA")
        base.alpha_composite(sprite, (bounds["x"], bounds["y"]))
        if asset.get("foregroundFile"):
            front = Image.open(V3 / asset["foregroundFile"]).convert("RGBA")
            foreground.alpha_composite(front, (bounds["x"], bounds["y"]))

    OUT.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(OUT / "base-map.png", optimize=True)
    foreground.save(OUT / "foreground-map.png", optimize=True)
    base.alpha_composite(foreground)
    base.convert("RGB").save(OUT / "provisional-full-map.png", optimize=True)
    print({"size": (width, height), "assets": len(manifest["runtimeAssets"])})


if __name__ == "__main__":
    main()
