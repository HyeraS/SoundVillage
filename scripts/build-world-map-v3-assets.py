#!/usr/bin/env python3
"""Build the modular Sound Archive Garden v3 runtime asset set.

ImageGen masters are only trimmed/cropped and losslessly optimized here.  The
script deliberately performs no enlargement, sharpening, or reconstruction.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "design/world-map-v3/source-assets"
V1 = ROOT / "public/assets/world/sound-archive-garden-v1"
OUTPUT = ROOT / "public/assets/world/sound-archive-garden-v3"
GENERATED_MODULE = ROOT / "lib/worldMapV3Assets.mjs"

BUILDINGS = {
    "building-library": "library-source.png",
    "building-home": "home-cottage-source.png",
    "building-animal": "gateway-animal-source.png",
    "building-nature": "gateway-nature-source.png",
    "building-human": "gateway-human-source.png",
    "building-urban": "gateway-urban-source.png",
    "building-music": "gateway-music-source.png",
    "building-lab": "gateway-lab-source.png",
    "foreground-arch": "foreground-arch-source.png",
}

NATURE = [
    "tree-broadleaf-a", "tree-broadleaf-b", "tree-broadleaf-c", "tree-pine-a",
    "tree-pine-b", "tree-flowering", "shrub-flower", "rock-flower",
]

PROPS = [
    "prop-bench", "prop-lamp", "prop-sign", "fence-straight",
    "fence-corner", "fence-gate", "bridge-wood", "water-cattails",
]

SUPPLEMENT = [
    "flower-cluster", "mushroom-cluster", "prop-plant-pot", "prop-banner",
    "prop-market-crates", "prop-research-apparatus", "water-lilies", "cliff-mossy",
]

HIGH_RES_OVERRIDES = {
    "bridge-wood": "bridge-wood-source.png",
}

LEGACY_GENERATED = {
    "terrain-grass": "ground-grass-base.png",
    "terrain-plaza": "ground-cream-stone.png",
    "terrain-path": "ground-honey-path.png",
}


def alpha_bbox(image: Image.Image):
    alpha = image.getchannel("A")
    return alpha.getbbox()


def trim_with_padding(image: Image.Image, padding: int = 12) -> Image.Image:
    image = image.convert("RGBA")
    bbox = alpha_bbox(image)
    if not bbox:
        raise ValueError("image has no visible alpha")
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def save_asset(asset_id: str, image: Image.Image, origin: str, records: list[dict]):
    output = OUTPUT / f"{asset_id}.webp"
    image = trim_with_padding(image)
    image.save(output, "WEBP", quality=92, method=6, exact=True)
    alpha = image.getchannel("A")
    extrema = alpha.getextrema()
    if extrema[0] == 255:
        raise ValueError(f"{asset_id} unexpectedly has no transparent pixels")
    records.append({
        "id": asset_id,
        "src": f"/assets/world/sound-archive-garden-v3/{output.name}",
        "width": image.width,
        "height": image.height,
        "hasAlpha": True,
        "source": origin,
        "generation": "OpenAI built-in ImageGen",
    })


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []

    for asset_id, filename in BUILDINGS.items():
        with Image.open(SOURCE / filename) as image:
            save_asset(asset_id, image.copy(), f"design/world-map-v3/source-assets/{filename}", records)

    for atlas_name, ids in (
        ("nature-atlas-source.png", NATURE),
        ("props-atlas-source.png", PROPS),
        ("supplement-atlas-source.png", SUPPLEMENT),
    ):
        with Image.open(SOURCE / atlas_name) as atlas:
            atlas = atlas.convert("RGBA")
            cell_w = atlas.width // 4
            cell_h = atlas.height // 2
            for index, asset_id in enumerate(ids):
                col = index % 4
                row = index // 4
                cell = atlas.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
                save_asset(asset_id, cell, f"design/world-map-v3/source-assets/{atlas_name}#{col},{row}", records)

    for asset_id, filename in HIGH_RES_OVERRIDES.items():
        records[:] = [record for record in records if record["id"] != asset_id]
        with Image.open(SOURCE / filename) as image:
            save_asset(asset_id, image.copy(), f"design/world-map-v3/source-assets/{filename}", records)

    for asset_id, filename in LEGACY_GENERATED.items():
        source = V1 / filename
        output = OUTPUT / f"{asset_id}.webp"
        with Image.open(source) as source_image:
            source_image.save(output, "WEBP", quality=92, method=6, exact=True)
        with Image.open(output) as image:
            records.append({
                "id": asset_id,
                "src": f"/assets/world/sound-archive-garden-v3/{output.name}",
                "width": image.width,
                "height": image.height,
                "hasAlpha": image.mode in ("RGBA", "LA") or "transparency" in image.info,
                "source": f"public/assets/world/sound-archive-garden-v1/{filename}",
                "generation": "OpenAI built-in ImageGen (2026-09-18, preserved source)",
            })

    water_source = SOURCE / "terrain-water-source.png"
    water_output = OUTPUT / "terrain-water.webp"
    with Image.open(water_source) as water:
        water.convert("RGB").save(water_output, "WEBP", quality=92, method=6)
        records.append({
            "id": "terrain-water",
            "src": f"/assets/world/sound-archive-garden-v3/{water_output.name}",
            "width": water.width,
            "height": water.height,
            "hasAlpha": False,
            "source": "design/world-map-v3/source-assets/terrain-water-source.png",
            "generation": "OpenAI built-in ImageGen",
        })

    manifest = {
        "version": 3,
        "assetCount": len(records),
        "assets": records,
    }
    (OUTPUT / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    module_lines = [
        "// Generated by scripts/build-world-map-v3-assets.py. Do not edit by hand.",
        "export const WORLD_MAP_V3_ASSETS = Object.freeze({",
    ]
    for record in records:
        module_lines.append(
            f"  {json.dumps(record['id'])}: Object.freeze({{ src: {json.dumps(record['src'])}, width: {record['width']}, height: {record['height']}, hasAlpha: {str(record['hasAlpha']).lower()} }}),"
        )
    module_lines.extend(["})", "", "export const WORLD_MAP_V3_ASSET_IDS = Object.freeze(Object.keys(WORLD_MAP_V3_ASSETS))", ""])
    GENERATED_MODULE.write_text("\n".join(module_lines), encoding="utf-8")
    print(json.dumps({"assetCount": len(records), "output": str(OUTPUT)}, indent=2))


if __name__ == "__main__":
    build()
