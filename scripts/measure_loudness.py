"""
measure_loudness.py
data/sound_metadata.json의 모든 소리에 대해 ffmpeg volumedetect로
평균/최대 음량(dBFS)을 측정해 scripts/loudness_cache.json에 저장한다.

이 캐시는 reduce_dataset.py가 "너무 안 들리는(작은) 소리"를 골라
제거하는 데 사용한다. mean_volume이 0에 가까울수록 크고,
-inf에 가까울수록(더 음수일수록) 작고 안 들리는 소리다.

실행 방법 (프로젝트 루트에서):
    python scripts/measure_loudness.py
    python scripts/measure_loudness.py --workers 12
"""

import argparse
import concurrent.futures
import json
import re
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
META_PATH     = PROJECT_ROOT / "data" / "sound_metadata.json"
CACHE_PATH    = PROJECT_ROOT / "scripts" / "loudness_cache.json"
AUDIO_ROOT    = PROJECT_ROOT / "public" / "audio"

MEAN_RE = re.compile(r"mean_volume:\s*(-?[\d.]+|-inf)\s*dB")
MAX_RE  = re.compile(r"max_volume:\s*(-?[\d.]+|-inf)\s*dB")


def local_path_for(sound: dict) -> Path:
    rel = sound["file_path"].replace("Audio/", "", 1)
    return AUDIO_ROOT / (rel + ".mp3")


def measure_one(sound: dict):
    path = local_path_for(sound)
    if not path.exists():
        return sound["sound_id"], None

    try:
        proc = subprocess.run(
            ["ffmpeg", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
            capture_output=True, text=True, timeout=30,
        )
        out = proc.stderr
        mean_m = MEAN_RE.search(out)
        max_m  = MAX_RE.search(out)
        mean_db = float(mean_m.group(1)) if mean_m and mean_m.group(1) != "-inf" else -120.0
        max_db  = float(max_m.group(1))  if max_m  and max_m.group(1)  != "-inf" else -120.0
        return sound["sound_id"], {"mean_volume_db": mean_db, "max_volume_db": max_db}
    except Exception as e:
        print(f"  WARN {sound['sound_id']}: {e}")
        return sound["sound_id"], None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)
    sounds = meta["sounds"]

    cache = {}
    if CACHE_PATH.exists():
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))

    todo = [s for s in sounds if s["sound_id"] not in cache]
    print(f"측정할 소리: {len(todo)}개 (캐시에 이미 있음: {len(sounds) - len(todo)}개)")

    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for sound_id, result in pool.map(measure_one, todo):
            if result is not None:
                cache[sound_id] = result
            done += 1
            if done % 100 == 0:
                print(f"  {done}/{len(todo)}")

    failed = [s["sound_id"] for s in sounds if s["sound_id"] not in cache]
    if failed:
        print(f"\n측정 실패: {len(failed)}개")
        for sid in failed[:20]:
            print(f"  {sid}")

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{CACHE_PATH} 저장 완료 (총 {len(cache)}개)")


if __name__ == "__main__":
    main()
