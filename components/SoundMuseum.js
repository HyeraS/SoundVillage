'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { playSound, stopSound, getCurrentTime, getListeningTime, resetListeningTime } from '@/lib/audioManager'
import { getCandidateExpressions, saveVote } from '@/lib/supabase'
import { ZONE_META } from '@/components/GameEngine'

/* ─────────────────────────────────────────────
   Zone별 룸 테마
───────────────────────────────────────────── */
const ROOM = {
  Forest: { wall:'#1C120A', floor:'#120A04', shelf:'#3A2010', accent:'#8B6347',
            glow:'#F4A46030', books:['#2D7A2D','#8B2252','#4A7CC4','#F4A460','#4A6B27','#8B4513'] },
  Creek:  { wall:'#0A1420', floor:'#060C14', shelf:'#142030', accent:'#4A8FD4',
            glow:'#4A8FD430', books:['#1E5A8A','#4A8FD4','#87CEEB','#2A5090','#5A8AAA','#3A6A8A'] },
  City:   { wall:'#141210', floor:'#0A0806', shelf:'#222018', accent:'#C4B99A',
            glow:'#C4B99A30', books:['#8A7060','#C4B99A','#6A5040','#D4C4A0','#504030','#7A6050'] },
  Stage:  { wall:'#0C0820', floor:'#060414', shelf:'#180E30', accent:'#9B6DD4',
            glow:'#9B6DD430', books:['#9B6DD4','#D4883A','#5A3090','#C060A0','#7A4AB0','#4A2090'] },
  Lab:    { wall:'#060410', floor:'#020208', shelf:'#100C1C', accent:'#D4883A',
            glow:'#D4883A30', books:['#D4883A','#4A8FD4','#9B6DD4','#2A4A8A','#D46D6D','#6DD49B'] },
}

/* ─────────────────────────────────────────────
   Zone NPC
───────────────────────────────────────────── */
const ZONE_NPC = {
  Forest: { emoji:'🦉', name:'Ollie',  lines:['숲의 소리는 언제나 이야기를 품고 있어요.', '어떤 표현이 이 소리와 가장 잘 어울리나요? 🌿'] },
  Creek:  { emoji:'🐸', name:'Ripple', lines:['물소리처럼 표현도 자연스럽게 흘러가야 해요.', '첨벙첨벙, 잘 들어보셨나요? 💧'] },
  City:   { emoji:'🦜', name:'Metro',  lines:['도시의 소음도 누군가에겐 음악이에요.', '가장 도시다운 표현을 골라봐요 🏙'] },
  Stage:  { emoji:'🎵', name:'Aria',   lines:['무대의 소리를 언어로 옮겨봐요!', '어떤 표현이 가장 공명하나요? 🎶'] },
  Lab:    { emoji:'🤖', name:'ECHO',   lines:['데이터 분석 중… 최적 표현을 선택하세요.', '미지의 소리에 이름을 붙여봐요 ⚡'] },
}

/* ─────────────────────────────────────────────
   룸 배경 (CSS 아트)
───────────────────────────────────────────── */
function BookShelf({ room, x, books = 7, rows = 3 }) {
  return (
    <div style={{
      position: 'absolute', [x]: 0, top: 0, bottom: '60px',
      width: '76px', background: room.shelf,
      display: 'flex', flexDirection: 'column',
      borderRight: x === 'left' ? `2px solid #ffffff08` : 'none',
      borderLeft:  x === 'right' ? `2px solid #ffffff08` : 'none',
      zIndex: 1, overflowX: 'hidden',
    }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{
          flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px',
          padding: '4px 6px 0',
          borderBottom: `3px solid #00000044`,
        }}>
          {Array.from({ length: books }, (_, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${38 + ((i * 17 + r * 11) % 45)}%`,
              background: room.books[(i + r * 2) % room.books.length],
              borderRadius: '2px 2px 0 0',
              opacity: 0.85 + (i % 3) * 0.05,
            }}/>
          ))}
        </div>
      ))}
      {/* vinyl record */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64px' }}>
        <div style={{
          width: '50px', height: '50px', borderRadius: '50%',
          background: `conic-gradient(${room.books[0]} 0deg, ${room.books[2]} 120deg, ${room.books[4]} 240deg, ${room.books[0]} 360deg)`,
          border: `3px solid #00000066`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 10px ${room.glow}`,
        }}>
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%',
            background: room.wall, border: '2px solid #ffffff22',
          }}/>
        </div>
      </div>
      {/* speaker / equipment block */}
      <div style={{
        margin: '0 8px 8px', height: '44px', borderRadius: '6px',
        background: '#00000044', border: `1px solid ${room.accent}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: '6px', height: `${12 + i * 6}px`,
            background: room.accent, borderRadius: '2px', opacity: 0.6,
          }}/>
        ))}
      </div>
    </div>
  )
}

function WallWaveform({ zone }) {
  const meta = ZONE_META[zone]
  const pts = Array.from({ length: 32 }, (_, i) => ({
    x: (i / 31) * 100,
    y: 50 + Math.sin(i * 0.7) * 22 + Math.sin(i * 1.9) * 10,
  }))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  return (
    <div style={{
      position: 'absolute', top: '10px', left: '86px', right: '86px',
      height: '44px', opacity: 0.35, zIndex: 1, pointerEvents: 'none',
    }}>
      <svg width="100%" height="44" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={d} fill="none" stroke={meta.color} strokeWidth="2"/>
        {pts.filter((_, i) => i % 4 === 0).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={meta.color} opacity="0.8"/>
        ))}
      </svg>
    </div>
  )
}

function RoomBackground({ zone }) {
  const room = ROOM[zone] || ROOM.Lab
  const meta = ZONE_META[zone] || { color: '#9B6DD4' }
  return (
    <>
      {/* shelves */}
      <BookShelf room={room} x="left"  books={8} rows={3} />
      <BookShelf room={room} x="right" books={8} rows={3} />

      {/* wall waveform art */}
      <WallWaveform zone={zone}/>

      {/* ambient ceiling glow */}
      <div style={{
        position: 'absolute', top: '-60px', left: '50%',
        transform: 'translateX(-50%)',
        width: '300px', height: '200px',
        background: room.glow,
        borderRadius: '50%', filter: 'blur(50px)',
        pointerEvents: 'none', zIndex: 1,
      }}/>

      {/* floor strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '60px', background: room.floor,
        borderTop: `1px solid ${meta.color}18`, zIndex: 1,
      }}/>

      {/* zone label top-center */}
      <div style={{
        position: 'absolute', top: '14px', left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '9px', fontWeight: 800, letterSpacing: '3px',
        color: meta.color, opacity: 0.5,
        fontFamily: 'Nunito, sans-serif', zIndex: 2,
        textTransform: 'uppercase', userSelect: 'none',
        whiteSpace: 'nowrap',
      }}>
        SOUND MUSEUM · {meta.label}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   간단한 오디오 훅 (뮤지엄용 — 세그먼트 없음)
───────────────────────────────────────────── */
function useMuseumPlayer(filePath) {
  const [playing,   setPlaying]   = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [playCount, setPlayCount] = useState(0)
  const [error,     setError]     = useState('')
  const durRef  = useRef(null)
  const playRef = useRef(false)
  const pollRef = useRef(null)

  const clearPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const toggle = useCallback(async () => {
    if (playing) { stopSound(); clearPoll(); playRef.current = false; setPlaying(false); return }
    setError('')
    try {
      const dur = await playSound(filePath, {
        onEnd: () => { clearPoll(); playRef.current = false; setPlaying(false); setProgress(1) },
      })
      durRef.current = dur
      playRef.current = true
      setPlaying(true)
      setPlayCount(c => c + 1)
      clearPoll()
      pollRef.current = setInterval(() => {
        if (!playRef.current) { clearPoll(); return }
        const pos = getCurrentTime()
        if (pos !== null && durRef.current) setProgress(Math.min(pos / durRef.current, 1))
      }, 100)
    } catch { setError('오디오를 불러올 수 없어요.') }
  }, [playing, filePath])

  useEffect(() => () => { stopSound(); clearPoll() }, [])
  return { playing, progress, playCount, error, toggle }
}

/* ─────────────────────────────────────────────
   미니 파형 바
───────────────────────────────────────────── */
function MiniWave({ progress, accent }) {
  const BAR = 30
  const heights = useRef(Array.from({ length: BAR }, () => 15 + Math.random() * 72))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '32px', margin: '8px 0' }}>
      {heights.current.map((h, i) => {
        const filled = (i + 0.5) / BAR <= progress
        return (
          <div key={i} style={{
            flex: 1, height: `${h}%`, borderRadius: '2px',
            background: filled ? accent : `${accent}28`,
            transition: 'background 0.08s',
          }}/>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────
   SoundMuseum 메인
───────────────────────────────────────────── */
export default function SoundMuseum({ sound, zone, myExpression, participantId, sessionId, onDone }) {
  const room  = ROOM[zone]      || ROOM.Lab
  const npc   = ZONE_NPC[zone]  || ZONE_NPC.Lab
  const meta  = ZONE_META[zone] || { color: '#9B6DD4', emoji: '?', label: zone }
  const accent = meta.color

  const [candidates,  setCandidates]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [pick,        setPick]        = useState(null) // 'A'|'B'|'C'|'similar'|'none'
  const [confidence,  setConfidence]  = useState(3)   // 1–5
  const [submitting,  setSubmitting]  = useState(false)
  const [npcIdx,      setNpcIdx]      = useState(0)
  const [visible,     setVisible]     = useState(false)

  const { playing, progress, playCount, error, toggle } = useMuseumPlayer(sound.file_path)

  // 슬라이드인 애니메이션
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // 후보 표현 로드
  useEffect(() => {
    getCandidateExpressions(sound.sound_id, myExpression)
      .then(data => setCandidates(data.slice(0, 3)))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }, [sound.sound_id, myExpression])

  // NPC 대사 순환
  useEffect(() => {
    const t = setInterval(() => setNpcIdx(i => (i + 1) % npc.lines.length), 5000)
    return () => clearInterval(t)
  }, [npc.lines.length])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const letterMap = { A: 0, B: 1, C: 2 }
      if (pick && pick in letterMap) {
        const candidate = candidates[letterMap[pick]]
        if (candidate) {
          await saveVote({
            participant_id:     participantId,
            session_id:         sessionId,
            sound_id:           sound.sound_id,
            zone,
            voted_ids:          [candidate.id],
            play_count:         playCount,
            listening_time_sec: getListeningTime(),
            stage:              2,
            version:            'v0.4-web',
          })
          resetListeningTime()
        }
      }
    } catch {}
    setSubmitting(false)
    onDone()
  }

  const noCandidate = !loading && candidates.length === 0
  const canSubmit   = noCandidate || pick !== null

  const CONF_LABEL = ['', 'Low', '', 'Medium', '', 'High']

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: room.wall,
      fontFamily: 'Nunito, sans-serif',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <RoomBackground zone={zone}/>

      {/* 전시 카드 */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '420px',
        maxHeight: '86vh', overflowY: 'auto',
        background: '#FAF6EE',
        borderRadius: '20px',
        boxShadow: `0 10px 60px #00000077, 0 0 0 1px ${accent}44`,
        margin: '0 84px',
        scrollbarWidth: 'none',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
      }}>

        {/* 헤더 */}
        <div style={{
          background: `linear-gradient(135deg, ${accent}1A, ${accent}08)`,
          borderBottom: `1px solid ${accent}28`,
          padding: '16px 20px 12px',
          borderRadius: '20px 20px 0 0',
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 800, color: accent,
            letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '4px',
          }}>TODAY'S EXHIBITION</div>
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#2A1F0E', lineHeight: 1.2 }}>
            {meta.emoji} {meta.label} — {sound.sub_category || 'Unknown Sound'}
          </div>
          <div style={{ fontSize: '10px', color: '#8B6A3A', marginTop: '3px' }}>#{sound.sound_id}</div>
        </div>

        <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* 재생 버튼 + 파형 */}
          <div style={{
            background: '#F0EBE0', borderRadius: '14px',
            padding: '14px 16px', border: `1px solid ${accent}24`,
          }}>
            <button onClick={toggle} style={{
              width: '100%', padding: '11px',
              background: playing ? `${accent}1E` : accent,
              border: `2px solid ${accent}`,
              borderRadius: '12px', cursor: 'pointer',
              color: playing ? accent : '#fff',
              fontSize: '14px', fontWeight: 800,
              fontFamily: 'Nunito, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.15s',
              boxShadow: playing ? 'none' : `0 4px 16px ${accent}44`,
            }}>
              {playing
                ? <><span style={{ fontSize: '16px' }}>⏸</span> PAUSE</>
                : <><span style={{ fontSize: '16px' }}>▶</span> PLAY CLIP</>
              }
            </button>
            <MiniWave progress={progress} accent={accent}/>
            {error
              ? <div style={{ fontSize: '11px', color: '#E24B4A', textAlign: 'center' }}>{error}</div>
              : playCount > 0 && <div style={{ fontSize: '10px', color: '#8B6A3A', textAlign: 'center' }}>{playCount}회 재생</div>
            }
          </div>

          {/* 내 표현 배지 — 표현이 있을 때만 표시 */}
          {myExpression ? (
            <div style={{
              background: `${accent}10`, border: `1.5px solid ${accent}40`,
              borderRadius: '12px', padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '18px' }}>💬</span>
              <div>
                <div style={{ fontSize: '9px', color: '#8B6A3A', fontWeight: 800, letterSpacing: '1.5px' }}>
                  MY EXPRESSION
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: accent, letterSpacing: '1px' }}>
                  {myExpression}
                </div>
              </div>
            </div>
          ) : null}

          {/* 후보 표현 섹션 */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8B6A3A', fontSize: '13px', padding: '16px' }}>
              ✦ 후보 표현 불러오는 중...
            </div>
          ) : noCandidate ? (
            <div style={{
              background: '#F0EBE0', borderRadius: '12px', padding: '18px',
              textAlign: 'center', fontSize: '13px', color: '#8B6A3A', lineHeight: 1.7,
            }}>
              🎉 첫 번째 표현자예요!<br/>
              <span style={{ fontSize: '11px', color: '#A09080' }}>다음 참여자가 투표하게 됩니다</span>
            </div>
          ) : (
            <>
              {/* 후보 레이블 카드 */}
              <div>
                <div style={{
                  fontSize: '9px', fontWeight: 800, color: '#8B6A3A',
                  letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
                }}>CANDIDATE EXPRESSION</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {candidates.map((c, i) => {
                    const letter = ['A', 'B', 'C'][i]
                    const isSelected = pick === letter
                    return (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px',
                        background: isSelected ? `${accent}14` : '#F0EBE0',
                        borderRadius: '10px',
                        border: isSelected ? `1.5px solid ${accent}` : `1px solid ${accent}1E`,
                        transition: 'all 0.15s', cursor: 'pointer',
                      }} onClick={() => setPick(letter)}>
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                          background: isSelected ? accent : `${accent}22`,
                          color: isSelected ? '#fff' : accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 800,
                          transition: 'all 0.15s',
                        }}>{letter}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '15px', fontWeight: 700,
                            color: isSelected ? '#2A1F0E' : '#3A2A14',
                          }}>"{c.expression_text}"</div>
                          <div style={{ fontSize: '9px', color: '#A09080' }}>👍 {c.vote_count}표</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 질문 + 선택 버튼 */}
              <div>
                <div style={{
                  textAlign: 'center', fontSize: '13px', fontWeight: 700,
                  color: '#3A2A14', marginBottom: '10px',
                }}>
                  Which expression best matches this sound?
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {candidates.map((_, i) => {
                    const letter = ['A', 'B', 'C'][i]
                    const sel = pick === letter
                    return (
                      <button key={letter} onClick={() => setPick(sel ? null : letter)} style={{
                        width: '52px', height: '44px', borderRadius: '10px',
                        background: sel ? accent : '#F0EBE0',
                        border: `2px solid ${sel ? accent : accent + '44'}`,
                        color: sel ? '#fff' : accent,
                        fontSize: '14px', fontWeight: 800,
                        fontFamily: 'Nunito, sans-serif', cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: sel ? `0 4px 12px ${accent}44` : 'none',
                      }}>[{letter}]</button>
                    )
                  })}
                  {candidates.length >= 2 && (
                    <button onClick={() => setPick(pick === 'similar' ? null : 'similar')} style={{
                      padding: '0 10px', height: '44px', borderRadius: '10px',
                      background: pick === 'similar' ? '#C8A96E' : '#F0EBE0',
                      border: `2px solid ${pick === 'similar' ? '#C8A96E' : '#C8A96E66'}`,
                      color: pick === 'similar' ? '#fff' : '#8B6A3A',
                      fontSize: '10px', fontWeight: 800, lineHeight: 1.3,
                      fontFamily: 'Nunito, sans-serif', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>SIMI-<br/>LAR</button>
                  )}
                  <button onClick={() => setPick(pick === 'none' ? null : 'none')} style={{
                    padding: '0 14px', height: '44px', borderRadius: '10px',
                    background: pick === 'none' ? '#8A8070' : '#F0EBE0',
                    border: `2px solid ${pick === 'none' ? '#8A8070' : '#C8A96E66'}`,
                    color: pick === 'none' ? '#fff' : '#8B6A3A',
                    fontSize: '13px', fontWeight: 800,
                    fontFamily: 'Nunito, sans-serif', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>NONE</button>
                </div>
              </div>
            </>
          )}

          {/* Confidence 슬라이더 */}
          <div>
            <div style={{
              fontSize: '9px', fontWeight: 800, color: '#8B6A3A',
              letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px',
            }}>
              CONFIDENCE LEVEL:{' '}
              <span style={{ color: accent }}>{CONF_LABEL[confidence]}</span>
            </div>
            <input
              type="range" min="1" max="5" value={confidence}
              onChange={e => setConfidence(Number(e.target.value))}
              style={{ width: '100%', accentColor: accent, cursor: 'pointer' }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '9px', color: '#A09080', marginTop: '3px',
            }}>
              <span>Low</span><span>Medium</span><span>High</span>
            </div>
          </div>

          {/* 제출 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            style={{
              padding: '14px', borderRadius: '12px', border: 'none',
              background: canSubmit ? accent : '#C8B8A0',
              color: '#fff', fontSize: '15px', fontWeight: 800,
              fontFamily: 'Nunito, sans-serif', cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? `0 4px 20px ${accent}44` : 'none',
              transition: 'all 0.15s', opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? '저장 중...' : '✅ 다음 소리로'}
          </button>
        </div>
      </div>

      {/* NPC 말풍선 */}
      <div style={{
        position: 'absolute', bottom: '28px', right: '96px',
        zIndex: 20, display: 'flex', alignItems: 'flex-end', gap: '8px',
        maxWidth: '220px',
      }}>
        <div style={{
          background: '#FAF6EE',
          border: `2px solid ${accent}44`,
          borderRadius: '16px 16px 4px 16px',
          padding: '10px 14px',
          fontSize: '11px', color: '#3A2A14', lineHeight: 1.55, fontWeight: 600,
          boxShadow: '0 4px 16px #00000033',
          transition: 'opacity 0.5s',
        }}>
          {npc.lines[npcIdx]}
        </div>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
          background: `${accent}1A`, border: `2px solid ${accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px',
        }}>
          {npc.emoji}
        </div>
      </div>
    </div>
  )
}
