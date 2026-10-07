# 2C-B3.1 — 남부 두 건물 입구 가독성 수정

작성일: 2026-08-29  
상태: preview 수정·검수 완료, 사용자 재승인 대기  
production 반영: 없음

## 1. 수정 목적

B3 조건부 승인에서 Community Studio와 Sound Workshop의 북쪽 3×3 clearance와 화면을 향한 문 그래픽이 서로 다른 방향으로 읽히는 문제가 확인됐다. B3.1은 footprint와 roof silhouette를 고정한 채 문 그래픽·step/vestibule·foreground·clearance·guide·manifest를 실제 접근 방향으로 일치시킨다.

## 2. 확정한 입구

| 건물 | 입구 | door edge | 3×3 clearance | 중앙 동선 관계 |
|---|---|---|---|---|
| Community Studio | 동향 | x=12, y=28, 1×3 | x=13, y=28, 3×3 | 건물 오른쪽에서 중앙 loop 방향으로 접근 |
| Sound Workshop | 서향 | x=36, y=28, 1×3 | x=33, y=28, 3×3 | 건물 왼쪽에서 중앙 loop 방향으로 접근 |

Studio는 오른쪽 facade 끝에 stone door surround와 동쪽으로 빠지는 step을 배치했다. Workshop은 왼쪽 facade 끝에 같은 기능 문법의 surround와 서쪽 step을 배치했다. 두 문 모두 작은 gold handle만 사용하고 emissive나 marker 유사 ring은 추가하지 않았다.

## 3. 유지한 항목

- Community Studio 10×5 footprint와 split-slope roof
- Sound Workshop 8×6 footprint와 asymmetric shed/gable roof
- 두 건물 collision rect
- Record Archive·Listening Cafe와 두 남향 입구
- Stage S1, Gate G1, B1 ground/path
- 모든 prop asset과 placement
- 15개 marker 좌표와 marker clearance
- palette, emissive, draw order, production 비적용 원칙

## 4. Clearance 검증

재생성된 manifest는 `2C-B3.1-v1`이며 두 건물에 `entrance`, `doorEdge`, `clearance`를 함께 기록한다.

- prop–새 entrance 3×3 overlap: **0건**
- prop–marker 1-tile overlap: **0건**
- 새 entrance–marker 1-tile overlap: **0건**
- collision footprint 변경: **0 tiles**

[전체 entrance/방향 guide](previews/2c-b3-music/entrance-clearance-guide.png)

## 5. 캐릭터 접근 검수

72×88 mock character의 발 접점을 각 3×3 접근 영역 중앙에 두었다.

- Studio: 캐릭터가 건물 동쪽, 문보다 오른쪽에 서서 서쪽을 향해 진입하는 위치
- Workshop: 캐릭터가 건물 서쪽, 문보다 왼쪽에 서서 동쪽을 향해 진입하는 위치
- 두 경우 모두 문, step, 발 접점과 foreground 사이의 occlusion 없음

[Studio 동쪽 / Workshop 서쪽 접근 비교](previews/2c-b3-music/south-building-entrances-character-comparison.png)

## 6. Desktop·mobile·grayscale

- Desktop 전체에서 두 문과 접근 화살표가 중앙 동선을 향한다.
- Studio mobile portrait에서 오른쪽 edge door와 step이 분리된다.
- Workshop mobile landscape에서 왼쪽 edge door와 step이 분리된다.
- Grayscale에서도 door의 wood 면, stone surround, body edge가 서로 다른 명도로 남는다.

검수 자료:

- [전체 B3 overview](previews/2c-b3-music/overview-b1-b2-b3.png)
- [두 건물 silhouette](previews/2c-b3-music/building-silhouette-comparison.png)
- [Studio mobile portrait](previews/2c-b3-music/mobile-portrait-studio-east-entrance.png)
- [Workshop mobile landscape](previews/2c-b3-music/mobile-landscape-workshop-west-entrance.png)
- [Studio grayscale](previews/2c-b3-music/studio-east-entrance-grayscale.png)
- [Workshop grayscale](previews/2c-b3-music/workshop-west-entrance-grayscale.png)

## 7. 변경 파일과 승인 지점

갱신:

- `public/design-previews/music-buildings-props-b3/buildings/community-studio/`
- `public/design-previews/music-buildings-props-b3/buildings/sound-workshop/`
- `public/design-previews/music-buildings-props-b3/guides/entrances-guide.*`
- `public/design-previews/music-buildings-props-b3/manifest.json`
- `design/2d-map-redesign/tools/generate_music_buildings_props_b3.js`
- `design/2d-map-redesign/previews/2c-b3-music/`
- `design/2d-map-redesign/2C_B3_MUSIC_BUILDINGS_PROPS_IMPLEMENTATION.md`

Production Music map과 연구 로직은 변경하지 않았다. 다음 승인 대상은 **Studio 동향 입구와 Workshop 서향 입구의 시각·접근 일치**이며, 승인 전에는 다음 단계나 production 적용으로 이동하지 않는다.
