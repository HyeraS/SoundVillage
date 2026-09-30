import Image from 'next/image'

const VILLAGE_INFO = Object.freeze({
  Animal: { ko: '\uB3D9\uBB3C', src: '/assets/economy/village-currencies/animal.png' },
  Human: { ko: '\uC778\uAC04', src: '/assets/economy/village-currencies/human.png' },
  Nature: { ko: '\uC790\uC5F0', src: '/assets/economy/village-currencies/nature.png' },
  Urban: { ko: '\uB3C4\uC2DC', src: '/assets/economy/village-currencies/urban.png' },
  Music: { ko: '\uC74C\uC545', src: '/assets/economy/village-currencies/music.png' },
  Lab: { ko: '\uC5F0\uAD6C', src: '/assets/economy/village-currencies/lab.png' },
})

export const VILLAGE_ORDER = Object.freeze(Object.keys(VILLAGE_INFO))
export const villageKoreanName = (village) => VILLAGE_INFO[village]?.ko || village

export default function VillageCurrencyIcon({ village, size = 24, className = '', style }) {
  const info = VILLAGE_INFO[village]
  if (!info) return null
  return (
    <Image
      className={className}
      style={style}
      src={info.src}
      width={size}
      height={size}
      alt={`${info.ko} \uD654\uD3D0`}
      title={`${info.ko} \uD654\uD3D0`}
      draggable="false"
      unoptimized
    />
  )
}
