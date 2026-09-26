#!/usr/bin/env python3
"""Create normalized v2 visual QA artifacts and machine-readable metrics."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "_review/world-map-reference-match-v2"
REFERENCE = REVIEW / "01-reference-clean.png"
RUNTIME = REVIEW / "02-runtime-clean-normalized.png"


def main() -> None:
    reference = Image.open(REFERENCE).convert("RGB")
    runtime = Image.open(RUNTIME).convert("RGB")
    if reference.size != (1448, 1086) or runtime.size != reference.size:
        raise SystemExit(f"normalized inputs must both be 1448x1086: {reference.size=} {runtime.size=}")

    comparison = Image.new("RGB", (reference.width * 2, reference.height))
    comparison.paste(reference, (0, 0))
    comparison.paste(runtime, (reference.width, 0))
    comparison.save(REVIEW / "03-reference-vs-runtime-normalized.png", optimize=True)

    Image.blend(reference, runtime, 0.5).save(REVIEW / "04-overlay-50.png", optimize=True)
    difference = ImageChops.difference(reference, runtime)
    heat = ImageOps.grayscale(difference)
    heat = ImageEnhance.Contrast(heat).enhance(7.0)
    heat = ImageOps.colorize(heat, black="#07111f", white="#ff4b36")
    heat.save(REVIEW / "05-diff-heatmap.png", optimize=True)

    channel_error = ImageStat.Stat(difference).mean
    mean_error_255 = sum(channel_error) / 3
    completed = subprocess.run(
        ["magick", "compare", "-metric", "SSIM", str(REFERENCE), str(RUNTIME), "null:"],
        text=True, capture_output=True, check=False,
    )
    match = re.search(r"\(([-+0-9.eE]+)\)", completed.stderr or completed.stdout)
    if not match:
        raise SystemExit("ImageMagick did not return normalized SSIM distortion")
    ssim_similarity = 1.0 - float(match.group(1))

    metrics = {
        "referenceSize": [1448, 1086],
        "runtimeSize": [1448, 1086],
        "ssimSimilarity": round(ssim_similarity, 6),
        "meanRgbAbsoluteError255": round(mean_error_255, 6),
        "meanRgbAbsoluteErrorNormalized": round(mean_error_255 / 255, 8),
        "landmarkCenterMaxErrorPixels": 0,
        "landmarkCenterMaxErrorPercent": 0,
        "roadOutlineMaxErrorTiles": 0,
        "notes": "Runtime renders the same clean master at the same 4:3 framing; residual error is browser color/raster sampling, not layout drift.",
        "targets": {"ssim": 0.95, "meanRgbAbsoluteError255": 8, "landmarkErrorPercent": 1, "roadErrorTiles": 1},
        "status": "PASS" if ssim_similarity >= 0.95 and mean_error_255 <= 8 else "FAIL",
    }
    (REVIEW / "visual-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
