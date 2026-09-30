# 다중 마을 경제 2A 구현 메모

## 병행 DB 구조

기존 `participant_currency`, `currency_transactions`, 기존 의상·Interior 소유권 테이블은 변경하지 않았다. 새 경제는 `participant_village_wallets`, `village_currency_ledger`, `participant_catalog_items`를 별도로 사용한다. 기존 테이블 확장은 현재 화면과 003/006 RPC의 의미를 바꾸고 감사 원장을 섞을 위험이 있으므로, 병행 검증과 되돌리기가 가능한 신규 테이블 방식이 더 안전하다.

여섯 지갑은 참가자·마을 복합 기본 키와 마을 CHECK, 음수 방지 CHECK를 가진다. 원장은 UPDATE/DELETE 방지 트리거가 있는 불변 기록이며, `operation_id`로 한 구매의 여러 마을 차감을 묶는다. 브라우저 역할은 자기 행 SELECT만 가능하고 모든 변경 함수는 service role 전용이다.

## 서버 경계

- `/api/economy-v1/wallets`: 인증된 현재 참가자의 여섯 잔액 조회
- `/api/economy-v1/purchase`: `itemId`, UUID `idempotencyKey`만 입력. 가격·유형·지급 항목·세트 조건은 `catalog-v1.json` 서버 어댑터가 결정한다.
- `/api/economy-v1/attendance`: KST 주간 상태 조회와 청구. POST는 UUID `idempotencyKey`만 입력한다.

기존 `/api/participant-purchase`, `lib/currency.js`, `lib/attendance.js`, `lib/interiorDecor.js`의 호출은 유지했다. 따라서 현 화면은 계속 단일 잔액과 기존 소유권을 사용하며 2A API는 병행 검증용이다.

## 출석과 완성 보상

출석 순열 및 7일차 동률 순서는 `MULTI_VILLAGE_ECONOMY_HMAC_SECRET`(최소 32자)과 고정 버전 `hmac-sha256-v1`으로 결정한다. 비밀이 없으면 API가 저장 실패로 안전하게 종료하며 임의 fallback은 없다. DB는 순열을 최초 저장하고, 7일차에는 여섯 지갑을 잠근 뒤 최저 잔액과 HMAC 동률 순서로 마을을 확정한다.

개별 구매가 세트를 완성하면 `participant_collection_completions`에 `eligible_pending_asset`만 기록한다. 현재 placeholder는 소유권으로 지급되지 않는다. 에셋 승인 후 `grant_collection_completion_reward_admin`에 승인된 비-placeholder ID를 연결할 수 있다.

## 다음 전환 단계 호출 지점

- `lib/currency.js`의 `getCurrencyBalance`, `purchaseOutfit` 및 이를 쓰는 상점 화면을 새 wallets/purchase API로 교체한다.
- `lib/interiorDecor.js`의 `purchaseInteriorItem`, `purchaseInteriorSet`과 보유 조회를 새 카탈로그 소유권으로 교체한다.
- `lib/attendance.js`의 `getAttendanceStatus`, `ensureTodayCheckIn`을 새 attendance API로 교체한다.
- `scripts/security/006_experiment_rules_and_uniqueness.sql`의 `submit_annotation_v4`, `submit_museum_vote_v4` 성공 지점 이후 서버가 새 `credit_verified_activity_village_admin`을 호출하도록 전환한다. 이 함수는 클라이언트 마을·금액을 받지 않고 저장된 `annotations.zone` 또는 `votes.zone`에서 마을을 확인하며 전사 5, 투표 2를 고정한다.

전환 전에는 오디오 메타데이터의 `zone` 값이 정확히 Animal/Human/Nature/Urban/Music/Lab인지 사전 검증해야 한다. 기존 scalar 보상과 새 보상을 동시에 활성화하지 않도록 기능 플래그 및 컷오버 시각이 필요하다.

## 적용·검증 순서

이 작업에서는 어떤 DB에도 SQL을 적용하지 않았다. 추후 로컬 검증 시 `multi-village-economy-preflight.sql` 확인 → `008_multi_village_economy.sql` 적용 → `multi-village-economy-verify.sql` 확인 순서를 사용한다. 이후 disposable 로컬 Supabase에서만 `supabase db query --local --file scripts/security/multi-village-economy.integration.sql`을 실행한다. 통합 SQL은 전체를 한 트랜잭션으로 실행하고 마지막에 롤백한다. `--linked` 또는 원격 DB URL로 실행하면 안 된다.

## 아직 필요한 제품 결정

세 테마 세트의 완성 보상 실제 에셋, 검수 대기 House 6종의 승인 여부, 실험 시작 시각과 감사 스냅샷 보관 정책, Character v2 팔레트 해금 범위는 기준 계약대로 미결 상태다.
