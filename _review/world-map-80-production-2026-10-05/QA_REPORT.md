# SoundVillage 월드맵 전용 80% 카메라 정식 적용 QA

## 결론

월드맵 production 기본 표시 배율은 **0.8**이다. FOV는 기존 기준의 `baseFov / 0.8`이며 CSS로 월드 오브젝트를 축소하지 않는다. development에서는 `1`, `0.8`, `0.75` 비교가 가능하고, 기본값·잘못된 값은 0.8이다. production에서는 query로 `1` 또는 `0.75`를 요청해도 0.8로 고정된다. overview는 3840×2880 전체 월드를 유지한다.

## 변경 파일과 목적

- `lib/worldMapCamera.mjs`: 정식 기본값과 환경별 query 계약.
- `components/WorldMap.js`: 월드맵 기본 QA/production scale을 정식 상수에 연결.
- `components/world-map/WorldMapActors.js`: 로컬·duo 월드 캐릭터의 기존 화면 크기 보정 기본값 연결.
- `scripts/test-world-map-camera.mjs`, `scripts/test-character-render-metrics.mjs`, `scripts/test-world-map-production-integration.mjs`: 카메라·캐릭터·production 계약 자동 검증.
- `scripts/capture-world-map-scale-prototype.mjs`: 별도 review root와 8개 목적지/DPR 비교 지원.
- `scripts/test-world-map-80-production.mjs`, `scripts/measure-world-map-80-performance.mjs`: 정식 브라우저/성능 검증.

## 변경하지 않은 계약

월드 3840×2880, 타일 120×90, 타일 32px, 플레이어 충돌 72×88 및 foot 28×16, 스폰, 여섯 포털, 도서관, 우리 집, collision mask, authored route, interaction range, 이동 속도, 자동 이동, duo 좌표는 변경하지 않았다. 월드맵에 `transform: scale()`을 적용하지 않았다.

마을/내부/config/collision/navigation/generated 데이터 29개 파일은 작업 전후 SHA-256이 모두 일치한다. 상세값은 `baseline-file-hashes.json`과 `after-file-hashes.json`에 있다.

## viewport별 플레이어 화면 크기

| viewport | 정식 80% player CSS (W×H) | 최대 크기 차이 | 중앙 발점 오차 | 최소 라벨 |
|---|---:|---:|---:|---:|
| 1280×720 | 83×101.444 | 0.0002% | 0px | 17px |
| 1440×900 | 105.5×128.944 | 0.0002% | 0.0001px | 20px |
| 1920×1080 | 128×156.444 | 0.0002% | 0px | 23px |
| 390×844 | 98.5×120.389 | 0.0001% | 0px | 17px |
| 844×390 | 79.125×96.708 | 0.0001% | 0px | 17px |

모든 조건이 ±5%, 중앙 발점 2 CSS px, 핵심 라벨 12 CSS px, 표시된 모바일 confirm 44×44 CSS px 기준을 통과했다.

## 여덟 월드맵 목적지 외관 검수

도서관, 우리 집, 연구소, 자연, 음악, 동물, 도시, 인간 외관을 5개 viewport의 DPR1과 1440×900 DPR2에서 확인했다. 여섯 마을 내부나 집/도서관 내부는 열거나 수정하지 않았다. 8개 목적지 모두 건물·길·문·캐릭터 비율, 입구 라벨, 화면 경계, seam/빈 영역, HTTP/image/console 오류 기준을 통과했다. Full HD 비교 이미지를 직접 확인했으며 라벨·입장 prompt가 출입 구조를 식별 불가능하게 가리는 사례는 없었다.

## cold-cache 성능 비교

1440×900 DPR1, 기본 스폰/도서관, 새 non-persistent Chromium context 조건별 3회.

| 항목 | 100% 비교 | 정식 80% |
|---|---:|---:|
| 첫 화면 visible assets | 8 | 9 |
| cold transfer bytes | 2,762,952 | 3,354,890 |
| 예상 decoded RGBA | 45,955,076 | 60,700,676 |
| mapReadyMs 평균 (범위) | 100.73 (95.5–105.0) | 106.13 (96.7–117.9) |
| 평균 FPS | 120 | 120 |
| 50ms 초과 slow frame | 0 | 0 |
| max frame ms | 9.30 | 9.03 |
| 1.5초 카메라 이동 추가 요청 | 4 | 6 |
| console/HTTP/image error | 0 | 0 |

80%는 더 넓은 FOV 때문에 첫 화면 에셋 1개, 약 592KB 전송, 약 14.75MB decoded RGBA, 이동 중 요청 2개가 증가했다. mapReady 평균 증가는 5.4ms이며 범위가 겹친다. slow frame, 오류, 지속 메모리 증가 징후는 없었다.

## 소유 hunk와 제외 hunk

이번 작업 소유는 정식 scale 기본값/query 계약, 월드 FOV 기본값, 월드 캐릭터/라벨 보정 기본 연결, 관련 테스트와 QA 산출물이다. 같은 파일에 이미 존재하던 Duo identity/장비, 마을 복귀 위치, Economy/Attendance, 임시 해제, 걷기 프레임 및 기타 병렬 작업 hunk는 수정하거나 되돌리지 않았다. 상세 범위는 `scope-diff.txt`에 있다.

## 대표 이미지

- 1920×1080 도서관 비교: `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-80-production-2026-10-05/03-comparisons/full-1920x1080-library.png`
- 1920×1080 200% crop: `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-80-production-2026-10-05/03-comparisons/crop-200pct-1920x1080-library.png`
- 모바일 세로 자연: `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-80-production-2026-10-05/03-comparisons/full-390x844-nature.png`
- 모바일 가로 도시: `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-80-production-2026-10-05/03-comparisons/full-844x390-urban.png`

## 잔여 문제

- Full HD의 일부 원본 에셋 잔여 블러는 기존 권고대로 별도 에셋 보강 범위다.
- 루트 production UI는 실제 참여자 인증 없이는 월드맵으로 들어가지 않으므로, 외부 인증 상태를 만들지 않고 production query 차단은 순수 계약 테스트로, 화면은 동일한 0.8 카메라 경로의 내부 QA 진입점으로 검증했다.
- commit, push, PR, 배포는 수행하지 않았다.
