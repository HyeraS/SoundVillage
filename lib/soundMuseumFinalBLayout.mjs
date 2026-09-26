export const MUSEUM_WORLD_WIDTH = 1672
export const MUSEUM_WORLD_HEIGHT = 941

export const PLAYER_BODY = { width: 30, height: 42 }
export const PLAYER_SPRITE = { width: 86, height: 108 }
export const PLAYER_SPEED = 5.4
export const MUSEUM_SPAWN = { x: 821, y: 838 }
export const MUSEUM_BOUNDS = { minX: 28, maxX: 1644, minY: 244, maxY: 914 }

const asset = (entry) => ({
  anchorX: 0,
  anchorY: 0,
  collision: null,
  interactionId: null,
  animated: false,
  frameData: null,
  ...entry,
})

// Coordinates were measured against 05-final-b-l-shaped-listening-lounge.png
// at its native 1672x941 logical resolution. Transparent source padding is not
// used for physics; each physical AABB below tracks the visible floor contact.
export const MUSEUM_ASSETS = [
  asset({
    id: 'architecture-room-shell',
    src: '/assets/sound-museum-final-b/architecture/room-shell@2x.png',
    sourceWidth: 3344, sourceHeight: 1882,
    displayWidth: 1672, displayHeight: 941,
    x: 0, y: 0, zMode: 'fixed',
  }),
  asset({
    id: 'center-waveform-frame',
    src: '/assets/sound-museum-final-b/center-archive/waveform-frame.png',
    sourceWidth: 1650, sourceHeight: 772,
    displayWidth: 174, displayHeight: 81,
    x: 749, y: 59, zMode: 'fixed',
  }),
  asset({
    id: 'left-listening-lounge',
    src: '/assets/sound-museum-final-b/left-listening/l-shaped-listening-lounge.png',
    sourceWidth: 1317, sourceHeight: 1156,
    displayWidth: 526, displayHeight: 462,
    x: 22, y: 116, zMode: 'footY',
    collision: [
      // Counter faces and the five stool feet only. The former broad boxes
      // covered visible hardwood below the L and made the room feel partitioned.
      { x: 43, y: 349, width: 108, height: 82 },
      { x: 111, y: 318, width: 386, height: 64 },
      { x: 62, y: 397, width: 40, height: 38 },
      { x: 102, y: 430, width: 40, height: 38 },
      { x: 174, y: 371, width: 50, height: 43 },
      { x: 267, y: 371, width: 50, height: 43 },
      { x: 360, y: 371, width: 50, height: 43 },
    ],
    interactionId: 'vote',
  }),
  asset({
    id: 'owl-curator',
    src: '/assets/sound-museum-final-b/center-archive/owl-curator-idle-4f.png',
    sourceWidth: 2172, sourceHeight: 724,
    displayWidth: 112, displayHeight: 152,
    x: 780, y: 173, zMode: 'fixed',
    animated: true,
    frameData: { frames: 4, direction: 'horizontal', durationMs: 2600 },
  }),
  asset({
    id: 'curator-desk-ledger',
    src: '/assets/sound-museum-final-b/center-archive/curator-desk-ledger.png',
    sourceWidth: 1423, sourceHeight: 979,
    displayWidth: 520, displayHeight: 358,
    x: 527, y: 188, zMode: 'footY',
    collision: [
      { x: 666, y: 307, width: 365, height: 112 },
      { x: 556, y: 393, width: 78, height: 118 },
    ],
    interactionId: 'exhibits',
  }),
  asset({
    id: 'costume-shop',
    src: '/assets/sound-museum-final-b/right-shop/costume-shop.png',
    sourceWidth: 1300, sourceHeight: 1117,
    displayWidth: 520, displayHeight: 447,
    x: 1119, y: 120, zMode: 'footY',
    collision: [
      { x: 1190, y: 267, width: 410, height: 92 },
      { x: 1218, y: 354, width: 345, height: 77 },
      { x: 1358, y: 427, width: 235, height: 73 },
      { x: 1110, y: 391, width: 70, height: 45 },
      { x: 1575, y: 356, width: 60, height: 85 },
    ],
    interactionId: 'shop',
  }),
  asset({
    id: 'shop-mannequin-two',
    src: '/assets/sound-museum-final-b/right-shop/mannequin-vest-skirt.png',
    sourceWidth: 877, sourceHeight: 1399,
    displayWidth: 105, displayHeight: 168,
    x: 1088, y: 284, zMode: 'footY',
    collision: { x: 1111, y: 408, width: 62, height: 40 },
  }),
  asset({
    id: 'reading-lounge-left',
    src: '/assets/sound-museum-final-b/lounge/reading-lounge.png',
    sourceWidth: 1758, sourceHeight: 873,
    displayWidth: 430, displayHeight: 214,
    x: 127, y: 608, zMode: 'footY',
    collision: [
      { x: 148, y: 675, width: 105, height: 100 },
      { x: 260, y: 704, width: 72, height: 60 },
      { x: 341, y: 675, width: 105, height: 100 },
    ],
  }),
  asset({
    id: 'reading-lounge-right',
    src: '/assets/sound-museum-final-b/lounge/reading-lounge.png',
    sourceWidth: 1758, sourceHeight: 873,
    displayWidth: 430, displayHeight: 214,
    x: 1115, y: 608, zMode: 'footY',
    collision: [
      { x: 1150, y: 675, width: 105, height: 100 },
      { x: 1310, y: 704, width: 72, height: 60 },
      { x: 1392, y: 675, width: 105, height: 100 },
    ],
    flipX: true,
  }),
  asset({
    id: 'foreground-rail-bookshelf',
    src: '/assets/sound-museum-final-b/foreground/rail-bookshelf.png',
    sourceWidth: 4278, sourceHeight: 1360,
    displayWidth: 1650, displayHeight: 524,
    x: 11, y: 520, zMode: 'foreground',
    collision: [
      { x: 24, y: 788, width: 680, height: 102 },
      { x: 968, y: 788, width: 680, height: 102 },
    ],
  }),
]

export const MUSEUM_COLLISIONS = MUSEUM_ASSETS.flatMap(item => {
  const rects = item.collision ? (Array.isArray(item.collision) ? item.collision : [item.collision]) : []
  return rects.map((rect, index) => ({ ...rect, id: `${item.id}:${index}` }))
})

export const MUSEUM_INTERACTIONS = [
  { id: 'vote-1', interactionId: 'vote', card: 'vote', prompt: '🎧 소리 듣고 투표하기', x: 194, y: 542, width: 76, height: 68 },
  { id: 'vote-2', interactionId: 'vote', card: 'vote', prompt: '🎧 소리 듣고 투표하기', x: 287, y: 542, width: 76, height: 68 },
  { id: 'vote-3', interactionId: 'vote', card: 'vote', prompt: '🎧 소리 듣고 투표하기', x: 380, y: 542, width: 76, height: 68 },
  { id: 'vote-4', interactionId: 'vote', card: 'vote', prompt: '🎧 소리 듣고 투표하기', x: 181, y: 381, width: 72, height: 67 },
  { id: 'vote-5', interactionId: 'vote', card: 'vote', prompt: '🎧 소리 듣고 투표하기', x: 181, y: 458, width: 72, height: 67 },
  { id: 'exhibits-desk', interactionId: 'exhibits', card: 'exhibits', prompt: '📖 전시 현황 보기', x: 694, y: 438, width: 300, height: 100 },
  { id: 'exhibits-ledger', interactionId: 'exhibits', card: 'exhibits', prompt: '📖 전시 현황 보기', x: 522, y: 520, width: 132, height: 86 },
  { id: 'shop-counter', interactionId: 'shop', card: 'shop', prompt: '🛍️ 상점 둘러보기', x: 1214, y: 528, width: 352, height: 92 },
]

export const LISTENING_STATIONS = MUSEUM_INTERACTIONS.filter(zone => zone.interactionId === 'vote')
export const EXHIBIT_ZONES = ['Animal', 'Nature', 'Lab', 'Urban', 'Music', 'Human'].map((zone, index) => ({
  id: `exhibit-${zone.toLowerCase()}`,
  zone,
  x: [333, 398, 463, 333, 398, 463][index],
  y: [157, 157, 157, 226, 226, 226][index],
}))

// Representative centres of every visually continuous hardwood aisle. Tests
// flood-fill to these points so future art/collision edits cannot silently
// reintroduce invisible partitions across the floor.
export const MUSEUM_HARDWOOD_WAYPOINTS = [
  { id: 'left-return-floor', x: 70, y: 520 },
  { id: 'left-lounge-front', x: 270, y: 500 },
  { id: 'left-center-aisle', x: 470, y: 570 },
  { id: 'ledger-aisle', x: 620, y: 600 },
  { id: 'medallion-north', x: 805, y: 465 },
  { id: 'medallion-west', x: 680, y: 575 },
  { id: 'medallion-east', x: 1000, y: 575 },
  { id: 'shop-front', x: 1220, y: 555 },
  { id: 'shop-right-aisle', x: 1580, y: 555 },
  { id: 'left-reading-aisle', x: 300, y: 620 },
  { id: 'right-reading-aisle', x: 1320, y: 620 },
]

export const CARD_LAYOUTS = {
  vote: { width: 720, height: 820 },
  exhibits: { width: 430, height: 640 },
  shop: { width: 470, height: 650 },
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function pointInWorld(rect) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= MUSEUM_WORLD_WIDTH && rect.y + rect.height <= MUSEUM_WORLD_HEIGHT
}
