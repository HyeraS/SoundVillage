const STUDY_ACCESS_IDS = new Set([
  'ALLAUDIO',
  'ALL-AUDIO',
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
