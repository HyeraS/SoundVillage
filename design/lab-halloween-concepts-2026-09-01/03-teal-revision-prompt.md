# 3안 수정 — 청록빛 마녀 골목

- 요청: 3안에 2안의 청록색 색감을 추가.
- 편집 대상: `03-violet-witch-lanes.png`.
- 색상 참조: `02-moonmist-waterways.png`.
- 유지 목표: 3안의 구도, 길, 건물과 소품 배치, 보라색 지붕, 주황 호박등, 밝은 소리 아이템.
- 변경 목표: 잔디를 세이지 청록색으로, 일부 나무·관목을 청록/비취색으로, 기존 연못을 청록 물빛으로 보정.
- 제작: 내장 이미지 생성 도구의 참조 이미지 편집. 원본은 보존하고 별도 수정본으로 저장.
- 결과: [청록빛 마녀 골목 v2](./03-violet-witch-lanes-teal-v2.png), 1448×1086px PNG. 최종 이미지에서 기존 동선·건물 구도와 6개 아이템의 위치 유지, 청록 잔디·일부 수목·연못 색상 반영을 육안 확인했다.
- 범위: 이미지 디자인 수정만. 앱 코드·이동·충돌 데이터 변경 없음.

## 최종 편집 프롬프트

```text
Use case: style-transfer / selective palette edit.
Image 1 is the EDIT TARGET: proposal 03, the violet witch lanes Halloween village map.
Image 2 is a COLOR REFERENCE ONLY: proposal 02, the teal moonmist waterways map.
User request: add proposal 02's teal color feeling to proposal 03. Produce ONE revised map image, NOT a comparison or collage.

Keep the complete geometry, pixel-art texture scale, camera, composition, path shapes, all buildings, crooked witch roof, fences, trees, central well, lower-left pond, props, six floating sound items, their positions, the player and HUD of IMAGE 1. Do NOT import image 2's canal, bridges, buildings or willow tree shapes. This is a selective recolor of image 1, not a redesigned village.
Color changes: transfer the beautiful blue-green/teal environmental palette of image 2 onto the natural parts of image 1. Change the muddy yellow-olive lawn to a calm medium-light desaturated sage-teal, similar to image 2's grass. Recolor about HALF to TWO THIRDS of the existing purple tree crowns into deep teal shadows, jade midtones and muted mint highlights; preserve the tree silhouettes exactly and retain some plum/lavender trees interspersed so the purple Halloween identity remains. Recolor existing bushes in the same teal-jade family. Shift the existing lower-left pond from royal blue toward rich blue-green teal. Subtly cool environmental shadow colors but do NOT tint the whole image cyan.
Keep purple and aubergine cottage roofs purple, retain terracotta accent roofs, warm cream walls, natural brown wood, pale warm sand paths and the original ivory HUD. Preserve orange pumpkins and honey-colored lantern/windows as the complementary warm accents. Preserve the bright ivory-mint collectibles and their dark detached ground shadows; they must remain more luminous and readable than the environment.
Mood: cozy, welcoming, a little mysterious, clear and playable, not dark night or cold horror. A balanced teal + plum + pumpkin palette. Teal must be clearly visible across the environment, not only in the tiny pond, while proposal 03 is immediately recognizable.
Rendering invariants: preserve crisp coarse flat 2D pixel art, blocky stepped contours, limited material shades and sparse ground texture. No smoother illustration, no blur, no 3D, no added detail, no glow wash. Do not move any object, shrink paths or put collectibles on water.
Preserve exact Korean text from image 1: "← 월드맵", "미지의 소리 마을", "소리 수집", "↓ 입구". No extra text. Maintain original 4:3 full-map framing.
```
