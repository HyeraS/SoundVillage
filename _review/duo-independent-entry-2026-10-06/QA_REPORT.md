# 듀오 개인 화면 독립 진입 QA

## 판정

PASS. 듀오 세션의 공유 범위는 월드맵 Presence와 호스트 인테리어로 유지하면서,
마을·도서관·주석 화면은 각 참가자가 독립적으로 진입하고 복귀하도록 적용했다.
기존 프로토콜 화면 값(`worldmap`, `interior`, `waiting`)만 사용했으며 새 화면 타입은
추가하지 않았다.

## 구현 계약

- 월드맵에서 두 참가자의 이동과 상대 캐릭터 표시는 기존대로 공유한다.
- 개인 마을, 도서관, 주석 화면은 Presence에서 `waiting`으로 투영하고 상대 화면을 따라가지 않는다.
- 한 참가자가 월드맵으로 돌아와도 개인 화면에 남아 있는 상대를 강제 복귀시키지 않는다.
- 두 참가자가 모두 월드맵으로 돌아오면 상대 캐릭터 Presence가 복원된다.
- 호스트가 공유 인테리어에 들어갈 때만 방문객이 함께 들어가고, 호스트가 나오면 방문객도 월드맵으로 복귀한다.
- 화면 전환 직후 마지막 좌표와 새 화면 상태를 즉시 broadcast하여 최대 4초 동안 낡은 월드 아바타가 남는 구간을 제거했다.
- 오디오 진행, 수집·해금·주석 상태는 기존 참가자 ID/그룹 기반 조회를 그대로 사용하며 듀오 화면 추종과 결합하지 않았다.

## 제품 경로 브라우저 시나리오

1. A 음악 마을 / B 월드맵 — PASS
2. A 음악 마을 / B 자연 마을 — PASS
3. A 월드 복귀 / B 자연 유지 — PASS
4. B도 월드 복귀 / 양쪽 Presence 복원 — PASS
5. A 도서관 / B 월드맵 — PASS
6. A 도서관 / B 자연 마을 — PASS
7. A 월드 복귀 / B 자연 유지 — PASS
8. B도 월드 복귀 / 양쪽 Presence 복원 — PASS
9. 호스트 공유 인테리어 진입·퇴장 / 방문객만 예외적으로 동기화 — PASS

추가로 초대 토큰 URL 제거, 방문객 쓰기 차단, 세 번째 사용자 차단, 두 번째 탭 차단,
offline/reconnect, 세션 철회, 이벤트의 토큰·사용자 ID·세션 ID·좌표 비노출을 검증했다.

## 자동 검증

- `npm run test:duo-v2` — PASS, 12/12
- `DUO_BROWSER_ONLY=true npm run test:multi-village-economy-local` — PASS
  - 일회용 마이그레이션/DB/RLS/동시성 — PASS
  - 실제 private WebSocket Presence/Broadcast 권한 — PASS
  - 격리 프로덕션 빌드 제품 경로 A/B/C 브라우저 E2E — PASS
  - 종료 시 일회용 스택과 임시 비밀키 제거 — PASS
- `npm run lint` — PASS
- `NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA=true npm run build` — PASS, 39/39 정적 페이지
- `npm run test:world-camera` — PASS
- `npm run test:world-production` — PASS, 8/8 목적지
- `npm run test:world-flat-v2` — PASS
- `git diff --check` — PASS

전체 브라우저 리허설의 최초 실행에서는 듀오 단계 전에 기존
`multi-village-main-runtime-browser-e2e.mjs`의 박물관 의상 이미지 대기가 timeout됐다.
이 작업과 무관한 선행 스위트 실패로 분리했으며, 듀오 전용 리허설은 동일한 일회용
DB·마이그레이션·Realtime 준비를 유지하고 격리 프로덕션 빌드에서 최종 PASS했다.

## 변경 파일

- `lib/duoNavigation.mjs`: 화면 Presence 투영과 방문객 추종 결정을 순수 함수로 중앙화
- `app/page.js`: 기존 화면 타입 안에서 개인 화면 독립성과 공유 인테리어 예외 적용
- `lib/duoSession.js`: 화면 전환 즉시 마지막 좌표/화면 broadcast
- `lib/duoSessionContract.test.mjs`: 화면 계약 단위 테스트
- `scripts/security/duo-session-v2.test.mjs`: 구현·보안 계약 회귀
- `scripts/security/duo-session-v2-browser-e2e.mjs`: 두 브라우저 독립 진입/복귀 시나리오와 캡처
- `scripts/security/multi-village-economy-local-rehearsal.sh`: 듀오 전용 격리 프로덕션 리허설 분기

## 캡처

캡처는 `_review/duo-session-v2/`에 있다. 핵심 파일은 다음과 같다.

- `independent-a-music.png`
- `independent-b-world.png`
- `independent-a-music-b-nature-a.png`
- `independent-a-music-b-nature-b.png`
- `independent-presence-restored.png`
- `interior-two-players.png`
- `mobile-portrait.png`, `mobile-landscape.png`

