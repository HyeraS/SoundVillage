# 개발, 실행, 배포 가이드

## 전제 조건

- Node.js: Next.js 16을 지원하는 버전
- npm
- Supabase 프로젝트
- `annotations`, `votes` 테이블 및 `increment_vote_count` RPC
- `public/audio/` 아래 실제 사운드 파일

## 로컬 실행

```bash
cd soundmimic-village
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다.

## 환경 설정

`.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`.env.local`은 Git에서 제외된다. anon key만 사용하고 service-role key는 절대 브라우저 환경 변수에 넣지 않는다.

## 스크립트

| 명령 | 역할 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint 검사 |

## 새 사운드 추가 절차

1. 파일을 `public/audio/<Zone>/`에 추가한다.
2. `data/sound_metadata.json`의 `sounds` 배열에 항목을 추가한다.
3. `sound_id`가 고유한지 확인한다.
4. `zone` 철자가 다섯 Zone 중 하나와 정확히 일치하는지 확인한다.
5. 앱에서 해당 Zone에 진입해 아이템 생성, 재생, 저장을 확인한다.
6. Supabase에서 annotation 행과 오디오 지표를 검증한다.

ZoneMap은 Zone당 앞의 8개 사운드만 표시한다.

## 검증 체크리스트

- 참여자/세션 ID 없이는 시작할 수 없는가
- 월드맵에서 모든 포털에 진입 가능한가
- 키보드와 D-Pad 이동이 동작하는가
- 각 메타데이터 사운드가 재생되는가
- Stage 1 제출이 `annotations`에 저장되는가
- 스킵이 `is_skipped=true`로 저장되는가
- Stage 2 후보가 올바르게 필터링되는가
- 투표 후 `votes`와 `vote_count`가 모두 갱신되는가
- 전체/Zone 집계가 화면에 반영되는가
- 새로고침 시 메모리 상태 초기화가 의도된 것인가

## 2026-06-05 검증 결과

| 검사 | 결과 |
|---|---|
| `npm run build` | 성공 |
| 정적 라우트 | `/`, `/_not-found` |
| `npm run lint` | 실패, 오류 10건 |
| 자동 테스트 | 구성 없음 |
| 실제 오디오 파일 | 저장소에 없음 |

빌드는 제한된 샌드박스에서는 Turbopack의 포트 바인딩 제한으로 실패했지만, 일반 권한 환경에서는 성공했다.

## 배포

Next.js 앱이므로 Vercel 배포가 가장 직접적이다.

배포 전 필수 작업:

- 배포 환경에 Supabase 환경 변수 등록
- Supabase RLS 및 RPC 권한 검토
- `public/audio` 파일 또는 별도 오디오 CDN 준비
- 브라우저에서 Google Fonts 접근 가능 여부 확인
- 프로덕션 Supabase에 테스트 데이터가 섞이지 않도록 환경 분리

## 운영 관찰 항목

- Supabase insert/RPC 오류율
- 오디오 404 및 재생 오류
- 스킵률
- 참여자/세션 ID 중복
- 특정 Zone 또는 사운드의 데이터 편중
- `votes` 행 수와 annotation `vote_count` 합계 불일치

