# 2C-R1 Music Visual Polish Comparison

이 폴더는 Music production `2C-C`를 변경하지 않고 만든 **preview-only** 비교 패키지다.

- `productionApplied`: `false`
- `referenceCheckpoint`: `2C-C`
- `nextMusicStageStarted`: `false`
- `intendedUse`: 향후 polish reference와 backlog

## 핵심 결과물

- `r1-a-full-map.png`, `r1-b-full-map.png`: 동일한 48×36 macro geometry로 정규화한 전체 지도
- `r1-a-r1-b-full-map-comparison.png`: R1-A/R1-B 전체 지도 비교
- `legacy-current-r1a-r1b-equal-viewport.png`: 같은 크기의 player-centered gameplay viewport 비교
- `current-r1a-r1b-material-density.png`: 현재 2C-C와 두 R1 방향의 재료 밀도 비교
- `r1-*-desktop-gameplay.png`: Garden 중심 desktop gameplay 조건
- `r1-*-world-gate-start.png`: Gate start 조건
- `r1-*-garden-stage-approach.png`: Garden/Stage 접근 조건
- `r1-*-character-marker-composite.png`: 실제 production 캐릭터와 marker 합성 확인
- `r1-*-mobile-landscape.png`: 모바일 landscape 구도 확인
- `r1-*-detail-sheet.png`: 주요 건물·Stage·Gate detail crop
- `r1-*-imagegen-original.png`: ImageGen 원본 출력

## 방향 요약

- **R1-A**: warm organic late afternoon. 따뜻한 석재·점토·식재의 유기적인 생활감을 강조한다.
- **R1-B**: crisp rhythmic clear daylight. paving band와 구조적 반복, 명확한 명도 분리를 강조한다.

두 시안 모두 기존 macro geometry를 시각 기준으로 유지한 concept styleframe이다. collision 또는 runtime 좌표의 정확성을 증명하는 production asset이 아니다.

## 생성 방식

ImageGen으로 R1-A/R1-B 원본을 만들고, `tools/generate_music_r1_comparison.js`가 이를 1536×1152로 정규화해 동일 camera crop, 실제 production 캐릭터 합성, neutral marker overlay, 비교 보드를 생성했다.

재생성:

```bash
node design/2d-map-redesign/tools/generate_music_r1_comparison.js
```

생성기는 current production 파일을 읽기만 하며 production asset이나 renderer를 쓰지 않는다.
