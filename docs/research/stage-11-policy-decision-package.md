# Stage 11 research policy decision package

Date: 2026-09-14 (Asia/Seoul)

Status: decision input only. No policy-dependent feature in this document is implemented.
Stage 10 local/browser closure has passed, but authoritative corpus/schema inputs, authorized
staging rehearsal, and pilot evidence remain required.

## 1. Three canonical category conflicts

- **현재 상태:** three source-backed canonical identities each retain two metadata labels:
  `fsd50k:248110` Rain/Thunder, `fsd50k:179173` Bell/Dishes and pots and pans, and
  `fsd50k:2510` Explosion/Fireworks. Result uniqueness remains one row per canonical.
- **권장안:** keep one canonical identity and approve either one primary analysis label or an
  explicit multi-label analysis rule for each conflict while retaining both source labels.
- **가능한 대안:** split the identity/blob into two trial targets; or exclude the three from
  category-stratified analysis. Splitting is not recommended.
- **연구 타당성 영향:** an undocumented choice changes category denominators; splitting would
  double-expose identical stimuli and invalidate the established uniqueness model.
- **보안·개인정보 영향:** minimal; the approval record must not contain participant data.
- **참가자 UX 영향:** primary-label choice may change displayed category grouping; multi-label
  can make grouping less predictable unless copy is explicit.
- **필요한 코드·DB 변경:** controlled review mapping, analysis view/protocol, category display
  expectations, and corpus manifest; preserve historical source labels.
- **staging 재검증 범위:** catalog sync, 1,000/995 validator, alias uniqueness, A/B assignment,
  category counts, and representative playback/navigation.
- **사용자가 답해야 할 정확한 질문:** “세 canonical 각각에 대해 primary label 하나를
  선택할까요, multi-label 분석 규칙을 승인할까요? 선택한 label/rule을 명시해 주세요.”

## 2. Participant one-time claim secret

- **현재 상태:** participant ID and registered group are enough for the first anonymous-auth
  claim; there is no secret, gateway limit, or reissue ceremony.
- **권장안:** issue a per-participant one-time secret, store only a server-side hash, consume it
  atomically with claim, limit retries, and audit operator reissue.
- **가능한 대안:** retain ID-only claim; add external account authentication; add CAPTCHA as a
  measured-risk supplement rather than the primary identity proof.
- **연구 타당성 영향:** prevents another person from claiming a study identity and contaminating
  assignment/results; adds a credential-delivery step that must be standardized.
- **보안·개인정보 영향:** materially improves claim security. Raw secrets must never enter Git,
  URLs, User Events, logs, or support screenshots.
- **참가자 UX 영향:** one additional field and possible lockout/reissue support.
- **필요한 코드·DB 변경:** registry hash/consumed fields, atomic claim function/API, redacted UI
  errors/events, retry/rate-limit operations, secure generation/delivery/reissue tooling.
- **staging 재검증 범위:** correct/wrong/replayed/expired secret, concurrency, group spoofing,
  logging redaction, rate limits, A/B claim, and old-client rejection.
- **사용자가 답해야 할 정확한 질문:** “participant별 1회용 claim secret을 필수화하고,
  실패 허용 횟수·유효기간·재발급 책임자를 어떻게 정할까요?”

## 3. Lost auth recovery and rebind

- **현재 상태:** clearing browser storage loses anonymous auth; recovery is an operator-assisted
  manual rebind risk and no repository workflow exists.
- **권장안:** operator identity verification followed by a new one-time recovery secret and an
  atomic rebind that revokes the old auth session while retaining the same round/data.
- **가능한 대안:** no recovery; public self-reset; start a new participant/round. Public reset is
  not recommended.
- **연구 타당성 영향:** consistent recovery reduces attrition without duplicating rounds; an
  uncontrolled rebind can merge different people or alter exposure order.
- **보안·개인정보 영향:** recovery is account takeover-sensitive and needs least privilege,
  incident audit, old-session revocation, and no public auth-user clearing endpoint.
- **참가자 UX 영향:** support pause and identity check, followed by resumable progress.
- **필요한 코드·DB 변경:** operator-only rebind RPC/tool, recovery-secret hash, incident/reason
  record, session revocation, support copy, and safe event codes.
- **staging 재검증 범위:** lost storage, old-token rejection, same-round resume, concurrent old/new
  client, wrong-person denial, and cleanup/export linkage.
- **사용자가 답해야 할 정확한 질문:** “어떤 본인확인 절차와 승인 역할로 rebind하며,
  복구 후 기존 round를 계속할지 새 round로 보낼지 정해 주세요.”

## 4. Multiple-tab/device lease and takeover

- **현재 상태:** DB deduplication protects many writes, but multiple active clients can still
  mix stimulus order, timing, queues, and Realtime behavior.
- **권장안:** one active experiment-client lease per participant/round with heartbeat, a visible
  second-client block, and a controlled takeover rule.
- **가능한 대안:** allow all concurrent clients; allow multiple tabs on one device only; warn
  without blocking.
- **연구 타당성 영향:** a lease protects exposure order and interpretable time/event sequence;
  takeover policy determines whether interruption counts as continuation.
- **보안·개인정보 영향:** lease rows need opaque client IDs, expiry, least-privilege access, and
  no device fingerprinting beyond necessity.
- **참가자 UX 영향:** clear “already open” message, wait/return option, and approved takeover path.
- **필요한 코드·DB 변경:** round-scoped lease table/RPC, heartbeat, queue ownership, takeover audit,
  UI, tab lifecycle, and expiry recovery.
- **staging 재검증 범위:** simultaneous tabs/devices, stale lease, offline/reconnect, takeover race,
  final flush, and A/B isolation.
- **사용자가 답해야 할 정확한 질문:** “한 round에 active client 하나만 허용할까요? lease
  만료 시간과 participant/operator takeover 권한을 각각 정해 주세요.”

## 5. Retest and experiment round

- **현재 상태:** completed current round is restored and no public reset/retest path exists.
- **권장안:** retest disabled by default; researcher-only round increment with protocol-approved
  reason and immutable linkage to earlier rounds.
- **가능한 대안:** permanent no-retest; participant self-service retest; delete/reopen old results
  (not recommended).
- **연구 타당성 영향:** audited rounds expose selective retesting and learning effects; deletion
  would destroy provenance and bias analysis.
- **보안·개인정보 영향:** increment authority and reason records require restricted access/audit.
- **참가자 UX 영향:** participant sees a clear completed state unless a researcher explicitly
  opens a new round.
- **필요한 코드·DB 변경:** operator RPC/tool, grant boundary, reason/approval fields, round-aware
  UI/export, assignment/completion reset only for the new round.
- **staging 재검증 범위:** unauthorized denial, increment concurrency, old result immutability,
  new session/assignment, export linkage, rewards, and event round separation.
- **사용자가 답해야 할 정확한 질문:** “retest를 허용할 조건·승인자·사유 taxonomy와
  최대 round 수를 무엇으로 정할까요?”

## 6. Completion screen and external survey transition

- **현재 상태:** the app restores a static completion screen; there is no approved survey redirect
  or operator handoff rule.
- **권장안:** show non-sensitive saved/flush confirmation and protocol-approved next steps; redirect
  only after core result commit and final event flush, with a visible fallback link.
- **가능한 대안:** keep static thank-you; operator-issued completion code; automatic redirect.
- **연구 타당성 영향:** correct ordering prevents survey arrival before study completion and
  reduces missing debrief/compensation linkage.
- **보안·개인정보 영향:** allowlist destination origins and never place participant/auth/share
  identifiers in the URL unless separately approved and purpose-limited.
- **참가자 UX 영향:** clear completion assurance, retry/fallback on survey failure, accessible copy.
- **필요한 코드·DB 변경:** completion UI state, flush handshake, destination allowlist/config,
  fallback behavior, accessibility, and event instrumentation.
- **staging 재검증 범위:** normal/slow/offline final save, event flush timeout, reload, popup/redirect
  failure, URL redaction, and double completion.
- **사용자가 답해야 할 정확한 질문:** “완료 후 목적지는 정적 안내·completion code·외부
  설문 중 무엇이며, 승인된 정확한 URL과 자동 이동/수동 버튼 정책은 무엇인가요?”

## 7. Reconnect definition

- **현재 상태:** `duo_reconnected` means partner absence then presence while the observing
  WorldMap remains mounted; reload/remount uses session/screen events instead.
- **권장안:** retain this same-mounted-map definition and document reload/remount separately.
- **가능한 대안:** count every remount as reconnect; add server connection-episode IDs and derive
  reconnects analytically.
- **연구 타당성 영향:** stable semantics make reconnect rates comparable; mixing remount and
  transient presence loss makes the metric ambiguous.
- **보안·개인정보 영향:** current opaque peer/client IDs are sufficient; episode storage would add
  retention/access surface.
- **참가자 UX 영향:** little direct effect; a future episode model may improve reconnect feedback.
- **필요한 코드·DB 변경:** recommended choice needs documentation/query changes only; episode
  alternative needs table/RPC/client linkage.
- **staging 재검증 범위:** first connect, peer leave/return, observer remount, reload, network flap,
  duplicate event suppression, and private-channel membership.
- **사용자가 답해야 할 정확한 질문:** “`duo_reconnected`를 동일 mounted map의 presence
  회복으로 확정할까요, 아니면 server episode 기반 정의를 새로 도입할까요?”

## 8. User Event retention, withdrawal, deletion, and export

- **현재 상태:** append-only collection/minimization and restricted researcher reads exist, but
  no approved retention duration, withdrawal cutoff, deletion/anonymization job, export format,
  access roster, or backup alignment exists.
- **권장안:** derive an exact policy from IRB/consent/data-management approval: pseudonymous
  minimum retention, named least-privilege readers, audited encrypted export, and tested
  withdrawal/deletion including backups.
- **가능한 대안:** irreversible early anonymization; retain identifiable linkage for a fixed
  approved interval; indefinite identifiable retention (not recommended).
- **연구 타당성 영향:** deletion/anonymization may limit longitudinal linkage and reproducibility;
  the analysis plan must state how withdrawals affect denominators and derived datasets.
- **보안·개인정보 영향:** this is a production blocker. Raw events and identity linkage require
  access control, audit, encryption, retention enforcement, and backup handling.
- **참가자 UX 영향:** consent/withdrawal copy must state what can be deleted, by when, and what
  aggregated outputs may remain.
- **필요한 코드·DB 변경:** retention metadata, operator export/delete/anonymize jobs, subject
  lookup, access review/audit, encrypted delivery, backup schedule, and verification reports.
- **staging 재검증 범위:** authorized/unauthorized export, redaction, withdrawal lookup, cascade or
  anonymization integrity, replay/idempotency audit preservation, and backup restore behavior.
- **사용자가 답해야 할 정확한 질문:** “IRB/동의서 기준 보존 기한, 철회 가능 시점,
  삭제 대 익명화 범위, export 형식, 접근자 명단과 승인 절차를 정확히 정해 주세요.”

## 9. Friend-room praise scope

- **현재 상태:** praise is an ephemeral local toast, while copy incorrectly implies notes or
  rewards accumulate. No recipient event/result, moderation, or persistence exists.
- **권장안:** keep praise explicitly ephemeral for the pilot and correct the misleading copy.
- **가능한 대안:** constrained fixed reactions; stored free text. Fixed reactions are safer than
  free text if persistence is scientifically required.
- **연구 타당성 영향:** persistent social feedback can alter subsequent behavior and becomes an
  experimental intervention; ephemeral decoration should not be analyzed as delivered praise.
- **보안·개인정보 영향:** persistence adds recipient visibility, RLS, rate limit, abuse/report,
  moderation, retention, withdrawal, and export obligations.
- **참가자 UX 영향:** accurate copy prevents false expectations; fixed reactions can provide real
  feedback without free-text abuse risk.
- **필요한 코드·DB 변경:** recommended choice changes copy only. Persistence requires reaction
  schema/RPC, notification/display, policies, moderation, limits, events, and governance.
- **staging 재검증 범위:** ephemeral no-write proof and copy; or, for persistence, cross-owner RLS,
  spam/rate limits, block/report, retention/deletion, and A/B behavioral effects.
- **사용자가 답해야 할 정확한 질문:** “pilot에서 칭찬을 ephemeral UI로 확정할까요,
  fixed reaction으로 저장할까요? free text가 꼭 필요하다면 연구 목적과 moderation 책임자를 명시해 주세요.”

## 10. Pilot size and stop criteria

- **현재 상태:** local automated evidence exists, but no authorized staging rehearsal or balanced
  participant pilot has been completed.
- **권장안:** scripted researcher QA followed by at least eight consented, disposable/tagged pilot
  participants balanced 4/4 A/B; expand only on protocol/statistical-owner approval.
- **가능한 대안:** internal QA only; smaller exploratory pilot; staged larger pilots.
- **연구 타당성 영향:** balanced real-user evidence exposes comprehension, timing, recovery, and
  group-specific defects; pilot data must not silently enter the main analysis.
- **보안·개인정보 영향:** pilot identities/data need the same access, consent, retention, deletion,
  incident, and cleanup controls as the approved policy requires.
- **참가자 UX 영향:** support scripts, interruption messaging, debrief, compensation, and recovery
  ownership must be ready before recruitment.
- **필요한 코드·DB 변경:** usually configuration/tagging and analysis exclusion; operationally,
  approved protocol, monitoring dashboard, incident log, support/stop runbook, and evidence review.
- **staging 재검증 범위:** A/B complete journey across supported viewport/network classes,
  concurrent/recovery cases, event/result reconciliation, Realtime, cleanup/export, and restore.
- **사용자가 답해야 할 정확한 질문:** “pilot 참가자 수와 A/B 배분, 지원 기기/네트워크,
  P0/P1 중단 조건, 중단 결정권자, 재개 승인 조건을 확정해 주세요.”

## Decision gate

Do not implement any item until the user/research owner answers its exact question and the
answer is reflected in the approved protocol, security/privacy review, and staging test plan.
