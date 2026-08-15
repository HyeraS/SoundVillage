# SoundMimic Village — 프로젝트 요약

> 소리를 탐험하고, 의성어로 표현하고, 다른 참여자의 표현에 공감 투표하는 웹 기반 사운드 어노테이션 연구용 게임.
> 요약 작성 기준: 2026-08-05 (`main` 커밋 `79adf70` / `asset-swap` 커밋 `ca5d129` + 미커밋 WIP, 두 브랜치 상태를 함께 정리)

`docs/notion/` 아래 2026-06-05 기준 상세 문서 7편이 있으나, 이후 커밋(Sound Museum, 블록 퀘스트, 그룹 A/B, 마을 잠금, 연구용 접근 ID, 실 접속자 장애 대응, WorldMap 비주얼 전면 개편 등)으로 Zone 체계·흐름·비주얼이 크게 바뀌었다. 이 문서는 **현재 코드 기준**으로 다시 정리한 것이다.

**브랜치 상태가 두 갈래로 갈라져 있음 — 중요:**
- `main`: 실제 실험 참여자들이 접속하는 배포 브랜치. 게임플레이/백엔드 로직(1~11장 내용)은 이 브랜치 기준.
- `asset-swap`: `main`의 `fabc721`에서 분기, 아직 push/merge 전인 **로컬 전용 WIP 브랜치**. WorldMap·Lab 존을 구매한 itch.io 픽셀 에셋으로 전면 리스킨하는 작업에 더해, 현재는 **동물 마을(Animal) 길 버그 수정**과 **자연 마을(Nature) 존 전면 교체**까지 진행 중이다(12장 참고). 이 두 항목은 아직 커밋되지 않은 워킹 트리 변경사항(`app/page.js`, `components/AssetRegistry.js`, `components/WorldMap.js`, `components/ZoneMap.js`)이다. **`main`에만 있는 커밋 2개(`fb2fb1c`, `79adf70` — 접속 장애 수정, Museum 로딩 인디케이터)가 `asset-swap`에는 없으므로**, 이후 `main`에 merge하거나 `main`을 다시 베이스로 rebase할 때 반드시 반영 확인 필요.

---

## 1. 한눈에 보기

- **참여자 ID + 그룹 ID(A/B)**를 입력하고 픽셀 아트 월드맵에 입장한다.
- 처음엔 **Music 마을만 열려 있고**, Music 구역 1을 전사 완료해야 나머지 5개 마을이 열린다.
- 마을 안에서는 **블록(구역) 단위 퀘스트**로 소리 아이템이 순차 공개된다 — 한 블록을 다 채우면 다음 블록이 열린다.
- 소리를 수집하면 **AnnotationPanel**(Stage 1)이 열려 의성어 표현 + 자신감(현재는 슬라이더)을 제출한다.
- Stage 1 제출 후에는 ZoneMap이 아니라 **Sound Museum**(도서관 테마 풀스크린 룸)으로 이동해, 다른 그룹이 남긴 표현에 투표할 수도 있다.
- 월드맵에서 **Sound Museum에 직접 입장**할 수도 있으며, 이때는 자신이 속하지 않은 그룹의 소리 중 표현이 5개 이상 쌓인 것만 후보로 노출된다.
- 특별 참여자 ID(`ALLAUDIO_A`/`ALLAUDIO_B`, `ACCESS-ALL` 등)를 입력하면 **연구용 전체 접근 모드**로 모든 마을·블록·소리에 즉시 접근한다. `ALLAUDIO_A`/`ALLAUDIO_B`는 해당 그룹으로 고정되어 실제 그룹 A/B 참여자와 동일한 소리 목록·아이템 배치를 보여준다(그룹 무관 접근 ID는 A+B 전체를 보여주므로 배치가 실제 참여자와 다를 수 있음).
- 결과는 Supabase `annotations`, `votes` 테이블에 저장된다.

---

## 2. 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js `16.2.7`, App Router |
| UI | React `19.2.4`, 인라인 스타일 (Tailwind 설치되어 있으나 미사용) |
| 데이터베이스 | Supabase JS `2.106.2` |
| 오디오 | Howler.js `2.2.4` |
| 렌더링 | 전부 Client Component, SVG 기반 맵 |
| 테스트 | Node 내장 `node:test` (신규 추가, `lib/studyAccess.test.mjs`) |

---

## 3. Zone(마을) 체계

과거 Forest/Water/City/Music/Mystery 명칭은 폐기되고, 현재는 다음 6개 Zone으로 통일되어 있다 (`components/GameEngine.js`의 `ZONE_META`):

| Zone 키 | 한글 라벨 | 대표 범주 | 색상 | 이모지 |
|---|---|---|---|---|
| `Animal` | 동물 마을 | Biological (Bark, Bird 등) | `#5B9E3A` | 🐾 |
| `Human` | 사람 마을 | 사람이 내는 소리 | `#E8A04A` | 👤 |
| `Nature` | 자연 마을 | 물/바람 등 자연음 | `#4A8FD4` | 🌿 |
| `Urban` | 도시 마을 | Vehicle, Crowd 등 | `#C4B99A` | 🏙 |
| `Music` | 음악 마을 | 멜로디/타악기 | `#9B6DD4` | 🎵 |
| `Lab` | 미지의 소리 마을 | 합성/추상음 | `#D4883A` | ✨ |

- `Music`이 **최초 개방 Zone**(`FIRST_ZONE`)이며 나머지는 시작 시 잠김.
- `lib/supabase.js`에는 구버전 sound_id 포맷(`Forest_066514` 등)과 신버전(`Animal_66514`)을 모두 인식하는 브리지 로직(`soundIdVariants`, `findSoundByDbId`)이 남아 있어 과거 데이터와의 하위 호환을 유지한다.

---

## 4. 사운드 데이터셋

`data/sound_metadata.json` — 총 **1,000개** 사운드, 그룹 A/B 각 500개로 정확히 균형 배분됨(`main` 커밋 `4e087ee`로 기존 2,000개에서 가장 조용한 클립을 제거해 절반으로 축소; 아래 표는 2026-07-29 기준 파일 실측치).

| Zone | 개수 |
|---|---|
| Lab | 169 |
| Human | 169 |
| Music | 166 |
| Urban | 166 |
| Animal | 166 |
| Nature | 164 |

각 항목 스키마:
```json
{
  "sound_id": "Animal_236044",
  "game_zone": "Animal",
  "source_type": "Biological",
  "sub_category": "Bark",
  "audioset_class": "Bark",
  "file_path": "Audio/Animal/236044",
  "source_dataset": "FSD50K",
  "original_fname": "236044",
  "ambiguous": false,
  "group": "A",
  "block": 1
}
```
- `group`: A 또는 B — 참여자는 자기 그룹 소리만 수집, Museum에서는 **반대** 그룹 소리만 본다.
- `block`: 마을 내 세부 구역 번호 — 순차 언락의 단위.
- 데이터셋은 FSD50K에서 필터링/블록 배정/그룹 밸런싱한 것으로, `scripts/`에 관련 파이썬 스크립트 다수 존재(`filter_fsd50k.py`, `assign_blocks.py`, `balance_groups.py`, `boost_*_zone.py`, `build_metadata.py` 등).
- 실제 오디오 파일(`public/audio/...`)은 저장소에 없음 — 이전 문서와 동일하게 여전히 미해결.

---

## 5. 화면 흐름

```text
start
  → world (월드맵, Music만 개방)
  → zone (블록 단위로 소리 아이템 등장)
  → annotate (Stage 1: 표현 + 자신감 슬라이더 제출)
  → museum (Sound Museum: 다른 그룹 표현에 투표, 선택적)
  → world 복귀 (+ 완료 토스트)
```

`app/page.js`의 `screen` 상태값: `start | world | zone | annotate | museum`.

### 5.1 시작 화면 (`StartPanel`)
- 참여자 ID + 그룹 ID(A/B 드롭다운) 입력, 참여자 ID는 **자동으로 대문자 정규화**(`p1`→`P1`, Supabase 상 동일 참여자로 인식되도록).
- 플레이스홀더가 `P01~P05 / Q01~Q05` 스킴으로 표기됨(최근 커밋).
- 연구용 접근 ID(`ALLAUDIO_A`, `ALLAUDIO_B`, `STUDYALL`, `STUDY-ALL`, `ACCESSALL`, `ACCESS-ALL`, `AUDIOTEST`, `AUDIO-TEST`, `RESEARCHER`)를 입력하면 실시간으로 "연구용 전체 접근 모드" 안내가 표시됨(`lib/studyAccess.mjs`). `ALLAUDIO_A`/`ALLAUDIO_B`는 그룹이 ID에 고정되어 `app/page.js`에서 그룹 필터를 우회하지 않고 A/B로만 필터링하므로, 실제 그룹 참여자와 동일한 아이템 배치를 보게 된다.

### 5.2 월드맵 (`WorldMap`)
- 방향키/WASD/모바일 D-Pad 이동, 최근 커밋에서 **모바일 Zone 진입 버그 수정** 및 **와이드 스크린 렌더링 좌측 쏠림 버그 수정** 완료.
- Zone 포털 외에 **Sound Museum 입구**가 별도로 존재(`onEnterMuseum`).
- `lockedZones` prop으로 미개방 마을을 표시 — 연구용 접근 모드이거나 `villagesUnlocked===true`면 전부 개방.
- (`asset-swap` 브랜치에서만) 위 로직은 그대로 두고 **렌더링만 전면 리스킨** — 구매한 픽셀 에셋 기반 오토타일 지형·2배 확장된 맵·플레이어 추적 카메라·실제 건물 스프라이트·존별 테마 장식이 추가됨. 자세한 내용은 12장.

### 5.3 Zone 맵 (`ZoneMap`)
- 블록(구역) 단위로 소리 아이템이 격자 형태 영역에 배치되고, 잠긴 블록은 "구름"으로 가려짐.
- 현재 언락된 블록 번호만큼만 충돌 판정이 활성화됨(`blockNumRef`).
- 블록을 다 채우면 다음 블록이 열리고, Music 블록 1을 처음 완료하면 **전체 마을 잠금 해제** 오버레이가 표시됨.

### 5.4 Stage 1 — 표현 입력 (`AnnotationPanel`)
- 재생 → 최대 80자 의성어 입력 → 자신감 제출 → `annotations` 저장.
- 저장 성공 시 ZoneMap이 아니라 **Sound Museum으로 이동**(과거엔 Stage 2가 같은 패널 안에 있었으나 지금은 별도 화면으로 분리됨).

### 5.5 Sound Museum (`SoundMuseum`, 신규 컴포넌트)
- 도서관/전시실 컨셉의 풀스크린 UI. Zone별 방 테마(벽/바닥/책장 색), Zone별 NPC 캐릭터와 대사 존재.
- 같은 `sound_id`에 대해 무작위 순서로(인기순 정렬 제거, 편향 방지) 최대 5개 후보 표현 표시, 투표는 슬라이더 기반 "동의 정도"로 기록.
- 후보 선택 시 동의 슬라이더로 자동 스크롤(최근 커밋).
- 이미 투표한 소리는 Museum 후보에서 제외.
- 투표 완료 후 "오늘의 전시 관람 완료" 토스트 표시 후 월드맵 복귀.
- 표현 후보가 5개 미만이면 "아직 전시 중인 소리가 없어요" 안내 모달.

---

## 6. 상태 소유권 (`app/page.js`)

| 상태 | 역할 |
|---|---|
| `screen` | 현재 화면 (`start/world/zone/annotate/museum`) |
| `participantId`, `groupId` | 참여자/그룹 식별자 |
| `activeZone`, `activeSound` | 현재 조작 중인 Zone/소리 |
| `collectedIds` | 참여자가 실제 DB에서 완료 확인한 소리 ID 집합(Zone 진입 시 재조회) |
| `unlockedBlock` | Zone별 현재 언락된 블록 번호 |
| `villagesUnlocked` | Music 블록1 완료 여부(전체 마을 잠금 해제 플래그) |
| `studyAccessEnabled` | 연구용 접근 ID 여부 — 모든 잠금 우회 |
| `totalCount`, `zoneProgress` | Supabase 집계(참여자 기준) |

Zone/블록 진입 로직은 Supabase에서 참여자가 실제로 완료한 `sound_id`를 조회해 블록 진행도를 재계산하므로, 새로고침해도 블록 잠금 상태는 유지된다(구버전 문서의 "새로고침 시 초기화" 설명은 더 이상 전체적으로 맞지 않음 — `collectedIds`/블록은 DB 기준 복원, 다만 세션/화면 자체는 새로고침 시 `start`로 돌아감).

---

## 7. 컴포넌트/파일 사전

| 파일 | 역할 |
|---|---|
| `app/page.js` | 전체 화면 오케스트레이션, Zone/그룹/블록 필터링, Supabase 집계 |
| `app/layout.js` | 루트 레이아웃(한국어), 메타데이터 |
| `app/globals.css` | Nunito 폰트, 전역 리셋, 애니메이션 |
| `components/StartPanel.js` | 참여자/그룹 입력, 연구용 접근 미리보기 |
| `components/WorldMap.js` | 월드맵, Zone 포털 + Museum 입구, HUD (`asset-swap`: 1310줄로 대폭 확장 — 오토타일 지형·카메라·건물 스프라이트 렌더링 + 역할 기반 마을 오브젝트 배치 포함, 12장 참고) |
| `components/ZoneMap.js` (`main` 1291줄 / `asset-swap` 2305줄, 최대 파일) | 블록 격자 계산, 소리 아이템 스폰, 충돌, 잠금 연출 (`asset-swap`: Lab 존 전용 가구/포스터 오브젝트 타입, Animal 존 길 렌더링, Nature 존 전면 재구현(`buildNatureZone`) 추가, 12.5·12.6절 참고) |
| `components/AnnotationPanel.js` | Stage 1 표현/자신감 제출 |
| `components/SoundMuseum.js` (614줄, 신규) | Stage 2 성격의 투표 룸, Zone별 테마/NPC |
| `components/FeedbackPanel.js` | 완료 토스트 |
| `components/GameEngine.js` | 공용 상수(`TILE`,`SPEED`), `ZONE_META`, `useKeys`, `overlaps` |
| `components/AssetRegistry.js` | 에셋 경로/스프라이트 좌표 중앙 관리, `ASSET_READY` 플래그로 없으면 SVG 폴백. `main`은 Kenney 타일 위주로 간단. `asset-swap`은 467줄로 대폭 확장 — `WORLD_TILESET`(오토타일 지형), `WORLD_BUILDINGS`(Zone별 실제 건물 스프라이트, Museum 포함), `WORLD_CHARACTER`(레이어드 캐릭터 8프레임 걷기), `LAB_DECOR`(Lab 존 포스터/가구), `WORLD_SLIMES`(장식용 슬라임), `ANIMAL_ZONE_TILESET`, `NATURE_VILLAGE_TILESET`(자연 마을 집 5채·울타리·연못·다리·벤치) 등 |
| `lib/autotile.js` (신규, `asset-swap`) | 4비트 블롭 오토타일 — N/E/S/W 이웃 비트마스크 → `{shape, rotate}` 변환. WorldMap 지형(길/물) 렌더링에 사용 |
| `components/VillageScene.js` | 카드형 Zone 선택 UI — 여전히 미사용 |
| `lib/audioManager.js` | Howler 재생/일시정지/재생 진행률/청취 시간 추적 |
| `lib/supabase.js` | annotations/votes 저장, 후보 조회, 블록/집계 쿼리, 구·신 sound_id 브리지. `main`에서 `getCountsByZone`/`getAnnotationCountsBySoundId` 단일 배치 쿼리로 리팩터(11장 참고) |
| `lib/studyAccess.mjs` | 연구용 전체 접근 참여자 ID 판별 |
| `lib/studyAccess.test.mjs` | 위 모듈에 대한 `node:test` 단위 테스트 |

---

## 8. Supabase 데이터 계약

### `annotations` (Stage 1)
`participant_id, session_id(=groupId), sound_id, zone, sub_category, expression_text, selected_features, confidence(1~5), difficulty, play_count, listening_time_sec, is_skipped, skip_reason, device_info, stage, is_verified, vote_count, version`

### `votes` (Museum 투표)
`participant_id, session_id, sound_id, zone, annotation_id, confidence, play_count, listening_time_sec, stage, version, created_at`
- 투표 insert 후 `increment_vote_count` RPC를 후보마다 순차 호출 — 여전히 단일 트랜잭션이 아니며 실패해도 사용자에게 노출되지 않음(기존 리스크 유지).

### 주요 쿼리 함수 (`lib/supabase.js`)
- `getCandidateExpressions`: sound_id 신구 포맷 variant 전체로 조회, 최대 5개, 무작위 셔플(편향 방지 목적으로 인기순 정렬 제거).
- `getAnnotationCountForSound`, `getAnnotatedSoundIds`, `getVotedSoundIdsByParticipant`: Museum 후보 필터링용.
- `getAnnotatedByParticipantZone`: 블록 퀘스트 진행도 계산용 — `is_skipped=false`만 완료로 인정.
- `getCountByZone`, `getTotalCount`: 참여자 기준 집계.

---

## 9. 최근 변경 이력 (git log, 최신순 일부)

### `main` (배포 브랜치)

| 커밋 | 내용 |
|---|---|
| `79adf70` | Sound Museum 입장에 로딩 인디케이터 추가 — 실제로는 빨랐지만 피드백이 없어 느리게 느껴지던 문제 |
| `fb2fb1c` | **실제 실험 참여자 장애 대응**: Supabase 커넥션 풀 고갈로 ENTER가 안 먹히던 버그 수정 — `refreshCounts`의 7-way 병렬 요청과 `handleEnterMuseum`의 후보별 순차 N+1 요청을 각각 단일/배치 쿼리로 통합 |
| `fabc721` | `ALLAUDIO_A`/`ALLAUDIO_B` 아이템 배치를 실제 그룹 참여자와 일치시킴 (블록 배치 RNG 시드가 정확한 sound_id 목록에 의존) |
| `a1dc1d1` | 시작 화면에서 연구용 접근 ID 노출하지 않도록 변경 |
| `c3148a7` | 다중 ID 연구용 접근 모드 추가, 원격 RESEARCHER 우회 로직과 병합 |
| `8ed1aaa` | 블록 퀘스트를 block_size=15로 재구성(Zone/그룹당 6블록 유지) |
| `4e087ee` | 사운드 데이터셋 그룹당 절반으로 축소(1000 → 500, 가장 조용한 클립 제거) |
| `e2e912b` | 전사 패널에서 ESC가 월드맵까지 한번에 나가버리던 버그 수정 |
| `7c8dbde` | `RESEARCHER` 참여자 ID로 그룹/Zone/블록 잠금 전체 우회(연구용) |
| `8180034` | 참여자 ID placeholder를 P01~P05/Q01~Q05 스킴으로 갱신 |
| `ca1f1ef` | 모바일 Zone 진입 버그 수정, 참여자 ID 정규화, "먼저 듣기" 필수화 |

> `4e087ee`로 사운드 개수가 그룹당 1,000개(총 2,000개) → 그룹당 500개(총 1,000개)로 축소됨 — 4장 표에 반영 완료.

### `asset-swap` (WIP, 미push — 상세는 12장)

| 커밋 | 내용 |
|---|---|
| *(미커밋 WIP)* | 동물 마을(Animal) 길 노이즈·끊김 버그 수정 + 직선 경로 전환, 자연 마을(Nature) 존 전면 재구현(집 5채·울타리·연못+다리·장식) — 12.5·12.6절 |
| `ca5d129` | WorldMap 오브젝트를 무작위 스캐터 대신 역할 기반 마을 레이아웃으로 재구성 |
| `569a123` | PROJECT_SUMMARY.md 갱신(main 최신 수정사항 + asset-swap 개편 반영) |
| `c4ff259` | 미지의 소리 마을(Lab) 포털 주변에 슬라임 장식 9색 추가 |
| `ecbb024` | Lab 존을 소품 흩뿌리기 대신 벽/가구가 있는 실제 방 구조로 재구성 |
| `1d69de4` | Lab 존을 할로윈풍 코지 인테리어 에셋(포스터/호박/박쥐)으로 장식 |
| `3d55749` | 캐릭터 걷기 애니메이션을 8프레임 전체 재생으로 수정(기존엔 2프레임만 번갈아 씀) |
| `81fc6f1` | Sound Museum 실제 건물 스프라이트 적용, 동물의 숲류 코지 레이아웃(비대칭 배치·곡선 길·유기적 연못) |
| `f63d17d` | 맵 2배 확장 + 플레이어 추적 카메라, 잔디 색상 얼룩으로 자연스러운 초원 질감 |
| `07c8b3e` | WorldMap에 실제 오토타일 지형·존별 테마 장식·포털 건물·레이어드 캐릭터 적용(구매 에셋 첫 도입) |

---

## 10. 알려진 리스크 / 미해결 사항 (구 문서 대비 최신화)

| 리스크 | 상태 |
|---|---|
| 실제 오디오 파일(`public/audio/...`) 부재 | **여전히 미해결** |
| Supabase 스키마/RPC(`increment_vote_count`) SQL이 저장소에 없음 | 여전히 미해결(`scripts/migrate_sound_id_format.sql`만 존재) |
| 투표 insert와 vote_count 증가가 비원자적, RPC 실패 미검사 | 여전히 미해결 |
| `VillageScene.js` 미사용 컴포넌트 | 여전히 방치 |
| 자동 테스트 부재 | **부분 개선** — `lib/studyAccess.test.mjs` 신설(Node 내장 test runner), 그러나 핵심 흐름(Zone/블록/Museum) 커버리지는 없음 |
| 참여자/세션 검증 없음 | **부분 개선** — 참여자 ID 대문자 정규화 추가, 그러나 형식 검증은 여전히 없음 |
| 개인/전역 진행도 혼재 | **개선됨** — 블록 퀘스트와 카운트 모두 `participantId` 기준으로 조회하도록 변경 |
| ESLint 오류 10건(2026-06-05 시점) | 재검증 필요 — `asset-swap`에서는 `WorldMap.js`(`Date.now()` impure-render 2건) / `ZoneMap.js`(ref-during-render 13건) 등 `react-hooks` 규칙 위반이 확인됨. 전부 `main`에도 이미 있던 기존 코드 패턴이며 이번 비주얼 작업으로 새로 생긴 건 아님(각 커밋 시점에 `git stash` 비교로 확인) — 그러나 수정은 아직 안 됨 |
| `asset-swap`이 `main`에 없는 프로덕션 수정 2건을 못 받고 있음 | **신규** — `main`은 `fabc721` 이후 `fb2fb1c`(커넥션 풀 고갈 수정)·`79adf70`(Museum 로딩 인디케이터)가 추가됐지만 `asset-swap`은 `fabc721`에서 분기한 뒤 그대로라 이 두 수정이 없음. `asset-swap`을 `main`에 합칠 계획이면 rebase나 merge로 반드시 반영해야 함 |
| anon 키만으로 `participant_currency.balance`를 임의 조작 가능(화폐 시스템, 신규) | **신규, 기존 패턴 계승** — 브라우저에 노출되는 건 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 하나뿐이고 서버 측 검증 계층이 없어서, 이 키로 `increment_currency_balance` RPC나 `currency_transactions` insert를 직접 호출하면 서버 로직(`calculateReward` 고정값 5/2)을 거치지 않고 임의 금액을 자기 잔액에 얹을 수 있다. 새로 만든 문제가 아니라 **`annotations`/`votes`가 이미 처음부터 이 구조**였다는 걸 실측으로 확인함(anon 키 SELECT count가 service_role과 완전히 동일, `increment_vote_count`도 anon이 별도 GRANT 없이 EXECUTE 가능 — `scripts/currency_schema.sql` 상단 주석 참고) — 즉 참여자가 마음만 먹으면 지금도 자기 annotation을 무한정 위조 제출하거나 `vote_count`를 직접 올릴 수 있는 것과 동일한 신뢰 모델. `currency_transactions`에 `UNIQUE(participant_id, related_id, type)` 제약을 걸어 "같은 소리/투표에 대한 중복 지급"만은 DB 레벨에서 막아뒀지만, 애초에 존재하지 않는 `related_id`로 여러 번 호출하는 것 자체는 못 막는다. 근본 해결은 지급 판단을 서버(Edge Function 등)로 옮기고 클라이언트는 결과만 받는 구조가 필요하지만, 지금 화폐 시스템은 UI 이전 데이터 계층 단계라 범위 밖 — 참여자 실험 데이터 자체의 신뢰도가 이미 같은 전제 위에 있다는 점만 명시해둠 |
| `asset-swap`이 로컬에만 있고 원격에 push되지 않음 | **신규** — 사용자 확인 없이 push하지 않는 게 지금까지의 작업 방침. 머지 전 원본 구매 에셋 폴더(`full version/`, `town full/`, `interior full/`, `nature full/`, `fishing_full/`, `winter full/`)가 `.gitignore`에 걸려있는지, `public/assets/`에 복사된 파일만 커밋됐는지 재확인 필요 |

---

## 11. 참고 문서

- `docs/notion/00~07-*.md`: 2026-06-05 시점 상세 아키텍처/UX/데이터 계약 문서(Zone 명칭 등 일부 항목은 이 요약으로 대체됨).
- `scripts/`: 데이터셋 구축용 Python/SQL/Node 스크립트 모음(FSD50K 필터링, 블록 배정, 그룹 밸런싱, 테스트 데이터 정리 등).

---

## 12. `asset-swap` 브랜치 — WorldMap/ZoneMap 비주얼 전면 개편

> 게임플레이·데이터·Supabase 로직은 전혀 건드리지 않음. `WorldMap.js`/`ZoneMap.js`/`AssetRegistry.js`의 **렌더링만** 손그린 SVG에서 구매한 픽셀아트 에셋 기반으로 교체하는 작업. `main`에 없는 내용이며, 아직 push되지 않은 로컬 WIP.

### 12.1 배경

사용자가 itch.io에서 shubibubi 제작 "All Things Cozy" 번들(팩 7개: Farm/Town/Interior/Nature/Fishing/Winter + Character v.2)을 구매해 저장소 루트에 압축 해제해 둔 상태(`full version/`, `town full/`, `interior full/`, `nature full/`, `fishing_full/`, `winter full/`, `Character v.2/` — 전부 `.gitignore` 처리, 수천 개 원본 파일이 실수로 커밋되는 걸 방지). 필요한 스프라이트만 골라 `public/assets/`로 복사하고, 좌표를 픽셀 단위로 측정해 `AssetRegistry.js`에 등록하는 방식으로 진행.

**좌표 측정 방법**: 대부분의 시트가 라벨 없는 스프라이트시트라, ImageMagick/Python(PIL, numpy, scipy)로 알파 채널 스캔 → 연속된 불투명 영역(run)의 시작/끝 좌표를 찾아 각 스프라이트의 정확한 `x,y,w,h`를 계산했다. 육안 어림짐작은 반복적으로 틀렸음(예: 균일 그리드로 착각하고 20px 간격을 가정했다가 실제론 16px 간격이라 다른 이미지를 잘라내는 사고가 여러 번 있었음) — 항상 알파 스캔으로 재검증.

### 12.2 WorldMap — 지형/카메라/캐릭터

- **오토타일 지형** (`lib/autotile.js` + `AssetRegistry.WORLD_TILESET`): 4비트 블롭 오토타일(N/E/S/W 이웃 비트마스크 → shape+rotate)로 길(dirt)과 연못(water)의 잔디 경계를 자연스럽게 처리. 연못은 사각형이 아니라 노이즈로 가장자리를 깎은 유기적 blob 모양(`organicBlob()`).
- **잔디 배경**: 구매한 시트의 "잔디" 조각이 전부 독립된 덤불(hedge) 블롭이라 그대로 반복 타일링하면 격자무늬가 드러나(흙처럼 보임) — 대신 단색 바탕 + 결정론적 의사난수로 배치한 부드러운 색 얼룩(`GRASS_BLOTCHES`)으로 자연스러운 초원 질감을 냄.
- **맵 2배 확장 + 추적 카메라**: 타일 그리드를 60×45 → 120×90으로 확장하되, 화면엔 전체 맵을 욱여넣는 대신 플레이어를 따라다니는 고정 크기 뷰포트(30×22타일)만 보여줌 — 건물/장식이 화면에서 실제로 크게 보이면서 탐험할 넓은 공간도 확보.
- **포털 배치**: Museum 중심 정육각형에서 각 포털에 소폭 지터(jitter)를 줘 완벽 대칭을 깨고, Museum↔포털 경로도 직각 L자 대신 3구간 곡선(S자)으로 — 동물의 숲류 코지 게임의 손으로 배치한 듯한 비대칭 느낌을 참고.
- **포털 건물**: `WORLD_BUILDINGS`에 Zone별 실제 건물 스프라이트 좌표 등록 — Human/Animal은 Farm 팩, Urban="Pub"/Music="Arcade!"/Lab="Public Library"는 Town 팩, Nature="Fish Shop"은 Fishing 팩에서 테마에 맞게 선정. Sound Museum도 Town 팩의 원형 로톤다(액자 전시물이 창문으로 보이는 건물)로 교체 — 기존엔 SVG로 손그린 사각 건물이었음.
- **캐릭터**: `Character v.2` 팩의 레이어드 캐릭터(몸/옷/머리 3장을 같은 32×32 격자에 겹쳐 그림). `info.txt`에 문서화된 "WALK FR:100, 8열 전체가 한 걸음 주기"를 따라 8프레임을 100ms 간격으로 순서 재생 — 이전엔 2프레임(0번/4번, 둘 다 거의 대기 자세)만 번갈아 써서 걷는 게 아니라 제자리 씰룩임처럼 보였음.
- **슬라임 장식**: Farm 팩 `enemies/slime */slime_*.png`(색상별 개별 시트, walk/attack/die 애니메이션 포함)에서 대기 프레임만 잘라 `WORLD_SLIMES` 9색(rainbow 포함) 등록, Lab 포털 주변에 소량 배치.

### 12.3 ZoneMap — Lab 존("미지의 소리 마을") 룸 인테리어

다른 5개 Zone은 여전히 손그린 SVG(`ZONE_THEME`/`buildZoneObjects`) 그대로. Lab만 사용자가 준 할로윈풍 코지 인테리어 레퍼런스 사진을 따라 재작업:

- **1차 시도(반려됨)**: 포스터/호박/박쥐 스프라이트를 빈 들판에 흩뿌리는 방식 → 사용자 피드백 "여전히 소품만 떠있는 빈 들판 같다, 진짜 방처럼 가구 배치해서 꾸며달라, 게임 인테리어 디자인 패턴 웹서치해서 참고해라".
- **2차(현재)**: 웹서치로 확인한 원칙(가구는 벽에 등을 붙여 배치, 용도별로 그룹핑, 러그로 영역 구분)을 적용해 재구성:
  - 맵 테두리에 두꺼운 벽돌색 벽 띠(기존엔 6px 얇은 선)를 두르고 입구는 문처럼 뚫어둠. 바닥도 마법사풍 보라색 대신 원목 톤으로.
  - 네 모서리에 실제 가구 세트: TV+러그(미디어 코너), 옷장 2개+러그(서재 코너), 테이블+의자 2개+러그(식탁 코너), 옷장+러그(창고 코너) — 각 코너 위 벽엔 그 코너에 맞는 액자(ALIEN/BAT/해골/유령/악마 포스터)를 걺.
  - 호박·박쥐는 전체 스캐터 대신 입구 앞/천장 부근에 소량만 의도적으로 배치.
- 신규 스프라이트(포스터 5종, 호박, 박쥐, 옷장, 테이블, 의자, TV, 러그)는 `interior full/furniture/{decorations,storage,tables,chairs}.png`, `interior full/basics/rugs.png`에서 알파 스캔으로 좌표를 재서 `AssetRegistry.LAB_DECOR`에 등록, `public/assets/lab/`에 원본 시트 복사.

### 12.4 검증 방식

전용 CLI 도구가 없어 매 변경마다 `/tmp/node_modules`에 설치한 `playwright-core`로 헤드리스 Chrome을 띄워 실제 화면을 스크린샷 찍어 확인(연구용 접근 ID `RESEARCHER`로 잠금 우회 후 각 포털/코너까지 걸어가며 촬영). 매번 `console`/`pageerror` 리스너로 런타임 에러 0건 확인, ESLint는 `git stash` 전후 비교로 새로 생긴 에러가 없는지 검증 후 커밋.

### 12.5 ZoneMap — 동물 마을(Animal) 길 렌더링 버그 수정

Lab 존 작업 이후, Animal 존의 길(path) 렌더링에서 두 가지 버그를 잡음(둘 다 커밋 전 워킹 트리 상태):

- **길 위에 노이즈처럼 보이는 초록 반점**: 장식물 스캐터 로직이 길 타일 위에도 그대로 나무/덤불을 배치하고 있었음 — 길 판정 영역을 장식물 배치 후보에서 제외하도록 수정.
- **길이 중간중간 끊겨 보이는 문제**: `organicSegment`/`jointSquare` 헬퍼가 곡선 방향(winding direction)에 따라 SVG `fill-rule: nonzero` 하에서 일부 구간의 폴리곤이 반대 방향으로 감겨 면적이 상쇄되는 버그 — 이후 사용자가 "직선/그리드형 길로 바꿔달라"고 요청해 유기적 곡선 자체를 직선 구간(격자 정렬) 조합으로 바꾸며 근본적으로 해결. 이 직선 경로 방식은 이후 12.6절의 자연 마을 길에도 그대로 재사용됨.

### 12.6 ZoneMap — 자연 마을(Nature) 존 전면 교체

기존에 이미 배포되어 있던(=`main`에도 존재하는) Nature 존은 손그린 SVG 연못/바위/부두/갈대 등을 무작위로 흩뿌린 형태였다. 이를 12.5절의 Animal 존과 동일한 아키텍처 패턴(`buildAnimalZone()`에 대응하는 `buildNatureZone()`, `buildZoneObjects()`/`ZoneObject()` 렌더 트리에 훅)으로 완전히 새로 구성했다.

**필수 제약 — 반드시 지켜짐**: 소리 수집 로직(`spawnSoundItems`, `SOUND_ITEMS.Nature`, 참여자 진행도/블록 잠금 등)은 이 작업의 목적이 애초에 데이터 어노테이션이므로 **한 글자도 건드리지 않음**. 새로 추가된 집/울타리/연못/장식 타일은 `spawnSoundItems`에서 `isNearNaturePath`/`insideAnyNatureYard` 체크로 스폰 후보에서만 배제되며, 그 외 스폰·잠금·집계 로직은 기존 Nature 존과 100% 동일하게 동작.

- **집 5채**: 기본형(cream, `buildings.png`), 어두운목재+해문양(dark), 초록지붕(green) — 이상 Cozy Farm 팩. 벽돌/빅토리안(victorian, Cozy Farm), 오두막+말굽문장(cabin, `town_buildings.png`) — Cozy Town 팩. 각 집은 게이트 1면 + 완전 개방 1면 + 나머지 2면 울타리로 마당을 두르며(`NATURE_YARD=3` 타일 여백), 좌표는 `NATURE_HOUSES`에 정의.
- **길**: 12.5절과 동일한 직선/격자형 경로(`NATURE_PATH_SEGMENTS`) — 입구에서 뻗는 세로 간선 + 각 집으로 갈라지는 가지 길.
- **연못 + 다리**: 타원형 연못을 Cozy Farm `waterFull` 타일로 완전히 채우고(가장자리에 대신 바위 밀도를 높여 "돌 둔치" 느낌), 다리 하부는 Cozy Town 연못 타일로 채워 난간 스프라이트의 투명 영역 사이로 물이 비치도록 처리.
- **장식**: 나무/덤불/꽃/버섯/바위/곤충/나비를 100 Nature Things(`nature.png`) + Cozy Farm/Town 타일 조합으로 스캐터, 벤치 2개.
- **마당 간격 셀프체크**: `buildNatureZone()` 내부에 하우스 5채의 모든 마당 쌍에 대해 간격을 계산하는 자기 검증 로직이 있어 콘솔에 `[NatureZone 셀프체크] 집 5채, 나무 243그루 → PASS (마당 간격 전부 5타일 이상)` 형태로 통과 여부를 출력.

**버그 수정 이력**:
| 버그 | 원인 | 수정 |
|---|---|---|
| 집 이미지가 잔디/울타리 조각처럼 깨져 보임 | `buildings.png`(건물 시트) 대신 `terrain.png`(지형 시트)에서 잘못 크롭 | 정확한 소스 파일로 재크롭, 육안 검증 후 진행 |
| 기본형 집이 옆 헛간 건물을 침범해서 잘려 보임 | 크롭 영역이 인접 건물까지 포함(85×153) | 알파 채널 행 분석으로 실제 집 높이(72px) 확인 후 58×72로 축소 |
| 집들끼리 마당 간격이 너무 좁음(캐빈↔빅토리안 0~1타일) | 초기 배치가 48×36 맵 안에서 5채를 욱여넣음 | 맵 크기는 48×36 유지하기로 사용자가 결정, 모든 마당 쌍 간격 ≥5타일을 보장하는 재배치로 좌표 전면 수정 |
| 연못 안에 흙이 비쳐 보임 | 가장자리 타일이 사각 대각선 경계용이라 타원 경계에 안 맞음 | 연못 전체를 `water.full`로 채우고 가장자리 바위 밀도만 0.35→0.7로 올림 |
| 다리 밑에 깨진 초록 영역 | 목제 난간 스프라이트가 대부분 투명한데, 다리 밑 물 레이어를 비워서 투명 영역으로 잔디가 그대로 비쳤음 | 다리 밑은 절대 비우지 않고 Cozy Town 연못 타일로 항상 채움 |
| 나무/덤불 밀도가 원래 목업보다 훨씬 옅음 | 스캐터 루프의 샘플링 step이 2였는데, Python 설계(16px 타일·32×32 나무=2×2타일) 기준을 32px 타일(나무=1×1타일) JS로 그대로 옮겨 실제 후보 위치의 1/4만 샘플링됨 | step을 2→1로 수정, 나무 개수 68→243그루로 정상화(확률값 자체는 그대로 유지) |

**검증**: 12.4절과 동일한 headless Chrome 스크린샷 방식 + 연구용 접근 ID로 잠금 우회, 자기 검증 콘솔 로그, 기존 소리 수집 게임플레이(아이템 스폰/진행바/블록 언락)가 새 비주얼과 함께 정상 동작하는지 확인. 별도 배치 스키매틱(SVG 좌표 시각화)도 만들어 실제 좌표와 항상 동기화 상태로 유지.
