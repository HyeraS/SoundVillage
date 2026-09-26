#!/usr/bin/env python3
"""Build the non-destructive Phase A records for the Urban v3 reference.

This script only measures, masks, crops, and annotates the approved concept.  It
does not paint runtime art.  Coordinates are deliberately kept in the source
1448x1086 pixel space so referenceBounds and worldBounds are identical.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "design/concepts/urban-advanced-city-2026-09-01/02-midnight-metro-media-core.png"
OUT = ROOT / "public/assets/urban-city-v3"
REF_OUT = OUT / "reference"


def bounds(x: int, y: int, w: int, h: int) -> dict[str, int]:
    return {"x": x, "y": y, "w": w, "h": h}


items: list[dict] = []


def add(
    asset_id: str,
    category: str,
    b: tuple[int, int, int, int],
    *,
    layer: str = "y-sort",
    occluded_by: list[str] | None = None,
    extraction: str = "extract-visible-then-restore-hidden",
    collision: list[dict] | None = None,
    foreground: list[dict] | None = None,
) -> None:
    x, y, w, h = b
    rb = bounds(x, y, w, h)
    items.append({
        "id": asset_id,
        "category": category,
        "referenceBounds": rb,
        "worldBounds": dict(rb),
        "sourceCrop": f"sources/{asset_id}-reference-crop.png",
        "visiblePixelMask": f"masks/{asset_id}-visible-mask.png",
        "occludedBy": occluded_by or [],
        "layer": layer,
        "anchorX": x + w // 2,
        "anchorY": y + h,
        "collisionRects": collision or [],
        "foregroundRects": foreground or [],
        "productionMethod": extraction,
        "sourceFile": "reference/canonical-map-art-source.png",
        "promptFile": f"prompts/{asset_id}.md" if "restore" in extraction else None,
        "candidateFile": None,
        "acceptedRuntimeFile": None,
        "review": {"status": "identified", "rejectionReason": None},
    })


# Ground/decal regions. These are map-aligned layers, not substitute vector art.
for asset_id, b in [
    ("ground-road-base", (0, 58, 1448, 1028)),
    ("ground-central-pedestrian-spine", (615, 210, 214, 876)),
    ("ground-west-curved-road", (42, 310, 590, 756)),
    ("ground-east-curved-road", (820, 310, 583, 756)),
    ("ground-north-station-paving", (212, 194, 1015, 157)),
    ("ground-south-entrance-paving", (614, 850, 222, 236)),
    ("ground-west-media-plaza", (166, 497, 402, 165)),
    ("ground-east-food-plaza", (874, 507, 367, 157)),
    ("ground-southwest-plaza", (141, 908, 424, 87)),
    ("ground-southeast-transit-plaza", (875, 904, 505, 93)),
    ("ground-bus-bay", (1127, 540, 179, 259)),
]:
    add(asset_id, "ground", b, layer="ground", extraction="preserve-reference-pixels-and-restore-occluded-ground")

# Major architecture and edge façades.
for asset_id, b in [
    ("building-northwest-helipad-tower", (0, 58, 216, 365)),
    ("building-west-edge-north-facade", (0, 218, 66, 359)),
    ("building-west-edge-south-facade", (0, 579, 58, 406)),
    ("building-north-skyline-west-01", (216, 58, 136, 91)),
    ("building-north-skyline-west-02", (350, 58, 103, 91)),
    ("building-north-skyline-west-03", (451, 58, 101, 91)),
    ("building-north-media-screen", (552, 58, 262, 91)),
    ("building-north-skyline-east-01", (812, 58, 147, 91)),
    ("building-north-skyline-east-02", (957, 58, 128, 91)),
    ("building-north-skyline-east-03", (1083, 58, 126, 91)),
    ("building-northeast-curved-tower", (1207, 58, 190, 349)),
    ("building-east-edge-north-facade", (1394, 58, 54, 516)),
    ("building-east-edge-south-facade", (1381, 573, 67, 415)),
    ("building-west-media-office", (180, 345, 289, 188)),
    ("building-east-glass-food-court", (875, 345, 241, 231)),
    ("building-east-food-annex", (1110, 401, 149, 178)),
    ("building-southwest-culture-office", (170, 666, 374, 303)),
    ("building-southeast-cinema", (890, 669, 237, 302)),
]:
    add(asset_id, "building", b, layer="static", collision=[bounds(b[0] + 8, b[1] + b[3] - 34, max(1, b[2] - 16), 34)], foreground=[bounds(b[0], b[1] + b[3] - 55, b[2], 55)])

# Metro pieces and five train cars.
for asset_id, b, layer in [
    ("metro-west-deck", (210, 137, 401, 91), "static"),
    ("metro-station-deck", (608, 132, 219, 92), "static"),
    ("metro-east-deck", (823, 137, 406, 91), "static"),
    ("metro-station-canopy", (610, 137, 215, 77), "foreground"),
    ("metro-central-stairs", (669, 206, 108, 121), "ground"),
    ("metro-station-doors", (637, 171, 139, 45), "static"),
    ("metro-train-car-01-lead", (350, 142, 176, 49), "static"),
    ("metro-train-car-02", (523, 142, 173, 49), "static"),
    ("metro-train-car-03", (694, 141, 171, 50), "static"),
    ("metro-train-car-04", (863, 142, 171, 49), "static"),
    ("metro-train-car-05-tail", (1032, 142, 170, 49), "static"),
    ("metro-front-lip", (209, 191, 1021, 39), "foreground"),
    ("metro-pillars-and-shadow", (217, 207, 1003, 130), "shadow"),
]:
    add(asset_id, "metro", b, layer=layer, collision=[] if "stairs" in asset_id else [bounds(b[0], b[1] + b[3] - 15, b[2], 15)])

# Landmarks and media equipment.
for asset_id, b in [
    ("landmark-west-hologram-orb", (372, 516, 62, 93)),
    ("landmark-central-light-fountain", (689, 520, 62, 123)),
    ("landmark-west-satellite-dish", (272, 343, 54, 47)),
    ("landmark-cinema-film-reel", (986, 805, 44, 48)),
    ("media-sign-west-office", (354, 404, 77, 53)),
    ("media-sign-north-center", (653, 68, 139, 54)),
    ("media-sign-northeast", (1291, 238, 66, 79)),
    ("media-sign-food-north", (1001, 210, 112, 55)),
    ("media-sign-southwest", (281, 736, 77, 81)),
]:
    add(asset_id, "landmark", b, collision=[bounds(b[0] + b[2] // 4, b[1] + b[3] * 3 // 4, b[2] // 2, max(6, b[3] // 4))])

# Vehicles and mobility fixtures.
for asset_id, b in [
    ("vehicle-west-road-car", (120, 519, 36, 72)),
    ("vehicle-northeast-road-car", (1274, 429, 45, 64)),
    ("vehicle-southwest-car", (485, 839, 39, 74)),
    ("vehicle-east-electric-bus-01", (1154, 567, 49, 188)),
    ("vehicle-east-electric-bus-02", (1210, 568, 53, 190)),
    ("vehicle-southeast-blue-shuttle", (1253, 844, 80, 94)),
    ("vehicle-southeast-orange-shuttle", (1317, 855, 66, 82)),
    ("mobility-southwest-scooter-dock", (386, 902, 77, 48)),
    ("mobility-electric-charger-west", (370, 890, 18, 52)),
    ("mobility-traffic-controller-east", (1263, 760, 25, 66)),
]:
    add(asset_id, "vehicle", b, collision=[bounds(b[0] + 3, b[1] + 4, max(4, b[2] - 6), max(4, b[3] - 8))])

# Every visually distinct street-tree placement visible in the approved map.
tree_boxes = [
    (347,94,43,68),(475,94,45,68),(875,91,47,75),(1150,215,46,91),
    (345,232,48,90),(510,209,49,102),(847,216,47,92),(1138,214,47,94),
    (1325,336,44,96),(221,493,46,89),(485,483,45,100),(634,496,46,96),
    (761,493,45,96),(901,500,45,96),(1354,529,39,82),(638,665,47,104),
    (770,666,48,104),(545,842,51,113),(811,850,49,105),(1110,790,47,104),
    (69,955,56,111),(140,959,54,107),(212,954,57,112),(286,952,58,114),
    (360,951,58,115),(1121,951,55,111),(1195,954,55,108),(1265,954,57,109),
    (1339,954,55,109),(1406,958,42,104),
]
for index, b in enumerate(tree_boxes, 1):
    add(f"tree-{index:02d}", "tree", b, collision=[bounds(b[0] + b[2] // 3, b[1] + b[3] - 18, max(6, b[2] // 3), 18)], foreground=[bounds(*b)])

# Lamps, vertical kiosks and banner signs are individual placements.
lamp_boxes = [
    (397,248,14,64),(626,242,18,69),(790,239,17,72),(929,242,17,68),
    (78,427,17,69),(103,438,14,66),(545,382,16,74),(641,380,16,78),
    (790,378,17,79),(866,382,17,77),(1335,413,15,69),(74,590,14,66),
    (548,568,16,77),(641,568,16,77),(787,569,17,75),(865,566,17,80),
    (1134,550,16,71),(1325,573,15,67),(73,751,15,72),(550,748,15,75),
    (636,744,16,79),(786,744,16,78),(869,743,16,80),(1289,769,17,76),
    (1373,686,15,69),(590,914,16,76),(824,914,16,77),(1384,906,15,69),
]
for index, b in enumerate(lamp_boxes, 1):
    add(f"street-light-{index:02d}", "street-light", b, collision=[bounds(b[0] + 4, b[1] + b[3] - 10, max(4, b[2] - 8), 10)])

kiosk_boxes = [
    (301,259,31,51),(586,247,19,59),(642,270,20,59),(786,269,19,57),
    (1118,248,20,59),(98,364,20,57),(148,374,22,64),(530,382,19,60),
    (637,377,19,66),(786,376,19,66),(1121,378,19,65),(1334,369,21,65),
    (100,711,20,61),(558,696,20,64),(640,835,20,63),(783,835,20,63),
    (1094,779,20,67),(1288,769,20,69),(1372,704,20,66),
]
for index, b in enumerate(kiosk_boxes, 1):
    add(f"digital-kiosk-{index:02d}", "kiosk", b, collision=[bounds(b[0] + 4, b[1] + b[3] - 10, max(5, b[2] - 8), 10)])

# Planters, benches, outdoor furniture, railings, and small control boxes.
for category, boxes in {
    "planter": [
        (333,259,51,44),(512,259,48,43),(844,262,43,39),(1119,270,53,34),
        (1160,310,36,31),(1204,321,28,25),(208,532,41,45),(473,531,45,45),
        (627,555,55,57),(769,554,53,58),(896,558,71,55),(997,560,57,53),
        (201,892,50,51),(506,908,36,45),(889,910,44,52),(1072,906,50,56),
    ],
    "bench": [(269,532,48,21),(1110,530,48,20),(230,596,47,20),(1134,791,47,20)],
    "outdoor-table": [(1124,852,38,42),(1168,850,38,43),(1212,860,38,41),(1287,918,40,37),(1340,919,40,36)],
    "bollard": [(367,603,12,37),(424,599,12,39),(642,619,11,39),(788,621,11,38),(1090,603,12,39)],
    "control-box": [(513,287,14,21),(917,286,14,22),(342,502,16,31),(884,480,17,31),(1067,632,18,34),(1299,621,17,33)],
    "south-rail": [(0,1014,616,72),(832,1015,616,71)],
}.items():
    for index, b in enumerate(boxes, 1):
        layer = "foreground" if category == "south-rail" else "y-sort"
        add(f"{category}-{index:02d}", category, b, layer=layer, collision=[] if category == "south-rail" else [bounds(b[0], b[1] + b[3] - min(12, b[3]), b[2], min(12, b[3]))], foreground=[bounds(*b)] if category == "south-rail" else [])


def ensure_dirs() -> None:
    for relative in [
        "reference", "ground", "sources", "masks", "candidates", "accepted",
        "prompts", "accepted/buildings", "accepted/metro", "accepted/vehicles",
        "accepted/props", "accepted/foreground", "accepted/emissive", "accepted/shadows",
    ]:
        (OUT / relative).mkdir(parents=True, exist_ok=True)


def make_masks(reference: Image.Image) -> None:
    width, height = reference.size
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    # Exact UI/character/sound-marker areas; separated shapes are intentionally
    # retained as distinct restoration regions in restoration-log.json later.
    draw.rectangle((0, 0, width - 1, 64), fill=255)                # HUD + border/shadow
    draw.rectangle((0, 900, 151, 1048), fill=255)                  # D-pad + shadow
    draw.rounded_rectangle((665, 1013, 785, 1074), radius=10, fill=255)  # entrance + shadow
    draw.rectangle((685, 888, 754, 988), fill=255)                 # player + shadow
    for cx, cy, rx, ry in [
        (467, 263, 48, 53), (947, 263, 48, 53), (298, 585, 48, 53),
        (1105, 585, 48, 53), (322, 901, 48, 53), (1202, 901, 48, 53),
    ]:
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    mask.save(REF_OUT / "non-world-overlay-mask.png", optimize=True)

    evaluable = Image.new("L", (width, height), 255)
    evaluable.paste(0, mask=mask)
    evaluable.save(REF_OUT / "evaluable-art-mask.png", optimize=True)

    restoration_masks = OUT / "masks" / "restoration"
    restoration_masks.mkdir(parents=True, exist_ok=True)
    regions = {
        "hud": ("rectangle", (0, 0, width - 1, 64)),
        "d-pad": ("rectangle", (0, 900, 151, 1048)),
        "entrance-button": ("rounded", (665, 1013, 785, 1074)),
        "player": ("rectangle", (685, 888, 754, 988)),
        "sound-orb-northwest": ("ellipse", (419, 210, 515, 316)),
        "sound-orb-northeast": ("ellipse", (899, 210, 995, 316)),
        "sound-orb-west": ("ellipse", (250, 532, 346, 638)),
        "sound-orb-east": ("ellipse", (1057, 532, 1153, 638)),
        "sound-orb-southwest": ("ellipse", (274, 848, 370, 954)),
        "sound-orb-southeast": ("ellipse", (1154, 848, 1250, 954)),
    }
    log_entries = []
    for region_id, (shape, region) in regions.items():
        region_mask = Image.new("L", (width, height), 0)
        region_draw = ImageDraw.Draw(region_mask)
        if shape == "ellipse":
            region_draw.ellipse(region, fill=255)
        elif shape == "rounded":
            region_draw.rounded_rectangle(region, radius=8, fill=255)
        else:
            region_draw.rectangle(region, fill=255)
        mask_path = restoration_masks / f"{region_id}.png"
        region_mask.save(mask_path, optimize=True)
        prompt_path = OUT / "prompts" / f"restore-{region_id}.md"
        prompt_path.write_text(
            "\n".join([
                "Use case: precise-object-edit",
                "Asset type: canonical restoration patch for the SoundMimic Village Urban reference map",
                "Input images:",
                "- Image 1 is the finalized full-map positive composition/style reference and edit target.",
                f"- Image 2 is the binary restoration mask for `{region_id}`; white pixels are the only editable region.",
                "Primary request: Remove only the game overlay inside the white mask and reconstruct the world art that naturally continues from immediately adjacent pixels.",
                "Style and camera: preserve Image 1 exactly: orthographic top-down crisp 2D pixel art, identical pixel density, cool midnight navy/indigo/blue-gray palette, cyan glass and restrained warm windows.",
                "Constraints: change only white-mask pixels; do not alter any pixel outside the mask; preserve all roads, buildings, rails, trees, furniture, lighting, scale, and composition outside it; no UI, characters, sound markers, readable text, logo, watermark, blur, or checkerboard.",
                "Output: the complete 1448x1086 map image with the requested local restoration; no crop and no resize.",
                "Reject if any content outside the white mask changes or if the restored continuations do not align at the mask edge.",
                "",
            ])
        )
        log_entries.append({
            "id": region_id,
            "mask": str(mask_path.relative_to(OUT)),
            "prompt": str(prompt_path.relative_to(OUT)),
            "candidate": None,
            "acceptedPatch": None,
            "status": "pending-imagegen",
            "outsideMaskPixelIdentity": None,
        })
    (REF_OUT / "restoration-log.json").write_text(json.dumps({"version": 1, "entries": log_entries}, indent=2) + "\n")


def make_overlay(reference: Image.Image) -> None:
    overlay = reference.convert("RGBA")
    draw = ImageDraw.Draw(overlay, "RGBA")
    font = ImageFont.load_default()
    colors = {
        "ground": (70, 220, 255, 210), "building": (255, 108, 198, 220),
        "metro": (255, 206, 84, 220), "vehicle": (255, 126, 71, 220),
        "tree": (100, 240, 130, 220), "street-light": (255, 255, 180, 220),
        "landmark": (196, 130, 255, 230), "kiosk": (130, 210, 255, 220),
    }
    for index, item in enumerate(items, 1):
        b = item["referenceBounds"]
        color = colors.get(item["category"], (230, 230, 230, 200))
        x0, y0 = b["x"], b["y"]
        x1, y1 = x0 + b["w"] - 1, y0 + b["h"] - 1
        draw.rectangle((x0, y0, x1, y1), outline=color, width=1)
        label = f"{index}:{item['id']}"
        text_box = draw.textbbox((x0, y0), label, font=font)
        draw.rectangle((text_box[0] - 1, text_box[1] - 1, text_box[2] + 1, text_box[3] + 1), fill=(3, 8, 22, 205))
        draw.text((x0, y0), label, font=font, fill=color)
    overlay.save(REF_OUT / "reference-analysis-overlay.png", optimize=True)


def write_records(reference: Image.Image) -> None:
    width, height = reference.size
    inventory = {
        "version": 3,
        "positiveReference": str(REFERENCE.relative_to(ROOT)),
        "referencePixels": {"width": width, "height": height},
        "coordinateTransform": {"type": "identity", "scaleX": 1, "scaleY": 1, "offsetX": 0, "offsetY": 0},
        "overlayRegions": ["hud", "d-pad", "entrance-button", "player", "six-concept-sound-orbs"],
        "instanceCount": len(items),
        "instances": items,
    }
    (OUT / "inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n")

    layout = {
        "version": 3,
        "tileSize": None,
        "worldPixels": {"width": width, "height": height},
        "referenceTransform": inventory["coordinateTransform"],
        "spawn": {"x": 720, "y": 958},
        "exit": bounds(674, 1016, 104, 70),
        "centralWalkway": bounds(615, 210, 214, 876),
        "metroStairs": bounds(669, 206, 108, 121),
        "blockRegions": {
            "1": bounds(614, 651, 220, 365), "2": bounds(58, 650, 556, 366),
            "3": bounds(834, 650, 554, 366), "4": bounds(58, 310, 556, 340),
            "5": bounds(834, 310, 554, 340), "6": bounds(210, 59, 1020, 251),
        },
    }
    (OUT / "layout.json").write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n")

    manifest = {
        "version": 3,
        "generator": "OpenAI built-in image_gen plus reference-pixel-preserving mechanical extraction",
        "runtimeBaseUrl": "/assets/urban-city-v3/",
        "worldPixels": {"width": width, "height": height},
        "productionSwitched": False,
        "runtimeAssets": [],
        "inventoryFile": "inventory.json",
        "review": {"phase": "A", "status": "inventory-needs-human-overlay-review"},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    counts: dict[str, int] = {}
    for item in items:
        counts[item["category"]] = counts.get(item["category"], 0) + 1
    lines = [
        "# Urban City v3 — reference-exact asset plan", "",
        f"- Reference: `{REFERENCE.relative_to(ROOT)}` ({width}×{height})",
        "- Coordinate transform: identity (reference pixels are world pixels)",
        "- Product loader remains on v2 until every Gate 2 criterion passes.",
        f"- Identified placement instances: {len(items)}", "", "## Inventory counts", "",
    ]
    lines.extend(f"- {category}: {count}" for category, count in sorted(counts.items()))
    lines.extend([
        "", "## Phase status", "",
        "- Phase A files generated; analysis overlay requires direct visual review.",
        "- Phase B canonical restoration not started.",
        "- Phase C ground-only restoration not started.",
        "- Phase D accepted runtime sprites: 0.",
        "- v3 renderer activation: blocked until visual gates pass.", "",
        "## Production rules", "",
        "Visible source pixels are preserved; only overlay-hidden or object-hidden regions may be restored with built-in ImageGen. Distinct assets receive distinct calls. The full reference is never loaded as a single product background.",
    ])
    (OUT / "asset-plan.md").write_text("\n".join(lines) + "\n")


def main() -> None:
    ensure_dirs()
    reference = Image.open(REFERENCE).convert("RGB")
    make_masks(reference)
    make_overlay(reference)
    write_records(reference)
    print(json.dumps({"instances": len(items), "output": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
