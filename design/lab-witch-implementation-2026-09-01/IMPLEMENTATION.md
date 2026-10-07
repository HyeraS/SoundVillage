# Lab — 청록빛 마녀 골목 최종 구현 및 검증

최종 검증일: 2026-09-17. 기존 제품의 `app/page.js → LabZoneMap` 연결과
연구 데이터 계약을 유지하면서 승인 시안의 48×36 마을 구도와 픽셀 아트를
실제 플레이 화면으로 옮겼다. 배포·push·실제 연구 DB 읽기/쓰기·실제 참가자
데이터 변경은 하지 않았다.

## 수정 전과 승인 시안의 가장 큰 차이

- 수정 전에는 중앙의 넓고 직선적인 모래 십자/T자 길과 등간격 외곽 수목이
  화면을 지배했다. 승인 시안은 청록 잔디가 넓게 남고, 서쪽과 동쪽에
  비대칭 순환 골목이 생기는 구조다.
- 건물·울타리·랜턴·호박·꽃이 서로 떨어진 오브젝트처럼 보이던 구성을
  독립된 마당과 생활 소품 군집으로 통합했다.
- 작은 연못과 판자 두 개 대신 유기적인 남서 연못, 부두 3개, 배 1개,
  낚시 구조물 1개를 반영했다.
- 북쪽 마녀 집, 북서/서쪽 상점, 중앙 우물, 동쪽/남동 주택, 남쪽 시장과
  입구의 시각적 위계를 시안과 같은 위치와 크기로 맞췄다.

## 렌더링 구조

- `environment-source-v2.png`는 승인 시안에서 플레이어와 다섯 개의 청록
  사운드 마커만 제거한 ImageGen 결과다. `prepare_lab_environment.mjs`가
  원본의 `(36,54,1376×1032)` 영역을 crop하고 nearest-neighbour 방식으로
  1536×1152 월드 마스터를 만든다.
- 런타임은 `environment-master-v2.png`를 환경 레이어로 사용하되, 플레이어와
  실제 데이터 기반 사운드 아이템, 잠금 상태, 카메라, 입력, 충돌은 계속
  코드에서 실시간으로 처리한다.
- 건물과 수목은 플레이어 발 위치에 따라 앞쪽 일부를 다시 그리는 foreground
  clipping을 사용한다. 따라서 지붕/수관 아래를 지나갈 때 자연스럽게 가려지고,
  전체 지붕을 직사각형 충돌로 막지 않는다.
- 발 박스, 축별 충돌, 대각선 정규화, 큰 프레임 세분 이동, 키보드/DPad,
  모달 중 이동 정지는 유지했다.
- 캐릭터는 방향별 8프레임 걷기 시트를 약 100ms 간격으로 재생한다. Lab에서는
  32×32 원본 비율을 유지한 64×64 정수 픽셀 크기로 표시해 기존 72×88 비균등
  확대에서 생기던 형태 왜곡을 제거했다.
- 캔버스 backing store는 `devicePixelRatio`를 최대 3배까지 반영한다. 예를 들어
  791×729 CSS viewport는 1582×1458로 렌더링되어 고밀도 화면에서도 선명하다.

## 시각 측정

- 화면 커버리지: 길 `14.01% → 14.55%`(`+0.54%p`), 청록 영역
  `45.17% → 45.99%`(`+0.82%p`), 두 허용 오차 모두 통과.
- 승인 시안과 최종 월드의 평균 절대 채널 차이: `6.93/255`.
- 기하학 기준 길 `24.67%`, 연못 `6.21%`.
- 10개 주요 랜드마크의 발 위치 오차는 모두 `0타일`, 최대 가시 크기 오차는
  `0.3%`다.
- 소품 수량 편차는 나무 `-6.1%`, 석재 울타리 `-5.9%`, 나머지는 `0%`로
  모두 목표 `±10%` 안이다.

정량 결과 원본은 `visual-metrics.json`, 시안/구현 비교는
`concept-comparison.png`, 25% 축소 검사는 `concept-comparison-25.png`,
추가 점검 자료는 `concept-overlay-50.png`와 `concept-difference.png`다.

## 데이터와 진행률 계약

- `sounds`, `onCollectSound`, `onExit`, `collectedIds`, `isAnnotating`,
  `blockNum`, `blockTotal` props를 유지했다.
- Lab은 canonical 오디오가 같더라도 서로 다른 실제 `sound_id`를 제거하지
  않는다. 그룹 A 84개, B 85개, 전체 169개가 결정적 순서로 모두 배치된다.
- 저장된 canonical ID 하나가 현재 Lab 그룹의 여러 실제 ID에 대응할 수 있어,
  복원 시 모든 일치 ID에 진행 상태를 적용한다. 다른 존의 canonical dedupe
  동작은 변경하지 않았다.
- 충돌 사각형 1,719개, 도달 가능한 발 셀 4,335개, 안전 아이템 슬롯 403개를
  검사했다. 모든 블록의 활성 아이템이 스폰에서 도달 가능하다.

## localhost 브라우저 QA

실제 앱 경로와 제품 입력 루프를 사용하되, 격리 소스 사본과
`127.0.0.1:4015`의 in-memory mock만 연결했다. `.env`와 실제 DB는 사용하지
않았다.

- 월드맵에서 키보드 이동 후 Enter로 Lab 진입, 그룹 A `0/84 · 1/6`,
  입장 직후 발견창 없음.
- 실제 키 입력으로 첫 사운드에 접근해도 팝업이 자동으로 열리지 않았다. 대신
  해당 마커의 픽셀 글로우·스파클과 `Enter ↵ 이 소리 전사하기` 안내가 나타났다.
- Enter를 누른 경우에만 전사 패널이 열렸으며 mock WAV 재생과 제출 후
  `1/84`가 반영됐다. 모바일 DPad의 확인 버튼도 같은 동작을 사용한다.
- 나가기 확인 취소/확인, 같은 참가자로 재진입 후 `1/84 · 1/6` 복원.
- 후반 시드 참가자는 `75/84 · 6/6`으로 복원.
- 390×788 세로와 844×390 가로에서 문서 크기가 viewport와 같아 가로/세로
  overflow가 없었다. 세로 화면에서 DPad pointer drag가 실제 플레이어 위치와
  방향을 바꿨다.
- 확인 시점 콘솔 warning/error는 0건이었다.

브라우저 자동화 정책이 마지막 전체 고리 순회를 차단해, 모든 고리를 한 번의
브라우저 세션으로 완주하지는 못했다. 대신 부분 실기동과 함께 production
테스트가 4,335개 도달 가능 셀 및 모든 블록 아이템의 BFS 도달성을 검증했다.
상세 기록은 `browser-qa.json`에 있다.

## 자동 검사와 빌드

| 검사 | 결과 |
|---|---|
| `node --test scripts/test_lab_production.mjs` | 12/12 통과; A84/B85/전체169, safeSlots 403 |
| 지정 Lab/QA ESLint | 오류 0, 경고 0 |
| Music production | 통과 |
| Urban production | 통과; 기존 Node module-type 경고만 출력 |
| Study access + Nature layout | 8/8 통과 |
| 격리 `next build --webpack` | Next.js 16.2.7, 27개 정적 페이지, 성공 |

기본 Turbopack 빌드는 격리 사본 밖의 `node_modules` 심볼릭 링크를 파일시스템
루트 밖으로 판단해 실패했다. 같은 격리 사본에서 Next.js가 공식 지원하는
`--webpack` 빌드를 실행해 성공했고, 원본 `.next`와 `.env`는 건드리지 않았다.
로그는 `test-lab.log`, `lint.log`, `regression.log`, `build.log`에 남겼다.

## 이번 작업의 핵심 파일

- `app/page.js`
- `components/LabZoneMap.js`, `components/LabZoneMap.module.css`
- `lib/labVillage.js`, `lib/labVillageConfig.mjs`
- `scripts/prepare_lab_environment.mjs`, `scripts/render_lab_review.mjs`
- `scripts/test_lab_production.mjs`, `scripts/lab_qa_server.mjs`,
  `scripts/labQaControls.jsx`
- `public/assets/lab-witch/environment-source-v2.png`
- `public/assets/lab-witch/environment-master-v2.png`
- `design/lab-witch-implementation-2026-09-01/`의 비교·QA·로그 산출물

작업 전부터 존재한 다른 존과 전역 파일의 미커밋 변경은 reset, clean,
checkout, stash하거나 덮어쓰지 않았다.

## 검증하지 않은 범위

- 실제 연구 DB 저장과 실제 연구 오디오
- Safari와 Firefox
- iOS/Android 실기기
- 84개 전체를 브라우저에서 수동 제출하는 장시간 시나리오
- 모든 순환 고리를 한 브라우저 세션에서 완주하는 최종 수동 시나리오
