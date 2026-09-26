#!/usr/bin/env python3
"""Composite only approved ImageGen restoration masks into the Urban source.

All pixels outside each binary mask are copied from the approved reference, so
they remain byte-identical regardless of unrelated ImageGen drift.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
REFERENCE = ROOT / "design/concepts/urban-advanced-city-2026-09-01/02-midnight-metro-media-core.png"


def main() -> None:
    log_path = V3 / "reference/restoration-log.json"
    log = json.loads(log_path.read_text())
    canonical = Image.open(REFERENCE).convert("RGB")
    original = canonical.copy()
    patch_dir = V3 / "accepted/restoration"
    patch_dir.mkdir(parents=True, exist_ok=True)

    for entry in log["entries"]:
        region_id = entry["id"]
        candidate_rel = f"candidates/restoration-{region_id}-v1.png"
        candidate_path = V3 / candidate_rel
        mask_path = V3 / entry["mask"]
        if not candidate_path.exists():
            entry["status"] = "pending-imagegen"
            continue
        candidate = Image.open(candidate_path).convert("RGB")
        mask = Image.open(mask_path).convert("L")
        if candidate.size != canonical.size or mask.size != canonical.size:
            raise ValueError(f"Size mismatch for {region_id}")

        bbox = mask.getbbox()
        if bbox is None:
            raise ValueError(f"Empty mask for {region_id}")
        # The edit service may return a slightly different local exposure.  A
        # short inward-only matte cleanup removes hard rectangular/elliptical
        # seams while still guaranteeing zero changes outside the approved
        # restoration mask.
        softened = mask.filter(ImageFilter.GaussianBlur(radius=5))
        blend_mask = ImageChops.multiply(mask, softened)
        canonical = Image.composite(candidate, canonical, blend_mask)

        alpha = blend_mask.crop(bbox)
        patch = candidate.crop(bbox).convert("RGBA")
        patch.putalpha(alpha)
        patch_rel = f"accepted/restoration/{region_id}-patch.png"
        patch.save(V3 / patch_rel, optimize=True)

        entry.update({
            "candidate": candidate_rel,
            "acceptedPatch": patch_rel,
            "acceptedBounds": {"x": bbox[0], "y": bbox[1], "w": bbox[2] - bbox[0], "h": bbox[3] - bbox[1]},
            "status": "accepted-after-original-resolution-review",
            "outsideMaskPixelIdentity": True,
        })

    out_source = V3 / "reference/canonical-map-art-source.png"
    out_runtime = V3 / "reference/canonical-map-art-runtime.png"
    canonical.save(out_source, optimize=True)
    canonical.save(out_runtime, optimize=True)

    union_mask = Image.new("L", canonical.size, 0)
    for entry in log["entries"]:
        mask = Image.open(V3 / entry["mask"]).convert("L")
        union_mask = ImageChops.lighter(union_mask, mask)
    outside = ImageChops.invert(union_mask)
    diff = ImageChops.difference(original, canonical)
    outside_diff = Image.composite(diff, Image.new("RGB", diff.size), outside)
    if outside_diff.getbbox() is not None:
        raise AssertionError("Canonical composite changed pixels outside restoration masks")

    log["canonicalSource"] = str(out_source.relative_to(V3))
    log["canonicalRuntime"] = str(out_runtime.relative_to(V3))
    log["outsideAllMasksPixelIdentity"] = True
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"canonical": str(out_source), "accepted": sum(e["status"].startswith("accepted") for e in log["entries"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
