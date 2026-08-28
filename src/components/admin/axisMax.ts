/* ── 차트 축 상한 ─────────────────────────────────────────
   막대 높이를 "그 시리즈의 최댓값"에 맞추면 안 된다. 값이 1·1·1이어도 셋 다 100%가 되어
   패널을 꽉 채우고, 4와 19가 섞인 날과 똑같아 보인다. 실제로 시연용 데이터가 하루 3건이던
   시절 개요 화면이 거대한 막대 3개로 나와서 수치를 읽을 수 없었다.

   그래서 눈금이 있을 법한 값까지 올려 축 상한을 잡고, 최댓값이 축 꼭대기에 닿지 않게
   여유를 남긴다 — 피그마 17도 최댓값 19가 차트 위쪽에 여백을 두고 서 있다.
   데이터가 적으면 막대가 낮게 그려지는 게 맞다. 그게 "적다"는 정보다.

   Charts.tsx가 아니라 여기 있는 이유: 테스트 러너(node --experimental-strip-types)가
   .tsx를 못 읽어서, 순수 계산은 .ts로 빼야 tests/axisMax.test.ts가 돈다.
   ───────────────────────────────────────────────────────── */

/** x 이상인 가장 작은 "눈금다운 수"(1·2·5 × 10ⁿ). 1 미만으로는 안 내려간다 — 건수는 정수다. */
function niceStep(x: number): number {
  if (x <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(x));
  return ([1, 2, 5, 10].find((s) => s * magnitude >= x) ?? 10) * magnitude;
}

export function axisMax(values: number[], floor = 4): number {
  const peak = Math.max(0, ...values);
  if (peak <= 0) return floor;
  // 눈금 4칸 정도가 되게 간격을 잡고, 최댓값 위로 25% 여유를 둔 뒤 그 간격의 배수로 올림한다.
  // 이러면 최댓값 막대가 대략 축의 70~80% 높이에 서서, 위에 숨 쉴 공간이 남는다.
  const step = niceStep(peak / 4);
  return Math.max(floor, Math.ceil((peak * 1.25) / step) * step);
}
