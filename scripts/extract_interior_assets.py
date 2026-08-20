#!/usr/bin/env python3
"""Extract purchasable Cozy Interior sprites using grid-aware alpha scans.

The source pack uses a 16 px base grid, but several sheets reserve larger cells.
Each non-empty cell is alpha-trimmed, hashed, and written with its source crop
coordinates to lib/generatedHouseAssets.json. Animated GIFs are copied intact.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "interior full"
OUTPUT = ROOT / "public" / "house-assets" / "generated"
RUNTIME_CATALOG = ROOT / "lib" / "generatedHouseAssets.json"
AUDIT_MANIFEST = ROOT / "docs" / "interior_asset_manifest.json"
SAMPLE_DIR = ROOT / "docs" / "interior_asset_samples"


@dataclass(frozen=True)
class SheetSpec:
    path: str
    category: str
    label: str
    cell_w: int
    cell_h: int


SHEETS = [
    SheetSpec("basics/wallpapers.png", "벽지", "패턴 벽지", 16, 16),
    SheetSpec("basics/curtains.png", "커튼", "패브릭 커튼", 32, 32),
    SheetSpec("basics/doors.png", "문", "인테리어 도어", 48, 32),
    SheetSpec("basics/fireplaces.png", "벽난로", "클래식 벽난로", 16, 16),
    SheetSpec("basics/rugs.png", "러그", "패턴 러그", 32, 32),
    SheetSpec("basics/stairs.png", "계단", "우드 계단", 16, 32),
    SheetSpec("furniture/bathroom.png", "욕실", "욕실 소품", 16, 16),
    SheetSpec("furniture/beds.png", "침실", "침실 가구", 32, 32),
    SheetSpec("furniture/boxes.png", "수납", "수납 박스", 16, 16),
    SheetSpec("furniture/chairs.png", "의자", "의자", 16, 32),
    SheetSpec("furniture/couches.png", "소파", "소파", 32, 32),
    SheetSpec("furniture/couchtables.png", "테이블", "소파 테이블", 32, 16),
    SheetSpec("furniture/decorations.png", "소품", "데코 소품", 16, 16),
    SheetSpec("furniture/kidsroom.png", "키즈", "키즈룸 소품", 16, 16),
    SheetSpec("furniture/kitchen_tiles.png", "주방", "주방 모듈", 16, 16),
    SheetSpec("furniture/kitchens_assembled.png", "주방", "완성형 주방", 32, 32),
    SheetSpec("furniture/storage.png", "수납", "수납 가구", 32, 48),
    SheetSpec("furniture/tables.png", "테이블", "테이블", 32, 32),
    SheetSpec("furniture/wallshelves.png", "벽선반", "벽 선반", 16, 16),
    SheetSpec("pets/pets.png", "펫", "반려동물 소품", 16, 16),
]


CATEGORY_PRICE = {
    "벽지": 18, "커튼": 16, "문": 24, "벽난로": 34, "러그": 14,
    "계단": 28, "욕실": 22, "침실": 30, "수납": 24, "의자": 16,
    "소파": 30, "테이블": 20, "소품": 12, "키즈": 18, "주방": 28,
    "벽선반": 14, "펫": 32, "TV": 34, "조명": 18,
}

MIN_DIMENSIONS = {
    "벽지": (8, 8), "커튼": (4, 4), "문": (8, 8), "벽난로": (5, 5),
    "러그": (8, 8), "계단": (5, 5), "욕실": (3, 3), "침실": (4, 4),
    "수납": (4, 4), "의자": (5, 8), "소파": (5, 5), "테이블": (5, 5),
    "소품": (2, 2), "키즈": (3, 3), "주방": (3, 3), "벽선반": (4, 3),
    "펫": (2, 2),
}

MAX_COMPONENT_SPAN = {
    "basics/wallpapers.png": (1, 1), "basics/curtains.png": (1, 1),
    "basics/fireplaces.png": (1, 1), "basics/rugs.png": (1, 1),
    "furniture/boxes.png": (1, 1), "furniture/chairs.png": (1, 1),
    "furniture/decorations.png": (1, 1), "pets/pets.png": (1, 1),
    "furniture/kidsroom.png": (5, 2), "furniture/kitchens_assembled.png": (4, 2),
    "furniture/wallshelves.png": (2, 1),
}

ANIMATION_ONLY_SHEETS = {"basics/doors.png", "basics/fireplaces.png"}
SHEET_SCAN_BOUNDS = {"pets/pets.png": (0, 0, 608, 96)}
WALLPAPER_TILE_BOUNDS = (112, 0, 640, 704)
WALLPAPER_PAIRED_END_Y = 512


def slug(value: str) -> str:
    value = value.lower().replace(" ", "-")
    return re.sub(r"[^a-z0-9-]+", "-", value).strip("-")


def category_for_gif(relative: Path) -> tuple[str, str]:
    text = relative.as_posix().lower()
    if "holidaytree" in text:
        return "소품", "애니메이션 장식"
    if "tv gifs" in text:
        return "TV", "애니메이션 TV"
    if "door" in text:
        return "문", "애니메이션 도어"
    if "fireplace" in text:
        return ("조명", "애니메이션 촛대") if "candle" in relative.name.lower() else ("벽난로", "애니메이션 벽난로")
    return "펫", "움직이는 반려동물"


def pixel_digest(image: Image.Image) -> str:
    rgba = image.convert("RGBA")
    return hashlib.sha1(rgba.size.__repr__().encode() + rgba.tobytes()).hexdigest()[:12]


def family_digest(image: Image.Image, category: str) -> str:
    rgba = image.convert("RGBA")
    if category == "벽지":
        rgb = rgba.convert("RGB")
        values = list(rgb.get_flattened_data())
        edge = Image.new("L", rgb.size)
        edge_values = []
        for y in range(rgb.height):
            for x in range(rgb.width):
                here = values[y * rgb.width + x]
                right = values[y * rgb.width + min(rgb.width - 1, x + 1)]
                below = values[min(rgb.height - 1, y + 1) * rgb.width + x]
                distance = max(max(abs(a - b) for a, b in zip(here, right)), max(abs(a - b) for a, b in zip(here, below)))
                edge_values.append(255 if distance >= 18 else 0)
        edge.putdata(edge_values)
        bits = bytes(1 if value >= 64 else 0 for value in edge.resize((8, 8), Image.Resampling.BOX).get_flattened_data())
        return hashlib.sha1(bits).hexdigest()[:10]
    alpha = rgba.getchannel("A").resize((8, 8), Image.Resampling.LANCZOS)
    silhouette = bytes(1 if value >= 64 else 0 for value in alpha.get_flattened_data())
    aspect_bucket = round((rgba.width / max(1, rgba.height)) * 4)
    return hashlib.sha1(bytes([min(255, aspect_bucket)]) + silhouette).hexdigest()[:10]


def sheet_subcategory(spec: SheetSpec, x: int, y: int) -> str:
    if spec.path == "basics/wallpapers.png":
        if y < 240:
            return "단색·스트라이프"
        if y < 384:
            return "플로럴·캐릭터"
        if y < 512:
            return "시즌·장식"
        if y < 656:
            return "벽돌·우드"
        return "스톤·타일"
    if spec.path == "furniture/decorations.png":
        if x < 304 and y < 208:
            return "화분·꽃"
        if 304 <= x < 560 and y < 208:
            return "조명 소품"
        if y >= 208 and x < 560:
            return "벽 장식"
        return "장식 소품"
    return spec.label


def gif_family(relative: Path, category: str) -> tuple[str, str]:
    stem = relative.stem.lower()
    if category == "TV":
        retro = stem.startswith("retrotv")
        return ("retro-tv", "레트로 TV") if retro else ("modern-tv", "모던 TV")
    if category == "문":
        match = re.search(r"door(\d+)", stem)
        number = match.group(1) if match else "기본"
        return f"door-{number}", f"도어 디자인 {number}"
    if category in {"벽난로", "조명"}:
        base = re.sub(r"_(beige|black|darkbrown|grey|redbeige|redbrown|white|gold|silver|red)$", "", stem)
        return slug(base), base.replace("_", " ")
    species = relative.parts[-2] if len(relative.parts) > 1 else "pet"
    return slug(species), {"cat": "고양이", "yorkie": "요크셔테리어", "budgie": "잉꼬", "hamster": "햄스터", "aquariums": "수족관"}.get(species, "반려동물")


def alpha_trim(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]] | None:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        return None
    cropped = rgba.crop(bbox)
    if sum(cropped.getchannel("A").histogram()[1:]) < 3:
        return None
    return cropped, bbox


def animated_frame_digests() -> set[str]:
    digests: set[str] = set()
    for source_path in SOURCE.rglob("*.gif"):
        image = Image.open(source_path)
        for frame_index in range(getattr(image, "n_frames", 1)):
            image.seek(frame_index)
            scanned = alpha_trim(image.convert("RGBA"))
            if scanned:
                digests.add(pixel_digest(scanned[0]))
    return digests


def extract_sheets(animated_hashes: set[str]) -> list[dict]:
    items: list[dict] = []
    for spec in SHEETS:
        if spec.path in ANIMATION_ONLY_SHEETS:
            continue
        source_path = SOURCE / spec.path
        sheet = Image.open(source_path).convert("RGBA")
        sheet_array = np.array(sheet)
        scan_x0, scan_y0, scan_x1, scan_y1 = SHEET_SCAN_BOUNDS.get(spec.path, (0, 0, sheet.width, sheet.height))
        if (scan_x0, scan_y0, scan_x1, scan_y1) != (0, 0, sheet.width, sheet.height):
            outside = np.ones(sheet_array.shape[:2], dtype=bool)
            outside[scan_y0:scan_y1, scan_x0:scan_x1] = False
            sheet_array[outside, 3] = 0
        labels, component_count = ndimage.label(sheet_array[:, :, 3] > 0, structure=np.ones((3, 3), dtype=int))
        component_slices = ndimage.find_objects(labels)
        seen: set[str] = set()
        family_numbers: dict[tuple[str, str], int] = {}
        variant = 0
        max_span_x, max_span_y = MAX_COMPONENT_SPAN.get(spec.path, (2, 2))

        def emit(
            sprite: Image.Image,
            crop_box: tuple[int, int, int, int],
            cell_box: tuple[int, int, int, int],
            mode: str,
            subcategory_override: str | None = None,
            family_key_override: str | None = None,
            family_name_override: str | None = None,
            identity_digest_override: str | None = None,
        ) -> dict | None:
            nonlocal variant
            min_width, min_height = MIN_DIMENSIONS[spec.category]
            if sprite.width < min_width or sprite.height < min_height:
                return None
            digest = identity_digest_override or pixel_digest(sprite)
            if digest in seen or digest in animated_hashes:
                return None
            seen.add(digest)
            variant += 1
            crop_x, crop_y, crop_w, crop_h = crop_box
            cell_x, cell_y, cell_w, cell_h = cell_box
            subcategory = subcategory_override or sheet_subcategory(spec, crop_x, crop_y)
            family_hash = family_key_override or family_digest(sprite, spec.category)
            family_key = (subcategory, family_hash)
            if family_key not in family_numbers:
                family_numbers[family_key] = len(family_numbers) + 1
            family_number = family_numbers[family_key]
            family_id_hash = hashlib.sha1(f"{subcategory}:{family_hash}".encode()).hexdigest()[:10]
            filename = f"{slug(Path(spec.path).stem)}-{variant:04d}-{digest}.png"
            destination = OUTPUT / slug(spec.category) / filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            sprite.save(destination, optimize=True)
            item = {
                "id": f"house_asset_{slug(Path(spec.path).stem)}_{digest}",
                "name": f"{spec.label} {variant}",
                "category": spec.category,
                "subcategory": subcategory,
                "familyId": f"family_{slug(Path(spec.path).stem)}_{family_id_hash}",
                "familyName": family_name_override or f"{subcategory} 스타일 {family_number}",
                "description": f"Cozy Interior 원본에서 추출한 {spec.label} 아이템이에요.",
                "price": CATEGORY_PRICE[spec.category],
                "asset": "/" + destination.relative_to(ROOT / "public").as_posix(),
                "width": sprite.width,
                "height": sprite.height,
                "animated": False,
                "source": spec.path,
                "crop": {"x": crop_x, "y": crop_y, "width": crop_w, "height": crop_h},
                "cell": {"x": cell_x, "y": cell_y, "width": cell_w, "height": cell_h},
                "extractionMode": mode,
                "hash": digest,
            }
            items.append(item)
            return item

        # wallpapers.png의 왼쪽 112 px는 반복 벽지가 아니라 방의 외곽선과
        # ㄱ/ㄴ자 모서리를 조립하기 위한 구조 타일이다. 이를 16 px로 자르지
        # 않고 원본 배치에 맞춰 완성된 32 px 모듈 3종으로 재조립한다.
        # 실제 패턴 영역은 알파 트리밍 없이 셀 캔버스를 그대로 보존해야
        # 반복 배치 시 가장자리와 투명 여백에 이음새가 생기지 않는다.
        if spec.path == "basics/wallpapers.png":
            for group_y in range(0, sheet.height, 48):
                construction_modules = (
                    (0, group_y + 16, 32, 32, "frame-moulding", "프레임 몰딩"),
                    (40, group_y + 8, 32, 32, "inset-moulding", "인셋 몰딩"),
                    (80, group_y + 16, 32, 32, "vertical-moulding", "세로 몰딩"),
                )
                for x, y, width, height, family_key, family_name in construction_modules:
                    if y + height > sheet.height:
                        continue
                    sprite = sheet.crop((x, y, x + width, y + height))
                    if not sprite.getchannel("A").getbbox():
                        continue
                    emit(
                        sprite,
                        (x, y, width, height),
                        (x, y, width, height),
                        "wallpaper-assembled-module",
                        "벽 몰딩·모서리",
                        family_key,
                        family_name,
                    )

            tile_x0, _, tile_x1, tile_y1 = WALLPAPER_TILE_BOUNDS

            # 원본의 y=0..511 구간은 두 줄이 한 벽지 세트다. 첫 16 px는
            # 반복되는 벽면 본체, 다음 16 px는 바닥에 한 번만 붙는 하단
            # 마감이다. 두 줄을 별도 상품으로 만들면 걸레받이가 벽 전체에
            # 반복되므로 하나의 카탈로그 항목과 두 개의 렌더링 레이어로 묶는다.
            for y in range(0, WALLPAPER_PAIRED_END_Y, spec.cell_h * 2):
                for x in range(tile_x0, tile_x1, spec.cell_w):
                    body = sheet.crop((x, y, x + spec.cell_w, y + spec.cell_h))
                    trim = sheet.crop((x, y + spec.cell_h, x + spec.cell_w, y + spec.cell_h * 2))
                    if not body.getchannel("A").getbbox():
                        continue
                    body_digest = pixel_digest(body)
                    trim_digest = pixel_digest(trim)
                    identity_digest = hashlib.sha1(f"{body_digest}:{trim_digest}".encode()).hexdigest()[:12]
                    set_number = y // (spec.cell_h * 2) + 1
                    item = emit(
                        body,
                        (x, y, spec.cell_w, spec.cell_h),
                        (x, y, spec.cell_w, spec.cell_h * 2),
                        "wallpaper-body-with-bottom-trim",
                        family_key_override=f"wall-set-{set_number}",
                        family_name_override=f"벽지 세트 {set_number}",
                        identity_digest_override=identity_digest,
                    )
                    if item is None or body_digest == trim_digest:
                        continue
                    trim_filename = f"{slug(Path(spec.path).stem)}-{variant:04d}-{identity_digest}-trim.png"
                    trim_destination = OUTPUT / slug(spec.category) / trim_filename
                    trim.save(trim_destination, optimize=True)
                    item["wallpaperTrimAsset"] = "/" + trim_destination.relative_to(ROOT / "public").as_posix()
                    item["wallpaperTrimCrop"] = {"x": x, "y": y + spec.cell_h, "width": spec.cell_w, "height": spec.cell_h}

            # y=512 이후는 벽돌·석재·바닥 전환 타일처럼 각 셀이 독립된
            # 패턴이므로 기존 16 px 타일 단위로 보존한다.
            for y in range(WALLPAPER_PAIRED_END_Y, tile_y1, spec.cell_h):
                for x in range(tile_x0, tile_x1, spec.cell_w):
                    sprite = sheet.crop((x, y, x + spec.cell_w, y + spec.cell_h))
                    if not sprite.getchannel("A").getbbox():
                        continue
                    emit(sprite, (x, y, spec.cell_w, spec.cell_h), (x, y, spec.cell_w, spec.cell_h), "wallpaper-full-tile")
            continue

        merged_labels: set[int] = set()
        for label_index in range(1, component_count + 1):
            component_slice = component_slices[label_index - 1]
            if component_slice is None:
                continue
            y_slice, x_slice = component_slice
            span_x = ((x_slice.stop - 1) // spec.cell_w) - (x_slice.start // spec.cell_w) + 1
            span_y = ((y_slice.stop - 1) // spec.cell_h) - (y_slice.start // spec.cell_h) + 1
            if span_x == 1 and span_y == 1:
                continue
            if span_x > max_span_x or span_y > max_span_y:
                continue
            component_pixels = int((labels[component_slice] == label_index).sum())
            if component_pixels < 3:
                continue
            contained_labels = set(np.unique(labels[component_slice])) - {0, label_index}
            if contained_labels:
                continue
            sprite = sheet.crop((x_slice.start, y_slice.start, x_slice.stop, y_slice.stop))
            crop_box = (x_slice.start, y_slice.start, x_slice.stop - x_slice.start, y_slice.stop - y_slice.start)
            cell_x = (x_slice.start // spec.cell_w) * spec.cell_w
            cell_y = (y_slice.start // spec.cell_h) * spec.cell_h
            cell_box = (cell_x, cell_y, span_x * spec.cell_w, span_y * spec.cell_h)
            emit(sprite, crop_box, cell_box, "connected-component")
            merged_labels.add(label_index)

        residual = sheet_array.copy()
        if merged_labels:
            residual[np.isin(labels, list(merged_labels)), 3] = 0
        residual_image = Image.fromarray(residual)
        for y in range(scan_y0, scan_y1, spec.cell_h):
            for x in range(scan_x0, scan_x1, spec.cell_w):
                cell_w = min(spec.cell_w, sheet.width - x)
                cell_h = min(spec.cell_h, scan_y1 - y)
                scanned = alpha_trim(residual_image.crop((x, y, x + cell_w, y + cell_h)))
                if not scanned:
                    continue
                sprite, local_bbox = scanned
                lx0, ly0, lx1, ly1 = local_bbox
                emit(sprite, (x + lx0, y + ly0, lx1 - lx0, ly1 - ly0), (x, y, cell_w, cell_h), "grid-alpha")
    return items


def extract_gifs(existing_hashes: set[str]) -> list[dict]:
    items: list[dict] = []
    for source_path in sorted(SOURCE.rglob("*.gif")):
        relative = source_path.relative_to(SOURCE)
        image = Image.open(source_path)
        first = image.convert("RGBA")
        digest = pixel_digest(first)
        unique_key = hashlib.sha1(source_path.read_bytes()).hexdigest()[:12]
        if unique_key in existing_hashes:
            continue
        existing_hashes.add(unique_key)
        category, label = category_for_gif(relative)
        family_key, family_name = gif_family(relative, category)
        filename = f"{slug(source_path.stem)}-{unique_key}.gif"
        destination = OUTPUT / slug(category) / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination)
        items.append({
            "id": f"house_asset_{slug(source_path.stem)}_{unique_key}",
            "name": source_path.stem.replace("_", " ").replace("-", " "),
            "category": category,
            "subcategory": family_name,
            "familyId": f"family_{slug(category)}_{family_key}",
            "familyName": family_name,
            "description": f"Cozy Interior 원본의 {label} 아이템이에요.",
            "price": CATEGORY_PRICE[category],
            "asset": "/" + destination.relative_to(ROOT / "public").as_posix(),
            "width": image.width,
            "height": image.height,
            "animated": True,
            "frames": getattr(image, "n_frames", 1),
            "source": relative.as_posix(),
            "crop": {"x": 0, "y": 0, "width": image.width, "height": image.height},
            "cell": {"x": 0, "y": 0, "width": image.width, "height": image.height},
            "hash": digest,
        })
    return items


def build_contact_sheets(items: list[dict]) -> None:
    if SAMPLE_DIR.exists():
        shutil.rmtree(SAMPLE_DIR)
    SAMPLE_DIR.mkdir(parents=True)
    categories = sorted({item["category"] for item in items})
    for category in categories:
        category_items = [item for item in items if item["category"] == category]
        sample_count = min(64, len(category_items))
        indexes = [round(index * (len(category_items) - 1) / max(1, sample_count - 1)) for index in range(sample_count)]
        canvas = Image.new("RGBA", (8 * 72, 8 * 72), "#f3e7d3")
        for position, item_index in enumerate(indexes):
            item = category_items[item_index]
            image = Image.open(ROOT / "public" / item["asset"].lstrip("/"))
            image.seek(0)
            sprite = image.convert("RGBA")
            sprite.thumbnail((56, 56), Image.Resampling.NEAREST)
            x = (position % 8) * 72 + (72 - sprite.width) // 2
            y = (position // 8) * 72 + (72 - sprite.height) // 2
            canvas.alpha_composite(sprite, (x, y))
        canvas.save(SAMPLE_DIR / f"{category}.png", optimize=True)


def validate_extraction(items: list[dict]) -> dict[str, int]:
    source_cache: dict[str, Image.Image] = {}
    checked = 0
    for item in items:
        output_path = ROOT / "public" / item["asset"].lstrip("/")
        source_path = SOURCE / item["source"]
        if item["animated"]:
            if output_path.read_bytes() != source_path.read_bytes():
                raise RuntimeError(f"GIF copy mismatch: {item['source']}")
        else:
            source = source_cache.setdefault(item["source"], Image.open(source_path).convert("RGBA"))
            crop = item["crop"]
            expected = source.crop((crop["x"], crop["y"], crop["x"] + crop["width"], crop["y"] + crop["height"]))
            actual = Image.open(output_path).convert("RGBA")
            expected_array = np.array(expected)
            actual_array = np.array(actual)
            visible = actual_array[:, :, 3] > 0 if actual.size == expected.size else np.array([], dtype=bool)
            pixels_match_source = actual.size == expected.size and np.array_equal(actual_array[visible], expected_array[visible])
            if not pixels_match_source:
                raise RuntimeError(f"PNG crop mismatch: {item['source']} {crop} mode={item.get('extractionMode')} output={output_path} expected={pixel_digest(expected)} actual={pixel_digest(actual)}")
            if item.get("wallpaperTrimAsset"):
                trim_crop = item["wallpaperTrimCrop"]
                expected_trim = source.crop((trim_crop["x"], trim_crop["y"], trim_crop["x"] + trim_crop["width"], trim_crop["y"] + trim_crop["height"]))
                actual_trim = Image.open(ROOT / "public" / item["wallpaperTrimAsset"].lstrip("/")).convert("RGBA")
                if actual_trim.size != expected_trim.size or not np.array_equal(np.array(actual_trim), np.array(expected_trim)):
                    raise RuntimeError(f"Wallpaper trim mismatch: {item['source']} {trim_crop}")
        checked += 1
    return {"checked": checked, "mismatches": 0}


def main() -> None:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    frame_hashes = animated_frame_digests()
    items = extract_sheets(frame_hashes)
    items.extend(extract_gifs(set()))
    items.sort(key=lambda item: (item["category"], item["source"], item["name"]))
    summary: dict[str, int] = {}
    for item in items:
        summary[item["category"]] = summary.get(item["category"], 0) + 1
    validation = validate_extraction(items)
    build_contact_sheets(items)
    payload = {
        "generatedAt": "2026-08-20",
        "sourceRoot": "interior full",
        "method": "grid-aware alpha bounding box scan with per-sheet pixel deduplication",
        "animatedFrameHashes": len(frame_hashes),
        "wallpaperScan": {
            "tileBounds": {"x": WALLPAPER_TILE_BOUNDS[0], "y": WALLPAPER_TILE_BOUNDS[1], "width": WALLPAPER_TILE_BOUNDS[2] - WALLPAPER_TILE_BOUNDS[0], "height": WALLPAPER_TILE_BOUNDS[3] - WALLPAPER_TILE_BOUNDS[1]},
            "tileSize": {"width": 16, "height": 16},
            "pairedWallRegion": {"yStart": 0, "yEnd": WALLPAPER_PAIRED_END_Y, "bodyHeight": 16, "bottomTrimHeight": 16},
            "constructionRegion": {"x": 0, "y": 0, "width": 112, "height": 816},
            "constructionAssembly": {"groups": 17, "modulesPerGroup": 3, "moduleSize": {"width": 32, "height": 32}},
        },
        "count": len(items),
        "categories": summary,
        "validation": validation,
        "items": items,
    }
    AUDIT_MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    runtime_items = []
    for item in items:
        runtime_item = {key: item[key] for key in (
            "id", "name", "category", "description", "price", "asset",
            "width", "height", "animated", "subcategory", "familyId", "familyName",
        )}
        for optional_key in ("wallpaperTrimAsset",):
            if optional_key in item:
                runtime_item[optional_key] = item[optional_key]
        runtime_items.append(runtime_item)
    RUNTIME_CATALOG.write_text(json.dumps({"count": len(runtime_items), "categories": summary, "items": runtime_items}, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"count": len(items), "categories": summary, "validation": validation}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
