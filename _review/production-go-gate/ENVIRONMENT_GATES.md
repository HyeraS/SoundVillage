# Stage 6A-R — Production Environment Gates

- 점검 시각: 2026-10-05 19:13:51 KST
- 대상: Vercel `new-soundvillage` / `production`
- 게이트 판정: **NO_GO**
- 차단 코드: `REQUIRED_PRODUCTION_ENV_MISSING`

`vercel env ls production`의 read-only 메타데이터로 이름·존재·target만 확인했다. production 값을 로컬로 내려받는 작업은 모든 secret을 materialize하므로 수행하지 않았고, 값·길이·JWT 내용은 출력하지 않았다.

## 필수 변수

| 변수 | production 존재 | 최소 길이/프로젝트 일치 | 판정 |
|---|---:|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 예 | 값 미조회 | PASS_WITH_UNVERIFIED_VALUE |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 예 | 값 미조회 | PASS_WITH_UNVERIFIED_VALUE |
| `SUPABASE_SERVICE_ROLE_KEY` | 예 | 값 미조회 | PASS_WITH_UNVERIFIED_VALUE |
| `SUPABASE_JWT_SECRET` | **아니오** | 32자 이상 확인 불가 | **FAIL** |
| `MULTI_VILLAGE_ECONOMY_HMAC_SECRET` | **아니오** | 최소 길이 확인 불가 | **FAIL** |
| `DUO_SESSION_HMAC_SECRET` | **아니오** | 32자 이상 확인 불가 | **FAIL** |
| `NEXT_PUBLIC_APP_VERSION` | **아니오** | 승인 artifact 일치 확인 불가 | **FAIL** |
| `NEXT_PUBLIC_AUDIO_BASE_URL` | 예 | 값 미조회 | PASS_WITH_UNVERIFIED_VALUE |

## 모드와 운영 금지 변수

| 변수 | production 존재 | 판정 |
|---|---:|---|
| `SOUNDVILLAGE_ECONOMY_MODE` | **아니오** | **FAIL** — required production/cutover configuration 미구성 |
| `ENABLE_INTERNAL_TEST_ROUTES` | 아니오 | PASS |
| `NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA` | 아니오 | PASS |

추가로 `FREESOUND_API_KEY`가 production에 존재하지만 이번 release gate의 필수 목록은 아니다. 어떤 변수도 추가·수정·삭제하지 않았다.
