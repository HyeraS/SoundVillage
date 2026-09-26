#!/usr/bin/env python3
"""Build the reference-registered Sound Archive Garden v4 asset set.

The 2896x2172 clean ImageGen master is the coordinate authority.  Runtime
terrain is split into twelve lossless 724px square panels, so the normal scene
never paints a synthetic path or references one monolithic background.  The
same master is also cropped into semantic landmark/environment/foreground
layers used for depth sorting and inspection.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "design/world-map-v4/source-assets"
SOURCE = SOURCE_DIR / "world-base-clean-reference.png"
HD_SOURCE = ROOT / "design/concepts/world-map-reskin-2026-09-18/02-sound-archive-garden-hd-master.png"
UNDERLAY_SOURCE = SOURCE_DIR / "terrain-underlay-imagegen.png"
PLAYER_HOME_SOURCE = SOURCE_DIR / "landmark-home-player-hub-v1.png"
OUTPUT = ROOT / "public/assets/world/sound-archive-garden-v4"
REVIEW = ROOT / "_review/world-map-reference-reconstruction-v4"
ASSET_MODULE = ROOT / "lib/worldMapV4Assets.mjs"

REFERENCE_SIZE = (2896, 2172)
HD_SIZE = (5792, 4344)
WORLD_SIZE = (3840, 2880)
PANEL = 724
HD_SCALE = 2

# Every semantic crop is expressed in reference pixels.  Polygon points are
# crop-local and intentionally include the landmark's authored garden/shadow.
LANDMARKS = {
    "landmark-home": ((285, 70, 900, 520), [(20, 50), (520, 30), (610, 180), (570, 395), (290, 445), (20, 365)]),
    "landmark-lab": ((1010, 0, 1950, 535), [(25, 0), (900, 0), (920, 370), (790, 520), (120, 520), (0, 370)]),
    "landmark-animal": ((2210, 65, 2896, 565), [(80, 20), (650, 0), (685, 420), (560, 495), (20, 430), (0, 160)]),
    "landmark-nature": ((0, 425, 725, 1465), [(0, 0), (600, 0), (720, 260), (665, 1000), (0, 1040)]),
    "landmark-library": ((865, 625, 2030, 1165), [(60, 10), (1090, 10), (1160, 410), (1020, 535), (120, 535), (0, 405)]),
    "landmark-urban": ((2310, 620, 2896, 1345), [(130, 0), (585, 0), (585, 725), (40, 725), (0, 250)]),
    "landmark-human": ((0, 1375, 900, 2110), [(0, 0), (720, 0), (895, 520), (760, 730), (0, 730)]),
    "landmark-music": ((2160, 1360, 2896, 2115), [(70, 0), (735, 0), (735, 755), (0, 755), (0, 210)]),
}

ENVIRONMENT = {
    "environment-north-forest": (0, 0, 2896, 430),
    "environment-west-stream-forest": (0, 380, 720, 1480),
    "environment-east-forest": (2180, 300, 2896, 1510),
    "environment-central-gardens": (650, 430, 2250, 1640),
    "environment-southwest-garden": (0, 1320, 1150, 2172),
    "environment-southeast-garden": (1800, 1280, 2896, 2172),
    "environment-south-center-garden": (1050, 1580, 1850, 1900),
    "environment-south-forest": (720, 1780, 2180, 2172),
}

FOREGROUND = {
    "foreground-south-gate": ((1100, 1840, 1835, 2172), [(0, 90), (180, 0), (555, 0), (735, 90), (735, 332), (0, 332)]),
}


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", optimize=True)


def masked_crop(source: Image.Image, box: tuple[int, int, int, int], polygon: list[tuple[int, int]]) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    mask = Image.new("L", crop.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    crop.putalpha(mask)
    return crop


def hd_box(box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(value * HD_SCALE for value in box)


def hd_polygon(polygon: list[tuple[int, int]]) -> list[tuple[int, int]]:
    return [(x * HD_SCALE, y * HD_SCALE) for x, y in polygon]


def asset_record(asset_id: str, filename: str, image: Image.Image, category: str, source_note: str) -> dict:
    return {
        "id": asset_id,
        "src": f"/assets/world/sound-archive-garden-v4/{filename}",
        "width": image.width,
        "height": image.height,
        "hasAlpha": image.mode == "RGBA",
        "category": category,
        "source": source_note,
        "generation": "exact crop from the ImageGen reference master",
    }


def build_contact_sheet(records: list[dict]) -> None:
    cards = []
    for record in records:
        if record["category"] == "terrain-panel":
            continue
        image = Image.open(OUTPUT / Path(record["src"]).name).convert("RGBA")
        image.thumbnail((360, 245), Image.Resampling.LANCZOS)
        card = Image.new("RGB", (390, 285), "#243426")
        checker = Image.new("RGB", image.size, "#dce5d5")
        draw = ImageDraw.Draw(checker)
        for y in range(0, image.height, 24):
            for x in range(0, image.width, 24):
                if (x // 24 + y // 24) % 2:
                    draw.rectangle((x, y, x + 23, y + 23), fill="#bdcbb6")
        checker.paste(image, (0, 0), image)
        card.paste(checker, ((390 - image.width) // 2, 8))
        ImageDraw.Draw(card).text((12, 258), record["id"], fill="white")
        cards.append(card)
    rows = (len(cards) + 2) // 3
    sheet = Image.new("RGB", (1170, rows * 285), "#152218")
    for index, card in enumerate(cards):
        sheet.paste(card, ((index % 3) * 390, (index // 3) * 285))
    sheet.save(REVIEW / "07-layer-contact-sheet.jpg", quality=92, optimize=True)


def build() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    if source.size != REFERENCE_SIZE:
        raise SystemExit(f"unexpected reference registration: {source.size}")
    hd_source = Image.open(HD_SOURCE).convert("RGB")
    if hd_source.size != HD_SIZE:
        raise SystemExit(f"unexpected HD registration: {hd_source.size}")

    underlay = Image.open(UNDERLAY_SOURCE).convert("RGB").resize(REFERENCE_SIZE, Image.Resampling.LANCZOS)
    underlay_hd = underlay.resize(HD_SIZE, Image.Resampling.LANCZOS)
    save_png(underlay_hd, OUTPUT / "terrain-underlay.png")

    records: list[dict] = [asset_record(
        "terrain-underlay", "terrain-underlay.png", underlay_hd, "source-underlay",
        "design/world-map-v4/source-assets/terrain-underlay-imagegen.png",
    )]
    panels = []
    reconstruction_hd = Image.new("RGB", HD_SIZE)
    for row in range(3):
        for col in range(4):
            left, top = col * PANEL, row * PANEL
            panel = underlay_hd.crop(hd_box((left, top, left + PANEL, top + PANEL)))
            asset_id = f"terrain-panel-{row}-{col}"
            filename = f"{asset_id}.png"
            save_png(panel, OUTPUT / filename)
            record = asset_record(asset_id, filename, panel, "terrain-panel", "terrain-underlay-imagegen.png")
            record.update({"referenceX": left, "referenceY": top})
            records.append(record)
            panels.append({"id": asset_id, "x": left, "y": top, "width": PANEL, "height": PANEL})
            reconstruction_hd.paste(panel, (left * HD_SCALE, top * HD_SCALE))

    semantic = []
    for asset_id, (box, polygon) in LANDMARKS.items():
        image = masked_crop(hd_source, hd_box(box), hd_polygon(polygon))
        filename = f"{asset_id}.png"
        save_png(image, OUTPUT / filename)
        records.append(asset_record(asset_id, filename, image, "landmark", f"HD reference crop {hd_box(box)}"))
        semantic.append({"id": asset_id, "category": "landmark", "box": list(box), "sortReferenceY": box[3] - 18})

    player_home = Image.open(PLAYER_HOME_SOURCE).convert("RGBA")
    player_home = player_home.crop(player_home.getbbox())
    save_png(player_home, OUTPUT / "landmark-home-hub.png")
    records.append(asset_record(
        "landmark-home-hub",
        "landmark-home-hub.png",
        player_home,
        "landmark",
        "design/world-map-v4/source-assets/landmark-home-player-hub-v1.png",
    ))
    semantic.append({
        "id": "landmark-home-hub",
        "category": "landmark",
        "worldBox": [1440, 1368, 1888, 1752],
        "sortWorldY": 1752,
    })

    for asset_id, box in ENVIRONMENT.items():
        image = hd_source.crop(hd_box(box)).convert("RGBA")
        filename = f"{asset_id}.png"
        save_png(image, OUTPUT / filename)
        records.append(asset_record(asset_id, filename, image, "environment-cluster", f"HD reference crop {hd_box(box)}"))
        semantic.append({"id": asset_id, "category": "environment", "box": list(box), "sortReferenceY": 0})
        reconstruction_hd.paste(image.convert("RGB"), (box[0] * HD_SCALE, box[1] * HD_SCALE))

    for asset_id, (box, polygon) in FOREGROUND.items():
        image = masked_crop(hd_source, hd_box(box), hd_polygon(polygon))
        filename = f"{asset_id}.png"
        save_png(image, OUTPUT / filename)
        records.append(asset_record(asset_id, filename, image, "foreground", f"HD reference crop {hd_box(box)}"))
        semantic.append({"id": asset_id, "category": "foreground", "box": list(box), "sortReferenceY": 999999})

    for asset_id, (box, polygon) in LANDMARKS.items():
        image = Image.open(OUTPUT / f"{asset_id}.png").convert("RGBA")
        reconstruction_hd.paste(image.convert("RGB"), (box[0] * HD_SCALE, box[1] * HD_SCALE), image.getchannel("A"))
    for asset_id, (box, polygon) in FOREGROUND.items():
        image = Image.open(OUTPUT / f"{asset_id}.png").convert("RGBA")
        reconstruction_hd.paste(image.convert("RGB"), (box[0] * HD_SCALE, box[1] * HD_SCALE), image.getchannel("A"))

    reconstruction = reconstruction_hd.resize(REFERENCE_SIZE, Image.Resampling.BOX)

    manifest = {
        "version": 4,
        "reference": {"width": REFERENCE_SIZE[0], "height": REFERENCE_SIZE[1]},
        "world": {"width": WORLD_SIZE[0], "height": WORLD_SIZE[1]},
        "scale": {"x": WORLD_SIZE[0] / REFERENCE_SIZE[0], "y": WORLD_SIZE[1] / REFERENCE_SIZE[1]},
        "source": "design/concepts/world-map-reskin-2026-09-18/02-sound-archive-garden-hd-master.png",
        "panels": panels,
        "semanticLayers": semantic,
        "assets": records,
    }
    (OUTPUT / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    lines = [
        "// Generated by scripts/build-world-map-v4-assets.py. Do not edit by hand.",
        "export const WORLD_MAP_V4_ASSETS = Object.freeze({",
    ]
    for record in records:
        lines.append(
            f"  {json.dumps(record['id'])}: Object.freeze({{ src: {json.dumps(record['src'])}, width: {record['width']}, height: {record['height']}, hasAlpha: {str(record['hasAlpha']).lower()}, category: {json.dumps(record['category'])} }}),"
        )
    lines.extend(["})", "", "export const WORLD_MAP_V4_ASSET_IDS = Object.freeze(Object.keys(WORLD_MAP_V4_ASSETS))", ""])
    ASSET_MODULE.write_text("\n".join(lines), encoding="utf-8")

    save_png(source, REVIEW / "01-reference.png")
    save_png(reconstruction, REVIEW / "02-runtime-reconstruction.png")
    side = Image.new("RGB", (REFERENCE_SIZE[0] * 2, REFERENCE_SIZE[1]))
    side.paste(source, (0, 0))
    side.paste(reconstruction, (REFERENCE_SIZE[0], 0))
    side.resize((1600, 600), Image.Resampling.LANCZOS).save(REVIEW / "03-reference-vs-reconstruction.jpg", quality=94)
    Image.blend(source, reconstruction, 0.5).save(REVIEW / "04-overlay-50.png", optimize=True)
    difference = ImageChops.difference(source, reconstruction)
    heat = ImageOps.colorize(ImageEnhance.Contrast(ImageOps.grayscale(difference)).enhance(12), "#08111f", "#ff5035")
    save_png(heat, REVIEW / "05-diff-heatmap.png")
    underlay.resize((1448, 1086), Image.Resampling.LANCZOS).save(REVIEW / "06-terrain-underlay.png", optimize=True)

    coordinate = source.copy().resize((1448, 1086), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(coordinate, "RGBA")
    for item in semantic:
        if "box" in item:
            left, top, right, bottom = [value / 2 for value in item["box"]]
        else:
            # Convert authored world coordinates back to the half-size
            # reference review surface used by this overlay.
            left, right = [value / WORLD_SIZE[0] * 1448 for value in (item["worldBox"][0], item["worldBox"][2])]
            top, bottom = [value / WORLD_SIZE[1] * 1086 for value in (item["worldBox"][1], item["worldBox"][3])]
        color = (55, 225, 255, 220) if item["category"] == "landmark" else (255, 210, 62, 180)
        draw.rectangle((left, top, right, bottom), outline=color, width=3)
        draw.rectangle((left, top, min(right, left + 240), top + 18), fill=(10, 20, 15, 195))
        draw.text((left + 4, top + 3), item["id"], fill="white")
    coordinate.save(REVIEW / "08-coordinate-overlay.png", optimize=True)
    build_contact_sheet(records)

    error = sum(ImageStat.Stat(difference).mean) / 3
    hd_difference = ImageChops.difference(hd_source, reconstruction_hd)
    metrics = {
        "status": "PASS" if hd_difference.getbbox() is None and error <= 3 else "FAIL",
        "referenceSize": list(REFERENCE_SIZE),
        "hdRuntimeSize": list(HD_SIZE),
        "reconstructionSize": list(reconstruction.size),
        "meanRgbAbsoluteError255": error,
        "differentPixelBounds": difference.getbbox(),
        "hdMasterMeanRgbAbsoluteError255": sum(ImageStat.Stat(hd_difference).mean) / 3,
        "hdMasterDifferentPixelBounds": hd_difference.getbbox(),
        "terrainPanelCount": len(panels),
        "semanticLayerCount": len(semantic),
        "assetCount": len(records),
        "coordinateTransform": "worldX=referenceX*(3840/2896); worldY=referenceY*(2880/2172)",
    }
    (REVIEW / "visual-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    (REVIEW / "asset-inventory.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    build()
