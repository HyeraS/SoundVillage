#!/usr/bin/env python3
"""Build SoundVillage 3A Character v2 runtime, preview, and review PNGs.

Only the canonical walk palette is exported. Source masters remain read-only.
Every runtime crop is checked against both the merged master and the pack's
action-separated walk sheet before it is written.
"""

from __future__ import annotations

import json
import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data/economy/catalog-v1.json"
FRAME = 32
WALK_SIZE = (256, 128)
PREVIEW_SIZE = 96
REVIEW_DIR = ROOT / "_review/economy-v1-assets"

PAID_OUTFIT_IDS = (
    "overalls", "sailor", "sporty", "suit", "witch", "clown", "dress",
    "floral", "pants", "pants_suit", "pumpkin", "sailor_bow", "shoes",
    "skirt", "skull", "spaghetti", "spooky", "stripe",
)
EXISTING_OUTFIT_IDS = frozenset(("overalls", "sailor", "sporty", "suit", "witch"))
ACCESSORY_IDS = (
    "acc_beard", "acc_earring_emerald", "acc_earring_red", "acc_glasses",
    "acc_sunglasses", "acc_hat_cowboy", "acc_hat_lucky", "acc_mask_spooky",
)
CURRENCIES = ("animal", "human", "nature", "urban", "music", "lab")
KNOWN_MASTER_WALK_PIXEL_VARIANCES = {"clown": 20}

CURRENCY_BUILD_SCRIPT = ROOT / "scripts/build-village-currency-icons.py"
CURRENCY_BUILD_SPEC = importlib.util.spec_from_file_location("village_currency_builder", CURRENCY_BUILD_SCRIPT)
assert CURRENCY_BUILD_SPEC and CURRENCY_BUILD_SPEC.loader
CURRENCY_BUILDER = importlib.util.module_from_spec(CURRENCY_BUILD_SPEC)
CURRENCY_BUILD_SPEC.loader.exec_module(CURRENCY_BUILDER)


def load_catalog_items() -> dict[str, dict]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return {item["id"]: item for item in catalog["items"]}


def rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def source_walk_path(item: dict) -> Path:
    source = Path(item["sourceAsset"])
    group = "acc" if item["type"] == "accessory" else "clothes"
    stem_by_id = {"acc_sunglasses": "glasses_sun"}
    stem = stem_by_id.get(item["id"], source.stem.strip())
    return ROOT / "assets/Character v.2/separate/walk" / group / f"{stem}_walk.png"


def canonical_walk_block(item: dict) -> Image.Image:
    source_path = ROOT / item["sourceAsset"]
    walk_path = source_walk_path(item)
    palette_index = item.get("sourcePaletteIndex") or 0
    left = palette_index * WALK_SIZE[0]
    box = (left, 0, left + WALK_SIZE[0], WALK_SIZE[1])
    master = rgba(source_path)
    separate = rgba(walk_path)
    if box[2] > master.width or box[2] > separate.width:
        raise ValueError(f"{item['id']}: palette {palette_index} exceeds source width")
    master_block = master.crop(box)
    separate_block = separate.crop(box)
    differing_pixels = sum(
        master_block.getpixel((x, y)) != separate_block.getpixel((x, y))
        for y in range(WALK_SIZE[1])
        for x in range(WALK_SIZE[0])
    )
    expected_variance = KNOWN_MASTER_WALK_PIXEL_VARIANCES.get(item["id"], 0)
    if differing_pixels != expected_variance:
        raise ValueError(
            f"{item['id']}: unexpected master/separate walk variance "
            f"({differing_pixels}, expected {expected_variance})"
        )
    if master_block.getchannel("A").tobytes() != separate_block.getchannel("A").tobytes():
        raise ValueError(f"{item['id']}: master and separate/walk anchors differ")
    return master_block


def public_path(asset_path: str) -> Path:
    return ROOT / "public" / asset_path.lstrip("/")


def write_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False)


def build_runtime_sheets(items: dict[str, dict]) -> dict[str, Image.Image]:
    sheets: dict[str, Image.Image] = {}
    for item_id in (*PAID_OUTFIT_IDS, *ACCESSORY_IDS):
        item = items[item_id]
        block = canonical_walk_block(item)
        runtime_asset = item.get("runtimeAsset") or item.get("plannedRuntimeAsset")
        if not runtime_asset:
            raise ValueError(f"{item_id}: runtime path is missing")
        output_path = public_path(runtime_asset)
        if item_id in EXISTING_OUTFIT_IDS:
            if rgba(output_path).tobytes() != block.tobytes():
                raise ValueError(f"{item_id}: existing runtime pixels changed")
        else:
            write_png(block, output_path)
        sheets[item_id] = block
    return sheets


def darker(hex_color: str, factor: float = 0.70) -> str:
    value = hex_color.lstrip("#")
    rgb = [int(value[index:index + 2], 16) for index in (0, 2, 4)]
    return "#" + "".join(f"{round(channel * factor):02X}" for channel in rgb)


def draw_token_base(draw: ImageDraw.ImageDraw, color: str) -> None:
    outline = "#3E2918"
    shadow = darker(color, 0.58)
    draw.polygon(((8, 3), (23, 3), (28, 8), (28, 23), (23, 28), (8, 28), (3, 23), (3, 8)), fill=outline)
    draw.polygon(((8, 5), (23, 5), (26, 8), (26, 23), (23, 26), (8, 26), (5, 23), (5, 8)), fill=shadow)
    draw.polygon(((8, 5), (22, 5), (25, 8), (25, 21), (21, 25), (8, 25), (6, 22), (6, 8)), fill=color)
    draw.rectangle((9, 7, 20, 8), fill="#FFFFFF55")


def draw_currency_icon(currency: str) -> Image.Image:
    colors = {
        "animal": "#C58B52", "human": "#D96C5F", "nature": "#5B9E3A",
        "urban": "#4A8FD4", "music": "#9B6DD4", "lab": "#4E9F8E",
    }
    cream = "#FFF0D3"
    dark = "#3E2918"
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw_token_base(draw, colors[currency])

    if currency == "animal":
        draw.ellipse((11, 17, 21, 24), fill=cream)
        for box in ((9, 12, 12, 15), (13, 9, 16, 13), (18, 9, 21, 13), (22, 12, 25, 15)):
            draw.rectangle(box, fill=cream)
    elif currency == "human":
        draw.ellipse((9, 9, 14, 14), fill=cream)
        draw.ellipse((18, 9, 23, 14), fill=cream)
        draw.rectangle((13, 11, 19, 13), fill=cream)
        draw.polygon(((8, 21), (9, 17), (12, 15), (15, 17), (16, 21)), fill=cream)
        draw.polygon(((16, 21), (17, 17), (20, 15), (23, 17), (24, 21)), fill=cream)
    elif currency == "nature":
        draw.polygon(((9, 18), (10, 13), (15, 9), (22, 9), (21, 16), (17, 21), (12, 21)), fill=cream)
        draw.line((11, 21, 20, 11), fill=dark, width=2)
        draw.polygon(((21, 17), (25, 22), (23, 25), (19, 25), (17, 22)), fill=cream)
    elif currency == "urban":
        draw.polygon(((8, 23), (8, 13), (13, 13), (13, 9), (19, 9), (19, 15), (24, 15), (24, 23)), fill=cream)
        for x, y in ((10, 15), (15, 12), (15, 16), (21, 18)):
            draw.rectangle((x, y, x + 1, y + 2), fill=dark)
    elif currency == "music":
        draw.rectangle((15, 9, 18, 21), fill=cream)
        draw.rectangle((18, 9, 23, 12), fill=cream)
        draw.rectangle((21, 11, 24, 19), fill=cream)
        draw.ellipse((10, 18, 17, 24), fill=cream)
        draw.ellipse((18, 17, 25, 23), fill=cream)
    elif currency == "lab":
        draw.rectangle((14, 8, 19, 11), fill=cream)
        draw.rectangle((15, 10, 18, 16), fill=cream)
        draw.polygon(((15, 14), (10, 23), (11, 25), (23, 25), (24, 23), (18, 14)), fill=cream)
        draw.polygon(((12, 22), (15, 18), (20, 18), (23, 22), (22, 24), (12, 24)), fill=dark)
        draw.rectangle((14, 20, 16, 22), fill=colors[currency])
        draw.rectangle((19, 21, 21, 23), fill=colors[currency])
    return image


def build_currency_icons() -> dict[str, Image.Image]:
    result = {}
    for currency in CURRENCIES:
        # Stage 3A's generated draft remains available through
        # draw_currency_icon and the archived review files, but rebuilds must
        # keep the selected asset-pack B runtime set.
        image, _motif = CURRENCY_BUILDER.refined_candidate(currency)
        write_png(image, ROOT / "public/assets/economy/village-currencies" / f"{currency}.png")
        result[currency] = image
    return result


def frame(sheet: Image.Image, column: int = 0, row: int = 0) -> Image.Image:
    return sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def composite(*layers: Image.Image) -> Image.Image:
    output = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    for layer in layers:
        output.alpha_composite(layer)
    return output


def nearest(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.NEAREST)


def build_previews(items: dict[str, dict], sheets: dict[str, Image.Image]) -> dict[str, Image.Image]:
    body = frame(rgba(ROOT / "public/assets/world/player_body.png"))
    basic = frame(rgba(ROOT / "public/assets/world/player_clothes.png"))
    hair = frame(rgba(ROOT / "public/assets/world/player_hair.png"))
    previews = {}
    for item_id in PAID_OUTFIT_IDS:
        preview = nearest(composite(body, frame(sheets[item_id]), hair), (PREVIEW_SIZE, PREVIEW_SIZE))
        write_png(preview, ROOT / "public/assets/economy/previews/outfits" / f"{item_id}.png")
        previews[item_id] = preview
    for item_id in ACCESSORY_IDS:
        preview = nearest(composite(body, basic, hair, frame(sheets[item_id])), (PREVIEW_SIZE, PREVIEW_SIZE))
        write_png(preview, ROOT / "public/assets/economy/previews/accessories" / f"{item_id}.png")
        previews[item_id] = preview
    return previews


def font(size: int = 13) -> ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def contact_sheet(ids: tuple[str, ...], previews: dict[str, Image.Image], columns: int, title: str) -> Image.Image:
    cell_w, cell_h = 150, 132
    rows = (len(ids) + columns - 1) // columns
    output = Image.new("RGBA", (columns * cell_w + 32, rows * cell_h + 58), "#F7F0E4")
    draw = ImageDraw.Draw(output)
    draw.text((16, 14), title, fill="#3E2918", font=font(20))
    for index, item_id in enumerate(ids):
        x = 16 + (index % columns) * cell_w
        y = 48 + (index // columns) * cell_h
        draw.rounded_rectangle((x, y, x + 134, y + 116), radius=8, fill="#E8DDCA", outline="#9B7A50", width=2)
        output.alpha_composite(previews[item_id], (x + 19, y + 4))
        draw.text((x + 8, y + 101), item_id, fill="#3E2918", font=font(11))
    return output


def build_currency_review(icons: dict[str, Image.Image]) -> None:
    output = Image.new("RGBA", (790, 292), "#F7F0E4")
    draw = ImageDraw.Draw(output)
    draw.text((18, 12), "Village currencies - light / dark / native HUD sizes", fill="#3E2918", font=font(20))
    for index, currency in enumerate(CURRENCIES):
        x = 18 + index * 128
        draw.rounded_rectangle((x, 50, x + 112, 142), radius=8, fill="#FFF9EF", outline="#C8A96E", width=2)
        output.alpha_composite(nearest(icons[currency], (64, 64)), (x + 24, 58))
        draw.text((x + 10, 124), currency, fill="#3E2918", font=font(12))
        draw.rounded_rectangle((x, 154, x + 112, 274), radius=8, fill="#182330", outline="#4F6572", width=2)
        output.alpha_composite(nearest(icons[currency], (64, 64)), (x + 24, 162))
        output.alpha_composite(icons[currency], (x + 14, 232))
        output.alpha_composite(nearest(icons[currency], (24, 24)), (x + 66, 236))
        draw.text((x + 10, 214), "64x   32x  24x", fill="#F7F0E4", font=font(10))
    write_png(output, REVIEW_DIR / "currency-icons-light-dark.png")


def build_layer_review(sheets: dict[str, Image.Image]) -> None:
    body = frame(rgba(ROOT / "public/assets/world/player_body.png"))
    basic = frame(rgba(ROOT / "public/assets/world/player_clothes.png"))
    hair = frame(rgba(ROOT / "public/assets/world/player_hair.png"))
    stages = (
        ("body", composite(body)),
        ("body + outfit", composite(body, frame(sheets["sailor_bow"]))),
        ("+ representative hair", composite(body, frame(sheets["sailor_bow"]), hair)),
        ("+ accessory after hair", composite(body, frame(sheets["sailor_bow"]), hair, frame(sheets["acc_hat_cowboy"]))),
    )
    output = Image.new("RGBA", (620, 190), "#25303A")
    draw = ImageDraw.Draw(output)
    draw.text((16, 12), "Front idle frame (down row 0, column 0)", fill="#FFF0D3", font=font(18))
    for index, (label, image) in enumerate(stages):
        x = 16 + index * 150
        draw.rounded_rectangle((x, 45, x + 134, 170), radius=8, fill="#F7F0E4", outline="#C8A96E", width=2)
        output.alpha_composite(nearest(image, (96, 96)), (x + 19, 49))
        draw.text((x + 8, 148), label, fill="#3E2918", font=font(10))
    write_png(output, REVIEW_DIR / "front-layer-comparison.png")


def build_baseline_review(previews: dict[str, Image.Image]) -> None:
    ids = PAID_OUTFIT_IDS
    output = Image.new("RGBA", (954, 472), "#F7F0E4")
    draw = ImageDraw.Draw(output)
    draw.text((18, 12), "Existing 5 vs newly exported 13 - identical 32x32 anchors", fill="#3E2918", font=font(19))
    groups = (("EXISTING / UNCHANGED", ids[:5], "#4E9F8E"), ("NEW CANONICAL WALK", ids[5:], "#9B6DD4"))
    y = 48
    for heading, group_ids, color in groups:
        draw.text((18, y), heading, fill=color, font=font(13))
        y += 22
        for index, item_id in enumerate(group_ids):
            x = 18 + (index % 9) * 102
            row_y = y + (index // 9) * 118
            draw.rectangle((x, row_y, x + 90, row_y + 108), fill="#E8DDCA", outline=color, width=2)
            output.alpha_composite(previews[item_id], (x - 3, row_y + 1))
            draw.text((x + 4, row_y + 94), item_id, fill="#3E2918", font=font(9))
        y += ((len(group_ids) + 8) // 9) * 118 + 12
    write_png(output, REVIEW_DIR / "outfit-existing-vs-new-anchors.png")


def build_scale_reviews(icons: dict[str, Image.Image], previews: dict[str, Image.Image]) -> None:
    zoom = Image.new("RGBA", (760, 260), "#15202A")
    draw = ImageDraw.Draw(zoom)
    draw.text((16, 12), "Nearest-neighbor pixel inspection (8x)", fill="#FFF0D3", font=font(18))
    samples = (("animal", icons["animal"]), ("lab", icons["lab"]), ("dress", previews["dress"].resize((32, 32), Image.Resampling.NEAREST)), ("mask", previews["acc_mask_spooky"].resize((32, 32), Image.Resampling.NEAREST)))
    for index, (label, image) in enumerate(samples):
        x = 16 + index * 186
        zoom.alpha_composite(nearest(image, (192, 192)), (x, 44))
        draw.text((x, 236), label, fill="#FFF0D3", font=font(12))
    write_png(zoom, REVIEW_DIR / "nearest-neighbor-8x.png")

    hud = Image.new("RGBA", (560, 128), "#F7F0E4")
    draw = ImageDraw.Draw(hud)
    draw.text((16, 10), "Actual HUD review: 32px and 24px", fill="#3E2918", font=font(16))
    for index, currency in enumerate(CURRENCIES):
        x = 18 + index * 89
        hud.alpha_composite(icons[currency], (x, 44))
        hud.alpha_composite(nearest(icons[currency], (24, 24)), (x + 42, 48))
        draw.text((x, 82), currency, fill="#3E2918", font=font(10))
    write_png(hud, REVIEW_DIR / "currency-icons-hud-sizes.png")


def build_reviews(icons: dict[str, Image.Image], sheets: dict[str, Image.Image], previews: dict[str, Image.Image]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    write_png(contact_sheet(PAID_OUTFIT_IDS, previews, 6, "Paid outfits - 18 front previews"), REVIEW_DIR / "outfits-contact-sheet.png")
    write_png(contact_sheet(ACCESSORY_IDS, previews, 4, "Paid accessories - 8 front previews"), REVIEW_DIR / "accessories-contact-sheet.png")
    build_currency_review(icons)
    build_layer_review(sheets)
    build_baseline_review(previews)
    build_scale_reviews(icons, previews)


def main() -> None:
    items = load_catalog_items()
    sheets = build_runtime_sheets(items)
    icons = build_currency_icons()
    previews = build_previews(items, sheets)
    build_reviews(icons, sheets, previews)
    print(f"built {len(PAID_OUTFIT_IDS)} outfit contracts, {len(ACCESSORY_IDS)} accessories, and {len(CURRENCIES)} currencies")


if __name__ == "__main__":
    main()
