# World map scale prototype test results

검증일: 2026-10-05

| 명령/검증 | 결과 | 핵심 결과 |
|---|---:|---|
| `npm run test:world-camera` | PASS | 5 viewport × 3 scale × 중앙/네 모서리/8 목적지, overview, invalid fallback, production fallback |
| `npm run test:character-render-size` | PASS | World 100/80/75와 6개 마을, 방향/걷기 프레임/장비 레이어, invalid number |
| `npm run test:world-production` | PASS | 9,925 reachable foot tiles, 8개 목적지 경로, 43개 production asset |
| `node scripts/test-world-map-scale-prototype.mjs` | PASS | 25 A/B 조건, 캐릭터 ±5%, 중앙 발점 2px, 라벨 12px, 터치 44px, density 증가 |
| `npm run lint` | PASS | 전체 저장소 ESLint |
| `npm run build -- --webpack` | PASS | Next.js 16.2.7 production webpack build, 39 static pages |
| Playwright DPR 1 | PASS | 5 viewport × 5 위치 × 3 scale = 75 captures, console/HTTP/image error 0 |
| Playwright DPR 2 | PASS | 1440x900 × 5 위치 × 3 scale = 15 captures, console/HTTP/image error 0 |

참고: build 스크립트 자체가 이미 `next build --webpack`이므로 요청 명령은 로그상 `--webpack --webpack`으로 실행됐으나 정상 완료됐다.
