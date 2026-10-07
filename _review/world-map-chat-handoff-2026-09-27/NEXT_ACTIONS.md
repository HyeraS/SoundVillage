# 다음 행동과 승인 경계

## 즉시 진행 순서

### A. Home release checkpoint

1. 격리 worktree 상태 재확인
2. 정확한 45개 파일만 staging
3. cached diff와 금지 경로 0건 검토
4. 사용자에게 결과 보고 후 중단
5. 별도 승인 후 local commit
6. commit 결과 검토 후 별도 승인 전에는 push/PR/deploy 금지

staging용 준비 프롬프트는 `CODEX_STAGE_45_PROMPT.md`에 있다.

### B. 전체 월드맵 화질 트랙

Home 변경을 local commit으로 checkpoint한 다음 Step 11을 시작한다. 화질 조사와 Home release를 같은 commit/diff에 섞지 않는다.

1. Step 11: 품질 기준선·열화 원인 감사 — read-only
2. Step 12: 1×/1.5× 선택 정책과 성능 예산
3. Step 13: 중앙 정원 제한 pilot
4. Step 14: responsive asset pipeline
5. Step 15: 중앙 정원 baked 환경의 의미 단위 분해
6. Step 16: 나머지 16개 legacy 오브젝트의 batch migration
7. Step 17: 전체 회귀와 rollback rehearsal
8. Step 18: 배포·관찰 후 legacy 제거

Step 11용 준비 프롬프트는 `CODEX_STEP11_QUALITY_AUDIT_PROMPT.md`에 있다.

## 사용자가 승인해야 하는 지점

| 행동 | 현재 승인 상태 | 비고 |
| --- | --- | --- |
| 격리 worktree 유지 | 승인됨 | 삭제 금지 |
| 45개 staging | 미승인 | 다음 권장 행동 |
| local commit | 미승인 | staging 검토 후 별도 승인 |
| push/PR | 미승인 | 원격 변경 |
| deploy | 미승인 | 출시 변경 |
| Step 11 read-only 감사 | 아직 미실행 | Home checkpoint 후 권장 |
| Step 12 이후 production 변경 | 미승인 | 각 단계 별도 승인 |

## 매 단계 결과를 새 ChatGPT에 전달하는 형식

Codex 완료 메시지를 요약하거나 고치지 말고 그대로 새 ChatGPT 채팅에 붙여 넣는다. 가능하면 다음도 함께 제공한다.

- 실행한 worktree 절대 경로
- branch와 HEAD
- `git status --short --branch`
- 변경 파일 수와 목록 또는 manifest 경로
- PASS/FAIL 테스트와 실행 명령
- 생성된 `_review` 문서 경로
- 열린 문제와 의도적으로 하지 않은 작업

새 ChatGPT는 이 결과를 검토한 다음에만 다음 Codex 프롬프트를 작성해야 한다.
