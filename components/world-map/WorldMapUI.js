'use client'

import { useEffect, useState } from 'react'
import { getAttendanceStatus } from '@/lib/attendance'
import { getTodayQuestSummary } from '@/lib/dailyQuests'
import { TILE, ZONE_META } from '@/components/GameEngine'
import { WORLD_CAMERA_HUD_HEIGHT as HUD_H } from '@/lib/worldMapCamera.mjs'
import { trackEvent } from '@/lib/userEvents'
import VillageCurrencyIcon, { VILLAGE_ORDER, villageKoreanName } from '@/components/economy-v1/VillageCurrencyIcon'

export function WorldMapHUD({ totalCount, zoneProgress, balance = 0, economyMode = 'legacy', economyBalances = {}, homeState = 'default', onOpenHome, onOpenQuests, onOpenAttendance }) {
  const zones = Object.keys(ZONE_META)
  const percent = Math.round(Object.values(zoneProgress).reduce((sum, value) => sum + value, 0) / zones.length * 100)
  const divider = <div className="world-map-hud__divider" style={{ width:1, height:36, background:'#C8A96E' }}/>
  return (
    <div className="world-map-hud" style={{ position:'absolute', inset:'0 0 auto', height:HUD_H, background:'#F5EDD8', borderBottom:'3px solid #C8A96E', display:'flex', alignItems:'center', padding:'0 16px', gap:12, fontFamily:'Nunito, sans-serif', zIndex:20, boxShadow:'0 2px 8px #0003' }}>
      <div className="world-map-hud__brand" style={{ display:'flex', alignItems:'center', gap:8, marginRight:4 }}>
        <span style={{ fontSize:22 }}>🎧</span><div><div style={{ fontSize:14, fontWeight:800, color:'#3A2A14', lineHeight:1.1 }}>Sound Village</div><div style={{ fontSize:10, color:'#8B6A3A' }}>소리를 수집하세요</div></div>
      </div>
      {divider}
      <div className="world-map-hud__progress" style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ fontSize:11, fontWeight:700, color:'#3A2A14' }}>전체 진행률</span><span style={{ fontSize:11, color:'#8B6A3A' }}>{percent}%</span></div>
        <div style={{ height:8, background:'#D4C4A0', borderRadius:4, overflow:'hidden' }}><div style={{ height:'100%', borderRadius:4, background:'linear-gradient(90deg,#5B9E3A,#7BC850)', width:`${percent}%`, transition:'width .5s ease' }}/></div>
      </div>
      {divider}
      <HudStat icon="⭐" value={totalCount} label="수집한 소리"/>
      {divider}
      {economyMode === 'cutover'
        ? <WorldWalletHUD balances={economyBalances}/>
        : <HudStat icon="🪙" value={balance} label="보유 화폐" title="상점에서 쓸 수 있는 화폐"/>}
      {divider}
      <HudButton icon="🏠" label="우리 집" ariaLabel="우리 집 꾸미기 열기" onClick={onOpenHome} kind="home" badge={homeState === 'invite-ready' ? '초대 가능' : null}/>
      {divider}
      <HudButton icon="📋" label="퀘스트" ariaLabel="오늘의 퀘스트 열기" onClick={onOpenQuests}/>
      {divider}
      <HudButton icon="📅" label="출석" ariaLabel="출석 보상 열기" onClick={onOpenAttendance}/>
      {divider}
      <div className="world-map-hud__zones" style={{ display:'flex', gap:4, alignItems:'center' }}>
        {zones.map(zone => { const progress = zoneProgress[zone] || 0; return <div key={zone} role="img" aria-label={`${ZONE_META[zone].label} 진행률 ${Math.round(progress * 100)}퍼센트`} title={`${ZONE_META[zone].label}: ${Math.round(progress * 100)}%`} style={{ width:24, height:24, borderRadius:6, background:progress >= 1 ? ZONE_META[zone].color : '#D4C4A0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, border:'2px solid', borderColor:progress >= 1 ? ZONE_META[zone].color : '#C8A96E', opacity:progress > 0 ? 1 : .5 }}>{ZONE_META[zone].emoji}</div> })}
      </div>
    </div>
  )
}

function HudStat({ icon, value, label, title }) {
  return <div className="world-map-hud__stat" title={title} style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ fontSize:20 }}>{icon}</span><div><div style={{ fontSize:16, fontWeight:800, color:'#B8860B', lineHeight:1 }}>{value}</div><div style={{ fontSize:9, color:'#8B6A3A' }}>{label}</div></div></div>
}

function HudButton({ icon, label, ariaLabel, onClick, kind, badge }) {
  return <button type="button" className={`world-map-hud__action${kind ? ` world-map-hud__action--${kind}` : ''}`} data-kind={kind} onClick={onClick} aria-label={ariaLabel} style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:1, background:'transparent', border:0, cursor:'pointer', padding:'2px 6px', borderRadius:8, fontFamily:'Nunito, sans-serif' }}><span style={{ fontSize:19, lineHeight:1 }}>{icon}</span><span className="world-map-hud__action-label" style={{ fontSize:9, color:'#8B6A3A', fontWeight:700 }}>{label}</span>{badge && <span className="world-map-hud__home-badge">{badge}</span>}</button>
}

export function WorldHomeWelcome({ distance, onDismiss }) {
  return <section className="world-home-welcome" role="status" aria-label="우리 집 안내">
    <div className="world-home-welcome__icon" aria-hidden="true">🏡</div>
    <div className="world-home-welcome__copy"><strong>가까이에 나만의 생활 허브가 있어요</strong><span>코랄 지붕의 <b>우리 집</b>에서 꾸미고 친구를 초대해요 · 약 {distance}칸</span></div>
    <button type="button" onClick={onDismiss} aria-label="우리 집 안내 닫기">확인</button>
  </section>
}

export function WorldObjective({ nearZone, nearMuseum, nearHome, nearZoneLocked, objective, objectiveLabel }) {
  const nearLabel = nearZone ? `${ZONE_META[nearZone].emoji} ${ZONE_META[nearZone].label}${nearZoneLocked ? ' (잠김)' : ''}` : nearMuseum ? '🏛 도서관' : nearHome ? '🏠 우리 집' : null
  const title = objective?.reason === 'prerequisite'
    ? '🎵 음악 마을 1구역 전사하기'
    : objective?.destinationId
      ? `${objectiveLabel}의 소리 탐험하기`
      : '여섯 마을의 소리 탐험 완료'
  const description = objective?.arrived
    ? `${objectiveLabel}에 도착했어요`
    : objective?.destinationId
      ? `화살표와 미니맵을 따라 ${objectiveLabel}(으)로 이동하세요`
      : 'Sound Museum과 우리 집도 둘러보세요'
  return <div className="world-map-objective" style={{ position:'absolute', bottom:16, right:16, width:200, background:'#F5EDD8', border:'2px solid #C8A96E', borderRadius:12, padding:12, fontFamily:'Nunito, sans-serif', boxShadow:'0 4px 16px #0004', zIndex:10 }}>
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}><span>🚩</span><span style={{ fontSize:11, fontWeight:800, color:'#3A2A14' }}>현재 목표</span></div>
    <div style={{ fontSize:12, fontWeight:700, color:'#3A2A14', marginBottom:4 }}>{title}</div>
    <div style={{ fontSize:11, color:objective?.arrived ? '#37642B' : '#8B6A3A', lineHeight:1.5, marginBottom:6, fontWeight:objective?.arrived ? 800 : 400 }}>{description}</div>
    {nearLabel && <><hr style={{ border:0, borderTop:'1px solid #D4C4A0', margin:'6px 0' }}/><div style={{ fontSize:10, color:nearZoneLocked ? '#8A5A45' : '#37642B', fontWeight:700 }}>{nearZoneLocked ? `🔒 ${nearLabel} · 선행 목표 필요` : `${nearLabel} · ENTER로 진입`}</div></>}
    <hr style={{ border:0, borderTop:'1px solid #D4C4A0', margin:'6px 0 4px' }}/><div style={{ fontSize:10, color:'#8B6A3A' }}>💡 WASD / 방향키로 이동</div>
  </div>
}

export function WorldDirection({ playerFoot, target, label, arrived = false }) {
  const angle = Math.atan2(target.y - playerFoot.y, target.x - playerFoot.x) * 180 / Math.PI
  const distance = Math.round(Math.hypot(target.x - playerFoot.x, target.y - playerFoot.y) / TILE)
  return <div className="world-map-direction" aria-label={arrived ? `${label} 도착` : `${label}까지 ${distance}칸`} style={{ position:'absolute', top:HUD_H + 12, left:'50%', transform:'translateX(-50%)', zIndex:14, display:'flex', alignItems:'center', gap:7, padding:'7px 11px', borderRadius:18, background:arrived ? '#37642Be8' : '#172014d9', color:'#fff', border:'1px solid #F1CE79', boxShadow:'0 3px 12px #0006', font:'700 11px/1 Nunito, sans-serif', pointerEvents:'none' }}><span className="world-map-direction__arrow" aria-hidden="true" style={{ display:'inline-block', color:'#F1CE79', fontSize:17, transform:arrived ? 'none' : `rotate(${angle}deg)` }}>{arrived ? '✓' : '➜'}</span><span>{arrived ? `${label} · 도착` : `${label} · ${distance}칸`}</span></div>
}

export function WorldEnterPrompt({ emoji, label, color, locked }) {
  const accent = locked ? '#8A8A8A' : color
  return <div className="world-map-enter-prompt" role="status" style={{ position:'absolute', bottom:110, left:'50%', transform:'translateX(-50%)', background:'#F5EDD8ee', border:`3px solid ${accent}`, borderRadius:26, padding:'16px 34px', fontSize:20, fontFamily:'Nunito, sans-serif', color:'#3A2A14', fontWeight:800, backdropFilter:'blur(8px)', animation:locked ? 'popIn .25s cubic-bezier(.34,1.56,.64,1)' : 'popIn .25s cubic-bezier(.34,1.56,.64,1), pulse 1.6s ease-in-out .3s infinite', pointerEvents:'none', whiteSpace:'nowrap', boxShadow:`0 8px 28px ${accent}66`, zIndex:15, display:'flex', alignItems:'center', gap:12 }}><span style={{ fontSize:30 }}>{locked ? '🔒' : emoji}</span>{locked ? <span>{label} — 음악 마을 구역 1을 먼저 전사하세요</span> : <><span>{label} 근처</span><span style={{ background:accent, color:'#fff', padding:'5px 14px', borderRadius:10, fontSize:17 }}>ENTER ↵</span></>}</div>
}

export function WorldDPad({ press, release, onConfirm, confirmLabel = '입장' }) {
  const buttons = [{ dir:'up', label:'▲', area:'1/2', name:'위' }, { dir:'left', label:'◀', area:'2/1', name:'왼쪽' }, { dir:'down', label:'▼', area:'2/2', name:'아래' }, { dir:'right', label:'▶', area:'2/3', name:'오른쪽' }]
  const style = { width:44, height:44, borderRadius:10, background:'#F5EDD8cc', border:'2px solid #C8A96E', color:'#3A2A14', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', userSelect:'none', touchAction:'none' }
  return <div className="world-map-dpad" style={{ position:'absolute', bottom:20, left:20, display:'grid', gridTemplateColumns:'repeat(3,44px)', gridTemplateRows:'repeat(2,44px)', gap:4, zIndex:15 }}>
    {buttons.map(button => <button key={button.dir} type="button" aria-label={`${button.name}으로 이동`} style={{ ...style, gridArea:button.area }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); press(button.dir, event.pointerType === 'touch' ? 'touch' : 'mouse') }} onPointerUp={() => release(button.dir)} onPointerCancel={() => release(button.dir)}>{button.label}</button>)}
    <button type="button" data-testid="world-confirm" aria-label={onConfirm ? `${confirmLabel} 들어가기` : '가까운 장소 없음'} disabled={!onConfirm} style={{ ...style, gridArea:'1/3', background:onConfirm ? '#C8A96E' : '#D4C4A0aa', color:'#fff', fontSize:10, fontWeight:900, lineHeight:1.05, flexDirection:'column', border:'2px solid #8B6432', opacity:onConfirm ? 1 : .55 }} onPointerDown={event => { if (!onConfirm) return; event.currentTarget.setPointerCapture(event.pointerId); onConfirm() }}><span aria-hidden="true" style={{ fontSize:16 }}>↵</span><span>{onConfirm ? '입장' : '—'}</span></button>
  </div>
}

function PanelShell({ title, closeLabel, onClose, children }) {
  return <><div onClick={event => onClose('backdrop', event)} style={{ position:'fixed', inset:0, zIndex:120 }}/><section aria-label={title} style={{ position:'absolute', top:HUD_H + 10, right:16, width:300, maxHeight:'70vh', overflowY:'auto', background:'#F5EDD8', border:'2px solid #C8A96E', borderRadius:16, boxShadow:'0 10px 40px #0005', zIndex:121, fontFamily:'Nunito, sans-serif', padding:14 }}><header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}><strong style={{ fontSize:13, color:'#3A2A14' }}>{title}</strong><button type="button" onClick={event => onClose('close_button', event)} aria-label={closeLabel} style={{ background:'#0001', border:0, borderRadius:'50%', width:28, height:28, cursor:'pointer' }}>✕</button></header>{children}</section></>
}

export function WorldQuestPanel({ participantId, economyMode = 'legacy', onClose, instanceId }) {
  const [quests, setQuests] = useState(null)
  useEffect(() => { let active = true; getTodayQuestSummary(participantId).then(data => { if (active) setQuests(data) }).catch(() => { if (active) setQuests([]) }); return () => { active = false } }, [participantId])
  useEffect(() => { if (!quests) return; quests.forEach(quest => trackEvent('quest_row_impression', { target_type:'quest', target_id:`quest-${quest.id}`, outcome:quest.completed ? 'completed' : 'active' }, { dedupeKey:`quest-impression:${instanceId}:${quest.id}` })) }, [instanceId, quests])
  return <PanelShell title="📋 오늘의 퀘스트" closeLabel="오늘의 퀘스트 닫기" onClose={onClose}>{quests === null ? <PanelMessage>불러오는 중...</PanelMessage> : quests.length === 0 ? <PanelMessage>퀘스트를 불러오지 못했어요.</PanelMessage> : <><div style={{ display:'grid', gap:7 }}>{quests.map(quest => <div key={quest.id} style={{ padding:'9px 11px', borderRadius:10, border:'1px solid #C8A96E55', background:quest.completed ? '#5B9E3A18' : '#00000006', fontSize:11, color:'#3A2A14' }}><strong>{quest.completed ? '✓ ' : ''}{quest.template?.description}</strong>{economyMode === 'legacy' && quest.template?.reward_currency != null && <span style={{ float:'right', color:'#B8860B' }}>+{quest.template.reward_currency}🪙</span>}</div>)}</div>{economyMode === 'cutover' && <p style={{fontSize:10,color:'#8B6A3A'}}>신규 경제 모드에서는 퀘스트 진행도만 기록되며 화폐 보상은 지급되지 않습니다.</p>}</>}</PanelShell>
}

function WorldWalletHUD({ balances }) {
  return <div className="world-map-hud__wallets" aria-label="여섯 마을 지갑" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(42px,1fr))',gap:'2px 6px',minWidth:176}}>{VILLAGE_ORDER.map((village) => <div key={village} aria-label={`${villageKoreanName(village)} 화폐 ${Number(balances[village] || 0)}개`} style={{display:'flex',alignItems:'center',gap:3,minWidth:0}}><VillageCurrencyIcon village={village} style={{width:16,height:16,flex:'0 0 auto'}}/><strong style={{fontSize:10,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{Number(balances[village] || 0).toLocaleString('ko-KR')}</strong></div>)}</div>
}

export function WorldEconomyAttendancePanel({ attendance, onClaim, onClose }) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const claims = new Map((attendance?.claims || []).map((claim) => [claim.day, claim]))
  const today = attendance?.attendanceDay
  const claimed = claims.get(today)
  const amounts = [2,2,2,3,3,4,5]
  const claim = async () => {
    if (pending || claimed || !onClaim) return
    setPending(true); setMessage('')
    trackEvent('attendance_check_attempted', { operation_type:'economy_v1_attendance' }, { critical:true })
    const result = await onClaim()
    setPending(false)
    if (!result?.ok) {
      setMessage('출석 보상을 받지 못했습니다. 다시 시도해 주세요.')
      trackEvent('attendance_check_failed', { error_code:result?.code, operation_type:'economy_v1_attendance', operation_idempotency_key:result?.idempotencyKey }, { critical:true })
      return
    }
    setMessage(`${villageKoreanName(result.village)} 화폐 ${result.amount}개를 받았어요.`)
    trackEvent('attendance_check_succeeded', { operation_type:'economy_v1_attendance', operation_idempotency_key:result.idempotencyKey, metadata:{ reward_amount:result.amount } }, { critical:true })
  }
  return <PanelShell title="📅 주간 출석" closeLabel="출석 보상 닫기" onClose={onClose}>{!attendance?.ok ? <PanelMessage>출석 정보를 불러오지 못했어요.</PanelMessage> : <><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>{amounts.map((amount,index) => { const day=index+1; const row=claims.get(day); const village=row?.village || (day === today && day <= 6 ? attendance.villagePermutation?.[day-1] : null); return <div key={day} style={{padding:6,border:'1px solid #C8A96E55',borderRadius:8,textAlign:'center',fontSize:9,background:day===today?'#fff4cc':'#fffaf0'}}><b>{day}일</b><div>{village ? <VillageCurrencyIcon village={village} style={{width:22,height:22}}/> : '?'}</div><strong>+{row?.amount || amount}</strong><small style={{display:'block'}}>{row?'받음':day===today?'오늘':'대기'}</small></div> })}</div>{today === 7 && !claimed && <p style={{fontSize:10}}>7일차는 서버가 잔액이 가장 적은 지갑을 결정합니다.</p>}<button type="button" disabled={pending || Boolean(claimed)} onClick={claim} style={{width:'100%',marginTop:10,padding:10,border:0,borderRadius:10,background:'#72503a',color:'#fff',fontWeight:800}}>{claimed?'오늘 보상 받음':pending?'처리 중…':'오늘 출석 보상 받기'}</button>{message && <p role="status" style={{fontSize:10}}>{message}</p>}</>}</PanelShell>
}

export function WorldAttendancePanel({ participantId, onClose }) {
  const [status, setStatus] = useState(null)
  useEffect(() => { let active = true; getAttendanceStatus(participantId).then(data => { if (active) setStatus(data) }); return () => { active = false } }, [participantId])
  const streak = status?.today?.streak_day ?? 0
  return <PanelShell title="📅 출석 보상" closeLabel="출석 보상 닫기" onClose={onClose}>{status === null ? <PanelMessage>불러오는 중...</PanelMessage> : status.templates.length === 0 ? <PanelMessage>출석 정보를 불러오지 못했어요.</PanelMessage> : <><p style={{ fontSize:11, color:'#3A2A14', fontWeight:700 }}>{streak > 0 ? `오늘 출석 완료! 연속 ${streak}일차 🔥` : '오늘은 아직 출석 전이에요'}</p><div style={{ display:'grid', gap:6 }}>{status.templates.map(item => <div key={item.day_index} style={{ padding:'9px 11px', borderRadius:10, border:'1px solid #C8A96E55', fontSize:11, opacity:item.day_index <= streak ? 1 : .6 }}><strong>{item.day_index <= streak ? '✓ ' : ''}{item.description}</strong><span style={{ float:'right', color:'#B8860B' }}>+{item.reward_currency}🪙</span></div>)}</div></>}</PanelShell>
}

function PanelMessage({ children }) { return <div style={{ fontSize:11, color:'#8B6A3A', textAlign:'center', padding:16 }}>{children}</div> }
