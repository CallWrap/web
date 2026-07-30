// 목업 — 실제 계산된 값이 아니다. ai/·stt/·api/ 파이프라인이 전부 더미 반환 중이라
// (quality_gate.yaml: "실제 콜 데이터로 검증된 값이 하나도 없다") 현재는 실측치가 존재하지 않는다.
// 아래 숫자는 docs/label_spec.md(v0.4, 기관 확정)의 실제 분류 체계·분포 참고치에 근거해
// "파이프라인이 구현되면 나올 법한" 수준으로 지어낸 자리채움이며, 실측을 주장하지 않는다.

export type CallGradeKR = '칭찬콜' | '악성콜' | '일반';

/** 조정셋(골든셋) vs 홀드아웃(다른 시드로 만든 별도 세트) 지표 대조 */
export interface HoldoutMetric {
  key: string;
  label: string;
  adjusted: number;
  holdout: number;
  unit: '%' | 'pt';
}

export const HOLDOUT_METRICS: HoldoutMetric[] = [
  { key: 'stt', label: 'STT 정확도', adjusted: 91.4, holdout: 85.7, unit: '%' },
  { key: 'speaker', label: '화자귀속 정확도', adjusted: 90.8, holdout: 93.1, unit: '%' },
  { key: 'grade', label: '상담등급 분류 정확도', adjusted: 91.7, holdout: 87.5, unit: '%' },
  { key: 'srType', label: '상담유형(SR) Macro-F1', adjusted: 83.3, holdout: 66.7, unit: '%' },
  { key: 'category', label: '상담분류(중분류) Macro-F1', adjusted: 79.2, holdout: 70.8, unit: '%' },
  { key: 'followup', label: '후속처리 판정 정확도', adjusted: 91.7, holdout: 87.5, unit: '%' },
];

/** 상담등급 혼동행렬 — 정답(행) vs 자동판정(열), 골든셋 24건 기준 */
export const GRADE_CONFUSION: { actual: CallGradeKR; predicted: Record<CallGradeKR, number> }[] = [
  { actual: '칭찬콜', predicted: { 칭찬콜: 3, 악성콜: 0, 일반: 0 } },
  { actual: '악성콜', predicted: { 칭찬콜: 0, 악성콜: 3, 일반: 1 } },
  { actual: '일반', predicted: { 칭찬콜: 0, 악성콜: 1, 일반: 16 } },
];

/** 골든셋 상담유형(SR) 표본 분포 — 희소 클래스를 의도적으로 과표집(label_spec.md 방침) */
export const TYPE_GOLDEN_DIST: { type: string; n: number }[] = [
  { type: '사용법문의', n: 6 },
  { type: '자료확인', n: 5 },
  { type: '자료보정', n: 3 },
  { type: '정책 및 지침문의', n: 3 },
  { type: '시스템오류', n: 2 },
  { type: '기능개선', n: 2 },
  { type: '고객PC환경', n: 2 },
  { type: '기타', n: 1 },
];

/** 실제 모집단 분포 참고치 — label_spec.md, 타 사업군 통계라 스코프는 다르지만 극단적 불균형의 근거 */
export const TYPE_REAL_WORLD_REF: { type: string; n: number }[] = [
  { type: '사용법문의', n: 225491 },
  { type: '자료확인', n: 109971 },
  { type: '기타', n: 6943 },
  { type: '자료보정', n: 780 },
  { type: '정책 및 지침문의', n: 462 },
  { type: '고객PC환경', n: 340 },
  { type: '시스템오류', n: 6 },
  { type: '기능개선', n: 1 },
];

/** 판단형 필드 — 규칙기반(휴리스틱) vs LLM 정확도 비교 */
export const RULE_VS_LLM_JUDGMENT: { field: string; rule: number; llm: number }[] = [
  { field: '상담등급', rule: 91.7, llm: 95.8 },
  { field: '후속처리 판정', rule: 87.5, llm: 91.7 },
];

/** 분류형 필드 — 규칙기반(키워드) vs LLM Macro-F1 비교 */
export const RULE_VS_LLM_CLASSIFICATION: { field: string; rule: number; llm: number }[] = [
  { field: '상담유형(SR)', rule: 62.5, llm: 83.3 },
  { field: '상담분류(중분류)', rule: 58.3, llm: 79.2 },
];
