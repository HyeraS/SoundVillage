"""
boost_human_zone.py
Human zone 클립 다운로드 → Supabase 업로드 → sound_metadata.json 업데이트

사전 준비:
    pip install requests

키 설정 (.env.local에 추가):
    FREESOUND_API_KEY=발급받은키
    SUPABASE_SERVICE_ROLE_KEY=발급받은서비스롤키

실행 방법 (프로젝트 루트에서):
    cd soundmimic-village
    python scripts/boost_human_zone.py

옵션:
    --skip_download   public/audio/Human/ 에 이미 파일 있으면 사용
    --skip_upload     Supabase 업로드 건너뜀 (로컬 테스트용)
    --delay 0.4       Freesound API 요청 간격(초)
"""

import argparse
import csv
import json
import os
import time
import requests
from pathlib import Path

# .env.local 자동 로드 (python-dotenv 없이도 동작)
def _load_env(env_file: Path):
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, val = line.partition('=')
        os.environ.setdefault(key.strip(), val.strip())

_load_env(Path(__file__).parent.parent / '.env.local')

FREESOUND_BASE  = "https://freesound.org/apiv2"
SUPABASE_URL    = "https://nzzesrjneqsbkgtbaoxy.supabase.co"
STORAGE_BUCKET  = "audio"
AUDIO_LOCAL_DIR = Path(__file__).parent.parent / "public" / "audio" / "Human"
META_PATH       = Path(__file__).parent.parent / "data" / "sound_metadata.json"


# ────────────────────────────────────────────────────────
#  Freesound 다운로드
# ────────────────────────────────────────────────────────
def download_preview(fname: str, api_key: str) -> Path | None:
    out_file = AUDIO_LOCAL_DIR / f"{fname}.mp3"
    if out_file.exists():
        print(f"  SKIP (exists): {out_file.name}")
        return out_file

    AUDIO_LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    try:
        info = requests.get(
            f"{FREESOUND_BASE}/sounds/{fname}/",
            params={"token": api_key}, timeout=10
        ).json()
        url = (info.get("previews") or {}).get("preview-hq-mp3") or \
              (info.get("previews") or {}).get("preview-lq-mp3")
        if not url:
            print(f"  WARN: no preview URL for {fname}")
            return None
        data = requests.get(url, params={"token": api_key}, timeout=30)
        data.raise_for_status()
        out_file.write_bytes(data.content)
        print(f"  DL  OK: {out_file.name}  ({len(data.content)//1024} KB)")
        return out_file
    except Exception as e:
        print(f"  DL  FAIL {fname}: {e}")
        return None


# ────────────────────────────────────────────────────────
#  Supabase Storage 업로드
# ────────────────────────────────────────────────────────
def upload_to_supabase(local_file: Path, supabase_key: str) -> bool:
    storage_path = f"Human/{local_file.name}"   # Human/123456.mp3
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type":  "audio/mpeg",
        "x-upsert":      "true",   # 이미 있으면 덮어쓰기
    }
    try:
        r = requests.post(url, headers=headers, data=local_file.read_bytes(), timeout=60)
        if r.status_code in (200, 201):
            print(f"  UP  OK: {storage_path}")
            return True
        else:
            print(f"  UP  FAIL {storage_path}: {r.status_code} {r.text[:120]}")
            return False
    except Exception as e:
        print(f"  UP  FAIL {storage_path}: {e}")
        return False


# ────────────────────────────────────────────────────────
#  sound_metadata.json 업데이트
# ────────────────────────────────────────────────────────
def update_metadata(new_sounds: list[dict]) -> None:
    with open(META_PATH) as f:
        meta = json.load(f)

    existing_ids = {s["sound_id"] for s in meta["sounds"]}
    added = 0
    for s in new_sounds:
        if s["sound_id"] not in existing_ids:
            meta["sounds"].append(s)
            added += 1

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    from collections import Counter
    zone_count = Counter(s["game_zone"] for s in meta["sounds"])
    print(f"\n메타데이터 업데이트 완료 (+{added}개 추가)")
    for z, c in sorted(zone_count.items()):
        print(f"  {z}: {c}")


# ────────────────────────────────────────────────────────
#  메인
# ────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",           default="scripts/pilot_clips_human.csv")
    parser.add_argument("--skip_download", action="store_true")
    parser.add_argument("--skip_upload",   action="store_true")
    parser.add_argument("--delay",         type=float, default=0.4)
    args = parser.parse_args()

    # 키는 .env.local에서 자동 로드
    freesound_key = os.environ.get("FREESOUND_API_KEY", "")
    supabase_key  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not args.skip_download and not freesound_key:
        print("ERROR: .env.local에 FREESOUND_API_KEY가 없습니다.")
        return
    if not args.skip_upload and not supabase_key:
        print("ERROR: .env.local에 SUPABASE_SERVICE_ROLE_KEY가 없습니다.")
        return

    csv_path = Path(__file__).parent.parent / args.csv

    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    print(f"처리할 Human 클립: {len(rows)}개\n")

    successful = []

    for i, row in enumerate(rows, 1):
        fname = row["original_fname"]
        print(f"[{i:2}/{len(rows)}] {fname}  ({row['sub_category']})")

        local_file = AUDIO_LOCAL_DIR / f"{fname}.mp3"

        # 1) 다운로드
        if not args.skip_download:
            if not freesound_key:
                print("  ERROR: FREESOUND_API_KEY 없음")
                return
            result = download_preview(fname, freesound_key)
            if result is None:
                continue
            local_file = result
            time.sleep(args.delay)
        else:
            if not local_file.exists():
                print(f"  SKIP (파일 없음): {local_file}")
                continue

        # 2) Supabase 업로드
        if not args.skip_upload:
            if not supabase_key:
                print("  ERROR: SUPABASE_SERVICE_ROLE_KEY 없음")
                return
            ok = upload_to_supabase(local_file, supabase_key)
            if not ok:
                continue

        successful.append({
            "sound_id":       row["sound_id"],
            "game_zone":      "Human",
            "source_type":    "Biological",
            "sub_category":   row["sub_category"],
            "audioset_class": row["audioset_class"],
            "file_path":      f"Audio/Human/{fname}",
            "source_dataset": "FSD50K",
            "original_fname": fname,
            "ambiguous":      False,
        })

    # 3) 메타데이터 업데이트
    if successful:
        update_metadata(successful)
    else:
        print("\n추가된 클립 없음")


if __name__ == "__main__":
    main()
