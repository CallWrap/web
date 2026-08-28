import assert from 'node:assert/strict';
import test from 'node:test';

import { toUtteranceSentiments } from '../src/api/adapt.ts';

test('발화별 감정 결과에서 상담사 항목을 식별할 수 있다', () => {
  const sentiments = toUtteranceSentiments([
    { utteranceIndex: 0, speaker: '상담사', score: 0.25 },
    { utteranceIndex: 1, speaker: '고객', score: -0.5 },
  ]);

  assert.deepEqual(sentiments, [
    { utteranceId: 'u0', speaker: 'agent', score: 0.25 },
    { utteranceId: 'u1', speaker: 'client', score: -0.5 },
  ]);
});
