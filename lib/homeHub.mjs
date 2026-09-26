export const HOME_INVITE_REQUIRED_COUNT = 4

const clampCount = value => Math.max(0, Math.floor(Number(value) || 0))

export function getHomeInviteState({ placedCount = 0, shareStatus = 'idle', shareMessage = '', inviteUrl = '' } = {}) {
  const count = clampCount(placedCount)
  const progress = Math.min(100, Math.round(count / HOME_INVITE_REQUIRED_COUNT * 100))
  const decorated = count >= HOME_INVITE_REQUIRED_COUNT

  if (!decorated) {
    return Object.freeze({
      id: 'decorating',
      copyEnabled: false,
      decorated: false,
      progress,
      title: '친구를 맞을 준비 중이에요',
      detail: `가구 ${HOME_INVITE_REQUIRED_COUNT - count}개를 더 놓으면 초대가 열려요`,
    })
  }
  if (shareStatus === 'error') {
    return Object.freeze({ id: 'share-error', copyEnabled: false, decorated: true, progress: 100, title: '초대 링크를 만들지 못했어요', detail: shareMessage || '연결을 확인한 뒤 다시 시도해주세요' })
  }
  if (shareStatus === 'qa') {
    return Object.freeze({ id: 'qa-unavailable', copyEnabled: false, decorated: true, progress: 100, title: '초대 준비 완료', detail: 'QA 모드에서는 실제 공유 링크를 만들지 않아요' })
  }
  if (shareStatus !== 'ready' || !inviteUrl.trim()) {
    return Object.freeze({ id: 'preparing', copyEnabled: false, decorated: true, progress: 100, title: '초대 링크 준비 중', detail: '잠시만 기다려주세요' })
  }
  return Object.freeze({ id: 'ready', copyEnabled: true, decorated: true, progress: 100, title: '친구를 초대할 준비가 됐어요!', detail: '링크를 보내 함께 놀거나 방을 구경시켜 주세요' })
}

export function getHomeLandmarkState({ placedCount = 0, shareStatus = 'idle', visitorConnected = false } = {}) {
  if (visitorConnected) return 'visitor'
  if (clampCount(placedCount) >= HOME_INVITE_REQUIRED_COUNT && shareStatus === 'ready') return 'invite-ready'
  if (clampCount(placedCount) > 0) return 'decorating'
  return 'default'
}
