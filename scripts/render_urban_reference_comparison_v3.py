#!/usr/bin/env python3
"""Build deterministic v3 review plates and masked comparison metrics."""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
REVIEW = ROOT / "_review/urban-advanced-city/imagegen-reference-exact-v3"
REFERENCE = V3 / "reference/canonical-map-art-source.png"
RUNTIME = REVIEW / "art-only-extracted.png"


def checker(size: tuple[int, int], cell: int = 8) -> Image.Image:
    image = Image.new("RGB", size, "#172033")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#26324a")
    return image


def contact_sheet(category_names: set[str], output_name: str) -> None:
    manifest = json.loads((V3 / "manifest.json").read_text())
    assets = [asset for asset in manifest["runtimeAssets"] if asset["category"] in category_names]
    cell_w, cell_h, columns = 180, 150, 6
    rows = max(1, math.ceil(len(assets) / columns))
    sheet = checker((cell_w * columns, cell_h * rows), 12)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, asset in enumerate(assets):
        sprite = Image.open(V3 / asset["file"]).convert("RGBA")
        fg = asset.get("foregroundFile")
        if fg:
            sprite.alpha_composite(Image.open(V3 / fg).convert("RGBA"))
        available = (cell_w - 12, cell_h - 32)
        scale = min(1.0, available[0] / sprite.width, available[1] / sprite.height)
        preview = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.NEAREST,
        )
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        sheet.paste(preview, (x + (cell_w - preview.width) // 2, y + 4), preview)
        draw.rectangle((x, y + cell_h - 24, x + cell_w - 1, y + cell_h - 1), fill="#0b1020")
        draw.text((x + 5, y + cell_h - 19), asset["id"][:28], font=font, fill="white")
    sheet.save(REVIEW / output_name, optimize=True)


def global_ssim(a: np.ndarray, b: np.ndarray, mask: np.ndarray) -> float:
    # Dependency-free luminance SSIM over the requested evaluable pixels.
    weights = np.array([0.299, 0.587, 0.114])
    x = (a * weights).sum(axis=2)[mask]
    y = (b * weights).sum(axis=2)[mask]
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    ux, uy = x.mean(), y.mean()
    vx, vy = x.var(), y.var()
    covariance = ((x - ux) * (y - uy)).mean()
    return float(((2 * ux * uy + c1) * (2 * covariance + c2)) / ((ux * ux + uy * uy + c1) * (vx + vy + c2)))


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    shutil.copy2(REFERENCE, REVIEW / "reference-clean.png")
    shutil.copy2(RUNTIME, REVIEW / "art-only-runtime.png")
    shutil.copy2(V3 / "reference/reference-analysis-overlay.png", REVIEW / "inventory-overlay.png")

    reference = Image.open(REFERENCE).convert("RGB")
    runtime = Image.open(RUNTIME).convert("RGB")
    if reference.size != runtime.size:
        raise ValueError("Reference/runtime dimensions differ")
    side_by_side = Image.new("RGB", (reference.width * 2, reference.height))
    side_by_side.paste(reference, (0, 0))
    side_by_side.paste(runtime, (reference.width, 0))
    side_by_side.save(REVIEW / "reference-vs-runtime.png", optimize=True)
    Image.blend(reference, runtime, 0.5).save(REVIEW / "reference-runtime-overlay-50.png", optimize=True)
    reference.save(
        REVIEW / "reference-runtime-blink.gif",
        save_all=True,
        append_images=[runtime],
        duration=650,
        loop=0,
        optimize=False,
    )
    difference = ImageChops.difference(reference, runtime)
    heat = np.asarray(difference, dtype=np.uint16)
    magnitude = np.max(heat, axis=2).astype(np.int32)
    heat_rgb = np.zeros((*magnitude.shape, 3), dtype=np.uint8)
    heat_rgb[..., 0] = np.minimum(255, magnitude * 8).astype(np.uint8)
    heat_rgb[..., 1] = np.minimum(255, np.maximum(0, magnitude - 24) * 3).astype(np.uint8)
    heat_rgb[..., 2] = np.minimum(255, magnitude * 2).astype(np.uint8)
    Image.fromarray(heat_rgb, "RGB").save(REVIEW / "reference-runtime-diff-heatmap.png", optimize=True)

    contact_sheet({"building"}, "contact-sheet-buildings.png")
    contact_sheet({"metro", "vehicle"}, "contact-sheet-metro-vehicles.png")
    contact_sheet(
        {"tree", "street-light", "kiosk", "planter", "bench", "outdoor-table", "bollard", "control-box", "south-rail"},
        "contact-sheet-props.png",
    )
    contact_sheet({"landmark"}, "contact-sheet-overlays.png")

    a = np.asarray(reference, dtype=np.float64)
    b = np.asarray(runtime, dtype=np.float64)
    evaluable = np.asarray(Image.open(V3 / "reference/evaluable-art-mask.png").convert("L")) > 0
    delta = a - b
    selected = delta[evaluable]
    rmse = float(np.sqrt(np.mean(selected * selected)))
    mae = float(np.mean(np.abs(selected)))
    exact = float(np.mean(np.all(a[evaluable] == b[evaluable], axis=1)))
    metrics = {
        "referencePixels": {"width": reference.width, "height": reference.height},
        "evaluablePixels": int(evaluable.sum()),
        "maskedRmse": rmse,
        "maskedMae": mae,
        "maskedExactPixelFraction": exact,
        "globalLuminanceSsim": global_ssim(a, b, evaluable),
        "nonUniformScaleCount": 0,
        "visualGate": "failed-individual-sprite-alpha-contamination",
        "knownExample": "tree-01 contains metro pixels in its visible alpha",
    }
    (REVIEW / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps(metrics))


if __name__ == "__main__":
    main()
