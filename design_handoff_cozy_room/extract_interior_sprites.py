#!/usr/bin/env python3
"""
global.png(4320x3440 인테리어 타일셋) → public/assets/interior/*.png 재추출 스크립트.

Cozy Room 디자인이 쓰는 스프라이트를 원본 시트에서 다시 잘라낸다.
좌표는 (x, y, w, h). tight=True면 알파 기준으로 여백을 잘라낸다(디자인에서 쓴 값과 동일).

사용:
    python extract_interior_sprites.py source/global.png public/assets/interior
의존:
    pip install pillow
"""
import sys, os
from PIL import Image

# name: (x, y, w, h, tight)
SPRITES = {
    # ── 벽지 (32x24 타일, background-repeat) ─────────────────
    "wp_hearts":         (544,  800, 32, 24, False),
    "wp_clover":         (528,  832, 32, 24, False),
    "wp_bunny":          (304,  864, 32, 24, False),
    "wp_stripe":         (128,  580, 32, 24, False),
    "wp_night":          (336,  992, 32, 24, False),
    # ── 바닥재 (32x32 타일, background-repeat) ───────────────
    "fl_green":          (208, 1348, 32, 32, False),
    "fl_rose":           (304, 1348, 32, 32, False),
    "fl_brown":          (112, 1348, 32, 32, False),
    "fl_stone":          (112, 1412, 32, 32, False),
    # ── 러그 (32x32 타일, 2x2칸에 늘려 사용) ─────────────────
    "rug_persian_red":   (112, 1280, 32, 32, False),
    "rug_persian_green": (176, 1280, 32, 32, False),
    "rug_circle_teal":   (256, 1312, 32, 32, False),
    # ── 큰가구 ───────────────────────────────────────────────
    "bed_cream":         (510, 2670, 34, 36, True),
    "bed_teal":          (510, 2926, 34, 36, True),
    "dresser":           (641, 2306, 29, 30, True),
    "wardrobe_teal":     (1160, 1027, 23, 29, True),
    "wardrobe_purple":   (1206, 1027, 17, 29, True),
    "fireplace":         (115, 2188, 27, 24, True),
    # ── 소파·의자 ────────────────────────────────────────────
    "sofa_cream":        (640, 1921, 31, 34, True),
    "sofa_red":          (640, 1957, 31, 34, True),
    "armchair_cream":    (766, 1921, 18, 34, True),
    "chair_cream":       (641, 1504, 30, 34, True),
    "table_round":       (641, 1606, 32, 30, True),
    "stool_wood":        (641, 1744, 32, 36, True),
    # ── 소품 ─────────────────────────────────────────────────
    "plant_tall":        (1600, 1030, 15, 28, True),
    "plant_bush":        (1616, 1030, 15, 28, True),
    "pot_cactus":        (1600, 1089, 15, 30, True),
    "books":             (1792, 1244, 30, 22, True),
    "fruitbowl":         (1773, 1244, 18, 22, True),
    "lamp_floor":        (1390, 1562, 16, 24, True),
    "candle":            (1390, 1500, 16, 22, True),
    "xmas_tree":         (1278, 1540, 34, 48, True),
    # ── 벽장식 ───────────────────────────────────────────────
    "curtain_red":       (3,      1, 26, 30, True),
    "curtain_green":     (163,    1, 26, 30, True),
    "curtain_blue":      (259,    1, 26, 30, True),
    "frame_butterfly2":  (2018, 1024, 17, 22, True),
    # ── 펫 ───────────────────────────────────────────────────
    "cat":               (1743, 1244, 18, 22, True),
    "hamster":           (1724, 1244, 20, 22, True),
    "deer":              (1757, 1244, 20, 22, True),
    "cactus":            (1709, 1244, 18, 22, True),
}


def tight_box(im, box):
    crop = im.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    bbox = crop.getbbox()  # 알파 기준 여백 제거
    if bbox is None:
        return None
    return crop.crop(bbox)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "source/global.png"
    out = sys.argv[2] if len(sys.argv) > 2 else "public/assets/interior"
    os.makedirs(out, exist_ok=True)
    sheet = Image.open(src).convert("RGBA")

    for name, (x, y, w, h, tight) in SPRITES.items():
        if tight:
            img = tight_box(sheet, (x, y, w, h))
            if img is None:
                print(f"[skip] {name}: 빈 영역")
                continue
        else:
            img = sheet.crop((x, y, x + w, y + h))
        img.save(os.path.join(out, f"{name}.png"))
        print(f"{name:20s} {img.width:>3}x{img.height:<3}")

    print(f"\n{len(SPRITES)}종 → {out}")


if __name__ == "__main__":
    main()
