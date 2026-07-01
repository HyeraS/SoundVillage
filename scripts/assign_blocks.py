"""
assign_blocks.py
zone별 소리를 N개씩 묶어 "block" 번호를 부여.
게임 내 구역 잠금 해제(퀘스트) 기능이 이 값을 기준으로 동작함.
그룹 A/B는 같은 소리를 전사하므로 block은 그룹과 무관하게 zone 단위로만 매김.

기본(증분) 모드:
    이미 "block"이 있는 소리는 절대 건드리지 않음.
    "block"이 없는 소리(= boost_all_zones.py로 새로 추가된 소리)만
    해당 zone의 기존 최대 block + 1 번부터 새로 채움.
    → 이미 참여자가 완료한 블록에 새 소리가 끼어드는 일이 없음
      (마지막 블록이 40개를 못 채웠어도 그대로 두고, 새 블록을 새로 만듦).

실행 방법 (프로젝트 루트에서):
    python scripts/assign_blocks.py
    python scripts/assign_blocks.py --block_size 30
    python scripts/assign_blocks.py --zones Animal Human --block_size 25

    # 최초 1회, 참여자 진행 기록이 전혀 없는 상태에서만 사용:
    python scripts/assign_blocks.py --rebuild
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
META_PATH    = PROJECT_ROOT / "data" / "sound_metadata.json"
ALL_ZONES    = ['Animal', 'Nature', 'Urban', 'Music', 'Lab', 'Human']


def assign_blocks_incremental(sounds: list[dict], zones: list[str], block_size: int) -> None:
    """이미 block이 있는 소리는 유지, 없는 소리만 새 block부터 채움."""
    next_block  = defaultdict(int)   # zone -> 다음에 쓸 block 번호
    fill_count  = defaultdict(int)   # zone -> 현재 next_block에 이미 채운 개수

    for s in sounds:
        zone = s["game_zone"]
        if zone not in zones:
            continue
        if s.get("block") is not None:
            next_block[zone] = max(next_block[zone], s["block"])

    for zone in zones:
        if next_block[zone] == 0:
            next_block[zone] = 1  # 이 zone에 기존 block이 하나도 없으면 1부터
        else:
            next_block[zone] += 1  # 기존 마지막 block 다음 "새" block부터 시작

    for s in sounds:
        zone = s["game_zone"]
        if zone not in zones or s.get("block") is not None:
            continue
        s["block"] = next_block[zone]
        fill_count[zone] += 1
        if fill_count[zone] >= block_size:
            fill_count[zone] = 0
            next_block[zone] += 1


def assign_blocks_rebuild(sounds: list[dict], zones: list[str], block_size: int) -> None:
    """전체를 처음부터 순서대로 다시 잘라 block을 매김 (기존 값 무시)."""
    index_in_zone = defaultdict(int)
    for s in sounds:
        zone = s["game_zone"]
        if zone not in zones:
            continue
        s["block"] = index_in_zone[zone] // block_size + 1
        index_in_zone[zone] += 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zones", nargs="+", default=ALL_ZONES, choices=ALL_ZONES)
    parser.add_argument("--block_size", type=int, default=40)
    parser.add_argument("--rebuild", action="store_true",
                         help="기존 block 값을 무시하고 zone 전체를 처음부터 재배정 (주의: 진행 중인 참여자 영향)")
    args = parser.parse_args()

    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)

    if args.rebuild:
        assign_blocks_rebuild(meta["sounds"], args.zones, args.block_size)
    else:
        assign_blocks_incremental(meta["sounds"], args.zones, args.block_size)

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    from collections import Counter
    print(f"블록 재배정 완료 (block_size={args.block_size})")
    by_zone_block = defaultdict(Counter)
    for s in meta["sounds"]:
        by_zone_block[s["game_zone"]][s["block"]] += 1
    for zone in sorted(by_zone_block):
        print(f"  {zone:<8} {dict(sorted(by_zone_block[zone].items()))}")


if __name__ == "__main__":
    main()
