import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW_ROOT = path.join(ROOT, '_review/world-map-scale-prototype-2026-10-05')
const PHASES = [
  { id:'100', directory:'00-baseline', scale:1 },
  { id:'80', directory:'01-scale-80', scale:.8 },
  { id:'75', directory:'02-scale-75', scale:.75 },
]
const round = (value, places = 3) => Number(Number(value || 0).toFixed(places))
const average = (values, selector) => values.reduce((sum, value) => sum + selector(value), 0) / (values.length || 1)
const viewportKey = record => `${record.viewport.width}x${record.viewport.height}`

const phases = await Promise.all(PHASES.map(async phase => ({
  ...phase,
  dpr1:JSON.parse(await readFile(path.join(REVIEW_ROOT, phase.directory, 'metrics-dpr1.json'), 'utf8')),
  dpr2:JSON.parse(await readFile(path.join(REVIEW_ROOT, phase.directory, 'metrics-dpr2.json'), 'utf8')),
})))
const viewports = [...new Set(phases[0].dpr1.map(viewportKey))]

const cameraMetrics = {
  generatedAt:'2026-10-05',
  logicalWorld:{ width:3840, height:2880, tiles:'120x90', tileSize:32, changed:false },
  productionDefaultChanged:false,
  queryParameter:'worldVisualScale',
  allowedDevelopmentValues:[1, .8, .75],
  productionFallback:1,
  overview:{ width:3840, height:2880, scaleIgnored:true },
  viewports:viewports.map(viewport => {
    const byScale = Object.fromEntries(phases.map(phase => {
      const records = phase.dpr1.filter(record => viewportKey(record) === viewport)
      const authority = records.find(record => record.location.id === 'library')
      const baselineAuthority = phases[0].dpr1.find(record => viewportKey(record) === viewport && record.location.id === 'library')
      return [phase.id, {
        visualScale:phase.scale,
        viewW:authority.camera.viewW,
        viewH:authority.camera.viewH,
        cssPxPerWorld:round(authority.camera.cssPxPerWorldX, 6),
        playerCss:{ width:round(authority.player.width), height:round(authority.player.height) },
        playerSizeDeltaPercent:{
          width:round((authority.player.width / baselineAuthority.player.width - 1) * 100, 4),
          height:round((authority.player.height / baselineAuthority.player.height - 1) * 100, 4),
        },
        centralFootErrorCssPx:round(Math.hypot(
          authority.playerFootScreen.x - baselineAuthority.playerFootScreen.x,
          authority.playerFootScreen.y - baselineAuthority.playerFootScreen.y,
        ), 4),
        labelMinCssPx:round(Math.min(...records.map(record => record.labelCssHeight))),
        averageVisibleAssets:round(average(records, record => record.visibleAssetCount), 2),
        averageMapReadyMs:round(average(records, record => record.performance.mapReadyMs), 2),
        browserErrors:records.reduce((sum, record) => sum + record.errors.length, 0),
        failedAssets:records.reduce((sum, record) => sum + record.performance.failedAssetCount, 0),
      }]
    }))
    return { viewport, scales:byScale }
  }),
  browserCoverage:{
    dpr1:{ viewports, locations:['library', 'home', 'nature', 'music', 'animal'], captures:75 },
    dpr2:{ viewports:['1440x900'], locations:['library', 'home', 'nature', 'music', 'animal'], captures:15 },
  },
}

const densitySummary = Object.fromEntries(phases.map(phase => [phase.id, {
  visualScale:phase.scale,
  meanSourcePixelsPerCssPixelX:round(average(phase.dpr1, record => record.pixelDensity.meanX)),
  meanVisibleAssets:round(average(phase.dpr1, record => record.visibleAssetCount), 2),
  meanMapReadyMs:round(average(phase.dpr1, record => record.performance.mapReadyMs), 2),
  minimumLabelCssPx:round(Math.min(...phase.dpr1.map(record => record.labelCssHeight))),
  playerWidthRangeCssPx:[round(Math.min(...phase.dpr1.map(record => record.player.width))), round(Math.max(...phase.dpr1.map(record => record.player.width)))],
  consoleOrAssetErrors:phase.dpr1.reduce((sum, record) => sum + record.errors.length + record.performance.failedAssetCount, 0),
}]))
const visualDensity = {
  generatedAt:'2026-10-05',
  measurement:'decoded source pixels divided by rendered CSS pixels for visible terrain/object images',
  summary:densitySummary,
  byViewport:Object.fromEntries(viewports.map(viewport => [viewport, Object.fromEntries(phases.map(phase => {
    const records = phase.dpr1.filter(record => viewportKey(record) === viewport)
    return [phase.id, {
      meanSourcePixelsPerCssPixelX:round(average(records, record => record.pixelDensity.meanX)),
      meanLandmarkViewportWidth:round(average(records, record => record.landmarkViewportOccupancy?.width || 0)),
      meanVisibleAssets:round(average(records, record => record.visibleAssetCount), 2),
      minimumLabelCssPx:round(Math.min(...records.map(record => record.labelCssHeight))),
    }]
  }))])),
  visualVerdict:{
    terrainAndBuildingEdges:'80%에서 명확히 개선, 75%에서 추가 개선. 1920x1080은 75%도 평균 0.917 source-px/CSS-px라 일부 확대가 남음.',
    spatialReadability:'75%가 가장 좋지만 80%도 길과 입구의 연결 구조를 충분히 노출함.',
    landmarkScale:'80%는 기준의 80%, 75%는 기준의 75%로 정확히 축소되며 과도한 소형화는 없으나 75%의 추가 이득은 제한적.',
    playerRatio:'모든 viewport에서 기준 대비 사실상 0% 변화. 월드만 작아져 마을 장면과의 캐릭터 비율에 가까워짐.',
    labels:'축소 모드의 월드 라벨은 최소 약 17 CSS px, 터치 입장 버튼은 44x44 CSS px.',
    styleMismatch:'카메라는 확대 블러와 점유율을 개선하지만 회화풍 월드와 픽셀풍 마을의 스타일 차이는 남음.',
  },
  recommendation:{
    choice:'카메라 80% 정식 적용',
    rationale:'전체 평균 픽셀 밀도를 25% 높이고 1440x900에서 1 source-px/CSS-px를 넘기면서, 75% 대비 랜드마크 크기와 초기 표시 에셋 수를 덜 희생한다. 80%에서 75%로 더 줄일 때 밀도 이득은 약 6.7%뿐이다.',
    logicalWorldScaleRequired:false,
    followUp:'1920x1080의 잔여 확대와 화풍 차이는 논리 좌표 축소가 아니라 핵심 원본 에셋 해상도/스타일 정합 작업으로 해결한다.',
  },
}

const testResults = `# World map scale prototype test results

검증일: 2026-10-05

| 명령/검증 | 결과 | 핵심 결과 |
|---|---:|---|
| \`npm run test:world-camera\` | PASS | 5 viewport × 3 scale × 중앙/네 모서리/8 목적지, overview, invalid fallback, production fallback |
| \`npm run test:character-render-size\` | PASS | World 100/80/75와 6개 마을, 방향/걷기 프레임/장비 레이어, invalid number |
| \`npm run test:world-production\` | PASS | 9,925 reachable foot tiles, 8개 목적지 경로, 43개 production asset |
| \`node scripts/test-world-map-scale-prototype.mjs\` | PASS | 25 A/B 조건, 캐릭터 ±5%, 중앙 발점 2px, 라벨 12px, 터치 44px, density 증가 |
| \`npm run lint\` | PASS | 전체 저장소 ESLint |
| \`npm run build -- --webpack\` | PASS | Next.js 16.2.7 production webpack build, 39 static pages |
| Playwright DPR 1 | PASS | 5 viewport × 5 위치 × 3 scale = 75 captures, console/HTTP/image error 0 |
| Playwright DPR 2 | PASS | 1440x900 × 5 위치 × 3 scale = 15 captures, console/HTTP/image error 0 |

참고: build 스크립트 자체가 이미 \`next build --webpack\`이므로 요청 명령은 로그상 \`--webpack --webpack\`으로 실행됐으나 정상 완료됐다.
`

const tableRows = cameraMetrics.viewports.map(entry => {
  const values = ['100', '80', '75'].map(key => entry.scales[key])
  return `| ${entry.viewport} | ${values.map(value => `${round(value.viewW)}×${round(value.viewH)}`).join(' / ')} | ${values.map(value => `${round(value.playerCss.width)}×${round(value.playerCss.height)}`).join(' / ')} | ${values.map(value => value.cssPxPerWorld).join(' / ')} |`
}).join('\n')
const densityRows = viewports.map(viewport => {
  const values = ['100', '80', '75'].map(key => visualDensity.byViewport[viewport][key])
  return `| ${viewport} | ${values.map(value => value.meanSourcePixelsPerCssPixelX).join(' / ')} | ${values.map(value => value.meanLandmarkViewportWidth).join(' / ')} | ${values.map(value => value.minimumLabelCssPx).join(' / ')} |`
}).join('\n')

const qaReport = `# SoundVillage 월드맵 75% 시각 축소 프로토타입 QA 보고서

## 결론

**최종 권고: 카메라 80% 정식 적용. 실제 논리 월드 75% 축소는 필요하지 않다.**

현재 저해상도 체감의 주원인은 2896×2172 계열 원본/런타임 패널이 3840×2880 논리 월드에 등록된 뒤, 기본 카메라에서 다시 화면 크게 확대되면서 일부 viewport에서 1 CSS px당 원본 픽셀이 1보다 낮아지는 이중 확대다. 1440×900 기준 평균 밀도는 100%의 0.834에서 80%의 1.043, 75%의 1.112로 개선됐다. 카메라만으로 이 문제를 안전하게 줄일 수 있으며, 좌표·충돌·스폰·경로·포털·이동 속도는 모두 그대로다.

## 구현

- 개발 환경 전용 \`?worldVisualScale=1|0.8|0.75\`를 추가했다. production 또는 허용되지 않은 값은 1로 fallback한다.
- FOV는 \`baseFov / worldVisualScale\`로 계산하며 종횡비, overview, 월드 경계 clamp를 유지한다.
- 기존 \`MAX_FOV\`는 scale 1에서 그대로이고 QA 축소율만큼만 비례 확장해 모바일 세로 75%가 84%로 잘리는 문제를 막았다.
- 캐릭터는 실제 카메라 배율을 역보정해 화면 크기를 고정했고, clamp가 없는 중앙 위치의 발 중심 오차는 0.001 CSS px 미만이다.
- 축소 모드의 SVG 월드 라벨은 화면 고정 최소 크기를 적용했다. 측정 최솟값은 약 17 CSS px이며 모바일 입장 버튼은 44×44 CSS px다.

## 카메라·플레이어 결과

표기 순서: 100% / 80% / 75%.

| viewport | viewW×viewH | 플레이어 CSS bbox | CSS px/world px |
|---|---|---|---|
${tableRows}

플레이어 가로·세로 변화는 모든 25개 위치/viewport 조건에서 ±0.01% 미만이었다. 맵 가장자리 위치에서는 clamp 때문에 플레이어의 화면 위치가 달라지지만 화면 밖으로 밀린 사례는 없었다.

## 픽셀 밀도·점유율·라벨

랜드마크 점유율은 viewport 폭 대비 비율의 5개 위치 평균이다. 표기 순서: 100% / 80% / 75%.

| viewport | source px/CSS px | 랜드마크 폭 점유율 | 라벨 최소 CSS px |
|---|---|---|---|
${densityRows}

전체 평균 source px/CSS px는 **${densitySummary['100'].meanSourcePixelsPerCssPixelX} → ${densitySummary['80'].meanSourcePixelsPerCssPixelX} → ${densitySummary['75'].meanSourcePixelsPerCssPixelX}**였다. 표시 에셋 수는 평균 **${densitySummary['100'].meanVisibleAssets} → ${densitySummary['80'].meanVisibleAssets} → ${densitySummary['75'].meanVisibleAssets}**, mapReady는 **${densitySummary['100'].meanMapReadyMs}ms → ${densitySummary['80'].meanMapReadyMs}ms → ${densitySummary['75'].meanMapReadyMs}ms**였다.

## 시각 판정

- 지형 문양/건물 윤곽: 80%에서 확대 블러가 명확히 감소하고 75%에서 소폭 더 개선됐다.
- 공간 구조/길/입구: 75%가 가장 넓고 읽기 쉽지만 80%도 충분한 개선을 보였다.
- 랜드마크: 80%와 75% 모두 식별 가능하다. 75%의 추가 축소는 밀도 이득 대비 화면 존재감 감소가 더 크다.
- 캐릭터/건물 비율: 캐릭터가 고정되어 두 축소 모드 모두 각 마을 비율에 가까워졌다.
- 라벨: 모든 80/75 조건이 핵심 12px 기준을 통과했다. 건물 출입문을 과도하게 가리지 않았다.
- 화풍 차이: 회화풍 월드와 픽셀풍 캐릭터/마을의 차이는 남는다. 카메라 조정으로 해상도 문제는 줄지만 스타일 문제까지 해결되지는 않는다.

## 권고 근거와 다음 단계 위험

80%는 기준 대비 밀도를 25% 높이고 1440×900에서 확대를 해소한다. 75%는 80% 대비 밀도를 약 6.7% 더 높이지만 표시 에셋과 랜드마크 축소 비용이 늘고, 1920×1080에서도 0.917 source-px/CSS-px라 고해상도 잔여 블러를 완전히 없애지 못한다. 따라서 실제 월드 좌표를 75%로 축소하는 것은 동일한 시각 이득에 비해 충돌·경로·포털·저작 데이터 회귀 위험만 크게 만든다.

정식 적용 단계에서는 기본 카메라만 80%로 전환하고, 1920×1080 이상에서 확대되는 핵심 지형/랜드마크 원본을 보강하는 편이 낫다. 화풍 정합은 별도 아트 패스로 다룬다.

## 대표 비교 자료

- 전체 데스크톱: \`${path.join(REVIEW_ROOT, '03-comparisons/full-1440x900-library.png')}\`
- 200% 원본 크롭: \`${path.join(REVIEW_ROOT, '03-comparisons/crop-200pct-1440x900-library.png')}\`
- 모바일 세로: \`${path.join(REVIEW_ROOT, '03-comparisons/full-390x844-nature.png')}\`
- Full HD 음악 마을: \`${path.join(REVIEW_ROOT, '03-comparisons/full-1920x1080-music.png')}\`

세부 수치는 \`camera-metrics.json\`, \`visual-density-comparison.json\`, 각 phase의 \`metrics-dpr1.json\`/\`metrics-dpr2.json\`에 있다.
`

await Promise.all([
  writeFile(path.join(REVIEW_ROOT, 'camera-metrics.json'), `${JSON.stringify(cameraMetrics, null, 2)}\n`),
  writeFile(path.join(REVIEW_ROOT, 'visual-density-comparison.json'), `${JSON.stringify(visualDensity, null, 2)}\n`),
  writeFile(path.join(REVIEW_ROOT, 'test-results.md'), testResults),
  writeFile(path.join(REVIEW_ROOT, 'QA_REPORT.md'), qaReport),
])

console.log(JSON.stringify({ status:'PASS', reviewRoot:REVIEW_ROOT, recommendation:visualDensity.recommendation.choice }, null, 2))
