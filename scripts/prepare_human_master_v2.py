#!/usr/bin/env python3
"""Build the Human v2 environment master without altering the source reference.

The ImageGen edit is used only as a donor inside ten tightly bounded removal
regions. Every pixel outside those regions comes directly from the reference.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "public/design-previews/human-village-concepts/01-community-hall-plaza.png"
DONOR = ROOT / "public/assets/human-village/community-map-imagegen-donor-v2.png"
SHADOW_DONOR = ROOT / "public/assets/human-village/community-map-imagegen-shadow-donor-v2.png"
MASTER = ROOT / "public/assets/human-village/community-map-master-v2.png"
RUNTIME = ROOT / "public/assets/human-village/community-map-master-1536x1152-v2.png"
FOREGROUND = ROOT / "public/assets/human-village/community-map-foreground-1536x1152-v2.png"
EDIT_MASK = ROOT / "public/assets/human-village/community-map-edit-mask-v2.png"
GRID_PREVIEW = ROOT / "_review/human-community-hall-v2/reference-grid.png"

REFERENCE_SIZE = (1448, 1086)
RUNTIME_SIZE = (1536, 1152)

# These conservative boxes include each marker's glow and ground shadow.
MARKER_BOXES = (
    (301, 124, 363, 190),
    (964, 181, 1030, 250),
    (367, 318, 429, 383),
    (691, 355, 755, 423),
    (1245, 481, 1313, 549),
    (402, 545, 468, 612),
    (1255, 680, 1325, 748),
    (183, 826, 251, 895),
    (1082, 866, 1150, 934),
)
PLAYER_BOX = (686, 918, 766, 1028)
SHADOW_BOXES = (
    (307, 178, 354, 207),
    (974, 239, 1021, 268),
    (375, 373, 422, 402),
    (700, 411, 747, 440),
    (1256, 537, 1303, 566),
    (411, 600, 458, 629),
    (1267, 737, 1314, 766),
    (194, 884, 241, 913),
    (1093, 923, 1140, 952),
)

# Exact-master foreground regions. They are intentionally conservative and
# contain only pixels that may naturally cover a character walking behind the
# corresponding object. Runtime code additionally applies each region's
# baseline before drawing it.
FOREGROUND_POLYGONS = (
    # northwest bakery roof and eaves
    ((13, 120), (102, 120), (196, 180), (300, 178), (300, 309), (15, 309)),
    # community hall roof / upper facade
    ((545, 92), (635, 92), (723, 43), (812, 92), (909, 92), (909, 291), (545, 291)),
    # northeast residence roof
    ((1090, 102), (1191, 39), (1313, 111), (1313, 207), (1090, 207)),
    # east clinic roof and canopy
    ((1084, 274), (1184, 274), (1217, 250), (1250, 274), (1345, 274), (1345, 420), (1084, 420)),
    # west residence roof
    ((126, 421), (242, 421), (278, 397), (414, 439), (414, 552), (126, 552)),
    # southwest housing roof row
    ((11, 616), (122, 616), (230, 679), (286, 679), (286, 770), (11, 770)),
    # southwest cafe roof and awning
    ((276, 686), (489, 686), (489, 835), (276, 835)),
    # southeast laundry roof / awning
    ((1038, 519), (1344, 519), (1344, 641), (1038, 641)),
    # central shade-tree canopy
    ((641, 494), (811, 494), (811, 606), (641, 606)),
)


def clipped_feathered_mask(size: tuple[int, int]) -> Image.Image:
    hard = Image.new("L", size, 0)
    draw = ImageDraw.Draw(hard)
    for box in MARKER_BOXES:
        draw.ellipse(box, fill=255)
    draw.rounded_rectangle(PLAYER_BOX, radius=14, fill=255)

    feathered = hard.filter(ImageFilter.GaussianBlur(radius=2.0))
    clip = Image.new("L", size, 0)
    clip_draw = ImageDraw.Draw(clip)
    for box in MARKER_BOXES:
        clip_draw.rectangle(box, fill=255)
    clip_draw.rectangle(PLAYER_BOX, fill=255)
    return ImageChops.multiply(feathered, clip)


def shadow_mask(size: tuple[int, int]) -> Image.Image:
    hard = Image.new("L", size, 0)
    draw = ImageDraw.Draw(hard)
    for box in SHADOW_BOXES:
        draw.ellipse(box, fill=255)
    feathered = hard.filter(ImageFilter.GaussianBlur(radius=2.0))
    clip = Image.new("L", size, 0)
    clip_draw = ImageDraw.Draw(clip)
    for box in SHADOW_BOXES:
        clip_draw.rectangle(box, fill=255)
    return ImageChops.multiply(feathered, clip)


def build_foreground(runtime: Image.Image) -> Image.Image:
    reference_mask = Image.new("L", REFERENCE_SIZE, 0)
    draw = ImageDraw.Draw(reference_mask)
    for polygon in FOREGROUND_POLYGONS:
        draw.polygon(polygon, fill=255)
    mask = reference_mask.resize(RUNTIME_SIZE, Image.Resampling.NEAREST)
    rgba = runtime.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def main() -> None:
    reference = Image.open(REFERENCE).convert("RGB")
    donor = Image.open(DONOR).convert("RGB")
    shadow_donor = Image.open(SHADOW_DONOR).convert("RGB")
    if reference.size != REFERENCE_SIZE or donor.size != REFERENCE_SIZE or shadow_donor.size != REFERENCE_SIZE:
        raise SystemExit(
            f"unexpected input sizes: reference={reference.size}, donor={donor.size}, "
            f"shadow_donor={shadow_donor.size}"
        )

    mask = clipped_feathered_mask(REFERENCE_SIZE)
    master = Image.composite(donor, reference, mask)
    shadows = shadow_mask(REFERENCE_SIZE)
    master = Image.composite(shadow_donor, master, shadows)
    runtime = master.resize(RUNTIME_SIZE, Image.Resampling.NEAREST)
    foreground = build_foreground(runtime)
    grid = runtime.convert("RGBA")
    grid_overlay = Image.new("RGBA", RUNTIME_SIZE, (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_overlay)
    for x in range(0, RUNTIME_SIZE[0] + 1, 32):
        grid_draw.line((x, 0, x, RUNTIME_SIZE[1]), fill=(255, 50, 50, 90), width=1)
    for y in range(0, RUNTIME_SIZE[1] + 1, 32):
        grid_draw.line((0, y, RUNTIME_SIZE[0], y), fill=(255, 50, 50, 90), width=1)
    grid = Image.alpha_composite(grid, grid_overlay)

    combined_mask = ImageChops.lighter(mask, shadows)
    combined_mask.save(EDIT_MASK)
    master.save(MASTER)
    runtime.save(RUNTIME)
    foreground.save(FOREGROUND)
    GRID_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    grid.save(GRID_PREVIEW)

    changed = ImageChops.difference(reference, master).convert("L")
    outside = ImageChops.multiply(changed, ImageChops.invert(combined_mask.point(lambda value: 255 if value else 0)))
    if outside.getbbox() is not None:
        raise SystemExit("master changed pixels outside the approved edit mask")

    print(f"wrote {MASTER.relative_to(ROOT)} {master.size}")
    print(f"wrote {RUNTIME.relative_to(ROOT)} {runtime.size}")
    print(f"wrote {FOREGROUND.relative_to(ROOT)} {foreground.size}")
    print(f"wrote {EDIT_MASK.relative_to(ROOT)} {mask.size}")
    print(f"wrote {GRID_PREVIEW.relative_to(ROOT)} {grid.size}")


if __name__ == "__main__":
    main()
