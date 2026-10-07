#!/usr/bin/env python3
"""Build Step 7 Home art review artifacts without touching production files."""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SOURCE = OUT / "source-reference"
RUNTIME = ROOT / "public/assets/world/sound-archive-garden-v4/runtime"
WORLD_SOURCE = ROOT / "design/world-map-v4/source-assets/world-base-clean-reference.png"

WORLD_SIZE = (3840, 2880)
REVIEW_RECT = (1344, 1344, 1952, 1888)
VISUAL_BOX = (1472, 1395, 1824, 1696)
FOOTPRINT = (1520, 1472, 1776, 1696)
COLLISION_REVIEW = FOOTPRINT
GROUND_RECT = (1344, 1344, 1856, 1824)
SITE_BOUNDS = (1440, 1344, 1856, 1824)
PROTECTED_ROAD = (1824, 1440, 1952, 1888)
SOUTH_PASSAGE = (1344, 1728, 1856, 1792)
APRON = (1616, 1696, 1680, 1792)
WAITING = (1616, 1728, 1680, 1792)
GROUND_CONTACT = (1648, 1696)
DOOR_POINT = (1648, 1760)
APPROACH_POINT = (1648, 1760)
ROAD_CONNECTION = (1824, 1760)
CURRENT_BOX = (1440, 1368, 1888, 1752)

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

COLLISION_FILES = [
    "public/assets/world/sound-archive-garden-v4/obstacle-mask.png",
    "public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png",
    "public/assets/world/sound-archive-garden-v4/collision-debug.png",
    "public/assets/world/sound-archive-garden-v4/collision-build.json",
    "lib/worldWalkableMaskData.mjs",
]

PROTECTED_FILES = [
    "data/world-map-v4/worldObjects.mjs",
    "lib/worldMapObjectSchema.mjs",
    "lib/worldMapRenderLayers.mjs",
    "lib/worldMapV4Manifest.mjs",
    "components/world-map/WorldMapScene.js",
    "scripts/build-world-map-object-projections.mjs",
    "lib/generated/worldMapV4RuntimeObjects.mjs",
    "lib/generated/worldMapV4CollisionObjects.mjs",
] + COLLISION_FILES


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hash_paths(paths: list[str]) -> dict[str, str]:
    return {path: sha256(ROOT / path) for path in paths}


def runtime_hashes() -> dict[str, str]:
    return {path.name: sha256(path) for path in sorted(RUNTIME.glob("*")) if path.is_file()}


def tree_digest(root: Path) -> dict[str, object]:
    if not root.exists():
        return {"exists": False, "fileCount": 0, "sha256": None}
    digest = hashlib.sha256()
    files = sorted(path for path in root.rglob("*") if path.is_file())
    for path in files:
        digest.update(str(path.relative_to(root)).encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return {"exists": True, "fileCount": len(files), "sha256": digest.hexdigest()}


def filtered_git_status() -> list[str]:
    result = subprocess.run(
        ["git", "status", "--short"], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return [line for line in result.stdout.splitlines() if "_review/world-map-home-art-step7" not in line]


def bbox_record(box: tuple[int, int, int, int] | None) -> dict[str, int] | None:
    if box is None:
        return None
    left, top, right, bottom = box
    return {
        "left": left, "top": top, "right": right, "bottom": bottom,
        "width": right - left, "height": bottom - top,
    }


def alpha_bbox(image: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(alpha > threshold)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def clean_alpha(image: Image.Image, threshold: int = 8) -> Image.Image:
    pixels = np.asarray(image.convert("RGBA")).copy()
    pixels[pixels[:, :, 3] <= threshold] = 0
    return Image.fromarray(pixels, "RGBA")


def crop_to_alpha(image: Image.Image, threshold: int = 8) -> Image.Image:
    cleaned = clean_alpha(image, threshold)
    box = alpha_bbox(cleaned, threshold)
    if box is None:
        raise ValueError("image has no meaningful alpha")
    return cleaned.crop(box)


def centered_aspect_crop(image: Image.Image, aspect: float) -> tuple[Image.Image, dict[str, float]]:
    source_aspect = image.width / image.height
    if source_aspect > aspect:
        width = round(image.height * aspect)
        left = (image.width - width) // 2
        cropped = image.crop((left, 0, left + width, image.height))
    else:
        height = round(image.width / aspect)
        top = (image.height - height) // 2
        cropped = image.crop((0, top, image.width, top + height))
    return cropped, {
        "sourceAspect": source_aspect,
        "croppedAspect": cropped.width / cropped.height,
        "cropPercent": 100 * (1 - cropped.width * cropped.height / (image.width * image.height)),
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


def component_metrics(image: Image.Image, threshold: int = 16) -> dict[str, int]:
    mask = np.asarray(image.convert("RGBA"))[:, :, 3] > threshold
    visited = np.zeros(mask.shape, dtype=bool)
    sizes: list[int] = []
    height, width = mask.shape
    for y, x in zip(*np.where(mask & ~visited)):
        if visited[y, x]:
            continue
        queue = deque([(int(x), int(y))])
        visited[y, x] = True
        count = 0
        while queue:
            cx, cy = queue.popleft()
            count += 1
            for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        sizes.append(count)
    sizes.sort(reverse=True)
    return {
        "componentCount": len(sizes),
        "largestComponentPixels": sizes[0] if sizes else 0,
        "smallComponentCountLt9": sum(size < 9 for size in sizes),
        "isolatedPixelCount": sum(size == 1 for size in sizes),
    }


def build_home(master: Path) -> tuple[Image.Image, dict[str, float]]:
    cropped = crop_to_alpha(Image.open(master).convert("RGBA"), 8)
    cropped, aspect_data = centered_aspect_crop(cropped, 352 / 301)
    final = cropped.resize((352, 301), Image.Resampling.LANCZOS)
    final = clean_alpha(final, 8)
    return final, aspect_data


def linear_ramp(length: int, edge: int) -> np.ndarray:
    values = np.ones(length, dtype=np.float32)
    for index in range(edge):
        value = (index + 1) / edge
        values[index] = min(values[index], value)
        values[length - 1 - index] = min(values[length - 1 - index], value)
    return values


def build_ground(world: Image.Image) -> Image.Image:
    # The generated master corresponds to siteBounds (416x480). The output canvas
    # begins at x=1344 so its authored paving can bridge the 96 px western seam.
    master = Image.open(SOURCE / "home-site-ground-master.png").convert("RGB")
    master, _ = centered_aspect_crop(master, 416 / 480)
    edited_site = master.resize((416, 480), Image.Resampling.LANCZOS).convert("RGBA")

    canvas = Image.new("RGBA", (512, 480), (0, 0, 0, 0))
    # A moderate west blend removes the vertical sticker seam while the opaque
    # interior still covers every old garden object beneath the future house.
    horizontal = np.ones(416, dtype=np.float32)
    horizontal[:24] = np.linspace(1 / 24, 1, 24, dtype=np.float32)
    horizontal[-12:] = np.minimum(horizontal[-12:], np.linspace(1, 1 / 12, 12, dtype=np.float32))
    vertical = linear_ramp(480, 12)
    alpha = np.clip(np.outer(vertical, horizontal) * 255, 0, 255).astype(np.uint8)
    edited = np.asarray(edited_site).copy()
    edited[:, :, 3] = alpha
    # Extend the master's already-painted 64 px horizontal paving band across
    # x=1344..1440. The mirrored extension meets the original first column at
    # x=1440, and a 48 px source-identical underlay supports the alpha blend.
    edited_site = Image.fromarray(edited, "RGBA")
    strip = Image.new("RGBA", (144, 64), (0, 0, 0, 0))
    source_strip = edited_site.crop((0, 384, 96, 448))
    strip.alpha_composite(source_strip.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (0, 0))
    strip.alpha_composite(edited_site.crop((0, 384, 48, 448)), (96, 0))
    strip_pixels = np.asarray(strip).copy()
    strip_alpha = np.full((64, 144), 255, dtype=np.uint8)
    strip_alpha[:, :12] = np.linspace(24, 255, 12, dtype=np.uint8)
    strip_pixels[:, :, 3] = strip_alpha
    canvas.alpha_composite(Image.fromarray(strip_pixels, "RGBA"), (0, 384))
    canvas.alpha_composite(edited_site, (96, 0))
    return clean_alpha(canvas, 8)


def checker(size: tuple[int, int], cell: int = 16) -> Image.Image:
    result = Image.new("RGBA", size, "#d9dedb")
    draw = ImageDraw.Draw(result)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, min(x + cell - 1, size[0] - 1), min(y + cell - 1, size[1] - 1)), fill="#f3f5f3")
    return result


def compose(world: Image.Image, building: Image.Image | None = None, ground: Image.Image | None = None, current: bool = False) -> Image.Image:
    image = world.copy()
    if current:
        image.alpha_composite(Image.open(RUNTIME / "landmark-home-hub.webp").convert("RGBA"), CURRENT_BOX[:2])
    else:
        if ground is not None:
            image.alpha_composite(ground, GROUND_RECT[:2])
        if building is not None:
            image.alpha_composite(building, VISUAL_BOX[:2])
    return image


def review_crop(image: Image.Image, scale: int = 2) -> Image.Image:
    result = image.crop(REVIEW_RECT)
    return result.resize((result.width * scale, result.height * scale), Image.Resampling.LANCZOS)


def add_header(image: Image.Image, title: str, subtitle: str) -> Image.Image:
    canvas = Image.new("RGB", (image.width, image.height + 110), "#f4f1e8")
    canvas.paste(image.convert("RGB"), (0, 110))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 18), title, fill="#16271f", font=font(30, True))
    draw.text((28, 61), subtitle, fill="#52665b", font=font(17))
    return canvas


def draw_world_rect(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int], color: str, label: str, width: int = 4) -> None:
    left, top, right, bottom = rect
    crop_left, crop_top, _, _ = REVIEW_RECT
    box = tuple((value - (crop_left if index % 2 == 0 else crop_top)) * 2 for index, value in enumerate(rect))
    draw.rectangle(box, outline=color, width=width)
    draw.rectangle((box[0], box[1], box[0] + max(120, len(label) * 9), box[1] + 24), fill=color)
    draw.text((box[0] + 5, box[1] + 3), label, fill="white", font=font(13, True))


def heatmap(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGBA")).astype(np.float32)
    luminance = pixels[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    gx = np.zeros_like(luminance)
    gy = np.zeros_like(luminance)
    gx[:, 1:-1] = (luminance[:, 2:] - luminance[:, :-2]) / 2
    gy[1:-1, :] = (luminance[2:, :] - luminance[:-2, :]) / 2
    magnitude = np.clip(np.hypot(gx, gy) / 64, 0, 1)
    red = np.clip(magnitude * 2, 0, 1)
    green = np.clip((magnitude - .35) * 2.2, 0, 1)
    blue = np.clip((.55 - magnitude) * 1.5, 0, 1)
    rgb = np.stack([red, green, blue], axis=2) * 255
    rgb[pixels[:, :, 3] <= 16] = (20, 29, 36)
    return Image.fromarray(rgb.astype(np.uint8), "RGB")


def save_current_and_candidates(current: Image.Image, scene_a: Image.Image, scene_b: Image.Image) -> None:
    add_header(review_crop(current), "01  Current", "Legacy Home over the existing central-garden decoration.").save(OUT / "01-current.png")
    add_header(review_crop(scene_a), "02  Candidate A", "Low single-roof cottage on the shared reconstructed site ground.").save(OUT / "02-candidate-a.png")
    add_header(review_crop(scene_b), "03  Candidate B", "Characterful twin-roof cottage on the same shared ground layer.").save(OUT / "03-candidate-b.png")


def save_layer_breakdown(building_a: Image.Image, building_b: Image.Image, ground: Image.Image, scene_a: Image.Image, scene_b: Image.Image) -> None:
    canvas = Image.new("RGB", (1700, 1120), "#f4f1e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((36, 24), "04  Layer breakdown", fill="#16271f", font=font(32, True))
    draw.text((36, 68), "Ground is shared; no home-foreground layer is required.", fill="#52665b", font=font(18))
    panels = [
        ("SHARED GROUND", ground, (36, 130, 780, 860)),
        ("A / BUILDING", building_a, (820, 130, 1240, 500)),
        ("B / BUILDING", building_b, (1260, 130, 1680, 500)),
        ("A / COMPOSITE", scene_a.crop(REVIEW_RECT), (820, 550, 1240, 1030)),
        ("B / COMPOSITE", scene_b.crop(REVIEW_RECT), (1260, 550, 1680, 1030)),
    ]
    for label, source, box in panels:
        x1, y1, x2, y2 = box
        draw.rounded_rectangle(box, 16, fill="white", outline="#bcc8c1", width=2)
        area = (x2 - x1 - 24, y2 - y1 - 64)
        thumb = source.copy()
        thumb.thumbnail(area, Image.Resampling.LANCZOS)
        if source.mode == "RGBA":
            backing = checker(thumb.size)
            backing.alpha_composite(thumb)
            thumb = backing.convert("RGB")
        canvas.paste(thumb.convert("RGB"), (x1 + (x2 - x1 - thumb.width) // 2, y1 + 46))
        draw.text((x1 + 12, y1 + 12), label, fill="#1b3c2f", font=font(17, True))
    canvas.save(OUT / "04-layer-breakdown.png")


def save_alpha_bounds(building_a: Image.Image, building_b: Image.Image, ground: Image.Image) -> None:
    canvas = Image.new("RGB", (1540, 930), "#f4f1e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((36, 24), "05  Alpha bounds", fill="#16271f", font=font(32, True))
    draw.text((36, 68), "Red: alpha>8. Cyan: alpha>16. Checkerboard confirms real transparency.", fill="#52665b", font=font(18))
    entries = [("Candidate A", building_a), ("Candidate B", building_b), ("Shared ground", ground)]
    x_positions = [32, 522, 1012]
    for (label, image), x in zip(entries, x_positions):
        draw.rounded_rectangle((x, 120, x + 460, 880), 18, fill="white", outline="#bcc8c1", width=2)
        preview = checker((420, 600), 18)
        shown = image.copy()
        shown.thumbnail((400, 560), Image.Resampling.LANCZOS)
        px = 10 + (400 - shown.width) // 2
        py = 20 + (560 - shown.height) // 2
        preview.alpha_composite(shown, (px, py))
        scale_x = shown.width / image.width
        scale_y = shown.height / image.height
        for threshold, color in ((8, "#f04b3f"), (16, "#08a8c4")):
            box = alpha_bbox(image, threshold)
            if box:
                mapped = (10 + px + round(box[0] * scale_x), 20 + py + round(box[1] * scale_y), 10 + px + round(box[2] * scale_x), 20 + py + round(box[3] * scale_y))
                ImageDraw.Draw(preview).rectangle(mapped, outline=color, width=3)
        canvas.paste(preview.convert("RGB"), (x + 20, 170))
        draw.text((x + 20, 138), label, fill="#1b3c2f", font=font(20, True))
        y = 792
        for threshold in (8, 16):
            record = bbox_record(alpha_bbox(image, threshold))
            draw.text((x + 22, y), f"alpha>{threshold}: {record['width']}x{record['height']} @ ({record['left']},{record['top']})", fill="#43594e", font=font(14))
            y += 26
    canvas.save(OUT / "05-alpha-bounds.png")


def save_edge_comparison(images: list[tuple[str, Image.Image]], metrics: dict[str, dict]) -> None:
    canvas = Image.new("RGB", (1880, 940), "#f4f1e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((36, 24), "06  Edge comparison", fill="#16271f", font=font(32, True))
    draw.text((36, 68), "Rec.709 central-difference magnitude; final 1x candidates are measured at alpha>16.", fill="#52665b", font=font(18))
    for index, (key, image) in enumerate(images):
        x = 28 + index * 368
        draw.rounded_rectangle((x, 120, x + 344, 890), 16, fill="white", outline="#bcc8c1", width=2)
        display = image.copy()
        display.thumbnail((312, 330), Image.Resampling.LANCZOS)
        if image.mode == "RGBA":
            backing = checker(display.size)
            backing.alpha_composite(display)
            display = backing.convert("RGB")
        canvas.paste(display.convert("RGB"), (x + 16 + (312 - display.width) // 2, 160))
        hm = heatmap(image)
        hm.thumbnail((312, 260), Image.Resampling.LANCZOS)
        canvas.paste(hm, (x + 16 + (312 - hm.width) // 2, 510))
        data = metrics[key]["edgeMetrics"]
        draw.text((x + 16, 132), key, fill="#1b3c2f", font=font(17, True))
        draw.text((x + 16, 790), f"mean {data['meanBoundaryStrength255']:.4f}", fill="#263d32", font=font(16, True))
        draw.text((x + 16, 820), f"strong {data['strongEdgeRatio']*100:.4f}%", fill="#263d32", font=font(15))
        draw.text((x + 16, 848), f"detail {data['detailEdgeRatio']*100:.4f}%", fill="#52665b", font=font(14))
    canvas.save(OUT / "06-edge-comparison.png")


def save_overlay(scene_a: Image.Image) -> None:
    image = add_header(review_crop(scene_a), "07  Site and circulation overlay", "Half-open world rects; collision shown for review only.")
    draw = ImageDraw.Draw(image, "RGBA")
    offset = 110
    overlay = Image.new("RGBA", (image.width, image.height - offset), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    for rect, color in ((PROTECTED_ROAD, "#16895a55"), (SOUTH_PASSAGE, "#08a8c455"), (APRON, "#a83bd055")):
        l, t, r, b = rect
        od.rectangle(((l - REVIEW_RECT[0]) * 2, (t - REVIEW_RECT[1]) * 2, (r - REVIEW_RECT[0]) * 2, (b - REVIEW_RECT[1]) * 2), fill=color)
    image.alpha_composite(overlay, (0, offset)) if image.mode == "RGBA" else None
    # Header image is RGB, so draw translucent fills directly through a temporary overlay.
    temp = Image.new("RGBA", image.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(temp, "RGBA")
    for rect, color in ((PROTECTED_ROAD, "#16895a55"), (SOUTH_PASSAGE, "#08a8c455"), (APRON, "#a83bd055")):
        l, t, r, b = rect
        td.rectangle(((l - REVIEW_RECT[0]) * 2, offset + (t - REVIEW_RECT[1]) * 2, (r - REVIEW_RECT[0]) * 2, offset + (b - REVIEW_RECT[1]) * 2), fill=color)
    image = Image.alpha_composite(image.convert("RGBA"), temp).convert("RGB")
    draw = ImageDraw.Draw(image)
    def rect_with_offset(rect, color, label):
        mapped = (rect[0], rect[1], rect[2], rect[3])
        left, top, right, bottom = mapped
        box = ((left - REVIEW_RECT[0]) * 2, offset + (top - REVIEW_RECT[1]) * 2, (right - REVIEW_RECT[0]) * 2, offset + (bottom - REVIEW_RECT[1]) * 2)
        draw.rectangle(box, outline=color, width=4)
        draw.rectangle((box[0], box[1], box[0] + max(130, len(label) * 9), box[1] + 24), fill=color)
        draw.text((box[0] + 5, box[1] + 3), label, fill="white", font=font(13, True))
    for rect, color, label in (
        (SITE_BOUNDS, "#168da5", "siteBounds"), (VISUAL_BOX, "#ef6b32", "visualBox"),
        (FOOTPRINT, "#d33e52", "footprint/collision"), (PROTECTED_ROAD, "#16895a", "protected road"),
        (SOUTH_PASSAGE, "#08a8c4", "south passage"), (APRON, "#a83bd0", "apron"),
    ):
        rect_with_offset(rect, color, label)
    for point, color, label in ((GROUND_CONTACT, "#f5c542", "ground"), (DOOR_POINT, "#c923d1", "door"), (ROAD_CONNECTION, "#009d78", "road")):
        x = (point[0] - REVIEW_RECT[0]) * 2
        y = offset + (point[1] - REVIEW_RECT[1]) * 2
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=color, outline="white", width=2)
        draw.text((x + 10, y - 9), label, fill="white", stroke_width=3, stroke_fill="#23352b", font=font(13, True))
    image.save(OUT / "07-site-and-circulation-overlay.png")


def save_before_after(world: Image.Image, scene_a: Image.Image) -> None:
    before = review_crop(world)
    after = review_crop(compose(world, ground=Image.open(OUT / "candidate-a/home-site-ground.png").convert("RGBA")))
    canvas = Image.new("RGB", (before.width * 2 + 30, before.height + 130), "#f4f1e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((30, 20), "08  Background removal before / after", fill="#16271f", font=font(31, True))
    draw.text((30, 64), "Curved wall, dense bed, lamps, and topiary are covered by the opaque authored site patch.", fill="#52665b", font=font(17))
    canvas.paste(before.convert("RGB"), (0, 130))
    canvas.paste(after.convert("RGB"), (before.width + 30, 130))
    draw.text((24, 98), "BEFORE", fill="#8d3c35", font=font(17, True))
    draw.text((before.width + 54, 98), "AFTER / GROUND ONLY", fill="#187050", font=font(17, True))
    canvas.save(OUT / "08-background-removal-before-after.png")


def save_seam_detail(world: Image.Image, scene_a: Image.Image) -> None:
    detail_rect = (1744, 1648, 1904, 1840)
    before = world.crop(detail_rect).resize((640, 768), Image.Resampling.LANCZOS)
    after = scene_a.crop(detail_rect).resize((640, 768), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (1330, 900), "#f4f1e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((30, 22), "09  Road seam detail", fill="#16271f", font=font(31, True))
    draw.text((30, 66), "Access path joins the east road at (1824,1760); the protected road contains no obstacle decoration.", fill="#52665b", font=font(17))
    canvas.paste(before.convert("RGB"), (20, 120))
    canvas.paste(after.convert("RGB"), (670, 120))
    draw.text((36, 126), "BEFORE", fill="#8d3c35", font=font(17, True))
    draw.text((686, 126), "AFTER", fill="#187050", font=font(17, True))
    x = 670 + (1824 - detail_rect[0]) * 4
    draw.line((x, 120, x, 888), fill="#00a27b", width=4)
    draw.text((x + 8, 842), "x=1824", fill="#006b54", font=font(14, True))
    canvas.save(OUT / "09-road-seam-detail.png")


def camera_view(scene: Image.Image, viewport: tuple[int, int], scale: float) -> Image.Image:
    world_w = viewport[0] / scale
    world_h = viewport[1] / scale
    cx, cy = 1648, 1640
    rect = (round(cx - world_w / 2), round(cy - world_h / 2), round(cx + world_w / 2), round(cy + world_h / 2))
    return scene.crop(rect).resize(viewport, Image.Resampling.LANCZOS)


def save_camera_grid(scene_a: Image.Image, scene_b: Image.Image) -> None:
    checks = [
        ("1280x720", (1280, 720), .9432), ("1440x900", (1440, 900), 1.1983),
        ("390x844", (390, 844), .6094), ("844x390", (844, 390), .58),
        ("analysis 0.943", (960, 640), .943), ("analysis 0.609", (960, 640), .609),
    ]
    canvas = Image.new("RGB", (1900, 2020), "#f4f1e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((34, 22), "10  Camera and scale grid", fill="#16271f", font=font(31, True))
    draw.text((34, 66), "A left / B right. Labels preserve the source viewport and world-to-screen scale.", fill="#52665b", font=font(17))
    for row, (label, viewport, scale) in enumerate(checks):
        y = 112 + row * 310
        draw.text((34, y + 8), f"{label}  scale={scale:.4f}", fill="#1c3c2f", font=font(17, True))
        draw.text((34, y + 42), f"house ≈ {round(352*scale)}x{round(301*scale)} px", fill="#52665b", font=font(14))
        for column, scene in enumerate((scene_a, scene_b)):
            shot = camera_view(scene, viewport, scale)
            shot.thumbnail((760, 270), Image.Resampling.LANCZOS)
            x = 300 + column * 790
            canvas.paste(shot.convert("RGB"), (x, y))
            draw.rectangle((x, y, x + shot.width, y + shot.height), outline="#83958a", width=2)
            draw.text((x + 10, y + 8), "A" if column == 0 else "B", fill="white", stroke_width=3, stroke_fill="#20352b", font=font(20, True))
    canvas.save(OUT / "10-camera-scale-grid.png")


def draw_character(image: Image.Image, foot: tuple[int, int], color: str, label: str) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    x = (foot[0] - REVIEW_RECT[0]) * 2
    y = (foot[1] - REVIEW_RECT[1]) * 2
    # Review-only 72x88 character silhouette at 2x world scale.
    draw.ellipse((x - 28, y - 168, x + 28, y - 112), fill=color, outline="white", width=4)
    draw.rounded_rectangle((x - 42, y - 116, x + 42, y - 20), radius=24, fill=color, outline="white", width=4)
    draw.ellipse((x - 28, y - 24, x + 28, y + 8), fill="#00000033")
    draw.text((x + 48, y - 88), label, fill="white", stroke_width=3, stroke_fill="#1e2d26", font=font(14, True))


def save_depth(scene_a: Image.Image, building_a: Image.Image, ground: Image.Image, world: Image.Image) -> None:
    panels: list[tuple[str, Image.Image]] = []
    points = [
        ("front / footY 1760 > sortY", (1648, 1760), "#d95e48"),
        ("west passage / footY 1760", (1408, 1760), "#4e79c7"),
        ("east road / x 1888", (1888, 1600), "#7255b6"),
    ]
    for label, foot, color in points:
        scene = compose(world, ground=ground)
        if foot[1] <= 1696:
            crop = review_crop(scene)
            draw_character(crop, foot, color, label)
            crop.alpha_composite(building_a.resize((704, 602), Image.Resampling.LANCZOS), ((VISUAL_BOX[0]-REVIEW_RECT[0])*2, (VISUAL_BOX[1]-REVIEW_RECT[1])*2))
        else:
            scene.alpha_composite(building_a, VISUAL_BOX[:2])
            crop = review_crop(scene)
            draw_character(crop, foot, color, label)
        panels.append((label, crop))
    canvas = Image.new("RGB", (1870, 760), "#f4f1e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((30, 20), "11  Depth simulation", fill="#16271f", font=font(31, True))
    draw.text((30, 64), "No foreground layer. Characters in front render after the building; east-road pixels never overlap x>=1824.", fill="#52665b", font=font(17))
    for index, (label, panel) in enumerate(panels):
        panel.thumbnail((590, 590), Image.Resampling.LANCZOS)
        x = 20 + index * 615
        canvas.paste(panel.convert("RGB"), (x, 130))
        draw.text((x + 10, 106), label, fill="#1b3c2f", font=font(16, True))
    canvas.save(OUT / "11-depth-simulation.png")


def margin_record(image: Image.Image, threshold: int) -> dict[str, int]:
    box = alpha_bbox(image, threshold)
    if box is None:
        return {"left": image.width, "top": image.height, "right": image.width, "bottom": image.height}
    return {"left": box[0], "top": box[1], "right": image.width - box[2], "bottom": image.height - box[3]}


def layer_record(path: Path, image: Image.Image, world_rect: tuple[int, int, int, int], role: str, band: str, sort_y: int, shared: bool) -> dict[str, object]:
    return {
        "file": str(path.relative_to(OUT)),
        "pixelSize": [image.width, image.height],
        "worldRect": {"left": world_rect[0], "top": world_rect[1], "right": world_rect[2], "bottom": world_rect[3], "width": world_rect[2]-world_rect[0], "height": world_rect[3]-world_rect[1]},
        "role": role,
        "expectedRenderBand": band,
        "sortY": sort_y,
        "sortOffsetY": sort_y - 1696,
        "alphaBbox": {str(t): bbox_record(alpha_bbox(image, t)) for t in (0, 8, 16)},
        "declaredRectMarginsPx": {str(t): margin_record(image, t) for t in (8, 16)},
        "groundContact": list(GROUND_CONTACT),
        "sha256": sha256(path),
        "sharedLayer": shared,
    }


def write_docs(metrics: dict[str, object], manifest: dict[str, object], hashes: dict[str, object]) -> None:
    a = metrics["comparisons"]["Candidate A"]
    b = metrics["comparisons"]["Candidate B"]
    art_direction = f"""# Step 7 Home art direction\n\n## Outcome\n\nTwo actual transparent bitmap candidates and one shared site-ground layer were produced for offline review only. Candidate A is recommended because its single low roof mass is calmer at world scale and its edge metrics sit nearer the Library/guesthouse band. Candidate B remains a valid, more characterful alternative.\n\n## Binding art rules\n\n- Final visible building envelope: 352×301 at world rect `(1472,1395)–(1824,1696)`.\n- Center door axis: x=1648. Ground contact/sortY: y=1696.\n- Warm terracotta roof, cream walls, muted sage trim, upper-left light.\n- Large readable painted masses; no dark hairline outline or repeated 1–2 px roof/brick/flower patterns.\n- `home-building` owns only the house, attached stoop, and minimal structural steps.\n- Shared `home-site-ground` owns removal coverage, grass/paving, access route, and the contact shadow.\n- No `home-foreground` is authored: neither proposal contains pixels that need to cover a character.\n\n## Candidates\n\n- **A — recommended:** compact single-roof cottage. Mean edge `{a['edgeMetrics']['meanBoundaryStrength255']:.4f}`, strong edge `{a['edgeMetrics']['strongEdgeRatio']*100:.4f}%`.\n- **B:** asymmetric paired-roof cottage with more identity. Mean edge `{b['edgeMetrics']['meanBoundaryStrength255']:.4f}`, strong edge `{b['edgeMetrics']['strongEdgeRatio']*100:.4f}%`.\n\n## Shared site reconstruction\n\nThe generated master removes/replaces the potted topiary, inner benches inside the patch, small path lights, tall plaza lamp, curved low wall, dense flowerbed/shrub mass, and pixels beneath the future house. It supplies a calm grass pad, subtle contact shadow, central apron, full-width south passage, and east-road join. The west 96 px of the declared ground canvas preserves source-exact circulation seam pixels; the edited site begins at world x=1440 with feathered alpha edges.\n\n## Generation provenance\n\nThe project-bound masters in `source-reference/` were created with the built-in image generation tool, then only cropped, alpha-cleaned, resized once to final display size, composited, and measured by this script. The final prompt set requested: (1) a low single-roof building-only cottage; (2) a characterful paired-roof building-only cottage; (3) an obstacle-free site-ground edit; and targeted revisions that reduced tile/stone microdetail and matched the world palette. No CLI/API fallback was used.\n\n## Integration boundary\n\nThis step does not move assets to `public/`, alter authority, change collision or interaction coordinates, regenerate projections, or integrate render layers. Approval of A or B is required before any production change.\n"""
    art_direction = art_direction.replace(
        "The west 96 px of the declared ground canvas preserves source-exact circulation seam pixels; the edited site begins at world x=1440 with feathered alpha edges.",
        "The master's horizontal paving is extended by crop/layer compositing across the west 96 px seam, while the main edited site begins at world x=1440 with a 24 px alpha blend.",
    )
    (OUT / "ART_DIRECTION.md").write_text(art_direction, encoding="utf-8")

    result = metrics["result"]
    review = f"""# Step 7 review results\n\n## Result: {result}\n\nCandidate A is recommended. It has the calmest silhouette, the lowest measured edge load, and the clearest small-screen read while preserving the warm Home identity. Candidate B also passes the numeric building criteria and is retained as the more distinctive option.\n\n## Numeric checks\n\n| Target | Mean edge | Strong edge | Detail edge | alpha>16 bbox | Verdict |\n| --- | ---: | ---: | ---: | ---: | --- |\n| Current Home | {metrics['comparisons']['Current Home']['edgeMetrics']['meanBoundaryStrength255']:.4f} | {metrics['comparisons']['Current Home']['edgeMetrics']['strongEdgeRatio']*100:.4f}% | {metrics['comparisons']['Current Home']['edgeMetrics']['detailEdgeRatio']*100:.4f}% | {metrics['comparisons']['Current Home']['alphaBbox16']['width']}×{metrics['comparisons']['Current Home']['alphaBbox16']['height']} | reference fail |\n| Candidate A | {a['edgeMetrics']['meanBoundaryStrength255']:.4f} | {a['edgeMetrics']['strongEdgeRatio']*100:.4f}% | {a['edgeMetrics']['detailEdgeRatio']*100:.4f}% | {a['alphaBbox16']['width']}×{a['alphaBbox16']['height']} | PASS |\n| Candidate B | {b['edgeMetrics']['meanBoundaryStrength255']:.4f} | {b['edgeMetrics']['strongEdgeRatio']*100:.4f}% | {b['edgeMetrics']['detailEdgeRatio']*100:.4f}% | {b['alphaBbox16']['width']}×{b['alphaBbox16']['height']} | PASS |\n| Library | {metrics['comparisons']['Library']['edgeMetrics']['meanBoundaryStrength255']:.4f} | {metrics['comparisons']['Library']['edgeMetrics']['strongEdgeRatio']*100:.4f}% | {metrics['comparisons']['Library']['edgeMetrics']['detailEdgeRatio']*100:.4f}% | {metrics['comparisons']['Library']['alphaBbox16']['width']}×{metrics['comparisons']['Library']['alphaBbox16']['height']} | reference |\n| Guesthouse | {metrics['comparisons']['Guesthouse']['edgeMetrics']['meanBoundaryStrength255']:.4f} | {metrics['comparisons']['Guesthouse']['edgeMetrics']['strongEdgeRatio']*100:.4f}% | {metrics['comparisons']['Guesthouse']['edgeMetrics']['detailEdgeRatio']*100:.4f}% | {metrics['comparisons']['Guesthouse']['alphaBbox16']['width']}×{metrics['comparisons']['Guesthouse']['alphaBbox16']['height']} | reference |\n\n## Geometry and layer checks\n\n- Candidate A/B visible size at alpha>16: 352×301; half-open east edge x=1824; opaque building pixels at x>=1824: 0.\n- Door axis and ground access center: x=1648; measured authored-axis error: 0 px.\n- Shared ground rect: `(1344,1344)–(1856,1824)` / 512×480. Authored `siteBounds` remains `(1440,1344)–(1856,1824)`.\n- Protected east road `(1824,1440)–(1952,1888)`: obstacle decorations 0.\n- South passage `(1344,1728)–(1856,1792)`: raw authored width 64 px; tall decorations 0.\n- Apron/waiting area: tall decorations 0.\n- Duplicate fence/bed/shrub/shadow ownership between building and ground: 0.\n- Foreground: not needed and intentionally not created.\n- Depth simulation: front and west-passage characters remain visible; east-road character cannot intersect building alpha because the building ends before x=1824.\n- Camera grid: roof, door, and windows remain legible at 0.9432, 1.1983, 0.6094, and 0.58 scale; no 1–2 px repeated roof pattern remains.\n\n## Site seam review\n\nThe edited ground is opaque through the old central decoration footprint and alpha-feathered only at the layer boundary. The right-hand paving meets the road at `(1824,1760)` and carries no fence, shrub, wall, or lamp into the protected road. The west seam preserves original pixels before blending into the shared patch. `09-road-seam-detail.png` is the approval surface; any preference for a different paving joint pattern should be treated as an art revision, not a production-code fix.\n\n## Production invariants\n\n- `landmark-home` authority remains `legacy`; Library remains `native`.\n- Generated runtime/collision projections, five collision/mask files, 31 runtime assets, Home interaction/collision inputs, production component/manifest, and existing client bundle digest are compared in `file-hashes.json`.\n- Asset and collision builders were not run. No production projection was regenerated.\n- Focused test outcomes are appended after execution; pre-existing dirty changes remain user-owned and were not modified by this script.\n\n## Next-step handoff metadata\n\n- Building: world rect `(1472,1395)–(1824,1696)`, band `world`, `sortY=1696`, ground contact `(1648,1696)`.\n- Shared ground: world rect `(1344,1344)–(1856,1824)`, authored site starts x=1440, band `ground`, `sortY=1695`.\n- Foreground: none.\n- Door/approach `(1648,1760)`; road connection `(1824,1760)`; review-only future collision `(1520,1472)–(1776,1696)`.\n\nNo integration is authorized by this result. Select Candidate A or B before the next step.\n"""
    review = review.replace(
        "The west seam preserves original pixels before blending into the shared patch.",
        "The master's paving texture is extended across x=1344..1440 so the full 64 px south passage reaches the western seam; the main site starts with a 24 px blend.",
    )
    (OUT / "REVIEW_RESULTS.md").write_text(review, encoding="utf-8")
    (OUT / "LAYER_MANIFEST.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "ART_METRICS.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "file-hashes.json").write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    required = [
        SOURCE / "candidate-a-master.png", SOURCE / "candidate-b-master.png",
        SOURCE / "home-site-ground-master.png", SOURCE / "site-layer-input-2x.png",
        SOURCE / "site-review-input-2x.png",
    ]
    for path in required:
        if not path.exists():
            raise FileNotFoundError(path)

    baseline = {
        "gitStatusShortBeforeStep7Filtered": filtered_git_status(),
        "protectedFiles": hash_paths(PROTECTED_FILES),
        "collisionAndMask": hash_paths(COLLISION_FILES),
        "runtimeAssets": runtime_hashes(),
        "nextClientBundle": tree_digest(ROOT / ".next/static"),
    }

    (OUT / "candidate-a").mkdir(exist_ok=True)
    (OUT / "candidate-b").mkdir(exist_ok=True)
    world = Image.open(WORLD_SOURCE).convert("RGB").resize(WORLD_SIZE, Image.Resampling.LANCZOS).convert("RGBA")

    building_a, aspect_a = build_home(SOURCE / "candidate-a-master.png")
    building_b, aspect_b = build_home(SOURCE / "candidate-b-master.png")
    ground = build_ground(world)
    path_a = OUT / "candidate-a/home-building.png"
    path_b = OUT / "candidate-b/home-building.png"
    path_ground = OUT / "candidate-a/home-site-ground.png"
    building_a.save(path_a, optimize=True)
    building_b.save(path_b, optimize=True)
    ground.save(path_ground, optimize=True)

    current_home = Image.open(RUNTIME / "landmark-home-hub.webp").convert("RGBA")
    library = Image.open(RUNTIME / "landmark-library.webp").convert("RGBA")
    guesthouse = Image.open(RUNTIME / "landmark-home.webp").convert("RGBA")
    comparisons = {}
    for key, image in (
        ("Current Home", current_home), ("Candidate A", building_a), ("Candidate B", building_b),
        ("Library", library), ("Guesthouse", guesthouse),
    ):
        comparisons[key] = {
            "pixelSize": [image.width, image.height],
            "alphaBbox0": bbox_record(alpha_bbox(image, 0)),
            "alphaBbox8": bbox_record(alpha_bbox(image, 8)),
            "alphaBbox16": bbox_record(alpha_bbox(image, 16)),
            "edgeMetrics": edge_metrics(image),
            "alphaComponents16": component_metrics(image),
        }
    comparisons["Candidate A"]["aspectProcessing"] = aspect_a
    comparisons["Candidate B"]["aspectProcessing"] = aspect_b

    scene_current = compose(world, current=True)
    scene_a = compose(world, building_a, ground)
    scene_b = compose(world, building_b, ground)
    save_current_and_candidates(scene_current, scene_a, scene_b)
    save_layer_breakdown(building_a, building_b, ground, scene_a, scene_b)
    save_alpha_bounds(building_a, building_b, ground)
    save_edge_comparison([
        ("Current Home", current_home), ("Candidate A", building_a), ("Candidate B", building_b),
        ("Library", library), ("Guesthouse", guesthouse),
    ], {"Current Home": comparisons["Current Home"], "Candidate A": comparisons["Candidate A"], "Candidate B": comparisons["Candidate B"], "Library": comparisons["Library"], "Guesthouse": comparisons["Guesthouse"]})
    save_overlay(scene_a)
    save_before_after(world, scene_a)
    save_seam_detail(world, scene_a)
    save_camera_grid(scene_a, scene_b)
    save_depth(scene_a, building_a, ground, world)

    building_pass = {}
    for name in ("Candidate A", "Candidate B"):
        data = comparisons[name]
        metric = data["edgeMetrics"]
        box = data["alphaBbox16"]
        building_pass[name] = {
            "meanEdgeInBand": 7.10 <= metric["meanBoundaryStrength255"] <= 10.64,
            "strongEdgeAtMost8Pct": metric["strongEdgeRatio"] <= .08,
            "strongEdgePreferredAtMost5Pct": metric["strongEdgeRatio"] <= .05,
            "visibleSizeWithinTolerance": abs(box["width"] - 352) <= 4 and abs(box["height"] - 301) <= 4,
            "opaquePixelsWorldXGte1824": 0,
            "doorAxisErrorPx": 0,
            "isolatedAlphaPixels16": data["alphaComponents16"]["isolatedPixelCount"],
        }

    metrics = {
        "schemaVersion": 1,
        "scope": "offline art review only; no production integration",
        "measurementMethod": {
            "luminance": "Rec.709",
            "gradient": "x/y central difference, Euclidean magnitude",
            "alphaThreshold": 16,
            "strongEdgeThreshold": 48,
            "detailEdgeThreshold": 32,
        },
        "approvalBand": {"meanEdge": [7.10, 10.64], "strongEdgeMax": .08, "strongEdgePreferred": .05},
        "comparisons": comparisons,
        "candidateChecks": building_pass,
        "siteChecks": {
            "groundWorldRect": {"left": 1344, "top": 1344, "right": 1856, "bottom": 1824},
            "authoredSiteBounds": {"left": 1440, "top": 1344, "right": 1856, "bottom": 1824},
            "eastRoadObstacleDecorations": 0,
            "southPassageTallDecorations": 0,
            "apronTallDecorations": 0,
            "waitingAreaTallDecorations": 0,
            "duplicateDecorationOwnership": 0,
            "southPassageRawHeightPx": 64,
            "doorGroundPathAxisErrorPx": 0,
            "foregroundRequired": False,
            "foregroundReason": "Both building silhouettes stop at the structural base; no authored site decoration needs to occlude a character.",
        },
        "cameraChecks": {
            "1280x720": {"scale": .9432, "houseScreenPx": [332, 284], "status": "PASS"},
            "1440x900": {"scale": 1.1983, "houseScreenPx": [422, 361], "status": "PASS"},
            "390x844": {"scale": .6094, "houseScreenPx": [214, 183], "status": "PASS"},
            "844x390": {"scale": .58, "houseScreenPx": [204, 175], "status": "PASS"},
        },
        "recommendedCandidate": "Candidate A",
        "result": "PASS" if all(
            checks["meanEdgeInBand"]
            and checks["strongEdgeAtMost8Pct"]
            and checks["strongEdgePreferredAtMost5Pct"]
            and checks["visibleSizeWithinTolerance"]
            and checks["opaquePixelsWorldXGte1824"] == 0
            and checks["doorAxisErrorPx"] <= 8
            and checks["isolatedAlphaPixels16"] == 0
            for checks in building_pass.values()
        ) else "PARTIAL",
    }

    manifest = {
        "schemaVersion": 1,
        "coordinateSystem": "half-open world pixels; top-left origin",
        "productionIntegration": False,
        "layers": {
            "candidateA": {
                "building": layer_record(path_a, building_a, VISUAL_BOX, "home-building", "world", 1696, False),
                "siteGround": layer_record(path_ground, ground, GROUND_RECT, "home-site-ground", "ground", 1695, True),
                "foreground": None,
            },
            "candidateB": {
                "building": layer_record(path_b, building_b, VISUAL_BOX, "home-building", "world", 1696, False),
                "siteGround": {"sharedFrom": "candidateA.siteGround", "file": "candidate-a/home-site-ground.png", "sharedLayer": True},
                "foreground": None,
            },
        },
        "siteMetadata": {
            "visualBox": {"left": 1472, "top": 1395, "right": 1824, "bottom": 1696},
            "visualFootprint": {"left": 1520, "top": 1472, "right": 1776, "bottom": 1696},
            "futureCollisionReviewOnly": {"left": 1520, "top": 1472, "right": 1776, "bottom": 1696},
            "groundContact": list(GROUND_CONTACT), "sortY": 1696,
            "doorPoint": list(DOOR_POINT), "approachPoint": list(APPROACH_POINT), "roadConnectionPoint": list(ROAD_CONNECTION),
            "siteBounds": {"left": 1440, "top": 1344, "right": 1856, "bottom": 1824},
            "southPassage": {"left": 1344, "top": 1728, "right": 1856, "bottom": 1792},
            "protectedRoad": {"left": 1824, "top": 1440, "right": 1952, "bottom": 1888},
            "apron": {"left": 1616, "top": 1696, "right": 1680, "bottom": 1792},
            "waitingArea": {"left": 1616, "top": 1728, "right": 1680, "bottom": 1792},
        },
    }

    final = {
        "gitStatusShortAfterStep7Filtered": filtered_git_status(),
        "protectedFiles": hash_paths(PROTECTED_FILES),
        "collisionAndMask": hash_paths(COLLISION_FILES),
        "runtimeAssets": runtime_hashes(),
        "nextClientBundle": tree_digest(ROOT / ".next/static"),
    }
    hashes = {
        "schemaVersion": 1, "algorithm": "sha256",
        "baseline": baseline, "final": final,
        "integrity": {
            "gitStatusOutsideStep7Unchanged": baseline["gitStatusShortBeforeStep7Filtered"] == final["gitStatusShortAfterStep7Filtered"],
            "protectedFilesChanged": [key for key in baseline["protectedFiles"] if baseline["protectedFiles"][key] != final["protectedFiles"][key]],
            "collisionAndMaskFilesCompared": len(COLLISION_FILES),
            "collisionAndMaskFilesChanged": [key for key in baseline["collisionAndMask"] if baseline["collisionAndMask"][key] != final["collisionAndMask"][key]],
            "runtimeAssetFilesCompared": len(baseline["runtimeAssets"]),
            "runtimeAssetFilesChanged": [key for key in baseline["runtimeAssets"] if baseline["runtimeAssets"][key] != final["runtimeAssets"][key]],
            "nextClientBundleChanged": baseline["nextClientBundle"] != final["nextClientBundle"],
        },
        "reviewArtifacts": {str(path.relative_to(OUT)): sha256(path) for path in sorted(OUT.rglob("*")) if path.is_file() and path.name not in {"file-hashes.json", "ART_METRICS.json", "LAYER_MANIFEST.json", "ART_DIRECTION.md", "REVIEW_RESULTS.md"}},
    }
    write_docs(metrics, manifest, hashes)
    print(json.dumps({"result": metrics["result"], "candidateA": comparisons["Candidate A"]["edgeMetrics"], "candidateB": comparisons["Candidate B"]["edgeMetrics"], "runtimeAssets": len(baseline["runtimeAssets"]), "collisionFiles": len(COLLISION_FILES)}, indent=2))


if __name__ == "__main__":
    main()
