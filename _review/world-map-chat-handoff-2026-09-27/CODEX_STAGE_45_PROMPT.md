# Codex 프롬프트 — Home release 45개 staging

다음 프롬프트는 사용자가 **staging을 명시적으로 승인할 때만** Codex에 전달한다. commit, push, deploy 권한은 포함하지 않는다.

```text
SoundVillage 월드맵 v4 Home native layered object release 후보를 정확한 allowlist만 staging해줘.

이번 작업은 Step 10.1: “격리된 45개 release 파일 staging 및 cached diff 감사”다. 구현 수정, commit, push, PR, deploy는 하지 않는다.

## 작업 위치와 기준선

- 반드시 다음 격리 worktree에서만 작업:
  `/private/tmp/soundvillage-home-step10.rUSop0`
- 기대 branch: `codex/world-map-home-native`
- 기대 HEAD: `8e6567f896dfde6781dd0f641db197a4255d111f`
- 원본 dirty checkout:
  `/Users/hyera/Documents/SoundVillage-house-decor-2d`
  이 경로의 파일은 수정·정리·stage하지 않는다.

먼저 다음 문서를 끝까지 읽어라.

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-home-release-step10/ISOLATION_RESULT.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-home-release-step10/FINAL_CODE_REVIEW.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-home-release-step10/COMMIT_PLAN.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/_review/world-map-home-release-step10/RELEASE_FILE_LIST.md`

## 사전 조건

1. branch와 HEAD가 기대값과 정확히 일치해야 한다.
2. staged 파일은 0이어야 한다.
3. working tree의 변경/untracked 경로가 COMMIT_PLAN의 allowlist와 정확히 같은 45개여야 한다.
4. `_review/`, `.next/`, `node_modules/`, `tmp/`, `.codex/`, Candidate B, attachment가 후보에 있으면 즉시 중단한다.
5. 원본 dirty checkout은 변경하지 않는다.

사전 조건이 하나라도 어긋나면 staging하지 말고 실제 상태와 차이를 보고하고 멈춰라.

## staging

- `git add .`, `git add -A`, 광범위한 디렉터리 add를 사용하지 않는다.
- COMMIT_PLAN에 적힌 정확한 45개 경로를 `git add -- <explicit paths>`로만 staging한다.
- 파일 내용을 수정하거나 생성물을 재생성하지 않는다.

## staging 후 검증

- `git diff --cached --name-only`가 정확히 45개인지 확인
- cached 경로 집합이 allowlist와 순서 무관 완전 일치하는지 확인
- unstaged tracked/untracked release 변경이 0인지 확인
- 금지 경로 prefix가 cached diff에 0개인지 확인
- `git diff --cached --check` PASS
- `git diff --cached --stat` 기록
- 두 opt-in report 수정 파일이 cached diff에 포함됐는지 확인:
  - `scripts/test-world-map-hd-collision.mjs`
  - `scripts/test-world-map-production-integration.mjs`

## 산출물과 보고

이번 단계에서는 `_review` 파일을 새로 쓰지 않는다. 최종 응답에 다음을 보고한다.

- worktree, branch, HEAD
- staged 경로 수
- allowlist missing/extra 수
- unstaged/untracked 수
- 금지 경로 수
- cached diff check 결과와 stat
- commit/push/deploy를 하지 않았다는 확인

검증이 모두 PASS해도 commit하지 말고 staging 상태로 멈춰라.
```
