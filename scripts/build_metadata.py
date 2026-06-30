"""
build_metadata.py
public/audio/ 에 실제로 존재하는 파일 기준으로 sound_metadata.json을 (재)생성합니다.
pilot_clips.csv의 메타데이터를 사용하되, 파일이 없는 항목은 제외합니다.

사용법:
    python scripts/build_metadata.py \
        --csv scripts/pilot_clips.csv \
        --audio public/audio \
        --out data/sound_metadata.json
"""

import argparse
import json
import pandas as pd
from pathlib import Path

SOURCE_TYPE = {
    "Forest": "Biological",
    "Creek":  "Physical",
    "City":   "Anthropogenic",
    "Stage":  "Musical",
    "Lab":    "Electroacoustic",
}


def main(csv_path, audio_base, out_path):
    df = pd.read_csv(csv_path)
    audio_base = Path(audio_base)
    sounds = []

    for _, row in df.iterrows():
        zone  = row["game_zone"]
        fname = str(row["original_fname"])

        # 실제 파일 존재 확인 (.mp3 우선, .wav 폴백)
        mp3 = audio_base / zone / f"{fname}.mp3"
        wav = audio_base / zone / f"{fname}.wav"
        if mp3.exists():
            file_path = f"Audio/{zone}/{fname}"
        elif wav.exists():
            file_path = f"Audio/{zone}/{fname}"
        else:
            print(f"  MISSING: {zone}/{fname} — 건너뜀")
            continue

        sounds.append({
            "sound_id":       row["sound_id"],
            "game_zone":      zone,
            "source_type":    SOURCE_TYPE.get(zone, ""),
            "sub_category":   str(row.get("sub_category", "")),
            "audioset_class": str(row.get("audioset_class", "")),
            "file_path":      file_path,
            "source_dataset": "FSD50K",
            "original_fname": fname,
            "ambiguous":      bool(row.get("ambiguous", False)),
        })

    meta = {"sounds": sounds}
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\nsound_metadata.json 생성 완료")
    print(f"  총 {len(sounds)}개 클립")

    # Zone별 분포 출력
    by_zone = {}
    for s in sounds:
        z = s["game_zone"]
        by_zone[z] = by_zone.get(z, 0) + 1
    for z, cnt in sorted(by_zone.items()):
        print(f"  {z:8}: {cnt}개")
    print(f"  → {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",   default="scripts/pilot_clips.csv")
    parser.add_argument("--audio", default="public/audio")
    parser.add_argument("--out",   default="data/sound_metadata.json")
    args = parser.parse_args()
    main(args.csv, args.audio, args.out)
