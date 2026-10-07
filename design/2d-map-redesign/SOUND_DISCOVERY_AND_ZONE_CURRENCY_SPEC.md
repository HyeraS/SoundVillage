# Sound Village 2A — 공통 소리 발견 체계와 마을별 재화 명세

작성일: 2026-08-28  
상태: 디자인·연구·구현 판단용 명세  
범위: 공통 sound marker, annotation 제출, 마을별 재화, Museum 연결  
비범위: 애플리케이션 코드, DB/Supabase, migration, 실제 경제 값, 에셋 제작

범위 분류는 `SCOPE_AND_CONTEXT_FREEZE.md`를 우선한다. 이 문서의 canonical key, unique constraint, RPC, migration, annotation 수정·legacy 처리·보상 재시도 내용은 **향후 기술 안정화 제안**으로 보존되며 2B whitebox의 필수 구현·승인 조건이 아니다.

## 1. 목적과 상태 구분

Sound Village는 HCI 연구용 sound annotation tool에 gamification을 적용한 시스템이다. 이 명세의 목적은 “소리를 발견하고 유효한 annotation을 저장한 뒤 해당 마을 재화를 받는 과정”을 여섯 마을에서 일관되게 만드는 것이다. 재화 수집 자체가 annotation보다 앞에 보여서는 안 된다.

| 구분 | 의미 |
|---|---|
| 확정 연구 규칙 | 구현 편의를 위해 바꿀 수 없는 승인된 프로토콜 |
| 현재 구현 | 기존 코드에서 확인된 동작; 확정 규칙과 다를 수 있음 |
| 사용자 승인 변경 | 승인된 연구·제품 방향이며 현재 구현 여부와 별도로 기록하는 동작 |
| 향후 기술 안정화 제안 | 별도 기술 설계·연구 검토·DB 승인 뒤에만 다룰 backlog |
| provisional 디자인 목표 | pilot test에서 검증·조정할 수 있는 가설적 수치 |

## 2. 확정 연구 규칙

1. 일반 참여자는 Music만 열린 상태로 시작한다.
2. 자신의 그룹에 배정된 Music Block 1의 15개 sound 모두에 유효한 annotation을 제출한 뒤 다른 마을이 열린다.
3. voluntary skip은 없다. `Skip`, `건너뛰기`, skip reason, skip row를 제공하거나 저장하지 않는다.
4. 유효 annotation 저장 성공 전에는 진행률, 완료 marker, 재화를 부여하지 않는다.
5. 한 sound가 Museum 후보가 되려면 올바른 group/session에 속한 고유 참여자 5명의 유효 annotation이 필요하다.
6. 참여자 한 명은 한 sound에 후보 표현 하나만 기여한다.
7. 반대 그룹 참여자만 해당 sound를 Museum에서 평가하며 후보 조회에서도 group/session 자격을 명시적으로 검증한다.
8. 마을별 재화를 하나의 범용 화폐로 통합하지 않는다.
9. 복수 마을 재화 recipe는 여섯 마을의 균형 있는 annotation 참여를 유도해야 한다.

## 3. 현재 구현과 확정 규칙의 차이

| 영역 | 현재 구현 | 확정 연구 규칙·사용자 승인 방향 | 상태 |
|---|---|---|---|
| skip | AnnotationPanel에 skip과 `is_skipped=true` 행 저장 경로가 있음 | voluntary skip UI·저장 경로 없음 | 명백한 불일치 |
| Music 해금 표현 | 비-skip annotation 존재 여부를 기준으로 판정 | 배정된 15개 모두 유효 annotation 제출 | 승인 방향과 현 구현의 검증 차이; canonical 설계는 향후 기술 제안 |
| 중복 제출 | UI·서버·DB 전체 방어 계층이 별도로 검증되지 않음 | canonical key·unique constraint·멱등 저장 검토 | 향후 기술 안정화 제안 |
| Museum 임계값 | `MUSEUM_MIN_ANNOTATIONS = 4` | 고유 `participant_id` 5명 | 명백한 불일치 |
| Museum 집계 | 유효해 보이는 annotation 행 수 | `COUNT(DISTINCT participant_id)`와 동등한 집계 | 명백한 불일치 |
| 후보 표현 | 최대 5행 조회 후 순서 섞기, 참여자 중복 제거 없음 | 고유 참여자 5명에게서 표현 하나씩 확정 후 표시 순서만 무작위화 | 후속 구현 필요 |
| 후보 그룹 검증 | metadata sound ID를 통한 간접 분리 | 후보 annotation 조회에서도 group/session 명시 검증 | 후속 구현 필요 |
| 재화 | 단일 `participant_currency.balance` | zone별 독립 재화 6종 | 아직 구현되지 않음 |
| 집꾸미기 가격 | 단일 `price` | 여러 zone 재화를 명시한 recipe | 아직 구현되지 않음 |
| 보상 복구 | annotation 저장 뒤 비동기 지급 | 저장 성공과 별도인 멱등 보상·재시도/조정 경로 | 후속 구현 필요 |

이 문서에서는 위 차이를 수정하지 않는다. legacy skip·duplicate row도 삭제하거나 병합하지 않는다. 중복·migration 관련 항목은 이번 디자인 단계의 승인 조건이 아니다.

## 4. 공통 소리 발견·제출 흐름

### 4.1 정상 흐름

| 단계 | 화면/시스템 상태 | 사용자에게 보이는 것 | 데이터·보상 규칙 |
|---:|---|---|---|
| 1 | marker 발견 | 마을 공통 문법의 활성 sound marker | 데이터 변화 없음 |
| 2 | 접근 | 근거리 outline과 방향 단서 강화 | 데이터 변화 없음 |
| 3 | interactable | 키/터치 라벨 표시 | 데이터 변화 없음 |
| 4 | annotation 진입 | 입력 패널, 재생 버튼, 표현·confidence 입력 | marker는 `interacting` |
| 5 | 최소 1회 재생 | 재생 완료 단서 | 재생 횟수·listening time은 제출 payload 후보 |
| 6 | 유효 표현 입력 | 공백이 아닌 표현, 제출 가능 안내 | 아직 완료 아님 |
| 7 | 제출 | 버튼 잠김, 중복 입력 차단 | client idempotency key 생성/재사용 |
| 8 | 저장 처리 | `저장 중…`과 진행 표시 | row·진행률·재화 확정 전 상태 |
| 9 | 저장 성공 확인 | 성공 상태를 서버 결과로 확인 | canonical annotation 확정 |
| 10 | 재화 지급 | 해당 zone 재화 획득 | 같은 canonical annotation에 한 번만 지급 |
| 11 | 완료 피드백 | 짧은 완료/재화 연출 | provisional 0.8~1.5초, pilot 조정 가능 |
| 12 | 맵 복귀 | marker가 완료 상태 | 진행률 반영, 재제출 불가 |

### 4.2 제출·보상 원칙

- 재화는 annotation 저장 성공이 확인된 뒤에만 지급한다.
- 저장 실패나 미확정 응답에는 row, 진행률, 완료 상태, 재화를 부여하지 않는다.
- 중복 제출과 재시도의 멱등 처리 방식은 향후 기술 안정화 제안으로 별도 검토한다.
- 빠른 제출, 짧은 listening time, 표현 길이, 반복 클릭에 추가 보상을 주지 않는다.
- 표현 길이만으로 보상량을 차등화하지 않는다.
- 패널 닫기는 저장 없는 미완료 복귀다. 다시 접근하면 같은 sound를 완료할 수 있다.
- voluntary skip 경로는 존재하지 않는다.
- technical failure는 연구 응답이 아니며 재시도, 맵 복귀, 연구자 문의를 제공한다.

## 5. Sound marker 상태 체계

### 5.1 상태표

| 상태 | 시각·애니메이션 | 라벨/아이콘 | 입력 동작 | 진행률 | 보상 | 비색상·혼동 방지 |
|---|---|---|---|---|---|---|
| `locked` | 닫힌 외곽, 움직임 없음 | 자물쇠 + 해금 조건 | 클릭/키/터치 시 조건 설명만 | 없음 | 불가 | 폐쇄 실루엣과 `잠김` 텍스트; 완료 체크 금지 |
| `unavailable` / `not-current-block` | 낮은 대비의 봉인 링 | 다음 block/현재 이용 불가 | 상태 설명만, 패널 미진입 | 없음 | 불가 | 점선 링과 시계/블록 glyph; locked와 문구 분리 |
| `active` | 선명한 외곽 링, 느린 호흡형 맥동 | sound 파형 glyph | 접근 가능, 원거리 클릭은 길 안내만 | 없음 | 저장 후 가능 | 재화 실루엣을 사용하지 않고 공통 파형 glyph 유지 |
| `nearby` / `interactable` | 외곽 대비 상승, 링 수축 | `E 듣기` 또는 `탭하여 듣기` | 클릭·E·Enter·터치로 패널 진입 | 없음 | 저장 후 가능 | 키/터치 라벨과 굵어진 이중 링 |
| `interacting` | 맵 marker 맥동 정지/감쇠 | 패널 제목에 zone·sound 과업 표시 | 재생·입력·닫기, skip 없음 | 없음 | 불가 | 패널 focus와 `미완료` 상태 문구 |
| `submitting` | spinner, marker 입력 잠금 | `저장 중…` | 모든 제출 입력 비활성, 닫기 시 확인/백그라운드 결과 복구 | 없음 | 아직 불가 | 색과 무관한 spinner·aria-live·disabled 상태 |
| `completed` | 발광 제거, 채운 링 | 체크 + `완료` | 재진입 시 읽기 전용 결과/완료 안내 | 반영 | 이미 1회 지급 | 체크·채운 실루엣·텍스트; active보다 약한 대비 |
| `save-error` / `retry` | 고정 경고 outline, 맥동 없음 | `저장되지 않음` + 재시도 | 같은 idempotency key로 재시도 또는 맵 복귀 | 없음 | 불가 | 경고 삼각형·오류 텍스트; 완료 체크 금지 |
| `technical-audio-error` | 끊긴 파형과 고정 경고 outline | `오디오 오류` | 재시도, 맵 복귀, 연구자 문의 | 없음 | 불가 | 끊긴 파형·오류 코드/문의 링크; annotation/skip으로 저장 금지 |

**skip 상태는 정의하지 않는다.** 패널 닫기는 marker를 `active` 또는 `nearby`로 되돌리고, technical failure는 별도의 오류 상태로만 표현한다.

### 5.2 데스크톱·모바일·접근성

| 영역 | 데스크톱 | 모바일 | 공통 접근성 요구 |
|---|---|---|---|
| 진입 | 근접 후 E/Enter와 클릭 | marker 또는 44 CSS px 이상 버튼 탭 | 키보드만으로 진입 가능, focus visible |
| 상태 라벨 | hover 보조 가능 | hover에 의존하지 않고 상시/근접 라벨 | 아이콘에 텍스트·접근성 이름 제공 |
| 거리 안내 | 화면 가장자리 방향 단서 | 화면 가장자리 단서 + 간결한 거리 단계 | 방향을 색만으로 표시하지 않음 |
| 제출 | 버튼 + 단축키, 제출 중 focus 유지 | 하단 고정 제출 버튼, 키보드에 가리지 않음 | disabled·busy·success/error를 aria-live로 알림 |
| 오류 | panel 내 재시도와 맵 복귀 | 큰 재시도/복귀 버튼 | 오류 원인, 결과 미저장, 문의 방법을 평문으로 제공 |

상태는 색 외에 최소 두 가지 단서(실루엣, glyph, 선 종류, 움직임, 텍스트)를 사용한다. 저시력 확대에서 marker와 라벨이 잘리지 않고 reduced-motion 환경에서는 맥동을 정적 이중 링으로 대체한다.

## 6. 화면 밀도와 발견성

- 한 화면의 활성 sound marker **3~7개**는 provisional 1차 휴리스틱이며 pilot test에서 검증·조정한다.
- 수치를 맞추기 위해 필수 sound를 숨기거나 접근 불가능하게 만들지 않는다.
- marker가 많으면 다음 순서로 시각 부하를 줄인다.
  1. 현재 block만 full contrast로 표시한다.
  2. 근거리 marker는 outline·라벨을 강화하고 원거리 marker는 label을 축약한다.
  3. 완료 marker의 발광과 움직임을 제거한다.
  4. 비현재 block marker는 봉인 상태로 약화한다.
  5. 환경의 움직이는 장식과 고채도 강조를 줄인다.
- 활성 marker는 이중 링 + 파형 glyph + 느린 호흡형 움직임을 공통으로 사용한다.
- 일반 환경 오브젝트는 이중 링, 파형 glyph, 상호작용 맥동을 사용하지 않는다.
- 마을별 장식 외피는 marker 바깥 받침에만 적용하고 공통 상태 문법을 바꾸지 않는다.
- 완료 marker는 활성 marker보다 낮은 채도·명도·움직임을 사용한다.
- 맵 미관보다 annotation 대상 발견성과 현재 과업 이해를 우선한다.

검증 지표는 3초 목표 인식, 첫 상호작용 시간, 오클릭, marker 누락, 기술 오류 후 복귀 성공률이다. 3초와 합격률 역시 provisional이며 pilot 근거로 조정한다.

## 7. 마을별 재화 시각 명세

명칭은 Design Bible의 제안을 유지한 **작업명**이다. 실제 사용자 조사·번역·상표 검토 후 바꿀 수 있지만 여섯 zone의 분리는 유지한다.

| Zone | 한국어 / English 작업명 | 형태·실루엣 | 색 | 텍스처·소형 식별 | 획득 연출·인벤토리 | marker와의 차이 / 비색상 단서 |
|---|---|---|---|---|---|---|
| Animal | 온기 방울 / Warmth Bell | 둥근 방울, 아래쪽 발자국 홈 | `#D98C45` / `#FFF0C2` | 목재·털결; 16px에서 원형 몸체+짧은 손잡이 | 부드러운 1회 흔들림; 원형 slot | marker의 파형 링 없음; 발자국 홈과 손잡이 |
| Human | 이야기 실타래 / Story Spool | 감긴 타원과 옆 매듭 | `#C85C78` / `#FFD6BE` | 교차 실선; 16px에서 가로 타원+매듭 돌기 | 실 한 줄이 감기며 고정; 타원 slot | marker보다 비발광; 교차선과 비대칭 매듭 |
| Nature | 이슬 결정 / Dew Crystal | 잎을 품은 물방울 | `#3F9F83` / `#CDEB88` | 투명 결정·잎맥; 16px에서 뾰족한 물방울 | 작은 물결 1회 후 정지; 물방울 slot | marker 링 없음; 끝점과 내부 잎맥 |
| Urban | 신호 합금 / Signal Alloy | 육각 너트와 중앙 파형 홈 | `#4F6F91` / `#F2C14E` | 금속·점선 회로; 16px에서 육각형 | 두 조각이 맞물려 고정; 육각 slot | marker의 원형 링과 다른 각진 외곽·볼트 홈 |
| Music | 공명 조각 / Resonance Shard | 비대칭 음파 판 | `#7C5CC4` / `#F0C8FF` | 반투명 레코드 홈; 16px에서 기울어진 판 | 짧은 파문 1회 후 수납; 사선 slot | 음표 대신 절단면·평행 홈, 지속 맥동 없음 |
| Lab | 스펙트럼 프리즘 / Spectrum Prism | 절단된 삼각 결정 | `#245B86` / `#E2B44D` | 유리·분광선; 16px에서 삼각 쐐기 | 한 번 분광 후 정지; 삼각 slot | marker 파형 glyph 없음; 삼각 외곽과 3분할 선 |

공통 규칙:

- 재화는 맵에 미리 놓인 수집물처럼 보이지 않는다. 저장 성공 화면과 인벤토리·recipe에서만 결과물로 등장한다.
- 16px 단색 실루엣 시험, 24/32px 색각 시뮬레이션에서 여섯 종류를 구분한다.
- 색만으로 구분하지 않고 실루엣, 내부 패턴, zone/텍스트 라벨을 함께 쓴다.
- 획득 애니메이션은 provisional 0.8~1.5초이며 한 번만 재생하고 annotation 패널을 가리지 않는다.
- 획득 toast에는 `+1 온기 방울 · Animal`처럼 수량, 이름, 출처를 함께 표시한다.

## 8. 재화 지급과 복수 재화 recipe

### 8.1 지급 기본안

`유효 annotation 1건 = 해당 zone 재화 기본 1단위`를 provisional 경제 가설로 사용한다. pilot data에서 annotation 소요 시간, 이탈률, zone별 참여량을 확인한 뒤 단위와 recipe 비율을 조정한다.

- 속도, 표현 길이, 재생 횟수, 반복 제출로 추가 재화를 주지 않는다.
- 중복 지급 방지와 보상 재시도 구조는 향후 기술 안정화 제안으로 별도 검토한다.
- Music은 선행 15개로 초기 보유량이 높아질 수 있으므로 이후 recipe의 상시 병목으로 만들지 않는다.

### 8.2 recipe 설계 원칙

- 일반 아이템은 2~3개 마을, 특별 아이템은 4~6개 마을 조합을 사용할 수 있다는 provisional 가설로 시작한다.
- 한 zone만 반복하는 전략이 모든 선호 아이템에 항상 최적이 되지 않게 한다.
- 인기 아이템군 전체에서 zone별 요구 횟수와 총량을 비교한다.
- 실제 annotation 시간·난도가 다르면 동일 수량이 아니라 체감 노력 균형을 pilot data로 조정한다.
- 희귀성은 참여 다양성을 제안할 수 있지만 과도한 반복 작업이나 성급한 annotation을 강요하면 안 된다.
- 재화 부족 UI는 특정 마을을 광고하기보다 부족 zone과 현재 연구 과업을 중립적으로 보여준다.

### 8.3 검증용 sample recipe

아래 수량은 경제 확정값이 아닌 pilot용 예시다.

| 아이템 | 분류 | 예시 recipe | 검증 목적 |
|---|---|---|---|
| 포근한 숲 벽지 | 일반 | 온기 방울 2 + 이슬 결정 2 | Animal/Nature 2-zone 진입 유도 |
| 이야기 선반 | 일반 | 이야기 실타래 2 + 신호 합금 1 + 이슬 결정 1 | Human/Urban/Nature 3-zone 조합 |
| 공명 오디오 가구 | 일반 | 공명 조각 2 + 신호 합금 2 + 스펙트럼 프리즘 1 | Music 과잉 재고 흡수 여부와 3-zone 균형 검증 |
| 여섯 마을 관측 램프 | 특별 | 여섯 재화 각 1 | 전 zone 최소 참여 동기와 부담 검증 |
| 공동체 축제 세트 | 특별 | 온기 방울 2 + 이야기 실타래 2 + 이슬 결정 2 + 신호 합금 2 | 4-zone 조합의 이탈 위험 검증 |

## 9. Museum 연결과 분리된 데이터 계약

전체 흐름:

`sound 발견 → 유효 annotation 저장 → 해당 zone 재화 지급 → sound별 고유 참여자 수 증가 → 고유 참여자 5명 충족 → 반대 그룹 Museum 투표 가능`

각 조건은 서로 다른 계약이다.

| 계약 | 충족 조건 | 생성/변경 결과 | 포함하지 않는 것 |
|---|---|---|---|
| annotation 완료 | 배정된 sound, 최소 1회 재생, 비어 있지 않은 표현, 현재 저장 계약상 성공 | 유효 annotation과 marker 완료 가능 | 패널 닫기, 빈 표현, technical failure, legacy skip |
| 재화 지급 | 유효 annotation 저장 성공 | 해당 zone 재화 지급 | 저장 전 요청, 오류/skip row |
| 마을 해금 | 일반 참여자의 Music Block 1 배정 sound 15개 모두 유효 완료 | 나머지 다섯 마을 접근 허용 | 단순 재화 잔액, Museum vote, technical failure |
| Museum 후보 충족 | 동일 sound에 올바른 group/session의 고유 participant 5명, 각 유효 표현 하나 | 반대 그룹용 후보 sound와 표현 5개 | row 5개이지만 고유 4명, 빈 표현, duplicate, legacy skip |
| 투표 자격 | 후보 annotation과 반대 그룹이며 올바른 session, 해당 sound 미투표 | 표시 순서가 무작위인 표현 5개 평가 가능 | 같은 그룹, 잘못된 session, 재투표 |

Museum의 후보 **구성**은 고유 참여자 5명의 유효 표현 하나씩이다. **표시 순서**만 매 노출 시 무작위화하며 저장 시간이나 DB 반환 순서가 위치 효과를 결정하지 않게 한다.

## 10. 예외와 데이터 무결성

이 절은 기존 감사에서 도출된 **향후 기술 안정화 제안**이다. 2B 디자인 preview의 구현 범위나 합격 조건이 아니며 production 코드·DB에 적용하지 않는다.

| 시나리오 | annotation row | 진행률 | 재화 | marker | Museum 고유 인원 |
|---|---|---|---|---|---|
| 제출 버튼 연속 클릭 | 같은 idempotency 요청, canonical 1행만 | 1회 | 1회 | submitting→completed 1회 | +1명만 |
| 저장 응답 전 화면 닫기 | 서버 미성공이면 없음; 성공했다면 복귀 시 기존 결과 조회 | 확정 성공 때만 1회 | 확정 성공·미지급이면 1회 | 결과 조회 전 pending, 이후 active/completed 정합화 | 성공 때만 +1명 |
| 저장 성공 후 응답 유실 | 기존 canonical 행 반환 | 1회 | ledger 확인 후 0 또는 1회 보정 | 재진입/동기화 후 completed | +1명만 |
| 복수 탭 동일 sound 제출 | DB/서버가 한 canonical 행만 허용 | 1회 | 1회 | 두 탭 모두 기존 완료 결과로 수렴 | +1명만 |
| 완료 sound 재진입 | 새 행 없음, 읽기 전용 | 변화 없음 | 추가 없음 | completed 유지 | 변화 없음 |
| 오디오 재생 실패 | 없음, technical failure도 annotation으로 저장 안 함 | 없음 | 없음 | technical-audio-error 또는 active 복귀 | 변화 없음 |
| 빈 표현 제출 | client/server 거부, 행 없음 | 없음 | 없음 | interacting 유지, 입력 오류 표시 | 변화 없음 |
| 네트워크 끊김 | 성공 확인 전 새 완료로 간주하지 않음; 같은 key로 재시도 | 확인 전 없음 | 확인 전 없음 | save-error/retry | 확인된 성공 전 변화 없음 |
| 재화 지급만 실패 | canonical 행 유지 | 완료 반영 | 미지급 ledger를 멱등 재시도/조정 | completed + 보상 처리 안내 | +1명 유지 |
| legacy duplicate row | 이번 단계에서 삭제·병합 안 함; 분석 정책 flag | canonical 정책 결정 전 중복 집계 금지 | 중복 지급 제외/조정 검토 | 한 번만 completed | distinct participant로 +1명만 |
| legacy skip row | 보존 가능하나 유효 annotation 아님 | 제외 | 제외 | 미완료로 취급 | 제외 |
| 잘못된 group/session | 연구 유효 집계에서 제외·검토 queue | 제외 | 제외/조정 | 유효 완료로 표시하지 않음 | 제외 |
| 5행이지만 고유 참여자 4명 | 행은 보존하되 duplicate flag | 행별 완료와 별개 | canonical 제출별만 | 개인별 상태 유지 | 4명, Museum 후보 아님 |

legacy migration 전에 연구자가 결정할 사항:

- duplicate valid row 중 최초 제출, 최신 제출, 수동 검토 중 canonical 선택 정책
- annotation 수정 허용 여부와 감사 로그 정책
- legacy skip row의 보존 기간과 분석 제외 표식
- 잘못된 group/session 기록의 격리·수정 권한

## 11. 화면 명세와 텍스트 wireframe

### 11.1 데스크톱 맵

```text
┌──────────────────────────────────────────────────────────────┐
│ Zone · Block · 진행률                         재화 요약/메뉴 │
│                                                              │
│   [완료 ○]          (( 활성 sound ))                         │
│                            ↑ 근거리                           │
│                    ┌────────────────┐                        │
│                    │  E  소리 듣기  │        [잠김 ◇]        │
│                    └────────────────┘                        │
│              플레이어                                        │
│                                                              │
│ 상태 범례/접근성 설정                         출구/월드맵      │
└──────────────────────────────────────────────────────────────┘
```

- 활성 marker가 환경 장식보다 높은 국소 대비를 갖는다.
- 완료 marker는 정적이고 active보다 약하다.
- 재화는 상단 잔액에만 있으며 맵의 수집물처럼 배치하지 않는다.

### 11.2 모바일 맵

```text
┌──────────────────────┐
│ Zone · Block    메뉴 │
│                      │
│   (( 활성 sound ))   │
│          플레이어    │
│                      │
│ [탭하여 소리 듣기]   │  ← 44 CSS px 이상
│ 진행률       월드맵  │
└──────────────────────┘
```

- hover 없이 근거리 라벨을 표시한다.
- 하단 동작 영역은 OS gesture와 겹치지 않고 화면 확대에서도 유지한다.

### 11.3 annotation 입력 패널

```text
┌──────────── 이 소리를 어떻게 표현하겠어요? ────────────┐
│ [▶ 소리 재생]  재생 0회                                 │
│                                                         │
│ 표현 [____________________________________________]      │
│ confidence [낮음] [보통] [높음]                         │
│                                                         │
│ [닫고 맵으로]                         [제출 비활성]      │
│ ※ 닫으면 저장되지 않으며 이 sound는 미완료로 남습니다. │
└─────────────────────────────────────────────────────────┘
```

- 최소 1회 재생과 비어 있지 않은 표현 뒤 제출을 활성화한다.
- Skip/건너뛰기/skip reason은 없다.
- 닫기는 포기가 아니라 저장 없는 미완료 복귀다.

### 11.4 저장 중·성공·오류

```text
저장 중:  [spinner] 저장 중…  [제출 disabled]
성공:     [완료 체크] 저장 완료  +1 이슬 결정 · Nature
저장 오류:[경고] 저장되지 않았습니다  [같은 요청 재시도] [맵 복귀]
오디오 오류:[끊긴 파형] 재생할 수 없습니다 [재시도] [맵 복귀] [연구자 문의]
```

- 저장 성공 toast와 재화 연출은 provisional 0.8~1.5초 후 축약되며 기록은 인벤토리에 남는다.
- 오류 화면은 “진행률과 보상이 반영되지 않았다”는 결과를 명시한다.
- 저장 성공 후 재화만 실패한 경우 annotation을 실패로 되돌리지 않고 `보상 처리 중/문의`를 보여준다.

### 11.5 완료 marker

```text
Active:     (( ~ 파형 ~ ))  느린 호흡형 링
Completed:  [ ● ✓ ]         정적 채움 링 + 완료 라벨
Error:      [ △ ! ]         정적 경고 외곽 + 재시도 라벨
```

완료 marker는 active보다 작거나 낮은 대비로 보여 다음 미완료 과업을 방해하지 않는다.

## 12. Acceptance criteria

### 12.1 디자인

- [ ] 여섯 마을에서 동일한 marker 상태 문법을 사용한다.
- [ ] 맵에서 재화가 수집 대상처럼 보이지 않고 sound가 annotation 대상으로 읽힌다.
- [ ] active가 completed·환경 장식보다 강하게 보인다.
- [ ] 3~7개, 3초, 밀도·접근·매력·연출 수치는 provisional/pilot 조정 대상으로 기록된다.
- [ ] 데스크톱과 모바일의 정상·제출·성공·오류·완료 상태 시안이 있다.

### 12.2 연구 안전성

- [ ] Music-first와 배정된 Music Block 1 15개 유효 제출 해금을 유지한다.
- [ ] voluntary skip UI·상태·저장 row가 없다.
- [ ] 빠른 제출, 표현 길이, 반복 클릭에 추가 보상을 주지 않는다.
- [ ] technical failure와 참여 중단·철회를 annotation 결과와 분리한다.
- [ ] Museum은 올바른 group/session의 고유 참여자 5명과 표현 하나씩을 사용한다.
- [ ] 반대 그룹의 투표 자격과 이미 투표한 sound 제외를 명시적으로 검증한다.

### 12.3 접근성

- [ ] 모든 상태가 색 외에 두 가지 이상의 단서를 갖는다.
- [ ] 키보드만으로 marker 진입, 재생, 입력, 제출, 재시도, 맵 복귀가 가능하다.
- [ ] 모바일 터치 목표가 최소 44 CSS px이며 화면 키보드에 제출 버튼이 가리지 않는다.
- [ ] busy·success·error가 보조 기술에 전달되고 focus가 예측 가능하게 이동한다.
- [ ] reduced-motion에서 맥동·획득 애니메이션을 정적 표현으로 대체한다.
- [ ] technical error에 평문 설명, 재시도, 복귀, 문의 경로가 있다.

### 12.4 향후 기술 안정화 검토 — 현재 디자인 acceptance 아님

- [ ] 동일 `participant_id + sound_id + 연구 단계/세션 범위`에 canonical valid row 하나만 존재한다.
- [ ] 연속 클릭, 재시도, 새로고침, 복수 탭, 동시 요청이 중복 row·진행률·재화를 만들지 않는다.
- [ ] 첫 성공 이후 같은 요청은 기존 성공 결과를 반환한다.
- [ ] Museum 집계가 고유 참여자 기준이며 빈 표현·duplicate·legacy skip·technical failure·잘못된 group/session을 제외한다.
- [ ] 재화 지급 실패가 annotation을 삭제하지 않으며 보상 재시도도 중복 지급하지 않는다.
- [ ] audit에서 annotation, 진행률, 재화 지급, Museum 자격의 근거를 추적할 수 있다.

## 13. 향후 기능·기술 backlog — 2B whitebox 범위 아님

아래 항목은 별도 기능·DB 승인을 받은 뒤에만 착수한다. 현재 2B는 marker와 Music whitebox preview만 다룬다.

### UI·상태

- [ ] skip UI·skip reason·skip 저장 호출 제거
- [ ] marker 9개 상태와 desktop/mobile 입력 구현
- [ ] 패널 닫기 시 미완료 복귀
- [ ] technical audio error의 재시도·맵 복귀·문의 구현
- [ ] submitting 잠금, 재진입 결과 동기화, 완료 sound 읽기 전용 처리

### 저장·무결성

- [ ] canonical 범위와 idempotency key 계약 확정
- [ ] 서버/DB 중복 방지와 기존 성공 응답 구현
- [ ] 진행률·재화 지급의 중복 방지
- [ ] legacy skip/duplicate/group-session 데이터 audit 및 migration 계획 작성
- [ ] annotation 수정 정책과 감사 로그 결정

### Museum

- [ ] 임계값 4를 고유 참여자 5명으로 변경
- [ ] distinct participant 집계와 참여자당 canonical 표현 하나 조회
- [ ] 후보 조회 단계의 group/session 자격 검증
- [ ] 확정된 5개 표현의 표시 순서만 무작위화
- [ ] 5행/4명, duplicate, legacy skip 회귀 테스트

### 재화·recipe

- [ ] zone별 6개 독립 잔액/ledger 계약 설계와 migration 검토
- [ ] canonical annotation당 해당 zone 재화 1회 지급
- [ ] 멱등 보상 재시도/조정 경로
- [ ] 단일 `price`를 복수 zone recipe로 확장하는 호환 계획
- [ ] pilot 경제 값, Music 초기 보유 효과, zone별 참여 균형 계측

### 검증

- [ ] 일반 A/B와 연구용 access ID 시나리오 분리 검수
- [ ] 저장·응답 유실·복수 탭·네트워크 장애 테스트
- [ ] 키보드·모바일·색각·저시력·reduced-motion 검수
- [ ] 기존 annotation, block, Overall Progress, house decor 흐름 회귀 검수

## 14. 향후 기술 구현 전 연구자 확인이 필요한 미결정 사항

1. canonical 고유키에 포함할 정확한 `연구 단계/세션` 필드와 재참여 허용 범위
2. 첫 유효 제출 이후 annotation 수정을 금지할지, 감사 가능한 갱신을 허용할지
3. legacy duplicate 중 최초·최신·수동 검토 중 canonical 선택 정책
4. legacy skip row의 보존 기간, 분석 제외 표식, migration 이후 접근 정책
5. 잘못된 group/session 데이터의 격리·수정·제외 절차
6. 재화 1단위 기본안과 실제 recipe 가격을 검증할 pilot 설계 및 성공 지표
7. 재화 한국어·영문 작업명의 사용자 이해도와 최종 명칭
8. 재화 지급 실패 시 자동 재시도 횟수, 연구자 조정 권한과 참여자 안내 문구

이 항목들이 확정되기 전에는 DB schema, migration, 보상 경제를 임의로 구현하지 않는다.
