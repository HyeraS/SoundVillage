#!/usr/bin/env python3
"""Legacy reference-registration collision generator.

Production authority is scripts/build-world-map-v4-collision.mjs. This older
color-selection/manual-polygon path must not be mixed with the JavaScript
logical-object generator or used to refresh the production mask during normal
builds.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import runpy
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "design/world-map-v4/source-assets/world-base-clean-reference.png"
REVIEW = ROOT / "_review/world-map-reference-reconstruction-v4"
EXPECTED_REFERENCE_SHA256 = "6578b3ddcdb487547892bc03bd44afc32a30326d8c165402f336149e73bc1df1"


def validate_reference() -> None:
    if REFERENCE.is_symlink():
        raise SystemExit(f"reference input must not be a symlink: {REFERENCE}")
    if not REFERENCE.exists():
        raise SystemExit(f"reference input is missing: {REFERENCE}")
    if not REFERENCE.is_file():
        raise SystemExit(f"reference input is not a regular file: {REFERENCE}")

    digest = hashlib.sha256()
    with REFERENCE.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual != EXPECTED_REFERENCE_SHA256:
        raise SystemExit(
            "reference input SHA-256 mismatch: "
            f"expected {EXPECTED_REFERENCE_SHA256}, actual {actual}"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()
    # Reuse the registered color-selection and hand-traced corrections that
    # were authored against this exact map, rather than the rejected v3 paths.
    hd_builder = runpy.run_path(str(ROOT / "scripts/build-world-map-hd-assets.py"))
    build_mask = hd_builder["registered_navigation_mask"]
    validate_reference()
    source = Image.open(REFERENCE).convert("RGB")
    raw, clearance = build_mask(source)

    if args.report:
        REVIEW.mkdir(parents=True, exist_ok=True)

    report = {
        "status": "PASS",
        "source": str(REFERENCE.relative_to(ROOT)),
        "width": 960,
        "height": 720,
        "cellSize": 4,
        "rawWalkableCells": int(raw.sum()),
        "clearanceCells": int(clearance.sum()),
        "registration": {"worldWidth": 3840, "worldHeight": 2880, "referenceWidth": 2896, "referenceHeight": 2172},
    }
    if args.report:
        (REVIEW / "collision-build.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
