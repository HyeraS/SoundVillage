# Stage 6A-R — Supabase Dashboard Gates

- 점검 시각: 2026-10-05 19:13:51 KST
- 대상 Supabase ref: `ogjcqtfoabuxkgkpqsil`
- 게이트 판정: **BLOCKED**
- 전체 Stage 6A-R 판정: **NO_GO**

인증된 프로젝트의 General Settings 진입과 identity는 확인했지만, 아래 control-state를 감사 가능한 형태로 읽어 확정하지 못했다. 프로젝트 status는 별도 CLI 조회에서 `INACTIVE`였다. 어떤 Dashboard 토글·설정도 변경하지 않았다.

| 확인 항목 | 결과 | 판정 |
|---|---|---|
| Anonymous Auth 활성화 | 미확인 | BLOCKED |
| Realtime public access 비활성화 | 미확인 | BLOCKED |
| `duo_realtime_read` private policy | ledger/DB 접근 전 미확인 | BLOCKED |
| `duo_realtime_send` private policy | ledger/DB 접근 전 미확인 | BLOCKED |
| participant/economy/attendance/Character/Interior/Duo/study/user-event RLS | 미확인 | BLOCKED |
| anon 직접 mutation 권한 없음 | 미확인 | BLOCKED |
| authenticated own-read 및 승인 client RPC 제한 | 미확인 | BLOCKED |
| admin/snapshot RPC service-role 전용 | 미확인 | BLOCKED |
| 운영 JWT와 Vercel project 일치 | secret 값을 조회하지 않아 미확인 | BLOCKED |
| 내부 QA/test route 운영 비활성화 | Vercel env 이름 기준 금지 플래그 2개 부재 | PASS |

설정값, secret, JWT, key, 사용자/participant/auth 식별자는 기록하지 않았다. Dashboard 미확인 항목은 해소가 필요하지만, 이미 Supabase inactive·백업 부재·필수 환경변수 부재가 확인되어 전체 판정은 `NO_GO`다.
