# CLAUDE CODE 작업 지시서 — 동물 마을(Animal Zone) 맵 통합

이 폴더는 `HyeraS/new_soundvillage` 저장소의 **Animal 존 내부 맵 리스킨 디자인** 인수인계 패키지입니다.
이 문서를 읽는 Claude Code는 아래 순서대로 실제 앱에 통합하세요.

---

## 0. 결론 먼저

- **레이아웃 B(연못 고리길)가 확정안입니다.** A는 참고용으로만 남아 있습니다.
- 맵 생성 · 충돌 · 드로잉은 `animal-village.js` **한 파일**에 전부 들어 있고, 프레임워크 의존성이 없습니다. **그대로 복사해서 쓰는 것이 의도된 사용법입니다.** 로직을 다시 쓰지 마세요.
- 그래픽은 새로 그린 게 없습니다. 전부 저장소에 이미 있는 구매 에셋(shubibubi "All Things Cozy")을 `components/AssetRegistry.js`에 등록된 좌표 그대로 크롭한 것입니다.
- **소리 수집 / 블록 언락 / Supabase 저장 로직은 이 디자인의 범위가 아닙니다.** 목업으로만 돌아갑니다. 3단계에서 기존 로직으로 교체하세요.

## 1. 패키지 구성

```
handoff/
├─ CLAUDE_CODE.md              ← 지금 이 문서. 통합 지시서
├─ DESIGN_SPEC.md              ← 디자인 스펙 (HUD 수치, 색, 자연스러움 규칙, 맵 데이터 구조)
├─ animal-village.js           ← ★ 앱에 이식할 엔진 (의존성 없는 ES 모듈)
├─ assets-used/world/**        ← 엔진이 실제로 로드하는 시트 26개 (저장소 사본, 대조용)
└─ design-reference/           ← 디자인 원본. 브라우저로 열어 조작해 볼 수 있는 참조 구현
   ├─ Animal Village Map.dc.html
   ├─ animal-village.js
   └─ support.js
```

`design-reference/`는 **디자인 확인용이지 이식 대상이 아닙니다.** HUD 레이아웃과 인터랙션 감각을 눈으로 확인하는 데만 쓰세요.

## 2. 통합 순서

### 2-1. 엔진 배치
`animal-village.js`를 `lib/animalVillage.js`로 복사하고, 파일 상단 에셋 베이스만 Next public 경로로 바꿉니다.

```js
// 파일 상단
let BASE = 'public/assets/'   // → 앱에서는 setAssetBase('/assets/') 호출
```

앱 진입점에서:
```js
import * as AV from '@/lib/animalVillage'
AV.setAssetBase('/assets/')
```

`assets-used/world/**`는 이미 저장소에 있는 파일과 동일합니다. **앱에 새로 복사하지 마세요** — 경로만 맞으면 됩니다. 파일이 바뀌었는지 대조할 때만 쓰세요.

### 2-2. ZoneMap의 Animal 분기 교체

```js
// 1) 프리로드 → 맵 빌드 → 정적 레이어 1회 렌더
await AV.loadAssets()
const village = AV.buildVillage('B')

const off = document.createElement('canvas')
off.width  = AV.MAP_W * AV.T   // 1536
off.height = AV.MAP_H * AV.T   // 1152
AV.drawStatic(off.getContext('2d'), village)
```

**정적 레이어는 반드시 오프스크린 캔버스에 1회만 렌더하세요.** 매 프레임 `drawStatic`을 부르면 프레임이 무너집니다.

```js
// 2) 매 프레임
ctx.setTransform(1,0,0,1,0,0)
ctx.imageSmoothingEnabled = false
ctx.scale(2, 2)                                    // 카메라 줌 ×2
ctx.translate(-Math.round(cam.x), -Math.round(cam.y))
ctx.drawImage(off, 0, 0)                           // blit
items.forEach(it => AV.drawItem(ctx, it, t))
AV.drawPlayer(ctx, pos, t, moving)
AV.drawLockFog(ctx, village, unlockedBlock, t)
```

카메라는 플레이어 중심 + 맵 경계 클램프:
```js
cam.x = Math.max(0, Math.min(MW - VW/2, pos.x - VW/4))
cam.y = Math.max(0, Math.min(MH - VH/2, pos.y - VH/4))
```

**플레이어 좌표를 React state에 넣지 마세요.** ref/인스턴스 필드에 두고 rAF 루프에서 직접 갱신합니다 (60fps setState 금지).

### 2-3. 이동 · 충돌

```js
const next = AV.moveWithCollision(village, pos, dx * speed, dy * speed)
```
- 속도 2.4px/frame, 대각선은 ÷1.41
- 히트박스는 발밑 20×14px (`AV.PLAYER_BOX`) — 스프라이트 전체가 아닙니다
- X/Y 분리 판정이라 벽에 붙어도 미끄러집니다
- 걷기 애니메이션은 8프레임 100ms (Character v.2 팩 규격)

`showColliders` 상당의 디버그 오버레이로 한 번 확인하세요:
```js
village.colliders.forEach(c => ctx.strokeRect(c.x+.5, c.y+.5, c.w-1, c.h-1))
```

### 2-4. 아이템 소스 교체 ★ 반드시 할 일

현재 `spawnItems()`가 구역별 8개를 시드 기반으로 **목업 스폰**합니다. 실제 데이터로 바꾸세요.

```js
// 유지할 것: 배치 후보 판정 (walkable + collider 회피 + 최소 간격 3타일)
// 교체할 것: id / cat 의 출처
village.items = SOUND_ITEMS.Animal
  .filter(/* 기존 group / block 필터 */)
  .map((s, i) => ({
    id: s.sound_id,
    tx, ty,                     // spawnItems 의 후보 셀 로직 재사용
    block: s.block,             // 제품 block_size = 15
    neon: village.districts.find(d => d.block === s.block).neon,
    cat: s.sub_category,
    phase: Math.random() * 6.28,
    collected: false,
  }))
```

배치 규칙은 그대로 지키세요: 물/밭 타일 제외, collider 6px 여유 회피, 같은 구역 내 최소 3타일 간격.

### 2-5. 전사 패널 · 제출

근접 판정(46px 이내) → SPACE → **기존 `AnnotationPanel` 재사용**. 패널을 새로 만들 필요 없습니다.
제출 시 페이로드:
```js
{ sound_id, zone: 'Animal', sub_category, expression_text, confidence }
```
→ 기존 Supabase `annotations` insert에 연결.

### 2-6. 블록 언락

**목업의 `unlocked` state를 버리고** 기존 `unlockedBlock` / `collectedIds`를 쓰세요.
`AV.drawLockFog(ctx, village, unlockedBlock, t)` 에 그 값을 그대로 넘기면 잠긴 구역이 구름으로 덮입니다.

### 2-7. 정리

- 레이아웃 A/B 스위처(`swapLayout`)와 관련 HUD 버튼 제거 — B만 남깁니다
- `layoutA()` 함수는 삭제하지 말고 남겨두세요 (배치 참고용). 호출만 하지 않으면 됩니다
- `onExit` → 월드맵 복귀 (`screen: 'world'`)

---

## 3. 엔진 API 요약

```js
setAssetBase(base)                          // 에셋 루트 지정
await loadAssets()                          // 시트 26개 프리로드 (buildVillage 전에 필수)
buildVillage('B') → village                 // 맵 데이터 생성
drawStatic(ctx, village)                    // 정적 레이어 (1회만!)
drawItem(ctx, item, t)                      // 소리 아이템 (부유 + 스파클)
drawPlayer(ctx, pos, t, moving)             // 3레이어 캐릭터 합성
drawLockFog(ctx, village, unlockedBlock, t) // 잠긴 구역 구름
moveWithCollision(village, pos, dx, dy)     // 충돌 처리 이동
T, MAP_W, MAP_H, PLAYER_BOX, IMG            // 상수
```

`village` 객체 구조:
```js
{
  variant, label,
  terrain: number[36][48],   // 0 잔디 1 흙길 2 광장 3 물 4 밭 5 다리
  colliders: [{x,y,w,h,tag}],            // 픽셀 AABB. tag: building|fence|crop|tree|bush|rock|prop|water|edge
  sprites:   [{spec,px,py,scale,sort}],  // sort 기준 y정렬 합성
  districts: [{block, name, area:{x,y,w,h}, neon}],
  items:     [{id,tx,ty,block,neon,cat,phase,collected}],
  buildings, pens, fields, orchards, fences, crops, detail, bridges, ponds, signs,
  spawn: {x,y}, walkable(tx,ty),
}
```

## 4. 절대 깨뜨리면 안 되는 것

디자인 의도가 코드에 들어 있는 부분입니다. 리팩터할 때 함께 지우기 쉬우니 주의하세요.

1. **`featherEdges()`** — 길↔잔디 경계에 흙/풀 점을 서로 물리게 뿌립니다. 없애면 즉시 타일맵처럼 보입니다.
2. **잔디 = 단색 배경 + 이음매 없는 안쪽 타일 + 새싹 스캐터** — 시트의 잔디 오토타일은 전부 "섬" 모양이라 반복하면 체크무늬가 생깁니다. 저장소에 이미 기록된 결론입니다.
3. **`edgeBias()`** — 맵 테두리로 갈수록 나무 확률을 78%까지 올려 숲으로 마을을 감쌉니다. 길 인접 타일에는 큰 나무를 심지 않습니다.
4. **건물 발밑 흙 앞마당 3타일** — 없으면 건물이 잔디 위에 떠 보입니다.
5. **`addPond()` 폴리곤 연못** — 타일 격자로 되돌리면 계단 모서리가 드러납니다. 레이어 순서(잔디 프린지 → 흙 둔치 → 얕은 물 띠 → 물 → 수련잎)를 유지하세요.
6. **`drawBridge()`** — 판자 데크 + 난간 기둥. 난간 스프라이트를 세로로 쌓는 방식으로 되돌리면 사다리처럼 보입니다.
7. **건물 충돌은 하단 66%만** — 지붕 뒤로 걸어 들어가야 탑다운 원근이 성립합니다.
8. **가축은 전부 울타리 안** — 길가 방목 배치는 검토 후 폐기했습니다. 되살리지 마세요.

## 5. 현재 맵 상태 (레이아웃 B)

- 48 × 36 타일 = 1536 × 1152 px
- 우리 6곳, 가축 38마리, 13종 전부 사용, 100% 울타리 안
- 구역 5개 × 아이템 8개 = 40개 (목업). 스폰 지점에서 플러드 필 검사 시 전부 도달 가능
- 건물: 농가 · 헛간 + 사일로 · 닭장 · 온실 · 풍차 · 마을회관
- 중앙 연못(폴리곤) + 가로 목교, 과수원 2곳, 작물밭 2곳

## 6. 배치를 조정하려면

`animal-village.js`의 `layoutB(v, tr, r)` 함수 **한 곳만** 보면 됩니다. 좌표 단위는 타일(0~47 × 0~35).

| 대상 | 수정 지점 |
|---|---|
| 길 · 광장 | `fillRect(tr, x, y, w, h, code)` — 나중 호출이 앞을 덮음 |
| 건물 | `v.buildings = [{spec, tx, ty, label}]` — `spec`은 상단 `BUILD` |
| 우리 · 가축 | `v.pens = [{x,y,w,h,gate,kinds,block}]` — `kinds`는 상단 `ANIMALS` 키 배열, 길이가 마리 수 (우리당 최대 9) |
| 밭 | `v.fields = [{x,y,w,h}]` |
| 과수원 | `v.orchards = [{x,y,w,h,kind}]` — `kind`는 `NAT.trees` 인덱스 |
| 연못 | `addPond(v, tr, cx, cy, rx, ry, seed)` — `seed`만 바꿔도 윤곽이 완전히 달라짐 |
| 다리 | `v.bridges = [{x,y,w,h,dir}]` — `dir`은 `'h'`/`'v'` |
| 구역 | `v.districts = [{block, name, area, neon}]` — 아이템 스폰 범위 · 잠금 구름 · 레전드가 이 `area`를 씀 |
| 입구 · 팻말 | `v.spawn = {x,y}`(픽셀), `v.signs = [{tx,ty,text}]` |
| 숲 밀도 · 소품 확률 | `scatterNature()` |

**배치를 바꾼 뒤에는 반드시 도달성을 검사하세요.** `spawn`에서 8px 격자 플러드 필을 돌려 모든 아이템이 닿는지 확인합니다. 울타리 문 위치를 잘못 잡아 대로가 막힌 사례가 실제로 있었습니다.
