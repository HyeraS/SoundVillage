'use client'

import NextImage from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './concepts.module.css'

const TILE = 32
const MAP_W = 30
const MAP_H = 20
const WIDTH = MAP_W * TILE
const HEIGHT = MAP_H * TILE
const PLAYER_SPEED = 150
const PLAYER_BOX = { w: 18, h: 12 }

const ASSET_PATHS = {
  barn: '/assets/world/barn.png',
  coop: '/assets/world/coop.png',
  greenhouse: '/assets/world/greenhouse.png',
  cottageBlue: '/assets/world/nature-farm-v2/south-cottage-v2.png',
  cottageRed: '/assets/world/nature_village/house_cream.png',
  body: '/assets/world/player_body.png',
  clothes: '/assets/world/player_clothes.png',
  hair: '/assets/world/player_hair.png',
  cow: '/assets/world/animals/cow.png',
  pig: '/assets/world/animals/pig.png',
  sheep: '/assets/world/animals/sheep.png',
  chicken: '/assets/world/animals/chicken.png',
  bunny: '/assets/world/animals/bunny.png',
}

const r = (x, y, w, h, tag = 'obstacle') => ({ x, y, w, h, tag })

const CONCEPTS = [
  {
    id: 'commons',
    number: '01',
    name: '해바라기 공동농장',
    short: '광장 중심형',
    art: '/design-previews/animal-village-concepts/01-sunflower-commons-v4.png',
    caption: '소리 공터의 여백과 작은 주거 구역이 균형을 이루는 기본안',
    description: '네 개의 소리 공터는 그대로 비워두고, 맨 왼쪽 아래에 파란 지붕과 붉은 지붕의 작은 집 두 채를 배치했습니다. 목장 안 양은 서로 겹치지 않도록 간격을 두어 또렷한 실루엣으로 정리했습니다.',
    accent: '#e59b3f',
    pale: '#fff1c9',
    focus: '추천 · 기본안',
    stats: [['동선', '명료함'], ['밀도', '균형'], ['제작', '안정적']],
    spawn: { x: 480, y: 590 },
    entrance: { x: 430, y: 612, w: 100, h: 28 },
    paths: [
      r(420, 306, 120, 334), r(142, 282, 676, 98), r(235, 104, 88, 220), r(648, 104, 88, 220),
      r(326, 194, 308, 122),
    ],
    clearings: [
      r(294, 372, 112, 88, 'sound-clearing'),
      r(568, 372, 112, 88, 'sound-clearing'),
      r(276, 506, 124, 92, 'sound-clearing'),
      r(548, 506, 124, 92, 'sound-clearing'),
    ],
    water: [r(698, 392, 174, 132, 'water')],
    bridges: [],
    buildings: [
      { asset: 'barn', x: 388, y: 38, w: 184, h: 184, label: '큰 헛간' },
      { asset: 'greenhouse', x: 724, y: 88, w: 170, h: 122, label: '온실' },
      { asset: 'coop', x: 82, y: 94, w: 128, h: 128, label: '닭장' },
      { asset: 'cottageBlue', x: 50, y: 448, w: 112, h: 112, label: '파란 지붕 집' },
      { asset: 'cottageRed', x: 150, y: 450, w: 104, h: 112, label: '붉은 지붕 집' },
    ],
    fields: [r(724, 248, 176, 92, 'field')],
    pens: [r(54, 246, 202, 124, 'pen'), r(746, 430, 148, 120, 'pen')],
    orchards: [{ x: 270, y: 448, cols: 2, rows: 1 }],
    animals: [
      { asset: 'sheep', x: 104, y: 290 }, { asset: 'sheep', x: 202, y: 326 },
      { asset: 'sheep', x: 786, y: 472 }, { asset: 'sheep', x: 850, y: 516 },
      { asset: 'chicken', x: 126, y: 178 },
    ],
    items: [
      { x: 350, y: 416, label: '닭 울음' }, { x: 624, y: 416, label: '발굽 소리' },
      { x: 338, y: 552, label: '양 울음' }, { x: 610, y: 552, label: '새 지저귐' },
    ],
    extras: [
      { type: 'windmill', x: 480, y: 260 },
      { type: 'bench', x: 336, y: 360 }, { type: 'bench', x: 640, y: 360 },
      { type: 'well', x: 700, y: 574 },
      { type: 'tree', x: 268, y: 392 }, { type: 'tree', x: 706, y: 364 },
      { type: 'tree', x: 248, y: 580 },
    ],
    colliders: [
      r(407, 150, 146, 70, 'barn'), r(742, 158, 134, 54, 'greenhouse'), r(99, 170, 94, 53, 'coop'),
      r(70, 518, 72, 43, 'cottage'), r(168, 516, 70, 46, 'cottage'),
      r(54, 246, 202, 10, 'fence'), r(54, 360, 78, 10, 'fence'), r(178, 360, 78, 10, 'fence'),
      r(54, 246, 10, 124, 'fence'), r(246, 246, 10, 124, 'fence'),
      r(746, 430, 148, 10, 'fence'), r(746, 540, 52, 10, 'fence'), r(842, 540, 52, 10, 'fence'),
      r(746, 430, 10, 120, 'fence'), r(884, 430, 10, 120, 'fence'),
      r(698, 392, 174, 132, 'water'),
      r(724, 248, 176, 22, 'crop'), r(724, 283, 176, 22, 'crop'), r(724, 318, 176, 22, 'crop'),
      r(260, 444, 20, 28, 'tree'), r(332, 444, 20, 28, 'tree'),
      r(314, 354, 44, 15, 'bench'), r(618, 354, 44, 15, 'bench'),
      r(682, 570, 36, 24, 'well'),
      r(258, 388, 20, 28, 'tree'), r(696, 360, 20, 28, 'tree'),
      r(238, 576, 20, 28, 'tree'),
      r(444, 224, 72, 72, 'windmill'),
    ],
  },
  {
    id: 'riverside',
    number: '02',
    name: '버들개울 목장마을',
    short: '순환 탐색형',
    art: '/design-previews/animal-village-concepts/02-willow-creek.png',
    caption: '물길과 두 개의 다리가 작은 모험을 만드는 안',
    description: 'S자 개울이 마을을 세 구역으로 나눕니다. 두 다리를 오가며 목장과 과수원을 발견하는 구조라 탐색의 재미가 크고, 떠 있는 사운드 아이템을 멀리서 발견한 뒤 길을 찾아가는 플레이가 살아납니다.',
    accent: '#4f9f88',
    pale: '#dff5df',
    focus: '탐색 강화안',
    stats: [['동선', '순환형'], ['탐색', '높음'], ['제작', '중간']],
    spawn: { x: 480, y: 588 },
    entrance: { x: 430, y: 612, w: 100, h: 28 },
    paths: [
      r(430, 438, 100, 202), r(185, 415, 345, 78), r(152, 182, 82, 250),
      r(220, 166, 332, 75), r(520, 112, 78, 128), r(566, 94, 244, 70),
      r(726, 146, 76, 285), r(520, 406, 282, 72),
    ],
    water: [
      r(0, 276, 346, 83, 'water'), r(302, 254, 82, 154, 'water'), r(340, 352, 312, 84, 'water'),
      r(610, 326, 88, 175, 'water'), r(655, 468, 305, 82, 'water'),
    ],
    bridges: [r(316, 304, 68, 48, 'bridge'), r(612, 395, 86, 48, 'bridge')],
    buildings: [
      { asset: 'barn', x: 52, y: 56, w: 174, h: 174, label: '강변 헛간' },
      { asset: 'greenhouse', x: 684, y: 42, w: 202, h: 144, label: '유리 온실' },
      { asset: 'coop', x: 694, y: 408, w: 132, h: 132, label: '오리 닭장' },
    ],
    fields: [r(264, 64, 226, 122, 'field')],
    pens: [r(34, 388, 270, 174, 'pen'), r(684, 196, 224, 154, 'pen')],
    orchards: [{ x: 402, y: 458, cols: 3, rows: 2 }],
    animals: [
      { asset: 'pig', x: 82, y: 446 }, { asset: 'pig', x: 196, y: 506 },
      { asset: 'cow', x: 744, y: 245 }, { asset: 'cow', x: 835, y: 293 },
      { asset: 'bunny', x: 558, y: 524 },
    ],
    items: [
      { x: 208, y: 248, label: '물새 소리' }, { x: 389, y: 224, label: '돼지 울음' },
      { x: 644, y: 309, label: '개울 소리' }, { x: 790, y: 383, label: '소 울음' },
    ],
    extras: [{ type: 'well', x: 551, y: 206 }],
    colliders: [
      r(70, 164, 138, 68, 'barn'), r(706, 126, 160, 60, 'greenhouse'), r(712, 486, 96, 55, 'coop'),
      r(0, 276, 316, 83, 'water'), r(384, 352, 226, 84, 'water'), r(698, 468, 262, 82, 'water'),
      r(302, 254, 14, 154, 'water'), r(370, 254, 14, 154, 'water'), r(610, 326, 14, 175, 'water'), r(684, 326, 14, 175, 'water'),
      r(34, 388, 270, 10, 'fence'), r(34, 552, 105, 10, 'fence'), r(188, 552, 116, 10, 'fence'), r(34, 388, 10, 174, 'fence'), r(294, 388, 10, 174, 'fence'),
      r(684, 196, 224, 10, 'fence'), r(684, 340, 82, 10, 'fence'), r(812, 340, 96, 10, 'fence'), r(684, 196, 10, 154, 'fence'), r(898, 196, 10, 154, 'fence'),
      r(264, 64, 226, 26, 'crop'), r(264, 112, 226, 26, 'crop'), r(264, 160, 226, 26, 'crop'),
    ],
  },
  {
    id: 'terraces',
    number: '03',
    name: '구름언덕 다락농장',
    short: '단계 해금형',
    art: '/design-previews/animal-village-concepts/03-cloudhill-terraces.png',
    caption: '위로 오를수록 새로운 풍경이 열리는 가장 게임다운 안',
    description: '낮은 남쪽 목초지에서 시작해 밭과 마을길을 지나 북쪽 풍차 언덕으로 올라갑니다. 높낮이는 2D 단차와 계단으로만 표현하며, 블록 해금 순서를 공간의 상승감으로 전달합니다.',
    accent: '#a66bb0',
    pale: '#f1e3f2',
    focus: '진행 연출안',
    stats: [['동선', '목표형'], ['탐색', '중간'], ['제작', '높음']],
    spawn: { x: 480, y: 590 },
    entrance: { x: 430, y: 612, w: 100, h: 28 },
    paths: [
      r(430, 472, 100, 168), r(278, 442, 405, 72), r(620, 330, 72, 130),
      r(330, 302, 362, 70), r(315, 182, 72, 140), r(315, 150, 332, 65),
      r(590, 62, 74, 120),
    ],
    water: [r(48, 430, 228, 130, 'water')],
    bridges: [],
    buildings: [
      { asset: 'barn', x: 654, y: 380, w: 170, h: 170, label: '아랫마을 헛간' },
      { asset: 'greenhouse', x: 66, y: 224, w: 196, h: 140, label: '꽃 온실' },
      { asset: 'coop', x: 708, y: 96, w: 136, h: 136, label: '언덕 닭장' },
    ],
    fields: [r(70, 78, 216, 116, 'field'), r(690, 250, 208, 108, 'field')],
    pens: [r(67, 372, 250, 182, 'pen')],
    orchards: [{ x: 398, y: 388, cols: 3, rows: 2 }],
    animals: [
      { asset: 'sheep', x: 116, y: 426 }, { asset: 'sheep', x: 218, y: 500 },
      { asset: 'chicken', x: 760, y: 188 }, { asset: 'bunny', x: 566, y: 405 },
    ],
    items: [
      { x: 361, y: 412, label: '풀벌레 소리' }, { x: 644, y: 294, label: '풍차 소리' },
      { x: 412, y: 242, label: '양 울음' }, { x: 604, y: 115, label: '새벽 닭 울음' },
    ],
    extras: [{ type: 'windmill', x: 542, y: 130 }, { type: 'well', x: 742, y: 420 }],
    cliffs: [r(0, 208, 960, 22, 'cliff'), r(0, 375, 960, 22, 'cliff')],
    stairs: [r(315, 198, 72, 40, 'stairs'), r(620, 365, 72, 40, 'stairs')],
    colliders: [
      r(672, 480, 134, 70, 'barn'), r(86, 305, 156, 60, 'greenhouse'), r(727, 176, 98, 56, 'coop'),
      r(0, 208, 315, 22, 'cliff'), r(387, 208, 573, 22, 'cliff'), r(0, 375, 620, 22, 'cliff'), r(692, 375, 268, 22, 'cliff'),
      r(48, 430, 19, 130, 'water'), r(67, 550, 209, 10, 'water'), r(257, 430, 19, 130, 'water'),
      r(67, 372, 250, 10, 'fence'), r(67, 544, 90, 10, 'fence'), r(202, 544, 115, 10, 'fence'), r(67, 372, 10, 182, 'fence'), r(307, 372, 10, 182, 'fence'),
      r(70, 78, 216, 24, 'crop'), r(70, 124, 216, 24, 'crop'), r(70, 170, 216, 24, 'crop'),
      r(690, 250, 208, 22, 'crop'), r(690, 293, 208, 22, 'crop'), r(690, 336, 208, 22, 'crop'),
      r(508, 94, 70, 72, 'windmill'),
    ],
  },
]

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function steppedRect(ctx, x, y, w, h, fill, border) {
  ctx.fillStyle = border
  ctx.fillRect(x + 8, y, w - 16, h)
  ctx.fillRect(x, y + 8, w, h - 16)
  ctx.fillStyle = fill
  ctx.fillRect(x + 8, y + 4, w - 16, h - 8)
  ctx.fillRect(x + 4, y + 8, w - 8, h - 16)
}

function drawGround(ctx, concept) {
  ctx.fillStyle = '#89a95d'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  for (let ty = 0; ty < MAP_H; ty += 1) {
    for (let tx = 0; tx < MAP_W; tx += 1) {
      const seed = (tx * 17 + ty * 29 + Number(concept.number) * 31) % 23
      if (seed < 4) {
        ctx.fillStyle = seed % 2 ? '#92b466' : '#7f9f55'
        ctx.fillRect(tx * TILE + 5 + (seed * 3) % 18, ty * TILE + 7 + (seed * 5) % 16, 4, 3)
      }
    }
  }

  ;(concept.clearings || []).forEach((clearing, index) => {
    steppedRect(ctx, clearing.x, clearing.y, clearing.w, clearing.h, '#a7c978', '#789b55')
    ctx.fillStyle = index % 2 ? '#f6df8b' : '#f4efe0'
    ctx.fillRect(clearing.x + 10, clearing.y + 12, 4, 4)
    ctx.fillRect(clearing.x + clearing.w - 15, clearing.y + clearing.h - 17, 4, 4)
  })

  concept.paths.forEach((path, index) => {
    steppedRect(ctx, path.x, path.y, path.w, path.h, index % 2 ? '#d0b07b' : '#d6b985', '#b99563')
    ctx.fillStyle = 'rgba(107,74,40,.18)'
    for (let x = path.x + 18; x < path.x + path.w - 8; x += 37) {
      const y = path.y + 14 + ((x + index * 11) % Math.max(18, path.h - 28))
      ctx.fillRect(x, y, 5, 3)
    }
  })

  ;(concept.cliffs || []).forEach((cliff) => {
    ctx.fillStyle = '#6f873e'
    ctx.fillRect(cliff.x, cliff.y, cliff.w, cliff.h)
    ctx.fillStyle = '#b18d59'
    ctx.fillRect(cliff.x, cliff.y + 8, cliff.w, cliff.h - 8)
    ctx.fillStyle = '#765d39'
    for (let x = cliff.x + 10; x < cliff.x + cliff.w; x += 30) ctx.fillRect(x, cliff.y + 14, 14, 4)
  })

  ;(concept.stairs || []).forEach((stairs) => {
    ctx.fillStyle = '#d5bf91'
    ctx.fillRect(stairs.x, stairs.y, stairs.w, stairs.h)
    ctx.fillStyle = '#9f8355'
    for (let y = stairs.y + 6; y < stairs.y + stairs.h; y += 8) ctx.fillRect(stairs.x, y, stairs.w, 3)
  })

  concept.water.forEach((water) => {
    steppedRect(ctx, water.x, water.y, water.w, water.h, '#68b8be', '#d8bd78')
    ctx.fillStyle = '#9cd9d1'
    for (let x = water.x + 20; x < water.x + water.w - 16; x += 48) {
      ctx.fillRect(x, water.y + 25 + (x % 3) * 13, 18, 3)
    }
  })

  concept.bridges.forEach((bridge) => {
    ctx.fillStyle = '#8b5c35'
    ctx.fillRect(bridge.x - 3, bridge.y, bridge.w + 6, bridge.h)
    ctx.fillStyle = '#d29b58'
    ctx.fillRect(bridge.x, bridge.y, bridge.w, bridge.h)
    ctx.fillStyle = '#9a693f'
    for (let x = bridge.x + 6; x < bridge.x + bridge.w; x += 12) ctx.fillRect(x, bridge.y, 3, bridge.h)
  })

  concept.fields.forEach((field, fieldIndex) => {
    steppedRect(ctx, field.x, field.y, field.w, field.h, '#9b653d', '#d3b070')
    for (let y = field.y + 17; y < field.y + field.h - 9; y += 26) {
      ctx.fillStyle = '#754c31'
      ctx.fillRect(field.x + 11, y + 7, field.w - 22, 3)
      for (let x = field.x + 18; x < field.x + field.w - 10; x += 22) {
        ctx.fillStyle = (x / 22 + fieldIndex) % 2 ? '#f2cb58' : '#74b94e'
        ctx.fillRect(x, y - 1, 5, 13)
        ctx.fillRect(x - 3, y + 3, 11, 4)
      }
    }
  })
}

function drawFence(ctx, pen) {
  ctx.strokeStyle = '#6f4a2d'
  ctx.lineWidth = 6
  ctx.strokeRect(pen.x + 3, pen.y + 3, pen.w - 6, pen.h - 6)
  ctx.strokeStyle = '#c28b52'
  ctx.lineWidth = 3
  ctx.strokeRect(pen.x + 3, pen.y + 1, pen.w - 6, pen.h - 6)
  ctx.fillStyle = '#71492e'
  for (let x = pen.x; x <= pen.x + pen.w; x += 31) {
    ctx.fillRect(x, pen.y - 3, 7, 14)
    ctx.fillRect(x, pen.y + pen.h - 10, 7, 14)
  }
  for (let y = pen.y; y <= pen.y + pen.h; y += 31) {
    ctx.fillRect(pen.x - 3, y, 10, 9)
    ctx.fillRect(pen.x + pen.w - 6, y, 10, 9)
  }
  ctx.fillStyle = '#d1b178'
  ctx.fillRect(pen.x + pen.w / 2 - 21, pen.y + pen.h - 10, 42, 15)
}

function drawTree(ctx, x, y, fruit = false) {
  ctx.fillStyle = 'rgba(57,72,32,.24)'
  ctx.fillRect(x - 20, y + 15, 42, 12)
  ctx.fillStyle = '#68462c'
  ctx.fillRect(x - 5, y - 1, 11, 27)
  ctx.fillStyle = '#3f713c'
  ctx.fillRect(x - 22, y - 31, 44, 36)
  ctx.fillStyle = '#5f944f'
  ctx.fillRect(x - 15, y - 40, 30, 40)
  ctx.fillStyle = '#83ad5a'
  ctx.fillRect(x - 7, y - 33, 16, 9)
  if (fruit) {
    ctx.fillStyle = '#ef8552'
    ctx.fillRect(x - 13, y - 19, 7, 7)
    ctx.fillRect(x + 9, y - 10, 7, 7)
  }
}

function drawWindmill(ctx, x, y) {
  ctx.fillStyle = 'rgba(64,53,32,.2)'
  ctx.fillRect(x - 42, y + 30, 84, 13)
  ctx.fillStyle = '#e7d8ad'
  ctx.fillRect(x - 25, y - 12, 50, 52)
  ctx.fillStyle = '#9c5f3e'
  ctx.fillRect(x - 31, y - 20, 62, 14)
  ctx.fillStyle = '#6c432e'
  ctx.fillRect(x - 7, y + 11, 14, 29)
  ctx.save()
  ctx.translate(x, y - 19)
  ctx.fillStyle = '#f1e5bf'
  ctx.fillRect(-4, -49, 8, 98)
  ctx.fillRect(-49, -4, 98, 8)
  ctx.fillStyle = '#b77d4b'
  ctx.fillRect(-7, -7, 14, 14)
  ctx.restore()
}

function drawWell(ctx, x, y) {
  ctx.fillStyle = 'rgba(54,45,27,.22)'
  ctx.fillRect(x - 20, y + 11, 40, 10)
  ctx.fillStyle = '#84725b'
  ctx.fillRect(x - 18, y - 4, 36, 24)
  ctx.fillStyle = '#b7a186'
  ctx.fillRect(x - 14, y, 28, 12)
  ctx.fillStyle = '#513b2f'
  ctx.fillRect(x - 12, y - 15, 4, 18)
  ctx.fillRect(x + 8, y - 15, 4, 18)
  ctx.fillStyle = '#a65f48'
  ctx.fillRect(x - 18, y - 20, 36, 8)
}

function drawBench(ctx, x, y) {
  ctx.fillStyle = 'rgba(54,45,27,.2)'
  ctx.fillRect(x - 24, y + 10, 48, 8)
  ctx.fillStyle = '#6d452b'
  ctx.fillRect(x - 23, y - 4, 46, 6)
  ctx.fillRect(x - 23, y + 5, 46, 7)
  ctx.fillRect(x - 18, y + 12, 5, 8)
  ctx.fillRect(x + 13, y + 12, 5, 8)
  ctx.fillStyle = '#b87943'
  ctx.fillRect(x - 20, y - 2, 40, 3)
  ctx.fillRect(x - 20, y + 7, 40, 3)
}

function drawProduceCart(ctx, x, y) {
  ctx.fillStyle = 'rgba(54,45,27,.2)'
  ctx.fillRect(x - 31, y + 16, 62, 9)
  ctx.fillStyle = '#814b31'
  ctx.fillRect(x - 28, y - 5, 56, 25)
  ctx.fillStyle = '#e9d7a5'
  ctx.fillRect(x - 29, y - 17, 58, 8)
  ctx.fillStyle = '#c95c4f'
  for (let sx = x - 29; sx < x + 29; sx += 14) ctx.fillRect(sx, y - 17, 7, 8)
  ctx.fillStyle = '#efb34f'
  ctx.fillRect(x - 18, y + 1, 9, 7)
  ctx.fillStyle = '#7da84b'
  ctx.fillRect(x - 2, y, 10, 8)
  ctx.fillStyle = '#b8533d'
  ctx.fillRect(x + 13, y + 2, 8, 6)
  ctx.fillStyle = '#4d382a'
  ctx.fillRect(x - 22, y + 17, 10, 10)
  ctx.fillRect(x + 12, y + 17, 10, 10)
}

function drawBorderTrees(ctx) {
  for (let x = 20; x < WIDTH; x += 58) {
    drawTree(ctx, x, 37, x % 3 === 0)
    if (x < 420 || x > 540) drawTree(ctx, x, HEIGHT - 8, false)
  }
  for (let y = 88; y < HEIGHT - 60; y += 66) {
    drawTree(ctx, 19, y, false)
    drawTree(ctx, WIDTH - 19, y, y % 3 === 0)
  }
}

function drawBuilding(ctx, building, images) {
  const img = images[building.asset]
  ctx.fillStyle = 'rgba(54,44,26,.23)'
  ctx.fillRect(building.x + 9, building.y + building.h - 24, building.w - 18, 30)
  if (img) {
    ctx.drawImage(img, building.x, building.y, building.w, building.h)
  } else {
    ctx.fillStyle = building.asset === 'greenhouse' ? '#b8d7b9' : '#b86f51'
    ctx.fillRect(building.x, building.y + 32, building.w, building.h - 32)
    ctx.fillStyle = '#744531'
    ctx.fillRect(building.x - 8, building.y + 20, building.w + 16, 28)
  }
}

const ANIMAL_FRAMES = { cow: 24, pig: 20, sheep: 17, chicken: 16, bunny: 17 }

function drawAnimal(ctx, animal, images) {
  const img = images[animal.asset]
  const frame = ANIMAL_FRAMES[animal.asset] || 20
  const size = animal.asset === 'cow' ? 50 : animal.asset === 'chicken' ? 30 : 38
  ctx.fillStyle = 'rgba(54,44,26,.2)'
  ctx.fillRect(animal.x - size / 2 + 4, animal.y + size / 2 - 8, size - 8, 8)
  if (img) ctx.drawImage(img, 0, 0, frame, frame, animal.x - size / 2, animal.y - size / 2, size, size)
}

function drawSoundItem(ctx, item, now, index, near) {
  const bob = Math.round(Math.sin(now / 420 + index * 1.7) * 5)
  const x = item.x
  const y = item.y + bob
  ctx.save()
  ctx.globalAlpha = .18
  ctx.fillStyle = near ? '#fff4b0' : '#dff7ee'
  ctx.beginPath()
  ctx.arc(x, y, 23, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = near ? '#fff1a0' : '#f7fff5'
  ctx.fillRect(x - 13, y - 13, 26, 26)
  ctx.fillStyle = near ? '#ce7e30' : '#4a8b75'
  ctx.fillRect(x - 5, y - 3, 10, 9)
  ctx.fillRect(x - 10, y - 9, 6, 6)
  ctx.fillRect(x - 2, y - 12, 6, 6)
  ctx.fillRect(x + 6, y - 8, 6, 6)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + 14, y - 17, 4, 4)
  ctx.fillRect(x - 19, y + 5, 3, 3)
  ctx.restore()
}

function drawPlayer(ctx, player, images, now, moving, dir) {
  const row = { down: 0, up: 1, right: 2, left: 3 }[dir]
  const frame = moving ? Math.floor(now / 100) % 8 : 0
  const size = 50
  ctx.fillStyle = 'rgba(44,36,25,.28)'
  ctx.fillRect(player.x - 13, player.y - 6, 26, 8)
  const layers = [images.body, images.clothes, images.hair]
  if (layers.every(Boolean)) {
    layers.forEach((img) => ctx.drawImage(img, frame * 32, row * 32, 32, 32, player.x - size / 2, player.y - size + 8, size, size))
  } else {
    ctx.fillStyle = '#f2cfaa'
    ctx.fillRect(player.x - 11, player.y - 36, 22, 20)
    ctx.fillStyle = '#6f8650'
    ctx.fillRect(player.x - 13, player.y - 17, 26, 23)
  }
}

function drawScene(ctx, concept, images, player, now, moving, dir) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  ctx.imageSmoothingEnabled = false
  drawGround(ctx, concept)
  concept.pens.forEach((pen) => drawFence(ctx, pen))

  concept.orchards.forEach((orchard) => {
    for (let row = 0; row < orchard.rows; row += 1) {
      for (let col = 0; col < orchard.cols; col += 1) drawTree(ctx, orchard.x + col * 72, orchard.y + row * 76, true)
    }
  })

  concept.buildings.forEach((building) => drawBuilding(ctx, building, images))
  concept.extras.forEach((extra) => {
    if (extra.type === 'windmill') drawWindmill(ctx, extra.x, extra.y)
    if (extra.type === 'well') drawWell(ctx, extra.x, extra.y)
    if (extra.type === 'bench') drawBench(ctx, extra.x, extra.y)
    if (extra.type === 'cart') drawProduceCart(ctx, extra.x, extra.y)
    if (extra.type === 'tree') drawTree(ctx, extra.x, extra.y)
  })
  concept.animals.forEach((animal) => drawAnimal(ctx, animal, images))
  drawBorderTrees(ctx)

  let nearest = null
  concept.items.forEach((item, index) => {
    const dist = Math.hypot(item.x - player.x, item.y - player.y)
    if (!nearest || dist < nearest.dist) nearest = { ...item, dist }
    drawSoundItem(ctx, item, now, index, dist < 54)
  })
  drawPlayer(ctx, player, images, now, moving, dir)

  ctx.fillStyle = 'rgba(41,49,25,.08)'
  ctx.fillRect(0, 0, WIDTH, 7)
  ctx.fillRect(0, HEIGHT - 7, WIDTH, 7)
  ctx.fillRect(0, 0, 7, HEIGHT)
  ctx.fillRect(WIDTH - 7, 0, 7, HEIGHT)
  return nearest
}

function FarmMap({ concept, debug, view }) {
  const canvasRef = useRef(null)
  const playerRef = useRef({ ...concept.spawn })
  const keysRef = useRef(new Set())
  const assetsRef = useRef({})
  const directionRef = useRef('up')
  const movingRef = useRef(false)
  const nearLabelRef = useRef(null)
  const [nearItem, setNearItem] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all(Object.entries(ASSET_PATHS).map(([name, src]) => new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve([name, image])
      image.onerror = () => resolve([name, null])
      image.src = src
    }))).then((entries) => {
      if (!cancelled) assetsRef.current = Object.fromEntries(entries)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const down = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
        event.preventDefault()
        keysRef.current.add(event.code)
      }
    }
    const up = (event) => keysRef.current.delete(event.code)
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    let frame
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, .034)
      last = now
      const keys = keysRef.current
      let dx = 0
      let dy = 0
      if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1
      if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1
      if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1
      if (dx && dy) { dx *= .707; dy *= .707 }

      movingRef.current = dx !== 0 || dy !== 0
      if (Math.abs(dx) > Math.abs(dy)) directionRef.current = dx > 0 ? 'right' : 'left'
      else if (dy) directionRef.current = dy > 0 ? 'down' : 'up'

      const player = playerRef.current
      const hitboxAt = (x, y) => ({ x: x - PLAYER_BOX.w / 2, y: y - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h })
      const canMove = (x, y) => {
        const box = hitboxAt(x, y)
        if (box.x < 25 || box.y < 35 || box.x + box.w > WIDTH - 25 || box.y + box.h > HEIGHT - 10) return false
        return !concept.colliders.some((collider) => overlaps(box, collider))
      }
      const nx = player.x + dx * PLAYER_SPEED * dt
      if (canMove(nx, player.y)) player.x = nx
      const ny = player.y + dy * PLAYER_SPEED * dt
      if (canMove(player.x, ny)) player.y = ny

      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        const nearest = drawScene(ctx, concept, assetsRef.current, player, now, movingRef.current, directionRef.current)
        if (debug) {
          ctx.save()
          ctx.strokeStyle = '#ff4f74'
          ctx.lineWidth = 2
          concept.colliders.forEach((box) => ctx.strokeRect(box.x, box.y, box.w, box.h))
          const foot = hitboxAt(player.x, player.y)
          ctx.strokeStyle = '#fff27a'
          ctx.strokeRect(foot.x, foot.y, foot.w, foot.h)
          ctx.restore()
        }
        const nextItem = nearest?.dist < 58 ? nearest : null
        const nextLabel = nextItem?.label || null
        if (nearLabelRef.current !== nextLabel) {
          nearLabelRef.current = nextLabel
          setNearItem(nextItem)
        }
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [concept, debug])

  const handleDpadDown = (event) => {
    keysRef.current.add(event.currentTarget.dataset.code)
  }
  const handleDpadUp = (event) => {
    keysRef.current.delete(event.currentTarget.dataset.code)
  }

  return (
    <div className={styles.mapFrame} style={{ '--concept-accent': concept.accent }}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className={`${styles.canvas} ${view === 'art' ? styles.canvasHidden : ''}`}
        aria-label={`${concept.name} 플레이 가능한 맵 시안`}
        aria-hidden={view === 'art'}
      />
      {view === 'art' && (
        <div className={styles.artBoard}>
          <NextImage
            src={concept.art}
            alt={`${concept.name} 아트 디렉션 보드`}
            fill
            sizes="(max-width: 1040px) 100vw, 70vw"
            priority={concept.number === '01'}
          />
          <div className={styles.artNote}>
            <span>ART DIRECTION</span>
            <b>분위기·랜드마크·색감 기준</b>
            <small>실제 충돌과 동선은 ‘플레이 맵’에서 확인하세요</small>
          </div>
        </div>
      )}
      <div className={styles.mapTint} />
      <div className={styles.mapBadge}><span>ANIMAL VILLAGE</span><b>{concept.short}</b></div>
      {view === 'play' && (
        <div className={styles.questCard}>
          <span className={styles.questDot} />
          <div><small>현재 목표</small><strong>동물 소리 4개를 찾아보세요</strong></div>
          <b>0 / 4</b>
        </div>
      )}
      {view === 'play' && <div className={styles.controlHint}><kbd>WASD</kbd><span>또는 방향키로 직접 걸어보세요</span></div>}
      <div className={`${styles.dpad} ${view === 'art' ? styles.dpadHidden : ''}`} aria-label="화면 방향키">
        <button data-code="ArrowUp" className={styles.dpadUp} onPointerDown={handleDpadDown} onPointerUp={handleDpadUp} onPointerLeave={handleDpadUp} aria-label="위로 이동">▲</button>
        <button data-code="ArrowLeft" className={styles.dpadLeft} onPointerDown={handleDpadDown} onPointerUp={handleDpadUp} onPointerLeave={handleDpadUp} aria-label="왼쪽으로 이동">◀</button>
        <button data-code="ArrowRight" className={styles.dpadRight} onPointerDown={handleDpadDown} onPointerUp={handleDpadUp} onPointerLeave={handleDpadUp} aria-label="오른쪽으로 이동">▶</button>
        <button data-code="ArrowDown" className={styles.dpadDown} onPointerDown={handleDpadDown} onPointerUp={handleDpadUp} onPointerLeave={handleDpadUp} aria-label="아래로 이동">▼</button>
      </div>
      {view === 'play' && nearItem && (
        <div className={styles.soundPrompt}>
          <span className={styles.paw}>♪</span>
          <div><small>소리 아이템 발견</small><strong>{nearItem.label}</strong></div>
          <kbd>SPACE</kbd>
        </div>
      )}
    </div>
  )
}

export default function AnimalVillageConcepts() {
  const [selected, setSelected] = useState(0)
  const [debug, setDebug] = useState(false)
  const [view, setView] = useState('play')
  const concept = CONCEPTS[selected]

  return (
    <main className={styles.page} style={{ '--accent': concept.accent, '--pale': concept.pale }}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>SV</div>
          <div><span>SOUNDMIMIC VILLAGE</span><strong>동물 마을 · 농장 리스킨 3안</strong></div>
        </div>
        <div className={styles.headerMeta}><span>2D TOP-DOWN</span><i /> <span>32PX TILE</span><i /> <span>PLAYABLE</span></div>
      </header>

      <section className={styles.workspace}>
        <div className={styles.leftColumn}>
          <div className={styles.toolbar}>
            <nav className={styles.tabs} aria-label="맵 시안 선택">
              {CONCEPTS.map((item, index) => (
                  <button key={item.id} className={`${styles.tab} ${selected === index ? styles.tabActive : ''}`} onClick={() => setSelected(index)}>
                  <span>{item.number}</span>
                  <div><strong>{item.name}</strong><small>{item.short}</small></div>
                </button>
              ))}
            </nav>
            <div className={styles.viewSwitch} aria-label="맵 보기 방식">
              <button className={view === 'play' ? styles.viewActive : ''} onClick={() => setView('play')} aria-pressed={view === 'play'}>
                <span>▶</span> 플레이 맵
              </button>
              <button className={view === 'art' ? styles.viewActive : ''} onClick={() => setView('art')} aria-pressed={view === 'art'}>
                <span>▦</span> 아트 보드
              </button>
            </div>
          </div>

          <FarmMap key={concept.id} concept={concept} debug={debug} view={view} />
        </div>

        <aside className={styles.panel}>
          <div className={styles.conceptHead}>
            <span className={styles.conceptNumber}>{concept.number}</span>
            <span className={styles.recommend}>{concept.focus}</span>
          </div>
          <p className={styles.kicker}>FARM VILLAGE CONCEPT</p>
          <h1>{concept.name}</h1>
          <p className={styles.caption}>{concept.caption}</p>
          <p className={styles.description}>{concept.description}</p>

          <div className={styles.stats}>
            {concept.stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>

          <div className={styles.sectionTitle}><span>디자인 원칙</span><i /></div>
          <ul className={styles.principles}>
            <li><b>한눈에 마을</b><span>건물 앞마당, 울타리, 동물 우리로 실내가 아닌 야외 마을로 인지</span></li>
            <li><b>막히되 답답하지 않게</b><span>건물·물·작물은 충돌하고, 모든 막힌 곳에는 돌아갈 수 있는 샛길 배치</span></li>
            <li><b>소리가 길잡이</b><span>밝은 발자국 아이템을 시선이 닿는 길목과 랜드마크 근처에 배치</span></li>
          </ul>

          <div className={styles.sectionTitle}><span>게임 연결 규격</span><i /></div>
          <div className={styles.specGrid}>
            <div><small>맵</small><b>30 × 20</b></div>
            <div><small>타일</small><b>32 px</b></div>
            <div><small>시점</small><b>2D 탑다운</b></div>
            <div><small>충돌</small><b>18 × 12 발밑</b></div>
            {concept.clearings && <div><small>소리 공터</small><b>{concept.clearings.length}곳</b></div>}
          </div>

          <label className={`${styles.debugRow} ${view === 'art' ? styles.debugDisabled : ''}`}>
            <span><b>충돌 영역 보기</b><small>분홍 선은 지나갈 수 없는 영역입니다</small></span>
            <input type="checkbox" checked={debug} disabled={view === 'art'} onChange={(event) => setDebug(event.target.checked)} />
            <i />
          </label>

          <p className={styles.note}>세 안 모두 기존 캐릭터·농장 스프라이트와 동일한 픽셀 굵기를 사용했습니다.</p>
        </aside>
      </section>
    </main>
  )
}
