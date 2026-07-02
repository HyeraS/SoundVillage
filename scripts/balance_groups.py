"""
balance_groups.py
Human/Lab zone에 남아있는 "그룹 미지정(공용)" 소리를 A/B 중 하나로 확정 배정하고,
전체 데이터셋을 그룹 A 1000개 / 그룹 B 1000개(zone당 최대한 균형)로 맞춘다.

배경:
    Animal/Nature/Urban/Music은 이미 zone별로 깔끔하게 A/B 50/50으로 나뉘어 있음.
    Human/Lab만 나중에 pilot_clips_*_new.csv로 보강되면서 group이 지정되지 않은
    소리가 섞여 있고(Human 151개, Lab 90개), 그래서 그룹 A/B 참여자가 실제로 보는
    소리 개수가 zone마다 들쭉날쭉하고(그룹 필터가 "공용"을 양쪽에 다 보여줌) 총량도
    2082개로 목표(2000개)를 초과함.

동작:
    Human/Lab의 기존 A/B 태그된 소리는 그대로 두고, "공용" 소리 중 필요한 만큼만
    시드 고정 랜덤으로 골라 A/B에 배정하고 나머지는 데이터셋에서 제거한다.
    (sub_category별로 CSV 원본 순서가 뭉쳐있어서 그냥 순서대로 자르면 특정
    카테고리가 통째로 날아갈 수 있어 셔플 후 자름.)

    최종 목표:
      Animal 330(변경 없음) / Nature 329(변경 없음) / Urban 332(변경 없음) /
      Music 333(변경 없음) / Human 338(169 A/169 B) / Lab 338(168 A/170 B)
      → 합계 2000개, 그룹 A 1000개 / 그룹 B 1000개

    참여자 진행 기록이 있는 상태에서 이 스크립트를 돌리면 group이 바뀌거나 삭제되는
    소리에 이미 제출된 응답이 고아가 될 수 있음 — 반드시 실행 후
    `python scripts/assign_blocks.py --rebuild --zones Human Lab`로 block을
    다시 매겨야 함.

실행 방법 (프로젝트 루트에서):
    python scripts/balance_groups.py           # 실제 적용
    python scripts/balance_groups.py --dry-run # 미리보기만
"""

import argparse
import json
import random
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
META_PATH    = PROJECT_ROOT / "data" / "sound_metadata.json"
SEED         = 20260702

# zone: {목표 그룹A 개수, 목표 그룹B 개수}
TARGETS = {
    "Human": {"A": 169, "B": 169},
    "Lab":   {"A": 168, "B": 170},
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="적용하지 않고 결과만 출력")
    args = parser.parse_args()

    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)
    sounds = meta["sounds"]

    rng = random.Random(SEED)
    dropped_ids = set()

    for zone, target in TARGETS.items():
        none_pool = [s for s in sounds if s["game_zone"] == zone and not s.get("group")]
        existing_a = sum(1 for s in sounds if s["game_zone"] == zone and s.get("group") == "A")
        existing_b = sum(1 for s in sounds if s["game_zone"] == zone and s.get("group") == "B")
        need_a = target["A"] - existing_a
        need_b = target["B"] - existing_b

        if need_a < 0 or need_b < 0:
            raise SystemExit(
                f"{zone}: 기존 A/B 태그된 소리({existing_a}/{existing_b})가 이미 목표"
                f"({target['A']}/{target['B']})를 넘어섬 — TARGETS를 다시 계산할 것"
            )
        if need_a + need_b > len(none_pool):
            raise SystemExit(
                f"{zone}: 공용 소리({len(none_pool)}개)가 필요한 만큼({need_a + need_b}개) 없음"
            )

        shuffled = none_pool[:]
        rng.shuffle(shuffled)
        to_a    = {s["sound_id"] for s in shuffled[:need_a]}
        to_b    = {s["sound_id"] for s in shuffled[need_a:need_a + need_b]}
        to_drop = {s["sound_id"] for s in shuffled[need_a + need_b:]}

        for s in sounds:
            if s["sound_id"] in to_a:
                s["group"] = "A"
            elif s["sound_id"] in to_b:
                s["group"] = "B"
        dropped_ids |= to_drop

        print(f"{zone}: 공용 {len(none_pool)}개 중 A+{need_a} / B+{need_b} 배정, {len(to_drop)}개 제거")

    final_sounds = [s for s in sounds if s["sound_id"] not in dropped_ids]

    print(f"\n제거된 소리: {len(dropped_ids)}개")
    print(f"전체: {len(sounds)} → {len(final_sounds)}")

    zone_group_count = Counter((s["game_zone"], s["group"]) for s in final_sounds)
    zones = sorted({z for z, _ in zone_group_count})
    total_a = total_b = 0
    for z in zones:
        a, b = zone_group_count[(z, "A")], zone_group_count[(z, "B")]
        total_a += a
        total_b += b
        print(f"  {z:<8} A:{a:<4} B:{b:<4} 합:{a + b}")
    print(f"  {'합계':<8} A:{total_a:<4} B:{total_b:<4} 합:{total_a + total_b}")

    if args.dry_run:
        print("\n[dry-run] 파일에 저장하지 않음")
        return

    meta["sounds"] = final_sounds
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"\n{META_PATH} 저장 완료")
    print("다음 단계: python scripts/assign_blocks.py --rebuild --zones Human Lab")


if __name__ == "__main__":
    main()
