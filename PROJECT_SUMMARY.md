# SoundMimic Village — 프로젝트 요약

> 소리를 탐험하고, 의성어로 표현하고, 다른 참여자의 표현에 공감 투표하는 웹 기반 사운드 어노테이션 연구용 게임.
> 요약 작성 기준: 2026-07-12 (작업 브랜치 `main`, 커밋 `8180034` + 워킹 트리 변경분 반영)

`docs/notion/` 아래 2026-06-05 기준 상세 문서 7편이 있으나, 이후 커밋 15개(Sound Museum, 블록 퀘스트, 그룹 A/B, 마을 잠금, 연구용 접근 ID 등)로 Zone 체계와 흐름이 크게 바뀌었다. 이 문서는 **현재 코드 기준**으로 다시 정리한 것이다.

---

## 1. 한눈에 보기

- **참여자 ID + 그룹 ID(A/B)**를 입력하고 픽셀 아트 월드맵에 입장한다.
- 처음엔 **Music 마을만 열려 있고**, Music 구역 1을 전사 완료해야 나머지 5개 마을이 열린다.
- 마을 안에서는 **블록(구역) 단위 퀘스트**로 소리 아이템이 순차 공개된다 — 한 블록을 다 채우면 다음 블록이 열린다.
- 소리를 수집하면 **AnnotationPanel**(Stage 1)이 열려 의성어 표현 + 자신감(현재는 슬라이더)을 제출한다.
- Stage 1 제출 후에는 ZoneMap이 아니라 **Sound Museum**(도서관 테마 풀스크린 룸)으로 이동해, 다른 그룹이 남긴 표현에 투표할 수도 있다.
- 월드맵에서 **Sound Museum에 직접 입장**할 수도 있으며, 이때는 자신이 속하지 않은 그룹의 소리 중 표현이 5개 이상 쌓인 것만 후보로 노출된다.
- 특별 참여자 ID(`ALLAUDIO`, `ACCESS-ALL` 등)를 입력하면 **연구용 전체 접근 모드**로 모든 마을·블록·소리에 즉시 접근한다.
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

`data/sound_metadata.json` — 총 **2,000개** 사운드, 그룹 A/B 각 1,000개로 정확히 균형 배분됨.

| Zone | 개수 |
|---|---|
| Lab | 338 |
| Human | 338 |
| Music | 333 |
| Urban | 332 |
| Animal | 330 |
| Nature | 329 |

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
- 연구용 접근 ID(`ALLAUDIO`, `ALL-AUDIO`, `STUDYALL`, `STUDY-ALL`, `ACCESSALL`, `ACCESS-ALL`, `AUDIOTEST`, `AUDIO-TEST`)를 입력하면 실시간으로 "연구용 전체 접근 모드" 안내가 표시됨(`lib/studyAccess.mjs`).

### 5.2 월드맵 (`WorldMap`)
- 방향키/WASD/모바일 D-Pad 이동, 최근 커밋에서 **모바일 Zone 진입 버그 수정** 및 **와이드 스크린 렌더링 좌측 쏠림 버그 수정** 완료.
- Zone 포털 외에 **Sound Museum 입구**가 별도로 존재(`onEnterMuseum`).
- `lockedZones` prop으로 미개방 마을을 표시 — 연구용 접근 모드이거나 `villagesUnlocked===true`면 전부 개방.

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
| `components/WorldMap.js` | 월드맵, Zone 포털 + Museum 입구, HUD |
| `components/ZoneMap.js` (1291줄, 최대 파일) | 블록 격자 계산, 소리 아이템 스폰, 충돌, 잠금 연출 |
| `components/AnnotationPanel.js` | Stage 1 표현/자신감 제출 |
| `components/SoundMuseum.js` (614줄, 신규) | Stage 2 성격의 투표 룸, Zone별 테마/NPC |
| `components/FeedbackPanel.js` | 완료 토스트 |
| `components/GameEngine.js` | 공용 상수(`TILE`,`SPEED`), `ZONE_META`, `useKeys`, `overlaps` |
| `components/AssetRegistry.js` (신규) | Kenney 에셋(PNG 타일/오브젝트) 경로 중앙 관리, 없으면 SVG 폴백 |
| `components/VillageScene.js` | 카드형 Zone 선택 UI — 여전히 미사용 |
| `lib/audioManager.js` | Howler 재생/일시정지/재생 진행률/청취 시간 추적 |
| `lib/supabase.js` | annotations/votes 저장, 후보 조회, 블록/집계 쿼리, 구·신 sound_id 브리지 |
| `lib/studyAccess.mjs` (신규) | 연구용 전체 접근 참여자 ID 판별 |
| `lib/studyAccess.test.mjs` (신규) | 위 모듈에 대한 `node:test` 단위 테스트 |

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

| 커밋 | 내용 |
|---|---|
| `8180034` | 참여자 ID placeholder를 P01~P05/Q01~Q05 스킴으로 갱신 |
| `ca1f1ef` | 모바일 Zone 진입 버그 수정, 참여자 ID 정규화, "먼저 듣기" 필수화 |
| `9289431` | Museum 후보 선택 시 동의 슬라이더로 자동 스크롤 |
| `1334a37` | Museum에서 이미 투표한 소리 제외, 자신감을 슬라이더로 전환 |
| `468699a` | 와이드 스크린에서 월드맵 좌측 쏠림 렌더링 버그 수정 |
| `95b6764` | Museum 투표 완료 후 곧장 월드맵으로 끊기지 않고 토스트 표시 |
| `880cbb7` | `participant_id` 접두 테스트 데이터 정리 스크립트 추가 |
| `25910a3` | Museum 후보 카드에서 투표 수 숨기고 정렬 기준에서 제외(편향 방지) |
| `ab2274c` | Music 첫 블록 전사 전까지 나머지 마을 잠금 |
| `0a3f1f7` | 사운드 데이터셋을 그룹당 정확히 1000개(총 2000개)로 밸런싱 |

현재 워킹 트리(미커밋)에는 `app/page.js`, `components/StartPanel.js`, `package-lock.json` 수정 및 `lib/studyAccess.mjs`/`lib/studyAccess.test.mjs` 신규 추가가 반영되어 있음 — 즉 연구용 접근 ID 기능과 그 테스트는 아직 커밋되지 않은 최신 작업이다.

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
| ESLint 오류 10건(2026-06-05 시점) | 재검증 필요(본 요약에서는 미실행) |

---

## 11. 참고 문서

- `docs/notion/00~07-*.md`: 2026-06-05 시점 상세 아키텍처/UX/데이터 계약 문서(Zone 명칭 등 일부 항목은 이 요약으로 대체됨).
- `scripts/`: 데이터셋 구축용 Python/SQL/Node 스크립트 모음(FSD50K 필터링, 블록 배정, 그룹 밸런싱, 테스트 데이터 정리 등).
