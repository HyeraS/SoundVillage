# Sound Village 2D 리디자인 — 범위와 맥락 동결

작성일: 2026-08-28  
적용 단계: 2B 공통 marker 및 Music whitebox  
목적: 현재 게임 기능, 사용자 승인 변경, 향후 기술 제안을 혼동하지 않도록 작업 경계를 고정한다.

## 1. 우선순위

1. 현재 production 데이터 계약과 게임 진행을 보존한다.
2. 사용자 승인 변경은 “승인된 방향”으로 기록하되 현재 구현 여부를 별도로 표시한다.
3. DB·저장 안정화 아이디어는 유용한 감사 결과로 보존하지만 이번 디자인 단계의 승인 조건에서 제외한다.
4. 2B preview는 mock 상태만 사용하며 실제 annotation, Supabase, 보상, Museum을 호출하지 않는다.

## 2. 기존 기능

아래는 현재 게임 맥락과 기능이다. 이번 단계에서 수정하거나 다른 구조로 재해석하지 않는다.

| 기능 | 동결 내용 |
|---|---|
| 참여자 진행 | `participant ID`를 기준으로 기존 DB 기록과 진행 상태를 조회·계속 사용 |
| 재접속 | 새로고침·새 창은 새 연구 참여가 아니며 동일 participant ID면 기존 기록을 이어감 |
| 그룹 | A/B group에 따라 sound가 배정됨 |
| 초기 진행 | 일반 참여자는 Music부터 시작하고 Music Block 1 완료를 기준으로 다른 마을이 열림 |
| 연구 단계 | Stage 1 annotation과 Stage 2 Sound Museum 투표 |
| 그룹 간 평가 | 한 그룹의 annotation을 반대 그룹 참여자가 Museum에서 평가 |
| 연구자 검수 | 연구용 access ID가 일반 잠금을 우회 |
| 데이터 계약 | 현재 annotation, block, progress, Museum query와 Supabase 테이블·컬럼·RPC |
| 진행률 | 현재 계산 방식과 기존 저장 데이터 |
| 집꾸미기 | 현재 house-decor 흐름과 구매 로직 |
| 현재 경제 | 단일 범용 재화 잔액과 단일 가격 구조 |

현재 단일 재화나 현재 Museum 기준을 연구 목표와 동일하다고 과장하지 않는다. “현재 존재함”과 “향후 바꾸기로 승인됨”은 별도 상태다.

## 3. 사용자 승인 변경

아래는 사용자가 명시적으로 승인한 제품·연구 방향이다. 일부는 아직 production에 구현되지 않았다.

| 승인 방향 | 현재 상태 |
|---|---|
| voluntary skip 제거 | 승인됨, production에는 기존 skip 경로가 남아 있음 |
| Music Block 1 배정 sound 15개 모두 유효 annotation 제출 후 해금 | 승인됨, 기존 흐름을 이 표현으로 명확화 |
| Museum은 sound당 고유 참여자 5명 이후 반대 그룹 투표 허용 | 승인됨, 현재 임계값 4·행 수 집계와 불일치 |
| 여섯 마을별 재화 | 승인됨, 현재는 단일 범용 재화 |
| 집꾸미기 복수 마을 재화 recipe | 승인됨, 현재는 단일 가격 |
| sound marker와 재화의 명확한 시각적 분리 | 승인됨, 2B whitebox 대상 |
| 여섯 마을 및 월드맵 시각 리디자인 | 승인됨, 단계별로 별도 승인 후 적용 |

승인 방향이라는 사실은 이번 2B에서 데이터나 production 로직을 즉시 바꿀 권한을 의미하지 않는다.

## 4. 향후 기술 안정화 제안

아래는 확정된 게임 맥락이나 이번 디자인 단계의 필수 구현 조건이 아니다. 기존 감사에서 발견된 유용한 기술 backlog로 보존한다.

- canonical DB key 설계
- annotation unique constraint 또는 동등한 중복 방지 장치
- 신규 RPC나 원자적 annotation·보상 저장 구조
- annotation 수정 금지 또는 감사 로그 정책
- legacy duplicate 처리 정책
- legacy skip migration·분석 제외 정책
- group/session 데이터 격리·보정 정책
- 보상 자동 재시도 횟수와 조정 권한
- 별도 `study_run_id`
- DB schema 재설계
- 원격 Supabase migration

이 항목은 별도 기술 설계·연구 검토·DB 승인 없이 구현하지 않는다. 2B whitebox의 합격 여부를 판단하는 게이트로 사용하지 않는다.

## 5. 재접속과 `session_id` 해석

- 브라우저 새로고침, 탭 닫기 후 재접속, 새 창 접속은 새로운 연구 참여가 아니다.
- 동일 participant ID를 입력하면 현재 DB 기록을 기준으로 진행률과 완료 상태를 이어간다.
- 현재 `session_id`는 실질적으로 group ID가 전달되는 필드이므로 브라우저 세션 ID로 해석하지 않는다.
- 2B에서는 participant, `session_id`, group 판정, 재접속 또는 DB 고유키를 변경하지 않는다.
- 별도 연구 run 개념이 필요하다는 제안은 향후 기술 backlog이며 현재 계약에 소급 적용하지 않는다.

## 6. 2B 허용 범위

- 공통 sound marker의 9개 mock 시각 상태 설계
- Music 48×36 whitebox의 동선, landmark, building massing, marker 위치 원칙 설계
- production과 연결되지 않은 독립 preview route
- CSS/SVG 기반 단순 도형, 레이어·collision guide·interaction guide
- 데스크톱·노트북·모바일 세로·모바일 가로 시각 검수와 preview 캡처
- 관련 Markdown 문서 작성·수정

## 7. 2B 변경 금지

- annotation API와 production AnnotationPanel
- Supabase 테이블·컬럼·RPC와 원격 데이터
- participant ID, `session_id`, group, metadata, block, progress, Museum query
- 현재 재화 DB와 house-decor 구매 로직
- production Music 맵과 다른 다섯 마을
- legacy 데이터와 기존 에셋
- 최종 이미지·고해상도 에셋 생성
- Git commit, branch, push 또는 기존 사용자 변경 되돌리기

## 8. 문서 해석 규칙

다른 디자인 문서의 기술 안정화 문구가 이 문서와 충돌하면 다음처럼 읽는다.

- 연구·제품 방향: 사용자 승인 변경
- 현재 실제 동작: 기존 기능
- canonical key, unique constraint, migration, RPC, 수정·재시도 정책: 향후 기술 안정화 제안
- 3~7개 marker, 3초 인식, 밀도·접근 시간·매력도·연출 시간: pilot 검수 후 조정 가능한 provisional 휴리스틱

이 범위 동결은 사용자가 별도 승인을 내릴 때까지 2B와 2C의 기준점으로 사용한다.
