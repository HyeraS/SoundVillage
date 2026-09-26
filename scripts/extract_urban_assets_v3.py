#!/usr/bin/env python3
"""Extract v3 instance sprites while preserving canonical reference pixels.

The generated ground restoration is used only underneath inventory bounds. Pixels
outside those bounds are known-visible ground and are copied losslessly from the
canonical map. Within bounds, a conservative canonical-vs-ground matte isolates
the visible source pixels. Every accepted sprite therefore has real alpha and
retains the canonical RGB values without repainting.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public/assets/urban-city-v3"
CANONICAL_PATH = V3 / "reference/canonical-map-art-source.png"
GROUND_PATH = V3 / "ground/ground-only-source.png"
THRESHOLD = 12


def bounds_tuple(entry: dict) -> tuple[int, int, int, int]:
    bounds = entry["referenceBounds"]
    return bounds["x"], bounds["y"], bounds["x"] + bounds["w"], bounds["y"] + bounds["h"]


def prompt_text(entry: dict) -> str:
    bounds = entry["referenceBounds"]
    return f"""Use case: reference-pixel-preserving background extraction

Asset: {entry['id']} ({entry['category']})
Reference bounds: x={bounds['x']}, y={bounds['y']}, w={bounds['w']}, h={bounds['h']}

Image 1 is the finalized full Urban map and sole positive composition/style reference.
Image 2 is this exact target crop and is the primary geometry, pixel, color, material,
lighting, orientation, and scale reference. Preserve its visible source pixels.

For this accepted visible extraction, mechanical alpha matting removes reconstructed
ground while canonical RGB pixels remain unchanged. If a later hidden-region edit is
needed, change only the occluded portion and reject any result that moves, redesigns,
rescales, blurs, crops, or repaints visible reference pixels. Output must be one
uncropped orthographic pixel-art object on genuine transparent PNG background.
"""


def main() -> None:
    inventory_path = V3 / "inventory.json"
    manifest_path = V3 / "manifest.json"
    inventory = json.loads(inventory_path.read_text())
    canonical_image = Image.open(CANONICAL_PATH).convert("RGB")
    restored_archive = V3 / "ground/ground-only-restored-source.png"
    restored_input = restored_archive if restored_archive.exists() else GROUND_PATH
    restored_ground_image = Image.open(restored_input).convert("RGB")
    if canonical_image.size != restored_ground_image.size:
        raise ValueError("Canonical and ground dimensions differ")

    canonical = np.asarray(canonical_image, dtype=np.int16)
    restored_ground = np.asarray(restored_ground_image, dtype=np.int16)
    width, height = canonical_image.size

    union_image = Image.new("L", (width, height), 0)
    union_draw = ImageDraw.Draw(union_image)
    for entry in inventory["instances"]:
        if entry["category"] != "ground":
            x0, y0, x1, y1 = bounds_tuple(entry)
            union_draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=255)
    union = np.asarray(union_image, dtype=np.uint8) > 0

    if not restored_archive.exists():
        shutil.copy2(GROUND_PATH, restored_archive)

    # Known-visible ground stays pixel-identical to the canonical source.
    hybrid = np.where(union[..., None], restored_ground, canonical)
    hybrid_u8 = hybrid.astype(np.uint8)
    Image.fromarray(hybrid_u8, "RGB").save(V3 / "ground/ground-only-source.png", optimize=True)
    Image.fromarray(hybrid_u8, "RGB").save(V3 / "ground/ground-only-runtime.png", optimize=True)
    union_image.save(V3 / "ground/object-bounds-union-mask.png", optimize=True)

    difference = np.max(np.abs(canonical - hybrid), axis=2)
    global_visible = difference > THRESHOLD
    Image.fromarray((global_visible * 255).astype(np.uint8), "L").save(
        V3 / "ground/reference-difference-visible-mask.png", optimize=True
    )

    object_entries = [entry for entry in inventory["instances"] if entry["category"] != "ground"]
    object_index = {entry["id"]: index for index, entry in enumerate(object_entries)}
    owner = np.full((height, width), -1, dtype=np.int16)
    owner_score = np.full((height, width), np.inf, dtype=np.float32)
    # Bounds overlap extensively. Attribute a shared pixel to the object whose
    # normalized center is closest, which keeps small props from inheriting an
    # entire building/metro rectangle while still partitioning every matte pixel.
    for entry in object_entries:
        x0, y0, x1, y1 = bounds_tuple(entry)
        yy, xx = np.ogrid[y0:y1, x0:x1]
        cx = (x0 + x1 - 1) / 2
        cy = (y0 + y1 - 1) / 2
        rx = max(1.0, (x1 - x0) / 2)
        ry = max(1.0, (y1 - y0) / 2)
        score = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 - entry["anchorY"] / 200.0
        current = owner_score[y0:y1, x0:x1]
        take = score < current
        current[take] = score[take]
        owner[y0:y1, x0:x1][take] = object_index[entry["id"]]

    runtime_assets: list[dict] = []
    for entry in inventory["instances"]:
        entry_id = entry["id"]
        category = entry["category"]
        bounds = entry["referenceBounds"]
        x0, y0, x1, y1 = bounds_tuple(entry)
        source_rel = f"sources/{entry_id}-reference-crop.png"
        mask_rel = f"masks/{entry_id}-visible-mask.png"
        prompt_rel = f"prompts/{entry_id}.md"
        source_path = V3 / source_rel
        mask_path = V3 / mask_rel
        prompt_path = V3 / prompt_rel
        source_path.parent.mkdir(parents=True, exist_ok=True)
        mask_path.parent.mkdir(parents=True, exist_ok=True)
        prompt_path.parent.mkdir(parents=True, exist_ok=True)

        crop_rgb = canonical[y0:y1, x0:x1].astype(np.uint8)
        Image.fromarray(crop_rgb, "RGB").save(source_path, optimize=True)
        prompt_path.write_text(prompt_text(entry))

        if category == "ground":
            local_mask = np.full((bounds["h"], bounds["w"]), 255, dtype=np.uint8)
            Image.fromarray(local_mask, "L").save(mask_path, optimize=True)
            entry.update({
                "sourceCrop": source_rel,
                "visiblePixelMask": mask_rel,
                "promptFile": prompt_rel,
                "candidateFile": None,
                "acceptedRuntimeFile": "ground/ground-only-runtime.png",
                "review": {"status": "accepted", "rejectionReason": None},
            })
            continue

        local_mask_bool = global_visible[y0:y1, x0:x1] & (
            owner[y0:y1, x0:x1] == object_index[entry_id]
        )
        local_mask = (local_mask_bool * 255).astype(np.uint8)
        Image.fromarray(local_mask, "L").save(mask_path, optimize=True)
        foreground_alpha = np.zeros_like(local_mask)
        if entry.get("foregroundRects"):
            for rect in entry["foregroundRects"]:
                rx0 = max(0, rect["x"] - x0)
                ry0 = max(0, rect["y"] - y0)
                rx1 = min(bounds["w"], rect["x"] + rect["w"] - x0)
                ry1 = min(bounds["h"], rect["y"] + rect["h"] - y0)
                if rx1 > rx0 and ry1 > ry0:
                    foreground_alpha[ry0:ry1, rx0:rx1] = local_mask[ry0:ry1, rx0:rx1]
        base_alpha = local_mask.copy()
        base_alpha[foreground_alpha > 0] = 0
        rgba = np.dstack((crop_rgb, base_alpha))

        candidate_rel = f"candidates/{entry_id}-candidate-v1.png"
        accepted_rel = f"accepted/{category}/{entry_id}.png"
        candidate_path = V3 / candidate_rel
        accepted_path = V3 / accepted_rel
        candidate_path.parent.mkdir(parents=True, exist_ok=True)
        accepted_path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba, "RGBA").save(candidate_path, optimize=True)
        Image.fromarray(rgba, "RGBA").save(accepted_path, optimize=True)

        foreground_rel = None
        if foreground_alpha.any():
                foreground_rel = f"accepted/foreground/{entry_id}-foreground.png"
                foreground_path = V3 / foreground_rel
                foreground_path.parent.mkdir(parents=True, exist_ok=True)
                foreground_rgba = np.dstack((crop_rgb, foreground_alpha))
                Image.fromarray(foreground_rgba, "RGBA").save(foreground_path, optimize=True)

        entry.update({
            "sourceCrop": source_rel,
            "visiblePixelMask": mask_rel,
            "promptFile": prompt_rel,
            "candidateFile": candidate_rel,
            "acceptedRuntimeFile": accepted_rel,
            "review": {"status": "extracted-needs-alpha-review", "rejectionReason": None},
        })
        runtime_assets.append({
            "id": entry_id,
            "category": category,
            "file": accepted_rel,
            "sourceCrop": source_rel,
            "referenceBounds": bounds,
            "worldBounds": entry["worldBounds"],
            "nativePixels": {"width": bounds["w"], "height": bounds["h"]},
            "runtimePixels": {"width": bounds["w"], "height": bounds["h"]},
            "anchorX": entry["anchorX"],
            "anchorY": entry["anchorY"],
            "zLayer": entry["layer"],
            "ySort": entry["layer"] == "y-sort",
            "collisionRects": entry.get("collisionRects", []),
            "foregroundRects": entry.get("foregroundRects", []),
            "shadowFile": None,
            "emissiveFile": None,
            "foregroundFile": foreground_rel,
            "promptFile": prompt_rel,
            "sourceReferenceFile": source_rel,
            "generationMode": "canonical-visible-pixel-extraction",
            "acceptedCandidate": candidate_rel,
            "alphaRole": "straight-alpha-visible-object",
            "reviewStatus": "extracted-needs-alpha-review",
        })

    inventory["extraction"] = {
        "mode": "canonical-visible-pixel-preserving-difference-matte",
        "differenceThreshold": THRESHOLD,
        "knownVisibleGroundPixelIdentity": True,
        "restoredGroundArchive": "ground/ground-only-restored-source.png",
    }
    inventory_path.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n")

    manifest = json.loads(manifest_path.read_text())
    manifest.update({
        "ground": {
            "id": "ground-only",
            "file": "ground/ground-only-runtime.png",
            "nativePixels": {"width": width, "height": height},
            "runtimePixels": {"width": width, "height": height},
            "alphaRole": "opaque-ground",
            "reviewStatus": "accepted",
        },
        "runtimeAssets": runtime_assets,
        "productionSwitched": False,
        "review": {
            "phase": "D",
            "status": "extracted-awaiting-contact-sheet-and-art-only-gate",
            "visibleDifferenceThreshold": THRESHOLD,
        },
    })
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    # Deterministic reconstruction proof using the same straight-alpha contract.
    review = Image.fromarray(hybrid_u8, "RGB").convert("RGBA")
    foreground_layers: list[tuple[Image.Image, tuple[int, int]]] = []
    for entry in inventory["instances"]:
        if entry["category"] == "ground":
            continue
        sprite = Image.open(V3 / entry["acceptedRuntimeFile"]).convert("RGBA")
        bounds = entry["worldBounds"]
        review.alpha_composite(sprite, (bounds["x"], bounds["y"]))
        runtime_entry = next(asset for asset in runtime_assets if asset["id"] == entry["id"])
        if runtime_entry["foregroundFile"]:
            foreground_layers.append((
                Image.open(V3 / runtime_entry["foregroundFile"]).convert("RGBA"),
                (bounds["x"], bounds["y"]),
            ))
    for sprite, position in foreground_layers:
        review.alpha_composite(sprite, position)
    review_dir = ROOT / "_review/urban-advanced-city/imagegen-reference-exact-v3"
    review_dir.mkdir(parents=True, exist_ok=True)
    review.convert("RGB").save(review_dir / "art-only-extracted.png", optimize=True)
    print(json.dumps({
        "inventory": len(inventory["instances"]),
        "runtimeAssets": len(runtime_assets),
        "threshold": THRESHOLD,
        "nonTransparentPixelFraction": float(global_visible.mean()),
    }))


if __name__ == "__main__":
    main()
