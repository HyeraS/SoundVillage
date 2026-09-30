#!/usr/bin/env python3
"""Build the asset-pack-based SoundVillage currency icon set and review sheets.

The runtime outputs are deliberately limited to six 32x32 RGBA PNGs. Source
pack masters are only read. Every resize used for source-derived candidate
masks or review scaling uses nearest-neighbor sampling.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DIR = ROOT / "public/assets/economy/village-currencies"
REVIEW_DIR = ROOT / "_review/economy-v1-assets/currency-pack-selection"
A_DIR = ROOT / "_review/economy-v1-assets/currency-icons-generated-draft-a"
VILLAGES = ("animal", "human", "nature", "urban", "music", "lab")

PALETTES = {
    "animal": ("#4B2F2A", "#7A4A31", "#B56E36", "#E2A447", "#FFF0C2"),
    "human": ("#512F38", "#8D3F43", "#C95750", "#EE806B", "#FFE7CF"),
    "nature": ("#203B28", "#315E32", "#4B913D", "#7AC84B", "#ECFFD1"),
    "urban": ("#192B45", "#264E72", "#347DB2", "#65AFDB", "#E8F6FF"),
    "music": ("#30213F", "#5A3474", "#8C4BA2", "#C866B6", "#FFF0FA"),
    "lab": ("#25294A", "#4A2765", "#0B756B", "#55BFA2", "#E5FFF5"),
}


def rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def write_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False)


def nearest(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.NEAREST)


def font(size: int) -> ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def token_base(village: str) -> Image.Image:
    """One shared 28px octagonal token, four shade bands, top-left light."""
    dark, shadow, base, light, _cream = PALETTES[village]
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    outer = ((8, 2), (23, 2), (29, 8), (29, 23), (23, 29), (8, 29), (2, 23), (2, 8))
    inner_shadow = ((8, 4), (23, 4), (27, 8), (27, 23), (23, 27), (8, 27), (4, 23), (4, 8))
    face = ((8, 5), (22, 5), (26, 9), (26, 21), (21, 26), (9, 26), (5, 22), (5, 9))
    draw.polygon(outer, fill=dark)
    draw.polygon(inner_shadow, fill=shadow)
    draw.polygon(face, fill=base)
    draw.line(((8, 5), (21, 5), (25, 9)), fill=light, width=2)
    draw.line(((5, 9), (5, 20)), fill=light, width=1)
    return image


def pixel_ellipse(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str) -> None:
    """Pillow ellipses stay hard-edged at native resolution."""
    draw.ellipse(box, fill=fill)


def recolor_mask(mask: Image.Image, color: str) -> Image.Image:
    alpha = mask.convert("L").point(lambda value: 255 if value >= 128 else 0)
    image = Image.new("RGBA", alpha.size, color)
    image.putalpha(alpha)
    return image


def place_center(canvas: Image.Image, sprite: Image.Image, center: tuple[int, int] = (16, 17)) -> None:
    x = center[0] - sprite.width // 2
    y = center[1] - sprite.height // 2
    canvas.alpha_composite(sprite, (x, y))


def source_candidate(village: str) -> tuple[Image.Image, Image.Image]:
    """Return candidate 1 and its motif-only binary mask."""
    image = token_base(village)
    dark, _shadow, _base, light, cream = PALETTES[village]
    motif = Image.new("L", (32, 32), 0)
    motif_draw = ImageDraw.Draw(motif)

    if village == "animal":
        # No clean paw sprite exists in the Animal runtime. Recombine the farm
        # animal sheet's warm outline/coat palette into a compact four-toe paw.
        for box in ((8, 10, 11, 14), (12, 8, 15, 12), (17, 8, 20, 12), (21, 10, 24, 14)):
            pixel_ellipse(motif_draw, box, 255)
        motif_draw.polygon(((10, 20), (11, 16), (14, 14), (18, 14), (21, 16), (22, 20), (20, 23), (12, 23)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        draw = ImageDraw.Draw(image)
        draw.rectangle((13, 16, 18, 17), fill=light)

    elif village == "human":
        # Derive a gender-neutral bust mask from the first Character v2 front
        # frame, flattening all facial and clothing pixels to a silhouette.
        source = rgba(ROOT / "assets/Character v.2/characters/char1.png").crop((0, 0, 32, 32))
        alpha = source.getchannel("A")
        head = alpha.crop((8, 10, 24, 25)).point(lambda value: 255 if value else 0)
        head = nearest(head, (14, 13))
        motif.paste(head, (9, 8), head)
        # Close the narrow lower body into readable shoulders.
        motif_draw.polygon(((8, 24), (9, 20), (12, 18), (20, 18), (23, 20), (24, 24)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        ImageDraw.Draw(image).rectangle((11, 9, 19, 10), fill=cream)

    elif village == "nature":
        # Directly use the 16x16 two-leaf seedling cell from the farm crop sheet.
        source = rgba(ROOT / "assets/farm/farming/crops.png").crop((32, 0, 48, 16))
        alpha = source.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
        alpha = nearest(alpha.crop((2, 4, 14, 16)), (15, 15))
        motif.paste(alpha, (9, 8), alpha)
        image.alpha_composite(recolor_mask(motif, cream))
        ImageDraw.Draw(image).rectangle((14, 13, 15, 20), fill=cream)

    elif village == "urban":
        # The accepted Urban car has a paired visibility mask. Its top-down
        # silhouette is reduced to a binary front-car candidate without road.
        source = rgba(ROOT / "public/assets/urban-city-v3/masks/vehicle-northeast-road-car-visible-mask.png").convert("L")
        source = source.point(lambda value: 255 if value >= 96 else 0)
        bbox = source.getbbox() or (0, 0, source.width, source.height)
        source = nearest(source.crop(bbox), (12, 17))
        motif.paste(source, (10, 8), source)
        image.alpha_composite(recolor_mask(motif, cream))
        draw = ImageDraw.Draw(image)
        draw.rectangle((12, 11, 19, 14), fill=light)
        draw.rectangle((13, 18, 18, 21), fill=dark)

    elif village == "music":
        # No small eighth-note sprite exists in the Music runtime; use the
        # instrument-case/path palette and the pack's native one-pixel rhythm.
        motif_draw.ellipse((8, 19, 14, 24), fill=255)
        motif_draw.rectangle((13, 9, 15, 21), fill=255)
        motif_draw.polygon(((15, 9), (23, 11), (23, 15), (21, 17), (20, 14), (15, 13)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        ImageDraw.Draw(image).rectangle((14, 10, 15, 13), fill=cream)

    elif village == "lab":
        # Direct crop: light controller in the town pack community game room.
        source = rgba(ROOT / "assets/town full/interior/interior.png").crop((1379, 518, 1391, 525))
        alpha = source.getchannel("A").point(lambda value: 255 if value else 0)
        alpha = nearest(alpha, (16, 10))
        motif.paste(alpha, (8, 12), alpha)
        image.alpha_composite(recolor_mask(motif, cream))
        draw = ImageDraw.Draw(image)
        draw.rectangle((10, 15, 14, 16), fill=dark)
        draw.rectangle((11, 14, 12, 17), fill=dark)
        draw.point((20, 15), fill=light)
        draw.point((22, 17), fill=light)
        draw.line(((15, 20), (18, 20), (19, 19)), fill=light, width=1)

    return image, motif


def refined_candidate(village: str) -> tuple[Image.Image, Image.Image]:
    """Return the 24px-HUD-optimized candidate 2 and motif-only mask."""
    image = token_base(village)
    dark, _shadow, _base, light, cream = PALETTES[village]
    draw = ImageDraw.Draw(image)
    motif = Image.new("L", (32, 32), 0)
    m = ImageDraw.Draw(motif)

    if village == "animal":
        for box in ((8, 10, 11, 14), (12, 8, 15, 12), (17, 8, 20, 12), (21, 10, 24, 14)):
            pixel_ellipse(m, box, 255)
        m.polygon(((10, 21), (10, 18), (12, 15), (15, 14), (18, 14), (21, 16), (22, 20), (20, 23), (12, 23)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        draw.rectangle((13, 16, 18, 17), fill=light)

    elif village == "human":
        pixel_ellipse(m, (12, 8, 19, 15), 255)
        m.rectangle((14, 15, 17, 18), fill=255)
        m.polygon(((8, 24), (9, 20), (13, 17), (18, 17), (22, 20), (23, 24)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        draw.rectangle((13, 9, 18, 10), fill=cream)

    elif village == "nature":
        m.rectangle((15, 14, 16, 24), fill=255)
        m.polygon(((14, 17), (10, 16), (8, 13), (8, 10), (11, 10), (14, 12), (15, 15)), fill=255)
        m.polygon(((17, 16), (18, 12), (21, 10), (24, 10), (24, 13), (21, 16)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        draw.rectangle((15, 15, 16, 20), fill=cream)

    elif village == "urban":
        m.polygon(((7, 21), (8, 16), (11, 15), (13, 11), (20, 11), (23, 16), (25, 17), (25, 21)), fill=255)
        m.rectangle((9, 15, 23, 22), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        draw.polygon(((13, 13), (19, 13), (21, 16), (11, 16)), fill=light)
        draw.rectangle((10, 20, 13, 23), fill=dark)
        draw.rectangle((20, 20, 23, 23), fill=dark)
        draw.point((11, 21), fill=light)
        draw.point((22, 21), fill=light)

    elif village == "music":
        pixel_ellipse(m, (8, 19, 14, 24), 255)
        m.rectangle((13, 8, 16, 21), fill=255)
        m.polygon(((16, 8), (23, 10), (24, 12), (24, 15), (21, 18), (20, 15), (21, 12), (16, 11)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        draw.rectangle((14, 9, 16, 11), fill=cream)

    elif village == "lab":
        m.polygon(((8, 22), (8, 17), (10, 13), (13, 12), (19, 12), (22, 13), (24, 17), (24, 22), (21, 23), (18, 20), (14, 20), (11, 23)), fill=255)
        image.alpha_composite(recolor_mask(motif, cream))
        draw.rectangle((11, 15, 15, 16), fill=dark)
        draw.rectangle((12, 14, 13, 17), fill=dark)
        draw.rectangle((20, 14, 21, 15), fill=light)
        draw.rectangle((22, 16, 23, 17), fill=light)
        draw.line(((15, 21), (18, 21), (19, 20)), fill=light, width=1)

    return image, motif


def checker(size: tuple[int, int], a: str = "#EDF0F2", b: str = "#DDE2E5", step: int = 8) -> Image.Image:
    image = Image.new("RGBA", size, a)
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, min(x + step - 1, size[0] - 1), min(y + step - 1, size[1] - 1)), fill=b)
    return image


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int = 13, fill: str = "#2B2330") -> None:
    draw.text(xy, text, font=font(size), fill=fill)


def all_candidates_sheet(candidates: dict[str, tuple[Image.Image, Image.Image]]) -> Image.Image:
    output = checker((980, 790), step=12)
    draw = ImageDraw.Draw(output)
    draw.rectangle((0, 0, 979, 54), fill="#F8F2E8")
    label(draw, (18, 14), "Asset-pack currency B candidates - source-led vs HUD-refined", 22)
    label(draw, (228, 64), "candidate 1 / source-led", 15)
    label(draw, (585, 64), "candidate 2 / recommended", 15)
    for row, village in enumerate(VILLAGES):
        y = 92 + row * 112
        label(draw, (20, y + 40), village.upper(), 15)
        for column, icon in enumerate(candidates[village]):
            x = 180 + column * 360
            output.alpha_composite(nearest(icon, (80, 80)), (x, y))
            output.alpha_composite(icon, (x + 104, y + 12))
            output.alpha_composite(nearest(icon, (24, 24)), (x + 150, y + 16))
            output.alpha_composite(nearest(icon, (16, 16)), (x + 190, y + 20))
            label(draw, (x + 103, y + 50), "32", 10)
            label(draw, (x + 151, y + 50), "24", 10)
            label(draw, (x + 189, y + 50), "16", 10)
    return output


def recommended_sheet(finals: dict[str, Image.Image]) -> Image.Image:
    output = checker((910, 250), step=10)
    draw = ImageDraw.Draw(output)
    draw.rectangle((0, 0, 909, 48), fill="#F8F2E8")
    label(draw, (18, 13), "Recommended asset-pack B set - 16 / 24 / 32px", 21)
    for index, village in enumerate(VILLAGES):
        x = 22 + index * 146
        output.alpha_composite(nearest(finals[village], (96, 96)), (x + 20, 58))
        output.alpha_composite(nearest(finals[village], (16, 16)), (x + 16, 171))
        output.alpha_composite(nearest(finals[village], (24, 24)), (x + 42, 167))
        output.alpha_composite(finals[village], (x + 78, 163))
        label(draw, (x + 37, 207), village, 12)
    return output


def comparison_sheet(finals: dict[str, Image.Image]) -> Image.Image:
    output = checker((910, 390), step=10)
    draw = ImageDraw.Draw(output)
    draw.rectangle((0, 0, 909, 48), fill="#F8F2E8")
    label(draw, (18, 13), "Generated draft A vs asset-pack B", 21)
    label(draw, (16, 92), "A", 17)
    label(draw, (16, 248), "B", 17)
    for index, village in enumerate(VILLAGES):
        x = 56 + index * 141
        old = rgba(A_DIR / f"{village}.png")
        output.alpha_composite(nearest(old, (112, 112)), (x, 62))
        output.alpha_composite(nearest(finals[village], (112, 112)), (x, 218))
        label(draw, (x + 30, 342), village, 12)
    return output


def hud_sheet(finals: dict[str, Image.Image], background: str, title_color: str, size: int, title: str) -> Image.Image:
    output = Image.new("RGBA", (760, 126), background)
    draw = ImageDraw.Draw(output)
    label(draw, (16, 12), title, 18, title_color)
    for index, village in enumerate(VILLAGES):
        x = 22 + index * 122
        output.alpha_composite(nearest(finals[village], (size, size)), (x + (32 - size) // 2, 48))
        label(draw, (x, 92), village, 11, title_color)
    return output


def nearest_sheet(finals: dict[str, Image.Image]) -> Image.Image:
    output = Image.new("RGBA", (1552, 316), "#101820")
    draw = ImageDraw.Draw(output)
    label(draw, (16, 12), "Nearest-neighbor 8x pixel inspection", 20, "#F4F0E8")
    for index, village in enumerate(VILLAGES):
        x = 8 + index * 256
        output.alpha_composite(nearest(finals[village], (256, 256)), (x, 46))
        label(draw, (x + 96, 292), village, 12, "#F4F0E8")
    return output


def silhouette_sheet(motifs: dict[str, Image.Image]) -> Image.Image:
    output = Image.new("RGBA", (910, 230), "#F7F1E7")
    draw = ImageDraw.Draw(output)
    label(draw, (18, 13), "Motif-only silhouette test - no color cues", 21)
    for index, village in enumerate(VILLAGES):
        x = 18 + index * 148
        tile = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        tile.putalpha(motifs[village])
        solid = Image.new("RGBA", (32, 32), "#20242A")
        solid.putalpha(motifs[village])
        output.alpha_composite(nearest(solid, (128, 128)), (x, 58))
        label(draw, (x + 38, 194), village, 12)
    return output


def main() -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    candidates: dict[str, tuple[Image.Image, Image.Image]] = {}
    motifs: dict[str, Image.Image] = {}
    finals: dict[str, Image.Image] = {}
    for village in VILLAGES:
        candidate_1, _motif_1 = source_candidate(village)
        candidate_2, motif_2 = refined_candidate(village)
        candidates[village] = (candidate_1, candidate_2)
        motifs[village] = motif_2
        finals[village] = candidate_2
        write_png(candidate_1, REVIEW_DIR / "candidates" / f"{village}-candidate-1.png")
        write_png(candidate_2, REVIEW_DIR / "candidates" / f"{village}-candidate-2.png")
        write_png(candidate_2, RUNTIME_DIR / f"{village}.png")

    write_png(all_candidates_sheet(candidates), REVIEW_DIR / "all-candidates.png")
    write_png(recommended_sheet(finals), REVIEW_DIR / "recommended-six.png")
    write_png(comparison_sheet(finals), REVIEW_DIR / "generated-a-vs-asset-pack-b.png")
    write_png(hud_sheet(finals, "#FFF8EC", "#2B2330", 24, "24px HUD - light background"), REVIEW_DIR / "hud-24px-light.png")
    write_png(hud_sheet(finals, "#162431", "#F4F0E8", 24, "24px HUD - dark background"), REVIEW_DIR / "hud-24px-dark.png")
    write_png(hud_sheet(finals, "#DDE5E8", "#2B2330", 32, "32px HUD - native runtime size"), REVIEW_DIR / "hud-32px.png")
    write_png(nearest_sheet(finals), REVIEW_DIR / "nearest-neighbor-8x.png")
    write_png(silhouette_sheet(motifs), REVIEW_DIR / "silhouette-test.png")
    print("built 12 candidates, selected six B icons, and wrote eight review sheets")


if __name__ == "__main__":
    main()
