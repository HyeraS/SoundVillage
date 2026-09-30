#!/usr/bin/env python3
"""Validate SoundVillage 3A Character v2 runtime and review contracts."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image

BUILD_SCRIPT = Path(__file__).with_name("build-character-v2-runtime-assets.py")
BUILD_SPEC = importlib.util.spec_from_file_location("character_v2_asset_builder", BUILD_SCRIPT)
assert BUILD_SPEC and BUILD_SPEC.loader
BUILDER = importlib.util.module_from_spec(BUILD_SPEC)
BUILD_SPEC.loader.exec_module(BUILDER)

ACCESSORY_IDS = BUILDER.ACCESSORY_IDS
CURRENCIES = BUILDER.CURRENCIES
EXISTING_OUTFIT_IDS = BUILDER.EXISTING_OUTFIT_IDS
PAID_OUTFIT_IDS = BUILDER.PAID_OUTFIT_IDS
PREVIEW_SIZE = BUILDER.PREVIEW_SIZE
REVIEW_DIR = BUILDER.REVIEW_DIR
ROOT = BUILDER.ROOT
WALK_SIZE = BUILDER.WALK_SIZE
canonical_walk_block = BUILDER.canonical_walk_block
public_path = BUILDER.public_path


EXPECTED_EXISTING_HASHES = {
    "overalls": "28445488cd185d89dd5e80e7fe796b4755ef19e56f5d5a3bfb1a1b8ab1adf574",
    "sailor": "60ab6e5fbd22244149ddc7efcc6d9ebfc39c8838ceab610b459dcef60ce48950",
    "sporty": "448f38a7522cb156f76ae8b004ce4aa376a70796ec4694d5b9bc34484817fde3",
    "suit": "e5d05a05fbd4350ef8646377af87d73755b8441e96a8ea05f82faf2822db3f71",
    "witch": "a748c8743a7e8427b9eb62969225fd0d81698bd8fac4d97d7676b44af9f31d9b",
}
EXPECTED_CATALOG_PROJECTION_HASH = "94aea628eb1fb4dee4e9ca16b5baf07e54e7ac73509d912eb6f7e6de0e1ee486"
EXPECTED_DEMAND = {"Animal": 427, "Human": 429, "Nature": 429, "Urban": 429, "Music": 429, "Lab": 427}
EXPECTED_REVIEW_FILES = (
    "currency-icons-light-dark.png",
    "outfits-contact-sheet.png",
    "accessories-contact-sheet.png",
    "front-layer-comparison.png",
    "outfit-existing-vs-new-anchors.png",
    "nearest-neighbor-8x.png",
    "currency-icons-hud-sizes.png",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pixels(path: Path) -> tuple[tuple[int, int], bytes, list[int]]:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        alpha_values = list(alpha.get_flattened_data()) if hasattr(alpha, "get_flattened_data") else list(alpha.getdata())
        return rgba.size, rgba.tobytes(), alpha_values


def catalog_projection(catalog: dict) -> dict:
    fields = (
        "id", "name", "type", "productGroup", "animation", "rarity", "cost",
        "requiredVillageCount", "estimatedAnnotationCount", "minimumFreshAnnotationCount",
        "starterFree", "officialStoreStatus", "priceTier", "currencyCombination",
        "currentCatalog", "bundleItemIds",
    )
    projection = {key: catalog[key] for key in ("currencyOrder", "currencyCombinations", "priceRules", "balancePolicy", "themeSetPolicy")}
    projection["items"] = [{key: item[key] for key in fields if key in item} for item in catalog["items"]]
    return projection


def projection_digest(catalog: dict) -> str:
    payload = json.dumps(catalog_projection(catalog), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def assert_registry_contract() -> None:
    registry = (ROOT / "components/AssetRegistry.js").read_text(encoding="utf-8")
    library = (ROOT / "components/LibraryRoom.js").read_text(encoding="utf-8")
    for item_id in PAID_OUTFIT_IDS:
        assert f"{item_id}:" in registry, f"OUTFIT_SHEETS missing {item_id}"
    for item_id in ACCESSORY_IDS:
        assert f"{item_id}:" in registry, f"ACCESSORY_SHEETS missing {item_id}"
    for currency in CURRENCIES:
        assert f"/assets/economy/village-currencies/{currency}.png" in registry, f"currency registry missing {currency}"
    assert "resolveWorldCharacterLayers" in registry, "optional layer resolver is missing"
    assert "accessorySrc" in library, "player renderer has no optional accessory input"


def main() -> None:
    catalog = json.loads((ROOT / "data/economy/catalog-v1.json").read_text(encoding="utf-8"))
    items = catalog["items"]
    by_id = {item["id"]: item for item in items}
    assert len(by_id) == len(items), "duplicate catalog product ID"
    assert len(items) == 111, "catalog product count changed"
    assert sum(not item["starterFree"] for item in items) == 75, "paid product count changed"
    assert projection_digest(catalog) == EXPECTED_CATALOG_PROJECTION_HASH, "catalog prices, demand contract, statuses, sets, or products changed"
    demand = {village: sum(item["cost"][village] for item in items if not item["starterFree"]) for village in catalog["currencyOrder"]}
    assert demand == EXPECTED_DEMAND, f"village demand changed: {demand}"

    for item_id in (*PAID_OUTFIT_IDS, *ACCESSORY_IDS):
        item = by_id[item_id]
        assert item["runtimeAsset"], f"{item_id}: runtimeAsset missing"
        assert item["plannedRuntimeAsset"] is None, f"{item_id}: plannedRuntimeAsset was not cleared"
        assert item["existingGameConnected"] is True, f"{item_id}: not marked renderer-connected"
        output_path = public_path(item["runtimeAsset"])
        assert output_path.is_file(), f"{item_id}: runtime file missing"
        size, output_pixels, alpha = pixels(output_path)
        assert size == WALK_SIZE, f"{item_id}: expected {WALK_SIZE}, got {size}"
        assert 0 in alpha, f"{item_id}: transparent background was lost"
        assert max(alpha) == 255, f"{item_id}: opaque source pixels were lost"
        expected = canonical_walk_block(item)
        assert output_pixels == expected.tobytes(), f"{item_id}: runtime pixels differ from canonical source region"

        preview_group = "accessories" if item["type"] == "accessory" else "outfits"
        preview_path = ROOT / "public/assets/economy/previews" / preview_group / f"{item_id}.png"
        preview_size, _, preview_alpha = pixels(preview_path)
        assert preview_size == (PREVIEW_SIZE, PREVIEW_SIZE), f"{item_id}: invalid preview size"
        assert 0 in preview_alpha, f"{item_id}: preview background must remain transparent"

    for item_id in EXISTING_OUTFIT_IDS:
        path = public_path(by_id[item_id]["runtimeAsset"])
        assert digest(path) == EXPECTED_EXISTING_HASHES[item_id], f"{item_id}: existing file hash changed"

    for currency in CURRENCIES:
        path = ROOT / "public/assets/economy/village-currencies" / f"{currency}.png"
        assert path.is_file(), f"{currency}: currency icon missing"
        size, _, alpha = pixels(path)
        assert size == (32, 32), f"{currency}: currency icon must be 32x32"
        assert 0 in alpha and max(alpha) == 255, f"{currency}: icon transparency contract failed"

    for filename in EXPECTED_REVIEW_FILES:
        assert (REVIEW_DIR / filename).is_file(), f"review output missing: {filename}"

    assert_registry_contract()
    print("character-v2 assets: 18 outfits, 8 accessories, 6 currencies, previews, reviews, and catalog invariants passed")


if __name__ == "__main__":
    main()
