# SoundVillage 월드맵 v4 인수인계

작성일: 2026-09-27 (Asia/Seoul)

이 문서는 새 ChatGPT 채팅이 기존 대화를 읽지 못하더라도 SoundVillage 월드맵 작업을 같은 기준으로 이어가기 위한 단일 인수인계 문서다. 새 채팅은 먼저 이 문서를 읽고, 구현은 Codex에 한 단계씩 독립적인 프롬프트로 지시한다.

## 1. 현재 결론

작업은 서로 다른 두 트랙으로 구분해야 한다.

1. **Home 개선 트랙**: 구현·검증·격리 리뷰까지 완료됐다. 현재 상태는 `commit-ready, not staged`이다.
2. **전체 월드맵 화질 트랙**: 아직 근본 해결 전이다. 다음 조사 단계인 Step 11부터 시작해야 한다.

Home만 놓고 보면 기존의 화풍 불일치, 비균등 리사이즈, 잘못된 알파 크롭, 기존 정원 위 중복 합성, 통행·충돌 문제는 해결됐다. 그러나 전체 월드맵은 여전히 주로 1× 래스터 에셋을 SVG 카메라가 비정수 배율로 축소·확대하므로 화면 크기에 따른 흐림과 세부 손실이 남아 있다.

## 2. 작업 공간을 절대 혼동하지 말 것

### 원본 dirty checkout

- 경로: `/Users/hyera/Documents/SoundVillage-house-decor-2d`
- 브랜치: `house-decor-2d`
- 용도: 기존 작업과 `_review` 기록 보존
- 상태: 매우 많은 사용자 소유 dirty/untracked 파일이 있음
- 금지: 정리, reset, clean, 광범위한 checkout/restore, release staging

### 격리된 Home release worktree

- 경로: `/private/tmp/soundvillage-home-step10.rUSop0`
- 브랜치: `codex/world-map-home-native`
- Base/현재 HEAD: `8e6567f896dfde6781dd0f641db197a4255d111f`
- 용도: 승인된 Home release 후보 45개 파일만 staging/commit
- 현재 상태: 정확히 45개 변경, staged 0, commit 0, push 0, deploy 0
- 이 worktree는 삭제하지 말 것

Step 10에서 마지막으로 수정된 두 파일은 원본 checkout이 아니라 이 격리 worktree에만 존재한다.

- `scripts/test-world-map-hd-collision.mjs`
- `scripts/test-world-map-production-integration.mjs`

두 테스트가 기본 실행 시 `_review`에 쓰던 동작을 `--report` 사용 시에만 기록하도록 변경했다.

## 3. 처음 문제였던 것

- Home의 경계와 장식 밀도가 기존 월드보다 지나치게 높아 고해상도 스티커처럼 보였다.
- Home만 별도 투명 PNG였고 기존 건물은 월드 원본에서 잘라 사용했다.
- 원본을 `448×384`에 `fit: fill`하여 약 9.2%의 비율 왜곡이 있었다.
- 거의 투명한 알파 노이즈 때문에 잘못 크롭되고 시각물·좌표·충돌 기준이 어긋났다.
- 빈 부지 없이 기존 중앙 정원 위에 합성되어 울타리·꽃·조명·관목이 이중으로 겹쳤다.
- 집 앞 길이 기존 보행로와 연결되지 않았고 충돌 영역이 통행을 방해했다.
- 전체 월드의 비정수 카메라 배율 때문에 가는 선의 선명도가 화면마다 달라졌다.
- 더 큰 구조 문제로 물체별 교체·이동, collision metadata, depth 분리, 부분 재제작이 어려웠다.

## 4. Step 0–10 완료 내용

### Step 0–1: 부지·통행 기준 확정

- Home `visualBox`: `(1472,1395)–(1824,1696)`, `352×301`
- collider/footprint: `(1520,1472)–(1776,1696)` — 반개방 좌표
- `groundContact`: `(1648,1696)`
- `doorPoint / approachPoint`: `(1648,1760)`
- `roadConnectionPoint`: `(1824,1760)`
- `sortY`: `1696`
- `siteBounds`: `(1440,1344)–(1856,1824)`
- 남측 통과로: `(1344,1728)–(1856,1792)`, 폭 64px
- 동측 보호 주도로: `(1824,1440)–(1952,1888)`, 폭 128px
- 연결성, pinch, 목적지 접근, stalled frame 검증 PASS

### 충돌 시스템

- `objectId / colliderId / collisionRole / shapes` 기반 논리 오브젝트 스키마
- `rect`와 오목 `polygon` 지원
- 반개방 좌표 사용
- 월드 픽셀 래스터화 → `29×17` clearance → 4px max-pool
- JavaScript 충돌 빌더가 authority이며 Python 빌더는 legacy/reference
- 이유 조회와 실제 마스크 간 691,200셀 parity 검증

### WorldObject 구조 마이그레이션

- schema/validator, legacy adapter, projection compiler, production facade 구현
- Library pilot을 먼저 native authority로 이전
- 렌더 순서:
  `terrain → environment → ground → world+characters → object foreground → global foreground → overlay → UI`
- sparse layer override, 안정적 depth sort, 오브젝트 union 기준 atomic culling 구현

### Home 아트 및 통합

- Candidate A 승인
- building: `352×301`
- site ground: `512×480`
- Candidate A 평균 에지: `9.5236/255`
- 강한 에지 비율: `2.7513%`
- foreground 레이어는 불필요하다고 판정
- Home 렌더: `ground + world` 2개 레이어
- Home과 Library만 `native`, 나머지 16개 오브젝트는 `legacy`
- DOM에서 Home image 2개, legacy 중복 0
- interaction/approach/minimap 기준은 `(1648,1760)`
- collision 변경: 신규 차단 240셀, 해제 1,248셀
- 4 viewport 브라우저, minimap, interaction, auto-walk, collision QA PASS
- root client gzip 증가는 175B

### Step 9–10: release 감사 및 격리

- release 후보: 정확히 45개 파일
  - authored/code 35개
  - 재생성 가능한 generated 10개
- review-only, unrelated, unknown, Candidate B 유입 0
- lint, 생성물 freshness/determinism, 핵심 테스트, Playwright, Next.js 16.2.7 production build PASS
- open release blocker 0
- stage/commit/push/deploy는 아직 하지 않음

## 5. 현재 architecture의 의미

이제 Home은 완성된 큰 배경 위에 임의의 PNG 하나를 얹는 구조가 아니다.

- `WorldObject`가 렌더, 충돌, destination, minimap, path, bounds의 authored authority가 된다.
- projection compiler가 production consumer용 runtime/collision 데이터를 생성한다.
- Home의 지면과 본체는 별도 레이어지만 culling은 union 단위로 함께 처리한다.
- collision은 목적지별 큰 사각형이 아니라 논리 오브젝트의 shape에서 생성된다.
- legacy adapter가 남아 있어 나머지 16개를 단계적으로 이전할 수 있다.

## 6. 아직 해결되지 않은 전체 월드맵 화질 문제

Home 자체의 화풍과 합성 문제는 해결됐지만 전체 월드 화질은 별도 과제다.

- HD master는 `5792×4344`, 월드 좌표계는 `3840×2880`으로 약 1.5× 원본 밀도다.
- 런타임의 많은 terrain/environment 에셋은 여전히 월드 픽셀 기준 1×에 가깝다.
- 카메라가 약 `0.58`, `0.609`, `0.943`, `1.198` 같은 비정수 배율을 사용해 브라우저가 계속 재샘플링한다.
- 맵이 완전히 하나의 거대 이미지는 아니지만, 12개 terrain panel과 8개 큰 environment cluster에 많은 장식이 baked 되어 있다.
- 화면에 표시되는 래스터의 decoded memory는 조건에 따라 대략 45–61MB 수준으로 추정됐다.
- 모든 에셋을 1.5×로 올리면 픽셀 면적이 약 2.25배, 2×면 4배가 되므로 일괄 고해상도화는 위험하다.
- `image-rendering: pixelated`나 단순 인공 업스케일은 현재 미술 방향에 맞는 해결책이 아니다.

따라서 다음 단계는 먼저 원인을 계측하고, 실제 소스 디테일이 존재하는 레이어만 선택적으로 1.5×로 제공하는 전략을 세워야 한다.

## 7. 앞으로의 권장 순서

1. **Home release checkpoint**
   - 격리 worktree에서 정확히 45개만 staging
   - 검토 후 별도 승인으로 local commit
   - push/PR/deploy는 다시 별도 승인
2. **Step 11 — 전체 월드 화질 기준선 감사**
   - production 변경 없이 source/runtime/browser 단계별 열화 원인을 계측
3. **Step 12 — 해상도·전송 정책 결정**
   - 에셋 클래스별 1×/1.5×, DPR·카메라 배율 선택 기준, 메모리·네트워크 예산 확정
4. **Step 13 — 중앙 정원 화질 pilot**
   - 1× 고품질, HD 기반 1.5×, 선택적 1.5× 후보를 동일 viewport에서 비교
5. **Step 14 — responsive asset pipeline**
   - manifest density variant, 선택·fallback·cache·hysteresis 구현
6. **Step 15 — 중앙 정원 baked layer 분해**
   - ground / 의미 있는 object / foreground만 분리
   - 꽃·잔디·작은 돌을 모두 개별 오브젝트로 만들지 않음
7. **Step 16 — 나머지 16개 legacy 오브젝트 단계 이전**
   - 중앙 환경 → 고위험 landmark → 나머지 landmark → 외곽 environment 순
8. **Step 17 — 전체 회귀**
   - 시각, 성능, 충돌, 경로, culling, bundle, 메모리, 네트워크 검증
9. **Step 18 — 배포·관찰 후 legacy 제거**

Home commit과 Step 11 화질 감사를 같은 변경 묶음으로 합치지 않는다.

## 8. 새 ChatGPT가 따라야 할 운영 규칙

- 사용자에게 받은 Codex 완료 요약만 보고 다음 단계를 단정하지 말고, 해당 `_review` 산출물과 Git 상태를 먼저 확인하도록 다음 Codex 프롬프트에 요구한다.
- 한 프롬프트에는 한 milestone만 넣는다.
- 모든 Codex 프롬프트에 `목표 / 범위 / 비범위 / 기준선 / 구현 또는 조사 방법 / 검증 / 산출물 / 중단 조건`을 명시한다.
- 구현 단계와 승인 단계, staging, commit, push, deploy를 서로 분리한다.
- 실패한 검증은 숨기지 말고 다음 단계로 넘어가기 전에 수정하게 한다.
- original dirty checkout의 기존 변경은 사용자 소유로 취급한다.
- Next.js 코드를 변경하는 단계에서는 `node_modules/next/dist/docs/`의 설치 버전 문서를 먼저 읽게 한다.
- generated 파일은 직접 손으로 고치지 말고 authority와 compiler/builder에서 재생성한다.
- 화면 화질은 스크린샷만이 아니라 요청 바이트, decoded memory, asset 선택, 카메라 scale/DPR, 픽셀 지표를 함께 본다.
- “PASS”는 명시된 acceptance criteria와 증거 파일이 모두 있을 때만 사용한다.

## 9. 신뢰할 수 있는 기준 문서

### Home release

- `_review/world-map-home-release-step9/FINAL_HANDOFF.md`
- `_review/world-map-home-release-step9/changeset-manifest.json`
- `_review/world-map-home-release-step9/final-hashes.json`
- `_review/world-map-home-release-step10/ISOLATION_RESULT.md`
- `_review/world-map-home-release-step10/FINAL_CODE_REVIEW.md`
- `_review/world-map-home-release-step10/COMMIT_PLAN.md`
- `_review/world-map-home-release-step10/RELEASE_FILE_LIST.md`
- `_review/world-map-home-release-step10/isolated-file-hashes.json`

### 아트·통행·구조

- `_review/world-map-home-art-step7/REVIEW_RESULTS.md`
- `_review/world-map-home-art-step7/ART_METRICS.json`
- `_review/world-map-home-production-step8/APPROVAL.md`
- `_review/world-map-home-production-step8/integration-results.json`
- `_review/world-map-home-circulation-step1/CIRCULATION_SPEC.md`
- `_review/world-map-object-model-step6/RENDER_LAYER_ARCHITECTURE.md`

## 10. 승인된 핵심 해시

- source building: `197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8`
- source ground: `4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b`
- runtime building: `5185988e7ae8f0e0ca9d1ddf3988cc022c3e1effc31d6c6f367c7d19e77d7f91`
- runtime ground: `308f71eb6191ea2d88aed364c0cd83dc53bf8da373a78c6e0f3a0fc341f3547b`
- runtime projection: `696883f247c92a24e3c827ebd9c79e81314172f1fba85845be06de0679d1ae72`
- collision projection: `4304831d801375981c079afde0966e53e315bca398a6d7229c162aa270608288`
- packed mask: `a1546e6624e73241c57e9273456b252e048852e5865d68cfb07c0e6b32b92be0`
- walkable mask PNG: `c85237a143a741ffde89c766b8fd19219339981f8056f570ac0ecdb8e5b48474`

## 11. 새 채팅의 첫 행동

새 ChatGPT는 이 문서를 읽은 뒤 먼저 다음 세 사실을 사용자에게 확인 보고해야 한다.

1. Home은 release 후보까지 완성됐지만 아직 staging/commit 전이다.
2. staging 대상은 격리 worktree의 정확한 45개뿐이다.
3. 전체 월드 화질은 Step 11 감사부터 별도 트랙으로 진행한다.

그 다음 사용자가 원하는 현재 행동이 `45개 staging`, `local commit`, 또는 `Step 11 준비` 중 무엇인지에 맞춰 한 단계짜리 Codex 프롬프트를 작성한다. 단, staging되지 않은 현재 상태에서 곧바로 commit 프롬프트를 주거나 화질 구현을 시작하게 해서는 안 된다.
