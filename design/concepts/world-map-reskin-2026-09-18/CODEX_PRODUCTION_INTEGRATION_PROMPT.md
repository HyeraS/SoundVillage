# SoundVillage 월드맵 production 통합·왕복 연결 검증용 Codex 프롬프트

아래 프롬프트 전체를 새 Codex 작업에 그대로 전달한다.

---

당신은 SoundVillage의 production 통합을 책임지는 시니어 게임 클라이언트 엔지니어다.

## 목표

이미 구현된 기준 이미지 일치형 월드맵 v2가 단순한 시각 preview나 QA 전용 화면이 아니라, SoundVillage 실제 루트 앱에서 정상적으로 사용되도록 연결 상태를 감사하고 필요한 수정까지 완료하라.

월드맵에서 플레이어가 실제로 이동하여 각 랜드마크에 접근하고 `Enter` 또는 모바일 확인 버튼을 사용했을 때 올바른 마을·도서관·집으로 들어가야 한다. 각 마을에서 월드맵으로 돌아오는 왕복 흐름도 정상이어야 한다.

분석 보고서만 작성하지 말고, 문제가 발견되면 production 코드를 수정하고 브라우저 E2E, 정적 검증, lint와 build까지 통과시켜라.

## 이미 존재하는 핵심 결과

- 기준 이미지: `design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png`
- production 배경 에셋: `public/assets/world/sound-archive-garden-v2/world-base-clean.png`
- 월드맵 구현: `components/WorldMap.js`
- 에셋 등록: `components/AssetRegistry.js`
- 실제 앱 화면 전환: `app/page.js`
- 기존 시각 검수: `_review/world-map-reference-match-v2/`
- 기존 collision 검증: `scripts/verify-world-map-reskin.mjs`

월드맵의 시각 디자인은 이미 승인된 것으로 취급한다. 연결 검증을 이유로 배경 이미지를 다시 생성하거나 레이아웃을 임의 변경하지 않는다.

## 현재 독립 검증에서 확인된 사실

2026-09-20 현재 development QA 모드의 실제 루트 앱에서 다음 동작은 확인되었다.

- Nature portal → `자연 마을` 화면 진입
- Animal portal → `동물 마을` 화면 진입
- Urban portal → `도시 마을` 화면 진입
- Music portal → `음악 마을` 화면 진입
- Human portal → `사람 마을` 화면 진입
- Lab portal → `미지의 소리 마을` 화면 진입
- Sound Library → Museum `전시 현황` 화면 진입
- Home → world map이 unmount되고 house loading branch로 전환
- Animal의 `← 월드맵` 버튼 → 실제 월드맵 복귀
- `node scripts/verify-world-map-reskin.mjs` → 모든 목적지가 spawn에서 연결됨

단, 이 검증은 `natureQa=1`과 `worldStart`를 이용한 development 점검이다. Home은 로컬 Supabase 방 데이터가 없어 `불러오는 중…` 이후 실제 방 렌더까지 확인하지 못했다. 이번 작업에서는 QA 우회에만 의존하지 말고 실제 production 흐름과 잠금·데이터 로딩·왕복 상태까지 검증한다.

## 작업 시작 전 필수 확인

1. 저장소의 `AGENTS.md`를 읽고 준수한다.
2. 코드를 수정하기 전에 `node_modules/next/dist/docs/`에서 이 프로젝트 버전의 Client Component, static/public asset, development query 처리와 관련된 문서를 읽는다.
3. `git status --short`로 기존 사용자 변경을 확인하고 절대 되돌리지 않는다.
4. 다음 파일을 전부 읽어 실제 상태 전환 계약을 파악한다.
   - `app/page.js`
   - `components/WorldMap.js`
   - `components/GameEngine.js`
   - `components/AssetRegistry.js`
   - `components/AnimalZoneMap.js`
   - `components/NatureZoneMap.js`
   - `components/HumanZoneMap.js`
   - `components/UrbanZoneMap.js`
   - `components/MusicZoneMap.js`
   - `components/LabZoneMap.js`
   - `components/SoundMuseum.js`
   - `components/InteriorDecorRoom.js`
   - `lib/participantAuth.js`
   - `scripts/verify-world-map-reskin.mjs`
5. `_review/world-map-reference-match-v2/QA_REPORT.md`의 주장만 재사용하지 말고 현재 코드로 다시 검증한다.

## production 연결 계약

### 월드맵 진입

- 정상 참여자가 StartPanel에서 인증을 완료하면 `screen === 'world'`가 되고 v2 월드맵이 표시되어야 한다.
- 이전 세션을 복원한 참여자도 QA query 없이 같은 v2 월드맵으로 진입해야 한다.
- `worldClean`, `worldCapture`, `worldOverview`, `worldStart`, `natureQa` 같은 개발용 기능이 없어도 `world-base-clean.png`가 production 월드맵 배경으로 사용되어야 한다.
- 개발용 query는 `NODE_ENV === 'development'`에서만 동작하고 production에서는 무시되어야 한다.
- 월드맵 에셋 요청에 404, decode 오류, 빈 화면, aspect-ratio stretch가 없어야 한다.

### 포털 매핑

다음 매핑을 코드와 브라우저에서 모두 검증한다.

| 월드 랜드마크 | 전달할 zone key | 실제 렌더 컴포넌트/화면 |
|---|---|---|
| 상단 관측소 | `Lab` | `LabZoneMap`, 미지의 소리 마을 |
| 우상단 목장 | `Animal` | `AnimalZoneMap`, 동물 마을 |
| 오른쪽 도시 블록 | `Urban` | `UrbanZoneMap`, 도시 마을 |
| 우하단 음악 정원 | `Music` | `MusicZoneMap`, 음악 마을 |
| 좌하단 공동체 광장 | `Human` | `HumanZoneMap`, 사람 마을 |
| 왼쪽 개울·다리 | `Nature` | `NatureZoneMap`, 자연 마을 |
| 중앙 도서관 | museum callback | `SoundMuseum` |
| 좌상단 집 | house callback | `InteriorDecorRoom` |

- 시각 랜드마크와 interaction hitbox가 같은 장소여야 한다.
- 잘못된 zone key, 인접 portal과 겹치는 hitbox, label과 실제 목적지가 다른 경우를 허용하지 않는다.
- 키보드 `Enter`, `Space`, 모바일 확인 버튼이 동일한 destination을 호출해야 한다.

### 실제 이동

- 기본 spawn `(60,47)`에서 시작해 정상 방향키/WASD 이동으로 모든 목적지에 도달할 수 있어야 한다.
- 단순히 `worldStart`로 목적지에 순간 이동하는 검증만으로 통과시키지 않는다.
- 자동 graph 검증으로 여덟 목적지의 연결성을 확인하고, 브라우저에서는 최소 다음 세 실제 이동 경로를 키 입력으로 검증한다.
  - spawn → Sound Library
  - spawn → Nature
  - spawn → Music
- 경로 중 invisible wall, 물 위 통과, 건물 관통, 통로 안쪽 collision, 카메라 빈 띠가 없어야 한다.
- 나머지 목적지도 graph path를 산출하고, 그 경로의 각 tile 또는 player-foot sample이 실제 `isWalkable`과 일치하는지 확인한다.

### 잠금과 연구 진행

- 일반 참여자의 초기 상태에서는 Music만 진입 가능하고 다른 다섯 마을은 잠겨야 한다.
- 잠긴 portal에서 `Enter`, `Space`, 모바일 확인을 눌러도 zone 화면으로 전환되지 않아야 한다.
- 잠금 차단 event와 사용자 안내가 정상이어야 한다.
- Music Block 1의 요구 조건 완료 후 다른 다섯 마을이 해금되고 실제 진입 가능해야 한다.
- 연구 접근 ID와 development QA 참여자의 우회 규칙은 기존 계약을 유지한다.
- 월드맵 리스킨 때문에 annotation, progress, group, block 또는 Supabase schema를 변경하지 않는다.

### 마을 왕복

여섯 마을 각각 다음을 검증한다.

1. 월드맵의 올바른 랜드마크에 접근한다.
2. proximity cue의 마을 이름이 랜드마크와 일치한다.
3. `Enter`로 진입한다.
4. 해당 전용 맵과 HUD가 실제로 mount되는지 확인한다.
5. 플레이어가 마을 안에서 이동 가능한지 짧게 확인한다.
6. `← 월드맵`, ESC 또는 해당 마을의 exit confirmation을 사용한다.
7. 월드맵이 다시 mount되고 입력이 정상 동작하는지 확인한다.
8. 왕복 후 다른 portal에도 진입할 수 있는지 확인해 stale state를 배제한다.

모든 마을이 같은 callback을 받는다는 코드 확인만으로 통과시키지 말고 실제 브라우저 왕복 결과를 남긴다.

### Sound Library

- 중앙 도서관의 보이는 정문과 museum hitbox를 맞춘다.
- 진입하면 후보 sound가 없어도 `SoundMuseum` 자체가 열리고 `전시 현황`과 `상점`을 사용할 수 있어야 한다.
- Museum 종료 후 월드맵으로 돌아와 이동할 수 있어야 한다.
- Supabase 후보 조회 실패가 월드맵 전체를 멈추게 하지 않아야 한다.

### Home

- 좌상단 Home의 보이는 문과 hitbox가 일치해야 한다.
- `onEnterHouse` 후 `InteriorDecorRoom`이 실제로 mount되어야 한다.
- 가능한 경우 프로젝트의 안전한 로컬 Supabase 환경이나 기존 테스트 fixture를 사용하여 방 데이터 로드 완료, 가구 표시, 나가기까지 검증한다.
- 원격 production 데이터에 테스트 레코드를 만들거나 기존 데이터를 변경하지 않는다.
- 로컬 backend를 사용할 수 없다면 컴포넌트 계약, mock fixture 기반 통합 테스트, callback 전환까지 검증하되 실제 persistence 로드 완료를 PASS로 과장하지 않는다.
- 집에서 나가면 동일 참여자 상태로 월드맵에 돌아와야 한다.

## 테스트 가능성 보강

필요하면 UI 의미나 production 동작을 바꾸지 않는 범위에서 안정적인 테스트 식별자를 추가한다.

- 월드맵 root: `data-testid="world-map"`
- player: `data-testid="world-player"`
- portal hotspot: `data-testid="world-portal-{zone}"`
- museum hotspot: `data-testid="world-museum"`
- home hotspot: `data-testid="world-home"`
- 현재 screen 또는 zone을 확인할 수 있는 비시각적 data attribute

테스트를 위해 production에서 보이는 debug 버튼이나 임시 텍스트를 추가하지 않는다.

## 자동 검증

기존 `scripts/verify-world-map-reskin.mjs`를 강화하거나 별도의 다음 스크립트를 만든다.

`scripts/test-world-map-production-integration.mjs`

최소 검증 항목:

- `WorldMap`이 `app/page.js`의 실제 `screen === 'world'` 분기에서 사용됨
- v2 base asset이 QA flag와 무관하게 렌더됨
- 여섯 zone key와 전용 component 매핑 일치
- museum 및 Home callback 연결
- 모든 destination이 spawn과 연결됨
- portal별 접근 가능한 인접 tile 최소 2개
- destination hitbox가 맵 경계 안에 있음
- 개발 query가 production 조건에서 활성화되지 않음
- 모든 runtime asset 존재 및 파일 크기 0이 아님

정규식으로 문자열 존재만 확인하는 테스트에 그치지 말고, 가능한 부분은 실제 export된 geometry 또는 공용 설정을 import하여 검사한다. production 코드와 테스트에 좌표를 각각 중복 작성하여 서로 같이 틀릴 수 있는 구조를 피한다. 필요하면 월드 geometry를 순수 모듈로 추출하되 동작 회귀를 만들지 않는다.

## 브라우저 E2E 매트릭스

실제 루트 경로 `/`에서 다음 매트릭스를 검증한다.

1. development QA 참여자: 여섯 마을, Museum, Home 진입
2. 일반 참여자 초기 상태: Music 가능, 나머지 잠금
3. 해금 상태 참여자 또는 안전한 fixture: 여섯 마을 진입
4. 각 마을 → 월드맵 왕복
5. Museum → 월드맵 왕복
6. Home → 월드맵 왕복 또는 backend 미사용 시 명시적인 부분 검증
7. 키보드와 모바일 확인 버튼
8. desktop, 390×844 portrait, 844×390 landscape
9. 브라우저 console error와 asset 404 확인

`worldStart`는 각 portal의 빠른 smoke test에는 사용할 수 있지만, 실제 이동과 정상 인증 흐름을 대체할 수 없다.

## 회귀 방지

- 승인된 v2 배경 이미지와 현재 시각적 위치를 변경하지 않는다.
- annotation panel, sound collection, audio lifecycle, quest, attendance, currency, duo session, participant auth, Museum 투표, house-decor persistence 로직을 임의 수정하지 않는다.
- DB schema, migration, RLS, RPC를 이번 작업에서 변경하지 않는다.
- 관련 없는 사용자 변경을 되돌리지 않는다.
- 현재 dirty worktree를 정상으로 취급한다.

## 필수 실행 명령

현재 package script를 확인한 뒤 최소한 다음을 실행한다.

- `npm run lint`
- `node scripts/verify-world-map-reskin.mjs`
- 새 production integration test
- `npm run test:input-lifecycle`
- `npm run test:stage-6-lifecycle`
- `npm run build` 또는 이 저장소에서 검증된 동등한 production build 명령

기존 실패가 있다면 이번 변경과의 관련성을 구분하고 원본 로그를 보존한다.

## 검수 산출물

기존 리뷰 폴더를 덮어쓰지 말고 다음 경로를 사용한다.

`_review/world-map-production-integration/`

반드시 다음을 남긴다.

- `01-normal-entry-world.png`
- `02-spawn-to-library.png`
- `03-spawn-to-nature.png`
- `04-spawn-to-music.png`
- `05-animal-entered.png`
- `06-nature-entered.png`
- `07-human-entered.png`
- `08-urban-entered.png`
- `09-music-entered.png`
- `10-lab-entered.png`
- `11-museum-entered.png`
- `12-home-entered.png` 또는 backend 제한 증거
- `13-returned-to-world.png`
- `14-locked-zone-blocked.png`
- `15-mobile-portrait-enter.png`
- `16-mobile-landscape-enter.png`
- `portal-route-results.json`
- `screen-transition-results.json`
- `console-errors.json`
- `QA_REPORT.md`

스크린샷은 실제로 열어 육안 확인한다.

## 완료 판정

다음 조건이 모두 충족될 때만 완료라고 보고한다.

- 정상 루트 앱에서 v2 월드맵이 기본으로 표시된다.
- 여섯 랜드마크가 올바른 실제 마을과 연결된다.
- 여섯 마을 모두 월드맵으로 정상 복귀한다.
- Museum 진입과 복귀가 정상이다.
- Home callback뿐 아니라 가능한 환경에서 실제 방 렌더와 복귀까지 검증했다.
- 기본 spawn에서 목적지까지의 실제 이동 또는 동일 geometry를 사용하는 경로 검증이 통과한다.
- 잠금과 해금 상태가 실제 진입을 올바르게 제한한다.
- 키보드와 모바일 입력이 같은 destination으로 연결된다.
- production build에서 development QA 기능이 노출되지 않는다.
- console error, asset 404, 무한 loading, stale input 문제가 없다.

Home backend 검증처럼 외부 환경이 없어 확인하지 못한 항목이 있으면 전체 PASS라고 쓰지 말고 `PARTIAL — backend verification required`로 명시한다.

## 완료 보고 형식

최종 답변에는 다음을 보고한다.

1. 실제로 확인한 월드맵 → destination 매핑
2. 각 마을과 Museum/Home의 진입·복귀 결과
3. 기본 spawn에서의 경로 연결 결과
4. 잠금·해금 검증 결과
5. 수정한 production 파일과 이유
6. 실행한 테스트와 build 결과
7. backend 때문에 검증하지 못한 부분
8. 대표 리뷰 이미지와 QA 보고서 링크

코드상 callback이 존재한다는 이유만으로 연결 완료라고 판단하지 마라. 실제 루트 앱의 브라우저 동작, 올바른 전용 맵 mount, 왕복, 입력, 잠금, 빌드를 모두 확인하라.

---

