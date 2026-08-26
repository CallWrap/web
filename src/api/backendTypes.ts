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
  createdAt: string;
  updatedAt: string;
  /** 확정 시각. 검토 전이면 null(non_null 직렬화라 응답에서 아예 빠질 수도 있음) */
  confirmedAt?: string | null;
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
  status: 'DRAFT' | 'PUBLISHED' | 'DISCARDED';
  generatedAt: string;
  publishedAt: string | null;
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
export interface BackendReviewStats {
  totalCalls: number;
  statusCounts: Record<string, number>;
  gradeCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  avgReviewSec: number | null;
  hourlyThroughput: Record<string, number>;
  maliciousByCounselor: Record<string, number>;
}

export interface BackendErrorResponse {
  code: string;
  message: string;
  details?: Record<string, string>;
}
