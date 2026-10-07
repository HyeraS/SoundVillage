# SoundMimic Village 기능 점검 및 개선 작업 인수인계

작성 기준일: 2026-09-06 (Asia/Seoul)  
프로젝트: `/Users/hyera/Documents/SoundVillage-house-decor-2d`  
브랜치: `house-decor-2d`  
문서 목적: 새 Codex 채팅에서 이전 대화 없이 기능 점검, 데이터 안전성, User Log 및 남은 버그 개선 작업을 이어가기 위한 단일 인수인계 문서

## 1. 사용자의 최종 목표

디자인 리스킨은 작업 범위에서 제외하고, 현재 프로젝트의 기능적 구현을 참가자 관점에서 전수 점검하고 미완성 기능과 버그를 단계적으로 개선한다.

핵심 요구사항은 다음과 같다.

1. 참가자가 게임에 들어온 뒤 어떤 행동을 했는지 촘촘하게 기록한다.
   - 무엇을 클릭했는지
   - 무엇을 선택했는지
   - 선택했다가 해제하거나 변경했는지
   - 저장을 시도했는지
   - 저장이 성공했는지 실패했는지
   - X, ESC, backdrop, 화면 이동 등 어떤 방식으로 취소했는지
   - 실패 후 재시도했는지
2. Supabase에 저장되는 결과 데이터와 행동 로그를 명확히 구분하고 정리한다.
3. 이전 실험과 현재 실험의 기능 및 조건 차이를 확인한다.
4. 참가자에게 발생할 수 있는 기능적 버그, 데이터 유실, 데이터 오염 가능성을 제거한다.
5. 실제 실험 시작 전 재현 가능한 테스트와 운영 적용 절차를 만든다.

## 2. 프로젝트 운영 전제

- 완전 공개형 서비스가 아니다.
- 실험 진행자가 참가자마다 고유 participant ID를 배부한다.
- 일반 회원가입, 이메일, 비밀번호 UI는 필요하지 않다.
- 참가자 ID는 실험 시작 전에 등록하며 그룹 A/B도 사전에 고정하는 구조를 사용한다.
- 디자인 리스킨은 현재 개선 범위가 아니다.
- 운영 Supabase에는 Codex가 임의로 SQL migration이나 데이터 변경을 실행하면 안 된다.
- SQL은 검토 가능한 migration과 검증 도구까지만 작성하고, 운영 적용은 사람의 승인과 staging 검증 후 수행한다.

## 3. 매우 중요한 작업공간 상태

현재 worktree에는 많은 수정 및 신규 파일이 있으며 대부분 아직 커밋되지 않았다.

새 채팅의 Codex는 반드시 다음 원칙을 지켜야 한다.

- 작업 전 `git status --short`를 확인한다.
- 현재 변경사항을 사용자 소유 작업으로 취급한다.
- `git reset --hard`, `git checkout --`, 광범위한 restore 또는 clean을 실행하지 않는다.
- unrelated 변경을 정리하거나 포맷팅하지 않는다.
- 기존 1~3단계 구현을 되돌리지 않는다.
- `AGENTS.md`를 먼저 읽는다.
- 이 프로젝트는 Next.js 16.2.7이므로 Next.js 코드를 변경하기 전에 필요한 경우 `node_modules/next/dist/docs/`의 현재 버전 문서를 확인한다.

현재 기준 브랜치와 HEAD:

```text
branch: house-decor-2d
HEAD: a8b8091
```

## 4. 현재 구현된 주요 기능

### 참가자 흐름

1. participant ID와 그룹 입력
2. 월드맵 진입
3. 최초에는 Music 지역 중심으로 진행
4. Music 1단계 완료 후 다른 지역 잠금 해제
5. 각 지역에서 사운드 수집
6. 음원 청취 후 의성어와 확신도 입력 또는 건너뛰기
7. 박물관에서 다른 그룹이 작성한 표현 후보를 듣고 투표
8. 재화, 출석, 일일 퀘스트, 의상 및 상점
9. 집 꾸미기, 아이템 구매, 방 저장
10. 친구 방 방문 및 Supabase Realtime 기반 듀오 기능

### 현재 프로젝트에서 추가된 기능

- 여섯 개 지역별 게임 엔진
- 박물관과 전시
- 재화 및 거래 원장
- 출석 보상
- 일일 퀘스트
- 의상 구매 및 착용
- 인테리어 아이템 구매 및 방 저장
- 친구 방 공유
- Realtime 듀오
- 내부 QA, test, preview 라우트

내부 QA/test/preview 라우트는 1단계에서 운영 접근 차단 코드가 구현되었다.

## 5. 이전 실험 및 현재 브랜치 관련 정보

- 현재 프로젝트와 이전 실험은 서로 다른 Supabase 프로젝트를 사용한 것으로 확인됐다.
- 기존 SQL 주석에는 이전 실험 데이터가 주석 4,052건, 투표 4,006건이라고 기록돼 있었다.
- 2026-09-06 초기 읽기 전용 감사 당시 현재 Supabase에는 주석 1건, 투표 0건 등 매우 적은 데이터만 있었다.
- 따라서 현재 DB 데이터만으로 박물관, 다수 참가자, A/B 조건, 인테리어 흐름을 충분히 검증할 수 없다.
- `main` 브랜치에는 현재 브랜치에 없을 수 있는 Supabase 연결 고갈, count 일괄 조회, 1,000행 제한 대응, 박물관 연속 투표 관련 수정이 있었다. 1~3단계 작업 이후에도 실제로 반영됐는지 다시 비교해야 한다.

## 6. 단계별 진행 현황

### 1단계: 운영 테스트 경로 차단 — 코드 구현 완료

구현 결과:

- 운영 및 Preview 환경에서 내부 test/debug/preview 라우트 차단
- 서버 측 404 처리
- 로컬 개발에서 명시적인 서버 전용 플래그로만 활성화
- 테스트 페이지 진입만으로 Supabase 데이터가 생성되지 않도록 변경
- 내부 경로 차단 회귀 테스트 4/4 통과

주의:

- 실제 배포 환경에서도 404인지 배포 후 재검증해야 한다.
- 관련 구현을 후속 작업에서 되돌리지 않는다.

### 2단계: 참가자 인증 및 RLS — 코드와 migration 작성 완료, 운영 미적용

선택한 구조:

- Supabase Anonymous Auth
- `auth.uid()`와 사전 등록 participant ID 매핑
- participant ID는 최초 claim 시 인증 사용자에게 원자적으로 연결
- 그룹은 등록 데이터에 따라 고정
- RLS는 요청 본문의 participant ID가 아니라 인증 매핑 기준

추가된 주요 구조:

- `study_participants`
- `study_sound_catalog`
- `participant_room_shares`
- `participant_realtime_room_members`
- 제한된 박물관 RPC
- 제한된 친구 방 RPC
- private Realtime 정책
- service-role 전용 구매 Route Handler

관련 파일:

- `scripts/security/001_auth_foundation.sql`
- `scripts/security/002_enforce_participant_rls.sql`
- `docs/security/participant-auth-rls.md`
- `scripts/security/register-study-data.mjs`
- `scripts/security/rls.integration.mjs`
- `scripts/security/security-boundary.test.mjs`
- `lib/participantAuth.js`
- `lib/supabaseAdmin.js`
- `app/api/participant-session/claim/route.js`
- `app/api/participant-purchase/route.js`

남은 운영 과제:

- 운영 schema dump 기반 house 관련 컬럼 불일치 확인
- staging/local Supabase에서 001/002 실제 적용
- Anonymous Auth 설정
- Supabase Realtime의 Allow public access 비활성화
- A/B 참가자 간 SELECT/INSERT/UPDATE 차단 실제 검증
- 브라우저 저장소 삭제로 익명 세션을 잃은 참가자의 재연결 절차
- 짧거나 추측 가능한 participant ID의 최초 claim 탈취 방지
- 필요하다면 일회성 claim secret, rate limit 또는 CAPTCHA 도입

### 3단계: 저장 무결성, 트랜잭션, 멱등성 — 코드와 migration 작성 완료, 운영 미적용

추가된 migration:

- `scripts/security/003_transactional_integrity.sql`

추가 또는 변경된 주요 구조:

- 인증 사용자별 `idempotent_operations`
- `submit_annotation_v3`
- `submit_museum_vote_v3`
- `ensure_today_check_in_v3`
- `set_equipped_outfit_v3`
- 멱등성이 강화된 `secure_purchase_admin`
- 내부 전용 재화 및 퀘스트 처리 함수
- 원장과 잔액의 동시 잠금 및 갱신
- 잔액 음수 방지
- 직접 INSERT 및 분리형 보상 RPC 권한 회수
- `source_type`, `audioset_class` 저장 지원
- 공통 `{ok, data}` / `{ok:false, error}` 결과 모델

관련 파일:

- `docs/security/transactional-integrity.md`
- `scripts/security/transactional-integrity-preflight.sql`
- `scripts/security/transactional-integrity.test.mjs`
- `scripts/security/transactional-integrity.integration.mjs`
- `lib/persistenceResult.js`
- `components/AnnotationPanel.js`
- `components/SoundMuseum.js`
- 구매 및 착용 관련 호출부

구현됐다고 보고된 동작:

- 동일 UUID를 사용한 안전한 재시도
- 저장 중 handler 재진입 차단
- Enter 반복 입력 차단
- 성공 후에만 화면 전환
- 실패 시 입력, 후보 및 confidence 유지
- 후보 0건과 조회 실패 구분
- 주석, 투표, 출석, 퀘스트, 구매, 착용의 원자적 처리
- 재화 거래 원장과 잔액의 일관성
- 건너뛰기는 보상 및 퀘스트 대상에서 제외

검증 상태:

- 정적 무결성 테스트 4/4 통과
- 보안 경계 테스트 4/4 통과
- 내부 경로 회귀 테스트 4/4 통과
- 변경 파일 ESLint 통과
- production build 성공
- 실제 Supabase 통합 테스트는 아직 미실행
- 운영 DB migration은 미적용

## 7. 다음 확정 단계: User Log

다음 작업은 `study_sessions + user_events` 기반을 구축하고 주요 참가자 행동을 instrumentation하는 것이다.

권장 신규 migration:

```text
scripts/security/004_user_event_logging.sql
```

권장 문서 및 검증 파일:

```text
docs/research/user-event-inventory.md
docs/research/user-event-logging.md
scripts/security/user-event-preflight.sql
scripts/security/user-event-analysis.sql
scripts/security/user-event.integration.mjs
scripts/security/user-event.test.mjs
```

### 7.1 세션 요구사항

기존 결과 데이터의 `session_id`가 그룹 A/B 의미로 사용된 부분과 별도로, User Log에서는 실제 UUID 실험 세션을 사용한다.

필요한 개념:

- `study_session_id`: 한 번의 실험 시행
- `client_instance_id`: 탭 또는 페이지 로드 인스턴스
- `sequence_no`: 동일 client instance 안의 이벤트 순서
- `occurred_at`: 클라이언트 발생 시간
- `received_at`: DB 수신 시간

새로고침에서는 동일 study session을 복구하되 client instance는 새로 생성할 수 있어야 한다. 브라우저 종료만으로 즉시 abandoned로 단정하지 말고 `last_activity_at`을 이용해 분석 단계에서 추론한다.

### 7.2 User Event 핵심 필드

```text
id
study_session_id
client_instance_id
auth_user_id
participant_id
sequence_no
event_name
occurred_at
received_at
screen
zone
sound_id
target_type
target_id
interaction_method
value_before
value_after
outcome
close_reason
duration_ms
operation_type
operation_idempotency_key
result_entity_type
result_entity_id
error_code
metadata
app_version
```

필수 성질:

- append-only
- 참가자 UPDATE/DELETE 불가
- 참가자 원본 로그 SELECT 불가
- 인증 참가자는 자신이 소유한 study session에만 이벤트 기록 가능
- participant ID와 group은 DB가 인증 매핑으로 결정
- 동일 event ID 재전송은 한 행만 저장
- `(study_session_id, client_instance_id, sequence_no)` 중복 방지
- 여러 이벤트의 batch RPC 지원
- 로그 장애가 주석이나 투표 결과 저장을 rollback시키지 않음

### 7.3 기록해야 할 이벤트

세션과 화면:

```text
session_started
session_resumed
session_completed
screen_viewed
screen_exited
zone_entered
zone_exited
navigation_attempted
navigation_succeeded
navigation_failed
network_offline
network_online
unexpected_error
```

월드맵과 수집:

```text
map_control_activated
zone_entry_attempted
zone_entry_blocked
zone_entry_succeeded
collectible_approached
collectible_prompt_shown
collectible_activated
```

주석:

```text
annotation_modal_opened
annotation_modal_closed
audio_play_attempted
audio_play_started
audio_paused
audio_resumed
audio_completed
audio_failed
expression_input_started
expression_input_changed
expression_input_cleared
confidence_selected
confidence_changed
confidence_deselected
annotation_submit_attempted
annotation_submit_succeeded
annotation_submit_failed
annotation_skip_attempted
annotation_skip_succeeded
annotation_skip_failed
```

모달 close reason:

```text
submitted
skipped
close_button
escape
backdrop
navigation
component_unmounted
unknown
```

박물관:

```text
museum_entered
museum_exited
museum_candidate_load_attempted
museum_candidate_loaded
museum_candidate_empty
museum_candidate_load_failed
museum_expression_impression
museum_expression_selected
museum_expression_deselected
museum_expression_changed
museum_audio_play_attempted
museum_audio_play_started
museum_audio_failed
museum_vote_submit_attempted
museum_vote_submit_succeeded
museum_vote_submit_failed
museum_next_candidate
```

출석, 퀘스트, 재화 및 상점:

```text
attendance_check_attempted
attendance_check_succeeded
attendance_check_failed
quest_panel_opened
quest_panel_closed
quest_completed
reward_applied
currency_balance_viewed
shop_opened
shop_closed
shop_item_viewed
purchase_attempted
purchase_succeeded
purchase_failed
outfit_equip_attempted
outfit_equip_succeeded
outfit_equip_failed
```

인테리어와 친구 기능:

```text
interior_entered
interior_exited
interior_item_selected
interior_item_deselected
interior_item_added
interior_item_moved
interior_item_rotated
interior_item_removed
interior_change_undone
room_save_attempted
room_save_succeeded
room_save_failed
friend_room_open_attempted
friend_room_open_succeeded
friend_room_open_failed
duo_connect_attempted
duo_connected
duo_disconnected
duo_reconnected
```

### 7.4 이벤트 기록 원칙

- DOM의 모든 click을 전역 listener로 수집하지 않는다.
- 의미 있는 컨트롤에 명시적인 event name과 안정된 target ID를 부여한다.
- DOM 순서, CSS class, 임시 React ID를 target ID로 사용하지 않는다.
- 선택, 해제, 변경은 서로 다른 의미로 기록한다.
- 저장은 attempted, succeeded, failed를 구분한다.
- 저장 이벤트에 003의 operation type과 idempotency key를 연결한다.
- 성공 이벤트에는 결과 annotation ID, vote ID 또는 transaction ID를 연결한다.
- 후보가 실제 화면에 표시된 경우 impression을 기록한다.
- 캐릭터 위치나 pointer move를 매 프레임 기록하지 않는다.
- 가구 이동은 drag 시작과 최종 위치 중심으로 기록한다.

### 7.5 개인정보 및 데이터 최소화

기록하지 말아야 할 것:

- Supabase token 및 service-role 키
- participant claim secret
- 친구 방 공유 토큰 전체
- URL query 전체
- 매 키 입력 문자
- 제출 전 의성어 원문 전체
- localStorage 전체
- 내부 SQL 오류 메시지

표현 입력 과정은 원문 대신 글자 수, empty 여부 등만 기록한다. 최종 표현 원문은 기존 annotations 결과 테이블에서만 관리한다.

### 7.6 로그 전송 요구사항

- 메모리 큐와 제한된 로컬 미전송 큐 사용
- 일정 개수 또는 시간마다 batch 전송
- 이벤트마다 UUID 생성
- 재시도 시 동일 event ID 유지
- 네트워크 실패 시 지수형 재시도
- 큐 개수, payload 크기, 보존 시간 제한
- `visibilitychange`, `pagehide`, online/offline 고려
- `beforeunload`에만 의존하지 않음
- React Strict Mode 중복 effect 방지
- 참가자가 변경되면 이전 참가자의 미전송 큐 격리
- 로그 전송 실패가 게임 UI를 block하지 않음

## 8. User Log 이후 해결할 남은 버그

User Log 기반을 만든 뒤 다음 버그를 단계적으로 수정한다. 수정 전후 행동을 로그로 검증할 수 있도록 User Log를 먼저 구현한다.

### 8.1 사운드 및 실험 데이터

1. 청취 시간이 모듈 전역 상태로 관리된다.
   - 취소한 사운드의 청취 시간이 다음 사운드에 합산될 수 있다.
   - 파일: `lib/audioManager.js`
2. X, ESC, backdrop, 화면 이동 취소가 기존 결과 테이블에는 기록되지 않는다.
   - User Log의 close reason으로 먼저 보완한다.
3. 박물관 투표는 음원을 한 번도 재생하지 않아도 제출 가능하다.
   - 이것이 버그인지 실험 정책인지 연구자 확인 후 결정한다.
4. 박물관 후보가 전체 후보에서 무작위로 뽑히지 않는다.
   - 현재 DB가 반환한 앞 후보에 limit을 적용한 뒤 클라이언트에서 섞는 방식일 가능성이 있다.
   - 전체 후보에서 공정하게 표본 추출하도록 개선 필요.
5. 구형 및 신형 sound ID 혼용으로 같은 음원에 중복 투표할 가능성이 있다.
6. `MY EXPRESSION` 관련 state가 초기화만 되고 실제 표현이 연결되지 않은 죽은 기능일 가능성이 있다.
7. `session_id`가 그룹 ID로 사용되는 레거시 의미와 실제 실험 session UUID를 분리해야 한다.
8. `selected_features`, `difficulty`가 실제 UI 입력 없이 빈 값 또는 기본값으로 저장되어 분석을 오도할 수 있다.
9. PROJECT_SUMMARY의 주석 완료 후 이동 설명과 실제 코드 흐름이 다를 수 있다.
   - 실제 코드는 주석 완료 후 지역으로 돌아가는 것으로 조사됐다.
   - 실험 설계상 박물관 이동이 맞는지 결정 필요.

### 8.2 입력과 화면 동작

1. 공통 키 입력 상태가 window blur 또는 visibility change에서 초기화되지 않을 수 있다.
   - 탭 전환 후 캐릭터가 계속 이동하는 현상 가능.
   - 파일: `components/GameEngine.js`
2. LibraryRoom의 카드나 박물관 UI가 열려도 배경 이동 루프가 계속될 가능성이 있다.
3. 새로고침하면 현재 화면과 진행 위치가 시작 화면으로 돌아간다.
   - 인증 session 복구와 게임 진행 복구는 별도 문제다.
4. 그룹을 이미 claim한 참가자가 다른 그룹으로 변경할 수 없어야 한다.
   - 2단계 DB 정책과 실제 UI 흐름을 통합 테스트해야 한다.
5. 피드백 화면이 약 0.4초라 참가자가 내용을 읽지 못할 수 있다.
6. Enter 반복 입력은 3단계에서 차단됐다고 보고됐으나 실제 주요 진입 handler 전체에 적용됐는지 회귀 검증이 필요하다.

### 8.3 인테리어 및 친구 기능

1. 저장된 방 조회 실패가 저장된 방 없음과 동일하게 처리될 수 있다.
   - 일시적 조회 실패 후 기본 방으로 기존 방을 덮어쓸 위험.
2. 새로고침이나 탭 종료 전에 저장하지 않은 변경을 경고하지 않는다.
3. 방은 최종 스냅샷만 저장되며 편집 이력이 없다.
   - User Log에서 이동, 회전, 제거, undo, save 흐름을 기록한다.
4. 친구 칭찬 기능은 토스트만 표시되고 영속 저장되지 않는 것으로 조사됐다.
   - 의도된 장식 기능인지 실제 데이터 기능인지 결정 필요.
5. opaque 공유 토큰과 private Realtime은 2단계에서 구현됐으나 실제 Supabase 환경 검증이 필요하다.
6. `participant_house_items.quantity`, `participant_house_layout.id`와 기존 schema 사이의 불일치가 보고됐다.
   - 실제 운영 schema dump 없이는 추측으로 수정하지 않는다.

### 8.4 날짜와 세션

1. 출석과 일일 퀘스트 날짜가 UTC 기준이다.
   - 한국 시간 기준 실험이면 오전 9시에 날짜가 바뀌는 문제가 있다.
   - 연구 기준 시간대를 KST로 할지 UTC로 할지 확정 후 변경한다.
2. 브라우저 저장소 삭제 시 Supabase anonymous auth session을 잃는다.
   - participant ID 재연결 운영 절차가 필요하다.
3. 동일 참가자의 중복 탭, 동시 접속, 재시작을 어떤 실험 시행으로 볼지 정책 확정이 필요하다.

### 8.5 성능 및 대규모 데이터

1. 현재 브랜치가 최신 `main`의 Supabase 연결 고갈 수정을 포함하는지 확인한다.
2. 지역별 count를 여러 개별 요청으로 호출하는지 확인한다.
3. 박물관 후보별 annotation count가 N+1 요청인지 확인한다.
4. PostgREST 기본 1,000행 제한 때문에 annotation sound ID가 누락되는지 확인한다.
5. 박물관 투표 후 매번 종료되는지 다음 후보로 진행되는지 최신 main과 비교한다.

### 8.6 테스트 및 코드 품질

1. 핵심 참가자 흐름에 대한 실제 E2E 테스트가 부족하다.
2. Human production 테스트는 manifest v2인데 테스트가 v1을 기대해 실패했던 이력이 있다.
3. `components/SoundMuseum.js`에 기존 React lint 오류가 보고됐다.
4. `components/WorldMap.js`에 Date.now 관련 purity lint 오류가 보고됐다.
5. 생성 CSS 경고가 존재한다.
6. 전체 lint 결과에는 생성물과 unrelated 파일이 포함될 수 있으므로 변경 파일 lint와 기존 오류를 구분해야 한다.
7. 기본 Turbopack build가 과거 점검에서 장시간 정지됐고 `next build --webpack`은 성공했다. 현재 상태에서 재검증 필요.

## 9. User Log 완료 후 권장 작업 순서

1. User Log 기반과 주요 화면 instrumentation
2. 청취 시간 오염 및 오디오 lifecycle 수정
3. 박물관 필수 재생 정책, 후보 추출, sound ID 정규화
4. 화면 취소, blur, 이동, feedback UX 수정
5. 날짜 및 재접속 정책 확정과 구현
6. 인테리어 조회 실패, 미저장 경고, Realtime 복구
7. 최신 main의 Supabase 성능 수정 비교 및 반영
8. 전체 참가자 E2E 테스트
9. staging Supabase에서 001~004 migration 및 RLS/RPC 통합 테스트
10. 운영 migration 적용과 실제 참가자 리허설

## 10. 운영 적용 전 필수 검증

운영 반영 전 별도 staging 또는 local Supabase에서 다음을 검증해야 한다.

- 001 → 002 → 003 → 004 migration 순차 적용
- 실제 운영 schema와 migration 호환성
- 참가자 A가 B 데이터 조회 및 변경 불가
- 미인증 요청 차단
- participant ID claim 및 재접속
- 주석, skip, 투표 트랜잭션
- 출석, 퀘스트, 재화 보상
- 동시 구매 및 멱등성
- 친구 방 opaque token
- private Realtime 멤버십
- User Log batch insert, 재시도 및 참가자 격리
- 운영 test/debug/preview 경로 404
- service-role 키가 브라우저 번들에 없음
- 원장 합계와 잔액 일치
- vote_count와 실제 votes 수 일치
- User Log 성공 이벤트와 실제 결과 행 일치

## 11. 새 채팅에서 처음 할 일

새 Codex 채팅에서는 이 문서를 먼저 읽고 다음 순서로 진행한다.

1. `AGENTS.md` 전체 확인
2. 이 인수인계 문서 전체 확인
3. `git status --short` 확인
4. `docs/security/participant-auth-rls.md` 확인
5. `docs/security/transactional-integrity.md` 확인
6. 001~003 migration과 관련 테스트 확인
7. 실제 구현과 이 문서 사이의 차이 확인
8. User Log 구현 계획 제시
9. 운영 DB를 변경하지 않고 004 migration, 코드, 테스트 및 문서 작성

새 채팅에 전달할 시작 요청 예시:

```text
`docs/CODEX_FUNCTIONAL_AUDIT_HANDOFF.md`를 처음부터 끝까지 읽고 이 프로젝트의 기능 점검 및 개선 작업을 이어가줘.

현재 다음 확정 단계는 4단계 User Log 구축이야. 문서의 요구사항을 기준으로 `study_sessions`, append-only `user_events`, batch 기록 RPC, 클라이언트 큐, 주요 참가자 행동 instrumentation, RLS, 분석 SQL 및 테스트를 구현해줘.

먼저 현재 코드와 001~003 migration이 인수인계 내용과 일치하는지 확인한 뒤 작업해. 기존 인증, RLS, 트랜잭션, 멱등성, 내부 테스트 경로 차단을 유지하고 unrelated 변경을 되돌리지 마.

운영 Supabase에는 어떤 SQL이나 데이터 변경도 실행하지 말고, 검토 가능한 004 migration과 애플리케이션 코드, 검증 도구까지만 작성해줘.
```

## 12. 완료 판단 원칙

- 코드가 존재하는 것과 운영에 적용된 것을 구분한다.
- 정적 테스트 통과와 실제 Supabase 통합 테스트 통과를 구분한다.
- 실행하지 않은 테스트를 통과했다고 표현하지 않는다.
- 네트워크 또는 DB 오류를 데이터 없음으로 취급하지 않는다.
- UI가 다음 화면으로 이동한 것을 저장 성공으로 취급하지 않는다.
- 실험 규칙이 불명확하면 임의 결정하지 않고 결정이 필요한 항목으로 보고한다.
- 핵심 결과 테이블과 행동 로그를 혼합하지 않는다.
- 참가자의 행동 로그 때문에 핵심 결과 저장이 실패해서는 안 된다.
- 운영 배포 전 A/B 각각의 실제 참가자 리허설을 수행한다.

## 13. 2026-09-08 후속 작업 상태

4단계 User Log 구현을 실제 코드와 migration에 대조했고 정적 테스트 결과가 완료 메모와 일치함을 확인했다. 이어서 다음 기능 개선을 구현했다.

- 004 RPC의 metadata 및 before/after 내부 필드 allowlist 강화
- 사운드/모달/박물관 단위 청취 시간 격리 및 취소 후 누적 오염 방지
- window blur 및 문서 hidden 시 방향키 상태 초기화
- 박물관 사운드별 count N+1을 단일 집계 RPC로 교체하는 `005_functional_fixes.sql` 추가
- 구형/신형 sound ID를 실제 오디오 파일 번호 기준으로 묶어 중복 투표 후보 방지
- 기존 SoundMuseum React lint 오류 정리

상세 내용과 검증 결과는 `docs/research/functional-audit-stage-5.md`를 참조한다. 004와 005를 포함해 운영 Supabase에는 어떤 SQL이나 데이터 변경도 적용하지 않았다.

## 14. 2026-09-11 6단계 작업 상태

6단계 “화면·입력 lifecycle 및 세부 User Log 계측 보완” 코드 작업을 완료했다.

- Library/World/zone/interior overlay가 열린 동안 배경 방향 입력과 Enter activation 차단
- overlay가 열릴 때 held direction 초기화, 닫힌 뒤 새 입력부터 정상 복구
- 주요 Enter/Escape의 key repeat 차단과 claim, 저장, 구매, 착용, 투표 handler의 동기식 in-flight guard 회귀 점검 및 보완
- 피드백 실제 표시 시간을 400ms에서 2,400ms로 조정하고 이전 timer cleanup 및 화면별 identity 분리
- Library 정보 카드와 attendance/quest 패널의 open/close 및 X, ESC, backdrop, navigation, unmount close reason 계측
- 초대 링크 Clipboard API 성공/실패 계측과 URL/share token 로그 제외
- D-pad/키보드 방향 조작을 최초 의미 단위로만 계측하고 위치, pointer move, key-repeat frame은 제외
- 같은 mounted WorldMap에서 실제 partner presence가 먼저 관찰된 경우에만 fresh connect와 reconnect 구분
- 6단계 정적 회귀 테스트 7개 추가, 기존 입력 lifecycle 테스트 보완

상세 문제 원인, 변경, 이벤트 목록, 검증 결과와 남은 연구 정책은 `docs/research/functional-audit-stage-6.md`를 참조한다. 운영 Supabase에는 연결하지 않았고 SQL, migration, 데이터 변경을 실행하지 않았다. 새 migration은 추가하지 않았으며, 운영 미적용 상태인 기존 004 이벤트 allowlist만 보완했다.

## 15. 2026-09-11 7단계 작업 상태

7단계 “실험 규칙 확정 반영, 결과 고유성, 진행 복구 및 완료 처리”의 repository 작업을 완료했다.

- source dataset과 original filename 기반 canonical audio identity를 도입하고, metadata 1,000행이 995개 실제 음원 및 정확히 5개 alias 쌍으로 정규화됨을 테스트로 고정
- catalog 동기화가 기존 identity/분류 불일치를 덮어쓰기 전에 중단하도록 보강
- 정상 annotation과 vote를 participant + experiment round + canonical audio 단위로 DB 고유화하고 skip은 이 제약에서 제외
- 동일 key replay, 새 key 중복, alias 중복, 동시 요청이 한 결과로 수렴하며 중복 보상하지 않는 v4 RPC 작성
- 마지막 정상 annotation과 study session 완료/마지막 결과 연결을 같은 트랜잭션으로 처리
- 완료 전 서버 session 복구, 완료 후 동일 completed session/완료 화면 복구, 일반 게임·출석 초기화 차단
- 구형 v1 session start 및 v3 결과 writer 권한 회수, v1 completion을 완료 확인 전용으로 제한
- DB KST 날짜 helper로 출석/일일 퀘스트 경계를 통일하고 기존 UTC 행은 preflight 보고만 수행
- 미측정 `difficulty`/`selected_features` 신규 값을 null로 강제하고 기존 값은 수정하지 않음
- 박물관 실제 재생 시작 전 버튼과 handler/RPC 저장 차단
- quest row impression과 generic collectible proximity-edge 이벤트 추가
- read-only preflight, 006 migration, verify SQL, 정적 테스트 및 local-only integration runner 작성

최종 검증은 관련 정적/단위 테스트 44/44, 이번 단계 변경 파일 ESLint 0 error/0 warning, `git diff --check`, `next build --webpack`(App Router route 26개)까지 통과했다. 빌드에는 기존 `module.register()` deprecation 1건과 generated CSS malformed-variable 경고 4건이 유지됐다. 별도 진단에서 기존 `LibraryRoom` `<img>` 경고 7건 및 `ZoneMap` purity/ref 오류 20건을 재확인했으며 이번 단계 범위에서 변경하지 않았다. local/staging Supabase credential이 없어 integration 및 실제 브라우저 DB E2E는 실행하지 않았다.

적용 순서, alias 분류 충돌 3건, 안전 중단 조건, 테스트 결과, 미실행 통합/E2E와 친구 방 칭찬 후속 보안 설계는 `docs/research/functional-audit-stage-7.md`에 기록했다. 운영 Supabase에는 연결하지 않았고 001~006, SQL, 데이터 변경을 실행하지 않았다.

다음 단계는 별도 local/staging Supabase에서 신규 설치 순서를 그대로 리허설하고 모든 integration runner 및 A/B 브라우저 E2E를 통과시키는 것이다. 그 전에는 v2/v4 앱을 운영에 배포하지 않는다.

## 16. 2026-09-11 8단계 착수 결과: 환경 및 신규 설치 blocker

8단계 local 통합 리허설을 착수했으나 완료하지 못했다. 읽기 전용 환경 점검에서
Supabase CLI와 Docker/Podman이 설치되어 있지 않았고, 기존 local Supabase 설정도
없었다. 운영, Preview, staging, `.env.local`에는 연결하지 않았으며 SQL과 데이터
변경을 실행하지 않았다.

SQL 의존성 감사에서는 checked-in historical schema만으로 신규 설치가 불가능함을
확인했다. `annotations`/`votes` 생성 SQL이 없고, `house_decor_schema.sql`의 house
테이블에는 002가 요구하는 `quantity`/`id` 컬럼이 없다. 또한 experiment-rules local
runner는 빈 catalog를 요구하지만 공식 순서는 1,000행 catalog sync 이후 runner를
실행하도록 되어 있어 그대로는 양쪽 조건을 동시에 만족하지 못한다. 이를 우회하기
위해 catalog를 삭제하거나 운영 schema를 추측하지 않는다.

현재 정적 회귀는 다시 44/44 통과했다. 실제 migration, preflight, verify, integration
runner, 브라우저 E2E는 모두 미실행이며 8단계 완료로 간주하면 안 된다. 정확한 환경
점검, migration별 상태, 설치 준비, 재개 지점과 운영 차단 조건은
`docs/research/functional-audit-stage-8-local-integration.md`를 따른다.

## 17. 2026-09-12 8단계 최종 상태: 로컬 DB 완료, 브라우저 E2E blocker

이전 8단계 메모의 환경 및 신규 설치 blocker를 해결하고, 기존 변경을 보존한 채 새
disposable loopback Supabase에서 전체 체인을 재현했다. Git 이력
`2113e189eb8e788ac8efbddb48178a3d08a13e01`/
`c6f84b06f059fe0990122471840f6cd67472e9ab`의 2026-08-15 Table Editor 정의를
`scripts/core_schema.sql`로 복원했고, house의 `quantity`/layout `id` 및 daily quest의
`created_at` 차이는 명시적인 local-test-only compatibility fixture로만 보충했다.

실패한 disposable project는 매번 중단하고 새 project로 다시 시작했다. 이 과정에서
최신 Supabase가 관리하는 `realtime.messages` RLS ALTER, daily quest `created_at` 부재,
006의 기존 함수 인자명 불일치, bootstrap cleanup의 psql `-c` 변수 치환 오류를 실제로
발견해 최소 수정했다. 최종 새 project에서는 historical/core → local fixtures → 001 →
catalog sync → transactional preflight → 002–003 → User Event preflight → 004–005 →
experiment preflight → 006 → 두 verify → integration runner 4개 → cleanup 순서가 모두
통과했다. catalog는 동기화 및 cleanup 뒤 모두 1,000행/995 canonical이었고 QA auth
user/participant는 0/0이었다.

실제 브라우저에서는 origin-isolated A/B 로그인, refresh session 복구, 출석 중복 방지,
로컬 opt-in route, World/Library/ Music 진입, quest overlay 입력 차단/복구, 미처리 음원
annotation 패널, skip double-click 단일 저장, UI 오류 redaction을 확인했다. 그러나 첫
Music 음원의 `/audio/Music/13433` mp3/wav/ogg가 모두 저장소에 없어 404가 발생했고
정상 annotation 입력이 설계대로 비활성화됐다. 따라서 정상 annotation 이후 제외,
브라우저 vote, 최종 완료/재시작, 실제 A/B Presence/Broadcast는 실행하지 못했다. 사용
가능한 브라우저가 단일 profile이라 A/B도 별도 origin으로만 격리했으며, 진짜 두
browser context 검증은 남아 있다.

E2E 종료 후 추적한 두 participant의 auth/session/event/result/attendance/quest/currency/
room 관련 행만 삭제했고 participant/auth/소유 행은 모두 0, catalog는 1,000/995임을
재확인했다. 앱 서버와 정확한 audit Supabase project를 종료하고 해당 단일 임시
디렉터리를 제거했으며, 사용자의 기존 port 3000 개발 서버는 건드리지 않았다.

최종 회귀는 정적/단위 53/53(기존 44 + readiness 9), runner 문법, bootstrap shell
문법, 변경 security 파일 ESLint, `git diff --check`, Next 16.2.7 webpack build 26 routes,
browser static bundle service-role 식별자 부재가 통과했다. production build의 내부
route는 실제 HTTP 404와 `noindex, nofollow, noarchive`를 반환했다.

최종 판정은 **Stage 8 blocked**다. 로컬 DB 통합 검증은 완료됐지만 오디오 corpus/경로를
복구한 뒤 genuinely separate contexts에서 남은 browser matrix를 재실행해야 한다.
local-only fixture를 사용했으므로 production/staging schema 호환 또는 운영 적용 준비
완료로 표현하지 않는다. 상세 실행 결과와 정확한 재개 지점은
`docs/research/functional-audit-stage-8-local-integration.md`에 있다.

## 18. 2026-09-13 Stage 8B 완료: Git 오디오 fixture와 실제 분리 context

이전 `Stage 8 blocked` 판정은 로컬 browser E2E에 한해 해소됐다. `b189395^`의 571개
historical MP3와 현재 1,000행/995 canonical catalog를 비교한 결과 exact zone/path
복구 가능 범위는 85행/80 canonical뿐이었다. 번호만 같고 zone이 다른 22행은 사용하지
않았고 893행은 기대 경로 blob이 없었다. alias 5쌍은 모두 exact shared blob이 있었다.

Git object에서 MP3 8개만 `/private/tmp` disposable 앱에 복구했다. 외부 다운로드,
원격 storage, 생성 음원은 사용하지 않았고 worktree·commit·push·deploy·build artifact에
MP3를 넣지 않았다. Playwright Chromium 한 process의 독립 context A/B에서 정상 재생,
annotation, 재진입/reload canonical 제외, alias 수렴, vote playback gate/rapid duplicate/
alias, 마지막 annotation transaction 완료, 완료 reload·replacement context 복구,
cross-participant 차단, 실제 private Presence/Broadcast, unmount absence, 동일 mounted
WorldMap의 connect/disconnect/reconnect 이벤트를 통과했다.

이 과정에서 Strict Mode effect replay 뒤 `mountedRef`가 false로 남아 annotation/museum
async 성공 콜백을 막는 결함을 발견해 setup에서 true로 복구하도록 수정하고 회귀 테스트를
추가했다. 최종 browser event 117행의 결과 연결과 민감정보/좌표 부재를 검사했다. cleanup은
auth 0, E2E participant 0, 소유 행 0, catalog 1,000/995였다. 최종 회귀는 60/60,
ESLint 0, diff check, syntax, webpack build 27 routes, browser bundle secret scan, build MP3
0, production 내부 route 404/noindex가 통과했다.

새 판정은 **Stage 8 local integration and browser E2E complete. Production readiness
remains blocked.** 남은 운영 gate는 전체 995 canonical audio corpus 배포/coverage,
local-only house/quest fixture 의존 제거, authorized staging schema 리허설, Realtime
dashboard 설정 확인, alias category 충돌 3건의 연구자 결정이다.

## 19. 2026-09-13 Stage 9 로컬 readiness 준비

전체 production corpus와 staging schema를 제공받지 않은 상태에서 거짓 readiness를
만들지 않고 다음 입력을 안전하게 검사할 도구와 운영 문서를 준비했다.

- `audio-corpus-readiness.mjs`: 1,000 metadata/995 canonical, alias/path/zone/category,
  SHA-256/크기/MIME/codec/duration/decode, duplicate blob/cross-zone filename,
  license/provenance를 검사하며 995/995가 아니면 실패한다.
- `schema-reconciliation-snapshot.sql`과 validator: row data 없이 column/constraint/index/
  RLS/policy/grant/function signature를 수집·검사하고 local-only fixture 차이를 숨기지 않는다.
- Stage 9 보고서: 연구 정책 결정표, staging rehearsal, A/B/저속망/동시접속/Realtime matrix,
  User Event reconciliation, pilot/production Go/No-Go 및 다음 handoff를 통합했다.

현재 worktree의 production 경로에는 오디오가 없어 완전 검증은 0/995이며, staging
schema inventory도 없어 실제 호환성은 미검증이다. `participant_room`의 authenticated
직접 write grant가 RPC-only room-save 설명과 충돌하는 점도 새 blocker로 기록했다.
상세 기준은 `docs/research/functional-audit-stage-9-readiness.md`를 따른다.

판정: **Stage 9 local readiness preparation complete. Production readiness remains blocked.**

## 20. 2026-09-14 Stage 10 로컬 보안·lint·입력 패키지

`participant_room`의 authenticated 직접 write grant와 INSERT/UPDATE policy를 새 forward
migration 007에서 제거하고, owner SELECT와 authenticated-only `save_participant_room_v3`
RPC만 유지했다. validator의 모순된 policy 요구도 RPC-only contract로 수정했다. 새
disposable loopback Supabase에서 001–007과 4개 integration runner가 통과했고, room 직접
INSERT/UPDATE/DELETE 거부, RPC 저장/멱등성/동시 whole-snapshot 수렴, cross-owner/share
경계, room 성공 이벤트 단일 저장과 payload 민감정보 부재를 검증했다. cleanup은 최종
auth/QA participant 0/0, catalog 1,000/995였다.

전체 lint 334 errors/46 warnings를 생성물·디자인 support runtime·실제 source로 분류했다.
`.next-*`와 정확한 design support 파일만 제외하고 실제 앱의 ref/purity/effect/link 문제를
수정해 전체 유효 source lint 0/0을 만들었다. 공통 ZoneMap은 별도 loopback 브라우저에서
렌더링했고 hydration floating-point 차이도 안정화한 뒤 console error 0을 확인했다.

오디오 delivery template과 schema inventory 전달 절차를 추가했고 snapshot이 row data와
함수 body를 포함하지 않음을 테스트로 고정했다. 운영/staging에는 연결하지 않았다.
전체 corpus와 sanitized staging inventory 및 연구 정책 승인이 없으므로 최종 판정은
**Stage 10 local hardening complete. Production readiness remains blocked.** 상세 내용은
`docs/research/functional-audit-stage-10-local-hardening.md`를 따른다.

## 21. 2026-09-14 Stage 10B browser closure

후속 교차 감사의 세 공백을 닫았다. schema validator는 authenticated room TRUNCATE를
INSERT/UPDATE/DELETE와 각각 독립 blocker로 검사하고, 실제 disposable catalog inventory도
통과했다. migration 007 이후 별도 Playwright Chromium context A/B가 실제
`InteriorDecorRoom` 저장, 실패 상태 보존/재시도, 새로고침, A 전용 storage state를 쓴
교체 context 복구, 동일 key replay, 직접 쓰기와 cross-participant 차단, User Event
linkage/redaction을 통과했다.

코드 계산상 production의 Animal/Human/Nature/Urban/Music/Lab은 모두 전용 map을 사용해
공통 `ZoneMap` 전체 컴포넌트의 production direct consumer는 없다. 유일한 직접 렌더는
보호된 `/lab-test`의 Lab이다. 이 경로에서 hydration/console, 캐릭터/HUD, 키보드/D-pad,
animation, 경계 collision, collectible/annotation overlay, 입력 차단·복구, Enter repeat,
Escape/exit confirm, 세 viewport, resize/reload/re-entry를 통과했다. 의미가 같은 새 sounds
reference를 포함한 모든 유지 조건에서 item ID/좌표가 안정적이었다. 배치 memo key는
participant/response 없이 sound ID와 block만 사용하고 기존 최초 순서를 보존한다.

최종 84/84 정적·단위, 네 DB runner, 두 Stage 10B browser runner, ESLint 0/0,
`.env*` 없는 webpack build 27 routes, production 내부 route 404/noindex, browser bundle
secret scan, build audio scan, cleanup 0/0/0/0과 catalog 1000/995가 통과했다. 전체 corpus와
sanitized staging inventory는 여전히 없다. 상세 근거는
`docs/research/functional-audit-stage-10b-browser-closure.md`, 다음 결정 입력은
`docs/research/stage-11-policy-decision-package.md`를 따른다.

판정: **Stage 10 local hardening and browser closure complete. Stage 11 policy decisions and authoritative external inputs remain blocked.**
