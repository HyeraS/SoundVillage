export const VILLAGE_CURRENCY_ICON_SRC = Object.freeze({
  Animal: '/assets/economy/village-currencies/animal.png',
  Human: '/assets/economy/village-currencies/human.png',
  Nature: '/assets/economy/village-currencies/nature.png',
  Urban: '/assets/economy/village-currencies/urban.png',
  Music: '/assets/economy/village-currencies/music.png',
  Lab: '/assets/economy/village-currencies/lab.png',
})

const imageCache = new Map()

export function getVillageCurrencyIconImage(village) {
  const src = VILLAGE_CURRENCY_ICON_SRC[village]
  if (!src || typeof window === 'undefined') return null
  if (!imageCache.has(village)) {
    const image = new window.Image()
    image.decoding = 'async'
    image.src = src
    imageCache.set(village, image)
  }
  const image = imageCache.get(village)
  return image.complete && image.naturalWidth > 0 ? image : null
}

export function drawVillageCurrencyIcon(ctx, village, x, y, { size = 32, alpha = 1 } = {}) {
  const image = getVillageCurrencyIconImage(village)
  if (!image) return false
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, Math.round(x - size / 2), Math.round(y - size / 2), size, size)
  ctx.restore()
  return true
}
