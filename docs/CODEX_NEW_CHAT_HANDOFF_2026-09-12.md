# SoundMimic Village 새 Codex 채팅 인수인계

작성 기준일: 2026-09-12 (Asia/Seoul)

프로젝트: `/Users/hyera/Documents/SoundVillage-house-decor-2d`

브랜치/HEAD: `house-decor-2d` / `a8b8091ab7bc25839551be63d54927dcce0cb094`

현재 단계: **Stage 8 blocked — 로컬 DB 통합 완료, 필수 브라우저 E2E 일부 미완료**

이 문서는 새 Codex 채팅이 이전 대화 없이도 현재 작업을 안전하게 이어가기 위한
요약 인수인계다. 상세 근거와 실행 기록은 아래 원본 문서를 함께 읽어야 한다.

## 1. 새 채팅이 반드시 먼저 지킬 것

- 현재 worktree의 tracked/untracked 변경은 모두 사용자 소유다.
- `git reset`, `git checkout`, `git clean`, stash, 광범위한 restore를 실행하지 않는다.
- unrelated 파일을 정리하거나 포맷팅하지 않는다.
- 운영, Preview, staging Supabase에 접속하지 않는다.
- 운영 환경에 SQL, migration, catalog sync, 테스트 데이터를 적용하지 않는다.
- `.env.local`의 원격 URL이나 key를 migration, integration runner, E2E에 사용하지 않는다.
- DB 검증은 `/private/tmp`의 새 disposable Supabase와 loopback URL에서만 수행한다.
- service-role key, participant/auth ID, share token, 원시 event payload를 출력하지 않는다.
- 실행하지 않은 검증을 통과로 기록하지 않는다.
- 기존 port 3000 서버나 무관한 container/process를 종료하지 않는다.
- `AGENTS.md`를 먼저 읽는다. Next.js 코드를 변경하기 전에는
  `node_modules/next/dist/docs/`의 설치 버전 문서를 확인한다.

현재 worktree에는 감사 이전부터 존재한 대량의 수정·신규 디자인/기능 파일과 Stage
1~8 변경이 함께 있다. 이 문서는 commit 경계를 의미하지 않으며, 새 채팅은 어떤
변경도 자기 작업이라고 가정하면 안 된다.

## 2. 프로젝트와 실험의 확정 전제

- 공개 회원가입 서비스가 아니라 연구자가 participant ID를 사전 발급하는 실험이다.
- participant ID와 A/B 그룹은 사전에 등록되고, 최초 claim 후 `auth.uid()`와 원자적으로
  연결된다.
- 한 참가자의 현재 실험은 자신에게 할당된 **모든 canonical audio를 정상 annotation**
  하면 완료된다.
- 완료한 참가자는 새 session이나 출석/시작 보상 흐름에 다시 들어가면 안 된다.
- 정상 annotation은 participant + experiment round + canonical audio당 1회다.
- 이미 정상 annotation한 음원은 재진입·새로고침 후 목록에서 제외되어야 한다.
- vote는 participant + experiment round + canonical audio당 반드시 1회다.
- 다른 `sound_id` alias라도 같은 canonical audio면 두 번째 annotation/vote가 아니다.
- skip은 기록으로 남지만 정상 완료 수에 포함하지 않으며 현재 계약상 다시 응답할 수 있다.
- 박물관 vote는 해당 후보 음원의 실제 재생 시작 전에는 불가능하다.
- 날짜 경계는 DB의 KST(`Asia/Seoul`) 기준을 사용한다.
- 현재 UI가 측정하지 않는 `difficulty`, `selected_features`의 신규 값은 `null`이다.
  과거 기본값은 자동으로 다시 쓰지 않는다.
- User Event에는 좌표, pointer move, held-key frame, 입력 중 표현 원문, 초대 URL,
  share token, key/token/SQL 오류를 저장하지 않는다.
- duo reconnect는 현재 같은 mounted `WorldMap` 안에서 실제 partner presence → absence →
  presence가 관찰된 경우만 의미한다. reload/remount/browser restart까지 reconnect로 넓히는
  것은 아직 정책 결정 전이다.

## 3. 단계별 완료 현황

### Stage 1 — 내부 QA/test/preview 경로 차단

- production/Preview에서 서버 404 처리
- 로컬에서 서버 전용 opt-in 플래그로만 활성화
- production HTTP 검증에서 404 및 `noindex, nofollow, noarchive` 확인
- 내부 경로 정적 회귀 4/4

### Stage 2 — 참가자 인증과 RLS

- Supabase Anonymous Auth + 사전 등록 participant claim
- 인증 매핑 기반 RLS
- participant/group 위조 및 교차 접근 차단
- private 친구 방/Realtime 정책과 제한 RPC
- service-role 전용 구매 Route Handler
- 주요 파일: `scripts/security/001_auth_foundation.sql`,
  `scripts/security/002_enforce_participant_rls.sql`, `lib/participantAuth.js`,
  `lib/supabaseAdmin.js`, `app/api/participant-session/claim/route.js`

### Stage 3 — 트랜잭션과 멱등성

- annotation, vote, 출석, 퀘스트, 구매, 착용, room save의 원자성/멱등성
- `idempotent_operations`, 원장/잔액 잠금, 음수 잔액 방지
- 중복 요청과 동시 요청이 하나의 결과로 수렴
- 주요 파일: `scripts/security/003_transactional_integrity.sql`,
  `lib/persistenceResult.js`

### Stage 4 — User Log

- `study_sessions`, append-only `user_events`, batch RPC와 클라이언트 큐
- 이벤트 ID 및 sequence 중복 방지, participant 큐 격리, retry/final flush
- screen/zone/annotation/vote/shop/room/attendance/quest/Realtime 등 의미 이벤트 계측
- 실패 로그가 핵심 결과 transaction을 rollback하지 않음
- 분석 SQL과 inventory 문서 작성
- 주요 파일: `scripts/security/004_user_event_logging.sql`, `lib/userEvents.js`,
  `scripts/security/user-event-analysis.sql`

### Stage 5 — 오디오 lifecycle

- 사운드별 청취 상태 분리
- target 변경/unmount/failure 시 상태 초기화
- museum playback eligibility와 canonical 음원 identity 반영
- 관련 회귀 3/3

### Stage 6 — 입력/overlay/빠른 연속 호출

- overlay 중 배경 이동 차단 및 기존 이동 상태 즉시 해제
- overlay 종료 후 새 입력부터 복구
- Enter/Escape repeat 차단
- claim, annotation/skip, vote, 구매, 착용, room save, 링크 복사 in-flight guard
- 피드백 2,400ms 및 timer cleanup
- Library 카드 이동 자동 닫힘 제거
- 정확한 close reason과 duo reconnect 계측
- Stage 6 lifecycle 7/7, input lifecycle 2/2 등 당시 총 33개 통과

### Stage 7 — 실험 규칙·canonical identity·완료 처리

- metadata 1,000행을 canonical audio 995개로 정규화
- 정확히 5개의 alias 쌍 확인
- 정상 annotation/vote를 canonical 단위로 고유화
- v4 RPC에서 alias, 새 operation key 중복, 동시 요청 수렴
- 마지막 정상 annotation과 session 완료/result 연결을 같은 transaction으로 처리
- 완료 participant의 server progress 복구와 신규 session/출석 흐름 차단
- KST helper 도입
- `difficulty`, `selected_features` 신규 값을 null로 고정
- 박물관 재생 시작 전 vote 차단
- quest row impression과 collectible proximity-edge 이벤트 추가

### Stage 8 — disposable local 통합

로컬 DB 체인은 실제로 완료됐다.

- Supabase CLI 2.117.0, Colima 0.10.3, Docker CLI 29.8.0 사용
- 새 `/private/tmp/soundvillage-stage8.*` project에서 처음부터 재현
- core/historical → local-only compatibility → 001 → catalog sync → preflight →
  002~005 → experiment preflight → 006 → verify → runner 4종 → cleanup 순서 통과
- catalog sync/cleanup 후 모두 1,000행 / canonical 995개
- integration runner 4/4 프로세스 통과
  - RLS
  - transactional integrity
  - User Event
  - full-catalog experiment rules
- 정적·단위 테스트 53/53, Stage 8 readiness 9/9
- 변경 security 파일 ESLint, runner/shell 문법, `git diff --check` 통과
- Next.js 16.2.7 Webpack build 26 routes 성공
- browser bundle service-role 식별자 없음

Stage 8에서 실제 발견·수정한 결함:

1. 최신 Supabase 관리 테이블 `realtime.messages`에 대한 불필요한 RLS ALTER
2. historical daily quest schema의 `created_at` 부재
3. migration 006의 기존 `ensure_today_quests` 함수 인자명 불일치
4. bootstrap cleanup의 `psql -c` 변수 치환 오류
5. full-catalog sync 순서와 빈 catalog runner fixture 충돌
6. DNS hostname을 통한 loopback guard 우회 가능성

DB/E2E 데이터는 정확한 QA identity만 cleanup했고, 최종 participant/auth/소유 행은 0,
catalog는 1,000/995임을 확인했다. 사용한 앱 서버와 Supabase stack도 종료·삭제했다.

## 4. Stage 8이 아직 blocked인 이유

브라우저에서 첫 Music 음원 `/audio/Music/13433.mp3`와 wav/ogg fallback이 404였다.
따라서 다음 실제 브라우저 검증을 완료하지 못했다.

- 정상 annotation과 재진입/새로고침 후 제외
- annotation alias 및 빠른/동시 중복
- vote playback gate와 한 사람·한 canonical 음원 1회
- vote alias 및 빠른/동시 중복
- 마지막 annotation의 session 완료
- 화면 이동, 새로고침, browser context 재생성 후 완료 복구
- 진짜 별도 browser context A/B 격리
- 실제 A/B private Presence/Broadcast 및 unmount/reconnect

이미 브라우저에서 확인한 항목:

- origin-isolated A/B 로그인과 session 생성
- 새로고침 session 복구
- 참가자별 출석 중복 방지
- 로컬 내부 경로 opt-in
- World/Library/Music 이동
- overlay 입력 차단·복구
- 미처리 annotation panel 진입
- skip double-click 단일 저장
- 친화적인 오디오 오류와 민감정보 redaction

## 5. 오디오 blocker의 핵심 Git 근거

현재 `public/audio`는 없고 `.gitignore`가 `*.mp3`를 제외한다. commit
`b18939509f07ffdf7fdb546db6a94a4b72576372`는 대용량 오디오를 Git에서 제거한
commit이며, 직전 tree `b189395^`에는 `public/audio` 파일 571개가 존재한다.

다음 E2E 필요 파일이 `b189395^`에 실제 존재한다.

- `public/audio/Music/13433.mp3`
- `public/audio/Nature/248110.mp3`
- `public/audio/Nature/147182.mp3`
- `public/audio/Nature/420296.mp3`
- `public/audio/Lab/179173.mp3`
- `public/audio/Lab/2510.mp3`

`Music/13433.mp3` blob 크기는 260,876 bytes다. 외부 다운로드나 임의 음원 생성 없이
Git object에서 **임시 E2E 앱 복사본에만** 필요한 파일을 복구할 수 있다.

주의:

- 과거 tree는 571개, 현재 catalog는 995 canonical이므로 전체 corpus로 간주하지 않는다.
- 현재 worktree의 `public/audio`에 복구하거나 commit/push/deploy하지 않는다.
- 파일 번호만 같고 zone이 다른 파일을 대신 사용하지 않는다.
- metadata `file_path`와 과거 Git 경로가 정확히 일치하는 파일만 쓴다.
- 복구된 파일은 local-only E2E fixture이며 production asset readiness 증거가 아니다.

## 6. 새 채팅이 바로 수행할 Stage 8B

상세 실행 지시는 이 문서 맨 아래의 프롬프트를 따른다. 핵심 순서는 다음과 같다.

1. 현재 diff와 기존 감사 결과 재확인
2. `b189395^` 오디오 tree와 현재 metadata coverage 비교
3. 새 `/private/tmp` 앱 복사본에 필요한 MP3만 안전하게 추출
4. HTTP 200, MIME, 크기, 실제 browser playback 검증
5. 새 disposable Supabase에서 bootstrap 전체 재실행
6. 두 개의 진짜 독립 browser context A/B 생성
7. 정상 annotation, alias, vote, 완료, restart, Realtime E2E
8. 정확한 QA 데이터 cleanup 및 stack/app 종료
9. 정적 53개+신규 테스트, lint, diff check, build 재검증
10. Stage 8 문서와 본 인수인계 갱신

완료 판정 문구:

> Stage 8 local integration and browser E2E complete. Production readiness remains blocked.

위 문구는 남은 브라우저 matrix가 모두 실제 통과한 경우에만 사용한다.

## 7. Stage 8 이후에도 남는 운영 차단 조건

로컬 Stage 8B가 성공해도 다음은 별도 해결 전까지 운영 준비 완료가 아니다.

- 전체 995 canonical audio corpus의 합법적·검토된 배포 위치와 coverage
- 실제 production/staging schema의 house 컬럼 계약
  - `participant_house_items.quantity`
  - `participant_house_layout.id`
- 실제 daily quest schema의 `participant_daily_quests.created_at`
- 현재 local-only house/quest compatibility fixture와 실제 schema reconciliation
- authorized staging에서 001~006 전체 migration 리허설
- Supabase dashboard에서 Anonymous Auth와 Realtime `Allow public access` 설정 검토
- 운영 participant registry와 claim 재발급/분실 대응 절차
- production 배포 전 backup, maintenance window, rollback/runbook 승인

## 8. 사용자가 결정하거나 직접 준비해야 할 항목

### 바로 결정할 연구 정책

1. alias classification 3건
   - `fsd50k:248110`: Rain 또는 Thunder
   - `fsd50k:179173`: Bell 또는 Dishes and pots and pans
   - `fsd50k:2510`: Explosion 또는 Fireworks
2. 화면 remount, reload, browser restart 후 partner 재등장을 `duo_reconnected`로 볼지
   새 연결로 볼지
3. 친구 방 칭찬 기능
   - 장식용 토스트로 유지
   - 익명 횟수만 저장
   - 발신자·수신자 관계까지 저장
4. 정상 annotation 완료 뒤 이동 정책이 현재처럼 해당 지역 복귀가 맞는지 최종 확인
5. participant ID 최초 탈취 방지를 위해 일회성 claim secret/rate limit/CAPTCHA 중 무엇을
   사용할지

### 사용자가 제공하거나 승인해야 할 운영 자료

1. 전체 오디오 corpus의 보관 위치, 이용 권한/라이선스 및 배포 방식
   - `public/audio` 포함 배포
   - 검토된 CDN/object storage
   - 다른 승인된 방식
2. 데이터가 없는 schema-only production/staging dump 또는 Table Editor 정의
   - secret, row data, token은 제거
3. 별도 staging Supabase 사용 승인과 적용 시점
4. Supabase dashboard 설정을 사람이 직접 확인한 결과
5. 운영 migration 적용 및 rollback 창구에 대한 명시적 승인

Codex는 위 승인이 없으면 운영/Preview/staging에 접속하거나 migration을 적용하면 안 된다.

## 9. Stage 8 이후 권장 단계

1. Stage 8B 브라우저 matrix 완료
2. 전체 audio corpus coverage/배포 readiness 감사
3. 실제 staging schema reconciliation 및 001~006 staging 리허설
4. participant claim 복구·탈취 방지 운영 절차
5. 연구자 결정에 따른 alias classification migration/analysis rule
6. 연구자 결정에 따른 duo reconnect 의미 확장
7. 친구 방 칭찬을 저장하기로 한 경우에만 별도 보안 설계 후 구현
8. 최종 production readiness review
9. 사용자의 명시적 승인 후에만 운영 적용

## 10. 원본 근거 문서

- `docs/CODEX_FUNCTIONAL_AUDIT_HANDOFF.md`
- `docs/research/functional-audit-stage-6.md`
- `docs/research/functional-audit-stage-7.md`
- `docs/research/functional-audit-stage-8-local-integration.md`
- `docs/research/user-event-inventory.md`
- `docs/research/user-event-logging.md`
- `docs/security/participant-auth-rls.md`
- `docs/security/transactional-integrity.md`

## 11. 핵심 코드·SQL·테스트

- `scripts/core_schema.sql`
- `scripts/security/001_auth_foundation.sql`
- `scripts/security/002_enforce_participant_rls.sql`
- `scripts/security/003_transactional_integrity.sql`
- `scripts/security/004_user_event_logging.sql`
- `scripts/security/005_functional_fixes.sql`
- `scripts/security/006_experiment_rules_and_uniqueness.sql`
- `scripts/security/local-test-only-house-compatibility.sql`
- `scripts/security/local-test-only-quest-compatibility.sql`
- `scripts/security/local-supabase-guard.mjs`
- `scripts/security/stage8-local-bootstrap.sh`
- `scripts/security/stage-8-readiness.test.mjs`
- `scripts/security/rls.integration.mjs`
- `scripts/security/transactional-integrity.integration.mjs`
- `scripts/security/user-event-logging.integration.mjs`
- `scripts/security/experiment-rules.integration.mjs`
- `scripts/pilot_clips_v3.json`
- `lib/participantAuth.js`
- `lib/persistenceResult.js`
- `lib/userEvents.js`
- `lib/audioManager.js`
- `components/AnnotationPanel.js`
- `components/SoundMuseum.js`
- `components/WorldMap.js`
- `components/LibraryRoom.js`

## 12. 새 채팅에 붙여 넣을 실행 프롬프트

아래 프롬프트와 이 파일 경로를 새 채팅에 전달한다.

```text
`/Users/hyera/Documents/SoundVillage-house-decor-2d` 프로젝트의 기능 감사 작업을
이어가줘.

먼저 다음 파일을 처음부터 끝까지 읽고, 파일의 사실을 현재 코드·Git 이력·작업
트리와 대조해줘.

`/Users/hyera/Documents/SoundVillage-house-decor-2d/docs/CODEX_NEW_CHAT_HANDOFF_2026-09-12.md`

현재 우선 작업은 Stage 8B다. Stage 8의 disposable local DB 통합은 완료됐지만,
오디오 404 때문에 정상 annotation, vote, 완료/restart, 진짜 별도 A/B browser context,
실제 Realtime E2E가 남아 있다.

Git commit `b189395` 직전 tree에 필요한 오디오가 있으므로 외부 다운로드나 임의
음원 생성 없이, 현재 worktree가 아닌 `/private/tmp`의 disposable 앱 복사본에 필요한
파일만 복구해 E2E를 진행해줘. 과거 오디오를 commit, push, 배포하지 마.

기존 tracked/untracked 변경은 모두 보존하고 운영·Preview·staging Supabase에는 어떤
방식으로도 연결하지 마. `.env.local`의 원격 값을 사용하지 말고, SQL과 테스트 데이터는
새 loopback disposable Supabase에서만 실행해. secret과 participant 식별자는 출력하지 마.

두 개의 genuinely separate browser contexts를 사용해 정상 annotation과 재진입 제외,
canonical alias 중복, 한 사람·한 음원 vote 1회, 동시/더블 클릭, 마지막 annotation의
session 완료, 새로고침/새 context 복구, A/B 격리, private Presence/Broadcast,
unmount/reconnect, User Event 최소화와 오류 redaction을 실제로 검증해줘.

E2E 종료 후 이번 실행에서 만든 QA identity와 데이터만 cleanup하고 catalog 1,000/995를
보존해. 앱 서버와 정확한 disposable stack만 종료해. 정적 회귀, Stage 8 readiness,
lint, diff check, Next.js Webpack build도 다시 실행하고 관련 감사 문서를 실제 결과로
갱신해줘.

모든 브라우저 matrix가 통과한 경우에만 “Stage 8 local integration and browser E2E
complete”로 기록하되, 전체 오디오 corpus와 production/staging schema가 미검증이므로
production readiness는 계속 blocked로 유지해. 실행하지 못한 항목은 통과로 계산하지 마.

작업 중 권한이나 사용자 결정이 반드시 필요한 지점이 아니라면 합리적으로 진행하고,
최종 응답에는 변경 파일, DB/E2E/cleanup/회귀 결과, 남은 운영 blocker, 사용자 결정
항목과 다음 단계를 빠짐없이 정리해줘.
```
