#!/usr/bin/env python3
"""Build registered HD world art and its legacy reference navigation mask.

The source image remains the coordinate authority.  The HD pass is a
deterministic, invariant-preserving 2x restoration: Lanczos reconstruction plus
bounded multi-scale luminance detail.  The navigation mask is sampled from the
same source registration, then manually constrained around the authored yards
and landmark footprints before player-foot clearance is baked in.

The production v4 collision authority is build-world-map-v4-collision.mjs.
Do not combine this legacy color-derived mask output with that object-schema
pipeline.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/world/sound-archive-garden-v2/world-base-clean.png"
PUBLIC = ROOT / "public/assets/world/sound-archive-garden-v2"
DESIGN = ROOT / "design/concepts/world-map-reskin-2026-09-18"
REVIEW = ROOT / "_review/world-map-hd-collision-fix"

WORLD_WIDTH = 3840
WORLD_HEIGHT = 2880
MASK_CELL = 4
MASK_WIDTH = WORLD_WIDTH // MASK_CELL
MASK_HEIGHT = WORLD_HEIGHT // MASK_CELL


def restore_hd(source: Image.Image) -> Image.Image:
    """Upscale without moving a single source-space edge."""
    rgb = source.convert("RGB")
    upscaled = rgb.resize((rgb.width * 2, rgb.height * 2), Image.Resampling.LANCZOS)

    # Restore only bounded source detail in luminance.  Working from the
    # original high-pass keeps the operation registered; the clamp prevents
    # bright/dark edge halos that a runtime sharpen filter would create.
    source_y = np.asarray(rgb.convert("YCbCr"), dtype=np.float32)[:, :, 0]
    blur_y = np.asarray(
        rgb.convert("YCbCr").getchannel("Y").filter(ImageFilter.GaussianBlur(0.72)),
        dtype=np.float32,
    )
    detail = np.clip(source_y - blur_y, -9.0, 9.0)
    detail_up = np.asarray(
        Image.fromarray(detail.astype(np.float32), mode="F").resize(upscaled.size, Image.Resampling.BICUBIC),
        dtype=np.float32,
    )

    ycbcr = np.asarray(upscaled.convert("YCbCr"), dtype=np.float32).copy()
    ycbcr[:, :, 0] = np.clip(ycbcr[:, :, 0] + detail_up * 0.42, 0, 255)
    return Image.fromarray(ycbcr.astype(np.uint8), mode="YCbCr").convert("RGB")


def flood_from(mask: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    visited = np.zeros_like(mask, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x, y in seeds:
        if 0 <= x < mask.shape[1] and 0 <= y < mask.shape[0] and mask[y, x]:
            visited[y, x] = True
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < mask.shape[1] and 0 <= ny < mask.shape[0] and mask[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((nx, ny))
    return visited


def mask_filter(mask: np.ndarray, *, grow: int = 0, shrink: int = 0) -> np.ndarray:
    image = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    if grow:
        image = image.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    if shrink:
        image = image.filter(ImageFilter.MinFilter(shrink * 2 + 1))
    return np.asarray(image) >= 128


def registered_navigation_mask(source: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    sampled = source.convert("RGB").resize((MASK_WIDTH, MASK_HEIGHT), Image.Resampling.LANCZOS)
    pixels = np.asarray(sampled, dtype=np.float32)
    red, green, blue = (pixels[:, :, index] for index in range(3))

    # Warm stone/dirt pixels form the authored road boundary.  A small closing
    # heals painted grout and lamp shadows; flood selection discards unrelated
    # warm texture elsewhere in the forest.
    visual_road = (
        (red > 155)
        & (green > 110)
        & (blue > 70)
        & ((red - green) > 10)
        & ((green - blue) > 12)
        & ((blue / np.maximum(green, 1)) > 0.60)
        & ((red / np.maximum(green, 1)) > 1.04)
    )
    visual_road = mask_filter(visual_road, grow=2, shrink=1)
    raw = flood_from(visual_road, [(480, 376), (480, 420)])
    # The Music plaza uses cooler cream paving separated from the ring by a
    # flowered arch; select its visual component separately, then join it with
    # a narrow hand-traced approach below.
    raw |= flood_from(visual_road, [(800, 620)])

    # Hand-correct the two non-beige approaches that color selection cannot
    # recover: the Urban asphalt threshold and the Human brick-market lane.
    # These are narrow mask-space brush annotations traced over the source,
    # not broad destination rectangles.
    manual = Image.new("L", (MASK_WIDTH, MASK_HEIGHT), 0)
    draw = ImageDraw.Draw(manual)
    draw.line([(770, 350), (782, 370), (812, 380), (854, 376)], fill=255, width=24, joint="curve")  # Urban paving
    draw.line([(724, 470), (686, 500), (669, 550), (679, 606), (718, 630), (800, 630)],
              fill=255, width=20, joint="curve")                                              # Music garden approach
    draw.line([(286, 470), (250, 500), (214, 535), (180, 572), (165, 615)], fill=255,
              width=22, joint="curve")                                                       # Human market lane
    raw |= np.asarray(manual) >= 128

    # Landmark bodies and hard scenery are explicitly removed after the yard
    # correction, so a warm facade can never become walkable.
    obstacles = Image.new("L", (MASK_WIDTH, MASK_HEIGHT), 0)
    block = ImageDraw.Draw(obstacles)
    block.polygon([(108, 42), (267, 35), (276, 150), (101, 158)], fill=255)                   # Home
    block.polygon([(365, 0), (610, 0), (610, 151), (355, 151)], fill=255)                     # Lab
    block.polygon([(735, 42), (875, 42), (884, 151), (724, 151)], fill=255)                   # Animal
    block.polygon([(866, 178), (960, 174), (960, 417), (862, 421)], fill=255)                 # Urban tower
    block.polygon([(706, 502), (905, 498), (913, 607), (702, 610)], fill=255)                 # Music hall
    block.polygon([(0, 477), (178, 472), (190, 612), (0, 620)], fill=255)                     # Human buildings
    block.polygon([(370, 204), (593, 205), (596, 337), (365, 337)], fill=255)                 # Library
    obstacle_mask = np.asarray(obstacles) >= 128
    raw &= ~obstacle_mask

    # Remove isolated decorative pixels introduced by the manual union, then
    # permit 8 world-px of visual-boundary tolerance before baking the full
    # 28x16 world-px foot clearance.
    raw = flood_from(raw, [(480, 376)])
    tolerant = mask_filter(raw, grow=2)
    expanded_obstacles = mask_filter(obstacle_mask, grow=4)
    tolerant &= ~expanded_obstacles
    clearance = mask_filter(tolerant, shrink=4)
    clearance = flood_from(clearance, [(480, 376)])
    return raw, clearance


def save_review_images(source: Image.Image, hd: Image.Image, raw: np.ndarray, clearance: np.ndarray) -> None:
    downscaled = hd.resize(source.size, Image.Resampling.LANCZOS)
    downscaled.save(REVIEW / "hd-master-downscaled.png", optimize=True)
    Image.blend(source.convert("RGB"), downscaled, 0.5).save(REVIEW / "hd-master-overlay-50.png", optimize=True)
    difference = ImageChops.difference(source.convert("RGB"), downscaled)
    difference.point(lambda value: min(255, value * 6)).save(REVIEW / "hd-master-diff-heatmap.png", optimize=True)

    base = source.convert("RGB").resize((MASK_WIDTH, MASK_HEIGHT), Image.Resampling.LANCZOS)
    rgba = np.zeros((MASK_HEIGHT, MASK_WIDTH, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.where(clearance[:, :, None], np.array([36, 214, 96]), np.array([228, 58, 64]))
    rgba[:, :, 3] = 104
    overlay = Image.alpha_composite(base.convert("RGBA"), Image.fromarray(rgba, mode="RGBA"))
    overlay.save(REVIEW / "04-full-map-collision-overlay.png", optimize=True)

    road = np.zeros_like(rgba)
    road[:, :, :3] = np.array([36, 214, 96])
    road[:, :, 3] = np.where(clearance, 210, 0)
    Image.alpha_composite(base.convert("RGBA"), Image.fromarray(road, mode="RGBA")).save(
        REVIEW / "05-road-coverage-only.png", optimize=True
    )
    blocked = np.zeros_like(rgba)
    blocked[:, :, :3] = np.array([228, 58, 64])
    blocked[:, :, 3] = np.where(clearance, 0, 100)
    Image.alpha_composite(base.convert("RGBA"), Image.fromarray(blocked, mode="RGBA")).save(
        REVIEW / "06-obstacle-coverage-only.png", optimize=True
    )
    save_collision_comparisons(base, hd.resize((MASK_WIDTH, MASK_HEIGHT), Image.Resampling.LANCZOS), clearance)


def old_walkable(tx: float, ty: float) -> bool:
    segments = [
        (60, 45, 60, 17), (60, 18, 99, 20), (82, 28, 101, 20),
        (75, 47, 83.5, 39.5), (83, 39.5, 93, 40), (45, 47, 37, 40),
        (37, 40, 27, 42), (91, 42, 111, 43), (82, 55, 101, 70),
        (60, 54, 60, 88), (38, 57, 14, 70), (29, 42, 16, 42), (38, 28, 22, 18),
    ]
    rectangles = [
        (55, 12, 65, 22), (94, 14, 108, 25), (103, 35, 119, 52),
        (94, 64, 108, 78), (5, 63, 23, 79), (9, 34, 25, 50),
        (16, 11, 28, 24), (53, 80, 67, 90),
    ]

    def point(px: float, py: float) -> bool:
        central = ((px - 60) / 16) ** 2 + ((py - 47) / 11) ** 2 <= 1
        radius = math.hypot((px - 60) / 32, (py - 42) / 23)
        ring = 0.84 <= radius <= 1.16
        route = False
        for x1, y1, x2, y2 in segments:
            dx, dy = x2 - x1, y2 - y1
            length2 = dx * dx + dy * dy
            t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / length2)) if length2 else 0
            if math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= 3.2:
                route = True
                break
        site = any(x0 <= px <= x1 and y0 <= py <= y1 for x0, y0, x1, y1 in rectangles)
        library_body = 47 <= px <= 73 and 27 <= py < 40
        return (central or ring or route or site) and not library_body

    return point(tx - 14 / 32, ty) and point(tx + 14 / 32, ty)


def save_collision_comparisons(before_base: Image.Image, after_base: Image.Image, clearance: np.ndarray) -> None:
    locations = [
        ("east-plaza-curve", 82.9375, 43.9375),
        ("west-plaza-curve", 39.5625, 38.3125),
        ("animal-branch", 86.6875, 22.6875),
        ("nature-bridge-gate", 9.3125, 39.8125),
        ("music-flowerbed-lane", 86.1875, 62.0625),
        ("home-branch", 42.1875, 27.3125),
        ("human-market-bench", 29.5625, 57.9375),
        ("urban-gate", 102.6875, 39.3125),
    ]
    old = np.zeros((MASK_HEIGHT, MASK_WIDTH), dtype=bool)
    for y in range(MASK_HEIGHT):
        for x in range(MASK_WIDTH):
            old[y, x] = old_walkable((x + 0.5) / 8, (y + 0.5) / 8)

    def annotated(base: Image.Image, mask: np.ndarray, tx: float, ty: float, label: str, state: str) -> Image.Image:
        cx, cy = int(tx * 8), int(ty * 8)
        left = max(0, min(MASK_WIDTH - 320, cx - 160))
        top = max(0, min(MASK_HEIGHT - 220, cy - 110))
        crop = base.crop((left, top, left + 320, top + 220)).convert("RGBA")
        region = mask[top : top + 220, left : left + 320]
        tint = np.zeros((220, 320, 4), dtype=np.uint8)
        tint[:, :, :3] = np.where(region[:, :, None], np.array([36, 214, 96]), np.array([228, 58, 64]))
        tint[:, :, 3] = 88
        crop = Image.alpha_composite(crop, Image.fromarray(tint, mode="RGBA"))
        draw = ImageDraw.Draw(crop)
        mx, my = cx - left, cy - top
        draw.ellipse((mx - 9, my - 9, mx + 9, my + 9), outline="white", width=3)
        draw.line((mx - 14, my, mx + 14, my), fill="white", width=2)
        draw.line((mx, my - 14, mx, my + 14), fill="white", width=2)
        draw.rectangle((0, 0, 320, 22), fill=(15, 20, 17, 220))
        draw.text((7, 5), f"{state}: {label} @ ({tx:.2f}, {ty:.2f})", fill="white")
        return crop.convert("RGB")

    for index, (label, tx, ty) in enumerate(locations, start=1):
        assert clearance[int(ty * 8), int(tx * 8)] and not old_walkable(tx, ty)
        annotated(before_base, old, tx, ty, label, "BEFORE BLOCKED").save(
            REVIEW / f"block-{index:02d}-before-{label}.png", optimize=True
        )
        annotated(after_base, clearance, tx, ty, label, "AFTER WALKABLE").save(
            REVIEW / f"block-{index:02d}-after-{label}.png", optimize=True
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    DESIGN.mkdir(parents=True, exist_ok=True)
    if args.report:
        REVIEW.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    if source.size != (2896, 2172):
        raise SystemExit(f"unexpected source registration: {source.size}")

    hd = restore_hd(source)
    master = DESIGN / "02-sound-archive-garden-hd-master.png"
    runtime = PUBLIC / "world-base-hd.webp"
    hd.save(master, optimize=True)
    hd.save(runtime, format="WEBP", quality=96, method=6)

    raw, clearance = registered_navigation_mask(source)
    Image.fromarray((clearance * 255).astype(np.uint8), mode="L").save(PUBLIC / "world-walkable-mask.png", optimize=True)
    debug = np.zeros((MASK_HEIGHT, MASK_WIDTH, 4), dtype=np.uint8)
    debug[:, :, :3] = np.where(clearance[:, :, None], np.array([36, 214, 96]), np.array([228, 58, 64]))
    debug[:, :, 3] = 104
    Image.fromarray(debug, mode="RGBA").save(PUBLIC / "world-collision-debug.png", optimize=True)
    if args.report:
        save_review_images(source, hd, raw, clearance)

    source_bytes = SOURCE.stat().st_size
    metrics = {
        "source": {"path": str(SOURCE.relative_to(ROOT)), "width": source.width, "height": source.height, "bytes": source_bytes, "estimatedDecodedRgbaBytes": source.width * source.height * 4},
        "master": {"path": str(master.relative_to(ROOT)), "width": hd.width, "height": hd.height, "bytes": master.stat().st_size, "estimatedDecodedRgbaBytes": hd.width * hd.height * 4},
        "runtime": {"path": str(runtime.relative_to(ROOT)), "width": hd.width, "height": hd.height, "bytes": runtime.stat().st_size, "estimatedDecodedRgbaBytes": hd.width * hd.height * 4},
        "registration": {"scale": 2, "origin": [0, 0], "landmarkSilhouetteOffsetPx": 0, "roadCenterlineOffsetPx": 0},
        "mask": {"width": MASK_WIDTH, "height": MASK_HEIGHT, "worldPxPerCell": MASK_CELL, "rawWalkableCells": int(raw.sum()), "clearanceCells": int(clearance.sum())},
        "method": "deterministic 2x Lanczos reconstruction plus bounded source-luminance detail restoration; no generative geometry",
    }
    if args.report:
        (REVIEW / "resolution-performance-comparison.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
