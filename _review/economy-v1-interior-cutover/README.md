# Economy v1 Interior cutover review

이 폴더의 PNG는 `scripts/security/multi-village-interior-browser-e2e.mjs`와
`scripts/security/multi-village-main-runtime-browser-e2e.mjs`가 일회용 로컬
Supabase 및 loopback Next.js 서버에서 생성한다. QA 사용자는 테스트 종료 시
삭제된다.

## 캡처 계약

| 파일 | 모드 / 테스트 데이터 | 확인 항목 |
| --- | --- | --- |
| `desktop-interior-room.png` | cutover, 신규 참가자 revision 0 | starter 벽지·바닥, 여섯 지갑 HUD, 빈 방 |
| `desktop-interior-shop-items.png` | cutover, 잔액 0 | 승인 단품 40종, 오늘의 특가·할인 없음 |
| `desktop-interior-shop-sets.png` | cutover, 잔액 0 | 승인 세트 3종과 수집 진행도 |
| `desktop-insufficient-wallets.png` | cutover, 잔액 0 | 부족한 마을 화폐 및 비활성 구매 버튼 |
| `desktop-item-purchased.png` | cutover, `wp_night` 구매 직후 | 지갑 차감과 보관함 동기화 |
| `desktop-bundle-partially-owned.png` | cutover, `set_night` 1/4 보유 | 부분 보유 세트 구매 차단 |
| `desktop-bundle-complete-apply.png` | cutover, `set_night` 4/4 개별 수집 | 추가 구매 없이 `방에 적용하기` |
| `desktop-invite-progress-duplicate.png` | cutover, 저장된 3종(화분 2개 배치) | 동일 상품 반복 배치는 한 종으로 계산 |
| `desktop-invite-ready-four-unique.png` | cutover, 저장된 고유 4종 | 저장 성공 뒤에만 초대 해금 |
| `desktop-friend-room-readonly.png` | cutover, 다른 로컬 QA 사용자 | 공유 방 읽기 전용, 상점·편집·저장 없음 |
| `mobile-landscape.png` | cutover, 844×390 | 가로 모바일 레이아웃 |
| `mobile-portrait.png` | cutover, 390×844 | 세로 모바일 레이아웃 |
| `starter-entitlements.png` | 정적 starter 비교판 | 유료 벽지·바닥과 구분되는 두 starter |
| `maintenance-or-blocked.png` | maintenance | 상점·편집·저장 차단 안내 |

## Starter 에셋 출처

`starter_wall_neutral.png`(32×24)과 `starter_floor_beige.png`(32×32)는 현재
저장소에 생성 과정이나 원본 에셋 팩의 crop 좌표를 입증하는 기록이 없다. 따라서
두 파일은 원본 팩에서 가져온 에셋이라고 주장하지 않으며, Stage 4A에서 만든
**provisional locally-authored starter assets**로 분류한다. 벽지는 단색 중성 회색,
바닥은 베이지·갈색 타일 패턴이라 기존 유료 벽지/바닥과 시각적으로 구분된다.

두 ID는 유료 단품 및 세트 구성품과 겹치지 않고, 서버 projection에서
`free_customization` starter로만 전달된다. 구매 대상과 초대 고유 아이템 수에는
포함되지 않는다. 실제 세트 완성 보상 에셋 3종은 아직 결정되지 않았으며 이
검증은 placeholder 보상을 지급하지 않는다.
