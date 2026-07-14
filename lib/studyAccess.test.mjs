import test from 'node:test';
import assert from 'node:assert/strict';
import { isStudyAccessParticipantId, normalizeStudyAccessId } from './studyAccess.mjs';

test('normalizes study access IDs and detects special access', () => {
  assert.equal(normalizeStudyAccessId(' allaudio '), 'ALLAUDIO');
  assert.equal(normalizeStudyAccessId('study-all'), 'STUDY-ALL');
  assert.equal(isStudyAccessParticipantId('allaudio'), true);
  assert.equal(isStudyAccessParticipantId('study-all'), true);
  assert.equal(isStudyAccessParticipantId('researcher'), true);
  assert.equal(isStudyAccessParticipantId('p01'), false);
});
