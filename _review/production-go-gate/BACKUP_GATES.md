# Stage 6A-R — Backup and PITR Gates

- 점검 시각: 2026-10-05 19:13:51 KST
- 대상 Supabase ref: `ogjcqtfoabuxkgkpqsil`
- 게이트 판정: **NO_GO**
- 차단 코드: `NO_RECOVERABLE_BACKUP_OR_PITR`

`supabase backups list --project-ref ogjcqtfoabuxkgkpqsil --output-format json`으로 read-only 조회했다.

| 확인 항목 | 관측 결과 | 판정 |
|---|---|---|
| region | `ap-northeast-1` | PASS |
| WAL-G 상태 | enabled | 관측값 |
| PITR | **disabled** | **FAIL** |
| 사용 가능한 physical backup | **0건** | **FAIL** |
| 보존 기간 | 확인 가능한 backup/PITR 없음 | **FAIL** |
| 최근 성공 시각 | 없음 | **FAIL** |
| 복구 가능한 restore point | 확인 불가 | **FAIL** |
| 조직 복구 담당자 / 승인 절차 | 증거 없음 | BLOCKED |

백업 생성, restore point 생성, 복원, 설정 변경은 수행하지 않았다. 현재 복구 가능한 지점을 증명할 수 없으므로 변경 창을 열 수 없다.
