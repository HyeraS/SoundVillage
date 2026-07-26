/**
 * 4비트 블롭 오토타일 헬퍼.
 *
 * 시트에서 실제로 확인한 건 딱 2가지 조각뿐이다: full(안쪽 꽉 참)과 edge(한쪽 면만
 * 다른 지형, 그쪽에 크림색 경계가 둥글게 들어간 조각). edge 하나를 90도 단위로 돌리면
 * N/E/S/W 4방향을 다 커버할 수 있어서, 나머지 좌표(코너/통로/돌출 등)를 따로 재지 않고
 * "다른 지형인 방향 중 하나"를 우선순위로 골라 그 방향의 edge로 근사한다 — 직선 경계에서는
 * 항상 정확하고, 꺾이는 모서리에서는 한쪽 경계선만 반영되는 근사치.
 */

// N=1, E=2, S=4, W=8 (비트=1이면 그 방향 이웃이 "같은 지형")
export function neighborCode(tx, ty, terrainAt, terrain) {
  const n = terrainAt(tx, ty - 1) === terrain
  const e = terrainAt(tx + 1, ty) === terrain
  const s = terrainAt(tx, ty + 1) === terrain
  const w = terrainAt(tx - 1, ty) === terrain
  return (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0)
}

// edge 원본 그림은 "N/E/W는 같은 지형, S만 다른 지형"(위쪽 3면 안쪽, 아래쪽에 경계) 모양
// 기준 — rotate=0. 시계방향 회전마다 "다른 면"이 S→W→N→E 순서로 옮겨간다.
export function autotileShape(tx, ty, terrainAt, terrain) {
  const code = neighborCode(tx, ty, terrainAt, terrain)
  if (code === 15 || code === 0) return { shape: 'full', rotate: 0 }
  if (!(code & 4)) return { shape: 'edge', rotate: 0   } // S가 다름
  if (!(code & 8)) return { shape: 'edge', rotate: 90  } // W가 다름
  if (!(code & 1)) return { shape: 'edge', rotate: 180 } // N이 다름
  return { shape: 'edge', rotate: 270 } // E가 다름
}
