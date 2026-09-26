'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './page.module.css'

// Isolated design-only whitebox. This route intentionally imports no game data,
// Supabase client, annotation API, reward code, or production Music map module.
const TILE = 32
const MAP_W = 48
const MAP_H = 36
const LANDMARK_ROOT = '/design-previews/music-landmarks-b2'
const B3_ROOT = '/design-previews/music-buildings-props-b3'

const STAGE_LAYER_LABELS = {
  shadow: 'shadow', base: 'base', rear: 'rear', opening: 'opening', canopy: 'canopy', trim: 'trim', stair: 'stair', foreground: 'foreground',
}

const GATE_LAYER_LABELS = {
  shadow: 'shadow', posts: 'posts', top: 'rail/canopy', trim: 'trim', foreground: 'foreground',
}

const BUILDING_LAYER_LABELS = {
  'contact-shadow': 'shadow', body: 'body', roof: 'roof', 'door-window': 'door/window', trim: 'trim', foreground: 'foreground', emissive: 'emissive',
}

const VIEWPORTS = {
  overview: { label: '1536×1152 전체', tilesW: 48, tilesH: 36 },
  laptop: { label: '노트북 24×18', tilesW: 24, tilesH: 18 },
  portrait: { label: '모바일 세로 14×25', tilesW: 14, tilesH: 25 },
  landscape: { label: '모바일 가로 28×13', tilesW: 28, tilesH: 13 },
}

const FOCUSES = {
  start: { label: '시작 지점', x: 24, y: 29 },
  center: { label: '공명 정원', x: 24, y: 19 },
  stage: { label: '메인 무대', x: 24, y: 8 },
  archive: { label: 'Archive', x: 8, y: 8 },
  cafe: { label: 'Cafe', x: 40, y: 8 },
  studio: { label: 'Studio', x: 8, y: 29 },
  workshop: { label: 'Workshop', x: 40, y: 29 },
}

const MARKER_STATES = {
  locked: { label: 'Locked', glyph: '▣', color: '#7d7894', ring: '8 7', motion: 'none' },
  unavailable: { label: 'Unavailable', glyph: '◇', color: '#9a91b0', ring: '3 7', motion: 'none' },
  active: { label: 'Active', glyph: '≈', color: '#7ee7f2', ring: '', motion: 'pulse' },
  nearby: { label: 'Nearby / Interactable', glyph: '≈', color: '#ffe18a', ring: '', motion: 'nearby' },
  interacting: { label: 'Interacting', glyph: 'Ⅱ', color: '#d4b2ff', ring: '', motion: 'none' },
  submitting: { label: 'Submitting', glyph: '↻', color: '#ffd166', ring: '4 4', motion: 'spin' },
  completed: { label: 'Completed', glyph: '✓', color: '#8f9bb3', ring: '', motion: 'none' },
  saveError: { label: 'Save error', glyph: '!', color: '#ff8f8f', ring: '2 5', motion: 'none' },
  audioError: { label: 'Technical audio error', glyph: '≁', color: '#ffb36b', ring: '9 4', motion: 'none' },
}

const INITIAL_MARKERS = [
  { id: 'M01', x: 24, y: 29, state: 'nearby' },
  { id: 'M02', x: 19, y: 28, state: 'active' },
  { id: 'M03', x: 14, y: 25, state: 'active' },
  { id: 'M04', x: 10, y: 21, state: 'completed' },
  { id: 'M05', x: 10, y: 16, state: 'active' },
  // 2C-A density adjustment: keep the marker accessible on the upper loop while
  // removing it from the 24×18 center camera (8 active markers -> 7).
  { id: 'M06', x: 16, y: 8, state: 'active' },
  { id: 'M07', x: 19, y: 12, state: 'unavailable' },
  { id: 'M08', x: 24, y: 13, state: 'locked' },
  { id: 'M09', x: 29, y: 12, state: 'active' },
  { id: 'M10', x: 34, y: 14, state: 'active' },
  { id: 'M11', x: 38, y: 19, state: 'active' },
  { id: 'M12', x: 36, y: 24, state: 'completed' },
  { id: 'M13', x: 31, y: 28, state: 'active' },
  { id: 'M14', x: 21, y: 19, state: 'active' },
  { id: 'M15', x: 27, y: 19, state: 'active' },
]

const BUILDINGS = [
  { id: 'archive', label: 'RECORD ARCHIVE', x: 3, y: 4, w: 10, h: 6, tone: 'cyan' },
  { id: 'listening', label: 'LISTENING CAFE', x: 35, y: 4, w: 10, h: 6, tone: 'pink' },
  { id: 'studio', label: 'COMMUNITY STUDIO', x: 3, y: 27, w: 10, h: 6, tone: 'pink' },
  { id: 'workshop', label: 'SOUND WORKSHOP', x: 35, y: 27, w: 10, h: 6, tone: 'cyan' },
]

const B3_BUILDINGS = [
  { id: 'record-archive', label: 'Record Archive', x: 4, y: 4, w: 8, h: 6 },
  { id: 'listening-cafe', label: 'Listening Cafe', x: 35, y: 5, w: 10, h: 5 },
  { id: 'community-studio', label: 'Community Studio', x: 3, y: 28, w: 10, h: 5 },
  { id: 'sound-workshop', label: 'Sound Workshop', x: 36, y: 27, w: 8, h: 6 },
]

const B3_PROPS = [
  { id: 'flowerbed-low-a', category: 'flowerbeds', x: 3, y: 12, w: 64, h: 32 }, { id: 'flowerbed-low-a', category: 'flowerbeds', x: 42, y: 12, w: 64, h: 32 },
  { id: 'bench-low-a', category: 'benches', x: 18, y: 22, w: 64, h: 32 }, { id: 'bench-low-a', category: 'benches', x: 28, y: 16, w: 64, h: 32 },
  { id: 'planter-low-a', category: 'planters', x: 13, y: 9, w: 32, h: 32 }, { id: 'planter-low-a', category: 'planters', x: 34, y: 9, w: 32, h: 32 },
  { id: 'planter-low-a', category: 'planters', x: 13, y: 31, w: 32, h: 32 }, { id: 'planter-low-a', category: 'planters', x: 34, y: 31, w: 32, h: 32 },
  { id: 'lamp-low-a', category: 'lamps', x: 2, y: 14, w: 32, h: 64 }, { id: 'lamp-low-a', category: 'lamps', x: 46, y: 14, w: 32, h: 64 },
  { id: 'lamp-low-a', category: 'lamps', x: 6, y: 24, w: 32, h: 64 }, { id: 'lamp-low-a', category: 'lamps', x: 42, y: 24, w: 32, h: 64 },
  { id: 'shrub-low-a', category: 'vegetation', x: 3, y: 18, w: 32, h: 32 }, { id: 'shrub-low-a', category: 'vegetation', x: 44, y: 18, w: 32, h: 32 },
  { id: 'shrub-low-a', category: 'vegetation', x: 4, y: 22, w: 32, h: 32 }, { id: 'shrub-low-a', category: 'vegetation', x: 43, y: 22, w: 32, h: 32 },
  { id: 'tree-low-a', category: 'vegetation', x: 2, y: 14, w: 64, h: 64 }, { id: 'tree-low-a', category: 'vegetation', x: 44, y: 14, w: 64, h: 64 },
  { id: 'tree-low-a', category: 'vegetation', x: 1, y: 26, w: 64, h: 64 }, { id: 'tree-low-a', category: 'vegetation', x: 45, y: 26, w: 64, h: 64 },
  { id: 'garden-resonance-low', category: 'garden', x: 23, y: 16, w: 64, h: 32 },
  { id: 'gate-vegetation-low', category: 'gate-vegetation', x: 19, y: 34, w: 64, h: 32 }, { id: 'gate-vegetation-low', category: 'gate-vegetation', x: 27, y: 34, w: 64, h: 32 },
  { id: 'stage-vegetation-low', category: 'stage-vegetation', x: 14, y: 3, w: 64, h: 32 }, { id: 'stage-vegetation-low', category: 'stage-vegetation', x: 32, y: 3, w: 64, h: 32 },
  { id: 'foreground-edge-cluster', category: 'foreground', x: 0, y: 32, w: 96, h: 64 }, { id: 'foreground-edge-cluster', category: 'foreground', x: 45, y: 31, w: 96, h: 64 },
]

const PROP_LABELS = {
  flowerbeds: 'flowerbeds', benches: 'benches', planters: 'planters', lamps: 'lamps', vegetation: 'shrubs/trees', garden: 'Garden object',
  'gate-vegetation': 'Gate vegetation', 'stage-vegetation': 'Stage vegetation', foreground: 'foreground edge',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function Marker({ marker, selected, onSelect }) {
  const state = MARKER_STATES[marker.state]
  const x = marker.x * TILE + TILE / 2
  const y = marker.y * TILE + TILE / 2
  const motionClass = state.motion === 'none' ? '' : styles[state.motion]
  const isCompleted = marker.state === 'completed'

  return (
    <g
      className={`${styles.marker} ${motionClass} ${selected ? styles.selectedMarker : ''}`}
      role="button"
      tabIndex="0"
      aria-label={`${marker.id}, ${state.label}`}
      onClick={() => onSelect(marker.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(marker.id)
        }
      }}
      transform={`translate(${x} ${y})`}
    >
      <circle r="25" fill="#15162a" fillOpacity="0.94" stroke={state.color} strokeWidth={selected ? 6 : 4} strokeDasharray={state.ring} />
      {!isCompleted && <circle r="17" fill="none" stroke={state.color} strokeWidth="2" opacity="0.78" />}
      {isCompleted && <circle r="17" fill={state.color} opacity="0.34" />}
      <text className={styles.markerGlyph} fill={state.color} textAnchor="middle" dominantBaseline="central">{state.glyph}</text>
      <rect x="-27" y="29" width="54" height="18" rx="5" fill="#111426" fillOpacity="0.92" />
      <text className={styles.markerId} x="0" y="42" textAnchor="middle">{marker.id}</text>
    </g>
  )
}

function StatusPanel({ stateKey }) {
  if (!['interacting', 'submitting', 'saveError', 'audioError'].includes(stateKey)) return null

  const content = {
    interacting: ['Annotation panel · mock', '소리를 1회 이상 듣고 표현을 입력합니다.', '재생', '제출'],
    submitting: ['저장 중 · mock', '실제 요청을 보내지 않습니다.', '처리 중…', '입력 잠김'],
    saveError: ['저장 오류 · mock', '진행률과 보상은 반영되지 않았습니다.', '다시 시도', '맵으로'],
    audioError: ['오디오 기술 오류 · mock', 'annotation이나 skip으로 저장하지 않습니다.', '재시도', '문의'],
  }[stateKey]

  return (
    <section className={styles.mockPanel} aria-live="polite">
      <div>
        <strong>{content[0]}</strong>
        <p>{content[1]}</p>
      </div>
      <button type="button">{content[2]}</button>
      <button type="button" className={styles.secondaryButton}>{content[3]}</button>
    </section>
  )
}

export default function MusicWhiteboxPreviewPage() {
  const [markers, setMarkers] = useState(INITIAL_MARKERS)
  const [selectedId, setSelectedId] = useState('M01')
  const [viewportKey, setViewportKey] = useState('overview')
  const [focusKey, setFocusKey] = useState('start')
  const [artMode, setArtMode] = useState('b3')
  const [stageVariant, setStageVariant] = useState('s1')
  const [gateVariant, setGateVariant] = useState('g1')
  const [stageLayers, setStageLayers] = useState(Object.fromEntries(Object.keys(STAGE_LAYER_LABELS).map((key) => [key, true])))
  const [gateLayers, setGateLayers] = useState(Object.fromEntries(Object.keys(GATE_LAYER_LABELS).map((key) => [key, true])))
  const [buildingLayers, setBuildingLayers] = useState(Object.fromEntries(Object.keys(BUILDING_LAYER_LABELS).map((key) => [key, true])))
  const [visibleBuildings, setVisibleBuildings] = useState(Object.fromEntries(B3_BUILDINGS.map(({ id }) => [id, true])))
  const [visibleProps, setVisibleProps] = useState(Object.fromEntries(Object.keys(PROP_LABELS).map((key) => [key, true])))
  const [layers, setLayers] = useState({ grid: true, buildings: true, collisions: false, interaction: false, entrances: false, foreground: true, markers: true, clearance: false, seams: false, repetition: false, grayscale: false, emissive: true, character: true })

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'auto'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [])

  const viewport = VIEWPORTS[viewportKey]
  const focus = FOCUSES[focusKey]
  const selected = markers.find((marker) => marker.id === selectedId) || markers[0]
  const viewBox = useMemo(() => {
    const tilesW = viewport.tilesW
    const tilesH = viewport.tilesH
    const x = clamp(focus.x - tilesW / 2, 0, MAP_W - tilesW)
    const y = clamp(focus.y - tilesH / 2, 0, MAP_H - tilesH)
    return { x: x * TILE, y: y * TILE, w: tilesW * TILE, h: tilesH * TILE }
  }, [viewport, focus])

  const visibleCount = markers.filter((marker) => (
    marker.x * TILE >= viewBox.x && marker.x * TILE <= viewBox.x + viewBox.w &&
    marker.y * TILE >= viewBox.y && marker.y * TILE <= viewBox.y + viewBox.h &&
    ['active', 'nearby'].includes(marker.state)
  )).length

  const setSelectedState = (state) => {
    setMarkers((current) => current.map((marker) => marker.id === selectedId ? { ...marker, state } : marker))
  }

  const toggleLayer = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }))
  const toggleStageLayer = (key) => setStageLayers((current) => ({ ...current, [key]: !current[key] }))
  const toggleGateLayer = (key) => setGateLayers((current) => ({ ...current, [key]: !current[key] }))
  const toggleBuildingLayer = (key) => setBuildingLayers((current) => ({ ...current, [key]: !current[key] }))
  const toggleBuilding = (key) => setVisibleBuildings((current) => ({ ...current, [key]: !current[key] }))
  const toggleProp = (key) => setVisibleProps((current) => ({ ...current, [key]: !current[key] }))

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>DESIGN-ONLY · NO SUPABASE · NO GAME STATE</p>
          <h1>Music Village B3 Buildings / Props</h1>
          <p>48×36 tiles · 32px · approved S1 + G1 · four buildings · low prop families</p>
        </div>
        <div className={styles.metric}>
          <span>현재 화면 활성 marker</span>
          <strong>{visibleCount}</strong>
          <small>3~7은 provisional</small>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="Preview controls">
        <div className={styles.buttonGroup} aria-label="Art mode">
          <button type="button" className={artMode === 'whitebox' ? styles.activeControl : ''} onClick={() => setArtMode('whitebox')}>Whitebox</button>
          <button type="button" className={artMode === 'groundPath' ? styles.activeControl : ''} onClick={() => setArtMode('groundPath')}>B1+B2</button>
          <button type="button" className={artMode === 'b3' ? styles.activeControl : ''} onClick={() => setArtMode('b3')}>B1+B2+B3</button>
        </div>
        <label>
          Stage
          <select value={stageVariant} onChange={(event) => setStageVariant(event.target.value)}>
            <option value="off">Off</option>
            <option value="s1">S1 low double-wave</option>
            <option value="s2">S2 restrained triple-wave</option>
          </select>
        </label>
        <label>
          Gate
          <select value={gateVariant} onChange={(event) => setGateVariant(event.target.value)}>
            <option value="off">Off</option>
            <option value="g1">G1 open wave rail</option>
            <option value="g2">G2 shallow canopy</option>
          </select>
        </label>
        <label>
          Viewport
          <select value={viewportKey} onChange={(event) => setViewportKey(event.target.value)}>
            {Object.entries(VIEWPORTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
        <div className={styles.buttonGroup} aria-label="Camera focus">
          {Object.entries(FOCUSES).map(([key, value]) => (
            <button type="button" key={key} className={focusKey === key ? styles.activeControl : ''} onClick={() => setFocusKey(key)}>{value.label}</button>
          ))}
        </div>
        <div className={styles.buttonGroup} aria-label="Layer toggles">
          {Object.entries(layers).map(([key, visible]) => (
            <button type="button" key={key} className={visible ? styles.activeControl : ''} aria-pressed={visible} onClick={() => toggleLayer(key)}>{key}</button>
          ))}
        </div>
        <div className={styles.layerControlGroup} aria-label="Stage layers">
          <span>Stage layers</span>
          <div className={styles.buttonGroup}>
            {Object.entries(STAGE_LAYER_LABELS).map(([key, label]) => (
              <button type="button" key={key} className={stageLayers[key] ? styles.activeControl : ''} aria-pressed={stageLayers[key]} onClick={() => toggleStageLayer(key)}>{label}</button>
            ))}
          </div>
        </div>
        <div className={styles.layerControlGroup} aria-label="Gate layers">
          <span>Gate layers</span>
          <div className={styles.buttonGroup}>
            {Object.entries(GATE_LAYER_LABELS).map(([key, label]) => (
              <button type="button" key={key} className={gateLayers[key] ? styles.activeControl : ''} aria-pressed={gateLayers[key]} onClick={() => toggleGateLayer(key)}>{label}</button>
            ))}
          </div>
        </div>
        <div className={styles.layerControlGroup} aria-label="B3 buildings">
          <span>B3 buildings</span>
          <div className={styles.buttonGroup}>
            {B3_BUILDINGS.map(({ id, label }) => <button type="button" key={id} className={visibleBuildings[id] ? styles.activeControl : ''} aria-pressed={visibleBuildings[id]} onClick={() => toggleBuilding(id)}>{label}</button>)}
          </div>
        </div>
        <div className={styles.layerControlGroup} aria-label="Building layers">
          <span>Building layers</span>
          <div className={styles.buttonGroup}>
            {Object.entries(BUILDING_LAYER_LABELS).map(([key, label]) => <button type="button" key={key} className={buildingLayers[key] ? styles.activeControl : ''} aria-pressed={buildingLayers[key]} onClick={() => toggleBuildingLayer(key)}>{label}</button>)}
          </div>
        </div>
        <div className={styles.layerControlGroup} aria-label="B3 prop categories">
          <span>B3 props</span>
          <div className={styles.buttonGroup}>
            {Object.entries(PROP_LABELS).map(([key, label]) => <button type="button" key={key} className={visibleProps[key] ? styles.activeControl : ''} aria-pressed={visibleProps[key]} onClick={() => toggleProp(key)}>{label}</button>)}
          </div>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.previewColumn}>
          <div className={styles.viewportFrame} data-viewport={viewportKey}>
            <svg
              className={`${styles.map} ${layers.grayscale ? styles.grayscale : ''}`}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              role="img"
              aria-label={`Music whitebox, ${viewport.label}, ${focus.label}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <pattern id="tile-grid" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                  <path d={`M ${TILE} 0 L 0 0 0 ${TILE}`} fill="none" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1" />
                </pattern>
                <filter id="soft-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              <rect width={MAP_W * TILE} height={MAP_H * TILE} fill="#292844" />
              <rect x="48" y="48" width="1440" height="1056" rx="64" fill="#38375a" stroke="#5a567f" strokeWidth="8" />

              <g aria-label="Ground and paths">
                <path d="M 768 1104 L 768 884 C 660 884 560 846 470 774 C 354 681 320 583 340 470 C 363 341 512 310 640 368 C 712 401 824 401 896 368 C 1024 310 1173 341 1196 470 C 1216 583 1182 681 1066 774 C 976 846 876 884 768 884" fill="none" stroke="#776c9b" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 768 1104 L 768 884 C 660 884 560 846 470 774 C 354 681 320 583 340 470 C 363 341 512 310 640 368 C 712 401 824 401 896 368 C 1024 310 1173 341 1196 470 C 1216 583 1182 681 1066 774 C 976 846 876 884 768 884" fill="none" stroke="#a79ac3" strokeWidth="74" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 768 884 L 768 704 M 640 400 L 640 330 M 896 400 L 896 330" stroke="#a79ac3" strokeWidth="74" strokeLinecap="round" />
                <rect x="544" y="448" width="448" height="256" rx="104" fill="#655d8e" stroke="#b9add0" strokeWidth="10" />
                <circle cx="768" cy="576" r="74" fill="#4f4a74" stroke="#d5c5e8" strokeWidth="8" strokeDasharray="18 12" />
              </g>

              <g aria-label="Main stage">
                <rect x="576" y="96" width="384" height="224" rx="28" fill="#4b476f" stroke="#c5b4db" strokeWidth="10" />
                <rect x="614" y="130" width="308" height="112" rx="18" fill="#292844" />
                <path d="M 646 214 Q 690 154 734 214 T 822 214 T 910 214" fill="none" stroke="#7ee7f2" strokeWidth="9" opacity="0.82" />
                <text x="768" y="286" className={styles.zoneLabel} textAnchor="middle">RESONANCE STAGE</text>
              </g>

              <g aria-label="Quiet gardens">
                <rect x="80" y="384" width="208" height="384" rx="82" fill="#314f58" stroke="#5c858c" strokeWidth="6" />
                <rect x="1248" y="384" width="208" height="384" rx="82" fill="#4b3f61" stroke="#7d688f" strokeWidth="6" />
                <text x="184" y="586" className={styles.smallZoneLabel} textAnchor="middle" transform="rotate(-90 184 586)">QUIET GARDEN</text>
                <text x="1352" y="586" className={styles.smallZoneLabel} textAnchor="middle" transform="rotate(90 1352 586)">REST BUFFER</text>
              </g>

              {layers.buildings && (
                <g aria-label="Building massing">
                  {BUILDINGS.map((building) => (
                    <g key={building.id}>
                      <rect x={building.x * TILE} y={building.y * TILE} width={building.w * TILE} height={building.h * TILE} rx="18" fill={building.tone === 'cyan' ? '#345a69' : '#684863'} stroke={building.tone === 'cyan' ? '#7ee7f2' : '#efa6cf'} strokeWidth="7" />
                      <rect x={(building.x + 1) * TILE} y={(building.y + 1) * TILE} width={(building.w - 2) * TILE} height={(building.h - 2) * TILE} rx="10" fill="#272841" opacity="0.72" />
                      <text x={(building.x + building.w / 2) * TILE} y={(building.y + building.h / 2 + 0.2) * TILE} className={styles.buildingLabel} textAnchor="middle">{building.label}</text>
                    </g>
                  ))}
                </g>
              )}

              <g aria-label="Entrances">
                <rect x="704" y="1056" width="128" height="80" rx="16" fill="#ead89c" stroke="#22243a" strokeWidth="8" />
                <path d="M 738 1096 L 798 1096 M 768 1068 L 768 1124" stroke="#22243a" strokeWidth="8" />
                <text x="768" y="1040" className={styles.zoneLabel} textAnchor="middle">WORLD GATE · START</text>
              </g>

              {artMode !== 'whitebox' && (
                <image
                  href="/design-previews/music-ground-path-b1/music-ground-path-map.svg"
                  x="0"
                  y="0"
                  width={MAP_W * TILE}
                  height={MAP_H * TILE}
                  preserveAspectRatio="none"
                />
              )}

              {artMode !== 'whitebox' && stageVariant !== 'off' && (
                <g aria-label={`Resonance Stage ${stageVariant.toUpperCase()} layers`}>
                  {stageLayers.shadow && <image href={`${LANDMARK_ROOT}/stage/contact-shadow.svg`} x="576" y="96" width="384" height="224" />}
                  {stageLayers.base && <image href={`${LANDMARK_ROOT}/stage/base-platform.svg`} x="576" y="96" width="384" height="224" />}
                  {stageLayers.rear && <image href={`${LANDMARK_ROOT}/stage/rear-body.svg`} x="576" y="96" width="384" height="224" />}
                  {stageLayers.opening && <image href={`${LANDMARK_ROOT}/stage/opening.svg`} x="576" y="96" width="384" height="224" />}
                  {stageLayers.canopy && <image href={`${LANDMARK_ROOT}/stage/canopy-${stageVariant}.svg`} x="576" y="96" width="384" height="224" />}
                  {stageLayers.trim && <image href={`${LANDMARK_ROOT}/stage/trim.svg`} x="576" y="96" width="384" height="224" />}
                  {stageLayers.stair && <image href={`${LANDMARK_ROOT}/stage/front-stair.svg`} x="576" y="96" width="384" height="224" />}
                  {stageLayers.foreground && <image href={`${LANDMARK_ROOT}/stage/foreground.svg`} x="576" y="96" width="384" height="224" />}
                  {layers.emissive && <image href={`${LANDMARK_ROOT}/stage/emissive.svg`} x="576" y="96" width="384" height="224" />}
                </g>
              )}

              {artMode !== 'whitebox' && gateVariant !== 'off' && (
                <g aria-label={`World Gate ${gateVariant.toUpperCase()} layers`}>
                  {gateLayers.shadow && <image href={`${LANDMARK_ROOT}/gate/contact-shadow.svg`} x="704" y="1024" width="128" height="96" />}
                  {gateLayers.posts && <image href={`${LANDMARK_ROOT}/gate/posts.svg`} x="704" y="1024" width="128" height="96" />}
                  {gateLayers.top && <image href={`${LANDMARK_ROOT}/gate/${gateVariant === 'g1' ? 'rail-g1' : 'canopy-g2'}.svg`} x="704" y="1024" width="128" height="96" />}
                  {gateLayers.trim && <image href={`${LANDMARK_ROOT}/gate/trim.svg`} x="704" y="1024" width="128" height="96" />}
                  {gateLayers.foreground && <image href={`${LANDMARK_ROOT}/gate/foreground.svg`} x="704" y="1024" width="128" height="96" />}
                  {layers.emissive && <image href={`${LANDMARK_ROOT}/gate/emissive.svg`} x="704" y="1024" width="128" height="96" />}
                </g>
              )}

              {artMode === 'b3' && layers.buildings && (
                <g aria-label="B3 general building layers">
                  {B3_BUILDINGS.filter(({ id }) => visibleBuildings[id]).flatMap((building) => Object.keys(BUILDING_LAYER_LABELS).map((layer) => {
                    if (!buildingLayers[layer] || (layer === 'emissive' && !layers.emissive) || (layer === 'foreground' && !layers.foreground)) return null
                    return <image key={`${building.id}-${layer}`} href={`${B3_ROOT}/buildings/${building.id}/${layer}.svg`} x={building.x * TILE} y={building.y * TILE} width={building.w * TILE} height={building.h * TILE} />
                  }))}
                </g>
              )}

              {artMode === 'b3' && (
                <g aria-label="B3 low prop families">
                  {B3_PROPS.filter(({ category }) => visibleProps[category] && (category !== 'foreground' || layers.foreground)).map((prop, index) => (
                    <image key={`${prop.id}-${prop.x}-${prop.y}-${index}`} href={`${B3_ROOT}/props/${prop.category}/${prop.id}.svg`} x={prop.x * TILE} y={prop.y * TILE - Math.max(0, prop.h - TILE)} width={prop.w} height={prop.h} />
                  ))}
                </g>
              )}

              {artMode !== 'whitebox' && layers.repetition && (
                <image href="/design-previews/music-ground-path-b1/music-repetition-guide.svg" x="0" y="0" width={MAP_W * TILE} height={MAP_H * TILE} preserveAspectRatio="none" opacity="0.8" />
              )}

              {artMode !== 'whitebox' && layers.seams && (
                <image href="/design-previews/music-ground-path-b1/music-tile-grid.svg" x="0" y="0" width={MAP_W * TILE} height={MAP_H * TILE} preserveAspectRatio="none" opacity="0.95" />
              )}

              {artMode === 'whitebox' && layers.collisions && (
                <g className={styles.collisionLayer} aria-label="Collision guide">
                  {BUILDINGS.map((building) => <rect key={building.id} x={(building.x - 0.25) * TILE} y={building.y * TILE} width={(building.w + 0.5) * TILE} height={building.h * TILE} />)}
                  <rect x="584" y="142" width="368" height="178" />
                  <rect x="80" y="384" width="208" height="384" />
                  <rect x="1248" y="384" width="208" height="384" />
                </g>
              )}

              {artMode !== 'whitebox' && layers.collisions && (
                <g aria-label="Landmark collision guides">
                  <image href={`${LANDMARK_ROOT}/stage/collision.svg`} x="576" y="96" width="384" height="224" />
                  <image href={`${LANDMARK_ROOT}/gate/collision.svg`} x="704" y="1024" width="128" height="96" />
                </g>
              )}

              {artMode === 'b3' && layers.collisions && <image href={`${B3_ROOT}/guides/collision-guide.svg`} x="0" y="0" width={MAP_W * TILE} height={MAP_H * TILE} preserveAspectRatio="none" />}

              {artMode === 'b3' && layers.entrances && <image href={`${B3_ROOT}/guides/entrances-guide.svg`} x="0" y="0" width={MAP_W * TILE} height={MAP_H * TILE} preserveAspectRatio="none" />}

              {artMode !== 'whitebox' && layers.interaction && (
                <g aria-label="Landmark interaction guides">
                  <image href={`${LANDMARK_ROOT}/guides/stage-approach-map.svg`} x="0" y="0" width={MAP_W * TILE} height={MAP_H * TILE} preserveAspectRatio="none" />
                  <image href={`${LANDMARK_ROOT}/gate/interaction.svg`} x="704" y="1024" width="128" height="96" />
                  <image href={`${LANDMARK_ROOT}/gate/opening-guide.svg`} x="704" y="1024" width="128" height="96" />
                </g>
              )}

              {artMode === 'b3' && layers.clearance && <image href={`${B3_ROOT}/guides/markers-guide.svg`} x="0" y="0" width={MAP_W * TILE} height={MAP_H * TILE} preserveAspectRatio="none" />}

              {layers.foreground && (
                <g className={styles.foregroundLayer} aria-label="Foreground guide">
                  <rect x="48" y="1024" width="420" height="80" rx="30" />
                  <rect x="1068" y="1024" width="420" height="80" rx="30" />
                  <text x="258" y="1074" textAnchor="middle">FOREGROUND · NO MARKERS</text>
                  <text x="1278" y="1074" textAnchor="middle">FOREGROUND · NO MARKERS</text>
                </g>
              )}

              {artMode !== 'b3' && layers.clearance && (
                <g className={styles.clearanceLayer} aria-label="Sound marker clearance guide">
                  {markers.map((marker) => (
                    <g key={marker.id}>
                      <circle cx={marker.x * TILE + TILE / 2} cy={marker.y * TILE + TILE / 2} r={TILE} />
                      <circle cx={marker.x * TILE + TILE / 2} cy={marker.y * TILE + TILE / 2} r={TILE * 2} className={styles.clearanceOuter} />
                    </g>
                  ))}
                </g>
              )}

              {layers.markers && (
                <g aria-label="Mock sound markers">
                  {markers.map((marker) => <Marker key={marker.id} marker={marker} selected={selectedId === marker.id} onSelect={setSelectedId} />)}
                </g>
              )}

              {artMode === 'whitebox' && (
                <g aria-label="Player spawn">
                  <circle cx="768" cy="1008" r="18" fill="#f5e7c8" stroke="#22243a" strokeWidth="6" />
                  <path d="M 768 982 L 768 958 M 756 970 L 768 958 780 970" fill="none" stroke="#f5e7c8" strokeWidth="6" />
                  <text x="768" y="944" className={styles.zoneLabel} textAnchor="middle">SPAWN</text>
                </g>
              )}

              {artMode !== 'whitebox' && layers.character && (
                <image href={`${LANDMARK_ROOT}/guides/mock-character.svg`} x="732" y="920" width="72" height="88" aria-label="72 by 88 pixel mock character with identical foot contact" />
              )}

              {layers.grid && <rect width={MAP_W * TILE} height={MAP_H * TILE} fill="url(#tile-grid)" pointerEvents="none" />}
            </svg>

            <StatusPanel stateKey={selected.state} />
          </div>

          <div className={styles.captionRow}>
            <span>{viewport.label}</span>
            <span>카메라: {focus.label}</span>
            <span>아트: {artMode === 'b3' ? '2C-B1+B2+B3' : artMode === 'groundPath' ? '2C-B1+B2' : 'whitebox'}</span>
            <span>Stage/Gate: {stageVariant.toUpperCase()} · {gateVariant.toUpperCase()}</span>
            <span>선택: {selected.id} · {MARKER_STATES[selected.state].label}</span>
          </div>
        </div>

        <aside className={styles.inspector}>
          <div>
            <p className={styles.eyebrow}>SELECTED MARKER</p>
            <h2>{selected.id}</h2>
            <p>선택한 marker에 mock 상태를 적용합니다. 실제 저장이나 게임 상태는 바뀌지 않습니다.</p>
          </div>

          <div className={styles.stateGrid}>
            {Object.entries(MARKER_STATES).map(([key, state]) => (
              <button
                type="button"
                key={key}
                onClick={() => setSelectedState(key)}
                className={selected.state === key ? styles.selectedState : ''}
                aria-pressed={selected.state === key}
              >
                <span className={styles.stateGlyph} style={{ '--state-color': state.color }}>{state.glyph}</span>
                <span>{state.label}</span>
              </button>
            ))}
          </div>

          <section className={styles.notes}>
            <h3>B3 검수 순서</h3>
            <ol>
              <li>남쪽 World Gate와 spawn</li>
              <li>밝은 중앙 진입축</li>
              <li>공명 정원의 비대칭 rhythm motif</li>
              <li>좌우 단일 순환 동선</li>
              <li>네 건물의 silhouette·entrance</li>
              <li>저상 prop와 marker clearance</li>
              <li>북쪽 Resonance Stage 위계</li>
            </ol>
            <p>B1+B2와 B1+B2+B3를 비교한다. 이 route는 preview 전용이며 production map·연구 상태를 import하지 않는다.</p>
          </section>
        </aside>
      </section>
    </main>
  )
}
