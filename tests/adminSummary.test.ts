import assert from 'node:assert/strict';
import test from 'node:test';

import { toCallFromSummary } from '../src/api/adapt.ts';
import type { BackendReviewSummary } from '../src/api/backendTypes.ts';

test('관리자 상담대장 요약은 상담사·분류·검토시간을 보존한다', () => {
  const summary = {
    reviewId: 'review-1',
    callNo: 12,
    title: '로그인 문의',
    status: 'CONFIRMED',
    retryCount: 0,
    grade: { value: '일반', confidence: 0.9, evidenceIndices: [] },
    needsFollowup: { value: false, confidence: 0.9, evidenceIndices: [] },
    highConfidenceFieldCount: 5,
    totalFieldCount: 5,
    callStartedAt: '2026-08-28T09:10:00',
    callDurationSec: 320,
    createdAt: '2026-08-28T09:10:00',
    updatedAt: '2026-08-28T09:12:00',
    counselor: { id: 'counselor-1', name: '김상담' },
    classification: {
      type: { value: '사용법문의', confidence: 0.9, evidenceIndices: [] },
      category: { value: '시스템 이용', confidence: 0.9, evidenceIndices: [] },
      subcategory: { value: '로그인', confidence: 0.9, evidenceIndices: [] },
    },
    reviewSec: 83,
  } satisfies BackendReviewSummary;

  const call = toCallFromSummary(summary);

  assert.deepEqual(call.counselor, { id: 'counselor-1', name: '김상담' });
  assert.equal(call.fields.type.value, '사용법문의');
  assert.equal(call.fields.category.value, '시스템 이용');
  assert.equal(call.fields.subcategory.value, '로그인');
  assert.equal(call.reviewSec, 83);
});
