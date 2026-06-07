"""
download_clips.py
pilot_clips.csv에서 Freesound ID를 읽어 오디오 파일을 다운로드합니다.

Freesound API 키 발급:
    https://freesound.org/apiv2/apply/ → 무료 계정으로 즉시 발급

사용법:
    pip install freesound requests
    python scripts/download_clips.py \
        --csv scripts/pilot_clips.csv \
        --out public/audio \
        --key YOUR_FREESOUND_API_KEY

다운로드 전략:
    1순위: Freesound API HQ preview (MP3, ~30s, 빠름, 무료)
    2순위: Freesound API original (WAV, 원본 품질, 느림, 계정 필요)
"""

import argparse
import time
import requests
import pandas as pd
from pathlib import Path

FREESOUND_BASE = "https://freesound.org/apiv2"


def get_sound_info(fname, api_key):
    url = f"{FREESOUND_BASE}/sounds/{fname}/"
    r = requests.get(url, params={"token": api_key}, timeout=10)
    r.raise_for_status()
    return r.json()


def download_preview(fname, api_key, out_dir: Path, use_hq=True):
    """HQ preview (MP3) 다운로드 — 가장 빠른 방법"""
    info = get_sound_info(fname, api_key)
    previews = info.get("previews", {})
    url = previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3")
    if not url:
        raise ValueError(f"No preview for {fname}")

    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{fname}.mp3"

    if out_file.exists():
        print(f"  SKIP (exists): {out_file}")
        return str(out_file)

    r = requests.get(url, params={"token": api_key}, timeout=30)
    r.raise_for_status()
    out_file.write_bytes(r.content)
    return str(out_file)


def download_original(fname, api_key, out_dir: Path):
    """원본 파일 다운로드 (WAV, 더 느리지만 고품질)"""
    info = get_sound_info(fname, api_key)
    dl_url = info.get("download")
    if not dl_url:
        raise ValueError(f"No download URL for {fname}")

    ext = info.get("type", "wav")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{fname}.{ext}"

    if out_file.exists():
        print(f"  SKIP (exists): {out_file}")
        return str(out_file)

    # original 다운로드는 OAuth 또는 별도 인증 필요할 수 있음
    r = requests.get(dl_url, params={"token": api_key},
                     allow_redirects=True, timeout=60)
    r.raise_for_status()
    out_file.write_bytes(r.content)
    return str(out_file)


def main(csv_path, out_base, api_key, mode="preview", delay=0.5):
    df = pd.read_csv(csv_path)
    out_base = Path(out_base)

    total = len(df)
    ok, fail = 0, 0
    errors = []

    for i, row in df.iterrows():
        zone  = row["game_zone"]
        fname = str(row["original_fname"])
        zone_dir = out_base / zone

        print(f"[{i+1:3}/{total}] {zone}/{fname}", end=" ... ")
        try:
            if mode == "preview":
                path = download_preview(fname, api_key, zone_dir)
            else:
                path = download_original(fname, api_key, zone_dir)
            print(f"OK → {path}")
            ok += 1
        except Exception as e:
            print(f"FAIL: {e}")
            errors.append({"fname": fname, "zone": zone, "error": str(e)})
            fail += 1

        time.sleep(delay)  # API rate limit 방지

    print(f"\n완료: {ok}개 성공 / {fail}개 실패")
    if errors:
        err_df = pd.DataFrame(errors)
        err_path = Path(csv_path).parent / "download_errors.csv"
        err_df.to_csv(err_path, index=False)
        print(f"실패 목록 → {err_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",  required=True, help="pilot_clips.csv 경로")
    parser.add_argument("--out",  default="public/audio", help="출력 루트 (public/audio)")
    parser.add_argument("--key",  required=True, help="Freesound API 키")
    parser.add_argument("--mode", choices=["preview", "original"], default="preview",
                        help="preview=MP3 HQ 미리듣기 / original=원본 WAV")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="요청 간격(초) — rate limit 방지")
    args = parser.parse_args()
    main(args.csv, args.out, args.key, args.mode, args.delay)
