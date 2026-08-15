'use client'

// 자연 마을 — Tiled JSON(public/assets/maps/nature_village.tmj)을 그대로 읽어서
// <canvas>에 그리는 최소 로더. 동물 마을(ZoneMap.js)과는 완전히 독립된 별도 경로.
// Phaser 연동 전, 실제 생성된 맵 데이터가 맞는지 눈으로 확인하기 위한 페이지.
import { useEffect, useRef, useState } from 'react'

const MAP_URL = '/assets/maps/nature_village.tmj'
const TILE = 16

export default function NatureVillagePage() {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('불러오는 중...')
  const [scale, setScale] = useState(2)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const res = await fetch(MAP_URL)
      if (!res.ok) { setStatus(`맵 로드 실패 (${res.status})`); return }
      const map = await res.json()

      // 시트 이미지 미리 로드 (firstgid 기준 tileset과 매칭)
      const loadImage = (src) => new Promise((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })

      const tilesetImages = await Promise.all(
        map.tilesets.map(async (ts) => {
          if (ts.image) {
            const img = await loadImage(ts.image.replace('../', '/assets/'))
            return { ...ts, img }
          }
          // collection-of-images tileset (structures)
          const tiles = await Promise.all(
            ts.tiles.map(async (t) => ({ ...t, img: await loadImage(t.image.replace('../', '/assets/')) }))
          )
          return { ...ts, tiles }
        })
      )
      if (cancelled) return

      const tilesetFor = (gid) => {
        let best = null
        for (const ts of tilesetImages) {
          if (gid >= ts.firstgid && (!best || ts.firstgid > best.firstgid)) best = ts
        }
        return best
      }

      const canvas = canvasRef.current
      canvas.width = map.width * TILE
      canvas.height = map.height * TILE
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false

      for (const layer of map.layers) {
        if (layer.type === 'tilelayer') {
          for (let i = 0; i < layer.data.length; i++) {
            const gid = layer.data[i]
            if (!gid) continue
            const ts = tilesetFor(gid)
            if (!ts) continue
            const local = gid - ts.firstgid
            const col = local % ts.columns
            const row = Math.floor(local / ts.columns)
            const sx = col * TILE, sy = row * TILE
            const dx = (i % map.width) * TILE, dy = Math.floor(i / map.width) * TILE
            ctx.drawImage(ts.img, sx, sy, TILE, TILE, dx, dy, TILE, TILE)
          }
        } else if (layer.type === 'objectgroup' && layer.name !== 'collision') {
          for (const obj of layer.objects) {
            const ts = tilesetFor(obj.gid)
            if (!ts) continue
            const tile = ts.tiles.find((t) => ts.firstgid + t.id === obj.gid)
            if (!tile) continue
            // Tiled tile-objects anchor bottom-left: draw at (x, y - height)
            ctx.drawImage(tile.img, obj.x, obj.y - obj.height, obj.width, obj.height)
          }
        }
      }

      setStatus(`로드 완료 — ${map.width}x${map.height} 타일, 레이어 ${map.layers.length}개`)
    }

    run().catch((e) => setStatus('에러: ' + e.message))
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#1b1e24', color: '#eceef2', padding: 20, fontFamily: 'ui-sans-serif, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <a href="/" style={{ color: '#8fbf7a', textDecoration: 'none', fontSize: 13 }}>← 홈</a>
        <h1 style={{ fontSize: 16, margin: 0 }}>자연 마을 (Nature Village) — 독립 맵 미리보기</h1>
        <span style={{ fontSize: 12, color: '#93a0b0' }}>{status}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setScale((s) => Math.max(1, s - 0.5))} style={btnStyle}>-</button>
          <span style={{ fontSize: 12, width: 40, textAlign: 'center' }}>{scale}x</span>
          <button onClick={() => setScale((s) => Math.min(4, s + 0.5))} style={btnStyle}>+</button>
        </div>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid #323844', borderRadius: 8, maxHeight: '82vh' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', imageRendering: 'pixelated', width: 768 * scale, height: 576 * scale }}
          width={768}
          height={576}
        />
      </div>
    </div>
  )
}

const btnStyle = {
  width: 24, height: 24, borderRadius: 4, border: '1px solid #323844',
  background: '#23272f', color: '#eceef2', cursor: 'pointer', fontSize: 14, lineHeight: '1',
}
