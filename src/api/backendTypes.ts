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

/**
 * GET /api/reviews 의 items[] 원소. 전사·필드 전체(type/category/summary 등)는 여전히 안 준다
 * (상세 전용) — 등급/후속필요/신뢰도 집계/통화시작시각까지는 목록에서 받는다.
 */
export interface BackendReviewSummary {
  reviewId: string;
  status: string;
  retryCount: number;
  grade: BackendJudgment<unknown> | null;
  needsFollowup: BackendJudgment<unknown> | null;
  highConfidenceFieldCount: number;
  totalFieldCount: number;
  callStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  transcript: BackendUtterance[];
  failures: string[];
  confirmedAt: string | null;
  confirmedByCounselorId: string | null;
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
  status: 'DRAFT' | 'PUBLISHED' | 'DISCARDED';
  generatedAt: string;
  publishedAt: string | null;
}

export interface BackendFaqBatchResult {
  groupsProcessed: number;
  entriesCreated: number;
}

export interface BackendErrorResponse {
  code: string;
  message: string;
  details?: Record<string, string>;
}
