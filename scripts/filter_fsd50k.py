"""
filter_fsd50k.py  (v3 — 6개 신 Zone명, Human 추가, Zone별 CSV 출력)

사용법:
    python scripts/filter_fsd50k.py \
        --csv fsd50k_pilot/FSD50K.ground_truth/dev.csv \
        --meta fsd50k_pilot/FSD50K.metadata/dev_clips_info_FSD50K.json \
        --out scripts/pilot_clips_v3.csv
"""

import argparse
import json
import random
import pandas as pd
from pathlib import Path

# ─────────────────────────────────────────────
# Zone별 허용 레이블 (FSD50K AudioSet 레이블 기준, 언더스코어→공백 변환 후)
# ─────────────────────────────────────────────
ZONE_INCLUDE = {
    "Animal": {
        # 새소리
        "Bird", "Bird vocalization bird call and bird song",
        "Bird song", "Bird vocalization", "Bird call",
        "Chirp and tweet", "Chirp", "Tweet",
        "Crow", "Owl", "Caw",
        # 곤충
        "Insect", "Cricket", "Mosquito", "Bee wasp etc",
        "Buzz",
        # 양서류
        "Frog",
        # 포유류
        "Cat", "Meow", "Purr", "Hiss",
        "Dog", "Bark", "Dog barking", "Growling",
        "Wild animal",
        "Gull and seagull",
    },
    "Nature": {
        # 물 소리
        "Water", "Waterfall", "Stream", "Babbling brook",
        "Rain", "Rain on surface", "Raindrop", "Drip",
        "Splash splatter", "Sprinkler",
        "Ocean", "Wave", "Waves and surf",
        # 날씨
        "Thunder", "Thunderstorm", "Lightning",
        "Wind", "Wind noise",
        # 불
        "Fire", "Crackle",
    },
    "Urban": {
        # 차량
        "Car", "Motor vehicle road", "Automobile", "Race car auto racing",
        "Bus", "Truck", "Motorcycle", "Bicycle",
        "Skidding", "Accelerating and revving and vroom",
        "Traffic noise roadway noise",
        # 경보/신호
        "Alarm", "Smoke detector smoke alarm",
        "Siren", "Civil defense siren", "Police car siren",
        "Car alarm", "Foghorn", "Horn",
        # 도시 생활
        "Printer", "Computer keyboard", "Typing",
        "Drill", "Power tool", "Jackhammer", "Sawing",
        "Engine", "Engine idling", "Lawn mower",
        "Construction",
        "Squeak", "Bicycle bell",
    },
    "Music": {
        # 현악기
        "Guitar", "Electric guitar", "Bass guitar",
        "Violin fiddle", "Cello", "Banjo", "Ukulele",
        "Bowed string instrument", "Plucked string instrument",
        # 건반
        "Piano", "Keyboard musical", "Organ", "Harpsichord",
        # 타악기
        "Drum", "Drum kit", "Snare drum", "Bass drum",
        "Cymbal", "Hi hat", "Gong", "Tambourine",
        "Percussion",
        "Crash cymbal",
        # 관악기
        "Flute", "Saxophone", "Trumpet", "Trombone", "Clarinet",
        "French horn", "Bagpipes", "Oboe",
        "Wind instrument and woodwind instrument", "Brass",
        # 기타 악기
        "Harp", "Accordion", "Harmonica",
        # 보컬/장르
        "Singing", "Choir", "Gospel music",
        "Keys",
    },
    "Lab": {
        # 전자/합성 음향
        "Synthesizer", "White noise", "Pink noise", "Static noise",
        "Distortion",
        # 기계음
        "Mechanical fan", "Whir", "Hum", "Rumble", "Humming",
        "Beep bleep", "Bleep",
        # 충격/추상음
        "Thump thud", "Clunk", "Knock",
        "Click", "Tick tock",
        # 기타 모호한 음향
        "Scratch", "Creak", "Squeak",
        "Whoosh swoosh swish",
        "Chime", "Bell", "Ding",
        "Glass", "Explosion",
        "Typewriter", "Typing",
        "Wind chime", "Cowbell",
    },
    "Human": {
        # 신체음
        "Cough", "Sneeze", "Snoring", "Wheeze", "Breathing", "Hiccup",
        "Burping and eructation", "Chewing and mastication",
        # 발성 (비언어)
        "Laughter", "Chuckle and chortle", "Crying and sobbing", "Crying",
        "Sigh",
        # 박수/신체 타악
        "Applause", "Clapping", "Finger snapping",
        # 사회적 소리
        "Cheering", "Crowd", "Hubbub speech noise and chatter",
        # 발소리/동작
        "Footstep", "Walk footsteps", "Run",
    },
}

# Zone별 명시적 제외 레이블
ZONE_EXCLUDE = {
    "Animal": {
        "Wind instrument", "Flute", "Saxophone", "Trumpet", "Clarinet",
        "Guitar", "Piano", "Drum", "Music", "Singing",
        "Car", "Motor vehicle road", "Engine", "Siren", "Alarm",
        "Synthesizer", "Electronic music",
        "Speech", "Male speech man speaking", "Female speech woman speaking",
        "Chewing and mastication", "Crowd",
        "Gunshot gunfire", "Fireworks",
        "Accelerating and revving and vroom",
    },
    "Nature": {
        "Wind instrument", "Flute", "Saxophone", "Trumpet", "Clarinet",
        "Guitar", "Piano", "Drum", "Music",
        "Car", "Motor vehicle road", "Engine",
        "Gunshot gunfire", "Fireworks",
        "Speech", "Laughter", "Crowd",
        "Synthesizer",
    },
    "Urban": {
        "Guitar", "Piano", "Violin fiddle", "Cello",
        "Drum", "Singing", "Music",
        "Synthesizer",
        "Bird", "Frog", "Insect", "Cricket",
        "Water", "Rain", "Thunder",
    },
    "Music": {
        "Car", "Motor vehicle road", "Engine", "Siren", "Alarm",
        "Water", "Rain", "Thunder", "Wind", "Bird", "Frog", "Insect",
        "Synthesizer",
        "Speech", "Male speech man speaking", "Female speech woman speaking",
        "Crowd",
        "Gunshot gunfire",
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
    },
    "Human": {
        "Music", "Singing", "Guitar", "Piano", "Drum",
        "Car", "Motor vehicle road", "Engine",
        "Bird", "Frog", "Insect", "Cricket",
        "Water", "Rain", "Thunder",
        "Synthesizer", "Electronic music",
        "Male speech man speaking", "Female speech woman speaking",
        "Speech", "Narration and monologue", "Reading",
        "Gunshot gunfire",
    },
}

TARGET_COUNT = {
    "Animal": 220,
    "Nature": 220,
    "Urban":  220,
    "Music":  220,
    "Lab":    220,
    "Human":  220,
}

MIN_DUR = 2.0
MAX_DUR = 30.0


def parse_labels(labels_str):
    raw = [l.strip().lstrip("_") for l in str(labels_str).split(",") if l.strip().lstrip("_")]
    return [r.replace("_", " ") for r in raw]


def label_matches(labels_list, include_set, exclude_set):
    if not labels_list:
        return False
    for label in labels_list:
        if label in exclude_set:
            return False
    if labels_list[0] in include_set:
        return True
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


SOURCE_TYPE = {
    "Animal": "Biological",
    "Nature": "Physical",
    "Urban":  "Anthropogenic",
    "Music":  "Musical",
    "Lab":    "Electroacoustic",
    "Human":  "Biological",
}


def main(csv_path, meta_path, out_path, seed=42):
    random.seed(seed)
    df = pd.read_csv(csv_path)
    df["fname"] = df["fname"].astype(str)
    dur_map = load_duration_map(meta_path)

    results = []
    used_fnames = set()
    out_dir = Path(out_path).parent

    for zone in ["Animal", "Nature", "Urban", "Music", "Lab", "Human"]:
        include_set = ZONE_INCLUDE[zone]
        exclude_set = ZONE_EXCLUDE[zone]
        target = TARGET_COUNT[zone]

        matched = []
        for _, row in df.iterrows():
            fname = str(row["fname"])
            if fname in used_fnames:
                continue
            labels = parse_labels(row["labels"])
            if not label_matches(labels, include_set, exclude_set):
                continue
            if dur_map:
                dur = dur_map.get(fname, MIN_DUR)
                if not (MIN_DUR <= dur <= MAX_DUR):
                    continue
            matched.append(row)

        pool = pd.DataFrame(matched)
        sampled = pool.sample(min(target, len(pool)), random_state=seed)

        zone_rows = []
        for _, row in sampled.iterrows():
            labels = parse_labels(row["labels"])
            fname  = str(row["fname"])
            dur    = dur_map.get(fname)
            entry = {
                "sound_id":       f"{zone}_{fname}",
                "game_zone":      zone,
                "source_type":    SOURCE_TYPE[zone],
                "sub_category":   labels[0] if labels else "",
                "audioset_class": labels[0] if labels else "",
                "all_labels":     ", ".join(labels),
                "fname":          fname,
                "file_path":      f"Audio/{zone}/{fname}",
                "source_dataset": "FSD50K",
                "original_fname": fname,
                "duration_sec":   round(dur, 2) if dur else None,
                "ambiguous":      False,
            }
            results.append(entry)
            zone_rows.append(entry)
            used_fnames.add(fname)

        # Zone별 개별 CSV 출력 (boost_all_zones.py가 읽는 형식)
        zone_csv = out_dir / f"pilot_clips_{zone.lower()}.csv"
        pd.DataFrame(zone_rows)[["sound_id", "original_fname", "sub_category", "audioset_class"]].to_csv(
            zone_csv, index=False
        )

        found = len(sampled)
        print(f"[{zone:8}] 목표 {target}개 → 확보 {found}개  (풀 {len(pool)}개)  → {zone_csv.name}")

    # 전체 합산 CSV / JSON 출력
    out_df = pd.DataFrame(results)
    out_df.to_csv(out_path, index=False)
    print(f"\n총 {len(out_df)}개 클립 → {out_path}")

    meta_fields = ["sound_id", "game_zone", "source_type", "sub_category",
                   "audioset_class", "file_path", "source_dataset", "original_fname", "ambiguous"]
    preview = out_df[meta_fields].to_dict(orient="records")
    json_out = Path(out_path).with_suffix(".json")
    with open(json_out, "w", encoding="utf-8") as f:
        json.dump({"sounds": preview}, f, ensure_ascii=False, indent=2)
    print(f"sound_metadata 초안 → {json_out}")

    print("\n=== Zone별 1순위 레이블 분포 (상위 5개) ===")
    from collections import Counter
    for zone in ["Animal", "Nature", "Urban", "Music", "Lab", "Human"]:
        clips = [r for r in results if r["game_zone"] == zone]
        cats  = Counter(r["sub_category"] for r in clips)
        print(f"\n[{zone}]")
        for cat, cnt in cats.most_common(5):
            print(f"  {cnt}x  {cat}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",  required=True)
    parser.add_argument("--meta", default="")
    parser.add_argument("--out",  default="scripts/pilot_clips_v3.csv")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    main(args.csv, args.meta, args.out, args.seed)
