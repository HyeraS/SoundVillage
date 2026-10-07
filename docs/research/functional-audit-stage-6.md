# 기능 감사 6단계: 화면·입력 lifecycle 및 세부 User Log

작업일: 2026-09-11

이번 단계는 코드와 정적 회귀 테스트만 변경했다. 운영 Supabase에 연결하지 않았고 SQL, migration, 데이터 변경을 실행하지 않았다. 새 DB 구조는 필요하지 않아 migration을 추가하지 않았으며, 아직 운영에 적용되지 않은 기존 `004_user_event_logging.sql`의 이벤트 이름 allowlist만 클라이언트 목록과 함께 보완했다.

## 작업 전 확인과 범위

작업 시작 시 `git status --short`를 확인했다. 이미 수정되거나 새로 생긴 파일은 모두 사용자 소유 변경으로 간주했고 reset, restore, checkout, clean 또는 unrelated 포맷팅을 하지 않았다. `AGENTS.md`와 Next.js 16.2.7의 Client Components, testing, production checklist 문서를 먼저 읽고 현재 코드의 이벤트 listener/effect cleanup 및 client-side lifecycle을 기준으로 점검했다.

## 확인한 실제 버그와 원인

1. `LibraryRoom` 정보 카드나 상점 카드가 열린 뒤에도 `useKeys()`의 기존 방향 상태와 animation loop가 계속 적용됐다. 카드가 열린 상태에서 캐릭터가 이동해 근접 영역을 벗어나면 카드가 의도치 않게 닫힐 수도 있었다.
2. 각 zone의 주석, 피드백, 해금 안내, exit-confirm UI와 WorldMap의 attendance/quest 패널이 떠 있는 동안 공용 방향 입력을 차단하지 않아 배경 캐릭터가 움직일 수 있었다. `Enter`도 일부 배경 activation handler에 도달할 수 있었다.
3. 일부 `Enter`/`Escape` handler가 `KeyboardEvent.repeat`를 확인하지 않았다. 시작 claim, 방 저장, 의상 구매·착용은 React state만으로 버튼을 비활성화해 같은 render 사이의 빠른 연속 호출을 동기적으로 막지 못했다.
4. 피드백 화면의 실제 자동 전환 시간은 주석의 2초가 아니라 400ms였다. 참가자가 메시지를 읽기 어렵고, 동일 컴포넌트가 다음 zone 피드백에 재사용될 때 이전 timer identity가 분리되지 않았다.
5. Library 카드 close는 이동에 의한 상태 변경뿐이라 X, ESC, backdrop, navigation, unmount 이유를 남길 수 없었다. attendance 패널은 open/close 자체가 미계측이었고 quest 패널도 닫기 방식이 구분되지 않았다. 박물관 상점은 자식 컴포넌트 unmount를 항상 close로 기록해 실제 navigation 이유를 잃었다.
6. 초대 링크 복사는 Clipboard API의 성공/실패 결과와 재진입을 기록하지 않았다.
7. 기존 `duo_reconnected` 분기는 연결의 상승 edge 안에서 직전 값이 이미 연결 상태인지 다시 검사해 사실상 도달할 수 없었다.

## 구현한 수정

- 공용 `useKeys`에 `disabled`, `screen`, `zone` context를 추가했다. overlay가 열리면 보관 중인 네 방향 상태를 즉시 지우며, 닫힌 뒤 새 keydown/D-pad press부터 정상적으로 다시 움직인다. blur, document hidden, unmount 초기화도 유지했다.
- WorldMap, LibraryRoom, InteriorRoom과 여섯 zone 구현에 실제 overlay 상태를 연결했다. `app/page.js`는 annotation, feedback, block-unlock 화면 동안 zone 입력을 차단한다.
- Library 카드는 열린 동안 animation loop에 빈 방향 상태를 전달하고 이동 기반 자동 닫기를 제거했다. X, ESC, backdrop, navigation, unmount를 단일 close guard로 처리한다.
- 주요 Enter/Escape handler에서 key repeat를 무시했다. 방향 입력 로그도 최초 keydown/press transition만 기록한다.
- 시작 claim, 주석 제출/skip, 박물관 vote, 의상 구매/착용, 방 저장, 링크 복사에 동기식 ref in-flight guard가 있음을 회귀 점검하고 누락된 guard를 추가했다. 관련 버튼도 실행 중 비활성화했다.
- 피드백 표시 시간을 2,400ms로 늘리고 timeout/interval cleanup을 명시했다. `zone` 변경을 timer dependency에 포함하고 `FeedbackPanel`에 zone key를 주어 다음 피드백의 timer identity를 분리했다.
- 주석 화면의 지연 전환 timeout을 ref로 관리해 새 전환 전과 unmount 때 이전 timer를 제거했다.
- duo reconnect는 같은 `WorldMap` mount 안에서 실제 `partnerId` presence가 한 번 관찰된 이후 disconnect와 두 번째 connect가 발생한 경우에만 기록한다.

## 추가·보완한 User Event

- `map_control_activated`: 방향키/WASD의 non-repeat 시작 또는 D-pad press 시작 한 번만 기록한다. `map-control-up|down|left|right` target과 keyboard/D-pad source를 쓰며 좌표와 매 프레임 이동은 기록하지 않는다.
- `library_card_opened`, `library_card_closed`: `library-card-vote|exhibits|shop` target, 카드 instance UUID, interaction method, 정확한 close reason을 기록한다.
- `attendance_panel_opened`, `attendance_panel_closed`: `world-attendance-panel` target과 close reason을 기록한다.
- 기존 `quest_panel_opened`, `quest_panel_closed`: X, backdrop, ESC, 다른 패널로 전환, unmount 이유를 구분하도록 보완했다.
- `invite_link_copy_succeeded`, `invite_link_copy_failed`: 실제 Clipboard API 결과만 기록한다. 실패는 공개 오류 코드 `clipboard_write_failed`만 남기며 URL과 share token은 payload에 넣지 않는다.
- `shop_closed`: Library 카드 lifecycle과 통합해 실제 close reason을 보존한다.
- `duo_reconnected`: 같은 mounted map에서 관찰된 실제 presence history가 있을 때만 사용한다.

`target_id`는 모두 안정된 제품 식별자다. 캐릭터 위치, pointer move, held key frame, 초대 URL, share token, 표현 원문은 새 이벤트에 기록하지 않는다.

## 추가한 회귀 테스트

`scripts/stage-6-lifecycle.test.mjs`는 다음을 정적으로 고정한다.

- overlay별 이동 차단 및 방향 상태 해제
- non-repeat 의미 단위 방향 입력과 Enter repeat 차단
- Library/attendance/quest close reason
- 2,400ms 피드백 timer와 cleanup/identity reset
- 주요 저장·구매·착용·투표 handler의 ref in-flight guard
- 새 이벤트가 클라이언트와 미적용 004 allowlist 양쪽에 존재하는지, 초대 링크가 로그 metadata에 포함되지 않는지
- 실제 prior presence 없는 duo reconnect 기록 금지

기존 `scripts/input-lifecycle.test.mjs`도 공용 clear helper와 disabled 전환 초기화를 확인하도록 보완했다.

## 검증 결과

통과:

- `npm run test:stage-6-lifecycle`: 7/7
- `npm run test:input-lifecycle`: 2/2
- `npm run test:user-events`: 6/6
- `npm run test:audio-lifecycle`: 3/3
- `npm run test:functional-fixes`: 3/3
- `npm run test:security-boundary`: 4/4
- `npm run test:transactional-integrity`: 4/4
- `node --test scripts/internalTestRoutes.test.mjs`: 4/4
- 6단계 변경 파일 대상 ESLint(`ZoneMap.js` 제외): 오류 0, 기존 `LibraryRoom`의 `<img>` 경고 7
- `next build --webpack` (Next.js 16.2.7): 성공, 26/26 route 생성
- `git diff --check`: 통과

제한 또는 미실행:

- `ZoneMap.js`까지 포함한 변경 파일 ESLint는 기존 React purity/ref-during-render 오류 20개 때문에 실패했다. 이번 단계에서 새로 수정한 입력 경로의 오류가 아니라 기존 map rendering 구조의 부채이며, 범위를 넓혀 억제하거나 unrelated refactor하지 않았다.
- build에는 기존 generated Tailwind CSS malformed-variable 경고 4개와 Node `module.register()` deprecation 경고가 남는다.
- 브라우저 기반 실제 키보드/D-pad E2E와 접근성 도구 검증은 전용 환경이 없어 실행하지 못했다. 이번 테스트는 source-level regression이므로 실제 브라우저 리허설을 대체하지 않는다.
- `test:rls-local`, `test:transactional-integrity-local`, `test:user-events-local`은 격리된 local/staging Supabase와 테스트 credential이 없어 실행하지 않았다. 운영 Supabase는 금지 범위라 연결하지 않았다.

## 연구자 정책 결정이 필요한 항목

- 박물관 음원 필수 재생 여부는 변경하지 않았다.
- 출석/퀘스트의 KST/UTC 기준은 변경하지 않았다.
- whole-experiment 완료 조건과 완료 event는 현재 명시적 UI action이 없어 추가하지 않았다.
- 친구 방 칭찬 영속화 여부는 변경하지 않았다.
- generic zone collectible 접근 prompt, quest row impression의 분석 단위는 정책 확정 전이라 추가하지 않았다.
- duo reconnect는 같은 mounted `WorldMap` 안에서만 안전하게 판별한다. 화면 remount, reload 또는 새 브라우저 session을 reconnect로 볼지 fresh connect로 볼지는 연구 session 정의와 서버측 연결 이력이 필요하다.

## 다음 권장 단계

1. 실제 브라우저에서 WorldMap, 여섯 zone, Library, Interior의 키다운 유지 상태로 각 overlay를 열고 이동 정지/닫은 뒤 입력 복구를 E2E로 검증한다.
2. local 또는 staging Supabase에 001~005를 순서대로 적용한 격리 환경에서 RLS, 트랜잭션, User Event 통합 테스트를 실행한다.
3. 연구자가 시간대, 박물관 재생 요건, 실험 완료, 칭찬 영속화, reconnect session 경계를 결정한 뒤 해당 정책을 별도 단계로 구현한다.
4. 기존 `ZoneMap.js` React lint 부채와 generated CSS 경고를 참가자 기능 변경과 분리해 정리한다.
