# 실험 음원 위치와 교체 절차

작성 기준: 2026-10-28 (Asia/Seoul)

## 현재 저장 위치

- Supabase project ref: `nzzesrjneqsbkgtbaoxy`
- Storage bucket: `audio`
- public base URL:
  `https://nzzesrjneqsbkgtbaoxy.supabase.co/storage/v1/object/public/audio`
- Supabase Dashboard:
  `https://supabase.com/dashboard/project/nzzesrjneqsbkgtbaoxy/storage/buckets`

Dashboard에서 `Storage -> audio`로 들어가면 다음 여섯 폴더가 있어야 한다.

```text
audio/
  Animal/
  Human/
  Nature/
  Urban/
  Music/
  Lab/
```

metadata의 예시는 다음과 같이 실제 URL로 변환된다.

```text
sound_id: Animal_236044
file_path: Audio/Animal/236044

실제 object:
audio/Animal/236044.mp3

public URL:
https://nzzesrjneqsbkgtbaoxy.supabase.co/storage/v1/object/public/audio/Animal/236044.mp3
```

앱은 원격 환경에서 확장자가 없는 `file_path`에 대해 `.mp3`, `.wav` 순서로 시도한다.
운영 표준은 `.mp3`다.

## 교체 전에 먼저 판단할 것

### A. 같은 실험 자극의 기술적 파일 교체

다음과 같은 경우다.

- 동일 음원의 인코딩만 수정
- 음량 정규화
- 손상된 파일 복구
- 무음 구간이나 파일 헤더 문제 수정

실험 자극의 의미가 동일하다면 기존 Zone, 번호, 파일명과 path를 유지할 수 있다.

### B. 다른 소리로 자극 자체를 변경

다음과 같은 경우다.

- 새 녹음으로 교체
- 다른 FSD50K 원본으로 교체
- category나 source가 달라짐
- 참가자가 실제로 듣는 의미 있는 내용이 달라짐

이 경우 기존 object를 같은 ID로 덮어쓰면 안 된다. 기존 참가자와 이후 참가자가 같은
`sound_id` 아래 서로 다른 자극을 듣게 되어 연구 결과를 비교할 수 없게 된다. 새 identity,
metadata, catalog migration, experiment round 또는 분석 제외 정책이 필요하다.

## A안: 같은 path의 파일만 교체하는 절차

1. 기존 파일을 먼저 로컬 backup으로 내려받는다.
2. 새 파일이 실제로 동일 자극인지 연구 책임자에게 확인받는다.
3. 파일 형식은 MP3, MIME은 `audio/mpeg`로 준비한다.
4. Supabase Dashboard에서 project `nzzesrjneqsbkgtbaoxy`를 연다.
5. `Storage -> audio -> <Zone>`으로 이동한다.
6. 기존 `<audio-id>.mp3`와 정확히 같은 이름으로 overwrite한다.
7. 파일 이름과 대소문자를 바꾸지 않는다.
8. public URL을 브라우저에서 직접 열어 재생되는지 확인한다.
9. HTTP status, MIME, byte range, CORS를 확인한다.
10. SoundMimic Village에서 해당 참가자 group과 block으로 들어가 실제 재생을 확인한다.
11. Chrome뿐 아니라 실제 실험에 쓰는 Safari/mobile도 확인한다.
12. 교체일, 담당자, 이유, 이전/새 파일 hash를 별도 변경 기록에 남긴다.

같은 object path를 유지하면 코드, `sound_metadata.json`, DB catalog를 수정할 필요가 없다.
따라서 일반적으로 앱 재배포도 필요 없다.

단, Supabase CDN과 브라우저 cache가 이전 파일을 잠시 유지할 수 있다. 교체 직후 서로 다른
기기에서 새 파일 hash/길이/내용이 확인되지 않으면 실험을 시작하지 않는다.

## B안: 자극 자체를 변경하는 절차

1. 기존 object와 기존 metadata/result row를 삭제하지 않는다.
2. 새 음원에 새 파일 path와 provenance를 부여한다.
3. `data/sound_metadata.json`에서 다음 필드를 함께 검토한다.
   - `sound_id`
   - `file_path`
   - `source_dataset`
   - `original_fname`
   - `game_zone`
   - `sub_category`
   - `source_type`
   - `audioset_class`
   - `group`
   - `block`
4. canonical identity와 기존 alias 관계를 재계산한다.
5. A/B 500개 균형, Zone별 개수, block 배치를 다시 검증한다.
6. 기존 `study_sound_catalog` row를 ordinary sync로 덮어쓰지 않는다.
7. 기존 결과 보존과 새 identity 도입을 위한 forward migration을 작성한다.
8. disposable local Supabase와 승인된 staging에서 migration/catalog sync를 검증한다.
9. 연구 책임자가 기존 round 유지, 새 round, 이전 데이터 제외 중 하나를 승인한다.
10. 새 audio corpus coverage와 브라우저 E2E를 통과한 뒤 production에 적용한다.

`scripts/security/register-study-data.mjs`는 기존 catalog identity가 달라지면 의도적으로
중단된다. 이 오류를 우회하거나 기존 row를 강제로 update하지 말고 controlled migration을
만든다.

## 여러 파일 또는 전체 corpus를 교체할 때

같은 bucket의 object를 하나씩 덮어쓰면 CDN cache와 부분 교체 상태 때문에 참가자마다 다른
버전을 들을 수 있다. 전체 교체는 versioned base를 권장한다.

예:

```text
기존:
.../storage/v1/object/public/audio/Animal/236044.mp3

새 버전:
.../storage/v1/object/public/audio-v2/Animal/236044.mp3
```

절차:

1. 새 public bucket 또는 versioned base에 전체 corpus를 먼저 업로드한다.
2. 기존과 동일한 여섯 Zone 폴더 구조와 파일명을 유지한다.
3. 1,000 metadata row / 995 canonical coverage를 전수 검증한다.
4. Vercel project `new-soundvillage`의 Production 환경변수
   `NEXT_PUBLIC_AUDIO_BASE_URL`을 새 base URL로 변경한다.
5. `NEXT_PUBLIC_*` 값은 build에 포함되므로 production을 재배포한다.
6. 직접 origin 검사와 실제 브라우저 검사를 통과시킨다.
7. 새 배포가 안정화될 때까지 기존 bucket을 삭제하지 않는다.
8. rollback은 환경변수를 이전 base로 되돌리고 다시 배포하는 방식으로 준비한다.

## 확인 명령

특정 파일의 header 확인 예시:

```bash
curl -I \
  https://nzzesrjneqsbkgtbaoxy.supabase.co/storage/v1/object/public/audio/Animal/236044.mp3
```

정상 기대값:

- HTTP 200 또는 Range 요청 시 206
- `Content-Type: audio/mpeg` 또는 올바른 audio MIME
- 0보다 큰 `Content-Length`
- 외부 앱 origin에서 허용되는 CORS

대표 Zone/그룹과 실제 브라우저 재생 검사:

```bash
npm run test:audio-direct-origin
```

이 검사는 `.env.local`의 `NEXT_PUBLIC_AUDIO_BASE_URL`을 사용하므로 production과 같은 base를
가리키는지 먼저 확인한다. 검사가 일부 대표 음원만 확인하는지 전체 corpus를 확인하는지
스크립트 결과 범위를 함께 기록한다.

## 금지 사항

- 새 자극을 기존 `sound_id`로 조용히 덮어쓰기
- 기존 annotation/vote를 삭제해서 새 자극과 맞추기
- 파일 번호가 같다는 이유로 다른 Zone 파일을 대신 사용
- 오디오를 Git에 대량 커밋
- `SUPABASE_SERVICE_ROLE_KEY`를 브라우저나 문서에 노출
- 일부 파일만 교체된 상태로 실제 참가자 실험 시작
- cache 확인 없이 업로드 성공만으로 교체 완료 처리

