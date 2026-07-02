"""
assign_blocks.py
zone별 소리를 N개씩 묶어 "block" 번호를 부여.
게임 내 구역 잠금 해제(퀘스트) 기능이 이 값을 기준으로 동작함.

그룹 A/B는 서로 다른(배타적인) 소리 세트를 전사하므로, block은
zone 단위가 아니라 (zone, 그룹) 단위로 각각 1번부터 매겨야 한다.
그룹이 지정되지 않은(공용) 소리는 A/B 두 그룹 모두에서 보이므로,
두 그룹 스트림에서 계산된 block 중 더 이른(작은) 값을 사용해
어느 그룹에서도 빈 block이 생기지 않도록 한다.

기본(증분) 모드:
    이미 "block"이 있는 소리는 절대 건드리지 않음.
    "block"이 없는 소리(= boost_all_zones.py로 새로 추가된 소리)만
    해당 (zone, 그룹) 스트림의 기존 최대 block + 1 번부터 새로 채움.
    → 이미 참여자가 완료한 블록에 새 소리가 끼어드는 일이 없음
      (마지막 블록이 40개를 못 채웠어도 그대로 두고, 새 블록을 새로 만듦).

실행 방법 (프로젝트 루트에서):
    python scripts/assign_blocks.py
    python scripts/assign_blocks.py --block_size 30
    python scripts/assign_blocks.py --zones Animal Human --block_size 25

    # 그룹별 block이 꼬였을 때(예: 그룹 B가 zone 전체를 A 다음 번호로
    # 이어받아 낮은 block에 아무 것도 없는 경우) 전체 재배정:
    python scripts/assign_blocks.py --rebuild
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
META_PATH    = PROJECT_ROOT / "data" / "sound_metadata.json"
ALL_ZONES    = ['Animal', 'Nature', 'Urban', 'Music', 'Lab', 'Human']
GROUP_LABELS = ('A', 'B')


def labels_for(sound: dict) -> list[str]:
    """소리가 속한 그룹 스트림 목록. 그룹 미지정이면 A/B 둘 다."""
    g = sound.get("group")
    if g in GROUP_LABELS:
        return [g]
    return list(GROUP_LABELS)


def assign_blocks_incremental(sounds: list[dict], zones: list[str], block_size: int) -> None:
    """이미 block이 있는 소리는 유지, 없는 소리만 (zone, 그룹) 스트림 기준으로 새 block부터 채움."""
    next_block = defaultdict(int)   # (zone, label) -> 다음에 쓸 block 번호
    fill_count = defaultdict(int)   # (zone, label) -> 현재 next_block에 이미 채운 개수

    for s in sounds:
        zone = s["game_zone"]
        if zone not in zones or s.get("block") is None:
            continue
        for label in labels_for(s):
            key = (zone, label)
            next_block[key] = max(next_block[key], s["block"])

    for zone in zones:
        for label in GROUP_LABELS:
            key = (zone, label)
            next_block[key] = next_block[key] + 1 if next_block[key] else 1

    for s in sounds:
        zone = s["game_zone"]
        if zone not in zones or s.get("block") is not None:
            continue
        labels = labels_for(s)
        assigned = min(next_block[(zone, label)] for label in labels)
        s["block"] = assigned
        for label in labels:
            key = (zone, label)
            fill_count[key] += 1
            if fill_count[key] >= block_size:
                fill_count[key] = 0
                next_block[key] += 1


def assign_blocks_rebuild(sounds: list[dict], zones: list[str], block_size: int) -> None:
    """전체를 (zone, 그룹) 스트림별로 순서대로 다시 잘라 block을 매김 (기존 값 무시)."""
    by_zone = defaultdict(list)
    for s in sounds:
        zone = s["game_zone"]
        if zone in zones:
            by_zone[zone].append(s)

    for zone, zone_sounds in by_zone.items():
        # 그룹별 스트림 구성 (원본 순서 유지, 공용 소리는 양쪽 다 포함)
        streams = {label: [] for label in GROUP_LABELS}
        for s in zone_sounds:
            for label in labels_for(s):
                streams[label].append(s)

        block_by_stream = {label: {} for label in GROUP_LABELS}
        for label, stream in streams.items():
            for i, s in enumerate(stream):
                block_by_stream[label][id(s)] = i // block_size + 1

        for s in zone_sounds:
            candidates = [
                block_by_stream[label][id(s)]
                for label in GROUP_LABELS
                if id(s) in block_by_stream[label]
            ]
            s["block"] = min(candidates)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zones", nargs="+", default=ALL_ZONES, choices=ALL_ZONES)
    parser.add_argument("--block_size", type=int, default=25)
    parser.add_argument("--rebuild", action="store_true",
                         help="기존 block 값을 무시하고 (zone, 그룹) 단위로 처음부터 재배정 (주의: 진행 중인 참여자 영향)")
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
    by_zone_block_group = defaultdict(lambda: defaultdict(Counter))
    for s in meta["sounds"]:
        g = s.get("group") or "(공용)"
        by_zone_block_group[s["game_zone"]][g][s["block"]] += 1
    for zone in sorted(by_zone_block_group):
        for g in sorted(by_zone_block_group[zone]):
            print(f"  {zone:<8} group={g:<6} {dict(sorted(by_zone_block_group[zone][g].items()))}")


if __name__ == "__main__":
    main()
