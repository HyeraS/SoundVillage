'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { playSound, stopSound, seekTo, getCurrentTime, getListeningTime, resetListeningTime } from '@/lib/audioManager';
import { saveAnnotation } from '@/lib/supabase';

/* ─────────────────────────────────────────────
   Zone 팔레트 — Mystery 포함
───────────────────────────────────────────── */
const ZONE_PALETTE = {
  Animal: { bg: '#0d1e0a', card: '#162e10', accent: '#5B9E3A', glow: '#5B9E3A28', label: '🐾 동물' },
  Human:  { bg: '#1e150a', card: '#2e1e10', accent: '#E8A04A', glow: '#E8A04A28', label: '👤 사람' },
  Nature: { bg: '#0a1628', card: '#112240', accent: '#4A8FD4', glow: '#4A8FD428', label: '🌿 자연' },
  Urban:  { bg: '#161512', card: '#211f1a', accent: '#C4B99A', glow: '#C4B99A28', label: '🏙 도시' },
  Music:  { bg: '#110d28', card: '#1a1438', accent: '#9B6DD4', glow: '#9B6DD428', label: '🎵 음악' },
  Lab:    { bg: '#110f1e', card: '#1a172c', accent: '#D4883A', glow: '#D4883A28', label: '✨ 미지' },
};

/* ─────────────────────────────────────────────
   재생 아이콘
───────────────────────────────────────────── */
function PlayIcon({ playing }) {
  return playing ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.5"/>
      <rect x="14" y="5" width="4" height="14" rx="1.5"/>
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v14l11-7-11-7z"/>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   세그먼트 상수 + 계산
   재생 구조: [도입 2s] → [핵심 5s] → [마무리 1s]
───────────────────────────────────────────── */
const INTRO_DUR  = 2;
const MID_DUR    = 5;
const OUTRO_DUR  = 1;
const TOTAL_VIRT = INTRO_DUR + MID_DUR + OUTRO_DUR; // 8s

// 도입 0~2/8, 핵심 2~7/8, 마무리 7~8/8
const SEG_COLORS = {
  intro:  '#88b4e8',
  middle: null,      // accent 색상 사용
  outro:  '#e8b488',
};

function computeSegments(dur) {
  if (!dur || dur <= TOTAL_VIRT) return null; // 짧은 클립은 전체 재생
  const midC = dur / 2;
  return [
    { label: 'intro',  start: 0,              end: INTRO_DUR,       vDur: INTRO_DUR  },
    { label: 'middle', start: midC - 2.5,     end: midC + 2.5,      vDur: MID_DUR    },
    { label: 'outro',  start: dur - OUTRO_DUR, end: dur,             vDur: OUTRO_DUR  },
  ];
}

/* ─────────────────────────────────────────────
   짧은 클립 반복 재생 상수 + 계산
   4초 미만 클립: 총 청취 ~6초 목표로 N회 반복
───────────────────────────────────────────── */
const SHORT_THRESHOLD = 4; // 이 초 미만이면 반복 재생

function computeLoopTotal(dur) {
  if (!dur || dur >= SHORT_THRESHOLD) return 0;
  return Math.min(8, Math.max(3, Math.ceil(6 / dur)));
}

/* ─────────────────────────────────────────────
   파형 시각화 (세그먼트 지원)
───────────────────────────────────────────── */
function SegmentedWaveform({ accent, progress, segLabel, isSegmented, onSeek }) {
  const BAR = 44;
  const heights = useRef(Array.from({ length: BAR }, () => 18 + Math.random() * 65));
  const wrapRef = useRef(null);

  const handleClick = (e) => {
    if (!onSeek || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1)));
  };

  const getBarColor = (i) => {
    const r      = (i + 0.5) / BAR;
    const filled = progress !== null && r <= progress;

    if (!isSegmented) {
      return filled ? accent : `${accent}38`;
    }

    let base;
    if (r < 2 / 8)      base = SEG_COLORS.intro;
    else if (r < 7 / 8) base = accent;
    else                 base = SEG_COLORS.outro;

    const active =
      (segLabel === 'intro'  && r < 2 / 8) ||
      (segLabel === 'middle' && r >= 2 / 8 && r < 7 / 8) ||
      (segLabel === 'outro'  && r >= 7 / 8);

    if (filled)  return base;
    if (active)  return `${base}55`;
    return `${base}28`;
  };

  return (
    <div>
      {isSegmented && (
        <div style={{ display: 'flex', marginBottom: '5px', fontSize: '9px', fontWeight: 600, userSelect: 'none' }}>
          <div style={{ flex: INTRO_DUR,  textAlign: 'center', color: SEG_COLORS.intro  }}>↓ 도입 {INTRO_DUR}s</div>
          <div style={{ flex: MID_DUR,    textAlign: 'center', color: accent             }}>↓ 핵심 {MID_DUR}s</div>
          <div style={{ flex: OUTRO_DUR,  textAlign: 'center', color: SEG_COLORS.outro  }}>↓ {OUTRO_DUR}s</div>
        </div>
      )}

      <div
        ref={wrapRef}
        onClick={handleClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          height: '52px', cursor: 'pointer', position: 'relative',
          userSelect: 'none',
        }}
      >
        {heights.current.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: `${h}%`, borderRadius: '2px',
              background: getBarColor(i),
              transition: 'background 0.06s',
            }}
          />
        ))}

        {isSegmented && (
          <>
            <div style={{ position: 'absolute', left: `${(2 / 8) * 100}%`, top: 0, bottom: 0, width: '1px', background: '#ffffff22', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: `${(7 / 8) * 100}%`, top: 0, bottom: 0, width: '1px', background: '#ffffff22', pointerEvents: 'none' }} />
          </>
        )}
      </div>

      {isSegmented && (
        <div style={{ position: 'relative', height: '14px', marginTop: '3px', fontSize: '9px', color: '#555050', userSelect: 'none' }}>
          <span style={{ position: 'absolute', left: 0 }}>0s</span>
          <span style={{ position: 'absolute', left: `${(2 / 8) * 100}%`, transform: 'translateX(-50%)' }}>2s</span>
          <span style={{ position: 'absolute', left: `${(7 / 8) * 100}%`, transform: 'translateX(-50%)' }}>7s</span>
          <span style={{ position: 'absolute', right: 0 }}>8s</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Confidence 선택기
───────────────────────────────────────────── */
const CONF_OPTIONS = [
  { key: 'low',    label: '🤔 Low',    desc: '잘 모르겠어요' },
  { key: 'medium', label: '😊 Medium', desc: '나름 비슷한 것 같아요' },
  { key: 'high',   label: '🎯 High',   desc: '딱 이 표현이에요!' },
];
function ConfidenceSelector({ value, onChange, accent }) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {CONF_OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          title={o.desc}
          style={{
            flex: 1, padding: '9px 4px', borderRadius: '10px',
            border: value === o.key ? `1.5px solid ${accent}` : '1.5px solid #ffffff15',
            background: value === o.key ? `${accent}20` : 'transparent',
            color: value === o.key ? accent : '#9A9585',
            fontSize: '12px', fontFamily: 'Nunito, sans-serif',
            fontWeight: value === o.key ? 700 : 400,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   세그먼트 재생 훅
   - 8s 초과 클립: [도입 2s] → [핵심 5s] → [마무리 1s] 자동 점프
   - 4s~8s 클립: 전체 재생
   - 4s 미만 클립: 총 청취 ~6s 목표로 N회 자동 반복 (MUSHRA 기준)
   - seekVirtual(ratio): 파형 클릭 시 해당 위치로 이동
───────────────────────────────────────────── */
function useSegmentedPlayer(filePath) {
  const [playing,     setPlaying]     = useState(false);
  const [progress,    setProgress]    = useState(null);
  const [playCount,   setPlayCount]   = useState(0);
  const [audioError,  setAudioError]  = useState('');
  const [isSegmented, setIsSegmented] = useState(false);
  const [segLabel,    setSegLabel]    = useState('');
  const [loopCurrent, setLoopCurrent] = useState(0); // 현재까지 완료된 루프 수
  const [loopTotal,   setLoopTotal]   = useState(0); // 총 루프 횟수 (0 = 짧은 클립 아님)

  const durationRef    = useRef(null);
  const segsRef        = useRef(null);
  const segIdxRef      = useRef(0);
  const playingRef     = useRef(false);
  const pollRef        = useRef(null);
  const loopCurRef     = useRef(0);
  const loopTotRef     = useRef(0);
  const replayTimerRef = useRef(null);
  const playAgainRef   = useRef(null); // 루프 재생용 함수 ref

  const clearPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const clearReplayTimer = () => {
    if (replayTimerRef.current) { clearTimeout(replayTimerRef.current); replayTimerRef.current = null; }
  };

  const finish = useCallback(() => {
    clearPoll();

    // 짧은 클립 루프 남아있으면 다음 루프 예약
    if (playingRef.current && loopCurRef.current < loopTotRef.current - 1 && playAgainRef.current) {
      loopCurRef.current += 1;
      setLoopCurrent(loopCurRef.current);
      setProgress(0);
      replayTimerRef.current = setTimeout(() => {
        if (playingRef.current) playAgainRef.current?.();
      }, 300);
      return;
    }

    clearReplayTimer();
    playingRef.current = false;
    setPlaying(false);
    setProgress(1);
    setSegLabel('');
  }, []);

  const startPoll = useCallback(() => {
    clearPoll();
    pollRef.current = setInterval(() => {
      if (!playingRef.current) { clearPoll(); return; }
      const pos = getCurrentTime();
      if (pos === null) return;

      const segs = segsRef.current;

      if (!segs) {
        // 전체 재생 모드 (짧은 클립 포함) — 위치 기반 progress
        const dur = durationRef.current;
        if (dur) setProgress(Math.min(pos / dur, 1));
        return;
      }

      const idx = segIdxRef.current;
      if (idx >= segs.length) { finish(); return; }
      const seg = segs[idx];

      if (pos >= seg.end - 0.1) {
        const next = idx + 1;
        if (next >= segs.length) {
          finish();
        } else {
          segIdxRef.current = next;
          seekTo(segs[next].start);
          setSegLabel(segs[next].label);
        }
      } else {
        const elapsed = segs.slice(0, idx).reduce((a, s) => a + s.vDur, 0)
          + Math.max(0, pos - seg.start);
        const total = segs.reduce((a, s) => a + s.vDur, 0);
        setProgress(Math.min(elapsed / total, 1));
      }
    }, 50);
  }, [finish]);

  const toggle = useCallback(async () => {
    if (playing) {
      stopSound();
      clearPoll();
      clearReplayTimer();
      playingRef.current = false;
      setPlaying(false);
      return;
    }

    setAudioError('');
    setProgress(0);

    // 루프 재생 함수 (짧은 클립 루프마다 호출)
    const playOnce = async () => {
      const dur = await playSound(filePath, {
        onEnd: () => { if (playingRef.current) finish(); },
      });
      durationRef.current = dur;
      startPoll();
    };
    playAgainRef.current = playOnce;

    try {
      const dur = await playSound(filePath, {
        onEnd: () => { if (playingRef.current) finish(); },
      });

      durationRef.current = dur;
      const segs = computeSegments(dur);
      segsRef.current   = segs;
      segIdxRef.current = 0;
      playingRef.current = true;

      // 짧은 클립 루프 초기화
      const lt = computeLoopTotal(dur);
      loopTotRef.current = lt;
      loopCurRef.current = 0;
      setLoopTotal(lt);
      setLoopCurrent(0);

      setIsSegmented(!!segs);
      setSegLabel(segs ? segs[0].label : '');
      setPlaying(true);
      setPlayCount(c => c + 1);
      startPoll();
    } catch {
      setAudioError('오디오 파일을 불러올 수 없어요.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, filePath, finish, startPoll]);

  // 파형 클릭 → 가상 타임라인(0~1) 기준으로 실제 위치 이동
  const seekVirtual = useCallback((ratio) => {
    if (!playingRef.current) return;
    const segs = segsRef.current;
    const dur  = durationRef.current;

    if (!segs) {
      if (dur) seekTo(ratio * dur);
      return;
    }

    const total = segs.reduce((a, s) => a + s.vDur, 0);
    const vTime = ratio * total;
    let acc = 0;
    for (let i = 0; i < segs.length; i++) {
      if (vTime < acc + segs[i].vDur) {
        segIdxRef.current = i;
        seekTo(segs[i].start + (vTime - acc));
        setSegLabel(segs[i].label);
        return;
      }
      acc += segs[i].vDur;
    }
  }, []);

  useEffect(() => () => { stopSound(); clearPoll(); clearReplayTimer(); }, []);

  return { playing, progress, playCount, audioError, isSegmented, segLabel, loopCurrent, loopTotal, toggle, seekVirtual };
}

/* ─────────────────────────────────────────────
   Stage 1 — 의성어 입력 패널
───────────────────────────────────────────── */
const SEG_STATUS = {
  intro:  '맥락 파악 중... 처음 2초 🎧',
  middle: '핵심 구간! 이 소리를 표현해주세요 ✏️',
  outro:  '마무리 1초 🎵',
};

function Stage1Panel({ sound, zone, palette, participantId, sessionId, onSubmit, onSkip }) {
  const [text, setText]             = useState('');
  const [confidence, setConfidence] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const inputRef                    = useRef(null);

  const { accent, card, glow } = palette;
  const { playing, progress, playCount, audioError, isSegmented, segLabel, loopCurrent, loopTotal, toggle, seekVirtual } =
    useSegmentedPlayer(sound.file_path);

  const isShortClip  = loopTotal > 0;
  const loopsLeft    = loopTotal - loopCurrent - 1; // 현재 루프 완료 후 남은 횟수
  const allLoopsDone = loopCurrent >= loopTotal - 1;

  // 패널 열릴 때 input 포커스
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const handleSubmit = async () => {
    if (!text.trim()) { setError('의성어를 입력해주세요 🎵'); return; }
    setSubmitting(true);
    setError('');
    try {
      const confMap = { low: 1, medium: 3, high: 5 };
      await saveAnnotation({
        participant_id:     participantId,
        session_id:         sessionId,
        sound_id:           sound.sound_id,
        zone,
        source_type:        sound.source_type    || '',
        sub_category:       sound.sub_category   || '',
        audioset_class:     sound.audioset_class || '',
        expression_text:    text.trim(),
        confidence:         confMap[confidence],
        play_count:         playCount,
        listening_time_sec: getListeningTime(),
        stage:              1,
        is_verified:        false,
        version:            'v0.4-web',
      });
      resetListeningTime();
      onSubmit({ expression_text: text.trim(), confidence });
    } catch (err) {
      console.error('[AnnotationPanel] 제출 오류:', err);
      setError(`저장 오류: ${err?.message || '네트워크를 확인해주세요.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const statusMsg = audioError
    ? null
    : playing
      ? isShortClip
        ? `${loopCurrent + 1} / ${loopTotal}회 재생 중...`
        : (SEG_STATUS[segLabel] || '듣는 중... 소리를 잘 느껴보세요 👂')
      : isShortClip && loopTotal > 0 && !allLoopsDone && playCount > 0
        ? '한 번 더 들어보세요 👂'
        : '▶ 재생 · 파형을 클릭하면 해당 구간부터 다시 들을 수 있어요';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 소리 정보 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
          background: `${accent}18`, border: `1px solid ${accent}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
        }}>
          {palette.label.split(' ')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', color: accent, fontWeight: 700 }}>
            {palette.label.split(' ')[1]} Zone
          </div>
          <div style={{ fontSize: '10px', color: '#6B6660', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sound.sub_category ? `${sound.sub_category} · ` : ''}{sound.sound_id}
          </div>
        </div>
        {playCount > 0 && (
          <div style={{ fontSize: '10px', color: '#6B6660', flexShrink: 0 }}>{playCount}회 재생</div>
        )}
      </div>

      {/* 파형 + 재생 */}
      <div style={{
        background: card, borderRadius: '14px',
        border: `1px solid ${accent}28`,
        padding: '14px 16px',
        boxShadow: `0 0 24px ${glow}`,
      }}>
        {/* 짧은 클립 안내 */}
        {isShortClip && playCount === 0 && (
          <div style={{ textAlign: 'center', fontSize: '11px', color: `${accent}bb`, marginBottom: '8px', fontWeight: 600 }}>
            짧은 소리예요 · {loopTotal}회 들려드릴게요
          </div>
        )}

        <SegmentedWaveform
          accent={accent}
          progress={progress}
          segLabel={segLabel}
          isSegmented={isSegmented}
          onSeek={seekVirtual}
        />

        {/* 루프 도트 인디케이터 */}
        {isShortClip && playCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '8px' }}>
            {Array.from({ length: loopTotal }, (_, i) => (
              <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: i < loopCurrent ? accent
                  : i === loopCurrent ? (playing ? accent : `${accent}99`)
                  : `${accent}30`,
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={toggle}
            style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: playing ? `${accent}28` : accent,
              border: `2px solid ${accent}`,
              color: playing ? accent : '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              boxShadow: playing ? `0 0 20px ${accent}66` : `0 4px 12px ${accent}44`,
              flexShrink: 0,
            }}
          >
            <PlayIcon playing={playing} />
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '8px', minHeight: '16px' }}>
          {audioError
            ? <span style={{ color: '#E24B4A' }}>{audioError}</span>
            : <span style={{ color: playing && isShortClip ? accent : segLabel === 'middle' ? accent : '#6B6660' }}>{statusMsg}</span>
          }
        </div>
      </div>

      {/* 의성어 입력 */}
      <div style={{ opacity: isShortClip && playCount === 0 ? 0.45 : 1, transition: 'opacity 0.3s' }}>
        <label style={{ fontSize: '12px', color: '#9A9585', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
          ✏️ 이 소리를 글자로 표현한다면?
          {isShortClip && !allLoopsDone && playCount > 0 && (
            <span style={{ marginLeft: '6px', color: `${accent}99`, fontWeight: 400 }}>
              ({loopsLeft}회 더 들을 수 있어요)
            </span>
          )}
        </label>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && !submitting && handleSubmit()}
          placeholder={isShortClip && playCount === 0 ? '▶ 먼저 소리를 들어보세요' : '예: 쨍그랑, Whoosh, 뚝뚝뚝, 치이익...'}
          maxLength={80}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 16px', borderRadius: '12px',
            background: card,
            border: error ? '1.5px solid #E24B4A' : text ? `1.5px solid ${accent}66` : '1.5px solid #ffffff15',
            color: '#F0EDE8', fontSize: '15px',
            fontFamily: 'Nunito, sans-serif', fontWeight: 600,
            outline: 'none', transition: 'border-color 0.15s',
            letterSpacing: '0.5px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span style={{ fontSize: '11px', color: error ? '#E24B4A' : '#6B6660' }}>
            {error || '자유롭게 입력 — 정답은 없어요 😊'}
          </span>
          <span style={{ fontSize: '11px', color: '#6B6660' }}>{text.length}/80</span>
        </div>
      </div>

      {/* Confidence */}
      <div>
        <label style={{ fontSize: '12px', color: '#9A9585', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
          🎯 내 표현에 얼마나 자신 있나요?
        </label>
        <ConfidenceSelector value={confidence} onChange={setConfidence} accent={accent} />
      </div>

      {/* 버튼 행 */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onSkip}
          style={{
            flex: '0 0 80px', padding: '12px', borderRadius: '12px',
            background: 'transparent', border: '1.5px solid #ffffff15',
            color: '#6B6660', fontSize: '13px', fontFamily: 'Nunito, sans-serif', cursor: 'pointer',
          }}
        >
          건너뛰기
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          style={{
            flex: 1, padding: '13px', borderRadius: '12px', border: 'none',
            background: text.trim() ? accent : '#ffffff15',
            color: text.trim() ? '#fff' : '#6B6660',
            fontSize: '15px', fontWeight: 700, fontFamily: 'Nunito, sans-serif',
            cursor: text.trim() && !submitting ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            boxShadow: text.trim() ? `0 4px 20px ${accent}55` : 'none',
          }}
        >
          {submitting ? '저장 중...' : '✅ 제출하기'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   메인 AnnotationPanel — Stage 1 (표현 입력)만 담당
   Stage 2는 SoundMuseum으로 이전
───────────────────────────────────────────── */
export default function AnnotationPanel({ sound, zone, participantId, sessionId, onClose, onComplete }) {
  const [visible, setVisible] = useState(false);
  const palette = ZONE_PALETTE[zone] || ZONE_PALETTE.Lab;

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  if (!sound) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  // Stage 1 제출 → 패널 슬라이드다운 후 뮤지엄 전환
  const handleStage1Submit = ({ expression_text }) => {
    setVisible(false);
    setTimeout(() => onComplete?.({ expression_text }), 280);
  };

  const handleSkip = async () => {
    try {
      await saveAnnotation({
        participant_id:  participantId,
        session_id:      sessionId,
        sound_id:        sound.sound_id,
        zone,
        source_type:     sound.source_type    || '',
        sub_category:    sound.sub_category   || '',
        audioset_class:  sound.audioset_class || '',
        expression_text: '',
        is_skipped:      true,
        skip_reason:     'user_skip',
        stage:           1,
        version:         'v0.4-web',
      });
    } catch {}
    handleClose();
  };

  return (
    <>
      {/* 딤 오버레이 */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: '#000000aa',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 100,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* 바텀시트 패널 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
        width: '100%', maxWidth: '520px',
        maxHeight: '88vh', overflowY: 'auto',
        background: palette.bg,
        borderRadius: '22px 22px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        zIndex: 101,
        transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: `0 -6px 60px ${palette.glow}, 0 -1px 0 ${palette.accent}33`,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>

        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: '#ffffff20' }} />
        </div>

        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 20px 14px',
          borderBottom: `1px solid ${palette.accent}18`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '26px', height: '7px', borderRadius: '4px',
              background: palette.accent,
            }} />
            <span style={{ fontSize: '12px', color: '#9A9585' }}>소리 전사 · 표현 입력</span>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: '#ffffff10', border: 'none',
              color: '#9A9585', cursor: 'pointer',
              width: '28px', height: '28px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', transition: 'background 0.15s',
            }}
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div style={{ padding: '18px 20px 24px' }}>
          <Stage1Panel
            sound={sound} zone={zone} palette={palette}
            participantId={participantId} sessionId={sessionId}
            onSubmit={handleStage1Submit} onSkip={handleSkip}
          />
        </div>
      </div>
    </>
  );
}