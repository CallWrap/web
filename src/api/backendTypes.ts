// ─────────────────────────────────────────────────────────────
// Spring REST 응답 원본 shape (와이어 포맷 그대로, 가공 없음).
// UI가 쓰는 형태는 ./types.ts + ./adapt.ts에서 변환해서 만든다.
// 필드가 실제 Spring DTO와 어긋나면 여기부터 고친다.
// ─────────────────────────────────────────────────────────────

export interface BackendJudgment<T> {
  value: T;
  confidence: number | null;
  evidenceIndices: number[];
}

export type BackendSpeaker = '상담사' | '고객';

export interface BackendUtterance {
  index: number;
  speaker: BackendSpeaker;
  text: string;
  start: number;
  end: number;
}

export interface BackendUtteranceSentiment {
  utteranceIndex: number;
  speaker: BackendSpeaker;
  score: number;
}

/**
 * GET /api/reviews 의 items[] 원소. 전사·필드 전체(type/category/summary 등)는 여전히 안 준다
 * (상세 전용) — 등급/후속필요/신뢰도 집계/통화시작시각까지는 목록에서 받는다.
 */
export interface BackendReviewSummary {
  reviewId: string;
  /** 접수 순번. 상담사가 콜을 부르는 번호(화면엔 001처럼 3자리) */
  callNo: number;
  /** 요약 제목. 분석 전이거나 요약이 실패하면 응답에서 아예 빠진다(non_null 직렬화) */
  title?: string | null;
  status: string;
  retryCount: number;
  grade: BackendJudgment<unknown> | null;
  needsFollowup: BackendJudgment<unknown> | null;
  highConfidenceFieldCount: number;
  totalFieldCount: number;
  callStartedAt: string | null;
  /** 통화 길이(초). 백엔드 6-1로 목록에도 추가됨 */
  callDurationSec?: number | null;
  createdAt: string;
  updatedAt: string;
  /** 확정 시각. 검토 전이면 null(non_null 직렬화라 응답에서 아예 빠질 수도 있음) */
  confirmedAt?: string | null;
  complainant?: BackendComplainant | null;
  counselor?: { id: string; name: string } | null;
  classification?: {
    type: BackendJudgment<unknown> | null;
    category: BackendJudgment<unknown> | null;
    subcategory: BackendJudgment<unknown> | null;
  } | null;
  reviewSec?: number | null;
}

/** 민원인 정보. 백엔드가 아직 안 내려주면 필드 자체가 없다. */
export interface BackendComplainant {
  name?: string | null;
  phone?: string | null;
  org?: string | null;
  /** 상세 조회에서만 옴. 키는 stats의 gradeCounts와 같은 한글 라벨. */
  gradeCounts?: Record<string, number> | null;
}

/** POST /api/reviews/{id}/followup-notes 응답 · 상세의 followupNotes[] 원소 */
export interface BackendFollowupNote {
  id: string;
  content: string;
  counselorName: string;
  createdAt: string;
}

export interface BackendReviewListResponse {
  items: BackendReviewSummary[];
  page: number;
  size: number;
  totalCount: number;
}

/** GET /api/reviews/{id} */
export interface BackendReviewDetail {
  reviewId: string;
  callNo: number;
  status: string;
  callStartedAt: string | null;
  callDurationSec: number | null;
  createdAt: string;
  classification: {
    type: BackendJudgment<unknown> | null;
    category: BackendJudgment<unknown> | null;
    subcategory: BackendJudgment<unknown> | null;
    grade: BackendJudgment<unknown> | null;
  };
  summary: BackendJudgment<unknown> | null;
  needsFollowup: BackendJudgment<unknown> | null;
  needsFaq: BackendJudgment<unknown> | null;
  /** 짧게 살아있는 프리사인 GET URL. audioPath가 없거나 형식이 이상하면 null (재생 불가). */
  audioUrl: string | null;
  transcript: BackendUtterance[];
  utteranceSentiments: BackendUtteranceSentiment[];
  failures: string[];
  confirmedAt: string | null;
  confirmedByCounselorId: string | null;
  complainant?: BackendComplainant | null;
  followupNotes?: BackendFollowupNote[];
}

export interface BackendReviewCreateResponse {
  reviewId: string;
  status: string;
  createdAt: string;
}

export interface BackendReviewConfirmResponse {
  reviewId: string;
  status: string;
  confirmedAt: string;
  confirmedByCounselorId: string;
}

export interface BackendLoginResponse {
  accessToken: string;
  expiresIn: number;
}

export interface BackendTokenRefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface BackendCounselorMe {
  counselorId: string;
  name: string;
  loginId: string;
  role: 'COUNSELOR' | 'ADMIN';
}

export interface BackendAudioUploadUrlResponse {
  uploadUrl: string;
  audioUri: string;
}

/** GET/POST /api/faq-entries* — EXAONE이 needs_faq 콜들을 소분류별로 합성한 FAQ 후보. */
export interface BackendFaqEntry {
  id: string;
  subcategory: string;
  question: string;
  answer: string;
  sourceCallCount: number;
  sampleCallIds: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'DISCARDED' | 'MERGED';
  generatedAt: string;
  publishedAt: string | null;
  updatedAt: string;
  mergedIntoId?: string | null;
}

export interface BackendFaqSimilar {
  id: string;
  question: string;
  subcategory: string;
  status: 'DRAFT' | 'PUBLISHED';
  updatedAt: string;
  similarity: number;
}

export interface BackendFaqRevision {
  id: string;
  question: string;
  answer: string;
  revisedByCounselorId: string;
  revisedAt: string;
}

export interface BackendCustomerSummary {
  id: string;
  name: string | null;
  phone: string | null;
  org: string | null;
  totalCalls: number;
  maliciousCalls: number;
  lastCalledAt: string | null;
}

export interface BackendCustomerList {
  items: BackendCustomerSummary[];
  page: number;
  size: number;
  totalCount: number;
}

export interface BackendCustomerDetail {
  id: string;
  name: string | null;
  phone: string | null;
  org: string | null;
  firstCalledAt: string | null;
  gradeCounts: { malicious: number; normal: number; praise: number };
  monthlyCounts: { month: string; total: number; malicious: number; praise: number }[];
  topSubcategories: { label: string; count: number }[];
}

export interface BackendCustomerCall {
  reviewId: string;
  callNo: number;
  calledAt: string;
  counselorName: string;
  grade: string | null;
  summary: string | null;
  callDurationSec: number | null;
  reviewSec: number | null;
}

export interface BackendCustomerCallList {
  items: BackendCustomerCall[];
  page: number;
  size: number;
  totalCount: number;
}

export type BackendCounselorState = '양호' | '주의' | '휴식 권장';

export interface BackendCounselorSummary {
  id: string;
  name: string;
  team: string | null;
  totalCalls: number;
  maliciousCalls: number;
  avgCallSec: number;
  avgReviewSec: number;
  state: BackendCounselorState;
}

export interface BackendCounselorDetail {
  id: string;
  name: string;
  team: string | null;
  totalCalls: number;
  totalCallSec: number;
  gradeCounts: { malicious: number; normal: number; praise: number };
  sentimentTrend: { date: string; negativeScore: number }[];
  state: BackendCounselorState;
  stateReason: string;
}

export interface BackendCounselorCall {
  reviewId: string;
  callNo: number;
  calledAt: string;
  customerName: string | null;
  grade: string | null;
  summary: string | null;
  callDurationSec: number | null;
  reviewSec: number | null;
  negativeScore: number;
}

export interface BackendCounselorCallList {
  items: BackendCounselorCall[];
  page: number;
  size: number;
  totalCount: number;
}

export interface BackendFaqBatchResult {
  groupsProcessed: number;
  entriesCreated: number;
}

/**
 * GET /api/reviews/stats — 관리자 대시보드 개요용 집계. DB에서 GROUP BY/AVG로 계산해서 온다.
 * gradeCounts 키는 Judgment.value 그대로("일반"/"칭찬콜"/"악성콜"/"미판정"), typeCounts는
 * 상담유형 라벨("미분류" 포함) — sr_type.py 모델이 analyze()에 병합되어 실제 분류가 채워진다
 * (2026-08-20 기준). hourlyThroughput은 오늘자 시간대별 처리 건수, maliciousByCounselor는
 * 상담사별 악성콜 건수 — 둘 다 native query GROUP BY 집계.
 */
/** 시간대 하나의 등급별 처리 건수. 개요 탭의 3색 누적 막대(피그마 17)가 이걸 그대로 쌓는다. */
export interface BackendHourlyGrade {
  hour: number;
  normal: number;
  praise: number;
  malicious: number;
}

export interface BackendReviewStats {
  totalCalls: number;
  statusCounts: Record<string, number>;
  /** 확정된 콜을 후속 처리 필요 여부로 나눈 수 — 상단바의 "진행 중"/"완료".
   *  statusCounts.CONFIRMED가 이 둘의 합이다. */
  inProgressCount: number;
  completedCount: number;
  gradeCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  avgReviewSec: number | null;
  /** 오늘자 시간대별 처리 건수를 등급으로 쪼갠 것. 시각 오름차순, 처리가 없던 시간대는 빠져 있다. */
  hourlyThroughput: BackendHourlyGrade[];
  maliciousByCounselor: Record<string, number>;
  /** 판정 5종(유형·분류·등급·요약·후속필요) confidence 평균, 0~1. 판정이 하나도 없으면 null. */
  avgConfidence: number | null;
  /** 위 판정들 중 고신뢰(confidence >= 0.9) 비율, 0~1. 판정이 하나도 없으면 null. */
  highConfidenceRate: number | null;
}

export interface BackendErrorResponse {
  code: string;
  message: string;
  details?: Record<string, string>;
}
