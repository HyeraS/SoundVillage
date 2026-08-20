# 3D research prototype architecture

## 범위와 경계

`/3d-prototype`은 Music 마을 Block 1만 다루는 독립 수직 프로토타입이다. `/`의 기존 2D 흐름, Sound Museum Stage 2, 코인·보상·집꾸미기, Supabase 스키마는 바꾸지 않는다. WebGL 코드는 Client Component에서 동적 import되므로 기존 서버 렌더링 경로와 분리된다.

## 데이터 흐름

1. 기존 `StartPanel`이 `participantId`와 그룹 A/B를 전달한다.
2. `studyAccess.mjs`의 연구 접근 ID 및 고정 그룹 규칙을 그대로 적용한다.
3. `sound_metadata.json`에서 `game_zone=Music`, `block=1`, 해당 그룹을 필터한다.
4. 정렬된 `sound_id`에 고정 좌표를 대응해 재현 가능한 오브젝트 배치를 만든다.
5. 기존 `getAnnotatedByParticipantZone` 결과를 구·신 sound ID 숫자 bridge로 정규화해 완료 상태를 표시한다.
6. 상호작용 시 Canvas 밖 DOM에 기존 `AnnotationPanel`을 띄운다. 실제 모드에서는 기존 `saveAnnotation`과 필드 계약을 그대로 사용한다.
7. 제출 성공 콜백 뒤에만 3D 오브젝트를 완료 처리한다. skip과 저장 실패는 완료로 세지 않는다.

브라우저 검증용 `?mock=1`은 조회·저장을 모두 우회한다. 실제 연구 데이터베이스에 테스트 row를 만들지 않기 위한 전용 모드이며 화면에 명시적으로 표시된다.

## 2D와 동일하게 유지한 요소

- 참여자 ID, session/group ID, 그룹 A/B와 연구 접근 ID 규칙
- Music Block 1의 사운드와 수량, `sound_id`, `zone`, `block`, metadata
- 오디오 재생, 최소 1회 청취, 자유 텍스트 문구, 80자 제한
- confidence 1/3/5 척도, play count, listening time, skip 의미
- Stage 1 `saveAnnotation` 저장 필드 및 완료 판정
- Stage 2 vote와 Museum 경로, 보상·집꾸미기 코드 및 DB 스키마

## 3D 조건에서 변경된 요소

- 2D map 대신 직교 카메라의 저폴리 정원 공간에서 avatar를 직접 이동한다.
- 사운드 접근에 공간 이동, 단순 AABB 충돌, follow camera가 추가된다.
- WASD/방향키, 모바일 D-pad, Enter/Space 상호작용을 제공한다.
- 완료 여부를 구체의 크기·표식과 수치 진행도로 함께 전달한다.

## 잠재적 연구 confound

- 3D의 이동 시간, occlusion, 장치별 frame rate와 조작 숙련도가 과업 시간에 영향을 줄 수 있다.
- 화면 크기·입력 장치·멀미/피로·WebGL 성능 차이가 참여 지속성에 영향을 줄 수 있다.
- 3D의 novelty와 더 강한 시각 보상이 annotation 품질과 독립적으로 참여도를 높일 수 있다.
- 연구자 전체 접근 모드는 30개 배치이므로 실제 A/B 참여자 조건과 비교 자료로 쓰면 안 된다.
- placeholder와 최종 GLB의 silhouette/색/animation 차이는 탐색 난이도를 바꿀 수 있다.

## 향후 측정 이벤트

- 세션/Block 시작·종료, 장치/viewport/WebGL renderer(개인 식별 정보 제외)
- 이동 거리와 시간, collider 접촉 횟수, object 발견→상호작용 지연
- 재생 횟수·청취 시간, panel open/close/skip/save error, annotation 완료 시간
- frame-time 구간 통계와 context loss, mobile control 사용 여부
- 보상 노출과 집꾸미기 진입은 연구 설계가 확정된 뒤 별도 이벤트로 추가

이 이벤트는 이번 프로토타입에서 DB schema나 실제 연구 로그를 변경하지 않으므로 아직 기록하지 않는다.

## 2D/3D A/B 실험 통제 변수

- 동일 그룹, 동일 Music Block 1 sound set/순서 정책, 동일 AnnotationPanel 문구와 confidence 척도
- 동일 최소 청취 규칙, 저장 성공 기준, skip 처리, 보상 정책
- 동일 기기 또는 기기 유형 층화, 동일 실험 시간·안내·네트워크 조건
- 최종 3D asset 버전, viewport, input method, frame-rate 등 성능 조건 기록
- 노출 순서의 counterbalancing과 3D 게임 경험 사전 측정

## 렌더링과 에셋 교체

`assetManifest.mjs`가 URL, placeholder, transform, shadow, collider, animation mapping을 관리한다. 기본은 geometry placeholder라 GLB가 없어도 완주 가능하다. `?models=1`은 manifest URL 로딩을 시험하며 실패 항목은 error boundary 안에서 placeholder로 돌아간다. `?forceModelFailure=1`은 브라우저 폴백 검증용이다.

충돌은 render mesh가 아니라 `modelConfig.mjs`의 원/AABB 데이터로 계산한다. 매 frame에는 ref만 갱신하고 React state는 근접 오브젝트가 바뀔 때만 갱신한다. DPR을 1.5로 제한하고 복잡한 physics·postprocessing·reflection은 사용하지 않는다. 반복 소품 수가 최종 asset에서 늘면 첫 성능 개선 대상으로 `InstancedMesh` 전환을 검토한다.
