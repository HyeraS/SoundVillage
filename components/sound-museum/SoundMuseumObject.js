'use client'

import Image from 'next/image'

export default function SoundMuseumObject({ asset, animationTick = 0, qa = false }) {
  const commonStyle = {
    position: 'absolute',
    left: asset.x,
    top: asset.y,
    width: asset.displayWidth,
    height: asset.displayHeight,
    imageRendering: 'pixelated',
    transform: asset.flipX ? 'scaleX(-1)' : undefined,
    transformOrigin: 'center bottom',
    pointerEvents: 'none',
  }

  if (asset.animated && asset.frameData?.frames) {
    const frame = animationTick % asset.frameData.frames
    return (
      <div
        data-museum-object={asset.id}
        style={{
          ...commonStyle,
          backgroundImage: `url(${asset.src})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${asset.frameData.frames * 100}% 100%`,
          backgroundPosition: `${frame * (100 / (asset.frameData.frames - 1))}% 0`,
          outline: qa ? '1px solid #42f5e9' : undefined,
        }}
      />
    )
  }

  return (
    <Image
      data-museum-object={asset.id}
      src={asset.src}
      alt=""
      aria-hidden="true"
      width={asset.sourceWidth}
      height={asset.sourceHeight}
      unoptimized
      loading="eager"
      draggable={false}
      sizes={`${Math.ceil(asset.displayWidth)}px`}
      style={{
        ...commonStyle,
        objectFit: 'fill',
        outline: qa ? '1px solid #42f5e9' : undefined,
      }}
    />
  )
}
