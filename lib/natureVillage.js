// 자연 마을(Nature Zone) 맵 로더 + 렌더 엔진 — 순수 로직/드로잉. UI는
// NatureZoneMap 컴포넌트가 담당. handoff 패키지(design_handoff 폴더가 아니라
// 실제 구매 에셋 기반 완성 맵 데이터)를 이식한 것 — music-village.js와 달리
// 절차적 드로잉이 아니라 terrain.png/nature.png 스프라이트시트 blit이다.
// 좌표 단위: 타일(32px). 맵 48x36 = 1536x1152px — Music Zone과 동일 규격.
import mapData from '@/data/nature_village_map.json';

export const T      = mapData.meta.tilePx; // 32
export const MAP_W  = mapData.meta.mapW;   // 48
export const MAP_H  = mapData.meta.mapH;   // 36
const SRC_TILE       = mapData.meta.tile;   // 16 (스프라이트시트 원본 타일)
const WORLD_W        = mapData.meta.worldW;
const WORLD_H        = mapData.meta.worldH;

// 발 밑 히트박스 — nature-village-map.js 원본 canStand()와 동일 규격
// (폭 18px, 위 -11 ~ 아래 -1). 위쪽 절반이 비어 있어 나무 캔피 아래로
// 걸어 들어갈 수 있다.
export const PLAYER_BOX = { w: 18, h: 10 };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed: ' + src));
    img.src = src;
  });
}

// ------------------------------------------------------------------ 로드/빌드

export async function loadNatureVillage() {
  const [terrain, nature] = await Promise.all([
    loadImage('/assets/world/nature_village_map/terrain.png'),
    loadImage('/assets/world/nature_village_map/nature.png'),
  ]);
  const sheets = { terrain, nature };

  const collision = mapData.collision.map(row => row.split('').map(c => c === '1'));
  const core      = (mapData.core || []).map(row => row.split('').map(c => c === '1'));

  // 정적 레이어 — 지면(tiles, flip 반영) + 오브젝트(base 오름차순, 집/나무/울타리 등)를
  // 한 번만 오프스크린에 그려둔다. Music Zone과 동일한 성능 전략(매 프레임 재드로잉 금지).
  const off = document.createElement('canvas');
  off.width = WORLD_W;
  off.height = WORLD_H;
  const g = off.getContext('2d');
  g.imageSmoothingEnabled = false;

  for (const t of mapData.tiles) {
    const [tx, ty, sx, sy, fx, fy] = t;
    const dx = tx * T, dy = ty * T;
    if (!fx && !fy) {
      g.drawImage(sheets.terrain, sx, sy, SRC_TILE, SRC_TILE, dx, dy, T, T);
      continue;
    }
    g.save();
    g.translate(dx + (fx ? T : 0), dy + (fy ? T : 0));
    g.scale(fx ? -1 : 1, fy ? -1 : 1);
    g.drawImage(sheets.terrain, sx, sy, SRC_TILE, SRC_TILE, 0, 0, T, T);
    g.restore();
  }

  const objects = [...mapData.objects].sort((a, b) => a.base - b.base);
  for (const o of objects) {
    const img = sheets[o.sheet];
    if (!img) continue;
    g.drawImage(img, o.src[0], o.src[1], o.src[2], o.src[3],
      Math.round(o.pos[0]), Math.round(o.pos[1]), o.size[0], o.size[1]);
  }

  const canStand = (cx, cy) => {
    const hw = PLAYER_BOX.w / 2;
    for (const x of [cx - hw, cx + hw]) {
      for (const y of [cy - 11, cy - 1]) {
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        if (ty < 0 || tx < 0 || ty >= MAP_H || tx >= MAP_W) return false;
        if (collision[ty][tx]) return false;
      }
    }
    return true;
  };

  return {
    staticCanvas: off,
    collision, core,
    houses: mapData.houses || [],
    spawn: { x: mapData.spawn.x, y: mapData.spawn.y },
    canStand,
  };
}

export function moveWithCollision(village, pos, dx, dy) {
  let nx = pos.x, ny = pos.y;
  if (dx && village.canStand(pos.x + dx, ny)) nx = pos.x + dx;
  if (dy && village.canStand(nx, pos.y + dy)) ny = pos.y + dy;
  return { x: nx, y: ny };
}

// ------------------------------------------------------------------ 시드 RNG

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

export function hashSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// ------------------------------------------------------------------ block 격자
// ZoneMap.js의 computeBlockGrid()와 동일한 공식(3열×2행 격자, 여백 2타일)을
// 이 파일 안에서 독립적으로 재구현한다 — 기존 spawnSoundItems/computeBlockGrid는
// 절대 import/수정하지 않고(다른 Zone에 영향 없음), 같은 격자 좌표만 재사용해
// 게임 전체의 block 구역 감각과 시각적으로 일치시킨다.
export function computeBlockGrid(sounds) {
  const byBlock = new Map();
  for (const s of sounds) {
    const b = s.block || 1;
    if (!byBlock.has(b)) byBlock.set(b, []);
    byBlock.get(b).push(s);
  }
  const blockNums = [...byBlock.keys()].sort((a, b) => a - b);
  const n = Math.max(1, blockNums.length);

  let cols = Math.max(1, Math.round(Math.sqrt(n * (MAP_W / MAP_H))));
  let rows = Math.ceil(n / cols);
  while (cols * rows < n) cols++;

  const colBounds = [];
  for (let i = 0; i <= cols; i++) colBounds.push(Math.round(2 + (MAP_W - 4) * i / cols));
  const rowBounds = [];
  for (let i = 0; i <= rows; i++) rowBounds.push(Math.round(2 + (MAP_H - 4) * i / rows));

  return { byBlock, blockNums, cols, rows, colBounds, rowBounds };
}

// 실제 SOUND_ITEMS.Nature(sounds prop)을 위 격자의 셀에 block별로 하나씩 배정한다.
// 입구(스폰)에서 가까운 셀부터 낮은 block을 받아 "안개가 입구에서부터 걷힌다"는
// 느낌을 유지한다(spawnSoundItems와 동일한 설계 원칙, 좌표만 이 맵의 실제
// walkable 그리드 기준으로 다시 계산). 같은 참여자가 재입장해도 항상 같은
// 배치가 나오도록 zone+소리 id 목록으로 시드를 고정한다.
export function spawnNatureItems(sounds, village) {
  const { byBlock, blockNums, cols, rows, colBounds, rowBounds } = computeBlockGrid(sounds);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x0: colBounds[c], x1: colBounds[c + 1],
        y0: rowBounds[r], y1: rowBounds[r + 1],
        tiles: [],
      });
    }
  }
  const cellAt = (tx, ty) => {
    let c = 0, r = 0;
    for (let i = 1; i < cols; i++) if (tx >= colBounds[i]) c = i;
    for (let i = 1; i < rows; i++) if (ty >= rowBounds[i]) r = i;
    return cells[r * cols + c];
  };

  for (let ty = 1; ty < MAP_H - 1; ty++) {
    for (let tx = 1; tx < MAP_W - 1; tx++) {
      if (village.collision[ty][tx]) continue;
      cellAt(tx, ty).tiles.push({ tx, ty });
    }
  }

  const spawnTx = Math.floor(village.spawn.x / T), spawnTy = Math.floor(village.spawn.y / T);
  const orderedCells = [...cells].sort((a, b) => {
    const acx = (a.x0 + a.x1) / 2, acy = (a.y0 + a.y1) / 2;
    const bcx = (b.x0 + b.x1) / 2, bcy = (b.y0 + b.y1) / 2;
    const da = (acx - spawnTx) ** 2 + (acy - spawnTy) ** 2;
    const db = (bcx - spawnTx) ** 2 + (bcy - spawnTy) ** 2;
    return da - db;
  });
  const cellByBlock = new Map();
  blockNums.forEach((b, bi) => cellByBlock.set(b, orderedCells[Math.min(bi, orderedCells.length - 1)]));

  const seed = hashSeed('Nature|' + sounds.map(s => s.sound_id).sort().join(','));
  const rnd  = mulberry32(seed);

  const items = [];
  blockNums.forEach(block => {
    const list = byBlock.get(block);
    const cell = cellByBlock.get(block);
    const pool = [...cell.tiles];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = [];
    for (const p of pool) {
      if (chosen.length >= list.length) break;
      if (chosen.every(c => Math.abs(c.tx - p.tx) >= 2 || Math.abs(c.ty - p.ty) >= 2)) chosen.push(p);
    }
    if (chosen.length < list.length) {
      for (const p of pool) {
        if (chosen.length >= list.length) break;
        if (!chosen.some(c => c.tx === p.tx && c.ty === p.ty)) chosen.push(p);
      }
    }
    list.forEach((s, i) => {
      const pos = chosen[i] || chosen[chosen.length - 1] || { tx: Math.round((cell.x0 + cell.x1) / 2), ty: Math.round((cell.y0 + cell.y1) / 2) };
      items.push({
        id: s.sound_id,
        sound: s,
        tx: pos.tx,
        ty: pos.ty,
        block,
        phase: rnd() * Math.PI * 2,
      });
    });
  });

  return items;
}

// ------------------------------------------------------------------ 동적 레이어

// 소리 구슬 — nature-village-map.js 원본 drawOrbs()와 동일한 조형(부유 + 링 파동
// 2개 + 중심 방사 그라디언트 + 반짝임)을 아이템 1개 단위로 그린다.
export function drawOrb(ctx, item, t) {
  const x = item.tx * T + 16;
  const y = item.ty * T + 16 + Math.sin(t / 520 + item.phase) * 6;
  const tt = t + item.phase * 700;

  for (let r = 0; r < 2; r++) {
    const k = ((tt % 1800) / 1800 + r * 0.5) % 1;
    ctx.strokeStyle = 'rgba(255,236,150,' + (0.55 * (1 - k)) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 9 + k * 22, 0, Math.PI * 2); ctx.stroke();
  }
  const grad = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 16);
  grad.addColorStop(0, 'rgba(255,255,225,1)');
  grad.addColorStop(0.4, 'rgba(255,214,96,.95)');
  grad.addColorStop(1, 'rgba(255,190,60,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fffbe0';
  ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 3, 3);
}

// 잠긴 block 격자 셀에 안개를 덮는다 (Music Zone drawLockFog와 같은 역할,
// 팔레트만 자연 마을 톤 — 밤 인디고 대신 옅은 이끼빛 안개).
export function drawLockFog(ctx, sounds, unlockedBlock, t) {
  const { byBlock, blockNums, cols, rows, colBounds, rowBounds } = computeBlockGrid(sounds);
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ x0: colBounds[c], x1: colBounds[c + 1], y0: rowBounds[r], y1: rowBounds[r + 1] });

  const spawnTx = MAP_W / 2, spawnTy = MAP_H - 2;
  const orderedCells = [...cells].sort((a, b) => {
    const acx = (a.x0 + a.x1) / 2, acy = (a.y0 + a.y1) / 2;
    const bcx = (b.x0 + b.x1) / 2, bcy = (b.y0 + b.y1) / 2;
    return ((acx - spawnTx) ** 2 + (acy - spawnTy) ** 2) - ((bcx - spawnTx) ** 2 + (bcy - spawnTy) ** 2);
  });

  blockNums.forEach((block, bi) => {
    if (block <= unlockedBlock) return;
    const cell = orderedCells[Math.min(bi, orderedCells.length - 1)];
    const x = cell.x0 * T, y = cell.y0 * T, w = (cell.x1 - cell.x0) * T, h = (cell.y1 - cell.y0) * T;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#20301c';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    const rnd = mulberry32(block * 77);
    for (let i = 0; i < 22; i++) {
      const cx = x + rnd() * w, cy = y + rnd() * h + Math.sin(t / 900 + i) * 4, r = 18 + rnd() * 26;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#e8f2d8';
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const label = '🔒'; // 🔒
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(20,30,15,0.88)';
    ctx.fillText(label, x + w / 2 - ctx.measureText(label).width / 2, y + h / 2 - 10);
  });
}
