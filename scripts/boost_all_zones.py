"""
boost_all_zones.py
Animal / Nature / Urban / Music / Lab zone 클립 보강
Freesound 다운로드 → Supabase 업로드 → sound_metadata.json 갱신

사전 준비:
    pip install requests supabase

키 설정 (.env.local에 추가):
    FREESOUND_API_KEY=발급받은키
    SUPABASE_SERVICE_ROLE_KEY=발급받은서비스롤키

실행 방법 (프로젝트 루트에서):
    python scripts/boost_all_zones.py

옵션:
    --zones Animal Nature Urban Music Lab  (기본: 전체)
    --skip_download   public/audio/{Zone}/ 에 이미 파일 있으면 사용
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

# ── .env.local 자동 로드
def _load_env(env_file: Path):
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, val = line.partition('=')
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), val)

_load_env(Path(__file__).parent.parent / '.env.local')

FREESOUND_BASE  = "https://freesound.org/apiv2"
SUPABASE_URL    = "https://nzzesrjneqsbkgtbaoxy.supabase.co"
STORAGE_BUCKET  = "audio"
PROJECT_ROOT    = Path(__file__).parent.parent
META_PATH       = PROJECT_ROOT / "data" / "sound_metadata.json"

ALL_ZONES = ['Animal', 'Nature', 'Urban', 'Music', 'Lab']
CSV_MAP   = {z: PROJECT_ROOT / "scripts" / f"pilot_clips_{z.lower()}.csv" for z in ALL_ZONES}


# ────────────────────────────────────────────────────────
#  Freesound 다운로드
# ────────────────────────────────────────────────────────
def download_preview(fname: str, zone: str, api_key: str) -> Path | None:
    out_dir  = PROJECT_ROOT / "public" / "audio" / zone
    out_file = out_dir / f"{fname}.mp3"

    if out_file.exists():
        print(f"    SKIP (exists): {out_file.name}")
        return out_file

    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        info = requests.get(
            f"{FREESOUND_BASE}/sounds/{fname}/",
            params={"token": api_key}, timeout=10
        ).json()
        url = (info.get("previews") or {}).get("preview-hq-mp3") or \
              (info.get("previews") or {}).get("preview-lq-mp3")
        if not url:
            print(f"    WARN: no preview URL for {fname}")
            return None
        data = requests.get(url, params={"token": api_key}, timeout=30)
        data.raise_for_status()
        out_file.write_bytes(data.content)
        print(f"    DL  OK: {out_file.name}  ({len(data.content)//1024} KB)")
        return out_file
    except Exception as e:
        print(f"    DL  FAIL {fname}: {e}")
        return None


# ────────────────────────────────────────────────────────
#  Supabase Storage 업로드 (supabase-py 사용 — 신형 키 대응)
# ────────────────────────────────────────────────────────
def upload_to_supabase(local_file: Path, zone: str, supabase_key: str) -> bool:
    storage_path = f"{zone}/{local_file.name}"
    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, supabase_key)
        with open(local_file, "rb") as f:
            client.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=f.read(),
                file_options={"upsert": "true", "content-type": "audio/mpeg"},
            )
        print(f"    UP  OK: {storage_path}")
        return True
    except ImportError:
        print("    ERROR: supabase 패키지 없음 — `pip install supabase` 실행 후 재시도")
        return False
    except Exception as e:
        print(f"    UP  FAIL {storage_path}: {e}")
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
    print("  존별 현황:")
    for z, c in sorted(zone_count.items()):
        bar = "█" * (c // 2)
        print(f"    {z:<8} {c:>3}  {bar}")


# ────────────────────────────────────────────────────────
#  Zone 처리
# ────────────────────────────────────────────────────────
def process_zone(zone: str, args, freesound_key: str, supabase_key: str) -> list[dict]:
    csv_path = CSV_MAP[zone]
    if not csv_path.exists():
        print(f"  [SKIP] CSV 없음: {csv_path}")
        return []

    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    print(f"\n{'='*50}")
    print(f"  {zone} zone — {len(rows)}개 처리")
    print(f"{'='*50}")

    successful = []

    for i, row in enumerate(rows, 1):
        fname = row["original_fname"]
        print(f"  [{i:2}/{len(rows)}] {fname}  ({row['sub_category']})")

        local_file = PROJECT_ROOT / "public" / "audio" / zone / f"{fname}.mp3"

        # 1) 다운로드
        if not args.skip_download:
            result = download_preview(fname, zone, freesound_key)
            if result is None:
                continue
            local_file = result
            time.sleep(args.delay)
        else:
            if not local_file.exists():
                print(f"    SKIP (파일 없음): {local_file}")
                continue

        # 2) Supabase 업로드
        if not args.skip_upload:
            ok = upload_to_supabase(local_file, zone, supabase_key)
            if not ok:
                continue

        successful.append({
            "sound_id":       row["sound_id"],
            "game_zone":      zone,
            "source_type":    _source_type(zone),
            "sub_category":   row["sub_category"],
            "audioset_class": row["audioset_class"],
            "file_path":      f"Audio/{zone}/{fname}",
            "source_dataset": "FSD50K",
            "original_fname": fname,
            "ambiguous":      False,
        })

    print(f"  → {zone} 완료: {len(successful)}/{len(rows)}개 성공")
    return successful


def _source_type(zone: str) -> str:
    return {
        'Animal': 'Biological',
        'Nature': 'Natural',
        'Urban':  'Mechanical',
        'Music':  'Musical',
        'Lab':    'Synthetic',
    }.get(zone, 'Unknown')


# ────────────────────────────────────────────────────────
#  메인
# ────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zones",        nargs="+", default=ALL_ZONES, choices=ALL_ZONES)
    parser.add_argument("--skip_download",action="store_true")
    parser.add_argument("--skip_upload",  action="store_true")
    parser.add_argument("--delay",        type=float, default=0.4)
    args = parser.parse_args()

    freesound_key = os.environ.get("FREESOUND_API_KEY", "")
    supabase_key  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not args.skip_download and not freesound_key:
        print("ERROR: .env.local에 FREESOUND_API_KEY가 없습니다.")
        return
    if not args.skip_upload and not supabase_key:
        print("ERROR: .env.local에 SUPABASE_SERVICE_ROLE_KEY가 없습니다.")
        return

    all_new_sounds = []
    for zone in args.zones:
        new_sounds = process_zone(zone, args, freesound_key, supabase_key)
        all_new_sounds.extend(new_sounds)

    if all_new_sounds:
        update_metadata(all_new_sounds)
    else:
        print("\n추가된 클립 없음")


if __name__ == "__main__":
    main()
