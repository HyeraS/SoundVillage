'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './overview.module.css'

const STAGE_WIDTH = 1440
const STAGE_HEIGHT = 844

const MAPS = [
  {
    id: 'world',
    number: '00',
    eyebrow: 'Central hub',
    title: '사운드미믹 월드',
    description: '여섯 마을과 도서관, 우리 집을 연결하는 중앙 허브',
    color: '#efc66a',
    src: '/map-overview/view/world?natureQa=1&worldOverview=1&worldClean=1',
  },
  {
    id: 'music',
    number: '01',
    eyebrow: 'First village',
    title: '음악 마을',
    description: '달빛, 음표 길, 악기 오브젝트가 만드는 첫 탐험 구역',
    color: '#bd91ef',
    src: '/map-overview/view/music',
  },
  {
    id: 'nature',
    number: '02',
    eyebrow: 'Nature village',
    title: '자연 마을',
    description: '농장과 과수원, 온실, 물레방앗간을 잇는 전원 구역',
    color: '#9ecb67',
    src: '/map-overview/view/nature?capture=1',
  },
  {
    id: 'human',
    number: '03',
    eyebrow: 'Human village',
    title: '사람 마을',
    description: '커뮤니티 홀과 생활 골목을 중심으로 구성한 마을',
    color: '#ef9d72',
    src: '/map-overview/view/human?overview=1&static=1',
  },
  {
    id: 'urban',
    number: '04',
    eyebrow: 'Urban village',
    title: '도시 마을',
    description: '도시 입구부터 중심가와 메트로까지 이어지는 구역',
    color: '#67c8dc',
    src: '/map-overview/view/urban',
  },
  {
    id: 'animal',
    number: '05',
    eyebrow: 'Animal village',
    title: '동물 마을',
    description: '해바라기 광장과 목장 풍경을 담은 동물 공동체',
    color: '#f2b55f',
    src: '/map-overview/view/animal?baseOnly=1',
    stageWidth: 1536,
    stageHeight: 1024,
  },
  {
    id: 'lab',
    number: '06',
    eyebrow: 'Unknown sounds',
    title: '미지의 소리 마을',
    description: '수집한 소리를 실험하고 관찰하는 비밀 연구 구역',
    color: '#dc7db6',
    src: '/map-overview/view/lab',
  },
]

function LiveFrame({ map, interactive, reloadKey }) {
  const viewportRef = useRef(null)
  const [scale, setScale] = useState(0.25)
  const [loadedKey, setLoadedKey] = useState(-1)
  const loaded = loadedKey === reloadKey
  const stageWidth = map.stageWidth || STAGE_WIDTH
  const stageHeight = map.stageHeight || STAGE_HEIGHT

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined

    const resize = () => {
      const nextScale = Math.min(
        viewport.clientWidth / stageWidth,
        viewport.clientHeight / stageHeight,
      )
      setScale(Math.max(0.01, nextScale))
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [stageHeight, stageWidth])

  return (
    <div ref={viewportRef} className={styles.viewport}>
      {!loaded && (
        <div className={styles.loading}>
          <span />
          라이브 맵 불러오는 중
        </div>
      )}
      <iframe
        key={reloadKey}
        className={styles.frame}
        src={map.src}
        title={`${map.title} 라이브 프리뷰`}
        tabIndex={interactive ? 0 : -1}
        aria-hidden={!interactive}
        onLoad={() => setLoadedKey(reloadKey)}
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      />
      <div className={styles.liveBadge}><i /> LIVE</div>
    </div>
  )
}

export default function MapOverview() {
  const [focusedId, setFocusedId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const focusedIndex = MAPS.findIndex((map) => map.id === focusedId)

  const closeFocus = useCallback(() => setFocusedId(null), [])
  const moveFocus = useCallback((amount) => {
    setFocusedId((currentId) => {
      const currentIndex = MAPS.findIndex((map) => map.id === currentId)
      if (currentIndex < 0) return MAPS[0].id
      return MAPS[(currentIndex + amount + MAPS.length) % MAPS.length].id
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeFocus()
      if (focusedId && event.key === 'ArrowLeft') moveFocus(-1)
      if (focusedId && event.key === 'ArrowRight') moveFocus(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeFocus, focusedId, moveFocus])

  return (
    <main className={styles.page} data-focused={focusedId ? 'true' : 'false'}>
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>SOUNDMIMIC VILLAGE · MAP COLLECTION</div>
          <h1>구현 맵 오버뷰 <span>7</span></h1>
        </div>
        <div className={styles.headerAside}>
          <p>카드를 크게 열고 <kbd>←</kbd><kbd>→</kbd>로 넘겨보세요</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            전체 새로고침
          </button>
        </div>
      </header>

      <section className={styles.grid} aria-label="구현된 맵 목록">
        {MAPS.map((map) => {
          const focused = focusedId === map.id
          return (
            <article
              key={map.id}
              className={`${styles.card} ${focused ? styles.focused : ''}`}
              style={{ '--accent': map.color }}
            >
              <div className={styles.cardTop}>
                <div className={styles.number}>{map.number}</div>
                <div className={styles.cardTitle}>
                  <span>{map.eyebrow}</span>
                  <h2>{map.title}</h2>
                </div>
                <div className={styles.cardActions}>
                  {focused && (
                    <a href={map.src} target="_blank" rel="noreferrer">새 탭</a>
                  )}
                  <button
                    type="button"
                    onClick={() => focused ? closeFocus() : setFocusedId(map.id)}
                    aria-label={focused ? `${map.title} 크게 보기 닫기` : `${map.title} 크게 보기`}
                  >
                    {focused ? '× 닫기' : '↗ 크게'}
                  </button>
                </div>
              </div>

              <LiveFrame map={map} interactive={focused} reloadKey={reloadKey} />

              <footer className={styles.cardFooter}>
                <p>{map.description}</p>
                <span>{focused ? `${focusedIndex + 1} / ${MAPS.length}` : 'Click to present'}</span>
              </footer>

              {focused && (
                <nav className={styles.focusNav} aria-label="맵 넘기기">
                  <button type="button" onClick={() => moveFocus(-1)} aria-label="이전 맵">←</button>
                  <button type="button" onClick={() => moveFocus(1)} aria-label="다음 맵">→</button>
                </nav>
              )}
            </article>
          )
        })}
      </section>

      {focusedId && <button type="button" className={styles.backdrop} onClick={closeFocus} aria-label="크게 보기 닫기" />}
    </main>
  )
}
