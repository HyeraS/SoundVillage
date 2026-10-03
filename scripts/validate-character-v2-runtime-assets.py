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
rgba = BUILDER.rgba


EXPECTED_EXISTING_HASHES = {
    "overalls": "28445488cd185d89dd5e80e7fe796b4755ef19e56f5d5a3bfb1a1b8ab1adf574",
    "sailor": "60ab6e5fbd22244149ddc7efcc6d9ebfc39c8838ceab610b459dcef60ce48950",
    "sporty": "448f38a7522cb156f76ae8b004ce4aa376a70796ec4694d5b9bc34484817fde3",
    "suit": "e5d05a05fbd4350ef8646377af87d73755b8441e96a8ea05f82faf2822db3f71",
    "witch": "a748c8743a7e8427b9eb62969225fd0d81698bd8fac4d97d7676b44af9f31d9b",
}
EXPECTED_CATALOG_PROJECTION_HASH = "fdec227b3db65988822ed675cdd46d8b682549b63d118932bb7c77a00cb04f5c"
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
EXPECTED_CHARACTER_RUNTIME_HASHES = {
    "overalls": "28445488cd185d89dd5e80e7fe796b4755ef19e56f5d5a3bfb1a1b8ab1adf574",
    "sailor": "60ab6e5fbd22244149ddc7efcc6d9ebfc39c8838ceab610b459dcef60ce48950",
    "sporty": "448f38a7522cb156f76ae8b004ce4aa376a70796ec4694d5b9bc34484817fde3",
    "suit": "e5d05a05fbd4350ef8646377af87d73755b8441e96a8ea05f82faf2822db3f71",
    "witch": "a748c8743a7e8427b9eb62969225fd0d81698bd8fac4d97d7676b44af9f31d9b",
    "clown": "a06845e4fbad0a9f0f33f3f796166949d133a458fea6a454db536e359975d6bb",
    "dress": "fc4b06210a72ddefefbcb6ea5053ec1814bba2e110a775e164f50f163a6dfe22",
    "floral": "45bd1054a23059c7fd8bd0c1f9de4b43c31c2f697e3707639d8ee6778402efa6",
    "pants": "a60f3c50e50dba13e8cf25c8a685c988c4bea3c2de103dcdac0ac7bee503c698",
    "pants_suit": "7260c0b12c9bee6165eb7ee1c0b882aa1398fe9734400f8888279f0ceb51aa45",
    "pumpkin": "88ba57ab6adfbce7462dffbbf4fbb5747676646a85da4b6840267e1c22b86924",
    "sailor_bow": "684238ebda9c09a602c8ee1c5d782416e9c060fa48898f50d5cc76b1f46fc3ba",
    "shoes": "dde6cebabf8be6731ec3e7d005302b54183eed68c2725afd4276d62f29bf146d",
    "skirt": "a1cffe6ec6cc44baf07653a9617a4f3404313a3eb890e4cd6cde9119eee1a543",
    "skull": "bfdb450a39af7b6e1c85777ef0b97c5f5baa6f7c636dbe486a589a87b1df80cd",
    "spaghetti": "1e1158d54cb9fb49048fb453fdc55b661db19e525772bfcc4672ffbf8228b417",
    "spooky": "c6c26ebf7724f5c6e041eb6b92be236318b0a8c449996604450cef45f54cc22e",
    "stripe": "17b54be155a3ea0f40040bd13302875b2ff06168e806ec3e46d8339fc171b727",
    "acc_beard": "a7d555601d99351fc7bdbef7627888da16d359523200a44376ccab2224d37a50",
    "acc_earring_emerald": "9ebfaa94987f68fa9ac05cfb7bf5c0062763954c63d4319f7b704b659b47a3dd",
    "acc_earring_red": "c617ed5c0057626e86e8a1f96f1c21fac698dbbef3aaaea4b6a41cbc5bdafdc2",
    "acc_glasses": "96f8d236f3913ab13dd615a815f5973e5b0fa625d59eb84006728091925ec9a0",
    "acc_sunglasses": "5b03570d43e333bfbea8124a68d1e4f3080d439dfe98f0a8441fd2137c2dbfa0",
    "acc_hat_cowboy": "77de9c3232b5914b4b23acea688fee9fc6704f82d6e089b76df1b6665779f6a1",
    "acc_hat_lucky": "19011105982d6387044b1ac38c64c5cf2c0d02d203fdf87cae6c1abd5952ae81",
    "acc_mask_spooky": "3c5e1693b580a75a6ebbb107524c80a94a01b569261f579d36f377a30166dc0b",
}
EXPECTED_LEGACY_DEFAULT_HASHES = {
    "public/assets/world/player_body.png": "5fa29724a6c0f76f9714a2b763d300a1d091fc49034fdd125620706d1a5907a8",
    "public/assets/world/player_clothes.png": "1bfc4dc269813f159fea015ba92db2875b756577b33113e16810dec7835cd0e8",
    "public/assets/world/player_hair.png": "f6e53d85515bf360613598f0b2593177f60a3aff40ee5705cc196f4ba54c3c39",
}


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
    # Price/demand stability is a contract of paid products. Free starter
    # additions (such as the two interior defaults added after this validator
    # was introduced) must not create a false positive.
    projection["items"] = [
        {key: item[key] for key in fields if key in item}
        for item in catalog["items"] if not item["starterFree"]
    ]
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


def assert_catalog_contract(catalog: dict, items: list[dict], by_id: dict[str, dict]) -> None:
    assert len(by_id) == len(items), "duplicate catalog product ID"
    identities = [item for item in items if item["productGroup"] == "identity"]
    skins = [item for item in identities if item["type"] == "skin"]
    hairs = [item for item in identities if item["type"] == "hair"]
    eyes = [item for item in identities if item["type"] == "eyes"]
    outfits = [item for item in items if item["productGroup"] == "outfit"]
    accessories = [item for item in items if item["productGroup"] == "accessory"]
    interior = [item for item in items if item["productGroup"] in ("interior", "interior_starter", "theme_set")]

    assert len(skins) == 8 and {item["id"] for item in skins} == {f"skin_{index:02d}" for index in range(1, 9)}
    assert len(hairs) == 13, "hair style count changed"
    assert len(eyes) == 14, "eye color count changed"
    assert len(outfits) == 19, "outfit count must be basic plus 18 paid"
    assert sum(item["starterFree"] for item in outfits) == 1 and len([item for item in outfits if not item["starterFree"]]) == 18
    assert len(accessories) == 8 and all(not item["starterFree"] for item in accessories)
    assert len(identities) == 35, "free identity count changed"
    assert sum(item["officialStoreStatus"] == "free_customization" and item["productGroup"] in ("identity", "outfit", "accessory") for item in items) == 36
    assert sum(not item["starterFree"] for item in items) == 75, "paid product count changed"
    assert sum(not item["starterFree"] and item["officialStoreStatus"] == "approved" for item in items) == 69, "approved paid product count changed"
    assert projection_digest(catalog) == EXPECTED_CATALOG_PROJECTION_HASH, "paid catalog prices, demand contract, statuses, sets, or products changed"
    demand = {village: sum(item["cost"][village] for item in items if not item["starterFree"]) for village in catalog["currencyOrder"]}
    assert demand == EXPECTED_DEMAND, f"village demand changed: {demand}"

    for item in (*identities, *outfits, *accessories):
        expected_status = "free_customization" if item["starterFree"] else "approved"
        assert item["officialStoreStatus"] == expected_status, f"{item['id']}: unexpected store status"
        assert item["existingGameConnected"] is True, f"{item['id']}: renderer connection missing"
        assert item.get("runtimeAsset") or item.get("plannedRuntimeAsset"), f"{item['id']}: runtime path missing"
    assert all(item["productGroup"] not in ("identity", "outfit", "accessory") for item in interior)
    assert all(item["type"] not in ("skin", "hair", "eyes") for item in interior)
    assert {item["id"] for item in items if item["productGroup"] == "interior_starter"} == {"starter_wall_neutral", "starter_floor_beige"}


def assert_identity_runtime_contract(by_id: dict[str, dict]) -> None:
    contract = BUILDER.load_identity_contract()
    paths = BUILDER.identity_runtime_paths(contract)
    for item_id, runtime_asset in paths["skins"].items():
        source = rgba(ROOT / by_id[item_id]["sourceAsset"]).crop((0, 0, *WALK_SIZE))
        output = public_path(runtime_asset)
        size, output_pixels, alpha = pixels(output)
        assert size == WALK_SIZE and 0 in alpha and max(alpha) == 255
        assert output_pixels == source.tobytes(), f"{item_id}: runtime differs from source"
    eye_source = rgba(ROOT / by_id["eyes_black"]["sourceAsset"])
    embedded_eye_color = (87, 110, 92)
    palette_colors = []
    for index, eye in enumerate(contract["eyeColors"]):
        output = public_path(paths["eyes"][eye["id"]])
        size, output_pixels, alpha = pixels(output)
        expected = eye_source.crop((index * WALK_SIZE[0], 0, (index + 1) * WALK_SIZE[0], WALK_SIZE[1]))
        assert size == WALK_SIZE and 0 in alpha and max(alpha) == 255
        assert output_pixels == expected.tobytes(), f"{eye['id']}: runtime differs from source palette"
        palette_colors.append(next(pixel[:3] for pixel in expected.get_flattened_data() if pixel[3]))
    nearest_eye_index = min(range(len(palette_colors)), key=lambda index: sum((palette_colors[index][channel] - embedded_eye_color[channel]) ** 2 for channel in range(3)))
    assert contract["eyeColors"][nearest_eye_index]["id"] == contract["defaultLoadout"]["eyesId"], "default eye ID no longer matches the nearest original embedded eye palette"
    for style in contract["hairStyles"]:
        source = rgba(ROOT / by_id[style["id"]]["sourceAsset"])
        assert source.width == WALK_SIZE[0] * len(contract["hairColors"]), f"{style['id']}: palette count changed"
        for index, color in enumerate(contract["hairColors"]):
            output = public_path(paths["hair"][style["id"]][color["id"]])
            size, output_pixels, alpha = pixels(output)
            expected = source.crop((index * WALK_SIZE[0], 0, (index + 1) * WALK_SIZE[0], WALK_SIZE[1]))
            assert size == WALK_SIZE and 0 in alpha and max(alpha) == 255
            assert output_pixels == expected.tobytes(), f"{style['id']}/{color['id']}: runtime differs from source palette"
    preview_count = sum(len(tuple((ROOT / "public/assets/character-v2/previews" / group).glob("*.png"))) for group in ("skin", "hair-style", "hair-color", "eyes"))
    assert preview_count == 49, f"identity preview count changed: {preview_count}"
    for filename in ("asset-contact-sheet-skins.png", "asset-contact-sheet-hair.png", "asset-contact-sheet-eyes.png"):
        assert (BUILDER.STAGE2_REVIEW_DIR / filename).is_file(), f"Stage 2 review output missing: {filename}"

    legacy_default = rgba(ROOT / "public/assets/world/player_body.png")
    legacy_default.alpha_composite(rgba(ROOT / "public/assets/world/player_clothes.png"))
    legacy_default.alpha_composite(rgba(ROOT / "public/assets/world/player_hair.png"))
    stage2_default = rgba(public_path(paths["skins"][contract["defaultLoadout"]["skinId"]]))
    stage2_default.alpha_composite(rgba(ROOT / "public/assets/world/player_clothes.png"))
    stage2_default.alpha_composite(rgba(public_path(paths["hair"][contract["defaultLoadout"]["hairStyleId"]][contract["defaultLoadout"]["hairColorId"]])))
    assert stage2_default.tobytes() == legacy_default.tobytes(), "extended default is not pixel-identical to the legacy character"


def main() -> None:
    catalog = json.loads((ROOT / "data/economy/catalog-v1.json").read_text(encoding="utf-8"))
    items = catalog["items"]
    by_id = {item["id"]: item for item in items}
    assert_catalog_contract(catalog, items, by_id)

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

    for item_id, expected_hash in EXPECTED_CHARACTER_RUNTIME_HASHES.items():
        assert digest(public_path(by_id[item_id]["runtimeAsset"])) == expected_hash, f"{item_id}: existing runtime hash changed"
    for relative_path, expected_hash in EXPECTED_LEGACY_DEFAULT_HASHES.items():
        assert digest(ROOT / relative_path) == expected_hash, f"legacy default changed: {relative_path}"

    assert_identity_runtime_contract(by_id)

    for currency in CURRENCIES:
        path = ROOT / "public/assets/economy/village-currencies" / f"{currency}.png"
        assert path.is_file(), f"{currency}: currency icon missing"
        size, _, alpha = pixels(path)
        assert size == (32, 32), f"{currency}: currency icon must be 32x32"
        assert 0 in alpha and max(alpha) == 255, f"{currency}: icon transparency contract failed"

    for filename in EXPECTED_REVIEW_FILES:
        assert (REVIEW_DIR / filename).is_file(), f"review output missing: {filename}"

    assert_registry_contract()
    print("character-v2 assets: semantic 113-item catalog, 8 skins, 13x14 hair, 14 eyes, 18 outfits, 8 accessories, previews, reviews, and hashes passed")


if __name__ == "__main__":
    main()
