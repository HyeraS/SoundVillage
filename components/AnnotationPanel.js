'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { playSound, stopSound, seekTo, getCurrentTime, getListeningTime, resetListeningTime } from '@/lib/audioManager';
import { saveAnnotation } from '@/lib/supabase';
import { awardAnnotationCurrency } from '@/lib/currency';
import { recordAnnotationQuestProgress } from '@/lib/dailyQuests';

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
   재생 구조: [도입] → [핵심] → [마무리]
   - ≤4s: null 반환 → 전체 반복 재생
   - >4s: 가변 세그먼트 (실제 길이 비례)
───────────────────────────────────────────── */
const SEG_COLORS = {
  intro:  '#88b4e8',
  middle: null,
  outro:  '#e8b488',
};

function computeSegments(dur) {
  if (!dur || dur <= 4) return null;
  const INTRO = Math.min(dur * 0.20, 2.5);
  const OUTRO = Math.min(dur * 0.15, 1.5);
  const MID   = Math.min(dur * 0.50, 8.0);
  const midC  = dur / 2;
  return [
    { label: 'intro',  start: 0,            end: INTRO,          vDur: INTRO },
    { label: 'middle', start: midC - MID/2, end: midC + MID/2,   vDur: MID   },
    { label: 'outro',  start: dur - OUTRO,  end: dur,            vDur: OUTRO },
  ];
}

function segRatios(segs) {
  const total = segs.reduce((a, s) => a + s.vDur, 0);
  return segs.map(s => s.vDur / total);
}


/* ─────────────────────────────────────────────
   파형 시각화 (세그먼트 지원, 동적 비율)
───────────────────────────────────────────── */
function SegmentedWaveform({ accent, progress, segLabel, isSegmented, segs, onSeek }) {
  const BAR = 44;
  const heights = useRef(Array.from({ length: BAR }, () => 18 + Math.random() * 65));
  const wrapRef = useRef(null);

  // 파형 내 세그먼트 경계 비율 (0~1)
  const ratios = isSegmented && segs ? segRatios(segs) : null;
  const introCut  = ratios ? ratios[0] : 0.25;
  const outroCut  = ratios ? 1 - ratios[2] : 0.875;

  const handleClick = (e) => {
    if (!onSeek || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1)));
  };

  const getBarColor = (i) => {
    const r      = (i + 0.5) / BAR;
    const filled = progress !== null && r <= progress;

    if (!isSegmented) return filled ? accent : `${accent}38`;

    let base;
    if (r < introCut)      base = SEG_COLORS.intro;
    else if (r < outroCut) base = accent;
    else                   base = SEG_COLORS.outro;

    const active =
      (segLabel === 'intro'  && r < introCut) ||
      (segLabel === 'middle' && r >= introCut && r < outroCut) ||
      (segLabel === 'outro'  && r >= outroCut);

    if (filled) return base;
    if (active) return `${base}55`;
    return `${base}28`;
  };

  // 세그먼트 라벨용 초(s) 계산
  const introDur = segs?.[0]?.vDur ?? 2;
  const midDur   = segs?.[1]?.vDur ?? 5;
  const outroDur = segs?.[2]?.vDur ?? 1;
  const fmt = (s) => s < 1 ? `${(s * 10 | 0) / 10}s` : `${Math.round(s)}s`;

  return (
    <div>
      {isSegmented && (
        <div style={{ display: 'flex', marginBottom: '5px', fontSize: '9px', fontWeight: 600, userSelect: 'none' }}>
          <div style={{ flex: introDur, textAlign: 'center', color: SEG_COLORS.intro }}>↓ 도입 {fmt(introDur)}</div>
          <div style={{ flex: midDur,   textAlign: 'center', color: accent            }}>↓ 핵심 {fmt(midDur)}</div>
          <div style={{ flex: outroDur, textAlign: 'center', color: SEG_COLORS.outro }}>↓ {fmt(outroDur)}</div>
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
            <div style={{ position: 'absolute', left: `${introCut * 100}%`, top: 0, bottom: 0, width: '1px', background: '#ffffff22', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: `${outroCut * 100}%`, top: 0, bottom: 0, width: '1px', background: '#ffffff22', pointerEvents: 'none' }} />
          </>
        )}
      </div>

      {isSegmented && segs && (
        <div style={{ position: 'relative', height: '14px', marginTop: '3px', fontSize: '9px', color: '#555050', userSelect: 'none' }}>
          <span style={{ position: 'absolute', left: 0 }}>0s</span>
          <span style={{ position: 'absolute', left: `${introCut * 100}%`, transform: 'translateX(-50%)' }}>{fmt(segs[0].end)}</span>
          <span style={{ position: 'absolute', left: `${outroCut * 100}%`, transform: 'translateX(-50%)' }}>{fmt(segs[2].start)}</span>
          <span style={{ position: 'absolute', right: 0 }}>{fmt(segs[2].end)}</span>
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
   - ≤4s: 전체 재생, 끝나면 다시듣기 버튼
   - >4s: 가변 세그먼트 (도입→핵심→마무리)
───────────────────────────────────────────── */
function useSegmentedPlayer(filePath) {
  const [playing,     setPlaying]     = useState(false);
  const [progress,    setProgress]    = useState(null);
  const [playCount,   setPlayCount]   = useState(0);
  const [audioError,  setAudioError]  = useState('');
  const [isSegmented, setIsSegmented] = useState(false);
  const [segLabel,    setSegLabel]    = useState('');
  const [isShort,     setIsShort]     = useState(false);

  const durationRef = useRef(null);
  const segsRef     = useRef(null);
  const segIdxRef   = useRef(0);
  const playingRef  = useRef(false);
  const pollRef     = useRef(null);

  const clearPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const finish = useCallback(() => {
    clearPoll();
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
      playingRef.current = false;
      setPlaying(false);
      return;
    }

    setAudioError('');
    setProgress(0);

    try {
      const dur = await playSound(filePath, {
        onEnd: () => { if (playingRef.current) finish(); },
      });

      durationRef.current = dur;
      const segs = computeSegments(dur);
      segsRef.current    = segs;
      segIdxRef.current  = 0;
      playingRef.current = true;

      setIsShort(dur <= 4);
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

  useEffect(() => () => { stopSound(); clearPoll(); }, []);

  const getDuration = useCallback(() => durationRef.current, []);

  return { playing, progress, playCount, audioError, isSegmented, segLabel, isShort, segs: segsRef.current, toggle, seekVirtual, getDuration };
}

/* ─────────────────────────────────────────────
   Stage 1 — 의성어 입력 패널
───────────────────────────────────────────── */
const SEG_STATUS = {
  intro:  '맥락 파악 중... 앞부분 듣는 중 🎧',
  middle: '핵심 구간! 이 소리를 표현해주세요 ✏️',
  outro:  '마무리 부분 🎵',
};

function Stage1Panel({ sound, zone, palette, participantId, sessionId, onSubmit, onSkip }) {
  const [text, setText]             = useState('');
  const [confidence, setConfidence] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const inputRef                    = useRef(null);

  const { accent, card, glow } = palette;
  const { playing, progress, playCount, audioError, isSegmented, segLabel, isShort, segs, toggle, seekVirtual, getDuration } =
    useSegmentedPlayer(sound.file_path);

  const played = playCount > 0;

  // 재생해야 입력창이 활성화되므로, 첫 재생이 끝나는 시점에 포커스
  useEffect(() => { if (played) inputRef.current?.focus(); }, [played]);

  const handleSubmit = async () => {
    if (!played) { setError('먼저 소리를 들어주세요 🎧'); return; }
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
      // 화폐 지급은 완전히 별도 흐름 — 실패해도 이미 여기까지 저장은 끝났고,
      // await하지 않아 제출 흐름 속도에도 영향 없음(내부에서 절대 throw 안 함).
      awardAnnotationCurrency({
        participantId:     participantId,
        soundId:           sound.sound_id,
        subCategory:       sound.sub_category || '',
        soundDurationSec:  getDuration(),
        confidence:        confMap[confidence],
      });
      // 일일 퀘스트 진행도 갱신도 화폐 지급과 동일하게 완전 별도 흐름 —
      // await하지 않고, 내부에서 절대 throw 안 함.
      recordAnnotationQuestProgress({
        participantId,
        zone,
        subCategory: sound.sub_category || '',
      });
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
      ? (SEG_STATUS[segLabel] || '듣는 중... 소리를 잘 느껴보세요 👂')
      : played
        ? '파형을 클릭하면 해당 구간부터 다시 들을 수 있어요'
        : '▶ 재생 버튼을 눌러 소리를 들어보세요';

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
        {isShort && !played && (
          <div style={{ textAlign: 'center', fontSize: '11px', color: `${accent}bb`, marginBottom: '8px', fontWeight: 600 }}>
            짧은 소리예요 · 여러 번 들어보세요
          </div>
        )}

        <SegmentedWaveform
          accent={accent}
          progress={progress}
          segLabel={segLabel}
          isSegmented={isSegmented}
          segs={segs}
          onSeek={seekVirtual}
        />

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px', gap: '10px' }}>
          {/* 재생/정지 버튼 */}
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

          {/* 다시 듣기 버튼 — 한 번 이상 재생 후 표시 */}
          {played && !playing && (
            <button
              onClick={toggle}
              style={{
                padding: '8px 14px', borderRadius: '20px',
                background: 'transparent',
                border: `1.5px solid ${accent}55`,
                color: accent,
                fontSize: '12px', fontWeight: 700,
                fontFamily: 'Nunito, sans-serif',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              ↺ 다시 듣기
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '8px', minHeight: '16px' }}>
          {audioError
            ? <span style={{ color: '#E24B4A' }}>{audioError}</span>
            : <span style={{ color: segLabel === 'middle' ? accent : '#6B6660' }}>{statusMsg}</span>
          }
        </div>
      </div>

      {/* 의성어 입력 */}
      <div style={{ opacity: !played ? 0.45 : 1, transition: 'opacity 0.3s' }}>
        <label style={{ fontSize: '12px', color: '#9A9585', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
          ✏️ 이 소리를 글자로 표현한다면?
        </label>
        <input
          ref={inputRef}
          type="text"
          value={text}
          disabled={!played}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
              e.stopPropagation()
              return
            }
            if (e.key === 'Enter' && !submitting) handleSubmit()
          }}
          placeholder={!played ? '▶ 먼저 소리를 들어보세요' : '예: 쨍그랑, Whoosh, 뚝뚝뚝, 치이익...'}
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
            cursor: !played ? 'not-allowed' : 'text',
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
          disabled={submitting || !played || !text.trim()}
          style={{
            flex: 1, padding: '13px', borderRadius: '12px', border: 'none',
            background: played && text.trim() ? accent : '#ffffff15',
            color: played && text.trim() ? '#fff' : '#6B6660',
            fontSize: '15px', fontWeight: 700, fontFamily: 'Nunito, sans-serif',
            cursor: played && text.trim() && !submitting ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            boxShadow: played && text.trim() ? `0 4px 20px ${accent}55` : 'none',
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

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => onClose?.(), 300);
  }, [onClose]);

  // ESC — 전사 패널만 닫고 구역 화면으로 복귀 (마을 목록 화면으로 나가지 않음)
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleClose]);

  if (!sound) return null;

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