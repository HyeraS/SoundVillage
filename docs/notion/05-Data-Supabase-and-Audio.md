# 데이터, Supabase, 오디오 계약

## 환경 변수

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 anon key |

두 값은 `NEXT_PUBLIC_` 접두사 때문에 클라이언트 번들에서 사용 가능하다. 보안은 반드시 Supabase RLS 정책으로 보장해야 한다.

## `annotations` 테이블 계약

코드가 삽입하거나 조회하는 컬럼:

| 컬럼 | 예상 타입 | 설명 |
|---|---|---|
| `id` | UUID 또는 정수 PK | 후보 표현과 투표 대상 식별 |
| `participant_id` | text | 참여자 입력값 |
| `session_id` | text | 세션 입력값 |
| `sound_id` | text | 사운드 고유 ID |
| `zone` | text | Zone 이름 |
| `sub_category` | text | 선택적 하위 범주 |
| `expression_text` | text | Stage 1 자유 표현 |
| `selected_features` | array/json | 현재 UI에서는 항상 기본 빈 배열 |
| `confidence` | number | 기본 3, UI는 1/3/5 |
| `difficulty` | number | 현재 UI 입력 없이 기본 3 |
| `play_count` | number | Stage 1 재생 시작 횟수 |
| `listening_time_sec` | number | Stage 1 실제 재생 누적 초 |
| `is_skipped` | boolean | 건너뛰기 여부 |
| `skip_reason` | text | 현재 `user_skip` 사용 |
| `device_info` | text | 브라우저 user agent |
| `stage` | number | 현재 annotation은 1 |
| `is_verified` | boolean | 현재 기본 false |
| `vote_count` | number | 누적 공감 수 |
| `version` | text | 기본 `v0.4-web` |

## `votes` 테이블 계약

선택한 각 후보마다 한 행을 삽입한다.

| 컬럼 | 예상 타입 | 설명 |
|---|---|---|
| `participant_id` | text | 투표 참여자 |
| `session_id` | text | 투표 세션 |
| `sound_id` | text | 대상 소리 |
| `zone` | text | 대상 Zone |
| `annotation_id` | annotations PK 타입 | 투표 대상 표현 |
| `play_count` | number | Stage 2 재생 횟수 |
| `listening_time_sec` | number | Stage 2 청취 시간 |
| `stage` | number | 기본 2 |
| `version` | text | 기본 `v0.4-web` |
| `created_at` | timestamp | 브라우저가 생성한 ISO 문자열 |

## 필요한 RPC

```text
increment_vote_count(annotation_id)
```

`saveVote`는 투표 행들을 삽입한 뒤 선택된 annotation마다 RPC를 순차 호출한다. RPC의 실제 SQL 정의와 권한 정책은 저장소에 없다.

## 조회 규칙

후보 표현:

- 동일한 `sound_id`
- `is_skipped=false`
- `stage=1`
- 빈 표현 제외
- 자신의 표현과 문자열이 같은 표현 제외
- `vote_count` 내림차순
- 최대 6개

집계:

- 전체 수: `annotations` 중 `is_skipped=false`
- Zone 수: 해당 Zone이면서 `is_skipped=false`
- 월드맵 진행도: `min(zone count / 10, 1)`

## 사운드 메타데이터 계약

필수에 가까운 속성:

```json
{
  "sound_id": "Forest_001",
  "zone": "Forest",
  "file_path": "Audio/Forest/forest_bird_01",
  "source_dataset": "FSD50K",
  "original_fname": "64760",
  "sub_category": "optional"
}
```

`zone`은 정확히 `Forest`, `Water`, `City`, `Music`, `Mystery` 중 하나여야 Zone에 배치된다.

## 오디오 경로 해석

`audioManager`는 다음 입력을 지원한다.

| 메타데이터 값 | 시도할 경로 |
|---|---|
| `Audio/Forest/bird` | `/audio/Forest/bird.wav`, `.mp3`, `.ogg` |
| `audio/Forest/bird` | `/audio/Forest/bird.wav`, `.mp3`, `.ogg` |
| `Forest/bird` | `/audio/Forest/bird.wav`, `.mp3`, `.ogg` |
| `/audio/Forest/bird` | 확장자 후보 추가 |
| `/audio/Forest/bird.wav` | 그대로 사용 |

따라서 실제 파일은 `public/audio/<Zone>/<name>.<ext>`에 있어야 한다.

## 청취 시간과 재생 횟수

- 앱 전체에서 한 번에 하나의 Howl만 유지한다.
- 새 소리를 재생하면 이전 소리를 정리한다.
- `play_count`는 재생 버튼으로 재생을 시작할 때 증가한다.
- `listening_time_sec`는 재생 시작부터 stop/end/pause까지 누적한다.
- Stage 1 성공 제출 후 청취 시간을 초기화한다.
- Stage 2는 선택된 투표가 있을 때만 청취 시간을 초기화한다.

## 데이터 무결성 주의점

- 참여자 ID와 세션 ID의 형식/중복을 검증하지 않는다.
- 동일 참여자가 같은 표현에 반복 투표하는 것을 클라이언트에서 막지 않는다.
- 투표 행 삽입과 `vote_count` 증가는 단일 트랜잭션이 아니다.
- RPC 실패를 검사하지 않아 `votes`와 `vote_count`가 불일치할 수 있다.
- 스킵 저장 실패와 Stage 2 저장 실패가 사용자에게 명확히 표시되지 않는다.
- RLS와 DB 제약 조건이 저장소에 없어 실제 보안/무결성을 코드만으로 확인할 수 없다.

