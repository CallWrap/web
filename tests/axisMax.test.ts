import assert from 'node:assert/strict';
import test from 'node:test';

import { axisMax } from '../src/components/admin/axisMax.ts';

// 이 함수가 하는 일은 하나다: 막대 높이를 "그 시리즈의 최댓값"에 맞추지 않는 것.
// 상대 스케일이던 시절엔 하루 3건짜리 데이터가 개요 화면을 꽉 채운 거대한 막대 3개로 나왔다.

test('최댓값이 축 꼭대기에 닿지 않는다 — 위에 여유가 남는다', () => {
  for (const peak of [1, 3, 4, 7, 19, 44, 128, 1000]) {
    const max = axisMax([peak]);
    assert.ok(max > peak, `peak ${peak}: 축 상한 ${max}이 최댓값보다 크지 않다`);
  }
});

test('데이터가 적으면 막대도 낮게 그려진다 (100%를 채우지 않는다)', () => {
  // 값이 전부 1이던 시절 세 막대가 모두 100% 높이였다 — 이게 원래 버그다.
  const max = axisMax([1, 1, 1]);
  assert.ok(1 / max <= 0.5, `1건짜리 막대가 축의 ${Math.round((1 / max) * 100)}%를 차지한다`);
});

test('데이터가 충분하면 최댓값이 축의 60~85%를 쓴다 — 너무 납작하지 않다', () => {
  for (const peak of [7, 19, 44, 128, 517]) {
    const ratio = peak / axisMax([peak]);
    assert.ok(ratio >= 0.6 && ratio <= 0.85, `peak ${peak}: 축의 ${Math.round(ratio * 100)}%`);
  }
});

test('축 상한은 눈금다운 수다', () => {
  assert.equal(axisMax([19]), 25);
  assert.equal(axisMax([4]), 5);
  assert.equal(axisMax([100]), 150);
});

test('값이 전부 0이거나 비어 있어도 0으로 나누지 않는다', () => {
  assert.ok(axisMax([]) > 0);
  assert.ok(axisMax([0, 0, 0]) > 0);
});
