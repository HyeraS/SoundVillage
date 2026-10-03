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
IDENTITY_CONTRACT_PATH = ROOT / "data/character-v2-runtime-contract.json"
FRAME = 32
WALK_SIZE = (256, 128)
PREVIEW_SIZE = 96
REVIEW_DIR = ROOT / "_review/economy-v1-assets"
STAGE2_REVIEW_DIR = ROOT / "_review/character-studio-stage2"
IDENTITY_PROJECTION_PATH = ROOT / "lib/generated/characterIdentityCatalog.mjs"

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
KNOWN_IDENTITY_MASTER_WALK_PIXEL_VARIANCES = {
    # The merged pack contains corrected palette RGB values for these two
    # styles while the separated walk exports retain the same alpha anchors.
    "hair_midiwave": (0, 112, 112, 477, 237, 112, 352, 112, 112, 112, 112, 112, 112, 112),
    "hair_wavy": (781, 24, 781, 781, 781, 781, 781, 781, 781, 781, 781, 781, 781, 781),
}

CURRENCY_BUILD_SCRIPT = ROOT / "scripts/build-village-currency-icons.py"
CURRENCY_BUILD_SPEC = importlib.util.spec_from_file_location("village_currency_builder", CURRENCY_BUILD_SCRIPT)
assert CURRENCY_BUILD_SPEC and CURRENCY_BUILD_SPEC.loader
CURRENCY_BUILDER = importlib.util.module_from_spec(CURRENCY_BUILD_SPEC)
CURRENCY_BUILD_SPEC.loader.exec_module(CURRENCY_BUILDER)


def load_catalog_items() -> dict[str, dict]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return {item["id"]: item for item in catalog["items"]}


def load_identity_contract() -> dict:
    return json.loads(IDENTITY_CONTRACT_PATH.read_text(encoding="utf-8"))


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


def checked_walk_blocks(source_path: Path, walk_path: Path, count: int, label: str) -> list[Image.Image]:
    master = rgba(source_path)
    separated = rgba(walk_path)
    expected_width = WALK_SIZE[0] * count
    if master.width != expected_width or master.height < WALK_SIZE[1]:
        raise ValueError(f"{label}: expected {count} palettes in a {expected_width}px-wide master, got {master.size}")
    if separated.size != (expected_width, WALK_SIZE[1]):
        raise ValueError(f"{label}: unexpected separated walk size {separated.size}")
    blocks = []
    for index in range(count):
        box = (index * WALK_SIZE[0], 0, (index + 1) * WALK_SIZE[0], WALK_SIZE[1])
        master_block = master.crop(box)
        walk_block = separated.crop(box)
        differing_pixels = sum(
            master_pixel != walk_pixel
            for master_pixel, walk_pixel in zip(master_block.get_flattened_data(), walk_block.get_flattened_data())
        )
        expected_variances = KNOWN_IDENTITY_MASTER_WALK_PIXEL_VARIANCES.get(label, (0,) * count)
        if differing_pixels != expected_variances[index]:
            raise ValueError(
                f"{label}: palette {index} master/separated variance is {differing_pixels}, "
                f"expected {expected_variances[index]}"
            )
        if master_block.getchannel("A").tobytes() != walk_block.getchannel("A").tobytes():
            raise ValueError(f"{label}: palette {index} master/separated alpha anchors differ")
        blocks.append(master_block)
    return blocks


def identity_runtime_paths(contract: dict) -> dict:
    hair_colors = contract["hairColors"]
    return {
        "skins": {f"skin_{index:02d}": f"/assets/character-v2/skin/skin-{index:02d}-walk.png" for index in range(1, 9)},
        "eyes": {entry["id"]: f"/assets/character-v2/eyes/{entry['colorId'].replace('_', '-')}-walk.png" for entry in contract["eyeColors"]},
        "hair": {
            style["id"]: {
                color["id"]: f"/assets/character-v2/hair/{style['slug']}/{color['id'].replace('_', '-')}-walk.png"
                for color in hair_colors
            }
            for style in contract["hairStyles"]
        },
        "hairSkirt": {
            style["id"]: {
                color["id"]: f"/assets/character-v2/hair/{style['slug']}/{color['id'].replace('_', '-')}-skirt-walk.png"
                for color in hair_colors
            }
            for style in contract["hairStyles"] if style.get("skirtSource")
        },
    }


def build_identity_runtime_sheets(items: dict[str, dict], contract: dict) -> tuple[dict, dict]:
    paths = identity_runtime_paths(contract)
    sheets = {"skins": {}, "eyes": {}, "hair": {}, "hairSkirt": {}}
    color_names = [color["name"] for color in contract["hairColors"]]
    eye_ids = [eye["id"] for eye in contract["eyeColors"]]
    catalog_eye_ids = [item["id"] for item in items.values() if item.get("productGroup") == "identity" and item.get("type") == "eyes"]
    if catalog_eye_ids != eye_ids:
        raise ValueError(f"eye palette order differs from the central contract: {catalog_eye_ids}")

    for index in range(1, 9):
        item_id = f"skin_{index:02d}"
        item = items[item_id]
        blocks = checked_walk_blocks(
            ROOT / item["sourceAsset"],
            ROOT / f"assets/Character v.2/separate/walk/char{index}_walk.png",
            1,
            item_id,
        )
        sheet = blocks[0]
        write_png(sheet, public_path(paths["skins"][item_id]))
        sheets["skins"][item_id] = sheet

    eye_source = ROOT / items["eyes_black"]["sourceAsset"]
    eye_blocks = checked_walk_blocks(
        eye_source,
        ROOT / "assets/Character v.2/separate/walk/eyes/eyes_walk.png",
        len(contract["eyeColors"]),
        "eyes",
    )
    for index, entry in enumerate(contract["eyeColors"]):
        write_png(eye_blocks[index], public_path(paths["eyes"][entry["id"]]))
        sheets["eyes"][entry["id"]] = eye_blocks[index]

    for style in contract["hairStyles"]:
        item = items[style["id"]]
        if item.get("availableColors") != color_names or item.get("sourcePaletteCount") != len(color_names):
            raise ValueError(f"{style['id']}: catalog palette contract differs from the central mapping")
        blocks = checked_walk_blocks(
            ROOT / item["sourceAsset"],
            ROOT / "assets/Character v.2/separate/walk/hair" / f"{style['walkStem']}_walk.png",
            len(contract["hairColors"]),
            style["id"],
        )
        sheets["hair"][style["id"]] = {}
        for index, color in enumerate(contract["hairColors"]):
            write_png(blocks[index], public_path(paths["hair"][style["id"]][color["id"]]))
            sheets["hair"][style["id"]][color["id"]] = blocks[index]

        if style.get("skirtSource"):
            master = rgba(ROOT / style["skirtSource"])
            expected_width = WALK_SIZE[0] * len(contract["hairColors"])
            if master.size != (expected_width, 1568):
                raise ValueError(f"{style['id']}: unexpected skirt variant size {master.size}")
            sheets["hairSkirt"][style["id"]] = {}
            for index, color in enumerate(contract["hairColors"]):
                block = master.crop((index * WALK_SIZE[0], 0, (index + 1) * WALK_SIZE[0], WALK_SIZE[1]))
                write_png(block, public_path(paths["hairSkirt"][style["id"]][color["id"]]))
                sheets["hairSkirt"][style["id"]][color["id"]] = block
    return paths, sheets


def identity_preview(*layers: Image.Image) -> Image.Image:
    return nearest(composite(*(frame(layer) for layer in layers)), (PREVIEW_SIZE, PREVIEW_SIZE))


def build_identity_previews(items: dict[str, dict], contract: dict, sheets: dict) -> dict:
    basic = frame(rgba(ROOT / "public/assets/world/player_clothes.png"))
    previews = {"skins": {}, "hairStyles": {}, "hairColors": {}, "eyes": {}}
    default_skin = sheets["skins"]["skin_01"]
    default_hair = sheets["hair"]["hair_buzzcut"]["black"]

    for index in range(1, 9):
        item_id = f"skin_{index:02d}"
        image = nearest(composite(frame(sheets["skins"][item_id]), basic, frame(default_hair)), (PREVIEW_SIZE, PREVIEW_SIZE))
        path = f"/assets/character-v2/previews/skin/skin-{index:02d}.png"
        write_png(image, public_path(path))
        previews["skins"][item_id] = (path, image)
    for style in contract["hairStyles"]:
        image = nearest(composite(frame(default_skin), basic, frame(sheets["hair"][style["id"]]["black"])), (PREVIEW_SIZE, PREVIEW_SIZE))
        path = f"/assets/character-v2/previews/hair-style/{style['slug']}.png"
        write_png(image, public_path(path))
        previews["hairStyles"][style["id"]] = (path, image)
    for color in contract["hairColors"]:
        image = nearest(composite(frame(default_skin), basic, frame(sheets["hair"]["hair_buzzcut"][color["id"]])), (PREVIEW_SIZE, PREVIEW_SIZE))
        path = f"/assets/character-v2/previews/hair-color/{color['id'].replace('_', '-')}.png"
        write_png(image, public_path(path))
        previews["hairColors"][color["id"]] = (path, image)
    for eye in contract["eyeColors"]:
        eye_layer = None if eye["id"] == contract["defaultLoadout"]["eyesId"] else frame(sheets["eyes"][eye["id"]])
        layers = [frame(default_skin)] + ([eye_layer] if eye_layer else []) + [basic, frame(default_hair)]
        image = nearest(composite(*layers), (PREVIEW_SIZE, PREVIEW_SIZE))
        path = f"/assets/character-v2/previews/eyes/{eye['colorId'].replace('_', '-')}.png"
        write_png(image, public_path(path))
        previews["eyes"][eye["id"]] = (path, image)
    return previews


def simple_identity_contact(title: str, entries: list[tuple[str, Image.Image]], columns: int) -> Image.Image:
    cell_w, cell_h = 132, 126
    rows = (len(entries) + columns - 1) // columns
    output = Image.new("RGBA", (columns * cell_w + 32, rows * cell_h + 58), "#F7F0E4")
    draw = ImageDraw.Draw(output)
    draw.text((16, 14), title, fill="#3E2918", font=font(20))
    for index, (label, image) in enumerate(entries):
        x = 16 + index % columns * cell_w
        y = 48 + index // columns * cell_h
        draw.rounded_rectangle((x, y, x + 116, y + 110), radius=8, fill="#E8DDCA", outline="#9B7A50", width=2)
        output.alpha_composite(image, (x + 10, y + 2))
        draw.text((x + 7, y + 96), label, fill="#3E2918", font=font(10))
    return output


def build_identity_projection(items: dict[str, dict], contract: dict, paths: dict, previews: dict) -> None:
    projection = {
        "version": contract["version"],
        "defaultLoadout": contract["defaultLoadout"],
        "skins": [{
            "id": item_id,
            "name": items[item_id]["name"],
            "type": "skin",
            "runtimeAsset": paths["skins"][item_id],
            "previewAsset": previews["skins"][item_id][0],
            "available": True,
        } for item_id in paths["skins"]],
        "hairStyles": [{
            "id": style["id"],
            "name": items[style["id"]]["name"],
            "type": "hair",
            "slug": style["slug"],
            "previewAsset": previews["hairStyles"][style["id"]][0],
            "available": True,
            "hasSkirtVariant": style["id"] in paths["hairSkirt"],
        } for style in contract["hairStyles"]],
        "hairColors": [{
            **color,
            "previewAsset": previews["hairColors"][color["id"]][0],
            "available": True,
        } for color in contract["hairColors"]],
        "eyes": [{
            "id": eye["id"],
            "colorId": eye["colorId"],
            "name": eye["name"],
            "type": "eyes",
            "runtimeAsset": paths["eyes"][eye["id"]],
            "previewAsset": previews["eyes"][eye["id"]][0],
            "available": True,
        } for eye in contract["eyeColors"]],
        "skirtVariantOutfitIds": contract["skirtVariantOutfitIds"],
    }
    IDENTITY_PROJECTION_PATH.parent.mkdir(parents=True, exist_ok=True)
    paid_projection = [{
        key: item[key] for key in (
            "id", "name", "type", "productGroup", "runtimeAsset", "previewAsset",
            "rarity", "priceTier", "currencyCombination", "cost",
        ) if key in item
    } for item in items.values() if item.get("productGroup") in ("outfit", "accessory")
        and item.get("officialStoreStatus") == "approved" and item.get("existingGameConnected") is True]
    payload = json.dumps(projection, ensure_ascii=False, indent=2)
    paid_payload = json.dumps(paid_projection, ensure_ascii=False, indent=2)
    IDENTITY_PROJECTION_PATH.write_text(
        "// Generated by scripts/build-character-v2-runtime-assets.py\n"
        f"export const CHARACTER_IDENTITY_CATALOG = Object.freeze({payload})\n"
        f"export const CHARACTER_STUDIO_ITEMS = Object.freeze({paid_payload})\n",
        encoding="utf-8",
    )


def build_identity_reviews(contract: dict, previews: dict) -> None:
    STAGE2_REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    write_png(simple_identity_contact("Character V2 skins - 8", [(key, value[1]) for key, value in previews["skins"].items()], 4), STAGE2_REVIEW_DIR / "asset-contact-sheet-skins.png")
    hair_entries = [(style["id"], previews["hairStyles"][style["id"]][1]) for style in contract["hairStyles"]]
    write_png(simple_identity_contact("Character V2 hair styles - 13 (black palette)", hair_entries, 5), STAGE2_REVIEW_DIR / "asset-contact-sheet-hair.png")
    eye_entries = [(eye["name"], previews["eyes"][eye["id"]][1]) for eye in contract["eyeColors"]]
    write_png(simple_identity_contact("Character V2 eye colors - 14", eye_entries, 5), STAGE2_REVIEW_DIR / "asset-contact-sheet-eyes.png")


def main() -> None:
    items = load_catalog_items()
    sheets = build_runtime_sheets(items)
    icons = build_currency_icons()
    previews = build_previews(items, sheets)
    build_reviews(icons, sheets, previews)
    contract = load_identity_contract()
    identity_paths, identity_sheets = build_identity_runtime_sheets(items, contract)
    identity_previews = build_identity_previews(items, contract, identity_sheets)
    build_identity_projection(items, contract, identity_paths, identity_previews)
    build_identity_reviews(contract, identity_previews)
    print(
        f"built {len(PAID_OUTFIT_IDS)} outfit contracts, {len(ACCESSORY_IDS)} accessories, "
        f"{len(CURRENCIES)} currencies, 8 skins, 13x14 hair sheets, 14 eyes, and 28 skirt hair variants"
    )


if __name__ == "__main__":
    main()
