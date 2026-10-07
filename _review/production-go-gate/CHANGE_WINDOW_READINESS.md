# Stage 6A-R — Change Window Readiness

- 점검 시각: 2026-10-05 19:13:51 KST
- 승인 방식: `owner_direct_approval`
- 환경: `production`
- 승인 RC SHA: `776a84b349068d73df77db9be820b3d468e1aa92`
- 최종 판정: **NO_GO**
- 주 중단 코드: `PRODUCTION_RECOVERY_AND_ENV_GATES_FAILED`

운영 대상 identity는 승인 입력과 일치했지만 변경 창의 필수 복구·환경 게이트가 실제로 실패했다. 권한 부족만으로 남은 항목이 있는 `BLOCKED`가 아니라, 현재 관측 상태로 변경 창을 열면 안 되는 `NO_GO`다.

## 게이트 요약

| 게이트 | 판정 | 근거 |
|---|---|---|
| 승인 대상 identity | PASS | Supabase ref `ogjcqtfoabuxkgkpqsil`, 이름 `new_soundvillage`, region `ap-northeast-1`; Vercel project `new-soundvillage` / ID 일치 |
| 승인 SHA와 로컬 후보 | PASS_WITH_CAVEAT | HEAD가 승인 SHA와 일치하고 migration 14개 해시 통과. 다만 worktree는 dirty이므로 미커밋 변경을 승인 artifact로 취급하지 않음 |
| Supabase 운영 상태 | **FAIL** | 프로젝트 status가 `INACTIVE` |
| Migration ledger | BLOCKED | direct DB 조회가 IPv6 제약으로 실패했고 저장소에는 linked metadata가 없음. 링크 생성·비밀번호 요청 없이 중단 |
| Vercel 운영 도메인 | PASS | production alias `new-soundvillage.vercel.app`, deployment READY |
| 현재 production artifact | OBSERVED | 현재 배포 SHA `8e6567f896dfde6781dd0f641db197a4255d111f`; 승인 RC는 아직 production에 배포되지 않음 |
| Dashboard / RLS / ACL | BLOCKED | auditable control-state 증거를 확보하지 못함. 설정 변경은 수행하지 않음 |
| Backup / PITR | **FAIL** | `pitr_enabled=false`, 사용 가능한 backup 0건, restore point 확인 불가 |
| 운영 환경변수 | **FAIL** | 필수 5개 부재; 기존 값은 내려받거나 출력하지 않음 |
| 현재 schema read-only preflight | BLOCKED | ledger와 014 적용 여부 미확인으로 SQL 미실행 |

## NO_GO 해제 전 필수 조건

1. 승인된 운영 절차로 Supabase 프로젝트를 정상 운영 상태로 복구하고 status가 healthy임을 다시 확인한다.
2. PITR 또는 검증된 자동 백업과 실제 복구 가능한 restore point를 마련하고 보존 기간·최근 성공 시각·복구 담당자·승인 절차를 기록한다.
3. Vercel production에 누락된 필수 변수 5개를 별도 승인 절차로 구성한다. 이 Stage 6A-R에서는 값을 생성하거나 변경하지 않는다.
4. approved target에 대한 안전한 IPv4/read-only DB 경로 또는 사전 승인된 linked metadata를 제공해 migration ledger를 재조회한다.
5. Dashboard의 Anonymous Auth, Realtime public access, private policies, 전 테이블 RLS, ACL/RPC grants를 read-only 증거로 확인한다.
6. ledger에 014가 적용됐을 때만 `ON_ERROR_STOP=1` 및 read-only transaction으로 최종 production preflight를 실행한다. 014가 미적용이면 `POST_MIGRATION_PREFLIGHT_PENDING`으로 유지한다.
7. 위 항목을 모두 통과한 뒤 Stage 6A-R을 현재 실패 지점부터 다시 판정한다. 별도 변경 창 승인 전에는 migration·배포·maintenance/cutover 전환을 수행하지 않는다.

## 이번 실행에서 하지 않은 작업

Migration 적용/repair, Supabase link 생성, 운영 SQL, 데이터 변경, Dashboard 설정 변경, 환경변수 변경, 배포/재배포, maintenance/cutover 전환, 백업 생성/복원, Duo session 종료, 비밀값 출력, dirty worktree reset/stash/checkout/clean을 수행하지 않았다.
