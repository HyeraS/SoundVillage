# World map 80% production test results

검증일: 2026-10-05

| 명령/검증 | 결과 | 핵심 결과 |
|---|---:|---|
| `npm run test:world-camera` | PASS | 5 viewport × 3 scale, default 0.8, production query lock, overview |
| `npm run test:character-render-size` | PASS | World default/100/75와 마을·박물관 캐릭터 화면 크기/발점 |
| `npm run test:world-production` | PASS | 8 목적지, 9,925 reachable foot tiles, 43 assets, production scale contract |
| `npm run test:world-v4-assets` | PASS | 32 assets, 12 terrain panels, 18 semantic objects |
| `npm run test:world-v4-collision` | PASS | 8 unit tests, 636,624 walkable cells, disconnected 0 |
| `npm run test:world-authored-routes` | PASS | 8/8 routes arrived, stalled frame 0 |
| `npm run test:world-minimap` | PASS | 7/7 tests |
| `node scripts/test-world-map-80-production.mjs` | PASS | DPR1 40 조건 + DPR2 8 조건 |
| `node scripts/measure-world-map-80-performance.mjs` | PASS | 100/80 cold context 각 3회, browser/asset 오류 0 |
| `npm run lint` | PASS | 전체 ESLint |
| `npm run build` | PASS | Next.js 16.2.7 webpack, 39 static pages |

브라우저 QA: 100% 비교 48장 + 80% 정식 48장, console/HTTP/image 오류 0. production 기본/우회 차단은 `NODE_ENV=production` 계약 테스트와 production build에서 검증했고, 목적지 화면 검수는 production과 동일한 0.8 카메라 경로의 내부 QA 진입점에서 수행했다.
