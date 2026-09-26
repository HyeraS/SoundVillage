#!/usr/bin/env python3
"""Compose reviewed regional ImageGen patches into the v3 ground-only plate."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
CANONICAL = V3 / "reference/canonical-map-art-source.png"
PREFERRED_VERSION = {"southeast-cinema-transit": 2, "central-spine": 2}


def main() -> None:
    log_path = V3 / "ground/removal-log.json"
    log = json.loads(log_path.read_text())
    base = Image.open(CANONICAL).convert("RGB")
    original = base.copy()
    union = Image.new("L", base.size, 0)

    for region in log["regions"]:
        region_id = region["id"]
        version = PREFERRED_VERSION.get(region_id, 1)
        candidate_rel = f"candidates/ground-{region_id}-v{version}.png"
        candidate = Image.open(V3 / candidate_rel).convert("RGB")
        mask = Image.open(V3 / region["mask"]).convert("L")
        if candidate.size != base.size:
            raise ValueError(f"Rejected size for {candidate_rel}: {candidate.size} != {base.size}")
        softened = mask.filter(ImageFilter.GaussianBlur(radius=5))
        blend = ImageChops.multiply(mask, softened)
        base = Image.composite(candidate, base, blend)
        union = ImageChops.lighter(union, mask)
        region.update({
            "candidate": candidate_rel,
            "status": "accepted-after-original-resolution-review",
            "outsideMaskPixelIdentity": True,
        })
        if version > 1:
            region["rejectedCandidates"] = [f"candidates/ground-{region_id}-v1.png"]
            region["rejectionReason"] = "wrong dimensions" if region_id.startswith("southeast") else "objects remained in removal mask"

    source_path = V3 / "ground/ground-only-source.png"
    runtime_path = V3 / "ground/ground-only-runtime.png"
    base.save(source_path, optimize=True)
    base.save(runtime_path, optimize=True)

    outside = ImageChops.invert(union)
    outside_diff = Image.composite(ImageChops.difference(original, base), Image.new("RGB", base.size), outside)
    if outside_diff.getbbox() is not None:
        raise AssertionError("Ground composite changed pixels outside removal masks")
    log.update({
        "groundOnlySource": "ground/ground-only-source.png",
        "groundOnlyRuntime": "ground/ground-only-runtime.png",
        "outsideAllMasksPixelIdentity": True,
    })
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"regionsAccepted": len(log["regions"]), "size": base.size}))


if __name__ == "__main__":
    main()
