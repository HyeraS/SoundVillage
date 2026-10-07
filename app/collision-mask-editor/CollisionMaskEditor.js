'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  analyzeCollisionMask,
  canOccupyCollisionMask,
  createCollisionMask,
  moveOnCollisionMask,
  paintCollisionMaskStroke,
} from '../../lib/collisionMaskEditor.mjs'
import {
  ANIMAL_COLLISION_MASK_CELL_SIZE,
  ANIMAL_COLLISION_MASK_COLUMNS,
  ANIMAL_COLLISION_MASK_ROWS,
  ANIMAL_COLLISION_PLAYER_BOX,
  ANIMAL_COLLISION_SPAWN,
  ANIMAL_WORLD_HEIGHT,
  ANIMAL_WORLD_WIDTH,
  createAnimalRuntimeCollisionMask,
} from '../../lib/animalCollisionMaskEditor.mjs'
import {
  HUMAN_COLLISION_MASK_CELL_SIZE,
  HUMAN_COLLISION_MASK_COLUMNS,
  HUMAN_COLLISION_MASK_ROWS,
  HUMAN_COLLISION_PLAYER_BOX,
  HUMAN_COLLISION_SPAWN,
  HUMAN_WORLD_HEIGHT,
  HUMAN_WORLD_WIDTH,
  createHumanRuntimeCollisionMask,
} from '../../lib/humanCollisionMaskEditor.mjs'
import {
  LAB_COLLISION_MASK_CELL_SIZE,
  LAB_COLLISION_MASK_COLUMNS,
  LAB_COLLISION_MASK_ROWS,
  LAB_COLLISION_PLAYER_BOX,
  LAB_COLLISION_SPAWN,
  LAB_WORLD_HEIGHT,
  LAB_WORLD_WIDTH,
  createLabRuntimeCollisionMask,
} from '../../lib/labCollisionMaskEditor.mjs'
import { NAVIGATION_MASK, isNavigationWalkable } from '../../lib/musicVillageConfig.mjs'
import {
  NATURE_COLLISION_MASK_CELL_SIZE,
  NATURE_COLLISION_MASK_COLUMNS,
  NATURE_COLLISION_MASK_ROWS,
  NATURE_WORLD_HEIGHT,
  NATURE_WORLD_WIDTH,
  createNatureRuntimeCollisionMask,
} from '../../lib/natureCollisionMaskEditor.mjs'
import {
  PLAYER_BOX as NATURE_PLAYER_BOX,
  SPAWN as NATURE_SPAWN,
} from '../../lib/natureFarmLayout.mjs'
import {
  URBAN_COLLISION_MASK_CELL_SIZE,
  URBAN_COLLISION_MASK_COLUMNS,
  URBAN_COLLISION_MASK_ROWS,
  createUrbanRuntimeCollisionMask,
} from '../../lib/urbanCollisionMaskEditor.mjs'
import {
  PLAYER_FOOT_BOX as URBAN_PLAYER_FOOT_BOX,
  SPAWN_POINTS as URBAN_SPAWN_POINTS,
  WORLD_HEIGHT as URBAN_WORLD_HEIGHT,
  WORLD_WIDTH as URBAN_WORLD_WIDTH,
} from '../../lib/urbanV3WorldConfig.mjs'
import styles from './collisionMaskEditor.module.css'
import { screenPointToWorld } from '../../lib/villageWorldTransform.mjs'

const MAX_HISTORY = 30
const DRAFT_ENDPOINT = '/api/internal/collision-mask-draft'
const SELECTED_VILLAGE_KEY = 'soundvillage:collision-mask-editor:selected-village:v1'

const MUSIC_RUNTIME_LAYERS = Object.freeze([
  { src: '/assets/music-village-moonlit-v3/ground/chunk-nw.png', x: 0, y: 0, width: 768, height: 576 },
  { src: '/assets/music-village-moonlit-v3/ground/chunk-ne.png', x: 768, y: 0, width: 768, height: 576 },
  { src: '/assets/music-village-moonlit-v3/ground/chunk-sw.png', x: 0, y: 576, width: 768, height: 576 },
  { src: '/assets/music-village-moonlit-v3/ground/chunk-se.png', x: 768, y: 576, width: 768, height: 576 },
  { src: '/assets/music-village-moonlit-v3/foreground/occlusion.png', x: 0, y: 0, width: 1536, height: 1152 },
])

function createRuntimeMusicMask() {
  return Uint8Array.from(NAVIGATION_MASK, (type) => isNavigationWalkable(type) ? 1 : 0)
}

const VILLAGES = Object.freeze({
  nature: Object.freeze({
    id: 'nature',
    label: '자연마을',
    eyebrow: 'NATURE FARM V2',
    worldWidth: NATURE_WORLD_WIDTH,
    worldHeight: NATURE_WORLD_HEIGHT,
    cellSize: NATURE_COLLISION_MASK_CELL_SIZE,
    columns: NATURE_COLLISION_MASK_COLUMNS,
    rows: NATURE_COLLISION_MASK_ROWS,
    playerFootprint: Object.freeze({ width: NATURE_PLAYER_BOX.w, height: NATURE_PLAYER_BOX.h }),
    spawn: Object.freeze({ x: NATURE_SPAWN.x, y: NATURE_SPAWN.y }),
    runtimeLayers: Object.freeze([
      Object.freeze({
        src: '/assets/world/nature-farm-v2/brookside-bloom-map-v3.png',
        x: 0,
        y: 0,
        width: NATURE_WORLD_WIDTH,
        height: NATURE_WORLD_HEIGHT,
      }),
    ]),
    runtimeBackgroundName: '실제 자연마을 런타임 맵',
    localDraftKey: 'soundvillage:collision-mask-editor:nature:v1',
    exportFilename: 'nature-walkable-mask.png',
    createRuntimeMask: createNatureRuntimeCollisionMask,
  }),
  music: Object.freeze({
    id: 'music',
    label: '음악마을',
    eyebrow: 'MUSIC VILLAGE',
    worldWidth: 1536,
    worldHeight: 1152,
    cellSize: 4,
    columns: 384,
    rows: 288,
    playerFootprint: Object.freeze({ width: 12, height: 8 }),
    spawn: Object.freeze({ x: 784, y: 948 }),
    runtimeLayers: MUSIC_RUNTIME_LAYERS,
    runtimeBackgroundName: '실제 음악마을 런타임 맵',
    localDraftKey: 'soundvillage:collision-mask-editor:music:v1',
    exportFilename: 'music-walkable-mask.png',
    createRuntimeMask: createRuntimeMusicMask,
  }),
  'urban-v3': Object.freeze({
    id: 'urban-v3',
    label: '도시마을',
    eyebrow: 'URBAN V3',
    worldWidth: URBAN_WORLD_WIDTH,
    worldHeight: URBAN_WORLD_HEIGHT,
    cellSize: URBAN_COLLISION_MASK_CELL_SIZE,
    columns: URBAN_COLLISION_MASK_COLUMNS,
    rows: URBAN_COLLISION_MASK_ROWS,
    playerFootprint: Object.freeze({ width: URBAN_PLAYER_FOOT_BOX.w, height: URBAN_PLAYER_FOOT_BOX.h }),
    spawn: Object.freeze({ x: URBAN_SPAWN_POINTS.entrance.x, y: URBAN_SPAWN_POINTS.entrance.y }),
    runtimeLayers: Object.freeze([
      Object.freeze({
        src: '/assets/urban-city-v3/reference/canonical-map-art-runtime.png',
        x: 0,
        y: 0,
        width: URBAN_WORLD_WIDTH,
        height: URBAN_WORLD_HEIGHT,
      }),
    ]),
    runtimeBackgroundName: '실제 Urban V3 런타임 배경',
    localDraftKey: 'soundvillage:collision-mask-editor:urban:v1',
    exportFilename: 'urban-walkable-mask.png',
    createRuntimeMask: createUrbanRuntimeCollisionMask,
  }),
  animal: Object.freeze({
    id: 'animal',
    label: '동물마을',
    eyebrow: 'SUNFLOWER COMMONS V4',
    worldWidth: ANIMAL_WORLD_WIDTH,
    worldHeight: ANIMAL_WORLD_HEIGHT,
    cellSize: ANIMAL_COLLISION_MASK_CELL_SIZE,
    columns: ANIMAL_COLLISION_MASK_COLUMNS,
    rows: ANIMAL_COLLISION_MASK_ROWS,
    playerFootprint: Object.freeze({ width: ANIMAL_COLLISION_PLAYER_BOX.w, height: ANIMAL_COLLISION_PLAYER_BOX.h }),
    spawn: Object.freeze({ x: ANIMAL_COLLISION_SPAWN.x, y: ANIMAL_COLLISION_SPAWN.y }),
    runtimeLayers: Object.freeze([
      Object.freeze({
        src: '/assets/animal-village-sunflower/base-map.png',
        x: 0,
        y: 0,
        width: ANIMAL_WORLD_WIDTH,
        height: ANIMAL_WORLD_HEIGHT,
      }),
      Object.freeze({
        src: '/assets/animal-village-sunflower/foreground-map.png',
        x: 0,
        y: 0,
        width: ANIMAL_WORLD_WIDTH,
        height: ANIMAL_WORLD_HEIGHT,
      }),
    ]),
    runtimeBackgroundName: '실제 동물마을 런타임 맵',
    localDraftKey: 'soundvillage:collision-mask-editor:animal:v1',
    exportFilename: 'animal-walkable-mask.png',
    createRuntimeMask: createAnimalRuntimeCollisionMask,
  }),
  human: Object.freeze({
    id: 'human',
    label: '인간마을',
    eyebrow: 'COMMUNITY HALL PLAZA V2',
    worldWidth: HUMAN_WORLD_WIDTH,
    worldHeight: HUMAN_WORLD_HEIGHT,
    cellSize: HUMAN_COLLISION_MASK_CELL_SIZE,
    columns: HUMAN_COLLISION_MASK_COLUMNS,
    rows: HUMAN_COLLISION_MASK_ROWS,
    playerFootprint: Object.freeze({ width: HUMAN_COLLISION_PLAYER_BOX.w, height: HUMAN_COLLISION_PLAYER_BOX.h }),
    spawn: Object.freeze({ x: HUMAN_COLLISION_SPAWN.x, y: HUMAN_COLLISION_SPAWN.y }),
    runtimeLayers: Object.freeze([
      Object.freeze({
        src: '/assets/human-village/community-map-master-1536x1152-v2.png',
        x: 0,
        y: 0,
        width: HUMAN_WORLD_WIDTH,
        height: HUMAN_WORLD_HEIGHT,
      }),
    ]),
    runtimeBackgroundName: '실제 인간마을 런타임 맵',
    localDraftKey: 'soundvillage:collision-mask-editor:human:v1',
    exportFilename: 'human-walkable-mask.png',
    createRuntimeMask: createHumanRuntimeCollisionMask,
  }),
  lab: Object.freeze({
    id: 'lab',
    label: '실험실마을',
    eyebrow: 'TEAL WITCH LANES',
    worldWidth: LAB_WORLD_WIDTH,
    worldHeight: LAB_WORLD_HEIGHT,
    cellSize: LAB_COLLISION_MASK_CELL_SIZE,
    columns: LAB_COLLISION_MASK_COLUMNS,
    rows: LAB_COLLISION_MASK_ROWS,
    playerFootprint: Object.freeze({ width: LAB_COLLISION_PLAYER_BOX.w, height: LAB_COLLISION_PLAYER_BOX.h }),
    spawn: Object.freeze({ x: LAB_COLLISION_SPAWN.x, y: LAB_COLLISION_SPAWN.y }),
    runtimeLayers: Object.freeze([
      Object.freeze({
        src: '/assets/lab-witch/environment-master-v2.png',
        x: 0,
        y: 0,
        width: LAB_WORLD_WIDTH,
        height: LAB_WORLD_HEIGHT,
      }),
    ]),
    runtimeBackgroundName: '실제 실험실마을 런타임 맵',
    localDraftKey: 'soundvillage:collision-mask-editor:lab:v1',
    exportFilename: 'lab-walkable-mask.png',
    createRuntimeMask: createLabRuntimeCollisionMask,
  }),
})

const TOOLS = Object.freeze({
  blocked: { label: '검게 칠하기 · 이동 불가', value: 0 },
  walkable: { label: '하얗게 칠하기 · 이동 가능', value: 1 },
  test: { label: '테스트 캐릭터 놓기', value: null },
})

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getCanvasWorldPoint(canvas, event, profile) {
  const rect = canvas.getBoundingClientRect()
  const point = screenPointToWorld(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    { zoomX: rect.width / profile.worldWidth, zoomY: rect.height / profile.worldHeight },
  )
  return {
    x: clamp(point.x, 0, profile.worldWidth - 0.001),
    y: clamp(point.y, 0, profile.worldHeight - 0.001),
  }
}

function maskPointFromWorld(point, profile) {
  return {
    x: point.x / profile.worldWidth * profile.columns,
    y: point.y / profile.worldHeight * profile.rows,
  }
}

function loadCanvasImage(src) {
  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve({ image, ok: true })
    image.onerror = () => resolve({ image: null, ok: false })
    image.src = src
  })
}

function encodeMask(mask) {
  const chunks = []
  for (let offset = 0; offset < mask.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...mask.subarray(offset, offset + 0x8000)))
  }
  return window.btoa(chunks.join(''))
}

function decodeMask(maskBase64, profile) {
  const binary = window.atob(maskBase64)
  if (binary.length !== profile.columns * profile.rows) throw new Error('invalid mask length')
  return Uint8Array.from(binary, (character) => character.charCodeAt(0) ? 1 : 0)
}

function triggerDownload(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }, 'image/png')
}

function draftEndpoint(villageId) {
  return `${DRAFT_ENDPOINT}?village=${encodeURIComponent(villageId)}`
}

function draftTimestamp(draft) {
  const timestamp = Date.parse(draft?.updatedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

function VillagePicker({ selectedVillage, onSelectVillage }) {
  return (
    <label className={styles.villagePicker}>
      <span>편집할 마을</span>
      <select value={selectedVillage} onChange={(event) => onSelectVillage(event.target.value)}>
        <option value="nature">자연마을</option>
        <option value="music">음악마을</option>
        <option value="urban-v3">도시마을</option>
        <option value="animal">동물마을</option>
        <option value="human">인간마을</option>
        <option value="lab">실험실마을</option>
      </select>
      <small>마을마다 마스크와 실행 취소 기록, 자동저장 초안이 독립적으로 유지됩니다.</small>
    </label>
  )
}

function VillageMaskWorkspace({ active, onSelectVillage, profile, selectedVillage }) {
  const [mask, setMask] = useState(profile.createRuntimeMask)
  const canvasRef = useRef(null)
  const maskRef = useRef(mask)
  const backgroundLayersRef = useRef([])
  const backgroundObjectUrlRef = useRef(null)
  const strokeStartRef = useRef(null)
  const lastPointRef = useRef(null)
  const historyRef = useRef([])
  const futureRef = useRef([])
  const pressedKeysRef = useRef(new Set())
  const playerRef = useRef(profile.spawn)

  const [tool, setTool] = useState('blocked')
  const [brushSize, setBrushSize] = useState(48)
  const [overlayOpacity, setOverlayOpacity] = useState(62)
  const [showOverlay, setShowOverlay] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState('')
  const [backgroundName, setBackgroundName] = useState(profile.runtimeBackgroundName)
  const [backgroundRevision, setBackgroundRevision] = useState(0)
  const [player, setPlayer] = useState(profile.spawn)
  const [pointerWorld, setPointerWorld] = useState(profile.spawn)
  const [status, setStatus] = useState(`실제 ${profile.label} 배경과 현재 게임 충돌 마스크를 불러왔습니다.`)
  const [analysis, setAnalysis] = useState(null)
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 })
  const [draftReady, setDraftReady] = useState(false)
  const [editRevision, setEditRevision] = useState(0)
  const [saveStatus, setSaveStatus] = useState('초안 확인 중')

  const maskStats = useMemo(() => {
    let walkable = 0
    for (const value of mask) walkable += value
    return {
      walkable,
      blocked: mask.length - walkable,
      walkablePercent: Math.round(walkable / mask.length * 1000) / 10,
    }
  }, [mask])

  const updatePlayer = useCallback((nextPlayer) => {
    playerRef.current = nextPlayer
    setPlayer(nextPlayer)
  }, [])

  const markEdited = useCallback(() => setEditRevision((revision) => revision + 1), [])

  const commitMask = useCallback((nextMask, previousMask, message) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), new Uint8Array(previousMask)]
    futureRef.current = []
    maskRef.current = nextMask
    setMask(nextMask)
    setAnalysis(null)
    setStatus(message)
    setHistoryState({ undo: historyRef.current.length, redo: 0 })
    markEdited()
  }, [markEdited])

  const replaceMask = useCallback((nextMask, message) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), new Uint8Array(maskRef.current)]
    futureRef.current = []
    maskRef.current = nextMask
    setMask(nextMask)
    setAnalysis(null)
    setStatus(message)
    setHistoryState({ undo: historyRef.current.length, redo: 0 })
    markEdited()
  }, [markEdited])

  const undo = useCallback(() => {
    const previous = historyRef.current.at(-1)
    if (!previous) return
    futureRef.current = [new Uint8Array(maskRef.current), ...futureRef.current].slice(0, MAX_HISTORY)
    const restored = new Uint8Array(previous)
    maskRef.current = restored
    setMask(restored)
    historyRef.current = historyRef.current.slice(0, -1)
    setAnalysis(null)
    setStatus('한 단계 되돌렸습니다.')
    setHistoryState({ undo: historyRef.current.length, redo: futureRef.current.length })
    markEdited()
  }, [markEdited])

  const redo = useCallback(() => {
    const next = futureRef.current[0]
    if (!next) return
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), new Uint8Array(maskRef.current)]
    const restored = new Uint8Array(next)
    maskRef.current = restored
    setMask(restored)
    futureRef.current = futureRef.current.slice(1)
    setAnalysis(null)
    setStatus('되돌린 작업을 다시 적용했습니다.')
    setHistoryState({ undo: historyRef.current.length, redo: futureRef.current.length })
    markEdited()
  }, [markEdited])

  useEffect(() => {
    let cancelled = false
    const sources = backgroundUrl
      ? [{ src: backgroundUrl, x: 0, y: 0, width: profile.worldWidth, height: profile.worldHeight }]
      : profile.runtimeLayers

    Promise.all(sources.map(async (layer) => ({ ...layer, ...await loadCanvasImage(layer.src) }))).then((layers) => {
      if (cancelled) return
      const loaded = layers.filter((layer) => layer.ok)
      backgroundLayersRef.current = loaded
      setBackgroundRevision((value) => value + 1)
      if (loaded.length !== layers.length) setStatus(`실제 ${profile.label} 배경 레이어 일부를 읽지 못했습니다.`)
    })
    return () => { cancelled = true }
  }, [backgroundUrl, profile])

  useEffect(() => () => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    const restoreDraft = async () => {
      let serverDraft = null
      let localDraft = null
      try {
        const response = await fetch(draftEndpoint(profile.id), { cache: 'no-store' })
        const result = await response.json()
        if (response.ok && result?.draft) serverDraft = result.draft
      } catch {
        // The browser copy remains available while the development route is offline.
      }

      try {
        localDraft = JSON.parse(window.localStorage.getItem(profile.localDraftKey) || 'null')
      } catch {
        // Ignore invalid browser data and retain the runtime mask or server draft.
      }

      const draft = draftTimestamp(localDraft) > draftTimestamp(serverDraft) ? localDraft : (serverDraft || localDraft)
      if (cancelled) return
      if (draft?.columns === profile.columns && draft?.rows === profile.rows && draft.maskBase64) {
        try {
          const restored = decodeMask(draft.maskBase64, profile)
          maskRef.current = restored
          setMask(restored)
          setAnalysis(null)
          setStatus(`${profile.label}의 마지막 자동저장 초안을 복구했습니다.`)
          setSaveStatus('초안 복구됨')
        } catch {
          setSaveStatus('새 초안')
        }
      } else {
        setSaveStatus('새 초안')
      }
      setDraftReady(true)
    }
    restoreDraft()
    return () => { cancelled = true }
  }, [profile])

  useEffect(() => {
    if (!draftReady || editRevision === 0) return undefined
    const updatedAt = new Date().toISOString()
    const draft = {
      version: 1,
      village: profile.id,
      columns: profile.columns,
      rows: profile.rows,
      maskBase64: encodeMask(mask),
      updatedAt,
    }
    window.localStorage.setItem(profile.localDraftKey, JSON.stringify(draft))
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSaveStatus('저장 중…')
      try {
        const response = await fetch(draftEndpoint(profile.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('draft save failed')
        const result = await response.json()
        const time = result?.updatedAt ? new Date(result.updatedAt) : new Date()
        setSaveStatus(`자동저장 ${time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
      } catch (error) {
        if (error?.name !== 'AbortError') setSaveStatus('브라우저에만 저장됨')
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    draftReady,
    editRevision,
    mask,
    profile.columns,
    profile.id,
    profile.localDraftKey,
    profile.rows,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, profile.worldWidth, profile.worldHeight)
    context.fillStyle = '#d8d1c1'
    context.fillRect(0, 0, profile.worldWidth, profile.worldHeight)

    for (const layer of backgroundLayersRef.current) {
      context.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height)
    }

    if (showOverlay) {
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = profile.columns
      maskCanvas.height = profile.rows
      const maskContext = maskCanvas.getContext('2d')
      const imageData = maskContext.createImageData(profile.columns, profile.rows)
      const alpha = Math.round(overlayOpacity / 100 * 255)
      for (let index = 0; index < mask.length; index += 1) {
        const pixel = index * 4
        if (mask[index] === 1) {
          imageData.data[pixel] = 236
          imageData.data[pixel + 1] = 255
          imageData.data[pixel + 2] = 245
          imageData.data[pixel + 3] = Math.round(alpha * 0.52)
        } else {
          imageData.data[pixel] = 22
          imageData.data[pixel + 1] = 18
          imageData.data[pixel + 2] = 24
          imageData.data[pixel + 3] = alpha
        }
      }
      maskContext.putImageData(imageData, 0, 0)
      context.imageSmoothingEnabled = false
      context.drawImage(maskCanvas, 0, 0, profile.worldWidth, profile.worldHeight)
    }

    if (showGrid) {
      context.save()
      context.strokeStyle = 'rgba(51, 46, 43, 0.22)'
      context.lineWidth = 1
      for (let x = 0; x <= profile.worldWidth; x += 32) {
        context.beginPath()
        context.moveTo(x + 0.5, 0)
        context.lineTo(x + 0.5, profile.worldHeight)
        context.stroke()
      }
      for (let y = 0; y <= profile.worldHeight; y += 32) {
        context.beginPath()
        context.moveTo(0, y + 0.5)
        context.lineTo(profile.worldWidth, y + 0.5)
        context.stroke()
      }
      context.restore()
    }

    context.save()
    context.fillStyle = 'rgba(255, 213, 79, 0.95)'
    context.strokeStyle = '#352f2c'
    context.lineWidth = 4
    context.beginPath()
    context.arc(player.x, player.y - 18, 13, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.fillStyle = 'rgba(255, 213, 79, 0.35)'
    context.fillRect(
      player.x - profile.playerFootprint.width / 2,
      player.y - profile.playerFootprint.height,
      profile.playerFootprint.width,
      profile.playerFootprint.height,
    )
    context.strokeRect(
      player.x - profile.playerFootprint.width / 2,
      player.y - profile.playerFootprint.height,
      profile.playerFootprint.width,
      profile.playerFootprint.height,
    )
    context.restore()
  }, [backgroundRevision, mask, overlayOpacity, player, profile, showGrid, showOverlay])

  useEffect(() => {
    if (!active || tool !== 'test') return undefined
    let animationFrame = 0
    let previousTime = performance.now()
    const pressedKeys = pressedKeysRef.current

    const onKeyDown = (event) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      const key = event.key.toLowerCase()
      if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key)) return
      event.preventDefault()
      pressedKeys.add(key)
    }
    const onKeyUp = (event) => pressedKeys.delete(event.key.toLowerCase())
    const tick = (time) => {
      const deltaSeconds = Math.min(0.05, Math.max(0, (time - previousTime) / 1000))
      previousTime = time
      let x = Number(pressedKeys.has('arrowright') || pressedKeys.has('d')) - Number(pressedKeys.has('arrowleft') || pressedKeys.has('a'))
      let y = Number(pressedKeys.has('arrowdown') || pressedKeys.has('s')) - Number(pressedKeys.has('arrowup') || pressedKeys.has('w'))
      if (x || y) {
        const length = Math.hypot(x, y)
        const speed = 180 * deltaSeconds
        x = x / length * speed
        y = y / length * speed
        updatePlayer(moveOnCollisionMask(
          mask,
          profile.columns,
          profile.rows,
          profile.cellSize,
          playerRef.current,
          profile.playerFootprint,
          { x, y },
        ))
      }
      animationFrame = requestAnimationFrame(tick)
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    animationFrame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(animationFrame)
      pressedKeys.clear()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [active, mask, profile, tool, updatePlayer])

  const paintAtEvent = useCallback((event, fromPoint = null) => {
    const canvas = canvasRef.current
    if (!canvas || TOOLS[tool].value === null) return
    const worldPoint = getCanvasWorldPoint(canvas, event, profile)
    const maskPoint = maskPointFromWorld(worldPoint, profile)
    const previousPoint = fromPoint || maskPoint
    const radius = Math.max(0.75, brushSize / profile.cellSize / 2)
    const painted = paintCollisionMaskStroke(
      maskRef.current,
      profile.columns,
      profile.rows,
      previousPoint,
      maskPoint,
      radius,
      TOOLS[tool].value,
    )
    maskRef.current = painted
    setMask(painted)
    lastPointRef.current = maskPoint
    setPointerWorld(worldPoint)
  }, [brushSize, profile, tool])

  const onPointerDown = (event) => {
    event.preventDefault()
    const canvas = canvasRef.current
    canvas.setPointerCapture(event.pointerId)
    const worldPoint = getCanvasWorldPoint(canvas, event, profile)
    setPointerWorld(worldPoint)

    if (tool === 'test') {
      if (canOccupyCollisionMask(mask, profile.columns, profile.rows, profile.cellSize, worldPoint, profile.playerFootprint)) {
        updatePlayer(worldPoint)
        setStatus('테스트 캐릭터를 배치했습니다. WASD 또는 방향키로 움직여 보세요.')
      } else {
        setStatus('검은 영역이거나 발 크기만큼 여유가 없어 여기에 놓을 수 없습니다.')
      }
      return
    }

    strokeStartRef.current = new Uint8Array(mask)
    lastPointRef.current = maskPointFromWorld(worldPoint, profile)
    paintAtEvent(event)
  }

  const onPointerMove = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setPointerWorld(getCanvasWorldPoint(canvas, event, profile))
    if (!canvas.hasPointerCapture(event.pointerId) || tool === 'test') return
    paintAtEvent(event, lastPointRef.current)
  }

  const onPointerUp = (event) => {
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (!strokeStartRef.current || tool === 'test') return
    const previousMask = strokeStartRef.current
    strokeStartRef.current = null
    lastPointRef.current = null
    commitMask(maskRef.current, previousMask, `${TOOLS[tool].label} 작업을 적용했습니다.`)
  }

  const loadBackground = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    const nextUrl = URL.createObjectURL(file)
    backgroundObjectUrlRef.current = nextUrl
    setBackgroundUrl(nextUrl)
    setBackgroundName(file.name)
    setStatus('배경 이미지만 교체했습니다. 마스크는 그대로 유지됩니다.')
    event.target.value = ''
  }

  const restoreRuntimeBackground = () => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    backgroundObjectUrlRef.current = null
    setBackgroundUrl('')
    setBackgroundName(profile.runtimeBackgroundName)
    setStatus(`실제 ${profile.label} 런타임 배경으로 돌아왔습니다.`)
  }

  const importMask = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = profile.columns
      canvas.height = profile.rows
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.imageSmoothingEnabled = false
      context.drawImage(bitmap, 0, 0, profile.columns, profile.rows)
      const pixels = context.getImageData(0, 0, profile.columns, profile.rows).data
      const imported = createCollisionMask(profile.columns, profile.rows, 0)
      for (let index = 0; index < imported.length; index += 1) {
        const pixel = index * 4
        const luminance = pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722
        imported[index] = pixels[pixel + 3] >= 128 && luminance >= 128 ? 1 : 0
      }
      bitmap.close()
      replaceMask(imported, `${file.name}을 불러왔습니다. 밝은 픽셀은 이동 가능으로 해석했습니다.`)
    } catch {
      setStatus('마스크 PNG를 읽지 못했습니다.')
    }
    event.target.value = ''
  }

  const exportMask = () => {
    const canvas = document.createElement('canvas')
    canvas.width = profile.columns
    canvas.height = profile.rows
    const context = canvas.getContext('2d')
    const imageData = context.createImageData(profile.columns, profile.rows)
    for (let index = 0; index < mask.length; index += 1) {
      const color = mask[index] ? 255 : 0
      const pixel = index * 4
      imageData.data[pixel] = color
      imageData.data[pixel + 1] = color
      imageData.data[pixel + 2] = color
      imageData.data[pixel + 3] = 255
    }
    context.putImageData(imageData, 0, 0)
    triggerDownload(canvas, profile.exportFilename)
    setStatus(`${profile.exportFilename}을 ${profile.columns}×${profile.rows}로 저장했습니다. 흰색=이동 가능, 검은색=이동 불가입니다.`)
  }

  const runAnalysis = () => {
    const result = analyzeCollisionMask(mask, profile.columns, profile.rows)
    setAnalysis(result)
    setStatus(result.connectedAreas === 1
      ? '검사 완료: 모든 흰색 영역이 하나로 연결되어 있습니다.'
      : `검사 완료: 흰색 영역이 ${result.connectedAreas.toLocaleString()}개로 분리되어 있습니다.`)
  }

  const restoreRuntimeMask = () => {
    replaceMask(profile.createRuntimeMask(), `현재 게임의 ${profile.label} 충돌 마스크를 다시 불러왔습니다.`)
  }

  const movePlayerToSpawn = () => {
    if (canOccupyCollisionMask(mask, profile.columns, profile.rows, profile.cellSize, profile.spawn, profile.playerFootprint)) {
      updatePlayer(profile.spawn)
      setStatus(`${profile.label} 시작 위치로 테스트 캐릭터를 옮겼습니다.`)
    } else {
      setStatus('현재 마스크에서는 기본 시작 위치가 막혀 있습니다.')
    }
  }

  return (
    <main className={styles.page} aria-hidden={!active}>
      <VillagePicker selectedVillage={selectedVillage} onSelectVillage={onSelectVillage} />

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>INTERNAL MAP TOOL · {profile.eyebrow}</p>
          <h1>충돌 마스크 편집기</h1>
          <p>보이는 길 위를 하얗게, 건물과 장애물은 검게 칠하세요. 이 페이지는 원격 DB나 게임 데이터를 수정하지 않습니다.</p>
        </div>
        <div className={styles.headerMetrics} aria-label="마스크 요약">
          <span><b>{maskStats.walkablePercent}%</b> 이동 가능</span>
          <span><b>{profile.columns}×{profile.rows}</b> 출력 크기</span>
          <span><b className={styles.saveState}>{saveStatus}</b> 새로고침·재시작 복구</span>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="편집 도구">
        <div className={styles.toolGroup}>
          {Object.entries(TOOLS).map(([key, item]) => (
            <button key={key} type="button" className={tool === key ? styles.activeTool : ''} onClick={() => setTool(key)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className={styles.rangeControl}>
          붓 {brushSize}px
          <input type="range" min="8" max="160" step="4" value={brushSize} disabled={tool === 'test'} onChange={(event) => setBrushSize(Number(event.target.value))} />
        </label>
        <label className={styles.rangeControl}>
          덮개 {overlayOpacity}%
          <input type="range" min="10" max="90" step="2" value={overlayOpacity} onChange={(event) => setOverlayOpacity(Number(event.target.value))} />
        </label>
        <label className={styles.checkControl}><input type="checkbox" checked={showOverlay} onChange={(event) => setShowOverlay(event.target.checked)} /> 마스크 보기</label>
        <label className={styles.checkControl}><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> 32px 격자</label>
      </section>

      <div className={styles.workspace}>
        <section className={styles.canvasPanel}>
          <div className={styles.canvasFrame} data-tool={tool}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              width={profile.worldWidth}
              height={profile.worldHeight}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onContextMenu={(event) => event.preventDefault()}
              aria-label={`${profile.label} 충돌 마스크 편집 캔버스`}
            />
            <div className={styles.coordinate}>x {Math.round(pointerWorld.x)} · y {Math.round(pointerWorld.y)}</div>
          </div>
          <div className={styles.legend}>
            <span><i className={styles.whiteSwatch} />흰색: 이동 가능</span>
            <span><i className={styles.blackSwatch} />검은색: 이동 불가</span>
            <span><i className={styles.playerSwatch} />노란 점: 테스트 캐릭터</span>
          </div>
          <p className={styles.status} role="status">{status}</p>
        </section>

        <aside className={styles.inspector}>
          <section>
            <h2>파일</h2>
            <p className={styles.fileName}>{backgroundName}</p>
            <label className={styles.fileButton}>다른 배경 이미지 불러오기<input type="file" accept="image/png,image/jpeg,image/webp" onChange={loadBackground} /></label>
            <button type="button" onClick={restoreRuntimeBackground}>실제 {profile.label} 배경으로 복원</button>
            <label className={styles.fileButton}>기존 마스크 PNG 불러오기<input type="file" accept="image/png" onChange={importMask} /></label>
            <button type="button" className={styles.primaryButton} onClick={exportMask}>{profile.exportFilename} 저장</button>
          </section>

          <section>
            <h2>편집</h2>
            <div className={styles.buttonRow}>
              <button type="button" disabled={!historyState.undo} onClick={undo}>되돌리기</button>
              <button type="button" disabled={!historyState.redo} onClick={redo}>다시하기</button>
            </div>
            <div className={styles.buttonRow}>
              <button type="button" onClick={restoreRuntimeMask}>현재 게임 마스크 복원</button>
              <button type="button" onClick={() => replaceMask(createCollisionMask(profile.columns, profile.rows, 1), '전체를 이동 가능(흰색)으로 채웠습니다.')}>전체 흰색</button>
            </div>
            <button type="button" onClick={() => replaceMask(createCollisionMask(profile.columns, profile.rows, 0), '전체를 이동 불가(검은색)로 채웠습니다.')}>전체 검정</button>
            <button type="button" onClick={() => replaceMask(Uint8Array.from(mask, (value) => value ? 0 : 1), '흰색과 검은색을 뒤집었습니다.')}>흑백 반전</button>
          </section>

          <section>
            <h2>이동 테스트</h2>
            <p>‘테스트 캐릭터 놓기’를 선택해 맵을 클릭한 뒤 WASD 또는 방향키를 누르세요.</p>
            <dl className={styles.dataList}>
              <div><dt>캐릭터 발 위치</dt><dd>{Math.round(player.x)}, {Math.round(player.y)}</dd></div>
              <div><dt>충돌 박스</dt><dd>{profile.playerFootprint.width}×{profile.playerFootprint.height}px</dd></div>
              <div><dt>셀 크기</dt><dd>{profile.cellSize}px</dd></div>
            </dl>
            <button type="button" onClick={movePlayerToSpawn}>기본 시작 위치로</button>
          </section>

          <section>
            <h2>연결 검사</h2>
            <p>흰색 길이 여러 조각으로 끊겼는지 확인합니다.</p>
            <button type="button" onClick={runAnalysis}>흰색 영역 검사</button>
            {analysis && (
              <dl className={styles.dataList}>
                <div><dt>흰색 영역 수</dt><dd className={analysis.connectedAreas === 1 ? styles.good : styles.warning}>{analysis.connectedAreas.toLocaleString()}개</dd></div>
                <div><dt>가장 큰 영역</dt><dd>{Math.round(analysis.largestAreaRatio * 1000) / 10}%</dd></div>
                <div><dt>막힌 셀</dt><dd>{analysis.blockedCells.toLocaleString()}개</dd></div>
              </dl>
            )}
          </section>

          <section className={styles.note}>
            <h2>중요</h2>
            <p>저장한 PNG는 아직 게임에 자동 적용되지 않습니다. 편집과 PNG 생성만 하며, 런타임 충돌 설정은 변경하지 않습니다.</p>
          </section>
        </aside>
      </div>
    </main>
  )
}

export default function CollisionMaskEditor() {
  const [selectedVillage, setSelectedVillage] = useState(null)
  const [visitedVillages, setVisitedVillages] = useState([])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedVillage = window.localStorage.getItem(SELECTED_VILLAGE_KEY)
      const initialVillage = VILLAGES[storedVillage] ? storedVillage : 'music'
      setSelectedVillage(initialVillage)
      setVisitedVillages([initialVillage])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const selectVillage = useCallback((villageId) => {
    if (!VILLAGES[villageId]) return
    window.localStorage.setItem(SELECTED_VILLAGE_KEY, villageId)
    setSelectedVillage(villageId)
    setVisitedVillages((visited) => visited.includes(villageId) ? visited : [...visited, villageId])
  }, [])

  if (!selectedVillage) {
    return (
      <main className={`${styles.page} ${styles.loadingPage}`}>
        <p>마지막으로 선택한 마을과 자동저장 초안을 확인하고 있습니다.</p>
      </main>
    )
  }

  return visitedVillages.map((villageId) => (
    <div key={villageId} hidden={selectedVillage !== villageId}>
      <VillageMaskWorkspace
        active={selectedVillage === villageId}
        onSelectVillage={selectVillage}
        profile={VILLAGES[villageId]}
        selectedVillage={selectedVillage}
      />
    </div>
  ))
}
