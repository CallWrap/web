// 배점 체계(4대분류 100점·11소분류)는 한국사회보장정보원 「상담품질 평가기술서」 공식 기준을
// 그대로 옮긴 것이다. 통화별 채점 결과는 아직 없다 — 채점 로직이 파이프라인에 연동되기 전까지는
// 지어내지 않는다(AdminPage의 "상담품질 자동평가" 탭은 PendingMetric으로 표시한다).

export type QualityConfidence = 'auto' | 'hybrid';

export interface QualitySubcategory {
  key: string;
  label: string;
  max: number;
  /** auto = 음향·발화 기반 고신뢰 자동채점 · hybrid = AI 1차 채점 + 사람 최종 확인 필요 */
  confidence: QualityConfidence;
}

export interface QualityCategory {
  key: string;
  label: string;
  max: number;
  subKeys: string[];
}

export const QUALITY_CATEGORIES: QualityCategory[] = [
  { key: 'manner', label: '기본예절', max: 10, subKeys: ['greetOpen', 'greetClose'] },
  { key: 'service', label: '고객응대', max: 20, subKeys: ['empathy', 'problemSolve', 'phrasing'] },
  { key: 'expression', label: '표현력', max: 30, subKeys: ['explain', 'grasp'] },
  { key: 'process', label: '업무처리', max: 40, subKeys: ['language', 'tone', 'pace', 'listening'] },
];

export const QUALITY_SUBCATEGORIES: Record<string, QualitySubcategory> = {
  greetOpen:    { key: 'greetOpen',    label: '첫인사',    max: 5,  confidence: 'hybrid' },
  greetClose:   { key: 'greetClose',   label: '끝인사',    max: 5,  confidence: 'hybrid' },
  empathy:      { key: 'empathy',      label: '공감/호응',  max: 5,  confidence: 'hybrid' },
  problemSolve: { key: 'problemSolve', label: '문제해결',  max: 10, confidence: 'hybrid' },
  phrasing:     { key: 'phrasing',     label: '적절한멘트', max: 5,  confidence: 'hybrid' },
  explain:      { key: 'explain',      label: '설명력',    max: 15, confidence: 'hybrid' },
  grasp:        { key: 'grasp',        label: '문의파악',  max: 15, confidence: 'hybrid' },
  language:     { key: 'language',     label: '언어표현',  max: 10, confidence: 'auto' },
  tone:         { key: 'tone',         label: '응대어감',  max: 10, confidence: 'auto' },
  pace:         { key: 'pace',         label: '속도발음',  max: 10, confidence: 'auto' },
  listening:    { key: 'listening',    label: '경청',     max: 10, confidence: 'auto' },
};

export const SUBCATEGORY_ORDER = Object.keys(QUALITY_SUBCATEGORIES);
