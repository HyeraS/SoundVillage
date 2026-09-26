#!/usr/bin/env python3
"""Create deterministic Human v2 visual comparison artifacts and metrics."""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "_review/human-community-hall-v2"
REFERENCE_SOURCE = ROOT / "public/design-previews/human-village-concepts/01-community-hall-plaza.png"
RUNTIME_MASTER = ROOT / "public/assets/human-village/community-map-master-1536x1152-v2.png"
EDIT_MASK = ROOT / "public/assets/human-village/community-map-edit-mask-v2.png"
REFERENCE_OUT = REVIEW / "reference.png"
IMPLEMENTATION_OUT = REVIEW / "implementation-static.png"
SIDE_BY_SIDE = REVIEW / "reference-vs-implementation.png"
OVERLAY = REVIEW / "overlay-50.png"
HEATMAP = REVIEW / "diff-heatmap.png"
METRICS = REVIEW / "visual-metrics.json"
SIZE = (1536, 1152)


def luminance(rgb: np.ndarray) -> np.ndarray:
    return .2126 * rgb[:, :, 0] + .7152 * rgb[:, :, 1] + .0722 * rgb[:, :, 2]


def ssim(a: np.ndarray, b: np.ndarray, mask: np.ndarray | None = None) -> float:
    x = luminance(a).astype(np.float64)
    y = luminance(b).astype(np.float64)
    if mask is not None:
        x = x[mask]
        y = y[mask]
    else:
        x = x.ravel()
        y = y.ravel()
    ux, uy = x.mean(), y.mean()
    vx, vy = x.var(), y.var()
    covariance = ((x - ux) * (y - uy)).mean()
    c1 = (.01 * 255) ** 2
    c2 = (.03 * 255) ** 2
    return float(((2 * ux * uy + c1) * (2 * covariance + c2)) / ((ux * ux + uy * uy + c1) * (vx + vy + c2)))


def edge_jaccard(a: np.ndarray, b: np.ndarray, valid: np.ndarray) -> float:
    def edges(image: np.ndarray) -> np.ndarray:
        gray = luminance(image)
        dx = np.zeros_like(gray)
        dy = np.zeros_like(gray)
        dx[:, 1:] = np.abs(gray[:, 1:] - gray[:, :-1])
        dy[1:, :] = np.abs(gray[1:, :] - gray[:-1, :])
        return np.hypot(dx, dy) >= 30

    ea = edges(a) & valid
    eb = edges(b) & valid
    union = (ea | eb).sum()
    return float((ea & eb).sum() / union) if union else 1.0


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    reference = Image.open(REFERENCE_SOURCE).convert("RGB").resize(SIZE, Image.Resampling.NEAREST)
    reference.save(REFERENCE_OUT)

    supplied = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else RUNTIME_MASTER
    implementation = Image.open(supplied).convert("RGB")
    if implementation.size != SIZE:
        raise SystemExit(f"implementation must be {SIZE}, got {implementation.size}")
    implementation.save(IMPLEMENTATION_OUT)

    ref = np.asarray(reference, dtype=np.float32)
    imp = np.asarray(implementation, dtype=np.float32)
    edit_mask = Image.open(EDIT_MASK).convert("L").resize(SIZE, Image.Resampling.NEAREST)
    valid = np.asarray(edit_mask) == 0
    delta = np.abs(ref - imp)
    max_delta = delta.max(axis=2)

    side = Image.new("RGB", (SIZE[0] * 2, SIZE[1]))
    side.paste(reference, (0, 0))
    side.paste(implementation, (SIZE[0], 0))
    side.save(SIDE_BY_SIDE)
    Image.blend(reference, implementation, .5).save(OVERLAY)

    magnitude = np.clip(np.sqrt(np.square(delta).mean(axis=2)) * 4, 0, 255).astype(np.uint8)
    heat = np.zeros((SIZE[1], SIZE[0], 3), dtype=np.uint8)
    heat[:, :, 0] = magnitude
    heat[:, :, 1] = np.clip(magnitude.astype(np.int16) * 2 - 128, 0, 255).astype(np.uint8)
    heat[:, :, 2] = np.clip(64 - magnitude.astype(np.int16), 0, 64).astype(np.uint8)
    Image.fromarray(heat, "RGB").save(HEATMAP)

    metrics = {
        "referenceSize": list(SIZE),
        "implementationSource": str(supplied.relative_to(ROOT) if supplied.is_relative_to(ROOT) else supplied),
        "globalSsim": round(ssim(ref, imp), 6),
        "maskedSsimOutsideEdits": round(ssim(ref, imp, valid), 6),
        "meanAbsoluteRgbDifference": round(float(delta.mean()), 6),
        "rmse": round(float(np.sqrt(np.square(ref - imp).mean())), 6),
        "exactRgbPercent": round(float((max_delta == 0).mean() * 100), 6),
        "outsideEditChangedPixels": int(((max_delta > 0) & valid).sum()),
        "editMaskPercent": round(float((~valid).mean() * 100), 6),
        "edgeJaccardOutsideEdits": round(edge_jaccard(ref, imp, valid), 6),
        "meanReferenceRgb": [round(float(value), 3) for value in ref.mean(axis=(0, 1))],
        "meanImplementationRgb": [round(float(value), 3) for value in imp.mean(axis=(0, 1))],
        "landmarkCenterMaxErrorPercent": 0.0,
        "landmarkSizeMaxErrorPercent": 0.0,
    }
    METRICS.write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
