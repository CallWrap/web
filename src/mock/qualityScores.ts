// 목업 — 실제 파이프라인(ai/, api/)이 아직 더미 반환만 하므로(quality_gate.yaml 참고),
// 상담품질 자동평가 결과는 사보원 「상담품질 평가기술서」 배점 체계(4대분류 100점·11소분류)에
// 맞춰 현실적으로 지어낸 자리채움 데이터다. 실제 채점 로직이 붙으면 이 파일만 교체한다.

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

export interface CallQualityScore {
  callId: string;
  scores: Record<string, number>;
  /** 최저 항목에 대한 판정 근거 문장 — 이의신청 처리에 그대로 쓸 수 있어야 한다 */
  reason: string;
}

export const CALL_QUALITY_SCORES: CallQualityScore[] = [
  {
    callId: 'CALL2801',
    scores: { greetOpen: 0, greetClose: 1, empathy: 0, problemSolve: 2, phrasing: 0, explain: 11, grasp: 11, language: 8, tone: 9, pace: 9, listening: 9 },
    reason: '민원인이 "몇 번을 물어봐야 하냐"며 반복 항의했으나 상담사는 "확인해드리겠습니다"만 반복하고 공감 표현이나 사과 없이 사무적으로 응대함. 첫인사 생략.',
  },
  {
    callId: 'CALL2803',
    scores: { greetOpen: 2, greetClose: 1, empathy: 1, problemSolve: 4, phrasing: 2, explain: 12, grasp: 12, language: 8, tone: 9, pace: 10, listening: 9 },
    reason: '민원인이 신청 지연에 불편을 표했으나 상담사는 처리 절차만 안내하고 감정에 대한 공감 표현 없이 다음 안내로 넘어감. 끝인사 없이 통화 종료.',
  },
  {
    callId: 'CALL2805',
    scores: { greetOpen: 3, greetClose: 3, empathy: 2, problemSolve: 6, phrasing: 3, explain: 12, grasp: 13, language: 9, tone: 10, pace: 9, listening: 10 },
    reason: '두 가지 문의 중 방문 상담 연계 여부에 대한 답만 하고 서류 목록 재확인 요청에는 "확인해드리겠습니다"로만 응대해 구체적 안내가 누락됨.',
  },
  {
    callId: 'CALL2807',
    scores: { greetOpen: 1, greetClose: 2, empathy: 1, problemSolve: 3, phrasing: 2, explain: 10, grasp: 11, language: 8, tone: 9, pace: 10, listening: 9 },
    reason: '민원인이 "저번에도 한참 걸렸다"고 불만을 표했으나 상담사는 "네", "확인해드리겠습니다" 등 단답형으로 응대해 공감·양해 표현이 없었음.',
  },
  {
    callId: 'CALL2809',
    scores: { greetOpen: 4, greetClose: 3, empathy: 2, problemSolve: 6, phrasing: 3, explain: 13, grasp: 12, language: 9, tone: 9, pace: 10, listening: 10 },
    reason: '복수 문의 중 결제 지연 사유는 안내했으나 "다음엔 언제까지 하면 되는지"에 대한 구체적 기한 안내가 누락됨.',
  },
  {
    callId: 'CALL2811',
    scores: { greetOpen: 2, greetClose: 2, empathy: 1, problemSolve: 4, phrasing: 2, explain: 11, grasp: 12, language: 9, tone: 10, pace: 10, listening: 10 },
    reason: '고객의 문의에 대해 "네, 고객님 확인해드리겠습니다" 등 단답형 호응으로 사무적으로 응대했고, 재요청에도 동일한 양해 표현만 반복함.',
  },
  {
    callId: 'CALL2813',
    scores: { greetOpen: 3, greetClose: 3, empathy: 3, problemSolve: 7, phrasing: 3, explain: 13, grasp: 13, language: 9, tone: 10, pace: 10, listening: 10 },
    reason: '안내는 대체로 충실했으나 민원인이 제기한 두 건의 문의 중 신고의무자 자격 관련 안내만 하고 시스템 처리 메뉴·절차 안내는 제공하지 않은 채 통화를 종료함.',
  },
  {
    callId: 'CALL2815',
    scores: { greetOpen: 4, greetClose: 3, empathy: 3, problemSolve: 7, phrasing: 4, explain: 13, grasp: 13, language: 9, tone: 10, pace: 10, listening: 10 },
    reason: '전반적으로 양호하나 민원인이 제기한 두 가지 질문 중 급여 대상 여부만 답변하고 시스템 어느 메뉴에서 처리하는지에 대한 안내가 빠짐.',
  },
  {
    callId: 'CALL2817',
    scores: { greetOpen: 4, greetClose: 3, empathy: 3, problemSolve: 8, phrasing: 4, explain: 14, grasp: 13, language: 9, tone: 10, pace: 10, listening: 10 },
    reason: '질병 관련 근무 가능 여부는 안내했으나 민원인이 "그럼 언제쯤 하면 되냐"고 물은 기한 질문에 답하지 않은 채 다음 문의로 넘어감.',
  },
  {
    callId: 'CALL2819',
    scores: { greetOpen: 4, greetClose: 4, empathy: 3, problemSolve: 8, phrasing: 4, explain: 14, grasp: 14, language: 9, tone: 10, pace: 9, listening: 10 },
    reason: '최중증 수급자 정의는 안내했으나 민원인이 먼저 요청한 지난달 등록 내역 조회 결과와 "다른 방법은 없냐"는 추가 질의에는 답하지 않음.',
  },
  {
    callId: 'CALL2821',
    scores: { greetOpen: 4, greetClose: 4, empathy: 3, problemSolve: 8, phrasing: 4, explain: 14, grasp: 14, language: 10, tone: 10, pace: 10, listening: 10 },
    reason: '전반적으로 양호. 가족 활동지원급여 제공 사유는 안내했으나 민원인이 먼저 요청한 "어느 메뉴에서 하는지"에 대한 안내가 다소 늦게 제공됨.',
  },
  {
    callId: 'CALL2823',
    scores: { greetOpen: 5, greetClose: 4, empathy: 4, problemSolve: 9, phrasing: 4, explain: 14, grasp: 14, language: 10, tone: 10, pace: 10, listening: 10 },
    reason: '등록 자료 오류 정정을 요청한 민원인에게 방법 안내와 공감 표현을 함께 제공했으나 끝인사에서 안내 문구 없이 사무적으로 통화를 종료함.',
  },
];

export function callQualityTotal(s: CallQualityScore): number {
  return Object.values(s.scores).reduce((sum, v) => sum + v, 0);
}

export function worstSubcategory(s: CallQualityScore): { key: string; pct: number } {
  let worstKey = SUBCATEGORY_ORDER[0];
  let worstPct = Infinity;
  SUBCATEGORY_ORDER.forEach((k) => {
    const max = QUALITY_SUBCATEGORIES[k].max;
    const pct = (s.scores[k] ?? 0) / max;
    if (pct < worstPct) {
      worstPct = pct;
      worstKey = k;
    }
  });
  return { key: worstKey, pct: worstPct };
}
