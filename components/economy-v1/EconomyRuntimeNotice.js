'use client'

const BLOCKED_MESSAGE = '경제 상태를 확인하지 못했습니다. 저장을 진행하지 말고 다시 시도해 주세요'

export default function EconomyRuntimeNotice({ runtimeState, error, onRetry }) {
  if (!['unknown', 'blocked', 'maintenance'].includes(runtimeState)) return null
  const maintenance = runtimeState === 'maintenance'
  const checking = runtimeState === 'unknown'
  return <div style={{
    position:'fixed', inset:0, zIndex:1000, display:'grid', placeItems:'center',
    padding:20, background:'#1d1712aa', backdropFilter:'blur(2px)', fontFamily:'Nunito, sans-serif',
  }}>
    <section
      role={checking ? 'status' : 'alertdialog'}
      aria-modal={checking ? undefined : 'true'}
      aria-labelledby="economy-runtime-title"
      aria-describedby="economy-runtime-description"
      style={{ width:'min(460px, 100%)', border:'2px solid #c8a96e', borderRadius:18, background:'#fffaf0', color:'#382819', padding:24, boxShadow:'0 20px 70px #0008' }}
    >
      <h2 id="economy-runtime-title" style={{ margin:'0 0 10px', fontSize:20 }}>
        {maintenance ? '경제 시스템 점검 중' : checking ? '경제 상태 확인 중' : '경제 저장 일시 중단'}
      </h2>
      <p id="economy-runtime-description" style={{ margin:'0 0 16px', lineHeight:1.6 }}>
        {maintenance
          ? '현재 경제 시스템을 점검하고 있습니다. 읽기 전용으로 안내하며 전사·투표·출석·구매·장착 저장은 진행되지 않습니다.'
          : checking ? '서버의 경제 모드를 확인하고 있습니다. 확인이 끝날 때까지 저장 기능을 사용할 수 없습니다.' : BLOCKED_MESSAGE}
      </p>
      {error && !checking && !maintenance && <p style={{ color:'#8a281e', fontSize:12 }}>차단 사유: {error}</p>}
      {!checking && <button type="button" onClick={onRetry} style={{ border:'1px solid #765334', borderRadius:9, background:'#765334', color:'#fff', padding:'10px 16px', fontWeight:900, cursor:'pointer' }}>경제 상태 다시 조회</button>}
    </section>
  </div>
}
