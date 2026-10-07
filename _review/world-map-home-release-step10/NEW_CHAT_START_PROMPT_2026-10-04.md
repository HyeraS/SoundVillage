# SoundVillage World Home Release 새 채팅 시작 프롬프트

아래 프롬프트를 새 Codex 채팅의 첫 메시지로 붙여 넣고, 같은 메시지에 `HANDOFF_2026-10-04.md`를 첨부한다.

```text
너는 SoundVillage 프로젝트의 시니어 게임 클라이언트·풀스택 개발자이자 release 검증 담당자다.

작업 경로:
/Users/hyera/Documents/SoundVillage-house-decor-2d

첨부한 `HANDOFF_2026-10-04.md`를 먼저 처음부터 끝까지 읽어라. 그 다음 저장소의 다음 문서를 직접 읽고 현재 Git 상태와 대조해라.

- `_review/world-map-home-release-step10/COMMIT_PLAN.md`
- `_review/world-map-home-release-step10/FINAL_CODE_REVIEW.md`
- `_review/world-map-home-release-step9/FINAL_HANDOFF.md`
- `_review/world-map-home-release-step9/final-hashes.json`
- `_review/world-map-chat-handoff-2026-09-27/HANDOFF.md`
- `AGENTS.md`

현재 예상 상태:
- branch: `codex/economy-v1-checkpoint`
- HEAD: `7a26007b5ebe294bddf58c4e00e861a492fad32b`
- staged path: World Home allowlist 정확히 45개
- staged tree: `cc4d5824ef759ec9535718981eafb405aded94ed`
- commit/push/PR/deploy: 없음

첫 행동은 구현이 아니라 상태 검증이다.

1. branch, HEAD, index, staged path 수, staged tree를 확인해라.
2. staged 45개가 `COMMIT_PLAN.md`의 allowlist와 정확히 일치하는지 비교해라.
3. `_review`, `assets/Character v.2`, attendance, Character, Economy, Interior, Duo, Nature 파일이 staged되지 않았는지 확인해라.
4. 값이 다르면 커밋하지 말고 차이를 보고해라.

현재 유일한 blocker는 exact snapshot에 `.gitignore` 대상인 `assets/Character v.2/` source master가 없어 Character Stage 3 테스트 2건이 실패한 것이다. 제품 코드나 World Home 후보 문제로 단정하지 마라.

테스트를 skip하거나 validator/baseline을 약화하지 말고 다음 방식으로 해결해라.

- HEAD+staged 45개만 포함하는 격리 snapshot 생성
- 원본 checkout의 `assets/Character v.2/` 전체에 대한 정렬된 SHA-256 manifest 생성
- source 폴더를 snapshot의 동일 상대 경로로 복사
- 복사본 manifest 일치 확인
- 복사본을 read-only로 설정
- Character asset validator, builder 결정성, Stage 3 테스트를 skip 없이 실행
- 테스트 후 원본과 복사본 manifest가 모두 불변인지 확인
- 전체 World 및 release 회귀를 exact snapshot에서 최종 실행
- staged tree와 allowlist가 전후 동일한지 확인

정확한 snapshot 정의는 다음과 같다.

`HEAD + staged 45개 제품 트리 + Git에서 의도적으로 제외된 해시 검증·읽기 전용 Character V2 source master 입력`

다음을 절대 하지 마라.

- source master 또는 ignored assets commit
- 테스트 skip, 조건부 성공, assertion/hash 약화
- 45개 밖의 파일 stage
- `git add .` 또는 `git add -A`
- reset, checkout, restore, stash, clean
- attendance 또는 Duo Stage 4/Character onboarding WIP 수정
- 원격 Git/Supabase 접근
- push, PR, deploy

모든 필수 검증이 통과하고 staged 45개와 tree hash가 그대로인 경우에만 다음 메시지로 local commit해라.

`feat(world-map): promote Home to a native layered object`

커밋 후 parent, 45개 파일, 빈 index, 남은 WIP 보존 상태를 확인해라. 하나라도 실패하면 커밋하지 말고 PARTIAL로 보고해라.

최종 보고에는 다음을 포함해라.

1. COMPLETE/PARTIAL
2. branch/HEAD/staged tree 확인
3. 45개 allowlist 대조
4. Character 실패 원인과 외부 source 공급 방식
5. source 파일 수와 작업 전후 hash manifest
6. Character 테스트 결과와 skip 수
7. World/전체 회귀/production build 결과
8. 승인된 World 핵심 해시 8개
9. staged tree 전후 비교
10. 커밋 해시와 파일 수
11. 제외·보존한 WIP
12. 원격 미접속과 cleanup 결과
```
