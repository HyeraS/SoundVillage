# 기술 아키텍처

## 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js `16.2.7`, App Router |
| UI | React `19.2.4`, JavaScript |
| 스타일 | 인라인 스타일, 전역 CSS, Tailwind 패키지는 설치됐지만 직접 사용하지 않음 |
| 데이터베이스 | Supabase JS `2.106.2` |
| 오디오 | Howler.js `2.2.4` |
| 렌더링 | Client Components, SVG 기반 맵 |
| 품질 도구 | ESLint 9, `eslint-config-next` |

## 런타임 구조

```text
app/layout.js
  -> app/page.js                       화면 오케스트레이션 및 세션 상태
     -> StartPanel                     참여자/세션 입력
     -> WorldMap                       Zone 선택용 탐험 맵
     -> ZoneMap                        소리 아이템 수집 맵
     -> AnnotationPanel                Stage 1/2 바텀시트
        -> lib/audioManager.js         재생 및 청취 시간
        -> lib/supabase.js             어노테이션/투표 저장 및 집계
     -> FeedbackPanel                  완료 토스트
```

## 상태 소유권

`app/page.js`가 앱 수준 상태를 소유한다.

| 상태 | 역할 | 영속성 |
|---|---|---|
| `screen` | 현재 화면 | 메모리 |
| `participantId` | 참여자 ID | 메모리 |
| `sessionId` | 세션 ID | 메모리 |
| `activeZone` | 현재 Zone | 메모리 |
| `activeSound` | 현재 어노테이션할 소리 | 메모리 |
| `collectedIds` | 현재 세션에서 처리한 소리 ID | 메모리 |
| `totalCount` | 전체 비스킵 어노테이션 수 | Supabase 조회값 |
| `zoneProgress` | Zone별 집계/10 | Supabase 조회값 |

## 화면 전환 계약

| 이벤트 | 출발 | 도착 |
|---|---|---|
| `handleStart(pid, sid)` | start | world |
| `handleEnterZone(zone)` | world | zone |
| `handleExitZone()` | zone | world |
| `handleCollectSound(sound)` | zone | annotate |
| `handleAnnotateComplete()` | annotate | zone |
| `handleAnnotateClose()` | annotate | zone |

## 게임 루프

`WorldMap`과 `ZoneMap`은 각각 `requestAnimationFrame` 루프를 가진다.

- 기준 이동 속도: `3px/frame`
- 프레임 시간 보정: `(now - lastTime) / 16.67`, 최대 3
- 타일 크기: 32px
- 충돌 판정: AABB 방식의 `overlaps`
- 카메라: 캐릭터 중심을 따라가며 맵 경계에서 clamp
- 키 상태: `useKeys` 훅의 mutable ref

ZoneMap은 실제 장식물과의 충돌을 계산하지 않는다. 캐릭터는 맵 경계 안에서 모든 장식물 위를 지나갈 수 있고, 소리 아이템과만 충돌한다.

## 데이터 흐름

```text
sound_metadata.json
  -> Zone별 소리 목록 생성
  -> ZoneMap 아이템 생성
  -> 충돌 시 activeSound 설정
  -> AnnotationPanel
     -> audioManager로 재생
     -> Supabase annotations 저장
     -> Supabase 후보 조회
     -> Supabase votes 저장 + RPC로 vote_count 증가
  -> 전체/Zone 집계 재조회
```

## 렌더링 특성

- 모든 주요 화면은 `'use client'` Client Component다.
- 데이터 조회와 저장은 브라우저에서 Supabase anon key로 직접 수행한다.
- `/`는 프로덕션 빌드에서 정적 페이지로 사전 렌더링된다.
- 월드/Zone 아트는 외부 이미지가 아니라 JSX SVG 요소로 그린다.
- Google Fonts의 Nunito를 CSS `@import`로 로드한다.

## 설계상 특징

- Zone 메타데이터가 `GameEngine`, `VillageScene`, `ZoneMap`, `AnnotationPanel` 등 여러 파일에 분산되어 있다.
- `VillageScene`은 현재 `app/page.js`에서 사용되지 않는 대체 Zone 선택 UI다.
- 에러 처리 다수가 빈 `catch` 또는 사용자에게 상세 원인을 숨기는 방식이다.
- Supabase 스키마와 RPC 정의는 저장소에 포함되어 있지 않다.

