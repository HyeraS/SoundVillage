#!/usr/bin/env python3
"""Compose the reviewed non-overlapping cleanup pass for the v3 ground plate."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
GROUND = V3 / "ground"
CANDIDATES = V3 / "candidates"
ACCEPTED = V3 / "accepted/ground-cleanup"

REGIONS = (
    ("north", 1),
    ("west-mid", 1),
    ("center-mid", 2),
    ("east-mid", 1),
    ("west-south", 1),
    ("center-south", 1),
    ("east-south", 1),
)


def main() -> None:
    base_path = GROUND / "ground-only-source.png"
    base = Image.open(base_path).convert("RGB")
    result = base.copy()
    coverage = Image.new("L", base.size, 0)
    records: list[dict[str, object]] = []
    ACCEPTED.mkdir(parents=True, exist_ok=True)

    for region_id, version in REGIONS:
        candidate_rel = f"candidates/ground-cleanup-{region_id}-v{version}.png"
        mask_rel = f"ground/masks-cleanup/{region_id}.png"
        candidate = Image.open(V3 / candidate_rel).convert("RGB")
        mask = Image.open(V3 / mask_rel).convert("L")
        if candidate.size != base.size:
            raise ValueError(f"Rejected size for {candidate_rel}: {candidate.size} != {base.size}")
        if mask.size != base.size:
            raise ValueError(f"Rejected mask size for {mask_rel}: {mask.size} != {base.size}")
        overlap = ImageChops.multiply(coverage, mask)
        if overlap.getbbox() is not None:
            raise AssertionError(f"Cleanup masks overlap: {region_id}")
        result = Image.composite(candidate, result, mask)
        coverage = ImageChops.lighter(coverage, mask)

        accepted_rel = f"accepted/ground-cleanup/{region_id}-patch.png"
        shutil.copy2(V3 / candidate_rel, V3 / accepted_rel)
        record: dict[str, object] = {
            "id": region_id,
            "mask": mask_rel,
            "candidate": candidate_rel,
            "acceptedPatch": accepted_rel,
            "status": "accepted-after-original-resolution-review",
            "dimensions": list(candidate.size),
        }
        if region_id == "center-mid":
            record["rejectedCandidates"] = ["candidates/ground-cleanup-center-mid-v1.png"]
            record["rejectionReason"] = "wrong dimensions"
        records.append(record)

    extrema = coverage.getextrema()
    if extrema != (255, 255):
        raise AssertionError(f"Cleanup masks do not partition the full canvas: {extrema}")

    partition_out = GROUND / "ground-only-clean-v2-source.png"
    result.save(partition_out, optimize=True)

    repair_mask_rel = "ground/masks-cleanup/east-edge-repair.png"
    repair_candidate_rel = "candidates/ground-cleanup-east-edge-repair-v1.png"
    repair_mask = Image.open(V3 / repair_mask_rel).convert("L")
    repair_candidate = Image.open(V3 / repair_candidate_rel).convert("RGB")
    if repair_candidate.size != base.size or repair_mask.size != base.size:
        raise ValueError("Rejected east-edge repair dimensions")
    result = Image.composite(repair_candidate, result, repair_mask)
    repair_accepted_rel = "accepted/ground-cleanup/east-edge-repair-patch.png"
    shutil.copy2(V3 / repair_candidate_rel, V3 / repair_accepted_rel)

    first_pass_archive = GROUND / "ground-only-first-pass-source.png"
    if not first_pass_archive.exists():
        shutil.copy2(base_path, first_pass_archive)
    source_out = GROUND / "ground-only-source.png"
    runtime_out = GROUND / "ground-only-runtime.png"
    result.save(source_out, optimize=True)
    result.save(runtime_out, optimize=True)

    log = {
        "version": 2,
        "status": "accepted-after-original-resolution-review",
        "base": "ground/ground-only-first-pass-source.png",
        "partitionComposite": "ground/ground-only-clean-v2-source.png",
        "source": "ground/ground-only-source.png",
        "runtime": "ground/ground-only-runtime.png",
        "canvas": {"width": base.width, "height": base.height},
        "partitionCoverage": "100%",
        "regions": records,
        "finalRepair": {
            "id": "east-edge-repair",
            "mask": repair_mask_rel,
            "candidate": repair_candidate_rel,
            "acceptedPatch": repair_accepted_rel,
            "status": "accepted-after-original-resolution-review",
            "dimensions": list(repair_candidate.size),
        },
    }
    (GROUND / "cleanup-log.json").write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"regions": len(records), "size": result.size, "coverage": extrema}))


if __name__ == "__main__":
    main()
