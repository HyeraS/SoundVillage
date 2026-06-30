# 컴포넌트 및 파일 사전

## 앱 파일

| 파일 | 역할 |
|---|---|
| `app/layout.js` | 한국어 루트 레이아웃, 제목과 설명 메타데이터 |
| `app/page.js` | 전체 화면 상태, Zone 소리 매핑, Supabase 집계, 컴포넌트 연결 |
| `app/globals.css` | Nunito 로드, 전역 리셋, 색상 변수, 애니메이션 |

## 컴포넌트

| 파일 | 공개 역할 | 주요 내부 요소 |
|---|---|---|
| `components/StartPanel.js` | 참여자/세션 입력 | 입력 검증, 시작 버튼 |
| `components/WorldMap.js` | 5개 Zone을 탐험하는 월드맵 | 포털, HUD, 목표 패널, D-Pad |
| `components/ZoneMap.js` | Zone 내부 소리 수집 | Zone 오브젝트, 소리 아이템, 완료 모달 |
| `components/AnnotationPanel.js` | 어노테이션 및 투표 바텀시트 | 오디오 훅, Stage1, Stage2 |
| `components/FeedbackPanel.js` | 완료 토스트 | 2.2초 자동 종료 진행바 |
| `components/GameEngine.js` | 공용 게임 상수와 유틸 | `TILE`, `SPEED`, `ZONE_META`, `useKeys`, `overlaps` |
| `components/VillageScene.js` | 카드형 Zone 선택 화면 | 현재 미사용 |

## 라이브러리

| 파일 | 역할 | 공개 함수 |
|---|---|---|
| `lib/audioManager.js` | 단일 오디오 재생과 청취 시간 추적 | `playSound`, `stopSound`, `getListeningTime`, `resetListeningTime`, `resetAudio`, `isPlaying`, `getPlaybackProgress`, `unlockAudio` |
| `lib/supabase.js` | Supabase 브라우저 클라이언트와 쿼리 | `saveAnnotation`, `saveVote`, `getCandidateExpressions`, `getCountByZone`, `getTotalCount` |

## 데이터와 설정

| 파일 | 역할 |
|---|---|
| `data/sound_metadata.json` | 앱이 배치할 사운드 카탈로그 |
| `.env.local` | Supabase URL과 anon key, Git 제외 |
| `package.json` | 실행 스크립트와 의존성 |
| `next.config.mjs` | 현재 활성 설정 없는 Next.js 설정 |
| `jsconfig.json` | `@/*`를 프로젝트 루트에 매핑 |
| `eslint.config.mjs` | Next.js Core Web Vitals ESLint 구성 |
| `postcss.config.mjs` | Tailwind PostCSS 플러그인 |

## 정적 파일

`public/`에는 create-next-app 기본 SVG만 있다. 앱 메타데이터가 요구하는 `public/audio/...` 사운드 파일은 현재 없다.

## 현재 사운드 카탈로그

| `sound_id` | Zone | 파일 경로 | 원본 데이터셋 | 원본 파일명 |
|---|---|---|---|---|
| `Forest_001` | Forest | `Audio/Forest/forest_bird_01` | FSD50K | `64760` |
| `Water_001` | Water | `Audio/Water/water_stream_01` | FSD50K | `12345` |

현재 City, Music, Mystery에는 메타데이터 항목이 없어 ZoneMap에서 소리 아이템이 생성되지 않는다.

## 저장소 바깥쪽 중복 파일

`soundmimic-village/`의 상위 폴더에는 다음 파일들이 별도로 존재한다.

- `AnnotationPanel.js`
- `ZoneMap.js`
- `audioManager.js`
- `supabase.js`
- `globals (1).css`

이 파일들은 앱의 import 경로에 포함되지 않으며 과거 사본으로 추정된다. 삭제 전에는 수동 비교와 사용자 확인이 필요하다.

## 코드 규모

2026-06-05 기준 주요 소스는 약 3,701줄이다. 가장 큰 파일은 `ZoneMap.js` 약 888줄, `WorldMap.js` 약 743줄, `AnnotationPanel.js` 약 673줄이다.

