// 음악 마을(Music Zone) 맵 생성 + 렌더 엔진 — 순수 로직/드로잉. UI는 DC가 담당.
// 좌표 단위: 타일(32px). 맵 48x36 = 1536x1152px.
// 팔레트/조형 레퍼런스: 밤 인디고 마을 + 신스웨이브 네온 간판.

export const T = 32;
export const MAP_W = 48;
export const MAP_H = 36;

export const PAL = {
  night: '#232049',
  // 지면
  grass: '#3b3a72',
  grassAlt: '#413f7d',
  grassDark: '#332f63',
  cobble: '#4b4585',
  cobbleAlt: '#544d92',
  cobbleDark: '#3d3873',
  brick: '#6b5a92',
  brickAlt: '#7a6aa1',
  plaza: '#5a4f96',
  plazaAlt: '#635891',
  water: '#2f3f8c',
  waterLit: '#4c62c4',
  wood: '#7c5a63',
  woodLit: '#9a707a',
  // 조명/네온
  lamp: '#ffd9a0',
  warm: '#ffb45c',
  pink: '#ff6fae',
  cyan: '#63e6f2',
  yellow: '#ffd166',
  mint: '#7cf2c4',
  violet: '#b678ff',
  ink: '#1a1638',
  shade: 'rgba(20,16,48,0.42)',
  white: '#f6efff',
};

export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rect = (x, y, w, h) => ({ x, y, w, h });
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// ------------------------------------------------------------------ 레이아웃

// A — 네온 대로 (격자 다운타운)
function layoutA() {
  return {
    label: '네온 대로',
    seed: 1204,
    spawn: { x: 24, y: 27 },
    streets: [
      rect(22, 2, 4, 33), rect(2, 13, 44, 3), rect(2, 25, 44, 3),
      rect(15, 2, 2, 26), rect(31, 2, 2, 26), rect(8, 28, 32, 2),
    ],
    plazas: [rect(17, 16, 14, 9)],
    water: [], bridges: [],
    stage: { x: 19, y: 3, w: 10, h: 8 },
    busking: { x: 22, y: 19, w: 5, h: 4 },
    districts: [
      { block: 1, name: '버스킹 광장', area: rect(17, 16, 14, 9), neon: PAL.pink },
      { block: 2, name: '레코드 거리', area: rect(2, 2, 13, 11), neon: PAL.cyan },
      { block: 3, name: '악기 골목', area: rect(33, 2, 13, 11), neon: PAL.yellow },
      { block: 4, name: '카페 거리', area: rect(2, 28, 19, 7), neon: PAL.mint },
      { block: 5, name: '페스티벌 무대', area: rect(27, 28, 19, 7), neon: PAL.violet },
    ],
    buildings: [
      { id: 'rec', x: 4, y: 4, w: 6, h: 6, label: 'RECORDS', wall: '#4a5a9c', wallLit: '#5a6cb4', roof: '#2f3a६8'.replace('६', '6'), roofLit: '#3d4a82', neon: PAL.cyan, roofKind: 'gable', extras: ['discSign', 'antenna'], awning: PAL.cyan },
      { id: 'vinyl', x: 4, y: 17, w: 5, h: 5, label: 'VINYL', wall: '#4a4a94', wallLit: '#5a5aab', roof: '#33306e', roofLit: '#413d84', neon: PAL.violet, roofKind: 'flat', extras: ['rooftopGarden'], awning: PAL.violet },
      { id: 'gtr', x: 37, y: 4, w: 6, h: 6, label: 'GUITARS', wall: '#8a5a72', wallLit: '#a06b85', roof: '#5a3550', roofLit: '#6f4463', neon: PAL.yellow, roofKind: 'gable', extras: ['guitarSign', 'chimney'], awning: PAL.yellow },
      { id: 'keys', x: 37, y: 17, w: 6, h: 5, label: 'KEYS', wall: '#6a5a9c', wallLit: '#7d6cb4', roof: '#453a7c', roofLit: '#544894', neon: PAL.pink, roofKind: 'mansard', extras: ['keyTrim'], awning: PAL.pink },
      { id: 'cafe', x: 6, y: 30, w: 6, h: 5, label: 'CAFE', wall: '#4a7a86', wallLit: '#5a919c', roof: '#2f5560', roofLit: '#3c6a75', neon: PAL.mint, roofKind: 'gable', extras: ['cupSign', 'patio', 'chimney'], awning: PAL.mint },
      { id: 'tea', x: 15, y: 30, w: 5, h: 5, label: 'TEA', wall: '#4a6a9c', wallLit: '#5a7db4', roof: '#33487c', roofLit: '#415894', neon: PAL.cyan, roofKind: 'flat', extras: ['patio'], awning: PAL.cyan },
      { id: 'studio', x: 30, y: 30, w: 7, h: 5, label: 'STUDIO', wall: '#5a4a94', wallLit: '#6c5aab', roof: '#3d3078', roofLit: '#4a3c8e', neon: PAL.violet, roofKind: 'mansard', extras: ['antenna', 'speakerRoof'], awning: PAL.violet },
    ],
    fences: [],
  };
}

// B — 강변 레코드 거리 (운하 + 비대칭 코지) ★ 채택안
function layoutB() {
  return {
    label: '강변 레코드 거리',
    seed: 8830,
    spawn: { x: 21, y: 25 },
    water: [
      rect(0, 8, 12, 4), rect(10, 10, 8, 4), rect(16, 12, 10, 4),
      rect(24, 14, 8, 4), rect(30, 16, 10, 4), rect(38, 18, 10, 4),
    ],
    bridges: [rect(13, 10, 3, 4), rect(28, 14, 3, 4), rect(41, 18, 3, 4)],
    streets: [
      rect(6, 2, 3, 8), rect(13, 2, 3, 9), rect(6, 2, 30, 2),
      rect(13, 22, 3, 12), rect(4, 24, 40, 3), rect(28, 18, 3, 9),
      rect(34, 5, 3, 14), rect(20, 27, 3, 8), rect(38, 22, 3, 12),
    ],
    plazas: [rect(16, 27, 12, 7)],
    stage: { x: 37, y: 6, w: 9, h: 7 },
    busking: { x: 19, y: 29, w: 5, h: 4 },
    districts: [
      { block: 1, name: '버스킹 광장', area: rect(16, 26, 13, 9), neon: PAL.pink },
      { block: 2, name: '레코드 거리', area: rect(2, 12, 12, 11), neon: PAL.cyan },
      { block: 3, name: '악기 골목', area: rect(18, 2, 16, 9), neon: PAL.yellow },
      { block: 4, name: '카페 거리', area: rect(31, 22, 15, 12), neon: PAL.mint },
      { block: 5, name: '페스티벌 무대', area: rect(36, 4, 10, 13), neon: PAL.violet },
    ],
    buildings: [
      { id: 'rec', x: 2, y: 13, w: 6, h: 6, label: 'RECORDS', wall: '#4a5a9c', wallLit: '#5c6fb8', roof: '#303a70', roofLit: '#3e4a86', neon: PAL.cyan, roofKind: 'gable', extras: ['discSign', 'antenna', 'stoop'], awning: PAL.cyan },
      { id: 'vinyl', x: 2, y: 19, w: 5, h: 4, label: 'VINYL', wall: '#484a94', wallLit: '#595cab', roof: '#33306e', roofLit: '#413d84', neon: PAL.violet, roofKind: 'flat', extras: ['rooftopGarden'], awning: PAL.violet },
      { id: 'gtr', x: 19, y: 4, w: 6, h: 6, label: 'GUITARS', wall: '#8a5a72', wallLit: '#a26d87', roof: '#5a3550', roofLit: '#71465f', neon: PAL.yellow, roofKind: 'gable', extras: ['guitarSign', 'chimney', 'stoop'], awning: PAL.yellow },
      { id: 'keys', x: 27, y: 4, w: 6, h: 6, label: 'KEYS', wall: '#6a5a9c', wallLit: '#7f6eb8', roof: '#453a7c', roofLit: '#554896', neon: PAL.pink, roofKind: 'mansard', extras: ['keyTrim', 'antenna'], awning: PAL.pink },
      { id: 'radio', x: 37, y: 14, w: 4, h: 4, label: 'RADIO', wall: '#54488e', wallLit: '#6455a4', roof: '#3a3070', roofLit: '#473c84', neon: PAL.cyan, roofKind: 'flat', extras: ['radioTower'], awning: null },
      { id: 'cafe', x: 32, y: 27, w: 6, h: 6, label: 'CAFE', wall: '#4a7a86', wallLit: '#5c939f', roof: '#2f5560', roofLit: '#3d6b77', neon: PAL.mint, roofKind: 'gable', extras: ['cupSign', 'patio', 'chimney', 'stoop'], awning: PAL.mint },
      { id: 'studio', x: 41, y: 26, w: 5, h: 6, label: 'STUDIO', wall: '#5a4a94', wallLit: '#6d5cae', roof: '#3d3078', roofLit: '#4c3d90', neon: PAL.violet, roofKind: 'mansard', extras: ['antenna', 'speakerRoof'], awning: PAL.violet },
      { id: 'tea', x: 6, y: 28, w: 6, h: 6, label: 'TEA', wall: '#4a6a9c', wallLit: '#5c7db4', roof: '#33487c', roofLit: '#42588f', neon: PAL.cyan, roofKind: 'gable', extras: ['patio', 'cupSign'], awning: PAL.cyan },
    ],
    // 앞마당 철제 울타리 (h: 가로, v: 세로)
    fences: [
      { x: 2, y: 23, w: 6, dir: 'h' },
      { x: 32, y: 33, w: 6, dir: 'h' },
      { x: 6, y: 34, w: 6, dir: 'h' },
      { x: 45, y: 26, h: 6, dir: 'v' },
    ],
    // 스트링 라이트 (광장/카페 위를 가로지르는 전구 줄)
    strings: [
      { x1: 16, y1: 27, x2: 27, y2: 30 },
      { x1: 27, y1: 27, x2: 16, y2: 30 },
      { x1: 31, y1: 27, x2: 38, y2: 24 },
      { x1: 19, y1: 3, x2: 33, y2: 3 },
    ],
  };
}

// ------------------------------------------------------------------ 빌드

export function buildVillage(variant = 'A') {
  const L = variant === 'B' ? layoutB() : layoutA();
  const rnd = mulberry32(L.seed);

  // terrain: 0 grass, 1 street, 2 plaza, 3 water, 4 stage, 5 bridge
  const terrain = [];
  for (let y = 0; y < MAP_H; y++) { const row = []; for (let x = 0; x < MAP_W; x++) row.push(0); terrain.push(row); }
  const stamp = (r, c) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++)
      if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) terrain[y][x] = c;
  };
  L.water.forEach((r) => stamp(r, 3));
  L.streets.forEach((r) => stamp(r, 1));
  L.plazas.forEach((r) => stamp(r, 2));
  L.bridges.forEach((r) => stamp(r, 5));
  stamp(L.stage, 4);

  const colliders = [];
  const addCol = (x, y, w, h, tag) => colliders.push({ x, y, w, h, tag });
  L.buildings.forEach((b) => addCol(b.x * T - 8, b.y * T, b.w * T + 16, b.h * T, 'building'));
  addCol(L.stage.x * T + 8, (L.stage.y + 2) * T, L.stage.w * T - 16, (L.stage.h - 2) * T, 'stage');
  addCol(L.busking.x * T + 10, L.busking.y * T + 16, L.busking.w * T - 20, L.busking.h * T - 24, 'busking');
  (L.fences || []).forEach((f) => {
    if (f.dir === 'h') addCol(f.x * T, f.y * T + 20, f.w * T, 8, 'fence');
    else addCol(f.x * T + 12, f.y * T, 8, f.h * T, 'fence');
  });
  L.water.forEach((r) => {
    for (let x = r.x; x < r.x + r.w; x++) {
      const bridged = L.bridges.some((br) => x >= br.x && x < br.x + br.w);
      if (!bridged) addCol(x * T, r.y * T, T, r.h * T, 'water');
    }
  });
  addCol(-T, 0, T, MAP_H * T, 'edge');
  addCol(MAP_W * T, 0, T, MAP_H * T, 'edge');
  addCol(0, -T, MAP_W * T, T, 'edge');
  addCol(0, MAP_H * T, MAP_W * T, T, 'edge');

  const walkable = (tx, ty) => {
    if (tx < 1 || ty < 2 || tx > MAP_W - 2 || ty > MAP_H - 2) return false;
    if (terrain[ty][tx] === 3) return false;
    const px = tx * T + 16, py = ty * T + 24;
    return !colliders.some((c) => px > c.x - 12 && px < c.x + c.w + 12 && py > c.y - 12 && py < c.y + c.h + 12);
  };

  // ---- 소품
  const props = [];
  const occupied = new Set();
  const key = (x, y) => x + ',' + y;
  const place = (type, tx, ty, opt) => {
    if (occupied.has(key(tx, ty)) || !walkable(tx, ty)) return false;
    occupied.add(key(tx, ty));
    props.push(Object.assign({ type, tx, ty }, opt || {}));
    const solid = !['flowerPatch', 'noteRug', 'puddle', 'grate', 'leaves'].includes(type);
    if (solid) addCol(tx * T + 6, ty * T + 14, T - 12, T - 16, type);
    return true;
  };

  // 무대 스피커 스택
  place('speaker', L.stage.x - 1, L.stage.y + L.stage.h - 1);
  place('speaker', L.stage.x + L.stage.w, L.stage.y + L.stage.h - 1);
  place('speaker', L.stage.x - 1, L.stage.y + 1);
  place('speaker', L.stage.x + L.stage.w, L.stage.y + 1);
  // 건물 앞 화단 · 벤치
  L.buildings.forEach((b) => {
    place('flowerPatch', b.x, b.y + b.h);
    place('flowerPatch', b.x + b.w - 1, b.y + b.h);
    if (b.extras && b.extras.indexOf('patio') >= 0) {
      place('cafeTable', b.x + 1, b.y + b.h);
      place('cafeTable', b.x + b.w - 2, b.y + b.h + 1);
    }
  });

  const themes = {
    1: ['micStand', 'benchNeon', 'noteRug', 'lamp', 'crate', 'busTable'],
    2: ['crate', 'discSign', 'lamp', 'benchNeon', 'flowerPatch', 'grate'],
    3: ['ampStack', 'guitarStand', 'lamp', 'crate', 'flowerPatch', 'signPost'],
    4: ['cafeTable', 'planter', 'lamp', 'benchNeon', 'flowerPatch', 'leaves'],
    5: ['speaker', 'lightRig', 'lamp', 'crate', 'flowerPatch', 'signPost'],
  };

  L.districts.forEach((d) => {
    const pool = themes[d.block];
    let tries = 0, made = 0;
    while (tries < 600 && made < 15) {
      tries++;
      const tx = d.area.x + Math.floor(rnd() * d.area.w);
      const ty = d.area.y + Math.floor(rnd() * d.area.h);
      if (tx >= MAP_W || ty >= MAP_H) continue;
      const nearPaved = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = tx + dx, ny = ty + dy;
        return nx > 0 && ny > 0 && nx < MAP_W && ny < MAP_H && (terrain[ny][nx] === 1 || terrain[ny][nx] === 2);
      });
      const type = pool[Math.floor(rnd() * pool.length)];
      const wantsPaved = ['lamp', 'benchNeon', 'cafeTable', 'signPost'].includes(type);
      if (wantsPaved && !nearPaved) continue;
      if (place(type, tx, ty, { neon: d.neon, block: d.block })) made++;
    }
    let t2 = 0, c2 = 0;
    while (t2 < 400 && c2 < 11) {
      t2++;
      const tx = d.area.x + Math.floor(rnd() * d.area.w);
      const ty = d.area.y + Math.floor(rnd() * d.area.h);
      if (tx >= MAP_W || ty >= MAP_H || terrain[ty][tx] !== 0) continue;
      const r = rnd();
      const type = r < 0.5 ? 'tree' : r < 0.72 ? 'bush' : r < 0.88 ? 'flowerPatch' : 'lamp';
      if (place(type, tx, ty, { neon: d.neon, block: d.block, tone: rnd() })) c2++;
    }
  });

  // 물가 가로등 줄
  L.water.forEach((r) => { if (rnd() < 0.9) place('lamp', r.x + 1, r.y - 1, { neon: PAL.lamp }); });

  // ---- 소리 아이템
  const items = [];
  L.districts.forEach((d) => {
    let tries = 0, made = 0;
    while (tries < 900 && made < 8) {
      tries++;
      const tx = d.area.x + Math.floor(rnd() * d.area.w);
      const ty = d.area.y + Math.floor(rnd() * d.area.h);
      if (tx >= MAP_W || ty >= MAP_H || !walkable(tx, ty) || occupied.has(key(tx, ty))) continue;
      if (items.some((it) => Math.abs(it.tx - tx) < 3 && Math.abs(it.ty - ty) < 3)) continue;
      occupied.add(key(tx, ty));
      items.push({
        id: 'Music_' + (100000 + Math.floor(rnd() * 899999)),
        tx, ty, block: d.block, neon: d.neon,
        cat: ['Musical instrument', 'Percussion', 'Plucked string', 'Keyboard', 'Singing', 'Brass'][Math.floor(rnd() * 6)],
        kind: rnd() < 0.5 ? 'note' : 'tape',
        phase: rnd() * Math.PI * 2,
        collected: false,
      });
      made++;
    }
  });

  return {
    variant, label: L.label, terrain, colliders, props, items,
    districts: L.districts, buildings: L.buildings, stage: L.stage, busking: L.busking,
    water: L.water, bridges: L.bridges, fences: L.fences || [], strings: L.strings || [],
    spawn: { x: L.spawn.x * T + 16, y: L.spawn.y * T + 20 },
    walkable,
  };
}

// ------------------------------------------------------------------ 충돌

export const PLAYER_BOX = { w: 20, h: 14 };

export function collides(v, cx, cy) {
  const half = PLAYER_BOX.w / 2;
  const x0 = cx - half, x1 = cx + half, y0 = cy - PLAYER_BOX.h, y1 = cy;
  for (const c of v.colliders) if (x1 > c.x && x0 < c.x + c.w && y1 > c.y && y0 < c.y + c.h) return c;
  return null;
}

export function moveWithCollision(v, pos, dx, dy) {
  let nx = pos.x, ny = pos.y;
  if (dx && !collides(v, pos.x + dx, ny)) nx = pos.x + dx;
  if (dy && !collides(v, nx, pos.y + dy)) ny = pos.y + dy;
  return { x: nx, y: ny };
}

// ------------------------------------------------------------------ 드로잉 헬퍼

const px = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function glow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}

function pixelText(ctx, str, x, y, color, size) {
  ctx.font = 'bold ' + (size || 10) + 'px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}

// ============================ 건물 조형 (레퍼런스: 밤 마을 저택/상점) ==========
// 핵심: 직선 박스가 아니라 (1) 넓게 흘러내리는 곡면 맨사드 지붕, (2) 비대칭 타워 베이,
// (3) 아치형 창 + 셔터, (4) 오목한 현관 포치, (5) 돌 코너 블록으로 실루엣을 깬다.

// 계단식 아치 캡 — 픽셀 아트의 둥근 상단
function archCap(ctx, x, y, w, color) {
  const steps = [
    [0.10, 4], [0.22, 3], [0.36, 3], [0.5, 2],
  ];
  let cy = y;
  steps.forEach(([inset, hh]) => {
    px(ctx, x + w * inset, cy, w * (1 - inset * 2), hh, color);
    cy += hh;
  });
  return cy - y;
}

// 아치형 창 + 셔터 + 창대
function archWindow(ctx, x, y, w, h, lit, wall, wallLit) {
  const frame = '#241f4a';
  const capH = 12;
  // 아치 프레임
  px(ctx, x - 3, y + capH - 2, w + 6, h - capH + 5, frame);
  archCap(ctx, x - 3, y - 2, w + 6, frame);
  // 유리
  const glass = lit ? PAL.warm : '#2f2b58';
  px(ctx, x, y + capH, w, h - capH, glass);
  archCap(ctx, x, y + 1, w, glass);
  if (lit) {
    px(ctx, x + 2, y + capH, w - 4, 3, '#ffe4b8');
    px(ctx, x + 2, y + h - 6, w - 4, 3, 'rgba(255,180,92,0.55)');
  }
  // 창살
  px(ctx, x + w / 2 - 1, y + 4, 2, h - 4, frame);
  px(ctx, x, y + capH + 10, w, 2, frame);
  px(ctx, x, y + h - 14, w, 2, frame);
  // 창대 + 인방
  px(ctx, x - 6, y + h - 2, w + 12, 5, wallLit);
  px(ctx, x - 6, y + h + 3, w + 12, 3, 'rgba(20,16,48,0.4)');
  // 셔터 (슬랫)
  [[x - 12, 1], [x + w + 3, -1]].forEach(([sx]) => {
    px(ctx, sx, y + capH - 4, 9, h - capH + 6, '#332c5e');
    px(ctx, sx, y + capH - 4, 9, 2, '#463d7a');
    for (let i = 0; i < h - capH; i += 5) px(ctx, sx + 1, y + capH + i, 7, 2, '#241f4a');
  });
}

// 원형 창 (오쿨루스)
function oculus(ctx, cx, cy, r, lit) {
  px(ctx, cx - r - 2, cy - r + 2, (r + 2) * 2, r * 2 - 4, '#241f4a');
  px(ctx, cx - r + 2, cy - r - 2, r * 2 - 4, (r + 2) * 2, '#241f4a');
  px(ctx, cx - r, cy - r + 3, r * 2, r * 2 - 6, lit ? PAL.warm : '#332c5e');
  px(ctx, cx - r + 3, cy - r, r * 2 - 6, r * 2, lit ? PAL.warm : '#332c5e');
  px(ctx, cx - r, cy - 1, r * 2, 2, '#241f4a');
  px(ctx, cx - 1, cy - r, 2, r * 2, '#241f4a');
}

// 지붕널 — 대각 엇갈림 결
function shingleField(ctx, x, y, w, h, c1, c2) {
  for (let ry = 0; ry < h; ry += 6) {
    px(ctx, x, y + ry, w, 6, (ry / 6) % 2 ? c1 : c2);
    px(ctx, x, y + ry, w, 1, 'rgba(20,16,48,0.28)');
    const off = ((ry / 6) % 2) ? 0 : 7;
    for (let rx = off; rx < w; rx += 14) px(ctx, x + rx, y + ry + 1, 1, 5, 'rgba(20,16,48,0.22)');
  }
}

// 곡면 맨사드 지붕 덩어리: 아래로 갈수록 급격히 넓어지는 오목 실루엣 + 넓은 처마
function mansardMass(ctx, x, y, w, h, roof, roofLit, opts) {
  const o = opts || {};
  const rows = Math.max(6, Math.round(h / 6));
  const rh = h / rows;
  const topInset = o.topInset != null ? o.topInset : 0.3;
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    // 오목 곡선(ease-in): 위는 좁고 완만, 아래에서 빠르게 벌어진다
    const inset = topInset * (1 - Math.pow(t, 2.2));
    const rx = x + w * inset, rw = w * (1 - inset * 2);
    px(ctx, rx, y + i * rh, rw, rh + 1, i % 2 ? roof : roofLit);
    px(ctx, rx, y + i * rh, rw, 1, 'rgba(20,16,48,0.26)');
    if (i % 2 === 0) for (let sx = 6; sx < rw; sx += 14) px(ctx, rx + sx, y + i * rh + 1, 1, rh, 'rgba(20,16,48,0.2)');
    // 곡면 하이라이트
    if (i < rows / 2) px(ctx, rx + 3, y + i * rh, 4, rh, 'rgba(246,239,255,0.07)');
  }
  // 넓은 처마 (좌우로 크게 흘러나온다)
  const eaveY = y + h - 4;
  px(ctx, x - 12, eaveY, w + 24, 9, roofLit);
  px(ctx, x - 12, eaveY, w + 24, 2, 'rgba(246,239,255,0.2)');
  px(ctx, x - 16, eaveY + 5, w + 32, 6, roof);
  px(ctx, x - 16, eaveY + 11, w + 32, 4, 'rgba(20,16,48,0.45)');
  // 처마 밑 서까래
  for (let i = 0; i < w + 32; i += 12) px(ctx, x - 16 + i, eaveY + 11, 5, 4, 'rgba(20,16,48,0.3)');
  // 지붕 마루 장식
  px(ctx, x + w * topInset, y - 4, w * (1 - topInset * 2), 5, roofLit);
  for (let i = 0; i < w * (1 - topInset * 2); i += 10) px(ctx, x + w * topInset + i, y - 8, 3, 5, roof);
}

// 뾰족 지붕 (타워/박공용) — 계단식 삼각 + 치마 처마
function spireMass(ctx, x, y, w, h, roof, roofLit) {
  const rows = Math.max(6, Math.round(h / 5));
  const rh = h / rows;
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const inset = 0.46 * (1 - Math.pow(t, 1.7));
    const rx = x + w * inset, rw = w * (1 - inset * 2);
    px(ctx, rx, y + i * rh, rw, rh + 1, i % 2 ? roof : roofLit);
    px(ctx, rx, y + i * rh, rw, 1, 'rgba(20,16,48,0.26)');
  }
  px(ctx, x - 8, y + h - 4, w + 16, 8, roofLit);
  px(ctx, x - 10, y + h + 3, w + 20, 5, roof);
  px(ctx, x - 10, y + h + 8, w + 20, 3, 'rgba(20,16,48,0.45)');
}

// 지붕창 (도머)
function dormer(ctx, x, y, w, h, roof, roofLit, lit) {
  px(ctx, x, y + 8, w, h, roofLit);
  spireMass(ctx, x - 3, y - 10, w + 6, 20, roof, roofLit);
  const gw = Math.max(10, w - 14);
  px(ctx, x + (w - gw) / 2, y + 14, gw, h - 16, lit ? PAL.warm : '#2f2b58');
  px(ctx, x + (w - gw) / 2 - 2, y + 12, gw + 4, 3, '#241f4a');
  px(ctx, x + w / 2 - 1, y + 14, 2, h - 16, '#241f4a');
}

// 돌 코너 블록 (퀀) — 벽 실루엣을 어긋나게
function quoins(ctx, x, y, h, wallLit, side) {
  for (let i = 0; i < h; i += 18) {
    const wide = (i / 18) % 2 === 0;
    const bw = wide ? 12 : 8;
    px(ctx, side === 'l' ? x : x + 12 - bw, y + i, bw, 16, wallLit);
    px(ctx, side === 'l' ? x : x + 12 - bw, y + i, bw, 2, 'rgba(246,239,255,0.16)');
    px(ctx, side === 'l' ? x : x + 12 - bw, y + i + 14, bw, 2, 'rgba(20,16,48,0.35)');
  }
}

// 오목한 포치 + 계단 + 난간 + 랜턴
function porch(ctx, cx, baseY, wallDark, wallLit, on) {
  const w = 62;
  // 오목한 벽감
  px(ctx, cx - w / 2, baseY - 62, w, 62, wallDark);
  px(ctx, cx - w / 2, baseY - 62, w, 4, 'rgba(20,16,48,0.5)');
  px(ctx, cx - w / 2, baseY - 62, 4, 62, 'rgba(20,16,48,0.4)');
  px(ctx, cx + w / 2 - 4, baseY - 62, 4, 62, 'rgba(20,16,48,0.4)');
  // 문 (아치)
  const dw = 30;
  px(ctx, cx - dw / 2, baseY - 48, dw, 48, '#5a3f4e');
  archCap(ctx, cx - dw / 2, baseY - 56, dw, '#5a3f4e');
  px(ctx, cx - dw / 2 + 3, baseY - 44, dw - 6, 40, '#6e4d5e');
  px(ctx, cx - 1, baseY - 48, 2, 44, '#4a3341');
  px(ctx, cx + dw / 2 - 8, baseY - 26, 4, 4, PAL.yellow);
  if (on) {
    px(ctx, cx - 8, baseY - 60, 16, 6, PAL.warm);
    glow(ctx, cx, baseY - 40, 46, PAL.warm, 0.22);
  }
  // 랜턴 2개
  [-w / 2 + 6, w / 2 - 12].forEach((ox) => {
    px(ctx, cx + ox, baseY - 52, 7, 4, '#2a2450');
    px(ctx, cx + ox, baseY - 48, 7, 10, on ? PAL.lamp : '#3f3868');
    px(ctx, cx + ox + 1, baseY - 38, 5, 3, '#2a2450');
    if (on) glow(ctx, cx + ox + 4, baseY - 44, 22, PAL.lamp, 0.4);
  });
  // 계단 + 난간
  for (let i = 0; i < 4; i++) {
    px(ctx, cx - 24 + i * 2, baseY + i * 6, 48 - i * 4, 7, i % 2 ? wallLit : wallDark);
    px(ctx, cx - 24 + i * 2, baseY + i * 6, 48 - i * 4, 2, 'rgba(246,239,255,0.12)');
  }
  [-30, 24].forEach((ox) => {
    px(ctx, cx + ox, baseY - 6, 6, 30, wallLit);
    px(ctx, cx + ox, baseY - 10, 6, 5, 'rgba(246,239,255,0.18)');
  });
}

function neonSign(ctx, x, y, w, label, neon, on) {
  px(ctx, x, y, w, 20, PAL.ink);
  px(ctx, x, y, w, 2, neon);
  px(ctx, x, y + 18, w, 2, neon);
  px(ctx, x, y, 2, 20, neon);
  px(ctx, x + w - 2, y, 2, 20, neon);
  pixelText(ctx, label, x + (w - label.length * 7.2) / 2, y + 6, on ? PAL.white : '#6a5f96', 11);
  if (on) glow(ctx, x + w / 2, y + 10, w * 0.85, neon, 0.34);
}

function stripedAwning(ctx, x, y, w, color) {
  px(ctx, x - 3, y, w + 6, 4, '#241f4a');
  for (let i = 0; i < w + 6; i += 10) {
    px(ctx, x - 3 + i, y + 4, 5, 11, color);
    px(ctx, x + 2 + i, y + 4, 5, 11, '#f3eaff');
  }
  px(ctx, x - 3, y + 15, w + 6, 3, 'rgba(20,16,48,0.35)');
  for (let i = 0; i < w + 6; i += 10) px(ctx, x - 3 + i + 2, y + 18, 6, 3, i % 20 ? color : '#f3eaff');
}

function drawExtras(ctx, b, on) {
  const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
  const top = y - 22; // 지붕 마루 근처
  (b.extras || []).forEach((e) => {
    if (e === 'antenna') {
      px(ctx, x + w - 30, top - 26, 3, 28, '#2f2a58');
      px(ctx, x + w - 36, top - 26, 15, 3, '#2f2a58');
      px(ctx, x + w - 31, top - 32, 5, 5, on ? PAL.pink : '#4a4270');
      if (on) glow(ctx, x + w - 28, top - 30, 22, PAL.pink, 0.35);
    } else if (e === 'chimney') {
      px(ctx, x + 16, top - 22, 20, 34, '#5a4d7a');
      px(ctx, x + 16, top - 22, 20, 4, '#6f6094');
      for (let i = 0; i < 34; i += 8) px(ctx, x + 16, top - 22 + i, 20, 1, 'rgba(20,16,48,0.3)');
      px(ctx, x + 13, top - 27, 26, 6, '#43385f');
      ctx.globalAlpha = 0.22;
      px(ctx, x + 22, top - 44, 9, 9, '#cfc3ee'); px(ctx, x + 29, top - 58, 11, 10, '#cfc3ee');
      ctx.globalAlpha = 1;
    } else if (e === 'radioTower') {
      const tx = x + w / 2;
      for (let i = 0; i < 5; i++) {
        px(ctx, tx - 10 + i * 2, top - 18 - i * 14, 3, 16, '#3a3468');
        px(ctx, tx + 7 - i * 2, top - 18 - i * 14, 3, 16, '#3a3468');
        px(ctx, tx - 10 + i * 2, top - 18 - i * 14, 18 - i * 4, 3, '#4a4280');
      }
      px(ctx, tx - 4, top - 94, 7, 7, on ? PAL.cyan : '#4a4270');
      if (on) { glow(ctx, tx, top - 90, 40, PAL.cyan, 0.4); glow(ctx, tx, top - 90, 90, PAL.cyan, 0.12); }
    } else if (e === 'discSign') {
      const sx = x + w + 10, sy = y + 54;
      px(ctx, sx - 2, sy + 10, 5, 40, '#2f2a58');
      px(ctx, sx - 14, sy - 16, 30, 30, PAL.ink);
      px(ctx, sx - 10, sy - 12, 22, 22, b.neon);
      px(ctx, sx - 2, sy - 4, 8, 8, PAL.ink);
      if (on) glow(ctx, sx, sy - 2, 36, b.neon, 0.3);
    } else if (e === 'guitarSign') {
      const sx = x + w + 12, sy = y + 60;
      px(ctx, sx - 2, sy + 8, 5, 40, '#2f2a58');
      px(ctx, sx - 11, sy - 6, 24, 22, '#c4552f');
      px(ctx, sx - 4, sy - 22, 7, 18, '#8a5a3a');
      px(ctx, sx - 3, sy + 1, 8, 8, '#3a1d12');
      if (on) glow(ctx, sx, sy, 30, PAL.yellow, 0.22);
    } else if (e === 'cupSign') {
      const sx = x - 16, sy = y + 62;
      px(ctx, sx + 4, sy + 8, 5, 36, '#2f2a58');
      px(ctx, sx - 10, sy - 12, 30, 24, PAL.ink);
      px(ctx, sx - 4, sy - 7, 15, 14, '#f3eaff');
      px(ctx, sx + 12, sy - 3, 5, 6, '#f3eaff');
      if (on) glow(ctx, sx + 4, sy, 32, PAL.mint, 0.26);
    } else if (e === 'rooftopGarden') {
      for (let i = 0; i < w - 20; i += 16) {
        px(ctx, x + 12 + i, top + 2, 12, 13, '#2f6f5c');
        px(ctx, x + 14 + i, top - 3, 8, 7, '#3d8d74');
      }
    } else if (e === 'speakerRoof') {
      px(ctx, x + w - 50, top - 20, 22, 28, '#2b2450');
      px(ctx, x + w - 46, top - 15, 14, 12, '#171338');
      px(ctx, x + w - 46, top - 1, 14, 6, '#171338');
      if (on) glow(ctx, x + w - 39, top - 8, 26, PAL.violet, 0.24);
    }
  });
}

// 비대칭 덩어리 조합: 낮은 측면 윙 + 본체 + 타워 베이
function drawBuilding(ctx, b, on) {
  const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
  const side = (b.x % 2 === 0) ? 'l' : 'r';           // 타워 위치를 건물마다 다르게
  const towerW = 58;
  const wallTop = y + 34;
  const wallH = h - 34;
  const wallDark = 'rgba(20,16,48,0.34)';

  // 접지 그림자 — 우하단으로 흐르게
  ctx.globalAlpha = 0.36;
  px(ctx, x + 14, y + h - 6, w + 16, 16, '#181441');
  ctx.globalAlpha = 1;

  // ---- 낮은 측면 윙 (본체보다 한 단 낮고 좁게 삐져나온다)
  const wingW = 44;
  const wingX = side === 'l' ? x + w - 10 : x - wingW + 10;
  const wingTop = wallTop + 40;
  px(ctx, wingX, wingTop, wingW, y + h - wingTop, b.wall);
  px(ctx, wingX, wingTop, wingW, 3, b.wallLit);
  px(ctx, side === 'l' ? wingX + wingW - 6 : wingX, wingTop, 6, y + h - wingTop, wallDark);
  mansardMass(ctx, wingX - 4, wingTop - 26, wingW + 8, 30, b.roof, b.roofLit, { topInset: 0.22 });
  archWindow(ctx, wingX + wingW / 2 - 11, wingTop + 26, 22, 30, on && (b.x % 3 !== 0), b.wall, b.wallLit);

  // ---- 본체 벽
  px(ctx, x, wallTop, w, wallH, b.wall);
  for (let ry = 0; ry < wallH; ry += 9) {
    px(ctx, x, wallTop + ry, w, 1, 'rgba(20,16,48,0.14)');
    for (let rx = (ry / 9) % 2 ? 0 : 9; rx < w; rx += 18) px(ctx, x + rx, wallTop + ry, 1, 9, 'rgba(20,16,48,0.1)');
  }
  px(ctx, x, wallTop, 5, wallH, b.wallLit);
  px(ctx, x + w - 7, wallTop, 7, wallH, wallDark);
  // 기단(석재)
  px(ctx, x - 3, y + h - 16, w + 6, 16, b.roof);
  px(ctx, x - 3, y + h - 16, w + 6, 3, b.wallLit);
  for (let i = 0; i < w + 6; i += 14) px(ctx, x - 3 + i, y + h - 16, 1, 16, 'rgba(20,16,48,0.3)');
  quoins(ctx, x, wallTop, wallH - 16, b.wallLit, 'l');
  quoins(ctx, x + w - 12, wallTop, wallH - 16, b.wallLit, 'r');

  // ---- 아치창 배열 (타워 쪽은 비워둔다)
  const zoneX = side === 'l' ? x + towerW - 6 : x + 14;
  const zoneW = w - towerW - 8;
  const cols = zoneW > 130 ? 3 : 2;
  const rows = wallH > 118 ? 2 : 1;
  const cw = zoneW / cols;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const wx = zoneX + c * cw + (cw - 24) / 2;
      const wy = wallTop + 18 + r * 56;
      if (wy + 42 > y + h - 24) continue;
      const lit = ((c + r * 2 + b.x) % 4) !== 0;
      archWindow(ctx, wx, wy, 24, 40, on && lit, b.wall, b.wallLit);
      if (on && lit) glow(ctx, wx + 12, wy + 20, 44, PAL.warm, 0.12);
    }

  // ---- 어닝 + 간판 (상점 성격)
  if (b.awning) stripedAwning(ctx, x + 8, y + h - 60, w - 16, b.awning);
  const sw = Math.min(w - 26, b.label.length * 9 + 24);
  neonSign(ctx, x + (w - sw) / 2, y + h - 98, sw, b.label, b.neon, on);

  // ---- 포치 (본체 중앙보다 타워 반대편으로 살짝 치우침)
  const porchX = side === 'l' ? x + w * 0.62 : x + w * 0.38;
  porch(ctx, porchX, y + h - 14, b.roof, b.wallLit, on);

  // ---- 본체 지붕: 곡면 맨사드 + 도머
  mansardMass(ctx, x - 6, y - 14, w + 12, 56, b.roof, b.roofLit, { topInset: 0.16 });
  dormer(ctx, x + w * (side === 'l' ? 0.58 : 0.26), y + 2, 32, 26, b.roof, b.roofLit, on && b.x % 2 === 0);

  // ---- 타워 베이 (본체보다 높고 앞으로 튀어나온다)
  const tx = side === 'l' ? x - 10 : x + w - towerW + 10;
  const towerTop = y + 4;
  px(ctx, tx, towerTop, towerW, y + h - towerTop, b.wallLit);
  px(ctx, tx, towerTop, 5, y + h - towerTop, 'rgba(246,239,255,0.14)');
  px(ctx, tx + towerW - 8, towerTop, 8, y + h - towerTop, wallDark);
  for (let ry = 0; ry < y + h - towerTop; ry += 9) px(ctx, tx, towerTop + ry, towerW, 1, 'rgba(20,16,48,0.14)');
  quoins(ctx, tx, towerTop + 40, y + h - towerTop - 56, b.wallLit, 'l');
  quoins(ctx, tx + towerW - 12, towerTop + 40, y + h - towerTop - 56, b.wallLit, 'r');
  oculus(ctx, tx + towerW / 2, towerTop + 26, 12, false);
  archWindow(ctx, tx + towerW / 2 - 13, towerTop + 50, 26, 46, on, b.wall, b.wallLit);
  if (h > 170) archWindow(ctx, tx + towerW / 2 - 11, towerTop + 108, 22, 36, on && b.x % 3 !== 1, b.wall, b.wallLit);
  spireMass(ctx, tx - 5, towerTop - 44, towerW + 10, 48, b.roof, b.roofLit);
  px(ctx, tx + towerW / 2 - 2, towerTop - 60, 4, 18, '#2f2a58');
  px(ctx, tx + towerW / 2 - 6, towerTop - 66, 12, 6, b.neon);
  if (on) glow(ctx, tx + towerW / 2, towerTop - 62, 26, b.neon, 0.3);

  drawExtras(ctx, b, on);
}

// 축제 무대 — 트러스 + 백드롭 + 스포트라이트
function drawStage(ctx, s, on) {
  const x = s.x * T, y = s.y * T, w = s.w * T, h = s.h * T;
  ctx.globalAlpha = 0.35; px(ctx, x + 10, y + h - 2, w + 10, 14, '#181441'); ctx.globalAlpha = 1;
  // 바닥
  px(ctx, x, y + T * 1.4, w, h - T * 1.4, '#5b3f7e');
  for (let i = 0; i < w; i += 16) px(ctx, x + i, y + T * 1.4, 8, h - T * 1.4, 'rgba(255,255,255,0.045)');
  px(ctx, x, y + T * 1.4, w, 5, '#7355a0');
  px(ctx, x, y + h - 10, w, 10, 'rgba(20,16,48,0.35)');
  // 백드롭
  px(ctx, x + 6, y, w - 12, T * 1.5, '#33265c');
  px(ctx, x + 6, y, w - 12, 4, '#4a3a7c');
  for (let i = 0; i < w - 12; i += 12) px(ctx, x + 6 + i, y + 8, 6, T * 1.5 - 16, 'rgba(255,255,255,0.03)');
  pixelText(ctx, 'LIVE', x + w / 2 - 20, y + 14, on ? PAL.pink : '#5b4f86', 16);
  if (on) glow(ctx, x + w / 2, y + 22, 80, PAL.pink, 0.3);
  // 상단 트러스 + 조명
  px(ctx, x - 4, y - 16, w + 8, 8, '#3a3468');
  for (let i = 0; i < w + 8; i += 14) px(ctx, x - 4 + i, y - 16, 6, 8, '#4a4280');
  [PAL.cyan, PAL.yellow, PAL.pink, PAL.mint].forEach((c, i) => {
    const lx = x + 18 + i * (w - 36) / 3;
    px(ctx, lx - 6, y - 8, 12, 9, '#2b2450');
    px(ctx, lx - 4, y + 1, 8, 4, on ? c : '#4a4270');
    if (on) {
      glow(ctx, lx, y + 4, 30, c, 0.3);
      ctx.globalAlpha = 0.09; ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(lx - 5, y + 4); ctx.lineTo(lx + 46, y + h); ctx.lineTo(lx - 56, y + h); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
  // 계단 + 스피커 단
  px(ctx, x + w / 2 - 28, y + h, 56, 9, '#4a3a72');
  px(ctx, x + w / 2 - 22, y + h + 9, 44, 8, '#413162');
  // 깃발
  [x + 4, x + w - 10].forEach((fx, i) => {
    px(ctx, fx, y - 44, 4, 32, '#2f2a58');
    px(ctx, fx + 4, y - 42, 18, 12, i ? PAL.cyan : PAL.pink);
  });
}

// 버스킹 광장 정자 — 팔각 단 + 지붕 + 스트링 라이트
function drawBusking(ctx, b, on) {
  const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
  ctx.globalAlpha = 0.35; px(ctx, x + 8, y + h - 4, w + 10, 14, '#181441'); ctx.globalAlpha = 1;
  // 단
  px(ctx, x + 6, y + h - 40, w - 12, 34, '#5e4a8c');
  px(ctx, x + 12, y + h - 46, w - 24, 12, '#6f57a2');
  px(ctx, x + 12, y + h - 46, w - 24, 4, '#8368bb');
  for (let i = 0; i < w - 24; i += 10) px(ctx, x + 12 + i, y + h - 34, 5, 28, 'rgba(20,16,48,0.14)');
  // 기둥
  [x + 10, x + w - 18].forEach((cx) => {
    px(ctx, cx, y + 14, 8, h - 54, '#4a4278');
    px(ctx, cx, y + 14, 3, h - 54, '#5d5490');
  });
  // 지붕 (원뿔형 계단)
  for (let i = 0; i < 5; i++) {
    const inset = i * (w / 12);
    px(ctx, x + 2 + inset, y + i * 7, w - 4 - inset * 2, 8, i % 2 ? '#4a3a7c' : '#5a4894');
  }
  px(ctx, x - 2, y + 30, w + 4, 7, '#5a4894');
  px(ctx, x - 2, y + 30, w + 4, 2, 'rgba(255,255,255,0.16)');
  px(ctx, x + w / 2 - 3, y - 14, 6, 16, '#3a3468');
  px(ctx, x + w / 2 - 7, y - 20, 14, 7, on ? PAL.pink : '#4a4270');
  if (on) glow(ctx, x + w / 2, y - 16, 46, PAL.pink, 0.3);
  // 마이크 + 앰프
  px(ctx, x + w / 2 - 2, y + h - 62, 3, 24, '#4a3a68');
  px(ctx, x + w / 2 - 7, y + h - 70, 12, 11, '#6a5a90');
  px(ctx, x + 18, y + h - 32, 22, 22, '#2b2450');
  px(ctx, x + 22, y + h - 28, 14, 13, '#171338');
  if (on) glow(ctx, x + w / 2, y + h - 60, 44, PAL.cyan, 0.16);
}

// ------------------------------------------------------------------ 소품

const PROP_DRAW = {
  // 레퍼런스형 장식 가로등 — 빛 웅덩이는 별도 패스에서
  lamp(ctx, x, y, p, on) {
    px(ctx, x + 12, y + 22, 8, 8, '#2a2450');
    px(ctx, x + 14, y - 14, 4, 38, '#332d5e');
    px(ctx, x + 15, y - 14, 1, 38, '#484078');
    px(ctx, x + 9, y - 12, 14, 4, '#332d5e');
    px(ctx, x + 11, y - 26, 10, 14, on ? PAL.lamp : '#3f3868');
    px(ctx, x + 10, y - 29, 12, 4, '#2a2450');
    px(ctx, x + 14, y - 33, 4, 5, '#332d5e');
    if (on) { glow(ctx, x + 16, y - 19, 34, PAL.lamp, 0.42); glow(ctx, x + 16, y - 19, 76, PAL.warm, 0.1); }
  },
  speaker(ctx, x, y, p, on) {
    px(ctx, x + 3, y - 16, 26, 48, '#262042');
    px(ctx, x + 3, y - 16, 26, 4, '#3a3260');
    px(ctx, x + 8, y - 10, 16, 16, '#141130');
    px(ctx, x + 8, y + 10, 16, 12, '#141130');
    px(ctx, x + 13, y - 5, 6, 6, on ? PAL.pink : '#382f58');
    px(ctx, x + 3, y + 28, 26, 4, 'rgba(20,16,48,0.4)');
    if (on) glow(ctx, x + 16, y + 4, 30, PAL.pink, 0.16);
  },
  ampStack(ctx, x, y, p, on) {
    px(ctx, x + 2, y - 10, 28, 42, '#2f2549');
    px(ctx, x + 6, y - 5, 20, 18, '#191338');
    px(ctx, x + 6, y + 17, 20, 7, '#443869');
    px(ctx, x + 24, y + 19, 3, 3, on ? PAL.yellow : '#4a3a2a');
    px(ctx, x + 2, y + 28, 28, 4, 'rgba(20,16,48,0.35)');
  },
  crate(ctx, x, y) {
    px(ctx, x + 3, y + 2, 26, 26, PAL.wood);
    px(ctx, x + 3, y + 2, 26, 4, PAL.woodLit);
    px(ctx, x + 6, y + 8, 20, 18, '#332a52');
    for (let i = 0; i < 4; i++) px(ctx, x + 7 + i * 5, y + 8, 3, 18, i % 2 ? '#6d5aa0' : '#8f6fc4');
    px(ctx, x + 3, y + 26, 26, 3, 'rgba(20,16,48,0.35)');
  },
  discSign(ctx, x, y, p, on) {
    px(ctx, x + 15, y + 10, 3, 22, '#332d5e');
    px(ctx, x + 5, y - 10, 22, 22, PAL.ink);
    px(ctx, x + 9, y - 6, 14, 14, p.neon || PAL.cyan);
    px(ctx, x + 14, y - 1, 4, 4, PAL.ink);
    if (on) glow(ctx, x + 16, y, 30, p.neon || PAL.cyan, 0.24);
  },
  guitarStand(ctx, x, y) {
    px(ctx, x + 8, y + 24, 16, 4, '#2b2450');
    px(ctx, x + 14, y - 6, 4, 28, '#8a5a3a');
    px(ctx, x + 7, y + 10, 18, 16, '#c4552f');
    px(ctx, x + 12, y + 15, 8, 7, '#3a1d12');
  },
  micStand(ctx, x, y, p, on) {
    px(ctx, x + 9, y + 26, 14, 4, '#2b2450');
    px(ctx, x + 15, y - 4, 3, 30, '#4a3a68');
    px(ctx, x + 11, y - 12, 11, 11, '#6a5a90');
    if (on) glow(ctx, x + 16, y - 7, 26, PAL.pink, 0.2);
  },
  benchNeon(ctx, x, y, p, on) {
    px(ctx, x + 1, y + 12, 30, 8, PAL.wood);
    px(ctx, x + 1, y + 4, 30, 6, PAL.woodLit);
    px(ctx, x + 3, y + 20, 4, 9, '#2b2450');
    px(ctx, x + 25, y + 20, 4, 9, '#2b2450');
    px(ctx, x + 1, y + 10, 30, 2, on ? (p.neon || PAL.mint) : '#3a3260');
    px(ctx, x + 1, y + 28, 30, 3, 'rgba(20,16,48,0.3)');
  },
  cafeTable(ctx, x, y, p, on) {
    px(ctx, x + 14, y + 16, 4, 12, '#3a3260');
    px(ctx, x + 4, y + 9, 24, 8, '#e9dcc8');
    px(ctx, x + 4, y + 9, 24, 3, '#fff6e8');
    px(ctx, x + 12, y + 3, 8, 6, on ? PAL.mint : '#4a5a58');
    px(ctx, x, y + 12, 5, 8, '#5a4a7c');
    px(ctx, x + 27, y + 12, 5, 8, '#5a4a7c');
    px(ctx, x + 4, y + 26, 24, 3, 'rgba(20,16,48,0.3)');
  },
  busTable(ctx, x, y, p, on) {
    px(ctx, x + 4, y + 8, 24, 16, '#4a3a72');
    px(ctx, x + 4, y + 8, 24, 4, '#5c4a8c');
    px(ctx, x + 8, y + 2, 7, 7, on ? PAL.yellow : '#4a4270');
    px(ctx, x + 18, y + 2, 7, 7, on ? PAL.cyan : '#4a4270');
  },
  planter(ctx, x, y) {
    px(ctx, x + 5, y + 14, 22, 14, '#7c5a63');
    px(ctx, x + 5, y + 14, 22, 3, PAL.woodLit);
    px(ctx, x + 7, y + 2, 18, 14, '#2f6f5c');
    px(ctx, x + 11, y + 6, 7, 6, '#3d8d74');
    px(ctx, x + 16, y + 3, 5, 5, PAL.pink);
  },
  flowerPatch(ctx, x, y, p) {
    px(ctx, x + 3, y + 15, 26, 12, '#33325f');
    [[7, 13], [15, 18], [22, 12], [11, 21]].forEach(([ox, oy], i) => {
      px(ctx, x + ox, y + oy, 5, 5, [PAL.pink, PAL.yellow, PAL.cyan, PAL.mint][i]);
      px(ctx, x + ox + 1, y + oy + 5, 2, 4, '#2f6f5c');
    });
  },
  bush(ctx, x, y, p) {
    const t = p.tone || 0.4;
    px(ctx, x + 3, y + 24, 26, 5, 'rgba(20,16,48,0.32)');
    px(ctx, x + 4, y + 10, 24, 16, t > 0.5 ? '#4a3f7a' : '#3a5a6e');
    px(ctx, x + 8, y + 5, 16, 10, t > 0.5 ? '#5b4d92' : '#456b80');
    px(ctx, x + 12, y + 8, 6, 5, t > 0.5 ? '#6f5eab' : '#547f96');
  },
  leaves(ctx, x, y) {
    [[6, 10], [16, 16], [24, 8], [12, 22]].forEach(([ox, oy], i) => px(ctx, x + ox, y + oy, 4, 3, i % 2 ? '#6b5a92' : '#7a6aa1'));
  },
  grate(ctx, x, y) {
    px(ctx, x + 8, y + 12, 16, 12, '#302a54');
    for (let i = 0; i < 4; i++) px(ctx, x + 9 + i * 4, y + 13, 2, 10, '#443c6e');
  },
  signPost(ctx, x, y, p, on) {
    px(ctx, x + 14, y + 6, 4, 24, '#332d5e');
    px(ctx, x + 3, y - 6, 26, 10, p.neon || PAL.yellow);
    px(ctx, x + 5, y + 6, 22, 8, '#f3eaff');
    if (on) glow(ctx, x + 16, y, 26, p.neon || PAL.yellow, 0.22);
  },
  noteRug(ctx, x, y, p) {
    ctx.globalAlpha = 0.3;
    px(ctx, x + 1, y + 8, 30, 20, p.neon || PAL.violet);
    ctx.globalAlpha = 1;
    px(ctx, x + 8, y + 14, 6, 6, p.neon || PAL.violet);
    px(ctx, x + 18, y + 12, 6, 8, p.neon || PAL.violet);
  },
  lightRig(ctx, x, y, p, on) {
    px(ctx, x + 4, y + 24, 24, 5, '#2b2450');
    px(ctx, x + 14, y + 2, 4, 24, '#3a3260');
    px(ctx, x + 3, y - 8, 26, 11, '#262042');
    [PAL.pink, PAL.cyan, PAL.yellow].forEach((c, i) => px(ctx, x + 6 + i * 8, y + 3, 6, 4, on ? c : '#382f58'));
    if (on) glow(ctx, x + 16, y + 5, 40, PAL.cyan, 0.18);
  },
  // 레퍼런스형 둥근 활엽수 + 그림자
  tree(ctx, x, y, p) {
    const t = p.tone || 0.5;
    const warm = t > 0.55;
    ctx.globalAlpha = 0.34; px(ctx, x + 6, y + 24, 28, 10, '#181441'); ctx.globalAlpha = 1;
    px(ctx, x + 13, y + 14, 7, 16, '#4a3a52');
    px(ctx, x + 13, y + 14, 3, 16, '#5c4a63');
    const c1 = warm ? '#8a5f86' : '#3f5a7a';
    const c2 = warm ? '#a3739c' : '#4e6f92';
    const c3 = warm ? '#bd8bb2' : '#5f85a8';
    px(ctx, x + 2, y - 4, 28, 20, c1);
    px(ctx, x + 6, y - 12, 20, 14, c1);
    px(ctx, x + 8, y - 14, 16, 10, c2);
    px(ctx, x + 4, y - 2, 10, 8, c2);
    px(ctx, x + 11, y - 10, 8, 6, c3);
    px(ctx, x + 22, y + 2, 6, 5, c3);
    px(ctx, x + 20, y - 8, 4, 4, warm ? PAL.pink : PAL.cyan);
  },
};

// ------------------------------------------------------------------ 정적 레이어

function drawGround(ctx, v) {
  const rnd = mulberry32(99);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = v.terrain[y][x], X = x * T, Y = y * T, r = rnd();
      if (t === 0) {
        px(ctx, X, Y, T, T, r < 0.16 ? PAL.grassAlt : r > 0.94 ? PAL.grassDark : PAL.grass);
        if (r > 0.88) { px(ctx, X + 9, Y + 13, 5, 3, '#4a4886'); px(ctx, X + 19, Y + 21, 4, 3, '#4a4886'); }
        if (r < 0.06) px(ctx, X + 14, Y + 8, 3, 3, '#514f8f');
      } else if (t === 1) {
        // 벽돌 인도 (레퍼런스: 헤링본 느낌의 촘촘한 벽돌)
        px(ctx, X, Y, T, T, (x + y) % 2 ? PAL.cobble : PAL.cobbleAlt);
        for (let by = 0; by < T; by += 8) {
          px(ctx, X, Y + by, T, 1, PAL.cobbleDark);
          const off = ((y * 4 + by / 8) % 2) ? 0 : 8;
          for (let bx = off; bx < T; bx += 16) px(ctx, X + bx, Y + by, 1, 8, PAL.cobbleDark);
        }
        if (r > 0.965) { px(ctx, X + 6, Y + 12, 12, 1, '#3a3568'); px(ctx, X + 16, Y + 13, 8, 1, '#3a3568'); }
      } else if (t === 2) {
        px(ctx, X, Y, T, T, (x + y) % 4 < 2 ? PAL.plaza : PAL.plazaAlt);
        px(ctx, X, Y, T, 1, 'rgba(20,16,48,0.18)');
        px(ctx, X, Y, 1, T, 'rgba(20,16,48,0.18)');
        if ((x + y) % 6 === 0) px(ctx, X + 10, Y + 10, 12, 12, 'rgba(246,239,255,0.05)');
      } else if (t === 3) {
        px(ctx, X, Y, T, T, PAL.water);
        px(ctx, X, Y, T, 4, '#28377a');
        if (r < 0.3) px(ctx, X + 5, Y + 11, 15, 3, PAL.waterLit);
        if (r > 0.85) px(ctx, X + 18, Y + 22, 9, 2, '#6b7fd8');
      } else if (t === 4) {
        px(ctx, X, Y, T, T, '#5b3f7e');
      } else if (t === 5) {
        px(ctx, X, Y, T, T, PAL.wood);
        px(ctx, X, Y, T, 3, PAL.woodLit);
        for (let i = 0; i < T; i += 8) px(ctx, X + i, Y, 1, T, 'rgba(20,16,48,0.22)');
        px(ctx, X, Y + T - 4, T, 4, 'rgba(20,16,48,0.3)');
      }
    }
  }
  // 인도 경계석
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const t = v.terrain[y][x];
      if (t !== 1 && t !== 2) continue;
      const X = x * T, Y = y * T;
      if (v.terrain[y - 1][x] === 0) { px(ctx, X, Y, T, 4, PAL.brickAlt); px(ctx, X, Y + 4, T, 1, PAL.cobbleDark); }
      if (v.terrain[y + 1][x] === 0) px(ctx, X, Y + T - 4, T, 4, PAL.brick);
      if (v.terrain[y][x - 1] === 0) px(ctx, X, Y, 4, T, PAL.brick);
      if (v.terrain[y][x + 1] === 0) px(ctx, X + T - 4, Y, 4, T, PAL.brick);
    }
  // 물가 석축 난간
  v.water.forEach((r) => {
    px(ctx, r.x * T, r.y * T - 6, r.w * T, 6, PAL.brick);
    px(ctx, r.x * T, r.y * T - 6, r.w * T, 2, PAL.brickAlt);
    px(ctx, r.x * T, (r.y + r.h) * T, r.w * T, 6, PAL.brick);
    px(ctx, r.x * T, (r.y + r.h) * T, r.w * T, 2, PAL.brickAlt);
  });
}

function drawFences(ctx, v) {
  v.fences.forEach((f) => {
    if (f.dir === 'h') {
      const y = f.y * T + 16;
      px(ctx, f.x * T, y + 12, f.w * T, 4, '#2b2450');
      for (let i = 0; i < f.w * T; i += 8) { px(ctx, f.x * T + i, y - 6, 3, 20, '#3a3468'); px(ctx, f.x * T + i, y - 9, 3, 3, '#4a4280'); }
      px(ctx, f.x * T, y, f.w * T, 3, '#423c72');
    } else {
      const x = f.x * T + 12;
      px(ctx, x, f.y * T, 4, f.h * T, '#2b2450');
      for (let i = 0; i < f.h * T; i += 8) px(ctx, x - 4, f.y * T + i, 12, 3, '#3a3468');
    }
  });
}

function drawStrings(ctx, v, on) {
  v.strings.forEach((s) => {
    const x1 = s.x1 * T, y1 = s.y1 * T, x2 = s.x2 * T, y2 = s.y2 * T;
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const sag = Math.sin(Math.PI * t) * 26;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t + sag;
      px(ctx, x, y, 2, 2, '#332d5e');
      if (i % 3 === 0) {
        px(ctx, x - 1, y + 3, 4, 5, on ? PAL.lamp : '#4a4270');
        if (on) glow(ctx, x + 1, y + 5, 14, PAL.warm, 0.3);
      }
    }
  });
}

// 가로등 빛 웅덩이 — 지면 위, 오브젝트 아래
function drawLightPools(ctx, v, on) {
  if (!on) return;
  v.props.forEach((p) => {
    if (p.type !== 'lamp') return;
    const x = p.tx * T + 16, y = p.ty * T + 26;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = PAL.lamp;
    ctx.beginPath(); ctx.ellipse(x, y, 46, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.ellipse(x, y, 74, 40, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
}

export function drawStatic(ctx, v, opts) {
  const on = !opts || opts.neon !== false;
  ctx.imageSmoothingEnabled = false;
  px(ctx, 0, 0, MAP_W * T, MAP_H * T, PAL.night);
  drawGround(ctx, v);
  // 구역 테마 색을 포장면에 은은하게
  v.districts.forEach((d) => {
    for (let y = d.area.y; y < d.area.y + d.area.h; y++)
      for (let x = d.area.x; x < d.area.x + d.area.w; x++) {
        if (x >= MAP_W || y >= MAP_H) continue;
        const t = v.terrain[y][x];
        if (t === 1 || t === 2) { ctx.globalAlpha = 0.12; px(ctx, x * T, y * T, T, T, d.neon); ctx.globalAlpha = 1; }
      }
  });
  drawLightPools(ctx, v, on);
  drawFences(ctx, v);
  drawBusking(ctx, v.busking, on);
  drawStage(ctx, v.stage, on);

  // y 정렬 합성 (건물/소품)
  const ents = [];
  v.buildings.forEach((b) => ents.push({ y: b.y + b.h, draw: () => drawBuilding(ctx, b, on) }));
  v.props.forEach((p) => {
    const f = PROP_DRAW[p.type];
    if (f) ents.push({ y: p.ty, draw: () => f(ctx, p.tx * T, p.ty * T, p, on) });
  });
  ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

  drawStrings(ctx, v, on);

  // 구역 팻말
  v.districts.forEach((d) => {
    const cx = (d.area.x + d.area.w / 2) * T, cy = d.area.y * T + 12;
    ctx.font = 'bold 13px "Courier New", monospace';
    const w = ctx.measureText(d.name).width + 22;
    px(ctx, cx - w / 2, cy - 11, w, 22, 'rgba(20,16,48,0.82)');
    px(ctx, cx - w / 2, cy - 11, w, 2, d.neon);
    px(ctx, cx - w / 2, cy + 9, w, 2, d.neon);
    pixelText(ctx, d.name, cx - w / 2 + 11, cy - 5, d.neon, 13);
  });
}

// ------------------------------------------------------------------ 동적 레이어

export function drawItem(ctx, it, t) {
  const bob = Math.sin(t / 380 + it.phase) * 5;
  const x = it.tx * T + 16, y = it.ty * T + 14 + bob;
  glow(ctx, x, y, 38, it.neon, 0.42);
  ctx.globalAlpha = 0.3; px(ctx, x - 9, y + 20 - bob, 18, 5, '#181441'); ctx.globalAlpha = 1;
  if (it.kind === 'note') {
    px(ctx, x + 2, y - 13, 4, 19, it.neon);
    px(ctx, x - 7, y + 2, 11, 9, it.neon);
    px(ctx, x + 4, y - 13, 9, 4, it.neon);
    px(ctx, x - 5, y + 4, 4, 3, PAL.white);
  } else {
    px(ctx, x - 13, y - 9, 26, 18, PAL.ink);
    px(ctx, x - 13, y - 9, 26, 3, it.neon);
    px(ctx, x - 9, y - 4, 18, 9, it.neon);
    px(ctx, x - 6, y - 2, 4, 4, PAL.ink);
    px(ctx, x + 3, y - 2, 4, 4, PAL.ink);
  }
  if (Math.sin(t / 200 + it.phase) > 0.4) {
    px(ctx, x + 14, y - 13, 3, 3, PAL.white);
    px(ctx, x - 16, y + 6, 2, 2, PAL.white);
  }
}

export function drawPlayer(ctx, p, t, moving) {
  const frame = moving ? Math.floor(t / 110) % 4 : 0;
  const step = [0, 1, 0, -1][frame];
  const x = Math.round(p.x), y = Math.round(p.y);
  ctx.globalAlpha = 0.4; px(ctx, x - 10, y - 3, 20, 6, '#181441'); ctx.globalAlpha = 1;
  const back = p.dir === 'up';
  px(ctx, x - 6, y - 10, 5, 10, '#3a3260');
  px(ctx, x + 1, y - 10, 5, 10, '#3a3260');
  px(ctx, x - 7 + (step > 0 ? 1 : 0), y - 2, 6, 3, '#241f45');
  px(ctx, x + 1 + (step < 0 ? -1 : 0), y - 2, 6, 3, '#241f45');
  px(ctx, x - 8, y - 24, 16, 15, PAL.pink);
  px(ctx, x - 8, y - 24, 16, 3, '#ff96c6');
  px(ctx, x - 8, y - 16 + step, 16, 3, 'rgba(20,16,48,0.2)');
  px(ctx, x - 11, y - 22 + step, 4, 11, '#f2c39a');
  px(ctx, x + 7, y - 22 - step, 4, 11, '#f2c39a');
  px(ctx, x - 8, y - 38, 16, 15, '#f7d0a1');
  px(ctx, x - 9, y - 41, 18, 7, '#5a4a8c');
  px(ctx, x - 9, y - 41, 18, 3, '#7a62ac');
  if (!back) {
    px(ctx, x - 5, y - 32, 3, 4, '#241f45');
    px(ctx, x + 3, y - 32, 3, 4, '#241f45');
    px(ctx, x - 2, y - 27, 5, 2, '#c98a72');
  }
  px(ctx, x - 11, y - 36, 4, 9, PAL.cyan);
  px(ctx, x + 8, y - 36, 4, 9, PAL.cyan);
  px(ctx, x - 10, y - 42, 21, 3, PAL.cyan);
}

export function drawLockFog(ctx, v, unlockedBlock, t) {
  v.districts.forEach((d) => {
    if (d.block <= unlockedBlock) return;
    const x = d.area.x * T, y = d.area.y * T, w = d.area.w * T, h = d.area.h * T;
    ctx.globalAlpha = 0.84; px(ctx, x, y, w, h, '#241f52'); ctx.globalAlpha = 1;
    const rnd = mulberry32(d.block * 77);
    for (let i = 0; i < 26; i++) {
      const cx = x + rnd() * w, cy = y + rnd() * h + Math.sin(t / 900 + i) * 4, r = 18 + rnd() * 26;
      ctx.globalAlpha = 0.5;
      px(ctx, cx - r, cy - r / 2, r * 2, r, '#3a3272');
      px(ctx, cx - r * 0.6, cy - r * 0.8, r * 1.2, r * 0.8, '#463c86');
      ctx.globalAlpha = 1;
    }
    const label = '\uD83D\uDD12 ' + d.name;
    ctx.font = 'bold 15px "Courier New", monospace';
    pixelText(ctx, label, x + w / 2 - ctx.measureText(label).width / 2, y + h / 2 - 8, 'rgba(246,239,255,0.88)', 15);
  });
}
