#!/usr/bin/env python3
"""Build the step-0 home-integration review plates without touching runtime assets."""

from __future__ import annotations

import json
import math
import textwrap
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / "design/world-map-v4/source-assets/landmark-home-player-hub-v1.png"
WORLD_SOURCE = ROOT / "design/world-map-v4/source-assets/world-base-clean-reference.png"
RUNTIME = ROOT / "public/assets/world/sound-archive-garden-v4/runtime"

TILE = 32
WORLD_SIZE = (3840, 2880)
CURRENT_BOX = (1440, 1368, 1888, 1752)
RECOMMENDED_VISUAL = (1488, 1395, 1840, 1696)
RECOMMENDED_SITE = (1440, 1344, 1856, 1824)
CORE_SITE = (1440, 1344, 1792, 1824)
SEAM_PATCH = (1792, 1664, 1856, 1792)
FOOTPRINT = (1536, 1472, 1792, 1696)
GROUND_CONTACT = (1664, 1696)
DOOR_POINT = (1664, 1760)
APPROACH_POINT = (1664, 1760)
ROAD_CONNECTION = (1824, 1760)
APPROACH_RECTS = (
    (1632, 1696, 1696, 1792),
    (1632, 1728, 1792, 1792),
    (1792, 1696, 1856, 1792),
)

FONT_REGULAR_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD_PATH if bold else FONT_REGULAR_PATH
    return ImageFont.truetype(path, size)


def alpha_bbox(image: Image.Image, threshold: int) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(alpha > threshold)
    if not len(xs):
        raise ValueError(f"No alpha above {threshold}")
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def bbox_record(box: tuple[int, int, int, int]) -> dict[str, int]:
    left, top, right, bottom = box
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "width": right - left,
        "height": bottom - top,
    }


def edge_metrics(image: Image.Image, alpha_threshold: int = 16) -> dict[str, float | int]:
    pixels = np.asarray(image.convert("RGBA")).astype(np.float32)
    luminance = pixels[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    alpha = pixels[:, :, 3]
    gx = np.zeros_like(luminance)
    gy = np.zeros_like(luminance)
    gx[:, 1:-1] = (luminance[:, 2:] - luminance[:, :-2]) / 2
    gy[1:-1, :] = (luminance[2:, :] - luminance[:-2, :]) / 2
    magnitude = np.hypot(gx, gy)
    visible = alpha > alpha_threshold
    return {
        "alphaThreshold": alpha_threshold,
        "meanBoundaryStrength255": round(float(magnitude[visible].mean()), 4),
        "strongEdgeThreshold255": 48,
        "strongEdgeRatio": round(float((magnitude[visible] >= 48).mean()), 6),
        "detailEdgeThreshold255": 32,
        "detailEdgeRatio": round(float((magnitude[visible] >= 32).mean()), 6),
        "visiblePixelCount": int(visible.sum()),
    }


def rgb_edge_metrics(image: Image.Image) -> dict[str, float | int]:
    rgba = image.convert("RGBA")
    rgba.putalpha(255)
    return edge_metrics(rgba, 16)


def checker(size: tuple[int, int], cell: int = 20) -> Image.Image:
    width, height = size
    result = Image.new("RGB", size, "#dfe5e1")
    draw = ImageDraw.Draw(result)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#f5f7f4")
    return result.convert("RGBA")


def color_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def title(draw: ImageDraw.ImageDraw, heading: str, subtitle: str, width: int) -> None:
    draw.text((36, 24), heading, fill="#16251d", font=font(34, True))
    draw.text((36, 66), subtitle, fill="#53665c", font=font(18))
    draw.line((36, 96, width - 36, 96), fill="#b8c5bd", width=2)


def draw_world_grid(draw: ImageDraw.ImageDraw, crop: tuple[int, int, int, int], scale: float, origin: tuple[int, int]) -> None:
    left, top, right, bottom = crop
    ox, oy = origin
    for x in range(math.ceil(left / TILE) * TILE, right + 1, TILE):
        px = ox + round((x - left) * scale)
        major = x % 128 == 0
        draw.line((px, oy, px, oy + round((bottom - top) * scale)), fill=(40, 117, 128, 110 if major else 48), width=2 if major else 1)
        if major:
            draw.text((px + 3, oy + 3), str(x), fill="#17424a", font=font(12, True))
    for y in range(math.ceil(top / TILE) * TILE, bottom + 1, TILE):
        py = oy + round((y - top) * scale)
        major = y % 128 == 0
        draw.line((ox, py, ox + round((right - left) * scale), py), fill=(40, 117, 128, 110 if major else 48), width=2 if major else 1)
        if major:
            draw.text((ox + 3, py + 3), str(y), fill="#17424a", font=font(12, True))


def map_box(box: tuple[int, int, int, int], crop: tuple[int, int, int, int], scale: float, origin: tuple[int, int]) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    cx, cy, _, _ = crop
    ox, oy = origin
    return (
        ox + round((left - cx) * scale),
        oy + round((top - cy) * scale),
        ox + round((right - cx) * scale),
        oy + round((bottom - cy) * scale),
    )


def map_point(point: tuple[int, int], crop: tuple[int, int, int, int], scale: float, origin: tuple[int, int]) -> tuple[int, int]:
    x, y = point
    cx, cy, _, _ = crop
    ox, oy = origin
    return ox + round((x - cx) * scale), oy + round((y - cy) * scale)


source = Image.open(SOURCE).convert("RGBA")
source_bounds = {threshold: alpha_bbox(source, threshold) for threshold in (0, 8, 16)}
clean = source.crop(source_bounds[8])
runtime_home = Image.open(RUNTIME / "landmark-home-hub.webp").convert("RGBA")
guesthouse = Image.open(RUNTIME / "landmark-home.webp").convert("RGBA")
library = Image.open(RUNTIME / "landmark-library.webp").convert("RGBA")
runtime_bounds = {threshold: alpha_bbox(runtime_home, threshold) for threshold in (0, 8, 16)}
candidate_352 = clean.resize((352, 301), Image.Resampling.LANCZOS)
candidate_448 = clean.resize((448, 383), Image.Resampling.LANCZOS)
world = Image.open(WORLD_SOURCE).convert("RGB").resize(WORLD_SIZE, Image.Resampling.LANCZOS).convert("RGBA")

# Browser screenshots can arrive as JPEG bytes even when the requested filename
# uses .png. Normalize the review capture to an actual PNG container.
current_capture = OUT / "01-current-world.png"
if current_capture.exists():
    with Image.open(current_capture) as capture:
        capture.convert("RGB").save(current_capture, format="PNG", optimize=True)


# 02 — alpha bounds
canvas = Image.new("RGB", (1380, 930), "#f4f1e8")
draw = ImageDraw.Draw(canvas, "RGBA")
title(draw, "02  Alpha bounds", "Meaningful opacity stabilizes at alpha > 8; alpha > 0 is noise-driven.", canvas.width)
scale = min(1040 / source.width, 780 / source.height)
preview_size = (round(source.width * scale), round(source.height * scale))
preview = checker(preview_size, 16)
preview.alpha_composite(source.resize(preview_size, Image.Resampling.LANCZOS))
origin = (34, 120)
canvas.paste(preview.convert("RGB"), origin)
colors = {0: "#ef445b", 8: "#00a9c6", 16: "#f3b61f"}
for threshold in (0, 8, 16):
    box = source_bounds[threshold]
    mapped = tuple(origin[i % 2] + round(box[i] * scale) for i in range(4))
    draw.rectangle(mapped, outline=colors[threshold], width=5 if threshold != 16 else 3)
legend_x = 1090
draw.rounded_rectangle((1068, 126, 1344, 544), radius=18, fill="#ffffffee", outline="#c8d1cb", width=2)
draw.text((legend_x, 150), "SOURCE", fill="#25372d", font=font(18, True))
draw.text((legend_x, 178), f"{source.width} x {source.height} RGBA", fill="#5a6d62", font=font(16))
for index, threshold in enumerate((0, 8, 16)):
    y = 235 + index * 82
    record = bbox_record(source_bounds[threshold])
    draw.line((legend_x, y + 12, legend_x + 34, y + 12), fill=colors[threshold], width=6)
    draw.text((legend_x + 46, y), f"alpha > {threshold}", fill="#22352a", font=font(17, True))
    draw.text((legend_x + 46, y + 28), f"{record['width']} x {record['height']}", fill="#52655a", font=font(16))
draw.rounded_rectangle((1068, 576, 1344, 820), radius=18, fill="#173d35", outline="#173d35")
draw.text((1090, 600), "DECISION", fill="white", font=font(17, True))
draw.text((1090, 640), "Crop with alpha > 8.", fill="white", font=font(17))
draw.text((1090, 676), "The >8 and >16 boxes", fill="#cce4db", font=font(15))
draw.text((1090, 700), "differ by only 1 px in y.", fill="#cce4db", font=font(15))
draw.text((1090, 748), "Do not use getbbox()", fill="#ffd29a", font=font(15, True))
draw.text((1090, 772), "on unthresholded alpha.", fill="#ffd29a", font=font(15, True))
canvas.save(OUT / "02-alpha-bounds.png", optimize=True)


# 03 — size comparison on the same world crop
comparison_crop = (1360, 1260, 1952, 1900)
crop_bg = world.crop(comparison_crop)
panels = []

current = world.copy()
current.alpha_composite(runtime_home, (CURRENT_BOX[0], CURRENT_BOX[1]))
panels.append(("A  CURRENT", "323 x 301 visible", current.crop(comparison_crop), edge_metrics(runtime_home)))

recommended = world.copy()
recommended.alpha_composite(candidate_352, (RECOMMENDED_VISUAL[0], RECOMMENDED_VISUAL[1]))
panels.append(("B  RECOMMENDED", "352 x 301, ratio restored", recommended.crop(comparison_crop), edge_metrics(candidate_352)))

large_box = (1440, 1313, 1888, 1696)
large = world.copy()
large.alpha_composite(candidate_448, (large_box[0], large_box[1]))
panels.append(("C  BOX-FILL", "448 x 383, too dominant", large.crop(comparison_crop), edge_metrics(candidate_448)))

canvas = Image.new("RGB", (1740, 790), "#f4f1e8")
draw = ImageDraw.Draw(canvas, "RGBA")
title(draw, "03  Size comparison", "Same background and near-identical bottom-center reference; no new art is introduced.", canvas.width)
panel_w = 540
for index, (label, dimensions, image, metrics) in enumerate(panels):
    x = 35 + index * 565
    draw.rounded_rectangle((x, 120, x + panel_w, 748), radius=18, fill="white", outline="#c9d0cc", width=2)
    draw.text((x + 20, 140), label, fill="#193429", font=font(22, True))
    draw.text((x + 20, 174), dimensions, fill="#596c61", font=font(17))
    shown = image.resize((500, 540), Image.Resampling.LANCZOS)
    canvas.paste(shown.convert("RGB"), (x + 20, 212))
    ratio = {0: "-8.25% aspect error", 1: "-0.01% aspect error", 2: "+0.02% aspect error"}[index]
    draw.rounded_rectangle((x + 28, 686, x + 512, 736), radius=12, fill="#132f29dd")
    draw.text((x + 44, 696), ratio, fill="white", font=font(15, True))
    draw.text((x + 260, 696), f"strong edge {metrics['strongEdgeRatio'] * 100:.2f}%", fill="#ffe0a7", font=font(15, True))
canvas.save(OUT / "03-size-comparison.png", optimize=True)


# 04 — site overlay
overlay_crop = (1328, 1280, 1952, 1888)
scale = 1.28
origin = (34, 124)
preview = world.crop(overlay_crop).resize((round((overlay_crop[2] - overlay_crop[0]) * scale), round((overlay_crop[3] - overlay_crop[1]) * scale)), Image.Resampling.LANCZOS)
canvas = Image.new("RGB", (1280, 950), "#f4f1e8")
canvas.paste(preview.convert("RGB"), origin)
draw = ImageDraw.Draw(canvas, "RGBA")
title(draw, "04  Recommended site and coordinate model", "World pixels; 32 px navigation tile. Overlay is design-only.", canvas.width)
draw_world_grid(draw, overlay_crop, scale, origin)

draw.rectangle(map_box(CORE_SITE, overlay_crop, scale, origin), fill=(21, 126, 168, 55), outline="#147ea8", width=4)
draw.rectangle(map_box(SEAM_PATCH, overlay_crop, scale, origin), fill=(59, 160, 207, 72), outline="#2d99c4", width=3)
for rect in APPROACH_RECTS:
    draw.rectangle(map_box(rect, overlay_crop, scale, origin), fill=(53, 190, 111, 115), outline="#1a9458", width=2)
draw.rectangle(map_box(RECOMMENDED_VISUAL, overlay_crop, scale, origin), outline="#ff8d2a", width=5)
draw.rectangle(map_box(FOOTPRINT, overlay_crop, scale, origin), fill=(213, 61, 76, 50), outline="#d43d4c", width=4)

for point, color, radius in ((GROUND_CONTACT, "#ffdd47", 7), (DOOR_POINT, "#b11fe1", 7), (ROAD_CONNECTION, "#27f0bd", 7)):
    px, py = map_point(point, overlay_crop, scale, origin)
    draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=color, outline="#14271f", width=2)

side_x = 868
draw.rounded_rectangle((846, 124, 1246, 892), radius=20, fill="#fffefaee", outline="#c5cec8", width=2)
draw.text((side_x, 150), "APPROVED COORDINATE SET", fill="#173b30", font=font(19, True))
entries = [
    ("siteBounds", "[1440,1344] - [1856,1824]", "#147ea8"),
    ("core site", "[1440,1344] - [1792,1824]", "#147ea8"),
    ("road seam", "[1792,1664] - [1856,1792]", "#2d99c4"),
    ("visualBox", "[1488,1395] - [1840,1696]", "#ff8d2a"),
    ("footprint / collision", "[1536,1472] - [1792,1696]", "#d43d4c"),
    ("groundContact", "(1664,1696)", "#c69a00"),
    ("door / approach", "(1664,1760)", "#b11fe1"),
    ("road connection", "(1824,1760)", "#008a6b"),
    ("sortY", "1696", "#243b31"),
]
for index, (name, value, color) in enumerate(entries):
    y = 202 + index * 60
    draw.rectangle((side_x, y + 3, side_x + 18, y + 21), fill=color)
    draw.text((side_x + 30, y), name, fill="#263a31", font=font(16, True))
    draw.text((side_x + 30, y + 25), value, fill="#5b6c63", font=font(15))
draw.rounded_rectangle((side_x, 760, 1222, 858), radius=12, fill="#e7f6ed", outline="#99c8ad")
draw.text((side_x + 16, 778), "Access path mask: 64 px minimum", fill="#17613d", font=font(15, True))
draw.text((side_x + 16, 804), "continuous to the existing main road.", fill="#17613d", font=font(15))
canvas.save(OUT / "04-site-overlay.png", optimize=True)


# 05 — background conflicts
conflict_crop = (1280, 1248, 1952, 1888)
scale = 1.22
origin = (34, 124)
preview = world.crop(conflict_crop).resize((round((conflict_crop[2] - conflict_crop[0]) * scale), round((conflict_crop[3] - conflict_crop[1]) * scale)), Image.Resampling.LANCZOS)
canvas = Image.new("RGB", (1370, 950), "#f4f1e8")
canvas.paste(preview.convert("RGB"), origin)
draw = ImageDraw.Draw(canvas, "RGBA")
title(draw, "05  Background conflicts", "Remove overlap from the core lot; retain the plaza and mature perimeter outside it.", canvas.width)

conflicts = [
    (1, "MOVE", "north inner bench", (1504, 1328, 1664, 1416), "#f3a11a"),
    (2, "REMOVE", "potted topiary behind facade", (1616, 1376, 1696, 1496), "#e64555"),
    (3, "MOVE", "west inner bench", (1432, 1496, 1584, 1608), "#f3a11a"),
    (4, "REMOVE", "small path light / shrub cluster", (1536, 1568, 1616, 1664), "#e64555"),
    (5, "REMOVE", "curved wall + flowerbed + shrubs", (1432, 1600, 1792, 1816), "#e64555"),
    (6, "MOVE", "west plaza lamp to path edge", (1728, 1568, 1808, 1816), "#f3a11a"),
    (7, "KEEP", "main plaza and north/south road", (1792, 1280, 1952, 1888), "#2a9d63"),
    (8, "KEEP", "outer west vegetation / ring path", (1280, 1440, 1432, 1888), "#2a9d63"),
]
for number, action, _, box, color in conflicts:
    mapped = map_box(box, conflict_crop, scale, origin)
    draw.rectangle(mapped, fill=(*color_rgb(color), 42), outline=color, width=4)
    draw.ellipse((mapped[0] + 5, mapped[1] + 5, mapped[0] + 35, mapped[1] + 35), fill=color, outline="white", width=2)
    draw.text((mapped[0] + 14, mapped[1] + 8), str(number), anchor="ma", fill="white", font=font(15, True))

side_x = 892
draw.rounded_rectangle((866, 124, 1338, 900), radius=20, fill="#fffefaee", outline="#c5cec8", width=2)
draw.text((side_x, 148), "DISPOSITION", fill="#173b30", font=font(19, True))
for index, (number, action, name, _, color) in enumerate(conflicts):
    y = 194 + index * 79
    draw.ellipse((side_x, y, side_x + 28, y + 28), fill=color)
    draw.text((side_x + 14, y + 4), str(number), anchor="ma", fill="white", font=font(14, True))
    draw.text((side_x + 40, y - 1), action, fill=color, font=font(14, True))
    draw.text((side_x + 40, y + 24), name, fill="#34483e", font=font(15))
draw.rounded_rectangle((side_x, 846, 1312, 884), radius=10, fill="#223c33")
draw.text((side_x + 14, 855), "No double fence / bed / shrub inside site.", fill="white", font=font(14, True))
canvas.save(OUT / "05-background-conflicts.png", optimize=True)


# 06 — layer plan diagram
canvas = Image.new("RGB", (1450, 940), "#f4f1e8")
draw = ImageDraw.Draw(canvas, "RGBA")
title(draw, "06  Layer plan", "Ownership is split by visual responsibility, not by one oversized transparent sprite.", canvas.width)

layers = [
    ("home-foreground", "OPTIONAL / DEPTH-SORTED", "Only pixels that must cover the player: front fence tops, tall lamp crown, foreground shrub tips.", "#7e57c2"),
    ("home-building", "DEPTH-SORTED", "House body, front door, porch, and minimum steps. No fence, bed, shrub, path, or baked contact shadow.", "#e6782f"),
    ("home-site-ground", "BELOW ACTORS", "Repainted grass/soil, 64 px access path, low fence/flowerbed/shrubs, and world-matched contact shadow.", "#2d9c66"),
    ("world terrain + road", "EXISTING", "Central plaza and north/south road remain authoritative; the seam patch blends into them.", "#3687a8"),
]
for index, (name, phase, description, color) in enumerate(layers):
    y = 140 + index * 150
    draw.rounded_rectangle((70, y, 900, y + 112), radius=18, fill="white", outline=color, width=4)
    draw.rounded_rectangle((90, y + 20, 310, y + 62), radius=12, fill=color)
    draw.text((200, y + 31), name, anchor="ma", fill="white", font=font(17, True))
    draw.text((340, y + 18), phase, fill=color, font=font(14, True))
    wrapped = "\n".join(textwrap.wrap(description, width=55))
    draw.multiline_text((340, y + 45), wrapped, fill="#34483e", font=font(16), spacing=5)
    if index < len(layers) - 1:
        draw.polygon(((475, y + 122), (455, y + 142), (495, y + 142)), fill="#788a80")

draw.rounded_rectangle((960, 140, 1390, 850), radius=22, fill="#173d35", outline="#173d35")
draw.text((990, 170), "home-site metadata", fill="white", font=font(21, True))
metadata = [
    ("visualBox", "art visibility / culling"),
    ("groundContact", "bottom-center art anchor"),
    ("footprint", "ground-plane occupied area"),
    ("collision", "must match footprint <= 16 px"),
    ("doorPoint", "visible entrance ground point"),
    ("approachPoint", "interaction point; <= 8 px"),
    ("sortY", "groundContact.y = 1696"),
    ("siteBounds", "ground ownership / conflict mask"),
]
for index, (name, meaning) in enumerate(metadata):
    y = 225 + index * 70
    draw.text((990, y), name, fill="#ffda9d", font=font(16, True))
    draw.text((990, y + 28), meaning, fill="#d8e9e3", font=font(15))
draw.rounded_rectangle((990, 785, 1360, 825), radius=10, fill="#2c5d50")
draw.text((1006, 795), "One metadata source of truth", fill="white", font=font(15, True))
canvas.save(OUT / "06-layer-plan.png", optimize=True)


# Findings — measured values and the proposed design coordinate set.
source_aspect = (source_bounds[8][2] - source_bounds[8][0]) / (source_bounds[8][3] - source_bounds[8][1])
current_visible = runtime_bounds[8]
current_visible_world = (
    CURRENT_BOX[0] + current_visible[0],
    CURRENT_BOX[1] + current_visible[1],
    CURRENT_BOX[0] + current_visible[2],
    CURRENT_BOX[1] + current_visible[3],
)

garden_sample_box = (1280, 1536, 1792, 2048)
plaza_sample_box = (1792, 1408, 2112, 1792)

findings = {
    "schemaVersion": 1,
    "scope": "design-and-measurement-only; no production code, runtime asset, or collision mutation",
    "coordinateSystem": {"unit": "world pixel", "tileSize": TILE, "worldSize": list(WORLD_SIZE), "origin": "top-left"},
    "sourceAsset": {
        "path": "design/world-map-v4/source-assets/landmark-home-player-hub-v1.png",
        "size": [source.width, source.height],
        "alphaBounds": {str(threshold): bbox_record(box) for threshold, box in source_bounds.items()},
        "selectedCropThreshold": 8,
        "selectedCropAspect": round(source_aspect, 6),
        "reason": "alpha > 8 and alpha > 16 differ by only one row; alpha > 0 expands to noise at the canvas edges",
    },
    "currentRuntime": {
        "declaredWorldBox": bbox_record(CURRENT_BOX),
        "runtimeAssetSize": [runtime_home.width, runtime_home.height],
        "runtimeAlphaBounds": {str(threshold): bbox_record(box) for threshold, box in runtime_bounds.items()},
        "visibleWorldBoundsAlphaGt8": bbox_record(current_visible_world),
        "visibleSizeAlphaGt8": [current_visible[2] - current_visible[0], current_visible[3] - current_visible[1]],
        "visibleBottomCenterAlphaGt8": [round((current_visible_world[0] + current_visible_world[2]) / 2, 1), current_visible_world[3]],
        "declaredSortY": 1752,
        "declaredApproachPoint": [1664, 1792],
        "declaredCollisionBounds": {"left": 1536, "top": 1472, "right": 1792, "bottom": 1752, "width": 256, "height": 280},
        "aspectDistortionPercent": round(((current_visible[2] - current_visible[0]) / (current_visible[3] - current_visible[1]) / source_aspect - 1) * 100, 4),
        "edgeMetrics": edge_metrics(runtime_home),
    },
    "sizeCandidates": {
        "currentDistorted": {"visibleSize": [323, 301], "aspect": round(323 / 301, 6), "aspectErrorPercent": round((323 / 301 / source_aspect - 1) * 100, 4), "edgeMetrics": edge_metrics(runtime_home)},
        "recommended": {"visibleSize": [352, 301], "aspect": round(352 / 301, 6), "aspectErrorPercent": round((352 / 301 / source_aspect - 1) * 100, 4), "edgeMetricsUsingExistingArt": edge_metrics(candidate_352)},
        "boxFill": {"visibleSize": [448, 383], "aspect": round(448 / 383, 6), "aspectErrorPercent": round((448 / 383 / source_aspect - 1) * 100, 4), "edgeMetricsUsingExistingArt": edge_metrics(candidate_448)},
    },
    "comparators": {
        "guesthouse": {"runtimeAssetSize": [guesthouse.width, guesthouse.height], "alphaBoundsGt16": bbox_record(alpha_bbox(guesthouse, 16)), "edgeMetrics": edge_metrics(guesthouse), "role": "small-building scale and low-frequency facade detail"},
        "library": {"runtimeAssetSize": [library.width, library.height], "alphaBoundsGt16": bbox_record(alpha_bbox(library, 16)), "edgeMetrics": edge_metrics(library), "role": "roof/facade edge weight, contact shadow, and plaza integration"},
        "centralGardenWestSample": {"worldRect": bbox_record(garden_sample_box), "edgeMetrics": rgb_edge_metrics(world.crop(garden_sample_box)), "role": "ground texture, vegetation density, and shadow palette"},
        "centralPlazaSample": {"worldRect": bbox_record(plaza_sample_box), "edgeMetrics": rgb_edge_metrics(world.crop(plaza_sample_box)), "role": "path material and seam target"},
    },
    "recommended": {
        "decision": "352x301 is the preferred visual envelope; it preserves current height and restores source aspect, but requires new/reworked art to meet edge-density targets",
        "visualBox": bbox_record(RECOMMENDED_VISUAL),
        "groundContact": {"x": GROUND_CONTACT[0], "y": GROUND_CONTACT[1], "definition": "bottom-center anchor of the building artwork"},
        "siteBounds": bbox_record(RECOMMENDED_SITE),
        "coreSiteMask": bbox_record(CORE_SITE),
        "roadSeamPatch": bbox_record(SEAM_PATCH),
        "visualFootprint": bbox_record(FOOTPRINT),
        "recommendedCollisionBoundsForNextImplementationStep": bbox_record(FOOTPRINT),
        "doorPoint": {"x": DOOR_POINT[0], "y": DOOR_POINT[1], "definition": "visible entrance ground point at the end of the apron"},
        "approachPoint": {"x": APPROACH_POINT[0], "y": APPROACH_POINT[1], "definition": "player interaction foot point; same as doorPoint"},
        "roadConnectionPoint": {"x": ROAD_CONNECTION[0], "y": ROAD_CONNECTION[1]},
        "approachPathMaskRects": [bbox_record(rect) for rect in APPROACH_RECTS],
        "minimumApproachWidthPx": 64,
        "minimumApproachWidthTiles": 2,
        "sortY": 1696,
    },
    "backgroundDisposition": [
        {"action": "move", "element": "north inner bench", "worldBounds": bbox_record((1504, 1328, 1664, 1416)), "note": "relocate outside core lot on the west ring tangent"},
        {"action": "remove", "element": "potted topiary behind facade", "worldBounds": bbox_record((1616, 1376, 1696, 1496))},
        {"action": "move", "element": "west inner bench", "worldBounds": bbox_record((1432, 1496, 1584, 1608)), "note": "relocate west of x=1440"},
        {"action": "remove", "element": "small path light and shrub cluster", "worldBounds": bbox_record((1536, 1568, 1616, 1664))},
        {"action": "remove", "element": "curved low wall, flowerbed, and shrubs", "worldBounds": bbox_record((1432, 1600, 1792, 1816)), "note": "replace with one site-ground composition"},
        {"action": "move", "element": "west plaza lamp", "worldBounds": bbox_record((1728, 1568, 1808, 1816)), "proposedGroundContact": [1824, 1792], "note": "site foreground or independent depth-sorted prop; do not bake into building"},
        {"action": "keep", "element": "main plaza and north/south road", "worldBounds": bbox_record((1792, 1280, 1952, 1888))},
        {"action": "keep", "element": "outer west vegetation and ring path", "worldBounds": bbox_record((1280, 1440, 1432, 1888))},
    ],
    "layerPlan": {
        "home-site-ground": ["replacement ground within site mask", "64 px access path and seam patch", "low fence/flowerbed/shrubs", "world-matched contact shadow"],
        "home-building": ["house body", "front door", "porch", "minimum steps"],
        "home-foreground": ["only tall front elements that must occlude the player", "optional and independently depth-sorted"],
        "home-site metadata": ["visualBox", "groundContact", "footprint", "collision", "doorPoint", "approachPoint", "sortY", "siteBounds"],
    },
    "edgeMeasurementMethod": {
        "luminance": "Rec.709 RGB coefficients",
        "gradient": "centered x/y finite difference, Euclidean magnitude",
        "sampleMask": "alpha > 16 for transparent assets; full crop for opaque world samples",
        "meanBoundaryStrengthScale": "0..255",
        "strongEdgeThreshold": 48,
    },
    "approvalTargets": {
        "meanBoundaryStrength255": {"targetBand": [7.1, 10.64], "basis": "guesthouse/library median 8.8674 +/-20%"},
        "strongEdgeRatioMax": 0.08,
        "strongEdgeRatioPreferredMax": 0.05,
        "aspectDistortionPercentAbsoluteMax": 1.0,
        "doorPointToInteractionPointMaxPx": 8,
        "visualFootprintToCollisionMaxPx": 16,
        "duplicateDecorationInsideSite": 0,
        "continuousApproachPathRequired": True,
        "minimumImportantVisualPeriodWorldPx": 4,
    },
    "cameraScaleChecks": {
        "desktop1280x720": {"worldToScreenScale": 0.9432, "recommendedHouseScreenPxApprox": [332, 284]},
        "desktop1440x900": {"worldToScreenScale": 1.1983, "recommendedHouseScreenPxApprox": [422, 361]},
        "mobile390x844": {"worldToScreenScale": 0.6094, "recommendedHouseScreenPxApprox": [214, 183]},
        "mobileLandscape844x390": {"worldToScreenScale": 0.58, "recommendedHouseScreenPxApprox": [204, 175]},
    },
}

(OUT / "findings.json").write_text(json.dumps(findings, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"status": "PASS", "outputs": ["02-alpha-bounds.png", "03-size-comparison.png", "04-site-overlay.png", "05-background-conflicts.png", "06-layer-plan.png", "findings.json"]}, indent=2))
