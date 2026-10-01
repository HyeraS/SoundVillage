# Economy V1 Interior Cutover Closure

## 판정

**COMPLETE** — Economy V1 인테리어 전환은 Duo Session V2 착수 전에 요구된 로컬 검증 범위를 모두 통과했다. 원격·linked Supabase에는 접근하지 않았고, Duo Session V2 구현은 시작하지 않았다.

검증일은 2026-10-01(KST)이며, 데이터베이스 검증은 `scripts/security/stage8-local-bootstrap.sh`가 생성한 loopback disposable Supabase에서만 수행했다.

## 구현 범위

- Economy V1 서버 projection에서 승인된 인테리어 단품 40개, 테마 세트 3개, 무료 starter 2개를 제공한다.
- `pending_interior_review` 6개, daily deal, SALE, discount, scalar 음표 가격을 Economy V1 경로에서 제외한다.
- 구매 요청은 item ID와 idempotency key만 받고, 6-wallet 원자 차감·소유권 지급·부분 보유 세트 정책을 서버가 결정한다.
- cutover 방 저장은 `participant_economy_v1_rooms`와 service-only RPC만 사용한다. 소유권, starter, 스키마, 좌표, layer, uid, 100개/64KB 제한, revision, 동시성, idempotency를 검증한다.
- 공유 링크는 불투명 토큰으로 생성하고, 인증된 활성 방문자에게 저장된 방만 읽기 전용으로 제공한다.
- 실제 제품 경로 `app/page.js` + `InteriorDecorRoom`을 두 독립 browser context로 검증한다.
- legacy/preview/maintenance/cutover 네 모드와 fail-closed 모드 선택을 유지한다.
- 키보드 배치, dialog/focus trap/Escape/focus restore, 반응형 레이아웃을 보강했다.

## 변경 파일

주요 제품 파일:

- `app/api/economy-v1/interior-catalog/route.js`
- `app/api/economy-v1/room/route.js`
- `app/api/economy-v1/room-share/route.js`
- `app/api/economy-v1/shared-room/route.js`
- `app/api/economy-v1/bootstrap/route.js`
- `app/api/economy-v1/purchase/route.js`
- `app/page.js`
- `components/InteriorDecorRoom.js`
- `components/InteriorRoom.js`
- `components/economy-v1/EconomyRuntimeProvider.js`
- `data/economy/catalog-v1.json`
- `lib/economyApi.server.js`
- `lib/economyCatalogV1.server.js`
- `lib/economyInteriorRoom.mjs`
- `lib/economyInteriorRoom.server.js`
- `lib/economyV1.client.js`
- `lib/homeHub.mjs`
- `lib/interiorCatalog.js`
- `lib/userEvents.js`
- `public/assets/interior/starter_floor_beige.png`
- `public/assets/interior/starter_wall_neutral.png`

Migration·검증 파일:

- `scripts/security/011_multi_village_interior_cutover.sql`
- `scripts/security/multi-village-interior-verify.sql`
- `scripts/security/multi-village-interior.integration.mjs`
- `scripts/security/multi-village-interior-browser-e2e.mjs`
- `scripts/security/multi-village-interior.test.mjs`
- `scripts/security/multi-village-economy-http.integration.mjs`
- `scripts/security/multi-village-economy-local-rehearsal.sh`
- `scripts/security/multi-village-character.test.mjs`
- `scripts/security/security-boundary.test.mjs`
- `scripts/security/user-events.test.mjs`
- `scripts/security/multi-village-main-runtime-browser-e2e.mjs`
- `scripts/test-world-map-production-integration.mjs`
- `package.json`

저장소에는 작업 시작 전부터 별도의 world-map 변경과 untracked 자료가 있었다. 이 작업은 해당 변경을 삭제·reset·stash·clean하지 않았다.

## 보호 체크섬과 legacy 보존

| 파일 | 시작 체크섬 | 최종 체크섬 | 처리 이유 |
|---|---|---|---|
| `components/InteriorDecorRoom.js` | `73e2a274…` | `0897571b…` | Economy 구매·방 저장·공유 UI, 접근성, Strict Mode 복사 상태, 반응형 처리를 완결했다. |
| `package.json` | `0d290bcf…` | `ba70706c…` | Interior DB/browser 전용 명령을 추가했다. |
| `scripts/security/011_multi_village_interior_cutover.sql` | `bcff7808…` | `062945d9…` | preflight, starter 고정 예외, ACL/RLS/event 계약을 최소 범위로 강화했다. |
| `app/api/participant-purchase/route.js` | `3ccfaa1d…` | `ad18b789…` | Stage 3B 보호 baseline으로 복원했다. snapshot 기대값을 바꾸지 않았다. |

legacy 구매는 기존 `/api/participant-purchase`, scalar currency, legacy room 경로를 그대로 사용한다. Economy V1은 `/api/economy-v1/*`, 6-wallet, 승인 catalog projection, 전용 room RPC만 사용한다. `lib/interiorCatalog.js`의 legacy 호환 export는 원래 40개 legacy 상품만 대상으로 하며 Economy 서버 코드는 이를 가격·deal 출처로 import하지 않는다.

리허설은 migration 적용 전, 011 적용 직후, 모든 DB/HTTP/browser 실행 후에 legacy table row 수·ACL·policy·함수 fingerprint를 비교했고 모두 동일했다. 보호 대상은 `participant_room`, `participant_interior_items`, `participant_currency`, `currency_transactions` 및 관련 기존 함수/정책이다.

## Migration 011 schema와 RPC

신규 relation:

- `participant_economy_v1_rooms`: participant별 room JSON, revision, 초대 고유 아이템 수.
- `economy_v1_room_save_results`: auth user + idempotency key + request hash + 결과 replay.
- `participant_economy_v1_room_shares`: participant별 불투명 share token.

신규/갱신 함수:

- `private.complete_economy_v1_room_save`
- `public.get_economy_v1_room_admin`
- `public.save_economy_v1_room_admin`
- `public.get_or_create_economy_v1_room_share_admin`
- `public.get_economy_v1_shared_room_admin`
- `public.record_user_events_v1`의 기존 allowlist 보존 + 제한된 Interior metadata 확장

011은 001–010 대표 relation/function과 007 direct-write 차단을 preflight하고, 011 relation이 이미 있으면 중복 적용을 명시적으로 거부한다. 모든 신규 table은 RLS를 활성화하고 public/anon/authenticated 직접 권한을 제거했다. admin RPC는 `SECURITY DEFINER SET search_path = ''`이며 service role만 실행 가능하다. participant ID는 auth user에서 도출하고, room 저장은 advisory transaction lock과 optimistic revision을 함께 사용한다. starter 예외는 정렬된 두 ID `starter_floor_beige`, `starter_wall_neutral`로 고정했다.

## 보안 경계

- legacy save 이벤트는 legacy operation/result entity 계약을, Economy save 이벤트는 `economy_v1_room_save`/`economy_v1_room` 계약을 사용한다.
- 성공·실패 이벤트 모두 operation idempotency key로 연결하며 participant-backed room ID, room JSON, URL, share token을 기록하지 않는다.
- 서버 환경에서만 mode를 결정하고 query/body로 전환할 수 없다.
- 011 verify는 relation/function, RLS, ACL, service-only grant, 빈 search path, FK/check/PK/unique, event name, metadata allowlist를 확인한다.
- DB 통합 테스트에서 anon/authenticated의 table CRUD와 admin RPC를 거부하고 service role RPC만 허용됨을 확인했다.
- 공유 응답은 owner participant 식별자와 token을 반환하지 않는다.

## 테스트 결과

| 명령 | 결과 |
|---|---|
| `npm run test:multi-village-economy` | PASS — 33/33 |
| `npm run test:security-boundary` | PASS — 5/5 |
| `npm run test:transactional-integrity` | PASS — 4/4 |
| `npm run test:user-events` | PASS — 7/7 |
| `npm run test:experiment-rules` | PASS — 11/11 |
| `npm run test:stage-8-readiness` | PASS — 10/10 |
| `npm run test:functional-fixes` | PASS — 3/3 |
| `npm run test:world-home-hub` | PASS — script + 4/4 |
| `npm run test:world-production` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Next.js 16.2.7 production webpack build, 39/39 static pages |
| `npm run test:multi-village-economy-local` | PASS — disposable 001–011 DB/HTTP/browser rehearsal |

초기 32/33 실패는 legacy route를 Stage 3B baseline으로 복원하고 명시적인 legacy compatibility export를 제공해 해결했다. snapshot/hash를 현재 변경값으로 교체하지 않았다.

## Disposable 001–011 리허설

적용 순서:

1. `stage8-local-bootstrap.sh`가 논리 migration 001–007 baseline을 새 `/private/tmp/soundvillage-stage8.*` loopback 프로젝트에 구성하고 자체 preflight/verify/integration을 실행.
2. 008 `multi_village_economy` 적용 및 verify/integration.
3. 009 `multi_village_character_loadout` 적용 및 verify/integration.
4. 010 `multi_village_runtime_cutover` 적용 및 verify/integration.
5. 011 `multi_village_interior_cutover`를 뒤 timestamp `20261001010000`으로 복사해 적용.
6. 011 SQL verify와 Interior DB integration 실행.
7. RLS, transactional integrity, user events, experiment rules 재실행.
8. legacy/preview/maintenance/cutover HTTP·browser 회귀와 Interior 제품 경로 E2E 실행.
9. 최종 legacy fingerprint 비교.
10. 성공·실패 trap에서 Next 서버, disposable Supabase, 임시 HMAC secret과 control directory 제거.

DB integration은 A/B 인증, revision 0, starter-only/owned 저장, 미보유·unknown·layer·좌표·uid·개수·크기 거부, replay/key reuse, 한 revision 동시 저장의 단일 승자, stale conflict, 직접 접근 거부, service 성공, 공유 생성/조회/invalid token, 방문자 수정 거부, unique count, 6-key cost vector/event allowlist, legacy 불변을 확인했다.

## 브라우저 E2E

- A/B 독립 context와 실제 `/` 제품 경로 사용.
- 6-wallet, 단품 40, 세트 3, starter 2, pending/daily deal/SALE/음표 가격 미노출 확인.
- 부족 구매 서버 거부와 무차감, 단품 정확 차감·소유권·재구매 거부, 부분 세트 차단, 전체 세트 구매 확인.
- 키보드만으로 상점·구매·배치·저장을 실행하고 dialog role/aria-modal/Escape/focus trap/focus restore를 확인.
- 저장 실패 주입 후 편집 상태와 같은 key를 유지하고 재시도 성공, key reuse 복구 후 새 key 발급 확인.
- reload 후 room/revision 복구, 반복 배치 unique 중복 제외, 서로 다른 4종에서 초대 해제 확인.
- 링크 복사는 `navigator.clipboard.writeText` test spy로 실제 전달된 값이 표시 링크와 동일함과 `복사됨` UI를 확인했다. OS clipboard 권한 자체는 테스트 대상이 아니다.
- A를 오프라인으로 전환한 뒤 B가 저장된 공유 방을 읽기 전용으로 열고 상점/편집/저장 부재, 직접 API 공격 거부, A/B 격리, mutation 미발생을 확인했다. 이는 Duo Realtime 경로를 변경하거나 검증 범위에 포함하지 않기 위한 격리다.
- 390×844, 768×1024, 1280×720에서 document overflow 없음. 추가로 844×390 검토 캡처를 남겼다.
- `_review/economy-v1-interior-cutover/` 캡처에는 service key, auth UUID, participant ID, connection string, share token을 넣지 않았다.

## 원격 미접속과 정리

- Supabase URL과 앱 URL은 `local-supabase-guard.mjs`로 loopback만 허용했다.
- `supabase migration up --local --workdir <disposable>`만 사용했다.
- 운영, Preview, staging, linked Supabase 명령이나 네트워크 우회를 사용하지 않았다.
- 검증 후 `soundvillage-stage8.*` container, Next dev server, `/private/tmp/soundvillage-stage8.*`, `/private/tmp/soundvillage-economy-control.*`, 임시 secret 파일이 남지 않았음을 확인했다.
- 테스트 인증 사용자와 participant fixture는 각 integration/E2E의 `finally`에서 제거했다.

## 남은 위험

- starter 두 asset은 provisional locally-authored asset이므로 최종 아트 승인이 남아 있다. ID와 무료 entitlement 계약은 고정되어 있다.
- 실제 OS clipboard 권한 UX는 headless E2E가 아닌 브라우저/배포 환경 smoke test가 필요하다. E2E는 API 호출 인자와 성공 UI를 결정적으로 검증한다.
- remote dashboard의 anonymous auth/Realtime 설정은 원격 미접속 요구 때문에 확인하지 않았다. 배포 전에 별도 운영 절차에서 확인해야 한다.
- share token 만료·회전·폐기, 1:1 lease, reconnect/동시 접속 정책은 의도적으로 이번 범위에 포함하지 않았다.
- 저장소의 기존 unrelated dirty/untracked 변경은 그대로 남아 있으므로 향후 커밋 시 관련 파일만 선택해야 한다.

## Duo Session V2 인계

다음 migration 번호는 **012**이며 권장 파일명은 `scripts/security/012_duo_session_v2.sql`이다. 이제 Duo Session V2 단계로 넘어가도 된다.

Duo 작업에서 변경 가능한 주요 경계는 새 012 migration/verify/integration, `lib/duoSession.js`, Realtime presence/broadcast를 사용하는 `WorldMap`/`InteriorRoom` 연결부, `app/page.js`의 live-session redirect 및 전용 API/테스트다.

다음 계약은 보존해야 한다:

- 008–011 schema/RPC/ACL과 legacy fingerprint.
- Economy 구매의 6-wallet 원자성, 서버 catalog projection, item-ID-only 요청, idempotency.
- Economy room ownership/revision/크기·좌표 검증과 service-only storage.
- 저장된 공유 방의 인증·읽기 전용·owner/token 비노출 계약.
- user event에서 URL/token/room JSON/participant-backed entity ID 비기록.
- legacy/preview/maintenance/cutover 모드와 fail-closed 선택.
- `/api/participant-purchase` Stage 3B baseline 및 legacy persistence 경계.
