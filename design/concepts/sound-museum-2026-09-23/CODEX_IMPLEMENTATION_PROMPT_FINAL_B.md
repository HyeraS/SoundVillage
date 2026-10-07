# Codex implementation prompt — Sound Museum Final B

아래 작업을 **계획이나 목업에서 멈추지 말고 실제 프로젝트 구현·연결·검증까지 완료**해 주세요.

---

## 역할과 목표

당신은 숙련된 2D 픽셀 게임 아트 디렉터이자 Next.js 게임 엔지니어입니다.

현재 SoundVillage의 Sound Museum을 아래 최종 시안과 동일한 분위기·구조로 완전히 교체하세요.

- 최종 기준 이미지: `design/concepts/sound-museum-2026-09-23/05-final-b-l-shaped-listening-lounge.png`
- 원본 구조 참고: `design/concepts/sound-museum-2026-09-23/01-central-listening-hall.png`
- 청취 공간 참고: `design/concepts/sound-museum-2026-09-23/03-lantern-archive-shop.png`
- 프로젝트 맥락: `Cozy Christmas Market Map Design/uploads/PROJECT_SUMMARY.md`
- 시안 설명: `design/concepts/sound-museum-2026-09-23/FINAL_HYBRID_VARIANTS.md`

최종 결과는 정적인 배경 이미지가 아니라 다음 조건을 만족하는 **실제로 걸어 다니고 상호작용하는 Sound Museum**이어야 합니다.

1. 시안에 보이는 모든 건축·가구·소품을 실제 런타임 에셋으로 제작하고 배치합니다.
2. 플레이어가 입구에서 스폰되어 왼쪽 청취/투표 공간, 중앙 부엉이 전시 안내, 오른쪽 상점까지 직접 걸어갈 수 있어야 합니다.
3. 기존 Sound Museum의 투표·전시 현황·상점·재화·분석 이벤트·종료 흐름을 모두 보존합니다.
4. 어떤 지원 화면 크기에서도 에셋이 흐려지거나 깨지거나 비정상적으로 늘어나면 안 됩니다.
5. 최종 시안의 밝은 크림·허니오크·청록 팔레트, 중앙 부엉이, ㄱ자 청취 라운지, 우측 상점, 하단 입구의 구도를 유지합니다.

## 작업 시작 전에 반드시 할 일

1. 루트 `AGENTS.md`와 현재 워킹 트리 상태를 확인하고 사용자의 기존 변경을 보존합니다.
2. 이 저장소는 Next.js `16.2.7`이므로 코드를 쓰기 전에 최소한 다음 로컬 문서를 읽고 현재 API를 따릅니다.
   - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
   - `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
   - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`
3. 다음 구현을 완전히 읽고 현재 기능과 이벤트 계약을 파악합니다.
   - `components/LibraryRoom.js`
   - `components/SoundMuseum.js`
   - `components/AssetRegistry.js`
   - `components/GameEngine.js`
   - `app/page.js`
   - `app/library-test/page.js`
   - `lib/userEvents.js`
   - `lib/shopCatalog.js`
   - `scripts/stage-6-lifecycle.test.mjs`
   - `scripts/security/experiment-rules.test.mjs`
4. 최종 시안을 원본 해상도로 검사하고 주요 오브젝트의 픽셀 좌표·크기·겹침 순서를 측정합니다. 눈대중으로 배치하지 말고 측정값을 별도 레이아웃 모듈에 기록합니다.

## 이미지 제작 도구

`$imagegen` 스킬을 사용하세요. 스킬의 `SKILL.md`를 전부 읽고 지침을 따르세요.

- 최종 시안은 **편집 대상이 아니라 전체 아트 디렉션과 배치 기준**입니다.
- 새로 제작하는 각 에셋은 최종 시안을 스타일 레퍼런스로 사용합니다.
- 서로 다른 에셋은 각각 별도의 ImageGen 호출로 제작합니다. 하나의 거대한 이미지에서 억지로 잘라 쓰지 마세요.
- 시안에서 완전히 보이고 가장자리가 가려지지 않은 작은 소품은 품질 손실 없이 추출 가능한 경우에만 원본 픽셀을 보존해 사용할 수 있습니다.
- 시안에서 일부가 가려졌거나 다른 물체와 그림자가 합쳐진 오브젝트는 반드시 투명 배경의 완전한 단일 에셋으로 새로 제작합니다.
- 생성 결과를 반드시 원본 크기로 검사하고, 스타일·광원 방향·윤곽선 굵기·픽셀 밀도가 맞지 않으면 한 항목씩 수정합니다.
- 런타임에 사용하는 최종 에셋은 `$CODEX_HOME` 아래에 남겨두지 말고 모두 프로젝트의 `public/assets/sound-museum-final-b/` 아래에 저장합니다.

## 절대 금지되는 품질 저하 방식

- `05-final-b-l-shaped-listening-lounge.png` 한 장을 전체 배경으로 깔고 투명 핫스팟만 얹는 방식
- 1672×941 시안을 작은 해상도로 축소한 뒤 다시 확대하는 방식
- JPEG 사용
- 브라우저가 자동 최적화·재압축한 이미지를 원본 에셋처럼 사용하는 방식
- CSS 도형이나 이모지로 시안의 핵심 가구·부엉이·헤드폰·상점을 대체하는 방식
- 임시 사각형·단색 박스·텍스트 라벨을 최종 그래픽으로 남기는 방식
- `transform: scale(...)`만 적용하고 이미지 스무딩·DPR·물리 좌표를 검증하지 않는 방식
- 충돌 박스와 보이는 가구 위치가 어긋난 상태
- 기존 투표나 구매 로직을 시각 구현 편의를 위해 단순화하는 방식

## 해상도와 렌더링 규격

### 고정 논리 좌표계

- 최종 시안과 동일하게 `MUSEUM_WORLD_WIDTH = 1672`, `MUSEUM_WORLD_HEIGHT = 941`을 기준 논리 좌표계로 사용합니다.
- 모든 에셋 배치, 플레이어 위치, 충돌 박스, 상호작용 존, 카메라/스테이지 계산은 이 좌표계 하나를 공유해야 합니다.
- 기존처럼 화면 크기에 대한 서로 다른 임의의 분수와 실제 에셋 픽셀을 섞지 마세요.
- 창 크기에 맞출 때는 contain 방식으로 전체 방을 보이게 하고 중앙 정렬합니다. 남는 영역은 시안과 어울리는 어두운 우드/크림 레터박스로 처리합니다.

### 마스터와 런타임 에셋

- 모든 원본 마스터는 런타임 표시 크기의 최소 2배, 가능하면 4배로 제작합니다.
- 투명 오브젝트는 lossless RGBA PNG로 저장합니다.
- 반복 가능한 바닥·벽 패턴은 이음새가 없는 타일 에셋으로 만듭니다.
- 런타임 메타데이터에 원본 픽셀 크기와 논리 표시 크기를 모두 기록합니다.
- Next/Image를 사용할 경우 `unoptimized`를 명시해 재압축을 막고, 장식 레이어에는 `image-rendering: pixelated` 또는 검증된 동등 설정을 적용합니다.
- 플레이어와 에셋 위치는 렌더 단계에서 물리 픽셀에 스냅합니다. DPR 1/2 환경에서 반 픽셀 경계가 생기지 않게 합니다.
- 캔버스를 선택하면 `ctx.imageSmoothingEnabled = false`를 모든 리사이즈·드로우 경로에서 재적용합니다.
- DOM 레이어를 선택하면 동일한 `stageScale`, `stageOffset`, 좌표 변환 함수를 시각·충돌·포인터 입력이 함께 사용해야 합니다.
- 에셋 로드 전후 레이아웃이 튀지 않도록 manifest의 논리 크기로 공간을 선점합니다.

화질 보장은 코드 주석이 아니라 아래 다중 뷰포트 스크린샷과 원본 픽셀 검사로 입증하세요.

## 에셋 폴더와 manifest

다음 구조를 기본으로 사용하되, 현재 저장소 관례에 맞게 합리적으로 조정할 수 있습니다.

```text
public/assets/sound-museum-final-b/
  architecture/
  floor/
  left-listening/
  center-archive/
  right-shop/
  lounge/
  props/
  npc/
  foreground/
  qa/
  manifest.json
```

코드 쪽에는 다음과 같은 전용 모듈을 둡니다.

```text
lib/soundMuseumFinalBLayout.mjs
lib/soundMuseumFinalBLayout.test.mjs
components/sound-museum/SoundMuseumScene.js
components/sound-museum/SoundMuseumObject.js
```

기존 구조를 과도하게 쪼개지 않는 편이 낫다면 파일 수는 줄여도 되지만, 배치·충돌 데이터와 React 렌더 마크업은 분리하세요.

manifest의 각 항목은 최소한 다음 정보를 가져야 합니다.

```js
{
  id,
  src,
  sourceWidth,
  sourceHeight,
  displayWidth,
  displayHeight,
  x,
  y,
  anchorX,
  anchorY,
  zMode,          // fixed | footY | foreground
  collision,      // null | AABB | 여러 AABB
  interactionId,  // null | vote | exhibits | shop
  animated,
  frameData
}
```

모든 보이는 물체가 manifest의 에셋 또는 명시적인 반복 인스턴스로 추적되어야 합니다. 장식이 어디서 왔는지 알 수 없는 인라인 이미지나 CSS 아트를 남기지 마세요.

## 반드시 제작할 에셋 인벤토리

비슷한 반복 소품은 하나의 원본을 여러 번 배치해도 되지만, 시안에 보이는 범주를 빠뜨리면 안 됩니다.

### 1. 건축과 고정 배경

- 크림색 벽과 짙은 목재 보
- 상단 아치형 창문 세트와 창틀
- 허니오크 바닥 타일 및 가장자리 트림
- 상단 카드 카탈로그 수납장과 책장 모듈
- 좌우 벽 기둥과 코너 마감
- 하단 입구 계단·문턱·청록 입구 러그
- 햇살 빔과 부드러운 바닥 광량 오버레이
- 벽 부착 황동 램프
- 청록 음표 배너

건축 배경은 비가동 요소끼리만 합친 몇 개의 고해상도 플레이트로 만들 수 있습니다. 플레이어보다 앞에 와야 하는 기둥·난간·식물 잎은 별도 foreground 에셋으로 분리합니다.

### 2. 왼쪽 ㄱ자형 청취·투표 라운지

- ㄱ자형 목재 카운터의 가로 모듈과 세로 반환 모듈
- 정확히 5개의 후보 카드 스탠드
- 정확히 5개의 유선 헤드폰
- 정확히 5개의 청록 쿠션 스툴/좌석
- 청록 파형 디스플레이
- 황동 축음기
- 테이블 램프와 작은 장식 병
- 청록 러그와 황금 테두리
- 주변 화분
- 6개 마을 전시 현황용 유리 벽장/니치
  - Animal
  - Human
  - Nature
  - Urban
  - Music
  - Lab

5개 후보 스테이션은 실제 후보 수 상한과 대응합니다. 후보가 5개보다 적어도 배경 가구는 유지하되, 활성 상태·발견 상태를 작은 발광/밝기 변화로 표현할 수 있게 `active/inactive` 시각 상태를 준비합니다. 텍스트 후보 내용 자체는 기존 투표 카드 UI에서 보여 줍니다.

### 3. 중앙 큐레이터·전시 현황 공간

- 원본 캐릭터 디자인의 부엉이 큐레이터
- 최소 4프레임의 미세한 idle 애니메이션 시트 또는 동등한 가벼운 애니메이션
- 곡선형 큐레이터 데스크
- 데스크 위 축음기, 책, 잉크병, 깃펜, 헤드폰, 작은 조명
- 전시 현황 장부가 놓인 독립 페데스탈
- 중앙 청동 파형 바닥 메달리온
- 데스크 뒤 수납장과 중앙 파형 액자

부엉이는 기존 `ZONE_NPC`의 이모지 원형 표시를 대체하는 실제 스프라이트가 되어야 하지만, `SoundMuseum.js`의 대사 내용과 순환 로직은 유지합니다. 말풍선은 부엉이의 실제 화면 좌표를 기준으로 앵커링하세요.

### 4. 오른쪽 의상 상점

- 벽면 모자 선반
- 의상 옷걸이와 개별 의류 실루엣
- 가방·접은 옷·병·상자 선반
- 전신거울
- 마네킹 2종
- 메인 계산 카운터
- 계산대와 동전함
- 오늘의 상품 전시대
- 하단 진열 테이블
- 꽃병과 소형 장식
- 상점 러그
- 원본 디자인의 상점 NPC 스프라이트

실제 상품 썸네일과 가격·구매·장착 상태는 기존 `Shop` 카드 UI에서 유지합니다. 배경 상점은 기능 위치를 명확하게 보여 주는 공간 에셋입니다.

### 5. 하단 독서 라운지와 주변 소품

- 좌우 청록 안락의자 세트
- 원형 사이드 테이블
- 테이블 램프
- 책 더미
- 화분 여러 변형
- 낮은 책장과 난간
- 오른쪽 하단 축음기
- 좌우 전경 난간/책장/식물 가림 레이어

### 6. 플레이어와 상호작용 표시

- 플레이어는 기존 `WORLD_CHARACTER`의 body/clothes/hair 레이어와 장착 의상 연동을 그대로 사용합니다.
- 프롬프트 말풍선은 현재 게임 UI 언어를 유지하되 위치는 월드 좌표에서 계산합니다.
- 상호작용 가능 지점에는 시안 색감에 맞는 미세한 황금 반짝임/바닥 표시를 사용할 수 있으나, 디버그 박스처럼 보이면 안 됩니다.

## 배치와 깊이 정렬

- 최종 시안 위에서 각 오브젝트의 바운딩 박스를 측정해 `soundMuseumFinalBLayout.mjs`에 기록합니다.
- 오브젝트의 바닥 접점 `footY`를 기준으로 플레이어 앞/뒤 가림을 결정합니다.
- 벽 장식은 fixed background, 책상·스툴·카운터는 footY depth, 하단 난간·큰 식물은 foreground 레이어로 분리합니다.
- 플레이어가 카운터 뒤로 들어가거나 책장 위로 올라가 보이지 않도록 충돌 박스를 시각적 바닥 면에 맞춥니다.
- 투명 이미지의 빈 여백 전체를 충돌 박스로 쓰지 마세요.
- 시각 에셋 바운드와 물리 바운드가 QA 오버레이에서 동시에 보이게 합니다.

## 게임 상호작용 매핑

기존 `LibraryRoom`의 세 상호작용 카드를 다음 실제 위치로 연결합니다.

### `vote`

- 위치: 왼쪽 ㄱ자형 청취 라운지 앞
- 프롬프트: `🎧 소리 듣고 투표하기`
- 5개 스테이션 중 어느 앞에 서도 동일한 기존 vote 카드를 열 수 있음
- 카드가 열리면 이동 입력을 잠금
- 실제 재생 성공 전 투표 차단 유지
- 최대 5개 후보, 선택, 동의 슬라이더, 제출, 에러 복구, 다음 후보 흐름 유지

### `exhibits`

- 위치: 중앙 부엉이 데스크 또는 바로 옆 장부 페데스탈
- 프롬프트: `📖 전시 현황 보기`
- 기존 `ExhibitDisplay`와 `zoneCounts`를 그대로 사용
- 6개 벽면 전시 니치는 `zoneCounts`에 따라 발견 전/진행 중/완료 시각 상태를 반영
- 데이터가 없어도 공간 자체와 상점은 정상 작동

### `shop`

- 위치: 오른쪽 계산 카운터 앞
- 프롬프트: `🛍️ 상점 둘러보기`
- 기존 재화 조회, 오늘의 할인, 구매, 중복 구매, 장착, 기본 옷 복귀, 에러 처리 유지
- 구매·장착 중 중복 제출 방지 유지

상호작용 존끼리 겹치면 안 됩니다. 플레이어가 물체에 막혀 실제 프롬프트 위치에 도달할 수 없는 경우가 없어야 합니다.

## 보존해야 하는 기능 불변 조건

`SoundMuseum.js`의 시각 컨테이너는 리팩터링할 수 있지만 다음 동작을 변경하지 마세요.

- `getCandidateExpressions` 후보 로딩과 최대 5개 제한
- 무작위 후보 순서와 기존 제외 조건
- `useMuseumPlayer` 오디오 재생·진행도·에러 처리
- `playCount < 1`일 때 투표 금지
- 후보 선택과 confidence 1~5
- `saveVote`/`submit_museum_vote_v4` 경로
- idempotency key 및 in-flight guard
- 저장 실패 시 선택을 유지하고 재시도 가능
- `onDone`, `onExit`, `sound=null` 상태
- `ExhibitDisplay`의 6개 zone 현황
- `Shop`의 잔액·가격·할인·구매·장착 로직
- `onCurrencyChange`
- `library_card_opened/closed`, `shop_opened/closed` 이벤트와 정확한 close reason
- museum audio, impression, selection, vote attempt/success/failure 이벤트
- 카드 open 중 이동 잠금
- ESC, backdrop, close button, navigation 종료 동작
- 컴포넌트 unmount 시 lifecycle 정리

Supabase 스키마, 보안 RPC, 실험 그룹 필터, canonical sound identity는 이 작업에서 변경하지 마세요.

## 입력과 반응형

- 키보드 방향키/WASD와 Enter/Escape를 유지합니다.
- 모바일에서는 기존 게임의 D-pad 패턴을 재사용해 박물관에서도 이동 가능하게 합니다. 새 입력 시스템을 별도로 만들지 마세요.
- 터치 사용자는 캐릭터가 상호작용 존 근처에 있을 때 프롬프트를 탭해 카드를 열 수 있어야 합니다.
- 카드가 열린 동안 키보드·터치 이동 모두 잠겨야 합니다.
- 가로 모바일에서 최소 844×390까지 입구와 세 기능이 접근 가능해야 합니다.
- 세로 화면은 게임이 기존에 지원하는 정책을 따르되, 화면 밖으로 카드가 잘리거나 닫기 버튼이 사라지면 안 됩니다.

## 카드 UI 배치 개선

월드맵 배경과 기능 카드를 혼동하지 않도록 기존 카드 콘텐츠는 보존하되 시안과 어울리게 외곽 프레임만 정리할 수 있습니다.

- vote 카드는 후보 5개와 슬라이더가 작은 화면에서도 스크롤로 모두 접근 가능해야 함
- exhibits 카드는 중앙 장부에서 열린다는 인지가 있어야 함
- shop 카드는 오른쪽 상점에서 열린다는 인지가 있어야 함
- 카드가 열려도 방이 완전히 사라지지 않고 가장자리에 해당 공간이 보이게 함
- 닫기 버튼은 항상 안전 영역 안에 표시
- UI를 에셋 이미지에 구워 넣지 않음

## 테스트 전용 기능

프로덕션 동작을 오염시키지 않는 범위에서 `app/library-test/page.js`를 확장하세요.

- `?open=vote|exhibits|shop`
- `?walk=...` 기존 자동 보행 유지
- `?qa=collision|depth|interactions|clean`
- `?state=empty|partial|complete`로 6개 전시 상태를 로컬 fixture로 확인
- 테스트 페이지에서 실제 구매나 Supabase 쓰기가 발생하지 않게 함

필요하면 `LibraryRoom`에 테스트 전용 props를 추가하되 기본값에서는 프로덕션 경로에 영향이 없어야 합니다.

## 자동 검증

다음 검증을 추가합니다.

### 에셋 검증 스크립트

`scripts/test-sound-museum-final-b-assets.mjs`

- manifest에 등록된 모든 파일 존재
- PNG/GIF 형식 및 예상 픽셀 크기
- 투명 에셋의 alpha 채널 존재
- source/display 크기 배율이 허용 규칙과 일치
- 중복 ID 없음
- 빈 이미지 없음
- 정확히 5개 listening station 인스턴스
- 정확히 6개 zone exhibit 인스턴스
- 모든 충돌·상호작용 rect가 월드 경계 안에 있음

### 레이아웃 단위 테스트

`lib/soundMuseumFinalBLayout.test.mjs`

- 입구 스폰이 충돌하지 않음
- 입구에서 vote/exhibits/shop 각 상호작용 지점까지 도달 가능한 경로 존재
- 세 상호작용 존이 겹치지 않음
- 가구 충돌 박스가 출구를 막지 않음
- 주요 통로가 캐릭터 폭의 2배 이상
- 데스크·상점·왼쪽 라운지의 foreground/depth 규칙 검증

단순 정규식 테스트만으로 끝내지 말고 실제 좌표 기반 flood-fill 또는 동등한 경로 탐색 검증을 사용합니다.

## 시각 QA

개발 서버를 실행하고 실제 브라우저에서 다음 크기를 모두 캡처합니다.

- 1280×720
- 1440×900
- 1920×1080
- 2560×1440 또는 DPR 2 동등 환경
- 844×390 모바일 가로

각 크기에서 최소 다음 상태를 저장합니다.

1. 입구 스폰 clean view
2. 왼쪽 청취 라운지 접근
3. vote 카드 열림
4. 중앙 부엉이·장부 접근
5. exhibits 카드 열림
6. 오른쪽 상점 접근
7. shop 카드 열림
8. collision overlay
9. foreground/depth 가림 확인

스크린샷은 `design/2d-map-redesign/previews/sound-museum-final-b/` 아래에 저장합니다.

원본 시안과 1280×720 clean view를 나란히 배치한 비교 이미지도 만드세요. 다음을 눈으로 검사하고 문제가 있으면 수정 후 다시 캡처합니다.

- 픽셀 윤곽이 흐리거나 계단이 뭉개지지 않는지
- 얇은 선이 해상도별로 사라지지 않는지
- 투명 가장자리에 흰색/검은색 halo가 없는지
- 오브젝트가 비율 왜곡되지 않는지
- 플레이어 발이 바닥과 맞는지
- 플레이어가 가구 뒤/앞에서 올바르게 가려지는지
- 모든 상호작용 프롬프트가 접근 가능한지
- 카드 닫기 버튼과 스크롤 영역이 잘리지 않는지
- 1안의 밝은 색감이 유지되는지

## 실행해야 할 검증 명령

최소한 다음을 실행하고 결과를 기록하세요.

```bash
node scripts/test-sound-museum-final-b-assets.mjs
node --test lib/soundMuseumFinalBLayout.test.mjs
node --test scripts/stage-6-lifecycle.test.mjs
node --test scripts/security/experiment-rules.test.mjs
node scripts/test-world-map-production-integration.mjs
npx eslint components/LibraryRoom.js components/SoundMuseum.js components/AssetRegistry.js components/sound-museum lib/soundMuseumFinalBLayout.mjs lib/soundMuseumFinalBLayout.test.mjs app/library-test/page.js scripts/test-sound-museum-final-b-assets.mjs
npm run build
```

저장소 전체에 기존 lint/build 문제가 있으면 이번 변경으로 생긴 문제와 기존 문제를 구분해 보고합니다. Sound Museum 관련 신규·수정 파일에는 오류를 남기지 마세요.

## 완료 산출물

반드시 다음을 남깁니다.

1. `public/assets/sound-museum-final-b/`의 실제 런타임 에셋 전체
2. 에셋 manifest와 배치/충돌 모듈
3. 최종 B 시안에 맞게 동작하는 `LibraryRoom`
4. 기존 기능이 연결된 `SoundMuseum`
5. 격리된 library 테스트 하네스와 QA 모드
6. 에셋·레이아웃 자동 테스트
7. 다중 뷰포트 QA 스크린샷과 비교 이미지
8. `design/concepts/sound-museum-2026-09-23/IMPLEMENTATION_HANDOFF.md`

handoff 문서에는 다음을 적습니다.

- 수정 파일 목록
- 에셋 목록과 생성/추출 출처
- 월드 좌표·스케일·DPR 처리 방식
- 충돌과 상호작용 존 요약
- 기존 기능 보존 근거
- 실행한 테스트와 결과
- 시각 QA 스크린샷 경로
- 남은 문제 또는 의도적 차이

## 완료 기준

다음 조건을 모두 충족해야 완료입니다.

- 최종 B 시안의 밝은 공간, 중앙 부엉이, ㄱ자형 청취 라운지, 6개 전시물, 우측 상점이 실제 게임에 구현됨
- 시안의 모든 가시적 물체 범주가 프로젝트 에셋 또는 manifest 인스턴스로 존재함
- 플레이어가 입구에서 세 기능으로 실제 이동 가능함
- vote/exhibits/shop 카드가 올바른 물리 위치에서 열림
- 기존 오디오·투표·전시·구매·장착·이벤트 로직이 회귀하지 않음
- 5개 후보와 6개 전시 현황이 시각적으로 구분됨
- 플레이어·가구·전경의 충돌과 가림이 자연스러움
- 1280×720, 1920×1080, DPR 2, 모바일 가로에서 흐림·깨짐·비율 왜곡이 없음
- 자동 테스트, 대상 lint, build가 통과하거나 이번 작업과 무관한 기존 실패만 명확히 분리됨
- 임시 에셋, 플레이스홀더, CSS 대체물, 미사용 생성 파일이 남지 않음

중간에 쉬운 정적 배경 방식으로 타협하지 마세요. 필요한 에셋을 끝까지 제작하고 실제 게임 동작과 시각 품질을 모두 검증한 뒤 완료 보고하세요.

