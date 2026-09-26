#!/usr/bin/env python3
"""Build deterministic visual-review artifacts for the modular v3 world map."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "_review/world-map-modular-v3"
RUNTIME = ROOT / "public/assets/world/sound-archive-garden-v3"
REFERENCE = ROOT / "design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png"


def contain(image: Image.Image, size: tuple[int, int], background=(239, 231, 205, 255)) -> Image.Image:
    canvas = Image.new("RGBA", size, background)
    fitted = ImageOps.contain(image.convert("RGBA"), size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
    return canvas


def build_before() -> None:
    with Image.open(REFERENCE) as image:
        contain(image, (1280, 720)).convert("RGB").save(REVIEW / "01-before-full-map.png", quality=94)


def build_inventory() -> None:
    image = Image.open(REVIEW / "06-final-full-map.png").convert("RGBA")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=18)
    destinations = {
        1: ("Home", 704, 704), 2: ("Lab", 1920, 672), 3: ("Animal", 3232, 768),
        4: ("Urban", 3552, 1600), 5: ("Music", 3216, 2432), 6: ("Human", 432, 2464),
        7: ("Nature", 544, 1568), 8: ("Library", 1920, 1440),
    }
    # 4:3 world is letterboxed into x=160..1120 in the 1280x720 capture.
    for number, (label, wx, wy) in destinations.items():
        x, y = 160 + wx / 4, wy / 4
        draw.ellipse((x - 15, y - 15, x + 15, y + 15), fill=(28, 49, 32, 235), outline=(255, 245, 194, 255), width=3)
        draw.text((x, y), str(number), font=font, fill="white", anchor="mm")
        draw.rounded_rectangle((x + 18, y - 13, x + 118, y + 13), radius=7, fill=(28, 49, 32, 215))
        draw.text((x + 25, y - 9), label, font=font, fill="white")
    image.convert("RGB").save(REVIEW / "02-asset-inventory-numbered.png", quality=94)


def build_heatmap() -> None:
    before = Image.open(REVIEW / "01-before-full-map.png").convert("RGB")
    after = Image.open(REVIEW / "06-final-full-map.png").convert("RGB")
    diff = ImageChops.difference(before, after).convert("L")
    diff = diff.point(lambda value: min(255, value * 3))
    heat = ImageOps.colorize(diff, black="#13253a", mid="#f0c24f", white="#ec4758")
    heat.save(REVIEW / "08-layout-diff-heatmap.png")


def checker(size: tuple[int, int], cell=16) -> Image.Image:
    image = Image.new("RGBA", size, "#f1ead8")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#d9d0ba")
    return image


def build_contact_sheet_and_inventory() -> None:
    manifest = json.loads((RUNTIME / "asset-manifest.json").read_text())
    assets = manifest["assets"]
    cell_w, cell_h, columns = 260, 220, 5
    rows = (len(assets) + columns - 1) // columns
    sheet = Image.new("RGBA", (cell_w * columns, cell_h * rows), "#ede6d4")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=15)
    inventory = []
    for index, asset in enumerate(assets):
        x = index % columns * cell_w
        y = index // columns * cell_h
        panel = checker((cell_w - 12, cell_h - 42))
        with Image.open(ROOT / "public" / asset["src"].lstrip("/")) as source:
            fitted = ImageOps.contain(source.convert("RGBA"), (cell_w - 30, cell_h - 60), Image.Resampling.LANCZOS)
            panel.alpha_composite(fitted, ((panel.width - fitted.width) // 2, (panel.height - fitted.height) // 2))
        sheet.alpha_composite(panel, (x + 6, y + 6))
        draw.text((x + 10, y + cell_h - 30), f"{index + 1:02d}  {asset['id']}", fill="#253424", font=font)
        inventory.append({
            "number": index + 1,
            **asset,
            "reuse": "unique" if asset["id"].startswith("building-") else "modular",
            "runtimeBytes": (ROOT / "public" / asset["src"].lstrip("/")).stat().st_size,
            "collision": "manifest foot collider or terrain-derived",
            "foreground": asset["id"].startswith("foreground-"),
        })
    sheet.convert("RGB").save(REVIEW / "asset-contact-sheet.jpg", quality=92)
    (REVIEW / "asset-inventory.json").write_text(json.dumps({"assetCount": len(inventory), "assets": inventory}, indent=2) + "\n")


def build_props_closeup() -> None:
    image = Image.open(REVIEW / "12-building-entrance-closeup.png").convert("RGB")
    crop = image.crop((160, 80, 1120, 680)).resize((1920, 1200), Image.Resampling.LANCZOS)
    crop.save(REVIEW / "13-props-200-percent.png", quality=95)


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    build_before()
    build_inventory()
    build_heatmap()
    build_contact_sheet_and_inventory()
    build_props_closeup()
    print(json.dumps({"status": "PASS", "review": str(REVIEW)}))


if __name__ == "__main__":
    main()
