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

/** GET /api/reviews 의 items[] 원소 — 목록은 상태/시각만 준다 (전사·필드 전체는 상세 전용) */
export interface BackendReviewSummary {
  reviewId: string;
  status: string;
  retryCount: number;
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
  classification: {
    type: BackendJudgment<unknown> | null;
    category: BackendJudgment<unknown> | null;
    subcategory: BackendJudgment<unknown> | null;
    grade: BackendJudgment<unknown> | null;
  };
  summary: BackendJudgment<unknown> | null;
  needsFollowup: BackendJudgment<unknown> | null;
  needsFaq: BackendJudgment<unknown> | null;
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

export interface BackendErrorResponse {
  code: string;
  message: string;
  details?: Record<string, string>;
}
