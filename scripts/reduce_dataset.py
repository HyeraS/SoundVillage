"""
reduce_dataset.py
그룹 A/B 각 1000개(zone당 balance_groups.py 결과 기준)를 각 500개로 줄인다.

기준: scripts/loudness_cache.json (measure_loudness.py로 미리 생성)의
mean_volume_db가 가장 낮은(= 가장 안 들리는/작은) 소리부터 제거한다.
(zone, group) 스트림 단위로 정확히 절반씩 남겨서, 원래의 zone별 분포
비율을 그대로 유지한다 (합계 A 500 / B 500).

사전 준비:
    python scripts/measure_loudness.py   # loudness_cache.json 생성

실행 방법 (프로젝트 루트에서):
    python scripts/reduce_dataset.py           # 실제 적용 (백업 후 덮어씀)
    python scripts/reduce_dataset.py --dry-run # 미리보기만

적용 후 다음 단계:
    python scripts/assign_blocks.py --rebuild   # (zone, 그룹) 스트림이 줄었으므로 block 재배정 필요
"""

import argparse
import json
import shutil
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
META_PATH    = PROJECT_ROOT / "data" / "sound_metadata.json"
CACHE_PATH   = PROJECT_ROOT / "scripts" / "loudness_cache.json"

TARGET_TOTAL_PER_GROUP = 500


def apportion_half(counts: dict) -> dict:
    """zone별 원래 개수를 정확히 절반(합계 TARGET_TOTAL_PER_GROUP)으로 배분.
    largest-remainder(Hamilton) 방식 — floor(n/2)로 내림한 뒤,
    남는 잔여분을 소수부가 큰(=원래 개수가 홀수인) zone부터 +1씩 채운다."""
    exact = {z: c / 2 for z, c in counts.items()}
    base  = {z: int(v) for z, v in exact.items()}
    remainder = TARGET_TOTAL_PER_GROUP - sum(base.values())
    order = sorted(counts.keys(), key=lambda z: (-(exact[z] - base[z]), z))
    result = dict(base)
    for z in order[:remainder]:
        result[z] += 1
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="적용하지 않고 결과만 출력")
    args = parser.parse_args()

    if not CACHE_PATH.exists():
        raise SystemExit(
            f"{CACHE_PATH}가 없습니다. 먼저 `python scripts/measure_loudness.py`를 실행하세요."
        )

    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)
    sounds = meta["sounds"]

    loudness = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    missing = [s["sound_id"] for s in sounds if s["sound_id"] not in loudness]
    if missing:
        raise SystemExit(
            f"loudness_cache.json에 {len(missing)}개 소리의 음량 정보가 없습니다 "
            f"(예: {missing[:5]}). measure_loudness.py를 다시 실행하세요."
        )

    # (zone, group) 버킷 구성
    buckets = defaultdict(list)
    for s in sounds:
        g = s.get("group")
        if g not in ("A", "B"):
            raise SystemExit(f"group이 A/B가 아닌 소리 발견: {s['sound_id']} (group={g!r})")
        buckets[(s["game_zone"], g)].append(s)

    zones = sorted({z for z, _ in buckets})
    keep_ids = set()
    drop_ids = set()

    for group in ("A", "B"):
        counts = {z: len(buckets[(z, group)]) for z in zones}
        keep_counts = apportion_half(counts)

        for z in zones:
            bucket = buckets[(z, group)]
            bucket_sorted = sorted(
                bucket, key=lambda s: loudness[s["sound_id"]]["mean_volume_db"], reverse=True
            )
            n_keep = keep_counts[z]
            for s in bucket_sorted[:n_keep]:
                keep_ids.add(s["sound_id"])
            for s in bucket_sorted[n_keep:]:
                drop_ids.add(s["sound_id"])

    final_sounds = [s for s in sounds if s["sound_id"] in keep_ids]

    # 요약 출력
    print(f"제거 대상: {len(drop_ids)}개 / 전체 {len(sounds)}개\n")
    before_zg = Counter((s["game_zone"], s.get("group")) for s in sounds)
    after_zg  = Counter((s["game_zone"], s.get("group")) for s in final_sounds)
    total_a = total_b = 0
    for z in zones:
        a0, b0 = before_zg[(z, "A")], before_zg[(z, "B")]
        a1, b1 = after_zg[(z, "A")], after_zg[(z, "B")]
        total_a += a1
        total_b += b1
        print(f"  {z:<8} A: {a0:>3} → {a1:<3}   B: {b0:>3} → {b1:<3}")
    print(f"  {'합계':<8} A: {sum(before_zg[(z,'A')] for z in zones):>3} → {total_a:<3}   "
          f"B: {sum(before_zg[(z,'B')] for z in zones):>3} → {total_b:<3}")

    avg_before = sum(loudness[s["sound_id"]]["mean_volume_db"] for s in sounds) / len(sounds)
    avg_after  = sum(loudness[s["sound_id"]]["mean_volume_db"] for s in final_sounds) / len(final_sounds)
    print(f"\n평균 mean_volume_db: {avg_before:.1f} dB → {avg_after:.1f} dB (제거 후 더 큰/잘 들리는 쪽으로 개선)")

    if args.dry_run:
        print("\n[dry-run] 파일에 저장하지 않음")
        return

    backup_path = META_PATH.with_name(
        f"sound_metadata.pre_reduce_{datetime.now():%Y%m%d_%H%M%S}.json"
    )
    shutil.copy(META_PATH, backup_path)
    print(f"\n백업 저장: {backup_path}")

    meta["sounds"] = final_sounds
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"{META_PATH} 저장 완료")
    print("\n다음 단계: python scripts/assign_blocks.py --rebuild")


if __name__ == "__main__":
    main()
