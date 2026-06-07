"""
filter_fsd50k.py  (v2 — 정확 레이블 매칭 + 제외 로직)

변경 사항:
- 부분 문자열 매칭 → 정확한 레이블 집합 매칭
- 1순위 레이블 우선 (멀티레이블 클립의 주 소리 기준)
- Zone별 명시적 제외 목록 추가

사용법:
    python scripts/filter_fsd50k.py \
        --csv ~/fsd50k_pilot/FSD50K.ground_truth/dev.csv \
        --meta ~/fsd50k_pilot/FSD50K.metadata/dev_clips_info_FSD50K.json \
        --out scripts/pilot_clips.csv
"""

import argparse
import json
import random
import pandas as pd
from pathlib import Path

# ─────────────────────────────────────────────
# Zone별 허용 레이블 (정확 매칭 — FSD50K AudioSet 레이블 기준)
# ─────────────────────────────────────────────
ZONE_INCLUDE = {
    "Forest": {
        # 새소리
        "Bird", "Bird vocalization bird call and bird song",
        "Bird song", "Bird vocalization", "Bird call",
        "Chirp and tweet", "Chirp", "Tweet",
        "Crow", "Owl", "Caw",
        # 곤충
        "Insect", "Cricket", "Mosquito", "Bee wasp etc",
        # 양서류
        "Frog",
        # 포유류 (자연)
        "Cat", "Meow", "Purr", "Hiss",
        "Dog", "Bark", "Dog barking", "Growling",
        "Wild animal",
        # 농장 동물 (선택적 — 아래 ALLOW_FARM_IN_FOREST = True/False로 조절)
        # "Livestock and farm animals and working animals",
        # "Chicken rooster", "Rooster", "Hen",
    },
    "Creek": {
        # 물 소리
        "Water", "Waterfall", "Stream", "Babbling brook",
        "Rain", "Rain on surface", "Raindrop", "Drip",
        "Splash splatter", "Sprinkler",
        "Ocean", "Wave", "Waves and surf",
        # 날씨
        "Thunder", "Thunderstorm", "Lightning",
        "Wind", "Wind noise",
        # 자연음 (불 소리는 제거 — Creek zone과 어울리지 않음)
    },
    "City": {
        # 차량
        "Car", "Motor vehicle road", "Automobile", "Race car auto racing",
        "Bus", "Truck", "Motorcycle", "Bicycle",
        "Skidding", "Accelerating and revving and vroom",
        "Traffic noise roadway noise",
        # 경보/신호
        "Alarm", "Smoke detector smoke alarm",
        "Siren", "Civil defense siren", "Police car siren",
        "Car alarm", "Foghorn", "Horn",
        "Telephone", "Ringtone", "Dial tone",
        # 도시/실내 생활
        "Crowd", "Hubbub speech noise and chatter",
        "Walk footsteps", "Sliding door",
        "Printer", "Computer keyboard", "Typing",
        "Drill", "Power tool", "Jackhammer", "Sawing",
        "Engine", "Engine idling", "Lawn mower", "Air conditioning",
    },
    "Stage": {
        # 현악기
        "Guitar", "Electric guitar", "Bass guitar",
        "Violin fiddle", "Cello", "Banjo", "Ukulele",
        "Bowed string instrument", "Plucked string instrument",
        # 건반
        "Piano", "Keyboard musical", "Organ", "Harpsichord",
        # 타악기
        "Drum", "Drum kit", "Snare drum", "Bass drum", "Drum machine",
        "Cymbal", "Hi hat", "Gong", "Tambourine", "Maracas",
        "Percussion", "Clapping",
        # 관악기
        "Flute", "Saxophone", "Trumpet", "Trombone", "Clarinet",
        "French horn", "Bagpipes", "Oboe",
        # 기타 악기
        "Harp", "Accordion", "Harmonica",
        # 보컬
        "Singing", "Choir", "Gospel music", "A capella",
        # 장르
        "Music", "Electronic music",
    },
    "Lab": {
        # 전자/합성 음향 (FSD50K 실제 레이블 기준)
        "Synthesizer",
        "White noise", "Pink noise",
        "Static noise", "Radio static",
        "Distortion",
        # 기계음 / 추상음
        "Mechanical fan", "Whir", "Buzzing",
        "Hum", "Rumble", "Humming",
        "Beep bleep", "Bleep",
        # 충격/추상음
        "Thump thud", "Clunk", "Knock",
        "Click", "Tick tock",
        # 전자적 처리 / 환경음
        "Power electronics",
        "Vibration",
        # 기타 모호한 음향
        "Scratch", "Creak", "Squeak",
        "Whoosh swoosh swish",
        "Chime", "Bell", "Ding",
        "Sine wave", "Square wave", "Sawtooth wave",
    },
}

# Zone별 명시적 제외 레이블 (포함 목록에 있어도 이게 있으면 제외)
ZONE_EXCLUDE = {
    "Forest": {
        "Wind instrument", "Flute", "Saxophone", "Trumpet", "Clarinet",
        "Guitar", "Piano", "Drum", "Music", "Singing",
        "Car", "Motor vehicle road", "Engine", "Siren", "Alarm",
        "Synthesizer", "Electronic music",
        "Speech", "Male speech man speaking", "Female speech woman speaking",
        "Chewing and mastication", "Crowd", "Accelerating and revving and vroom",
        "Gunshot gunfire", "Fireworks",
    },
    "Creek": {
        # 절대 넣으면 안 되는 것
        "Wind instrument", "Flute", "Saxophone", "Trumpet", "Clarinet",
        "Guitar", "Piano", "Drum", "Music",
        "Car", "Motor vehicle road", "Engine",
        "Gunshot gunfire", "Fireworks",
        "Speech", "Laughter", "Crowd",
        "Synthesizer",
    },
    "City": {
        "Guitar", "Piano", "Violin fiddle", "Cello",
        "Drum", "Singing", "Music",
        "Synthesizer",
        "Bird", "Frog", "Insect", "Cricket",
        "Water", "Rain", "Thunder",
    },
    "Stage": {
        "Car", "Motor vehicle road", "Engine", "Siren", "Alarm",
        "Water", "Rain", "Thunder", "Wind", "Bird", "Frog", "Insect",
        "Synthesizer",
        "Speech", "Male speech man speaking", "Female speech woman speaking",
        "Crowd",
    },
    "Lab": {
        "Guitar", "Piano", "Violin fiddle", "Drum",
        "Bird", "Frog", "Insect", "Cricket",
        "Water", "Rain", "Thunder",
        "Car", "Motor vehicle road", "Engine",
        "Singing", "Music", "Electronic music",
        "Speech", "Male speech man speaking", "Female speech woman speaking",
        "Laughter", "Crowd",
        "Gunshot gunfire",
        "Traffic noise roadway noise",
        "Fire", "Crackle",
    },
}

TARGET_COUNT = {
    "Forest": 30,
    "Creek":  30,
    "City":   30,
    "Stage":  30,
    "Lab":    20,
}

MIN_DUR = 2.0
MAX_DUR = 30.0


def parse_labels(labels_str):
    """콤마 구분 레이블 → 정규화된 리스트 반환 (순서 유지)

    FSD50K CSV는 레이블을 언더스코어로 표기하므로 공백으로 변환해
    ZONE_INCLUDE/ZONE_EXCLUDE 집합과 형식을 맞춘다.
    예) "Wind_instrument,_woodwind_instrument" → ["Wind instrument", "woodwind instrument"]
    """
    raw = [l.strip().lstrip("_") for l in str(labels_str).split(",") if l.strip().lstrip("_")]
    return [r.replace("_", " ") for r in raw]  # 순서 유지 (0번이 1순위 레이블)


def label_matches(labels_list, include_set, exclude_set):
    """
    포함 조건: labels의 1순위 레이블이 include_set에 있거나
               2~3순위 중 하나가 include_set에 있으면서 exclude_set 레이블이 없을 때
    제외 조건: 어떤 레이블이라도 exclude_set에 있으면 제외
    """
    if not labels_list:
        return False

    # 1. 제외 조건 먼저 — 어떤 레이블이라도 exclude에 해당하면 스킵
    for label in labels_list:
        if label in exclude_set:
            return False

    # 2. 포함 조건 — 1순위 레이블이 include에 있어야 최우선 선택
    if labels_list[0] in include_set:
        return True

    # 3. 1순위 미매칭이면 2~3순위 중 include에 있는지 확인 (선택적 허용)
    for label in labels_list[1:3]:
        if label in include_set:
            return True

    return False


def load_duration_map(meta_path):
    if not meta_path or not Path(meta_path).exists():
        return {}
    with open(meta_path) as f:
        data = json.load(f)
    dur_map = {}
    for fname, info in data.items():
        dur = info.get("duration") or info.get("preview-hq-duration")
        if dur:
            dur_map[str(fname)] = float(dur)
    return dur_map


def infer_source_type(zone):
    return {
        "Forest": "Biological",
        "Creek":  "Physical",
        "City":   "Anthropogenic",
        "Stage":  "Musical",
        "Lab":    "Electroacoustic",
    }[zone]


def main(csv_path, meta_path, out_path, seed=42):
    random.seed(seed)
    df = pd.read_csv(csv_path)
    df["fname"] = df["fname"].astype(str)
    dur_map = load_duration_map(meta_path)

    results = []
    used_fnames = set()

    for zone in ["Forest", "Creek", "City", "Stage", "Lab"]:
        include_set = ZONE_INCLUDE[zone]
        exclude_set = ZONE_EXCLUDE[zone]
        target = TARGET_COUNT[zone]

        # 레이블 파싱 + 매칭
        matched = []
        for _, row in df.iterrows():
            fname = str(row["fname"])
            if fname in used_fnames:
                continue
            labels = parse_labels(row["labels"])
            if not label_matches(labels, include_set, exclude_set):
                continue
            # 길이 필터
            if dur_map:
                dur = dur_map.get(fname, MIN_DUR)
                if not (MIN_DUR <= dur <= MAX_DUR):
                    continue
            matched.append(row)

        pool = pd.DataFrame(matched)
        sampled = pool.sample(min(target, len(pool)), random_state=seed)

        for _, row in sampled.iterrows():
            labels = parse_labels(row["labels"])
            fname  = str(row["fname"])
            dur    = dur_map.get(fname)
            results.append({
                "sound_id":       f"{zone}_{fname.zfill(6)}",
                "game_zone":      zone,
                "source_type":    infer_source_type(zone),
                "sub_category":   labels[0] if labels else "",
                "audioset_class": labels[0] if labels else "",
                "all_labels":     ", ".join(labels),     # 검토용
                "fname":          fname,
                "file_path":      f"Audio/{zone}/{fname}",
                "source_dataset": "FSD50K",
                "original_fname": fname,
                "duration_sec":   round(dur, 2) if dur else None,
                "ambiguous":      False,
            })
            used_fnames.add(fname)

        found = len(sampled)
        print(f"[{zone:8}] 목표 {target:3}개 → 확보 {found:3}개  (풀 {len(pool)}개)")

    out_df = pd.DataFrame(results)
    out_df.to_csv(out_path, index=False)
    print(f"\n총 {len(out_df)}개 클립 → {out_path}")

    # sound_metadata.json 초안 (all_labels 제외)
    meta_fields = ["sound_id","game_zone","source_type","sub_category",
                   "audioset_class","file_path","source_dataset","original_fname","ambiguous"]
    preview = out_df[meta_fields].to_dict(orient="records")
    json_out = Path(out_path).with_suffix(".json")
    with open(json_out, "w", encoding="utf-8") as f:
        json.dump({"sounds": preview}, f, ensure_ascii=False, indent=2)
    print(f"sound_metadata 초안 → {json_out}")

    # Zone별 분포 요약
    print("\n=== Zone별 1순위 레이블 분포 (상위 5개) ===")
    from collections import Counter
    for zone in ["Forest","Creek","City","Stage","Lab"]:
        clips = [r for r in results if r["game_zone"] == zone]
        cats  = Counter(r["sub_category"] for r in clips)
        print(f"\n[{zone}]")
        for cat, cnt in cats.most_common(5):
            print(f"  {cnt}x  {cat}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",  required=True)
    parser.add_argument("--meta", default="")
    parser.add_argument("--out",  default="scripts/pilot_clips.csv")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    main(args.csv, args.meta, args.out, args.seed)
