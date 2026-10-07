# 실제 게임 화면 기반 팔레트 시안 R2

내장 이미지 생성 도구 사용. 기존 1차 시안은 사용자에게 화풍 불일치로 거절됨. R2는 실제 동물 마을 캡처를 직접 편집 대상으로, 자연 마을 캡처와 house_cream.png를 스타일 참조로 사용함. 회백색 출력에 크림 오렌지/연노랑 팔레트를 적용.

상태: 사용자 검토 전. 실제 게임에 적용하지 않음. 전체 Lab 맵 설계가 아니라 같은 플레이 시야에서 화풍과 색감을 비교하는 국소 시안. 동물 맵 배치는 비교를 위한 임시 기준이며 최종 Lab 동선으로 확정하지 않음. 이미지 생성이 재해석한 픽셀과 캐릭터는 원본 에셋의 정확한 복제가 아님. 구현 시 실제 원본 sprite와 명시적 충돌/소리 슬롯으로 구성해야 함.

## 직접 사용한 참조

- /Users/hyera/Documents/SoundVillage-house-decor-2d/design/2d-map-redesign/previews/lab-reset-1/current-animal-768x576.png
- /Users/hyera/Documents/SoundVillage-house-decor-2d/design/2d-map-redesign/previews/lab-reset-1/current-nature-768x576.png
- /Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature_village/house_cream.png

## 회백색

파일: 01-pearl-gray.png

### 프롬프트

Use case: style-transfer / precise-object-edit.
EDIT THE FIRST ATTACHED IMAGE, an actual screenshot from the user's game. Images 2 and 3 are supporting style references only; image 3 is an actual original house sprite. Deliver a recolored and selectively reskinned version of image 1 for the "Unknown Sounds" zone. This is a GAMEPLAY SCREEN CONCEPT, not a miniature entire town or an illustration.
ABSOLUTE PRIORITY: retain the exact coarse pixel cluster scale, flat simple tile rendering, plain low-detail ground, existing tree sprites and dark outlines of the attached actual game. Do NOT upscale artistic detail. Do NOT interpret 'pixel art' as finely dithered digital painting. Match the supplied game screenshot literally. Output same 4:3 aspect, ideally 768x576. If higher output resolution is necessary, use visually equivalent nearest-neighbor big pixel blocks. Camera and visible world coverage must remain identical to image 1.
Preserve these screen positions/proportions from image 1: pond cropped by the top edge with simple wooden bridge; small cluster of trees below pond; wide horizontal plain path through middle; vertical path down center to south; the dark-haired player near center at exactly its existing screen size; compact cottage southwest with EXACT original silhouette, roof pixel tile shapes and 2D flatness. Keep trees exactly the same sprites, sizes, clustered canopies. Preserve the screen's broad open spaces. No miniaturization, no zoom out, no new horizon or background.
Remove all HUD/touch controls, text, footprint collectible icons and glowing circles, butterfly and farm animals/produce. Fill their locations using nearby unchanged flat ground/path. Convert the southeast animal pen into a small OPEN curiosity yard: remove most fence, use a few LOW pale stone border segments, one small worktable and only TWO simple unfamiliar glass-and-stone ornaments of about the same screen size as the removed farm props. No complex machine, no giant centerpiece, no books or musical instruments. The ornaments should have 3-tone pixel shading and rough 16x16 or 16x24 source-sprite simplicity. Replace southeast ground with a quiet solid stone patio; leave access from middle road completely open. No additional buildings.
PALETTE VERSION 1: Near-white LIGHT GRAY / PEARL. Existing cottage roof becomes muted gray with the identical shingle pixels retained, plaster almost-white gray, wooden door and beams remain warm gray-brown. Reskin main tan path as very pale warm-gray fine gravel, mostly flat color with just sparse tiny 2px marks; patio one shade darker than road with minimal tile seams. Use #ECEDE7 / #D8DBD6 / #A0AAA6 for pale surfaces and edging. Trees and grass remain the SAME muted natural green as screenshot, pond stays soft blue. It must NOT become snow or winter, no global desaturation or monochrome filter. Pale architecture and clear gray-white paths identify this zone, green provides contrast.
Lighting must stay flat like source game, with small simple contact shadows, no realistic light, no bloom, no atmospheric haze, no tiny foliage detail, no textured individual masonry, no elaborate architecture, no photorealism, no painterly edges, no isometric perspective. The outcome should be mistaken for a reskin made directly using this game's existing sprite sheets. No labels or captions.

## 크림 오렌지

파일: 02-cream-orange.png

### 프롬프트

Use case: precise-object-edit. Edit the attached image, which is the accepted style baseline for a small cozy pixel game screen. This is a PALETTE-ONLY VARIANT. Preserve exact composition, camera, resolution/aspect, object count, building silhouette, cottage size, player silhouette, each tree location/shape, pond, bridge, roads, southeast stone courtyard and two abstract little glass props. Keep original coarse pixel art, same flat 3-tone shading and same plain ground detail. Do not redraw in detailed painterly style, do not miniaturize, do not add architecture, do not zoom out. Keep all green grass/trees and blue pond unchanged in color, keep small dark-haired player unchanged. Preserve paths' readable contrast against grass. Only recolor the gray-white architecture, broad light-gray paths and stonework into the following palette. No global tint/filter. No UI, no text, no labels, no new objects.
Main color: soft CREAMY APRICOT ORANGE. Cottage plaster warm pale apricot #F3D5B5, its roof light muted peach terracotta #D8AA83 with tan #AE866B shadow pixels; avoid dark burnt orange or saturated red. Main path pale cream-peach #F2D7B8, sparse detail #DEC1A2. Patio creamy sandstone #D9C6AF and borders muted tan. Wooden door, table and bridge retain natural brown, tiny glass ornaments retain pale icy blue. Image should clearly read as cream-orange variant while maintaining natural green trees/grass and the original flat simple cozy pixel style.

## 연노랑

파일: 03-pale-yellow.png

### 프롬프트

Use case: precise-object-edit. Edit the attached image, which is the accepted style baseline for a small cozy pixel game screen. This is a PALETTE-ONLY VARIANT. Preserve exact composition, camera, resolution/aspect, object count, building silhouette, cottage size, player silhouette, each tree location/shape, pond, bridge, roads, southeast stone courtyard and two abstract little glass props. Keep original coarse pixel art, same flat 3-tone shading and same plain ground detail. Do not redraw in detailed painterly style, do not miniaturize, do not add architecture, do not zoom out. Keep all green grass/trees and blue pond unchanged in color, keep small dark-haired player unchanged. Preserve paths' readable contrast against grass. Only recolor the gray-white architecture, broad light-gray paths and stonework into the following palette. No global tint/filter. No UI, no text, no labels, no new objects.
Main color: soft PALE BUTTER YELLOW. Cottage plaster creamy pale yellow #F7EDBE, roof muted light straw #DCC984 with neutral ochre #ADA078 shadows. Main path very pale buttercream #F3E9B7 with sparse detail #DDD3A6. Patio pale straw stone #DBD1AB and borders muted warm gray. No saturated golden yellow, no orange, no sepia wash. Wooden door, table and bridge retain natural brown, tiny glass ornaments retain pale icy blue. Image should clearly read as pale yellow variant distinct from peach/apricot while maintaining natural green trees/grass and original flat simple cozy pixel style.

