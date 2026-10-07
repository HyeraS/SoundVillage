# SoundMimic Village — 프로젝트 요약

> 소리를 탐험하고, 의성어로 표현하고, 다른 참여자의 표현에 공감 투표하는 웹 기반 사운드 어노테이션 연구용 게임.
> 요약 작성 기준: 2026-08-05 (`main` 커밋 `79adf70` / `asset-swap` 커밋 `ca5d129` + 미커밋 WIP, 두 브랜치 상태를 함께 정리)

`docs/notion/` 아래 2026-06-05 기준 상세 문서 7편이 있으나, 이후 커밋(Sound Museum, 블록 퀘스트, 그룹 A/B, 마을 잠금, 연구용 접근 ID, 실 접속자 장애 대응, WorldMap 비주얼 전면 개편 등)으로 Zone 체계·흐름·비주얼이 크게 바뀌었다. 이 문서는 **현재 코드 기준**으로 다시 정리한 것이다.

**브랜치 상태가 세 갈래로 갈라져 있음 — 중요:**
- `main`: 실제 실험 참여자들이 접속하는 배포 브랜치. 게임플레이/백엔드 로직(1~11장 내용)은 이 브랜치 기준.
- `asset-swap`: `main`의 `fabc721`에서 분기, 아직 push/merge 전인 **로컬 전용 WIP 브랜치**. WorldMap·Lab 존을 구매한 itch.io 픽셀 에셋으로 전면 리스킨하는 작업에 더해, 현재는 **동물 마을(Animal) 길 버그 수정**과 **자연 마을(Nature) 존 전면 교체**까지 진행 중이다(12장 참고). 이 두 항목은 아직 커밋되지 않은 워킹 트리 변경사항(`app/page.js`, `components/AssetRegistry.js`, `components/WorldMap.js`, `components/ZoneMap.js`)이다. **`main`에만 있는 커밋 2개(`fb2fb1c`, `79adf70` — 접속 장애 수정, Museum 로딩 인디케이터)가 `asset-swap`에는 없으므로**, 이후 `main`에 merge하거나 `main`을 다시 베이스로 rebase할 때 반드시 반영 확인 필요.
- `house-decor-2d`: `asset-swap`의 `50ce34a`에서 분기, **별도 git worktree**(`SoundVillage-house-decor-2d/`)에서 작업 중인 브랜치. 3D 리서치 프로토타입(`codex/3d-research-prototype`)과 완전히 분리하기 위해 만들어졌으며, 집꾸미기(Cozy Room)와 실시간 동행("초대") 기능을 담고 있다(13장 참고). **이미 별도 Vercel 프로젝트(`new-soundvillage.vercel.app`, GitHub `HyeraS/new_soundvillage`)의 `main`에 push되어 배포 중** — `main`/`asset-swap`이 배포되는 원래 Vercel 프로젝트(Supabase 프로젝트 ref `nzzesrjneqsbkgtbaoxy`)와는 완전히 다른 배포·다른 Supabase 프로젝트(ref `ogjcqtfoabuxkgkpqsil`)를 쓴다 — 실제 실험 데이터와 물리적으로 분리하기 위한 의도적 선택.

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

---

## 13. `house-decor-2d` 브랜치 — 집꾸미기(Cozy Room) + 실시간 동행

> 게임플레이 핵심(Zone/블록/어노테이션/투표)은 전혀 건드리지 않음. `asset-swap`(`50ce34a`)에서 분기한 완전히 새로운 기능 두 가지 — ① 참여자별 "우리 집" 인테리어 꾸미기, ② 참여자 둘이서 월드맵/집 안을 실시간으로 함께 돌아다니는 "초대" 기능 — 를 추가한 것. 3D 리서치 프로토타입과 뒤섞이지 않도록 별도 git worktree에서 작업했고, 이미 별도 배포(`new-soundvillage.vercel.app`)까지 완료된 상태.

### 13.1 배경 및 진행 방식

`design_handoff_cozy_room/README.md` + `Cozy Room.dc.html` 고정밀 디자인 목업을 기존 2D 코드베이스 패턴(App Router, 인라인 style, `app/globals.css` 변수, `lib/supabase.js`, `lib/currency.js`)으로 그대로 재구현하는 것이 출발점이었다. README가 제시한 6단계(① 카탈로그/에셋 ② 스테이지 렌더 ③ 편집 모드 ④ 보관함 패널 ⑤ 상점/구매/보상 ⑥ 방 저장·불러오기 + 친구 방문)를 하나씩 구현하고 매 단계 Playwright 헤드리스 브라우저로 실제 클릭·이동까지 확인받은 뒤 다음 단계로 넘어가는 방식으로 진행했다. 6단계 완료 후 사용자의 실제 요구사항(친구와 "같이 게임하는" 실시간 동행)이 README 범위보다 넓다는 게 드러나 별도 5단계 계획을 다시 세워 구현했다(13.3절).

**절대 지킨 제약**: `lib/currency.js`의 기존 지급 로직과 annotation/vote 흐름은 한 줄도 안 건드림. 새 SQL은 전부 `scripts/*.sql` 파일로만 작성하고, 실행은 항상 사용자가 Supabase 대시보드에서 직접 함(에이전트가 DB에 DDL을 실행할 도구적 방법이 애초에 없음 — service role 키는 REST/RPC용이지 원본 SQL 실행용이 아니고, `supabase` CLI도 프로젝트 링크/DB 비밀번호가 없어 실행 불가).

### 13.2 집꾸미기 시스템 (Interior Decor)

| 파일 | 역할 |
|---|---|
| `lib/interiorCatalog.js` | 카탈로그 단일 출처 — 8개 카테고리(벽지/바닥재/러그/큰가구/소파·의자/소품/벽장식/펫) 40개 아이템, 3개 테마 세트, 날짜 시드 기반 "오늘의 특가"(40% 할인). `STARTER_WALLPAPER_ID`/`STARTER_FLOOR_ID`(클로버 벽지+갈색 바닥재) — 벽지·바닥재도 유료라 신규 참여자에게 방을 렌더링할 최소한의 무료 세트를 지급 |
| `components/InteriorRoom.js` | 12×5 격자 스테이지 순수 렌더 — 배치/고스트 프리뷰/편집 격자 오버레이, 방향키로 움직이는 아바타(z-index `row*10+5`로 앞뒤 깊이 정렬), 4단계(13.3절)의 상대방 아바타도 같은 좌표계에 렌더 |
| `components/InteriorDecorRoom.js` | 상태·이벤트 컨테이너 — 모드(view/edit)/보관함/상점/초대/저장 전체를 들고 있는 메인 컴포넌트. 방문 모드(`visitorMode`)에서는 읽기 전용으로 전환 |
| `lib/interiorDecor.js` | 실제 Supabase 함수 — `getRoom`/`saveRoom`/`getOwnedInteriorItems`/`purchaseInteriorItem`/`purchaseInteriorSet`. `purchaseOutfit`(기존 옷가게)과 동일한 패턴(잔액 확인 → 보유기록 insert(PK 중복=이미 보유) → 거래기록 insert → RPC 차감)을 그대로 재사용 |
| `scripts/interior_decor_schema.sql` | 신규 테이블 2개(`participant_interior_items`, `participant_room`) + `currency_transactions.type` CHECK 제약에 `'spend_interior'` 추가. 기존 테이블은 전혀 안 건드림(순수 추가) |

**실제 데이터 연동**: 처음엔 구매/저장이 클라이언트 상태로만 시뮬레이션됐으나(스키마 미실행 구간), 이후 실제 Supabase 호출로 전환 — 마운트 시 `getCurrencyBalance`/`getOwnedInteriorItems`/`getRoom`으로 실데이터를 불러오고, 스키마가 없거나 저장 이력이 없으면 에러를 삼키고 "빈 방 + 무료 시작 벽지·바닥재"로 정직하게 대체한다. 저장 실패 시 편집 모드를 빠져나가지 않도록 해서(성공한 것처럼 보이며 세션을 날리지 않게) 사용자가 재시도할 수 있게 했다.

**발견해서 고친 버그 2건**(모두 원래의 손그린 프로토타입에 잠재해 있던 것):
1. **칸 점유 충돌 검사 부재** — `placeAt`이 실제로는 겹침 여부를 전혀 검사하지 않고 있었다. 우연히 안 겹치는 것처럼 보인 건 순전히 z-index 때문(이미 놓인 소품의 스프라이트가 편집 격자보다 위에 있어 그 위를 클릭하면 배치가 아니라 "선택"으로 가로채짐) — 작은 소품이 남기는 빈틈을 클릭하면 그대로 뚫렸다. `lib/interiorCatalog.js` 주석의 "fw·fh(칸 점유)"를 실제로 쓰는 사각형 겹침 검사(`footprintOf`/`footprintsOverlap`)로 교체.
2. **소품을 든 채로 다른 소품을 클릭하면 조용히 손에서 놓침** — 위 1번 z-index 우연 때문에, 소품을 들고 있는 상태에서 이미 놓인(특히 큰) 소품의 스프라이트를 클릭하면 `selectPlaced`가 무조건 `setTool(null)`을 호출해 손에 든 걸 아무 안내 없이 잃어버렸다. 이제 손에 든 게 있을 때 기존 소품을 클릭하면 그 칸에 놓으려는 시도로 취급해 같은 충돌 검사를 태우고("이미 다른 소품이 놓여 있어요"), 들고 있던 소품은 그대로 유지.

### 13.3 실시간 동행("초대") — `lib/duoSession.js`

원래 계획한 5단계를 순서대로 구현·검증했다.

| 단계 | 내용 |
|---|---|
| 1. Realtime 배관 | Supabase Realtime Presence(접속 여부)+Broadcast(위치)를 합친 `useDuoSession(hostId, selfId)` 훅. 채널명은 `duo:<hostId>` 하나뿐이라 초대한 사람과 링크로 들어온 사람 딱 둘만 만난다(오픈월드 아님). 소켓이 `SUBSCRIBED`되기 전 `sendPosition`을 부르면 supabase-js가 REST 폴백으로 느려지는 문제를 `joinedRef`로 막음 |
| 2. 월드맵에서 서로 보이기 | `WorldMap.js`가 이 훅으로 자기 위치를 매 프레임 broadcast하고(`screen:'worldmap'`), 상대 아바타+이름표를 겹쳐 그림. `?duo=<호스트ID>` 쿼리로 짝을 정함(없으면 자기 자신을 호스트로 써서 대기) |
| 3. 초대 흐름 | `probeHost(hostId)` — 링크를 연 사람이 호스트가 "지금 온라인인지 + 어느 화면(screen)에 있는지"를 짧게 엿보는 일회성 프로브. 호스트가 정확히 월드맵에 있으면 `/?duo=`로 리다이렉트해서 같이 돌아다니게 하고, 아니면(집 안/오프라인) 기존처럼 저장된 방을 보여줌 |
| 4. 집 안까지 확장 | `InteriorDecorRoom`도 같은 훅으로 duo 채널에 참여(주인은 자기 자신과 자동 pairing, 방문객은 방문 세션 한정 임시 id 또는 실제 로그인 ID). 서로의 아바타가 방 안에서도 실시간으로 같이 움직임 — 단, 가구 배치 변화 자체의 실시간 방송은 범위 밖으로 명시적으로 제외(사용자 선택) |
| 5. 예외 처리 | presence만으로는 "탭을 깨끗이 닫은 경우"만 빠르게 감지되고, 와이파이 끊김·절전 같은 지저분한 연결 끊김은 한참 방치된다 — 4초 유효기간 워치독(`STALE_MS`)을 추가해 마지막 위치 수신 후 4초가 지나면 자동으로 상대 아바타를 정리. 재연결은 Supabase 클라이언트가 알아서 처리(별도 코드 불필요) |

**방문객도 실제 참여자로 로그인**: 처음엔 방문객이 참여자ID 없이 익명으로 바로 방에 들어가게 했으나, 사용자 요청으로 다른 진입 경로와 동일하게 StartPanel(참여자ID+그룹)을 먼저 거치도록 변경 — 방 주인 쪽에서 보이는 방문객 이름표도 이제 실제 입력한 참여자ID를 그대로 씀.

**호스트를 따라 화면 이동(비대칭)**: 방문객이 집 안에서 호스트를 만난 뒤 호스트가 나가서 월드맵으로 이동하면, 방문객도 재로그인 없이 자동으로 같은 월드맵으로 따라간다(`onPartnerLeftScreen` 콜백 → `app/page.js`가 `WorldMap`에 `duoHostId` prop을 직접 넘겨 URL 새로고침 없이 페어링 유지). 반대 방향(방문객이 나가는 경우)에는 이 로직을 아예 안 넣었으므로 호스트는 전혀 영향받지 않는다 — 실제로 정상 종료/비정상 탭 종료 둘 다로 라이브 검증함.

### 13.4 프로덕션 스왑

`app/page.js`의 `screen==='house'`가 예전 `HouseDecorRoom.js`(자체 테이블 `participant_house_items`/`participant_house_layout` 사용) 대신 `InteriorDecorRoom`을 렌더링하도록 교체. 예전 파일들(`components/HouseDecorRoom.js`, `lib/houseDecor.js`, `lib/houseCatalog.js`, `scripts/house_decor_schema.sql`)은 더 이상 화면에서 안 쓰이지만 삭제하지 않고 남겨둠. 스왑하면서 예전에 있던 "나가기" 버튼/ESC 나가기가 새 컴포넌트엔 없어서 추가(편집 중이 아닐 때만 ESC가 나가기로 동작 — 실수로 안 나가지게).

**발견해서 고친 버그**: 초대 링크가 이제 앱 루트(`/`)에서 열리게 됐는데, `app/page.js`엔 `?house=` 쿼리를 읽는 로직이 아예 없어서 **초대 기능이 스왑 직후 완전히 죽어 있었다**. `app/interior-test/page.js`(검증용 라우트)에 있던 로직을 실제 앱에 이식해서 해결.

### 13.5 배포 상태 (2026-08-24 기준)

- `new-soundvillage.vercel.app`(GitHub `HyeraS/new_soundvillage`, Vercel 프로젝트 `new-soundvillage`)의 `main`이 이 브랜치를 추적하며 자동 배포됨. `house-decor-2d` → `preview` remote(`new_soundvillage.git`)의 `main`으로 직접 push.
- **Supabase 프로젝트를 의도적으로 분리**: 기존 배포가 쓰던 프로젝트(ref `nzzesrjneqsbkgtbaoxy`, 실제 실험 데이터 보유)는 전혀 건드리지 않고, Vercel 환경변수(`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`)를 새 프로젝트(ref `ogjcqtfoabuxkgkpqsil`)로 교체 후 재배포. 이 새 프로젝트엔 기존 스키마(annotations/votes/currency/quest/attendance) 전체가 이미 새로 구성돼 있었고, 여기에 `interior_decor_schema.sql`만 추가 실행.
- 개발/QA 과정에서 이 새 프로젝트에 쌓인 테스트 참여자 데이터(TESTA/TESTB/QAFULLTEST01~08 등 수십 개 스크래치 ID)는 실제 참여자 유입 전 전부 정리(`DELETE FROM` — 퀘스트/출석 보상 템플릿 등 설정 테이블은 보존).
- 로컬 `.env.local`을 바꿔도 배포엔 전혀 반영되지 않는다는 점(Vercel은 대시보드에 별도 저장된 환경변수를 씀)이 이번 배포 과정에서 혼선을 일으켰던 지점 — 기록해둠.

### 13.6 알려진 한계 / 다음 단계

| 항목 | 상태 |
|---|---|
| 가구 배치 변화 실시간 동기화 | **범위 밖(사용자 확정)** — 지금은 아바타 위치만 실시간, 방문 중 호스트가 가구를 옮겨도 방문객 화면엔 반영 안 됨(스냅샷은 재방문 시에만 갱신) |
| 초대 게이팅이 개수만 봄(가구 4개 이상이면 무조건 활성화) | 미해결 — 품질과 무관하게 개수만 검사 |
| 세트 구매 시 이미 보유한 아이템 할인 없음 | 미해결 |
| 상점 구매 확인 단계 없음(가격 버튼 즉시 결제) | 미해결 |
| 다중 방문객(3인 이상) 동시 접속 | 미검증 — 설계 자체가 1:1 전제(presence에서 "나 아닌 첫 번째 키"만 상대로 취급) |
| `nzzesrjneqsbkgtbaoxy` 쪽 예전 house-decor 코드/테이블 | 정리 안 됨 — 코드는 안 쓰이지만 파일/테이블 그대로 존재 |
