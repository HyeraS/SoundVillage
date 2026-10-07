#!/usr/bin/env python3
"""Validate the isolated SoundVillage village-currency icon contract."""

from __future__ import annotations

import hashlib
import importlib.util
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "scripts/build-village-currency-icons.py"
BUILD_SPEC = importlib.util.spec_from_file_location("village_currency_builder", BUILD_SCRIPT)
assert BUILD_SPEC and BUILD_SPEC.loader
BUILDER = importlib.util.module_from_spec(BUILD_SPEC)
BUILD_SPEC.loader.exec_module(BUILDER)
RUNTIME_DIR = ROOT / "public/assets/economy/village-currencies"
REVIEW_DIR = ROOT / "_review/economy-v1-assets/currency-pack-selection"
A_DIR = ROOT / "_review/economy-v1-assets/currency-icons-generated-draft-a"
VILLAGES = ("animal", "human", "nature", "urban", "music", "lab")
VILLAGE_RENDERERS = {
    "animal": "lib/animalVillage.js",
    "human": "lib/humanVillage.js",
    "nature": "lib/natureVillage.js",
    "urban": "lib/urbanVillage.js",
    "music": "lib/musicVillage.js",
    "lab": "lib/labVillage.js",
}

A_HASHES = {
    "animal.png": "5327bf2f6d72e861b510b6229ae9d916f628adec5e1dc8ddc97b20898b1cfd02",
    "human.png": "cf7fb632381acd33b818753918b6045503a94e3b25c378097b06f66d0a622521",
    "nature.png": "46a04578bc3b9d772825965549dd6882addfb479cb014d495869c4fa804e0142",
    "urban.png": "44509b72b2e085fc20095958f390233bbdbbf45f6f2f077933f354641c5e9775",
    "music.png": "989cd17a84dded85d7f575ea681c5765a414e6aa66d8128250e2c4d032345f99",
    "lab.png": "545a776025c09be95c2b1062376d2e3b8fcba0231b48f1c9ba26345bc35545cc",
}

CHARACTER_RUNTIME_HASHES = {
    "public/assets/character-v2/accessories/beard-walk.png": "a7d555601d99351fc7bdbef7627888da16d359523200a44376ccab2224d37a50",
    "public/assets/character-v2/accessories/earring_emerald-walk.png": "9ebfaa94987f68fa9ac05cfb7bf5c0062763954c63d4319f7b704b659b47a3dd",
    "public/assets/character-v2/accessories/earring_red-walk.png": "c617ed5c0057626e86e8a1f96f1c21fac698dbbef3aaaea4b6a41cbc5bdafdc2",
    "public/assets/character-v2/accessories/glasses-walk.png": "96f8d236f3913ab13dd615a815f5973e5b0fa625d59eb84006728091925ec9a0",
    "public/assets/character-v2/accessories/hat_cowboy-walk.png": "77de9c3232b5914b4b23acea688fee9fc6704f82d6e089b76df1b6665779f6a1",
    "public/assets/character-v2/accessories/hat_lucky-walk.png": "19011105982d6387044b1ac38c64c5cf2c0d02d203fdf87cae6c1abd5952ae81",
    "public/assets/character-v2/accessories/mask_spooky-walk.png": "3c5e1693b580a75a6ebbb107524c80a94a01b569261f579d36f377a30166dc0b",
    "public/assets/character-v2/accessories/sunglasses-walk.png": "5b03570d43e333bfbea8124a68d1e4f3080d439dfe98f0a8441fd2137c2dbfa0",
    "public/assets/character-v2/outfits/clown-walk.png": "a06845e4fbad0a9f0f33f3f796166949d133a458fea6a454db536e359975d6bb",
    "public/assets/character-v2/outfits/dress-walk.png": "fc4b06210a72ddefefbcb6ea5053ec1814bba2e110a775e164f50f163a6dfe22",
    "public/assets/character-v2/outfits/floral-walk.png": "45bd1054a23059c7fd8bd0c1f9de4b43c31c2f697e3707639d8ee6778402efa6",
    "public/assets/character-v2/outfits/pants-suit-walk.png": "7260c0b12c9bee6165eb7ee1c0b882aa1398fe9734400f8888279f0ceb51aa45",
    "public/assets/character-v2/outfits/pants-walk.png": "a60f3c50e50dba13e8cf25c8a685c988c4bea3c2de103dcdac0ac7bee503c698",
    "public/assets/character-v2/outfits/pumpkin-walk.png": "88ba57ab6adfbce7462dffbbf4fbb5747676646a85da4b6840267e1c22b86924",
    "public/assets/character-v2/outfits/sailor-bow-walk.png": "684238ebda9c09a602c8ee1c5d782416e9c060fa48898f50d5cc76b1f46fc3ba",
    "public/assets/character-v2/outfits/shoes-walk.png": "dde6cebabf8be6731ec3e7d005302b54183eed68c2725afd4276d62f29bf146d",
    "public/assets/character-v2/outfits/skirt-walk.png": "a1cffe6ec6cc44baf07653a9617a4f3404313a3eb890e4cd6cde9119eee1a543",
    "public/assets/character-v2/outfits/skull-walk.png": "bfdb450a39af7b6e1c85777ef0b97c5f5baa6f7c636dbe486a589a87b1df80cd",
    "public/assets/character-v2/outfits/spaghetti-walk.png": "1e1158d54cb9fb49048fb453fdc55b661db19e525772bfcc4672ffbf8228b417",
    "public/assets/character-v2/outfits/spooky-walk.png": "c6c26ebf7724f5c6e041eb6b92be236318b0a8c449996604450cef45f54cc22e",
    "public/assets/character-v2/outfits/stripe-walk.png": "17b54be155a3ea0f40040bd13302875b2ff06168e806ec3e46d8339fc171b727",
    "public/assets/world/outfits/overalls.png": "28445488cd185d89dd5e80e7fe796b4755ef19e56f5d5a3bfb1a1b8ab1adf574",
    "public/assets/world/outfits/sailor.png": "60ab6e5fbd22244149ddc7efcc6d9ebfc39c8838ceab610b459dcef60ce48950",
    "public/assets/world/outfits/sporty.png": "448f38a7522cb156f76ae8b004ce4aa376a70796ec4694d5b9bc34484817fde3",
    "public/assets/world/outfits/suit.png": "e5d05a05fbd4350ef8646377af87d73755b8441e96a8ea05f82faf2822db3f71",
    "public/assets/world/outfits/witch.png": "a748c8743a7e8427b9eb62969225fd0d81698bd8fac4d97d7676b44af9f31d9b",
}

CATALOG_HASH = "e8f4bde2ab86efd8445085bf93aa39f3c9d20e6f5739042202a6ce5a1fd25052"
REVIEW_FILES = (
    "all-candidates.png",
    "recommended-six.png",
    "generated-a-vs-asset-pack-b.png",
    "hud-24px-light.png",
    "hud-24px-dark.png",
    "hud-32px.png",
    "nearest-neighbor-8x.png",
    "silhouette-test.png",
    "README.md",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_hashes(expected: dict[str, str], label: str) -> None:
    for relative_path, expected_hash in expected.items():
        path = ROOT / relative_path
        assert path.is_file(), f"{label} missing: {relative_path}"
        actual = digest(path)
        assert actual == expected_hash, f"{label} changed: {relative_path} ({actual})"


def main() -> None:
    expected_names = {f"{village}.png" for village in VILLAGES}
    actual_names = {path.name for path in RUNTIME_DIR.glob("*.png")}
    assert actual_names == expected_names, f"runtime directory must contain only the six 32px icons: {sorted(actual_names)}"

    pixel_digests: dict[str, str] = {}
    for village in VILLAGES:
        path = RUNTIME_DIR / f"{village}.png"
        assert path.is_file(), f"missing currency icon: {path}"
        with Image.open(path) as image:
            assert image.format == "PNG", f"{village}: must be PNG"
            assert image.mode == "RGBA", f"{village}: must be stored as RGBA, got {image.mode}"
            assert image.size == (32, 32), f"{village}: expected 32x32, got {image.size}"
            alpha = image.getchannel("A")
            alpha_values = set(alpha.get_flattened_data()) if hasattr(alpha, "get_flattened_data") else set(alpha.getdata())
            assert alpha_values == {0, 255}, f"{village}: partial alpha/anti-aliasing found: {sorted(alpha_values)}"
            assert alpha.getbbox() == (2, 2, 30, 30), f"{village}: opaque bounds are clipped or margins changed: {alpha.getbbox()}"
            opaque_colors = {pixel[:3] for pixel in image.get_flattened_data() if pixel[3]} if hasattr(image, "get_flattened_data") else {pixel[:3] for pixel in image.getdata() if pixel[3]}
            assert len(opaque_colors) == 5, f"{village}: expected the shared five-role shade system, got {len(opaque_colors)} colors"
            expected, _silhouette = BUILDER.refined_candidate(village)
            assert image.tobytes() == expected.tobytes(), f"{village}: runtime icon no longer matches the approved 32px asset"
            pixel_digests[village] = hashlib.sha256(image.tobytes()).hexdigest()

    assert len(set(pixel_digests.values())) == len(VILLAGES), "two runtime icons are pixel-identical"

    for filename, expected_hash in A_HASHES.items():
        path = A_DIR / filename
        assert path.is_file(), f"archived A icon missing: {filename}"
        assert digest(path) == expected_hash, f"archived A icon changed: {filename}"

    for village in VILLAGES:
        for candidate_number in (1, 2):
            candidate = REVIEW_DIR / "candidates" / f"{village}-candidate-{candidate_number}.png"
            assert candidate.is_file(), f"candidate missing: {candidate.name}"
            with Image.open(candidate) as image:
                assert image.mode == "RGBA" and image.size == (32, 32), f"invalid candidate: {candidate.name}"
    for filename in REVIEW_FILES:
        assert (REVIEW_DIR / filename).is_file(), f"review output missing: {filename}"

    registry = (ROOT / "components/AssetRegistry.js").read_text(encoding="utf-8")
    match = re.search(r"export const VILLAGE_CURRENCY_ICONS = \{(?P<body>.*?)\n\}", registry, flags=re.S)
    assert match, "VILLAGE_CURRENCY_ICONS registry block is missing"
    body = match.group("body")
    for village in VILLAGES:
        key = village.capitalize()
        expected_path = f"/assets/economy/village-currencies/{village}.png"
        assert re.search(rf"\b{key}:\s*\{{\s*src:\s*['\"]{re.escape(expected_path)}['\"],\s*size:\s*32\s*\}}", body), f"registry path/size mismatch for {key}"
        assert (ROOT / "public" / expected_path.lstrip("/")).is_file(), f"registry target missing for {key}"

        renderer = (ROOT / VILLAGE_RENDERERS[village]).read_text(encoding="utf-8")
        assert "drawVillageCurrencyIcon" in renderer, f"{village}: renderer does not use the approved icon helper"
        assert re.search(rf"drawVillageCurrencyIcon\([^\n]*['\"]{key}['\"]", renderer), f"{village}: renderer is not wired to its matching icon"

    assert digest(ROOT / "data/economy/catalog-v1.json") == CATALOG_HASH, "catalog items, prices, or village demand changed"
    assert_hashes(CHARACTER_RUNTIME_HASHES, "Character v2 runtime asset")
    print("village currency validation passed")
    print("- six unique 32x32 RGBA PNGs with binary transparency")
    print("- approved octagonal icons retain their shared footprint and five-role palettes")
    print("- runtime assets match the existing refined 32px icon builder")
    print("- runtime registry paths resolve to the six files")
    print("- all six village renderers reuse their matching approved icon")
    print("- generated A archive, economy catalog, and Character v2 runtime hashes unchanged")


if __name__ == "__main__":
    main()
