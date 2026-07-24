// 그룹 전용 연구용 접근 ID → 그 그룹으로만 필터링해서 진입한다(그룹 A/B 참여자가
// 보는 화면과 사운드 목록·블록 배치가 정확히 동일하도록 groupId를 고정시키는 것이 목적).
const STUDY_ACCESS_GROUP_IDS = {
  'ALLAUDIO_A': 'A',
  'ALLAUDIO-A': 'A',
  'ALLAUDIO_B': 'B',
  'ALLAUDIO-B': 'B',
};

// 그룹 무관 연구용 접근 ID → 그룹 필터 없이 전체(A+B) 데이터셋을 바로 보여준다.
// 이 모드에서는 아이템 배치 좌표가 실제 참여자 화면과 일치하지 않는다(그룹별로
// 필터링된 사운드 목록이 아니라 전체를 대상으로 배치를 계산하기 때문).
const STUDY_ACCESS_IDS = new Set([
  ...Object.keys(STUDY_ACCESS_GROUP_IDS),
  'STUDYALL',
  'STUDY-ALL',
  'ACCESSALL',
  'ACCESS-ALL',
  'AUDIOTEST',
  'AUDIO-TEST',
  'RESEARCHER',
]);

export function normalizeStudyAccessId(value) {
  return String(value || '').trim().toUpperCase();
}

export function isStudyAccessParticipantId(value) {
  const normalized = normalizeStudyAccessId(value);
  if (!normalized) return false;
  return STUDY_ACCESS_IDS.has(normalized);
}

// 그룹 전용 연구용 접근 ID(ALLAUDIO_A/ALLAUDIO_B)면 'A'|'B'를, 그 외(그룹 무관
// 연구용 접근 ID이거나 일반 참여자 ID)면 null을 반환한다.
export function getStudyAccessGroup(value) {
  const normalized = normalizeStudyAccessId(value);
  return STUDY_ACCESS_GROUP_IDS[normalized] || null;
}
