# Codex implementation prompt — Moonlit Concert Garden

아래 작업을 계획만 제안하고 멈추지 말고, 현재 SoundVillage 작업 트리에서 끝까지 구현·검증해줘.

## 목표

선택된 음악 마을 시안인
`design/concepts/music-village-cozy-2026-09-17/01-moonlit-concert-garden-v2-music.png`
을 시각 기준으로 사용해 현재 Music Zone을 실제 플레이 가능한 production 맵으로 리스킨한다.

결과는 단순한 전체 배경 이미지 교체가 아니라 다음을 만족해야 한다.

- 기존 SoundVillage의 48×36 타일, 32px 타일 좌표계와 카메라를 유지한다.
- 캐릭터가 모든 주요 순환로, 중앙 정원 지름길, 네 건물 입구, 무대 전면과 남쪽 출입구를 이동할 수 있다.
- 건물·나무·벤치·화단·플랜터·가로등 기단·분수/조형물·울타리 등 고형 오브젝트를 캐릭터가 통과할 수 없고 자연스럽게 돌아가야 한다.
- 실제 Music sound 아이템, 블록 진행, 전사 패널, Museum 이동, 그룹/참여자 로직은 그대로 작동해야 한다.
- 다른 마을과 월드맵, Supabase 및 연구 데이터 로직은 변경하지 않는다.

## 작업 전 필수 확인

1. 루트 `AGENTS.md`를 따르고, 이 프로젝트의 Next.js 버전은 기존 지식과 다를 수 있으므로 코드 작성 전에 `node_modules/next/dist/docs/`에서 이번 작업과 관련된 Client Component 및 이미지/에셋 처리 가이드를 읽는다.
2. 다음 파일을 읽어 현재 구현과 계약을 파악한다.
   - `PROJECT_SUMMARY.md`
   - `components/MusicZoneMap.js`
   - `lib/musicVillage.js`
   - `lib/musicVillageConfig.mjs`
   - `public/assets/music-village/manifest.json`
   - `scripts/test_music_production.mjs`
   - `design/2d-map-redesign/MUSIC_PRODUCTION_HANDOFF_SPEC.md`
   - `design/2d-map-redesign/2C_C_MUSIC_PRODUCTION_IMPLEMENTATION.md`
   - `app/music-test/page.js`
   - `app/music-responsive-test/page.js`
3. 선택 시안을 이미지로 직접 열어 확인한다. 이 이미지는 1448×1086의 styleframe이며 좌표 권위나 완성 runtime bitmap이 아니다.
4. 현재 작업 트리는 다른 기능의 미커밋 변경이 많이 존재한다. 작업 전 `git status`와 관련 파일의 diff를 확인하고, 다른 변경을 삭제·되돌리거나 덮어쓰지 않는다. `git reset`, `git checkout --`, 광범위한 포맷팅을 사용하지 않는다.
5. 짧은 구현 계획을 세운 뒤 바로 실행한다. 실제로 진행할 수 없는 중대한 선택이 생기지 않는 한 사용자 확인을 기다리지 말고 합리적인 가정으로 완료한다.

## 시각 방향

선택 이미지의 다음 특징을 충실히 옮긴다.

- 깊은 인디고 야간 배경, 청록·보라색 지붕, 따뜻한 앰버 창문과 가로등
- 코랄·시안·핑크 발광 포인트는 제한적으로 사용하고, 길과 충돌 경계는 어두운 배경에서도 명확하게 읽히게 한다.
- 북쪽 중앙의 낮은 이중 파형 캐노피 공연 무대
- 북서쪽 Record Archive: 원형 바이닐 창, 음반 진열과 상자
- 북동쪽 Listening Cafe: 축음기 간판, 헤드폰 모티프 어닝, 야외 테이블
- 남서쪽 Community Studio: 피아노 건반형 창, 첼로/악기 케이스
- 남동쪽 Sound Workshop: 튜닝포크 장식, 악기 수리대와 정돈된 부품
- 중앙 정원의 이퀄라이저 분수/사운드 조형물
- 길에는 저대비 오선·파형 인레이를 사용하되 거대한 음표를 반복해 테마파크처럼 만들지 않는다.
- 빨래, 자전거, 우편함, 화분, 작은 앞마당처럼 실제 주민이 사는 생활감을 유지한다.
- 기존 Human/Nature/Urban/Lab 맵과 비슷한 픽셀 클러스터 굵기와 재료 밀도를 사용한다.
- 특정 상용 게임의 에셋·캐릭터·로고를 복제하지 않고 독창적인 코지 라이프심 픽셀아트로 구현한다.

## 고정해야 하는 맵 권위

`lib/musicVillageConfig.mjs`의 좌표계를 출발점으로 삼는다.

- 캔버스: 1536×1152
- 타일: 48×36, `T = 32`
- 무대: `(18,3)`, 크기 `12×7`; rear collision `12×5`
- 남쪽 게이트: `(22,32)`, 중앙 두 타일을 열린 통로로 유지
- Record Archive: `(4,4)`, `8×6`, 남쪽 입구
- Listening Cafe: `(35,5)`, `10×5`, 남쪽 입구
- Community Studio: `(3,28)`, `10×5`, 동쪽 입구
- Sound Workshop: `(36,27)`, `8×6`, 서쪽 입구
- spawn, exit trigger, 건물/무대 entrance clearance, sound slot 안전 영역을 유지한다.
- 현재 외곽 loop, 내부 rounded loop, 중앙 남북축이 끊기지 않게 한다.

시안의 장식 배치가 위 좌표와 충돌할 경우 시안보다 runtime 좌표와 통행성을 우선한다. 배치 변경이 꼭 필요하면 config·collision·slot·테스트를 한 권위 아래 함께 갱신하고 이유를 문서화한다.

## 에셋 제작 및 통합 방식

1. raster 제작/편집에는 `imagegen` 스킬을 사용한다. 선택 시안은 미술 방향 reference로, 현재 production overview와 collision overlay는 geometry reference로 명확히 구분한다.
2. ImageGen 결과를 그대로 runtime 전체 배경으로 넣지 않는다. 시안 속 캐릭터, 소리 아이템, UI, 글자, 가이드가 production 정적 이미지에 섞이지 않아야 한다.
3. 가능하면 현재 레이어 계약을 유지한다.
   - ground/path
   - contact shadows
   - Stage/Gate structure
   - building body/roof/door-window/trim
   - low props
   - foreground occlusion
   - emissive
   - runtime player
   - runtime sound markers
   - HUD
4. 기존 assets를 바로 덮어쓰기보다 롤백 가능한 새 버전 패키지
   `public/assets/music-village-moonlit-v2/`
   를 만든 뒤 `lib/musicVillage.js`의 asset root를 전환한다. 새 패키지가 완전히 검증되기 전에는 기존 `public/assets/music-village/`를 보존한다.
5. 새 패키지에 `manifest.json`을 만들고 다음을 기록한다.
   - 버전과 production 사용 여부
   - 1536×1152 / 48×36 / 32px geometry
   - stage, gate, building, prop 배치와 collision metadata
   - draw order
   - 모든 PNG의 상대 경로, byte size, SHA-256
   - 선택 시안 경로와 생성/조립 스크립트
6. 재생성 가능한 빌드 스크립트를 `design/2d-map-redesign/tools/` 아래에 추가한다. 수작업 중간 산출물은 `design/2d-map-redesign/sources/music-moonlit-v2/`, 리뷰 이미지는 `design/2d-map-redesign/previews/music-moonlit-v2/`에 둔다. participant runtime은 preview/source 경로를 참조하지 않는다.
7. canvas에서 `imageSmoothingEnabled = false`와 CSS `image-rendering: pixelated`를 유지한다. DPR, 24×18 FOV, player-centered camera, desktop/mobile resize 동작을 깨지 않는다.
8. 야간 장면에서도 플레이어와 sound marker가 배경에 묻히지 않도록 명도 대비를 확인한다. emissive layer를 껐을 때도 길·입구·충돌 경계가 읽혀야 한다.

## 충돌 요구사항

현재 hard collider뿐 아니라 시각적으로 고형인 새 props에도 실제 충돌을 구현한다.

- `PROP_SPECS` 또는 이에 준하는 단일 데이터 구조에 각 prop의 visual footprint와 foot-level collision rectangle/inset을 선언한다.
- 건물, 무대 후면, gate post, 나무줄기, 벤치, 플랜터, 화단 경계, 가로등 기단, 중앙 분수/조형물, 울타리 등은 보이는 형태와 합리적으로 일치하는 collider를 가져야 한다.
- 나뭇잎·처마·전경 식재처럼 머리 위를 덮는 시각 요소 전체를 충돌로 쓰지 말고 발밑/기단만 막는다.
- 바닥 오선, 꽃잎, 잔디, 그림자, 빛, emissive, 물결 같은 flat decoration은 collision을 만들지 않는다.
- 축 분리 이동(`moveWithCollision`)과 20×14 player box를 유지해 모서리에서 끼임이 없게 한다.
- 모든 출입구 앞 최소 3×3 clearance, gate 두 타일, 중앙축, 양방향 loop, garden shortcut을 보장한다.
- sound slot 계산은 모든 solid collider와 최소 한 타일의 시각 여백을 피하도록 갱신한다.

## 절대 보존할 게임/연구 기능

- Music-first 해금 규칙과 Music Block 1 완료 조건
- Group A 83개, Group B 83개, 각 block `15/15/15/15/15/8`
- researcher bypass 166개 진단 배치와 deterministic sound-id placement
- `sound_metadata.json`, sound ID, group, block, audio path
- `onCollectSound`, `collectedIds`, `blockNum`, `blockTotal`
- unavailable/active/nearby/interacting/completed marker 상태
- Enter 및 모바일 confirm으로 전사 시작
- AnnotationPanel, 저장, skip/error 정책, Museum 이동
- ESC와 남쪽 gate exit confirmation
- WASD/방향키, D-pad, 모바일 반응형 동작
- participant/session, Supabase/SQL/RPC, reward/currency, house decor

정적 맵에는 시안의 5개 예시 sound orb를 굽지 않는다. 실제 아이템은 현재 runtime marker 시스템으로만 표시하며 A/B 각각 83개와 블록 잠금을 정확히 지원한다.

## 검증과 완료 조건

다음을 모두 충족하기 전에는 완료라고 하지 않는다.

### 자동 검증

1. `scripts/test_music_production.mjs`를 새 asset root와 prop collision까지 검증하도록 갱신한다.
2. 최소한 다음을 assertion으로 확인한다.
   - A/B 각각 83개, block 분포, sound-ID 배치 결정성
   - researcher bypass 166개와 unique/safe slot
   - spawn/exit 분리
   - stage, gate post, 네 건물 충돌과 입구 clearance
   - 모든 solid prop 중심에서는 충돌하고 인접 통로는 이동 가능
   - gate 두 lane, 양쪽 loop, 중앙축, garden shortcut의 연속적인 walkability
   - marker slot이 모든 collider, entrance, spawn, prop 여백을 회피
   - 새 manifest의 모든 파일 존재, hash/size 일치, runtime 경로가 preview를 참조하지 않음
3. 실행:
   - `npm run test:music-production`
   - 변경 파일 대상 scoped ESLint
   - `npm run build`

기존 unrelated 오류가 있으면 새 변경에서 발생한 문제인지 분리해 보고하고, 이번 변경으로 생긴 오류는 반드시 수정한다.

### 브라우저 및 시각 QA

`/music-test`와 `/music-responsive-test`를 실제 브라우저에서 확인한다.

- desktop 시작 화면
- Group A/B Block 1
- Block 6
- 일부 완료 및 83개 완료 상태
- 390×640 portrait
- 720×390 landscape
- spawn→gate, loop 시계/반시계, garden shortcut, stage approach, 네 건물 입구
- keyboard hold, D-pad, Enter prompt, exit confirm
- 콘솔 warning/error 0, asset status `ready`

다음 리뷰 이미지를 남긴다.

- 1536×1152 full-map production overview
- desktop gameplay start
- mobile portrait/landscape
- collision + entrance + sound-slot overlay
- emissive on/off 비교
- grayscale readability
- 선택 시안과 최종 production 비교 보드

## 최종 보고

완료 후 다음만 명확히 보고한다.

- 적용 결과와 선택 시안에서 실제로 구현한 핵심 요소
- 변경한 파일과 새 asset 경로
- 충돌·sound slot·반응형 검증 결과
- 실행한 테스트와 결과
- 남아 있는 실제 위험 또는 수동 확인이 필요한 항목
- 다른 사용자 변경을 보존했음을 확인

최종 결과를 Codex에서 바로 검토할 수 있도록 대표 production overview 이미지와 변경 diff를 열어준다.
