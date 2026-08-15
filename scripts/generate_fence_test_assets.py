"""fence-test 페이지 전용 — 원본 시트에서 울타리 후보 조각을 개별 PNG로
완전히 분리해낸다(시트 참조를 끊음). app/fence-test/page.js가 이 파일들을
직접 <img src>로 불러와서, 회전이 필요한 조각(세로 구간)은 이 "분리된
이미지" 자체에 CSS rotate를 적용한다 — 시트를 크롭한 SVG viewBox를 통째로
회전시키면 옆 타일 내용까지 딸려 들어오는 문제가 있었기 때문.
"""
from PIL import Image

SRC = "assets/farm/tiles/tiles.png"
OUT = "public/assets/world/fence_test"

TILES = {
    "straight_isolated.png": (0, 480, 32, 32),
    "gate_isolated.png":     (0, 448, 32, 32),
    "corner_isolated.png":   (64, 480, 32, 32),
    # (32,480,32,32)는 알고 보니 반쪽짜리 기둥 2개가 한 칸에 같이 들어있어서
    # (post_alone_check.png으로 확인) 왼쪽 절반(16px)만 잘라 진짜 기둥 1개로 씀.
    "post_isolated.png":     (32, 480, 16, 32),
}

if __name__ == "__main__":
    im = Image.open(SRC).convert("RGBA")
    for name, (x, y, w, h) in TILES.items():
        im.crop((x, y, x + w, y + h)).save(f"{OUT}/{name}")
        print("saved", name)
