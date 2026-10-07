# Stage 6A-R — Target and Migration Ledger

- 점검 시각: 2026-10-05 19:13:51 KST
- 게이트 판정: **NO_GO**
- 승인 방식: `owner_direct_approval`

## 대상 프로젝트 식별

| 확인 항목 | 관측 결과 | 판정 |
|---|---|---|
| Supabase CLI | `2.117.0` | PASS |
| 승인 Supabase ref | `ogjcqtfoabuxkgkpqsil` | 기준값 |
| 인증 조회 ref | `ogjcqtfoabuxkgkpqsil` | PASS |
| 인증 조회 name | `new_soundvillage` | PASS |
| 인증 조회 region | `ap-northeast-1` | PASS |
| 인증 조회 status | `INACTIVE` | **FAIL** |
| 로컬 Supabase linked metadata | 없음 | BLOCKED — 새 link를 만들지 않음 |
| 로컬 Vercel project | `new-soundvillage`, `prj_fqp7vxAMsl52RSDHL3fRrTzKAPW4` | PASS |
| 원격 Vercel project | 동일 name/ID, owner `Hyera's projects` | PASS |
| 운영 alias | `new-soundvillage.vercel.app` | PASS |
| 현재 production deployment | READY, `dpl_FR9qzdZHhnZH1xr2jqjTGTwHsiNk` | PASS |
| 현재 배포 commit | `8e6567f896dfde6781dd0f641db197a4255d111f` | 관측값 |
| 승인 RC SHA | `776a84b349068d73df77db9be820b3d468e1aa92` | 기준값 |
| 현재 로컬 HEAD | 승인 RC SHA와 정확히 일치 | PASS |

현재 production 배포가 승인 RC와 다른 것은 관측 사실로 기록했다. 배포는 이번 read-only 단계의 허용 범위가 아니므로 이를 맞추기 위한 배포/재배포는 수행하지 않았다.

## Migration ledger

실행한 읽기 전용 명령:

```text
supabase migration list --project-ref ogjcqtfoabuxkgkpqsil
```

결과는 `IPv6 is not supported on your current network`로 실패했고 CLI는 local link를 제안했다. 저장소에 Supabase linked metadata가 없는 상태에서 `supabase link`를 새로 실행하면 로컬 연결 상태를 변경하므로 수행하지 않았다. DB password나 access token도 요청하거나 출력하지 않았다.

- 원격 적용/pending/remote-only/unknown 목록: **미확인 (BLOCKED)**
- 014 적용 여부: **미확인 (BLOCKED)**
- 로컬 immutable migration 001–014: **14개 존재, SHA-256 전부 일치 (PASS)**
- `git diff --check`: **PASS**
- worktree: **dirty** — 기존 사용자 변경을 그대로 보존

Supabase status `INACTIVE`가 별도 hard fail이므로 전체 판정은 `NO_GO`다. ledger 미확인은 이 판정을 완화하지 않는다.
