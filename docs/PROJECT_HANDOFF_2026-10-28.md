# SoundMimic Village 프로젝트 인수인계

작성 기준: 2026-10-28 (Asia/Seoul)  
작업 폴더: `/Users/hyera/Documents/SoundVillage-house-decor-2d`  
현재 브랜치: `codex/economy-v1-checkpoint`  
현재 HEAD: `06ffd9e0` (`chore: ignore local presentation artifacts`)  
프로덕션: `https://new-soundvillage.vercel.app`

이 문서는 현재 코드를 처음 넘겨받는 개발자, 연구자, 운영자가 프로젝트의 기능과
위험을 빠르게 이해하기 위한 기준 문서다. 기존 `PROJECT_SUMMARY.md`와 9월 감사 문서는
역사와 상세 검증 근거로는 유용하지만, 브랜치·배포·오디오·최근 기능 상태는 이 문서를
우선한다.

---

## 1. 가장 먼저 알아야 할 결론

1. 이 프로젝트는 일반 게임 서비스가 아니라 **연구용 사운드 어노테이션 실험**이다.
2. 참여자는 사전에 받은 participant ID와 A/B 그룹으로 들어간다.
3. 핵심 연구 결과는 `annotations`, `votes`, `study_sessions`, `user_events` 등에 저장된다.
4. 현재 프로덕션은 **legacy 경제 모드**다. 저장소에 새 경제·캐릭터·듀오 코드가 있어도
   전부 프로덕션에서 활성화됐다고 보면 안 된다.
5. 현재 코드의 새 경제 전환은 `preview`, `cutover`, `maintenance` 모드와 DB migration을
   함께 운영해야 한다. 환경변수만 바꾸거나 코드만 배포하면 안 된다.
6. 프로덕션 오디오는 Git 저장소가 아니라 `NEXT_PUBLIC_AUDIO_BASE_URL`의 외부 공개
   저장소를 사용한다. 로컬 `public/audio`에는 월드맵 배경음 1개만 있다.
7. USER1 공용 시연 로그인은 프로덕션에서 실제 세션 발급까지 확인됐다.
8. 현재 GitHub 원격 브랜치는 최신이지만 `origin/main`에는 병합되지 않았다.
9. 교수님 발표용 PPT와 생성 렌더는 로컬에만 있고 Git/Vercel에서 제외된다.
10. 운영 DB migration, 연구 정책, 오디오 라이선스와 전체 corpus 검증은 코드와 별개의
    승인 대상이다.

---

## 2. Git, 원격 저장소, 배포 구조

### 현재 Git 상태

- 작업 브랜치: `codex/economy-v1-checkpoint`
- 추적 원격: `origin/codex/economy-v1-checkpoint`
- GitHub 원격 `origin`: `HyeraS/SoundVillage.git`
- 별도 원격 `preview`: `HyeraS/new_soundvillage.git`
- 3D 원격 `threed`: `HyeraShin/3D-ver.git`
- `origin/main`은 현재 작업보다 오래된 별도 기준점이다. 현재 브랜치를 검토 없이
  `main`에 강제 병합하거나 덮어쓰면 안 된다.

### 현재 배포

- Vercel project: `new-soundvillage`
- Vercel production alias: `https://new-soundvillage.vercel.app`
- 2026-10-28 프로덕션 배포의 런타임 커밋: `c00cacc0`
- 현재 HEAD `06ffd9e0`은 ignore 규칙만 추가했으므로 앱 런타임은 동일하다.
- 최근 배포는 현재 브랜치의 clean Git archive를 Vercel CLI로 직접 배포했다.
- GitHub `main` push가 자동으로 이 프로덕션을 갱신한다고 가정하지 말고 Vercel project의
  Git integration 설정을 별도로 확인해야 한다.

### 로컬 전용 산출물

다음 항목은 `.gitignore`와 `.vercelignore`에 등록돼 있다.

- `.chart-data-*/`
- `.codex-build/`
- `output/presentation/`
- `tmp/pdfs/repo_visuals.png`
- `tmp/pdfs/source_montage.png`
- `tmp/pdfs/source_pages/`

PPT는 교수님 발표용 자료이며 제품 소스가 아니다. 삭제하지 말고 로컬 보관하되 커밋하지
않는다.

---

## 3. 제품 목적과 참여자 흐름

### 연구 목적

참여자가 다양한 환경음을 듣고 의성어·의태어로 표현한 뒤, 다른 참여자의 표현에 얼마나
동의하는지 평가하게 하는 웹 기반 연구 게임이다.

### 기본 화면 흐름

```text
start
  -> world
  -> zone
  -> annotate
  -> museum
  -> zone 또는 world
  -> 모든 할당 음원 완료 시 complete
```

집과 동행 기능을 사용할 때는 다음 화면도 있다.

```text
world -> house -> world
초대 링크 -> 로그인 -> host의 world/house를 읽기 전용으로 동행
```

### 여섯 마을

- `Music`: 음악 마을, 최초 개방 지역
- `Animal`: 동물 마을
- `Human`: 사람 마을
- `Nature`: 자연 마을
- `Urban`: 도시 마을
- `Lab`: 미지의 소리 마을

일반 참여자는 Music부터 시작하며 Music 블록 1을 완료하면 다른 마을이 열린다. 각 마을은
block 단위로 순차 진행한다.

### 어노테이션

1. 소리 아이템에 접근한다.
2. 소리를 실제로 재생한다.
3. 표현과 confidence를 입력하거나 skip한다.
4. 정상 저장이 성공한 뒤에만 다음 화면으로 이동한다.
5. skip은 기록되지만 정상 완료 수에는 들어가지 않으며 다시 응답할 수 있다.

### Sound Museum

- 자기 그룹이 아닌 반대 그룹의 소리에 대해 다른 참여자 표현을 평가한다.
- 한 음원이 전시 후보가 되려면 annotation이 최소 4개 필요하다.
- 후보 표현은 최대 5개다.
- 해당 음원이 실제 재생된 뒤에만 투표할 수 있다.
- participant + experiment round + canonical audio당 정상 vote는 1회다.

### 완료 조건

참여자에게 할당된 모든 canonical audio에 정상 annotation이 저장되면 해당 experiment
round가 완료된다. 마지막 annotation 저장과 session 완료 처리는 같은 transaction으로
설계됐다. 완료 참가자는 일반적으로 다시 새 실험 session이나 출석 보상 흐름으로
들어가지 않는다.

---

## 4. 사운드 데이터와 canonical identity

`data/sound_metadata.json`의 현재 데이터는 다음과 같다.

- metadata row: 1,000개
- 그룹 A: 500개
- 그룹 B: 500개
- canonical audio: 995개
- zone 분포: Animal 166, Human 169, Lab 169, Music 166, Nature 164, Urban 166
- block 분포: 1~5번 각 180개, 6번 100개

1,000 row와 995 canonical이 다른 이유는 동일 실제 음원을 가리키는 alias row 5쌍이 있기
때문이다. DB uniqueness와 완료 판정은 가능한 한 `sound_id`가 아니라 canonical audio
identity를 사용한다.

연구자가 결정해야 하는 label 충돌 3건이 남아 있다.

- `fsd50k:248110`: Rain / Thunder
- `fsd50k:179173`: Bell / Dishes and pots and pans
- `fsd50k:2510`: Explosion / Fireworks

동일 자극을 두 번 노출하지 않기 위해 canonical identity를 둘로 쪼개는 방식은 권장되지
않는다. 분석용 primary label 또는 multi-label 규칙을 연구자가 문서로 확정해야 한다.

### 오디오 제공 방식

- 실험 음원 전체는 Git에 들어 있지 않다.
- 로컬 `public/audio`에는 월드맵 ambience OGG와 라이선스 문서만 있다.
- 프로덕션은 `NEXT_PUBLIC_AUDIO_BASE_URL/<Zone>/<audio-id>.mp3` 형태를 사용한다.
- `lib/audioPlaybackCore.mjs`가 경로 정규화, 실제 play 성공 확인, 중복 요청 취소,
  transient failure 1회 재시도, 청취 시간 lifecycle을 담당한다.
- 전체 995 canonical의 원격 파일 존재·MIME·라이선스·provenance 검사는 별도 운영 체크다.
- 관련 검사기: `scripts/test-audio-direct-origin.mjs`

---

## 5. 인증과 특수 계정

### 일반 참여자

1. 브라우저에서 Supabase Anonymous Auth session을 만든다.
2. participant ID와 group을 `/api/participant-session/claim`에 보낸다.
3. 서버/DB가 사전 등록된 `study_participants`와 `auth.uid()`를 연결한다.
4. RLS와 RPC는 브라우저가 보낸 participant ID가 아니라 인증 매핑으로 실제 소유자를
   결정한다.

중요한 현재 한계:

- 최초 claim에는 participant ID와 group만 필요하다.
- one-time claim secret, CAPTCHA, gateway rate limit이 아직 없다.
- ID를 먼저 아는 사람이 선점하면 연구 데이터가 오염될 수 있다.
- 브라우저 저장소를 지워 anonymous auth를 잃으면 public self-rebind가 없다.
- 복구는 승인된 운영자 본인확인과 단일 participant rebind 절차가 필요하다.

### session 복구

- 일반 참여자는 같은 탭의 새로고침만 자동 복구한다.
- 탭 또는 브라우저를 새로 열면 participant ID를 다시 입력해야 한다.
- `sessionStorage`의 entry marker와 Supabase session participant가 일치해야 복구된다.
- marker가 없거나 ID가 다르면 fail-closed한다.

### MASTER

- `MASTER`는 연구용 전체 접근 ID다.
- `master@new-soundvillage.local` Supabase 계정에 비밀번호로 로그인한다.
- 새 진입마다 비밀번호를 다시 확인한다.
- 다른 기기의 MASTER session을 로컬 sign-out으로 끊지 않는다.

### USER1

- `USER1`, group `A`만 허용되는 공용 시연 계정이다.
- 브라우저에 비밀번호를 노출하지 않는다.
- 서버의 `SHARED_DEMO_USER_PASSWORD`로
  `user1@new-soundvillage.local`에 로그인한다.
- `study_participants`의 `auth_user_id`, active 상태, A그룹이 모두 일치해야 성공한다.
- 2026-10-28 프로덕션 POST 검사에서 HTTP 200, active USER1/A, access/refresh token 발급을
  확인했다. 토큰 값은 기록하지 않았다.

### 연구용 접근 ID

- 그룹 A 고정: `ALLAUDIO_A`, `ALLAUDIO-A`
- 그룹 B 고정: `ALLAUDIO_B`, `ALLAUDIO-B`
- 그룹 필터 우회: `STUDYALL`, `STUDY-ALL`, `ACCESSALL`, `ACCESS-ALL`, `AUDIOTEST`,
  `AUDIO-TEST`, `RESEARCHER`, `MASTER`

그룹 필터 우회 ID는 A+B 전체 목록으로 배치를 계산하므로 실제 A/B 참가자 화면과 item
배치가 일치하지 않을 수 있다. 실제 그룹 화면 확인에는 `ALLAUDIO_A/B`를 쓴다.
MASTER와 USER1을 제외한 연구용 접근 ID도 일반 claim 경로를 사용하므로 원격에서 쓰려면
`study_participants`에 사전 등록돼 있어야 한다.

---

## 6. 프로덕션 기능 상태표

| 기능 | 저장소 코드 | 로컬 검증 | 현재 프로덕션 상태 |
| --- | --- | --- | --- |
| 일반 participant claim/RLS | 있음 | 있음 | 사용 중 |
| USER1 공용 시연 로그인 | 있음 | 단위+프로덕션 API 확인 | 사용 가능 |
| MASTER 다중 기기 로그인 | 있음 | 회귀 테스트 있음 | 계정 설정에 의존 |
| annotation/vote/completion | 있음 | local DB/브라우저 감사 이력 있음 | legacy 경로 사용 |
| User Event | 있음 | local integration 이력 있음 | DB 적용 상태 별도 확인 필요 |
| legacy 출석/퀘스트/재화 | 있음 | 회귀 테스트 있음 | legacy 경로 |
| legacy 집꾸미기/방 공유 | 있음 | 회귀 테스트 있음 | legacy 경로 |
| 마을별 6종 재화 | 있음 | disposable local 검증 | 비활성, cutover 필요 |
| 새 캐릭터 상점/identity studio | 있음 | disposable local 검증 | 비활성, cutover 필요 |
| Economy v1 인테리어 | 있음 | disposable local 검증 | 비활성, cutover 필요 |
| Duo v2 동행 | 있음 | disposable local/Realtime 검증 | 필수 secret 부재 시 생성 실패 |
| 내부 QA 페이지 | 있음 | proxy 회귀 테스트 | 운영에서는 404가 정상 |

### 현재 economy mode

프로덕션 Vercel 환경에 `SOUNDVILLAGE_ECONOMY_MODE`가 없으므로 기본값 `legacy`다.

- `legacy`: 현재 구 경제 경로 사용, Economy v1 API write 비활성
- `preview`: 주 UI는 legacy, 인증된 preview API만 제한적으로 사용
- `cutover`: 새 마을별 지갑·상점·캐릭터·인테리어·annotation/vote 경로 사용
- `maintenance`: 관련 read/write를 운영 중지하는 안전 모드

`cutover` 이후 새 write가 발생하면 단순히 `legacy`로 되돌리면 안 된다. 새 wallet, ledger,
ownership, loadout, room row가 legacy와 자동으로 합쳐지지 않는다. 문제가 생기면 먼저
`maintenance`로 write를 멈추고 데이터 reconciliation 후 forward fix해야 한다.

---

## 7. 새 경제, 캐릭터, 집꾸미기, 동행

### Multi-village Economy v1

- 각 마을 재화가 따로 존재한다.
- wallet과 ledger가 분리되어 거래 이력을 보존한다.
- 구매, 출석, annotation/vote reward는 idempotency key로 중복을 막는다.
- 서버는 상품 catalog와 비용을 소유하고 클라이언트 비용을 신뢰하지 않는다.
- 주간 출석 재화 순서는 HMAC으로 결정한다.
- 필수 환경변수: `MULTI_VILLAGE_ECONOMY_HMAC_SECRET` 32자 이상
- 필수 migration: 최소 001~011과 현재 코드가 기대하는 후속 migration

### Character Identity

- skin, eyes, hair style, hair color를 조합한다.
- 서버 catalog version과 클라이언트 contract가 일치해야 한다.
- 구매/장착/identity 저장은 별도 idempotency 결과로 처리한다.
- 캐릭터는 월드맵, 마을, 박물관, 집, Duo peer에 동일 loadout을 사용한다.
- 주요 파일: `components/character-studio/*`, `lib/characterIdentityContract.mjs`,
  `lib/characterV2Runtime.mjs`

### Interior

- legacy room과 Economy v1 room은 별도 시스템이다.
- Economy v1 cutover에서는 starter, 소유권, catalog allowlist, revision을 서버가 검증한다.
- room save는 전체 snapshot 단위로 저장하며 직접 table write 대신 RPC/API를 사용한다.
- 친구 방은 token을 통한 읽기 전용 view다.

### Duo v2

- host 1명, visitor 최대 1명의 서버 승인 session이다.
- invite 원문은 DB에 저장하지 않고 SHA-256 hash만 저장한다.
- session/invite 기본 만료는 2시간이다.
- visitor는 host의 선택된 방과 위치를 읽기 전용으로 보고 구매/방 저장을 할 수 없다.
- Supabase private Realtime Presence/Broadcast로 위치를 동기화한다.
- 필수 환경변수: `DUO_SESSION_HMAC_SECRET` 32자 이상
- 필수 migration: 012~015
- 같은 auth access token과 active topic을 악성 context가 복사한 경우를 완전히 구별하지
  못하는 residual risk가 있다.
- 현재 프로덕션 환경변수 목록에는 `DUO_SESSION_HMAC_SECRET`이 확인되지 않았으므로
  Duo invite 생성이 동작한다고 가정하면 안 된다.

---

## 8. DB migration 지도

SQL 파일은 `scripts/security/`에 있다. 자동으로 운영에 실행하면 안 된다.

1. `001_auth_foundation.sql`: participant registry, sound catalog, auth foundation
2. `002_enforce_participant_rls.sql`: participant-derived RLS와 제한 RPC
3. `002a_template_acl_hardening.sql`: template/ACL 보강
4. `003_transactional_integrity.sql`: idempotency, annotation/vote/reward transaction
5. `004_user_event_logging.sql`: study sessions, append-only user events
6. `005_functional_fixes.sql`: museum count aggregation 등 기능 수정
7. `006_experiment_rules_and_uniqueness.sql`: canonical uniqueness, round, completion, KST
8. `007_participant_room_rpc_only.sql`: room write를 RPC-only로 제한
9. `008_multi_village_economy.sql`: 마을별 wallet/ledger/catalog ownership
10. `009_multi_village_character_loadout.sql`: 새 캐릭터 loadout
11. `010_multi_village_runtime_cutover.sql`: 새 annotation/vote/reward 경로
12. `011_multi_village_interior_cutover.sql`: 새 room/share/ownership
13. `012_duo_session_v2.sql`: Duo session/invite/lease
14. `013_character_identity_loadout.sql`: skin/eyes/hair identity 확장
15. `014_duo_character_identity_sync.sql`: Duo peer appearance sync
16. `015_duo_es256_realtime_authorization.sql`: 현재 Supabase Auth token 기반 Realtime 인증

### migration 운영 원칙

- 먼저 DB backup과 sanitized schema inventory를 확보한다.
- preflight SQL로 현재 schema와 충돌 여부를 확인한다.
- disposable local -> 승인된 staging -> pilot -> production 순서로 진행한다.
- migration과 호환되는 앱 배포를 같은 maintenance window에 준비한다.
- 실패 시 기존 migration을 수정/삭제하지 말고 forward migration으로 고친다.
- `scripts/security/local-test-only-*.sql`은 local fixture이며 production 권위 문서가 아니다.
- service-role key를 브라우저, Git, screenshot, 로그에 절대 노출하지 않는다.

### 현재 원격 DB에 대해 확실히 아는 것

- USER1 조회와 auth-user 연결이 성공하므로 `study_participants`와 관련 auth foundation은
  최소 해당 경로에서 동작한다.
- 이 인수인계 작성 과정에서는 원격 migration ledger 전체를 직접 감사하지 않았다.
- migration 008~015가 production에 모두 적용됐다고 가정하면 안 된다.
- economy mode가 legacy이므로 새 경제 DB write는 현재 주 UI에서 활성화되지 않는다.

---

## 9. User Event와 연구 데이터

`lib/userEvents.js`는 participant 결과와 별도로 행동 로그를 queue/batch 전송한다.

### 주요 설계

- `study_session_id`: 한 실험 시행
- `client_instance_id`: 탭 또는 페이지 load instance
- `sequence_no`: 같은 client 안의 순서
- `occurred_at`과 DB 수신 시각 분리
- event ID와 sequence 중복 방지
- 최대 batch 25, queue 500, 보관 7일, 기본 flush 5초
- 결과 저장 실패와 로그 저장 실패는 서로 rollback시키지 않는다.
- app version 기본값: `v0.4-web`

### 저장하지 말아야 하는 것

- participant가 입력 중인 표현 원문
- invite URL, share token, auth token
- service-role key 또는 SQL 오류 원문
- pointer move나 held-key 매 frame
- 불필요한 정밀 좌표 또는 device fingerprint

### 아직 정책 결정이 필요한 것

- User Event 보존 기한
- 연구 철회 시 삭제/익명화 범위
- export 형식과 접근자 명단
- backup에서의 삭제 처리
- 연구 종료 후 raw event 접근 통제

---

## 10. 주요 코드 위치

### 전체 오케스트레이션

- `app/page.js`: 화면 상태, 인증 복구, progress, zone/museum/house/duo 연결
- `app/layout.js`: root layout와 `EconomyRuntimeProvider`
- `proxy.js`: 내부 QA route 운영 차단

### 핵심 UI

- `components/StartPanel.js`: participant/group/MASTER 입력
- `components/WorldMap.js`: 월드맵, Home, Museum, wallet, progress
- `components/*ZoneMap.js`: 마을별 이동·충돌·수집
- `components/AnnotationPanel.js`: 듣기, 표현, confidence, skip/submit
- `components/SoundMuseum.js`: 후보 표현 투표
- `components/InteriorDecorRoom.js`: 집꾸미기와 Duo 초대 UI
- `components/character-studio/*`: 캐릭터 identity 편집

### 핵심 라이브러리

- `lib/participantAuth.js`: 일반/MASTER/USER1 인증
- `lib/supabase.js`: legacy annotation/vote/progress/museum query
- `lib/audioManager.js`, `lib/audioPlaybackCore.mjs`: 재생과 listening time
- `lib/userEvents.js`: 행동 로그
- `lib/economyRuntimeState.mjs`: legacy/preview/cutover/maintenance 계약
- `lib/economyV1.client.js`: Economy v1 API client
- `lib/multiVillageEconomy.server.js`: server-only 새 경제 RPC
- `lib/duoSession.js`, `lib/duoSession.server.js`: Duo client/server lifecycle
- `lib/worldMapGeometry.mjs`: 월드맵 collision/interaction geometry

### API

- `/api/participant-session/claim`: 일반 participant claim
- `/api/participant-session/shared-demo`: USER1 시연 로그인
- `/api/participant-purchase`: legacy 구매
- `/api/economy-v1/*`: 새 경제/상점/캐릭터/room/annotation/vote
- `/api/duo-v2/*`: host/join/status/room/recover/heartbeat/leave/revoke
- `/api/internal/*`: local QA 전용

### 데이터와 asset

- `data/sound_metadata.json`: 실험 음원 metadata
- `data/economy/catalog-v1.json`: Economy v1 상품 catalog
- `data/character-v2-runtime-contract.json`: 캐릭터 asset contract
- `public/assets/`: 월드/마을/캐릭터/박물관/인테리어 이미지
- `public/house-assets/`: legacy 집꾸미기 이미지

---

## 11. 환경변수

### 현재 프로덕션에서 존재가 확인된 키

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_AUDIO_BASE_URL`
- `SHARED_DEMO_USER_PASSWORD`
- `FREESOUND_API_KEY`

값은 이 문서나 Git에 기록하지 않는다.

### 새 경제/동행 활성화 전에 필요한 키

- `SOUNDVILLAGE_ECONOMY_MODE`
- `MULTI_VILLAGE_ECONOMY_HMAC_SECRET`
- `DUO_SESSION_HMAC_SECRET`

2026-10-28 production env 목록에서는 위 세 키가 확인되지 않았다. mode가 없으면 legacy로
동작한다. secret이 없는 상태에서 관련 server action을 호출하면 안전하게 실패해야 한다.

### local/QA 전용

- `ENABLE_INTERNAL_TEST_ROUTES=true`: local development에서만 내부 route 활성화
- `NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA=true`: 내부 browser QA instrumentation
- `NEXT_PUBLIC_TEMPORARILY_UNLOCK_ALL_CONTENT=true`: local visual QA 전체 해금
- `NEXT_PUBLIC_WORLD_MAP_RENDER_MODE`: 월드맵 renderer 선택
- `NEXT_PUBLIC_APP_VERSION`: User Event app version

실제 참가자 점검에서는 임시 unlock과 내부 QA flag를 꺼야 한다.

---

## 12. 개발과 검증 방법

### 기본 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
npm run start
```

Next.js는 16.2.7이며 일반적인 과거 Next.js 지식과 API가 다를 수 있다. Next.js 코드를
바꾸기 전에 `node_modules/next/dist/docs/`에서 설치된 버전 문서를 확인한다.

### 빠른 회귀 검사

```bash
npm run lint
npm run build
npm run test:audio-lifecycle
npm run test:stage-6-lifecycle
npm run test:world-flat-v2
node --test scripts/security/shared-demo-session.test.mjs
```

2026-10-28 확인 결과:

- ESLint 통과
- Next.js production build 통과, 41개 static page generation 단계 완료
- audio lifecycle 18/18 통과
- Stage 6 lifecycle 13/13 통과
- USER1 관련 검사 통과
- world flat-v2 asset/geometry 검사 통과

### DB 통합 테스트

`scripts/security/multi-village-economy-local-rehearsal.sh` 등은 disposable local Supabase를
대상으로 한다. 다음 원칙을 지킨다.

- `REQUIRE_LOOPBACK_SUPABASE=1`
- `.env.local`의 원격 URL/key를 integration runner에 사용하지 않는다.
- remote/staging/production에 자동으로 migration이나 QA 데이터를 넣지 않는다.
- 실행 후 생성한 QA identity와 stack만 정리한다.
- local-only compatibility fixture 통과를 production schema 호환 증거로 사용하지 않는다.

### 내부 QA route

운영에서 `/audio-reliability-test`, `/character-studio-test`, `/house-decor-test` 등은 404가
정상이다. 로컬에서만 `ENABLE_INTERNAL_TEST_ROUTES=true`와 명시적 QA 설정을 사용한다.

---

## 13. 배포 절차

1. `git status --short --branch`로 tracked 변경을 확인한다.
2. `npm run lint`와 `npm run build`를 통과시킨다.
3. 변경과 관련된 unit/integration test를 실행한다.
4. 민감정보와 PPT/렌더가 staged되지 않았는지 확인한다.
5. 현재 작업 브랜치에 commit/push한다.
6. Vercel project 연결을 확인한다.
7. 가능하면 clean Git archive 또는 clean worktree에서 배포한다.
8. `vercel deploy --prod --yes` 후 READY와 production alias를 확인한다.
9. root page, 내부 route 404, 로그인, 오디오, 저장 경로를 smoke test한다.
10. DB migration/cutover가 포함되면 별도 승인된 runbook을 따른다.

배포만 성공했다고 실험 데이터 저장이 정상이라는 뜻은 아니다. 최소한 실제 participant
계정으로 auth, audio play, annotation save, reload progress, museum eligibility를 확인한다.

---

## 14. 현재 알려진 위험과 미결정 사항

### 운영·보안

1. participant ID 최초 claim에 one-time secret이 없다.
2. anonymous auth 분실 시 정식 rebind 도구와 승인 기록이 없다.
3. 일반 실험에 active client 1개만 강제하는 lease가 없다.
4. User Event retention/withdrawal/export 정책이 확정되지 않았다.
5. staging/production migration ledger와 authoritative schema reconciliation이 필요하다.
6. Duo는 동일 auth token을 악성 context가 복사한 Realtime replay를 완전히 막지 못한다.

### 연구 정책

1. canonical label 충돌 3건의 분석 규칙
2. retest 허용 조건, 승인자, 최대 round
3. 완료 후 외부 설문/안내/코드 정책
4. friend-room praise를 ephemeral UI로 둘지 저장할지
5. `duo_reconnected`의 연구적 정의
6. pilot 인원, A/B 균형, 지원 기기, 중단 기준

### 오디오

1. 전체 995 canonical의 현재 원격 coverage
2. 파일별 라이선스와 provenance manifest
3. MIME/CORS/cache와 Safari/mobile 재생
4. 연구 분석에 필요한 label 승인

### 기능 활성화

1. Economy v1 cutover는 코드가 있다고 바로 켜면 안 된다.
2. 008~015 migration, secret, catalog version, staging rehearsal이 함께 필요하다.
3. cutover 후 legacy rollback은 데이터 rollback이 아니다.
4. Duo는 secret과 DB migration이 준비되기 전 production-ready가 아니다.

---

## 15. 인수받는 사람이 첫날 확인할 체크리스트

### Git과 배포

- [ ] 현재 branch와 HEAD 확인
- [ ] origin/main과 현재 branch 차이 확인
- [ ] Vercel project와 production alias 확인
- [ ] Git integration/자동 배포 branch 확인
- [ ] 최근 deployment commit 기록

### Supabase

- [ ] 연결된 project ref 확인, 문서에 secret을 쓰지 않기
- [ ] migration ledger 001~015 실제 적용 상태 확인
- [ ] Anonymous Auth 설정 확인
- [ ] Realtime public access와 private policy 확인
- [ ] USER1, MASTER, 일반 participant registry 확인
- [ ] backup/restore와 operator rebind 책임자 확인

### 실험

- [ ] A/B participant assignment 파일과 발급 절차 확인
- [ ] 실제 995 canonical audio coverage 확인
- [ ] annotation/vote/completion export를 샘플 검증
- [ ] User Event 보존/삭제/접근 정책 확인
- [ ] pilot와 중단 기준 확인

### 기능

- [ ] production economy mode 확인
- [ ] legacy/cutover 중 실제 사용 경로 확인
- [ ] Duo secret과 migration 상태 확인
- [ ] 내부 QA route가 운영에서 404인지 확인
- [ ] mobile/Safari 오디오와 월드맵 smoke test

---

## 16. 무엇을 함부로 하면 안 되는가

- `git reset --hard`, 광범위한 checkout/clean으로 사용자 작업 삭제
- PPT/렌더 산출물을 제품 커밋에 포함
- service-role key, participant 원본 ID 목록, auth token을 문서/로그/스크린샷에 노출
- production Supabase에 migration을 자동 적용
- local-only fixture 결과를 production 호환으로 선언
- `SOUNDVILLAGE_ECONOMY_MODE=cutover`만 먼저 설정
- cutover write 이후 근거 없이 legacy로 되돌림
- metadata row 1,000개를 canonical audio 1,000개로 오해
- `sound_id` alias를 서로 다른 실제 음원으로 중복 집계
- USER1을 실제 연구 참여자 계정으로 사용
- 내부 QA unlock 상태로 참가자 실험 수행

---

## 17. 추가로 읽어야 할 근거 문서

- `docs/research/functional-audit-stage-8-local-integration.md`
- `docs/research/functional-audit-stage-9-readiness.md`
- `docs/research/functional-audit-stage-10-local-hardening.md`
- `docs/research/functional-audit-stage-10b-browser-closure.md`
- `docs/research/stage-11-policy-decision-package.md`
- `docs/security/participant-auth-rls.md`
- `docs/security/transactional-integrity.md`
- `docs/research/duo-session-v2-closure.md`
- `docs/security/duo-es256-realtime-residual-risk.md`
- `docs/game-economy/multi-village-economy-v1.md`
- `docs/game-economy/stage-3c-cutover-runbook.md`
- `docs/AUDIO_REPLACEMENT_RUNBOOK.md`

이 문서와 실제 코드가 다를 경우 실제 코드, Vercel environment, Supabase migration ledger,
최근 배포 기록을 함께 대조하고 문서를 갱신한다.
