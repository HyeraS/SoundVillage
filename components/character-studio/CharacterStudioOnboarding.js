'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './characterStudioOnboarding.module.css'

export const CHARACTER_STUDIO_ONBOARDING_VERSION = 1
export const CHARACTER_STUDIO_ONBOARDING_KEY = `soundvillage-character-studio-onboarding-v${CHARACTER_STUDIO_ONBOARDING_VERSION}`

export default function CharacterStudioOnboarding({ enabled }) {
  const [visible, setVisible] = useState(false)
  const cardRef = useRef(null)
  const closeRef = useRef(null)

  const dismiss = useCallback(() => {
    try { window.localStorage.setItem(CHARACTER_STUDIO_ONBOARDING_KEY, 'dismissed') } catch {}
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let dismissed = false
    try { dismissed = window.localStorage.getItem(CHARACTER_STUDIO_ONBOARDING_KEY) === 'dismissed' } catch {}
    if (dismissed) return undefined
    const focusTimer = window.setTimeout(() => {
      setVisible(true)
      window.requestAnimationFrame(() => closeRef.current?.focus())
    }, 0)
    return () => window.clearTimeout(focusTimer)
  }, [enabled])

  useEffect(() => {
    if (!visible) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (!cardRef.current?.contains(document.activeElement)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      dismiss()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [dismiss, visible])

  if (!enabled || !visible) return null
  return <aside ref={cardRef} className={styles.card} role="dialog" aria-modal="false" aria-labelledby="character-onboarding-title" data-testid="character-studio-onboarding">
    <button ref={closeRef} className={styles.close} type="button" aria-label="캐릭터 스타일 안내 닫기" onClick={dismiss}>×</button>
    <span className={styles.eyebrow}>처음 오셨나요?</span>
    <h2 id="character-onboarding-title">기본 외형은 무료로 바꿀 수 있어요</h2>
    <ul>
      <li><strong>피부색·눈·헤어</strong>는 화폐 없이 선택할 수 있어요.</li>
      <li>선택만 하면 <strong>임시 미리보기</strong>이고, <strong>외형 저장</strong>을 눌러야 게임에 적용돼요.</li>
      <li><strong>의상·액세서리</strong>는 별도 상품이라 구매 또는 보유 여부를 확인해 주세요.</li>
    </ul>
    <button className={styles.confirm} type="button" onClick={dismiss}>확인했어요</button>
  </aside>
}
