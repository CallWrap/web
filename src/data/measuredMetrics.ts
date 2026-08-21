// AI-model/docs/decisions.md에 기록된 실제 측정 결과만 담는다. 전부 "재현 데이터(합성 음성·생성 대본)
// 기준 내부 지표"이며, 실제 상담 녹취로 재검증되지 않았다 — 화면에 노출할 때 항상 "내부/제한 검증"
// 라벨과 함께 보여준다. 이 파일에 없는 지표는 실제로 측정된 적이 없는 것이다 — 지어내지 않는다.

export const MEASUREMENT_LABEL = '내부/제한 검증 · 재현 데이터 기준';

export interface ModelComparisonRow {
  model: string;
  params: string;
  macroF1: number;
  maliciousRecall: number;
  adopted: boolean;
}

/** 상담등급 판정 모델 선정 비교 — 183건 5-fold 교차검증 (decisions.md 2026-08-18) */
export const GRADE_MODEL_COMPARISON: ModelComparisonRow[] = [
  { model: 'Gemma 3 12B', params: '12B', macroF1: 0.7191, maliciousRecall: 0.8148, adopted: false },
  { model: 'EXAONE 3.5 7.8B', params: '7.8B', macroF1: 0.6727, maliciousRecall: 0.8519, adopted: true },
  { model: 'KoELECTRA(전용 감정모델)', params: '0.11B', macroF1: 0.4516, maliciousRecall: 0.5185, adopted: false },
];

export const GRADE_MODEL_NOTE =
  'Macro-F1은 Gemma가 0.05 앞서지만, 최우선 지표인 악성 Recall은 EXAONE이 더 높고 ' +
  '처리 시간이 약 2배 빠르며 온디바이스(국산) 모델이라는 점이 기관 요구(보안·데이터 미유출)와 맞아 EXAONE 3.5 7.8B를 채택했다.';

export interface ClassifierMetric {
  key: string;
  label: string;
  macroF1: string;
  note: string;
}

/** 최종 판정 파이프라인 지표. macroF1은 범위로 표기 — 단일 seed 값이 아니라 여러 조건에서 나온 값이라
 * 소수점 하나로 뭉개면 오히려 정밀도를 과장하게 된다. */
export const PIPELINE_METRICS: ClassifierMetric[] = [
  {
    key: 'grade',
    label: '상담등급 판정 (악성/칭찬/일반)',
    macroF1: '0.7559',
    note: '악성콜 Recall 0.9630(26/27건). 칭찬콜은 25건 중 7~9건만 검출 — 감정 점수만으로는 한계, 통화 끝 "감사합니다"가 칭찬·일반 양쪽에 다 나와서다.',
  },
  {
    key: 'category',
    label: '상담분류 중분류(F2, 6종)',
    macroF1: '0.50',
    note: '학습 데이터 80~146건 규모. 3-tier 임계값(90/60) 보정은 골든셋 기반 별도 과제로 남아있다.',
  },
  {
    key: 'subcategory',
    label: '상담분류 소분류(F2, 29종)',
    macroF1: '0.31~0.39',
    note: '중분류로 후보를 좁히는 마스킹 적용, seed 3회 평균 0.3736±0.0559. 마스킹 덕분에 계층 위반(잘못된 소분류)은 구조적으로 나올 수 없다.',
  },
];
