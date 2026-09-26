'use client'

import { useMemo, useState } from 'react'
import {
  EXIT, FOREGROUND_ZONES, MAP, MATERIAL_ZONES, OBSERVATORY, PROP_BLOCKERS,
  SAFE_SLOTS, SLOT_REGIONS, SOUND_AUDIT, SPAWN, STRUCTURES, WHITEBOX_VALIDATION,
} from './whiteboxConfig.mjs'

const T = MAP.tile
const px = value => value * T
const rect = value => ({ x: px(value.x), y: px(value.y), width: px(value.w), height: px(value.h) })

const FOCUS = {
  full: { label: '전체 48×36', cx: 24, cy: 18 },
  entrance: { label: '입구', cx: 24, cy: 30 },
  central: { label: '중앙 장치', cx: 24, cy: 18 },
  archive: { label: 'Archive', cx: 10, cy: 10 },
  spectrum: { label: 'Spectrum', cx: 38, cy: 10 },
  signal: { label: 'Signal', cx: 37, cy: 27 },
}

function cameraFor(focus, viewport) {
  if (focus === 'full') return { x: 0, y: 0, w: MAP.pixelWidth, h: MAP.pixelHeight }
  const target = FOCUS[focus]
  const tiles = viewport === 'desktop' ? { w: 24, h: 18 } : { w: 18, h: 12 }
  const x = Math.max(0, Math.min(MAP.width - tiles.w, target.cx - tiles.w / 2))
  const y = Math.max(0, Math.min(MAP.height - tiles.h, target.cy - tiles.h / 2))
  return { x: px(x), y: px(y), w: px(tiles.w), h: px(tiles.h) }
}

function Toggle({ active, children, onClick }) {
  return <button type="button" aria-pressed={active} onClick={onClick} style={{
    border: `1px solid ${active ? '#75d6dc' : '#516778'}`, background: active ? '#173d4b' : '#142532',
    color: active ? '#dffcff' : '#9fb2bf', borderRadius: 8, padding: '8px 10px', fontWeight: 750,
    fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
  }}>{children}</button>
}

function Building({ structure, kind }) {
  const r = rect(structure)
  const accent = kind === 'archive' ? '#9f86c0' : kind === 'spectrum' ? '#52b8c4' : '#5fb7a6'
  return <g data-layer="building">
    <rect {...r} rx={20} fill="#172a3a" stroke="#b88948" strokeWidth={5}/>
    <rect x={r.x + 12} y={r.y + 14} width={r.width - 24} height={r.height - 28} rx={14} fill="#243b4d" stroke="#446177" strokeWidth={3}/>
    {kind === 'archive' && <>
      {[0, 1, 2].map(i => <rect key={i} x={r.x + 34 + i * 92} y={r.y + 58} width={62} height={118} rx={7} fill="#1c3142" stroke={accent} strokeWidth={3}/>) }
      <path d={`M${r.x + 34} ${r.y + 215}H${r.x + r.width - 34}`} stroke="#b88948" strokeWidth={5} strokeDasharray="18 10"/>
    </>}
    {kind === 'spectrum' && <>
      <path d={`M${r.x + 30} ${r.y + 118}Q${r.x + r.width / 2} ${r.y + 8} ${r.x + r.width - 30} ${r.y + 118}`} fill="#1d3346" stroke={accent} strokeWidth={5}/>
      {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${r.x + 44 + i * 70} ${r.y + 210}v${-24 - i * 10}`} stroke={accent} strokeWidth={8} opacity={0.45 + i * 0.08}/>) }
    </>}
    {kind === 'signal' && <>
      <circle cx={r.x + r.width / 2} cy={r.y + 118} r={58} fill="#1b3343" stroke={accent} strokeWidth={5}/>
      <path d={`M${r.x + 88} ${r.y + 220}h${r.width - 130}M${r.x + 88} ${r.y + 250}h${r.width - 168}`} stroke="#b88948" strokeWidth={5} strokeDasharray="22 12"/>
    </>}
    <rect {...rect(structure.entrance)} fill="#7798a9" stroke="#f1cb77" strokeWidth={3}/>
    <text x={r.x + r.width / 2} y={r.y + r.height - 34} textAnchor="middle" fill="#dceaf0" fontSize={22} fontWeight={800} letterSpacing={2}>{structure.label}</text>
  </g>
}

function Observatory() {
  const c = { x: px(OBSERVATORY.core.cx), y: px(OBSERVATORY.core.cy) }
  return <g data-layer="building">
    <ellipse cx={c.x} cy={c.y} rx={px(8.6)} ry={px(8.3)} fill="none" stroke="#557185" strokeWidth={16}/>
    <ellipse cx={c.x} cy={c.y} rx={px(6.1)} ry={px(5.9)} fill="#20384a" stroke="#b88948" strokeWidth={6}/>
    <ellipse cx={c.x} cy={c.y} rx={px(3.35)} ry={px(3.35)} fill="#162b3b" stroke="#d0a75e" strokeWidth={8}/>
    {[0, 45, 90, 135].map(angle => <g key={angle} transform={`rotate(${angle} ${c.x} ${c.y})`}>
      <rect x={c.x - 12} y={c.y - px(5.55)} width={24} height={54} rx={8} fill="#294c59" stroke="#b88948" strokeWidth={4}/>
    </g>)}
    <g data-layer="emissive" opacity={0.62}>
      {[1.25, 2.1, 3.0].map(radius => <ellipse key={radius} cx={c.x} cy={c.y} rx={px(radius)} ry={px(radius * 0.56)} fill="none" stroke="#67cbd4" strokeWidth={5}/>) }
      <circle cx={c.x} cy={c.y - 12} r={16} fill="#8ee8e7"/>
    </g>
    <text x={c.x} y={c.y + px(6.9)} textAnchor="middle" fill="#dceaf0" fontSize={22} fontWeight={850} letterSpacing={2}>CENTRAL OBSERVATORY</text>
  </g>
}

function Marker({ slot, index, count, selectedBlock }) {
  if (index >= count) return null
  const state = slot.block < selectedBlock ? 'done' : slot.block === selectedBlock ? 'active' : 'locked'
  const color = state === 'active' ? '#f7e28a' : state === 'done' ? '#648796' : '#53616f'
  const opacity = state === 'active' ? 1 : state === 'done' ? 0.45 : 0.24
  return <g transform={`translate(${px(slot.tx + 0.5)} ${px(slot.ty + 0.5)})`} opacity={opacity} data-marker-state={state}>
    {state === 'active' && <circle r={17} fill="none" stroke="#eafcff" strokeWidth={5} opacity={0.72}/>} 
    <circle r={11} fill="#102330" stroke={color} strokeWidth={4}/>
    <path d="M-4 1Q0 5 4 1M-4-2Q0-6 4-2" fill="none" stroke={color} strokeWidth={2}/>
  </g>
}

export default function LabWhiteboxPreview() {
  const [group, setGroup] = useState('B')
  const [selectedBlock, setSelectedBlock] = useState(1)
  const [focus, setFocus] = useState('full')
  const [viewport, setViewport] = useState('desktop')
  const [toggles, setToggles] = useState({ grid: true, collision: false, foreground: true, clearance: false, grayscale: false, density: true })
  const camera = useMemo(() => cameraFor(focus, viewport), [focus, viewport])
  const counts = SOUND_AUDIT.groups[group].blocks
  const toggle = key => setToggles(current => ({ ...current, [key]: !current[key] }))

  return <main style={{ minHeight: '100vh', background: '#0b141e', color: '#e6f1f4', fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: 18 }}>
    <header style={{ maxWidth: 1540, margin: '0 auto 14px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end', justifyContent: 'space-between' }}>
      <div>
        <div style={{ color: '#75d6dc', fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>LAB-1 · PREVIEW ONLY · NOT PRODUCTION</div>
        <h1 style={{ margin: '4px 0', fontSize: 'clamp(22px, 3vw, 38px)', lineHeight: 1.05 }}>Unknown Sound Observatory · 48×36 Whitebox</h1>
        <div style={{ color: '#9fb2bf', fontSize: 13 }}>mysterious but safe · scientific but warm · controlled wonder</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Toggle active={group === 'A'} onClick={() => setGroup('A')}>Group A · 84</Toggle>
        <Toggle active={group === 'B'} onClick={() => setGroup('B')}>Group B · 85</Toggle>
        <Toggle active={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Desktop · 24×18</Toggle>
        <Toggle active={viewport === 'mobile'} onClick={() => setViewport('mobile')}>Mobile · 18×12</Toggle>
      </div>
    </header>

    <section style={{ maxWidth: 1540, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(250px, 330px)', gap: 14 }} className="lab-preview-layout">
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 9 }}>
          {Object.entries(FOCUS).map(([key, item]) => <Toggle key={key} active={focus === key} onClick={() => setFocus(key)}>{item.label}</Toggle>)}
        </div>
        <div style={{ position: 'relative', background: '#09121b', border: '1px solid #385064', borderRadius: 12, overflow: 'hidden', aspectRatio: viewport === 'desktop' ? '4 / 3' : '3 / 2', boxShadow: '0 16px 48px #0008' }}>
          <svg role="img" aria-label="Unknown Sound Village 48 by 36 tile whitebox" viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block', filter: toggles.grayscale ? 'grayscale(1)' : 'none', background: '#0c1823' }}>
            <defs>
              <pattern id="lab-grid" width={T} height={T} patternUnits="userSpaceOnUse"><path d={`M${T} 0H0V${T}`} fill="none" stroke="#8eb6c7" strokeWidth={1} opacity={0.24}/></pattern>
              <pattern id="density-dots" width={T * 2} height={T * 2} patternUnits="userSpaceOnUse"><circle cx={8} cy={10} r={2} fill="#9fb7bd" opacity={0.24}/><path d="M42 36l8 3-6 5" fill="none" stroke="#c7a565" strokeWidth={2} opacity={0.22}/></pattern>
            </defs>
            <rect width={MAP.pixelWidth} height={MAP.pixelHeight} fill="#172938" data-layer="background"/>
            <g data-layer="ground">
              {MATERIAL_ZONES.map(zone => <rect key={zone.id} {...rect(zone)} fill={zone.color}/>) }
              <path d={`M${px(24)} ${px(35)}V${px(25)}M${px(24)} ${px(25)}C${px(13)} ${px(24)} ${px(13)} ${px(12)} ${px(20)} ${px(10)}M${px(24)} ${px(25)}C${px(35)} ${px(25)} ${px(35)} ${px(13)} ${px(29)} ${px(11)}`} fill="none" stroke="#496679" strokeWidth={px(3)} opacity={0.8}/>
              <ellipse cx={px(24)} cy={px(18.5)} rx={px(10.2)} ry={px(10)} fill="none" stroke="#526e7e" strokeWidth={px(2.4)}/>
              {toggles.density && <rect width={MAP.pixelWidth} height={MAP.pixelHeight} fill="url(#density-dots)"/>}
            </g>

            <Building structure={STRUCTURES.archive} kind="archive"/>
            <Building structure={STRUCTURES.spectrum} kind="spectrum"/>
            <Building structure={STRUCTURES.signal} kind="signal"/>
            <Observatory/>

            <g data-layer="props">
              {PROP_BLOCKERS.map((prop, index) => <g key={index} transform={`translate(${px(prop.x + 0.5)} ${px(prop.y + 0.5)})`}>
                <circle r={12} fill="#17313b" stroke="#b88948" strokeWidth={4}/><path d="M-7 0H7M0-7V7" stroke="#65aeb5" strokeWidth={3}/>
              </g>)}
            </g>

            {SLOT_REGIONS.map(region => <g key={region.block}>
              {(SAFE_SLOTS[region.block] || []).map((slot, index) => <Marker key={`${slot.tx}-${slot.ty}`} slot={slot} index={index} count={counts[region.block - 1]} selectedBlock={selectedBlock}/>) }
            </g>)}

            {toggles.clearance && <g data-layer="guide-clearance">
              {Object.values(SAFE_SLOTS).flat().map(slot => <rect key={`${slot.block}-${slot.tx}-${slot.ty}`} x={px(slot.tx - 0.5)} y={px(slot.ty - 0.5)} width={px(2)} height={px(2)} rx={8} fill="#6fe0b8" fillOpacity={0.08} stroke="#6fe0b8" strokeWidth={2}/>) }
              {Object.values(STRUCTURES).map(structure => <rect key={structure.label} {...rect(structure.approach)} fill="#63d7a6" fillOpacity={0.17} stroke="#63d7a6" strokeWidth={3} strokeDasharray="10 7"/>)}
            </g>}

            {toggles.foreground && <g data-layer="foreground" fill="#0e2130" fillOpacity={0.74} stroke="#7290a0" strokeWidth={3} strokeDasharray="12 7">
              {FOREGROUND_ZONES.map(zone => <rect key={zone.id} {...rect(zone)}/>)}
            </g>}

            <g data-layer="mock-character" transform={`translate(${px(SPAWN.tx + 0.5)} ${px(SPAWN.ty + 0.5)})`}>
              <ellipse cy={11} rx={13} ry={7} fill="#061019" opacity={0.55}/><circle cy={-21} r={12} fill="#e8c3a4"/><path d="M-13-22Q0-39 13-22V-15H-13Z" fill="#293d55"/><rect x={-12} y={-10} width={24} height={28} rx={7} fill="#d8a55b" stroke="#f3dfab" strokeWidth={3}/><path d="M-7 18v10M7 18v10" stroke="#203343" strokeWidth={6}/>
            </g>
            <g data-layer="exit"><rect {...rect(EXIT)} fill="#d4a95e" fillOpacity={0.28} stroke="#f0ce81" strokeWidth={3}/><text x={px(24.5)} y={px(35.7)} textAnchor="middle" fill="#f5dfaa" fontSize={18} fontWeight={850}>EXIT</text></g>

            {toggles.collision && <g data-layer="guide-collision">
              {Array.from({ length: MAP.height }, (_, ty) => Array.from({ length: MAP.width }, (_, tx) => ({ tx, ty }))).flat().filter(({ tx, ty }) => {
                const outer = tx < 2 || tx > 45 || ty < 2 || ty > 34
                const gate = ty >= 34 && tx >= EXIT.x && tx < EXIT.x + EXIT.w
                const building = Object.values(STRUCTURES).some(s => tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h)
                const dx = (tx + 0.5 - OBSERVATORY.core.cx) / OBSERVATORY.core.rx, dy = (ty + 0.5 - OBSERVATORY.core.cy) / OBSERVATORY.core.ry
                const core = dx * dx + dy * dy <= 1
                return (outer && !gate) || building || core || PROP_BLOCKERS.some(prop => prop.x === tx && prop.y === ty)
              }).map(({ tx, ty }) => <rect key={`${tx}-${ty}`} x={px(tx)} y={px(ty)} width={T} height={T} fill="#ed5d72" fillOpacity={0.34} stroke="#ff8394" strokeWidth={1}/>) }
            </g>}
            {toggles.grid && <rect width={MAP.pixelWidth} height={MAP.pixelHeight} fill="url(#lab-grid)" pointerEvents="none"/>}
          </svg>
        </div>
      </div>

      <aside style={{ background: '#11212d', border: '1px solid #385064', borderRadius: 12, padding: 14, alignSelf: 'start' }}>
        <div style={{ fontSize: 11, color: '#75d6dc', fontWeight: 900, letterSpacing: 1.5 }}>QA OVERLAYS</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: '9px 0 16px' }}>
          {Object.entries({ grid: '32px grid', collision: 'collision', foreground: 'foreground', clearance: 'clearance', grayscale: 'grayscale', density: 'material density' }).map(([key, label]) => <Toggle key={key} active={toggles[key]} onClick={() => toggle(key)}>{label}</Toggle>)}
        </div>

        <div style={{ fontSize: 11, color: '#75d6dc', fontWeight: 900, letterSpacing: 1.5 }}>BLOCK FOCUS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, margin: '9px 0 16px' }}>
          {counts.map((count, index) => <Toggle key={index} active={selectedBlock === index + 1} onClick={() => setSelectedBlock(index + 1)}>B{index + 1} · {count}</Toggle>)}
        </div>

        <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9fb2bf' }}>Dataset</span><strong>169 · A84 / B85</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9fb2bf' }}>Safe slots</span><strong>{WHITEBOX_VALIDATION.slotTotal} · 18×6</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9fb2bf' }}>Current group</span><strong>{group} · {SOUND_AUDIT.groups[group].total}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9fb2bf' }}>Current block</span><strong>{selectedBlock} · {counts[selectedBlock - 1]} markers</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9fb2bf' }}>Reachable tiles</span><strong>{WHITEBOX_VALIDATION.reachableTiles}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9fb2bf' }}>Static validation</span><strong style={{ color: WHITEBOX_VALIDATION.pass ? '#70dfad' : '#ff8394' }}>{WHITEBOX_VALIDATION.pass ? 'PASS' : 'FAIL'}</strong></div>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid #385064', paddingTop: 13, color: '#9fb2bf', fontSize: 11, lineHeight: 1.65 }}>
          Marker glow is intentionally brighter than observatory emissive. Labels are preview annotations and are not baked into future assets. No Supabase, annotation, reward, participant state, production renderer, or sound playback is loaded.
        </div>
      </aside>
    </section>
    <style>{`@media(max-width:900px){.lab-preview-layout{grid-template-columns:1fr!important}}`}</style>
  </main>
}

