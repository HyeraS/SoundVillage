#!/usr/bin/env python3
"""Create region-scoped removal masks for the v3 ground-only plate."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
SIZE = (1448, 1086)


def region_for(item: dict) -> str:
    b = item["referenceBounds"]
    cx = b["x"] + b["w"] / 2
    cy = b["y"] + b["h"] / 2
    category = item["category"]
    if category in {"metro"} or cy < 340:
        return "north-metro"
    if 610 <= cx <= 838:
        return "central-spine" if cy < 960 else "south-entrance"
    if cy >= 960:
        return "south-entrance"
    if cy >= 650 and cx < 610:
        return "southwest-culture"
    if cy >= 650 and cx > 838:
        return "southeast-cinema-transit"
    if 340 <= cy < 650 and cx < 610:
        return "west-media-plaza"
    if 340 <= cy < 650 and cx > 838:
        return "east-food-court"
    return "central-spine"


def main() -> None:
    inventory = json.loads((V3 / "inventory.json").read_text())
    out = V3 / "ground/masks"
    out.mkdir(parents=True, exist_ok=True)
    prompts = V3 / "prompts"
    grouped: dict[str, list[dict]] = {
        "north-metro": [], "northwest": [], "northeast": [],
        "west-media-plaza": [], "east-food-court": [],
        "southwest-culture": [], "southeast-cinema-transit": [],
        "central-spine": [], "south-entrance": [],
    }
    for item in inventory["instances"]:
        if item["category"] == "ground":
            continue
        region = region_for(item)
        # Split outer northern façades into requested northwest/northeast passes.
        b = item["referenceBounds"]
        if region == "north-metro" and item["category"] == "building":
            cx = b["x"] + b["w"] / 2
            if cx < 300:
                region = "northwest"
            elif cx > 1140:
                region = "northeast"
        grouped[region].append(item)

    records = []
    for region, region_items in grouped.items():
        mask = Image.new("L", SIZE, 0)
        draw = ImageDraw.Draw(mask)
        for item in region_items:
            b = item["referenceBounds"]
            pad = 7 if item["category"] in {"building", "metro", "vehicle", "tree", "landmark"} else 4
            x0 = max(0, b["x"] - pad)
            y0 = max(0, b["y"] - pad)
            x1 = min(SIZE[0] - 1, b["x"] + b["w"] + pad)
            y1 = min(SIZE[1] - 1, b["y"] + b["h"] + pad)
            draw.rectangle((x0, y0, x1, y1), fill=255)
        # Close tiny gaps inside object clusters but keep the zones separate.
        mask = mask.filter(ImageFilter.MaxFilter(9))
        mask.save(out / f"{region}.png", optimize=True)
        prompt_rel = f"prompts/ground-restore-{region}.md"
        (prompts / f"ground-restore-{region}.md").write_text(
            "\n".join([
                "Use case: precise-object-edit",
                "Asset type: ground-only restoration patch for SoundMimic Village Urban v3",
                "Input images:",
                "- Image 1 is the accepted canonical clean map and edit target.",
                f"- Image 2 is the `{region}` object-removal mask; only white pixels may change.",
                "Primary request: remove every building, transit structure, vehicle, tree, prop, its cast shadow and local object glow inside the white mask; reconstruct only the asphalt, sidewalk, plaza paving, curb, lane marking, crosswalk, drainage and restrained wet-road reflection that logically continues from adjacent visible ground.",
                "Constraints: change only white-mask pixels; preserve every pixel outside; do not add buildings, objects, characters, UI, markers, text, logos or decorative substitutes; preserve the exact orthographic camera, pixel density, midnight palette, road geometry and paving scale.",
                "Output: the complete 1448x1086 map with the local ground-only restoration, no crop or resize.",
                "",
            ])
        )
        records.append({
            "id": region,
            "mask": f"ground/masks/{region}.png",
            "prompt": prompt_rel,
            "candidate": None,
            "status": "pending-imagegen",
            "inventoryIds": [item["id"] for item in region_items],
        })
    (V3 / "ground/removal-log.json").write_text(json.dumps({"version": 1, "regions": records}, indent=2) + "\n")
    # Required aggregate mask.
    aggregate = Image.new("L", SIZE, 0)
    for region in grouped:
        from PIL import ImageChops
        aggregate = ImageChops.lighter(aggregate, Image.open(out / f"{region}.png").convert("L"))
    aggregate.save(V3 / "ground/removal-mask.png", optimize=True)
    print(json.dumps({k: len(v) for k, v in grouped.items()}, indent=2))


if __name__ == "__main__":
    main()
