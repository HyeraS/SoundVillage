import test from 'node:test';
import assert from 'node:assert/strict';
import { isStudyAccessParticipantId, normalizeStudyAccessId, getStudyAccessGroup } from './studyAccess.mjs';

test('normalizes study access IDs and detects special access', () => {
  assert.equal(normalizeStudyAccessId(' allaudio_a '), 'ALLAUDIO_A');
  assert.equal(normalizeStudyAccessId('study-all'), 'STUDY-ALL');
  assert.equal(isStudyAccessParticipantId('allaudio_a'), true);
  assert.equal(isStudyAccessParticipantId('allaudio_b'), true);
  assert.equal(isStudyAccessParticipantId('allaudio'), false); // 그룹 미지정 형태는 더 이상 유효하지 않음
  assert.equal(isStudyAccessParticipantId('study-all'), true);
  assert.equal(isStudyAccessParticipantId('researcher'), true);
  assert.equal(isStudyAccessParticipantId('p01'), false);
});

test('resolves the fixed group for group-scoped study access IDs', () => {
  assert.equal(getStudyAccessGroup('allaudio_a'), 'A');
  assert.equal(getStudyAccessGroup(' AllAudio-B '), 'B');
  assert.equal(getStudyAccessGroup('researcher'), null); // 그룹 무관 접근은 null
  assert.equal(getStudyAccessGroup('p01'), null);
});
