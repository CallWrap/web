// ─────────────────────────────────────────────────────────────
// 실제 Spring REST 호출 레이어. 함수 시그니처는 이전 mock 레이어와 최대한 동일하게 유지해서
// 스토어/페이지 쪽 변경을 최소화했다.
// ─────────────────────────────────────────────────────────────

import { apiFetch } from './http';
import type {
  BackendAudioUploadUrlResponse,
  BackendFollowupNote,
  BackendFaqBatchResult,
  BackendFaqEntry,
  BackendFaqRevision,
  BackendFaqSimilar,
  BackendCustomerCallList,
  BackendCustomerDetail,
  BackendCustomerList,
  BackendCounselorCallList,
  BackendCounselorDetail,
  BackendCounselorSummary,
  BackendReviewCreateResponse,
  BackendReviewDetail,
  BackendReviewListResponse,
  BackendReviewStats,
} from './backendTypes';
import { toCall, toCallFromSummary } from './adapt';
import type { Call, FieldKey, SaveCallPayload } from './types';

async function getAllPages<T>(urlForPage: (page: number, size: number) => string): Promise<T[]> {
  const pageSize = 500;
  const items: T[] = [];
  let page = 0;
  let totalCount = 0;
  do {
    const response = await apiFetch<{ items: T[]; totalCount: number }>(urlForPage(page, pageSize));
    items.push(...response.items);
    totalCount = response.totalCount;
    if (response.items.length === 0) break;
    page += 1;
  } while (items.length < totalCount);
  return items;
}

/**
 * 대기열 조회. 목록 API가 상태/시각만 주므로 fields/grade/transcript는 placeholder다
 * (Call.isSummary === true). 실제 값이 필요한 화면(검토 화면)은 getCall로 상세를 따로 받는다.
 */
export async function getQueue(range?: { from: string; to: string }): Promise<Call[]> {
  // 기간을 서버에 넘긴다 — 클라이언트에서만 거르면 size=100 밖의 과거 콜이 조회돼도 안 나온다.
  const qs = new URLSearchParams({ page: '0', size: '100' });
  if (range) {
    qs.set('from', range.from);
    qs.set('to', range.to);
  }
  const res = await apiFetch<BackendReviewListResponse>(`/api/reviews?${qs}`);
  return res.items.map(toCallFromSummary);
}

export async function getAdminQueue(range?: { from: string; to: string }): Promise<Call[]> {
  const summaries = await getAllPages<BackendReviewListResponse['items'][number]>((page, size) => {
    const qs = new URLSearchParams({ all: 'true', page: String(page), size: String(size) });
    if (range) {
      qs.set('from', range.from);
      qs.set('to', range.to);
    }
    return `/api/reviews?${qs}`;
  });
  return summaries.map(toCallFromSummary);
}

/**
 * 관리자 대시보드 개요용 집계. getQueue()는 최근 100건까지만 주는 목록이라 그걸로 세면
 * 100건이 넘는 순간부터 통계가 틀어진다 — 이건 DB에서 전체를 대상으로 집계해서 온다.
 */
export async function getReviewStats(): Promise<BackendReviewStats> {
  return apiFetch<BackendReviewStats>('/api/reviews/stats');
}

/** 단일 콜 상세 조회 — 전사·필드 전체는 여기서만 받아온다. */
export async function getCall(id: string): Promise<Call | undefined> {
  try {
    const detail = await apiFetch<BackendReviewDetail>(`/api/reviews/${id}`);
    return toCall(detail);
  } catch {
    return undefined;
  }
}

/**
 * 검토 확정. reviewSec은 ReviewConfirmRequest가 필드를 받기 전까지는 백엔드가 그냥
 * 무시한다(FAIL_ON_UNKNOWN_PROPERTIES=false라 에러는 안 남) — 백엔드 마이그레이션 적용되면
 * 바로 저장되기 시작한다.
 * 확정 응답엔 갱신된 필드 전체가 안 실려오므로, 확정 직후 상세를 다시 조회해 최신 상태로 맞춘다.
 */
export async function saveCall(id: string, payload: SaveCallPayload): Promise<Call> {
  const confirmedFields: Record<string, unknown> = {};
  (Object.keys(payload.fields) as FieldKey[]).forEach((key) => {
    confirmedFields[key] = payload.fields[key].value;
  });

  await apiFetch(`/api/reviews/${id}/confirm`, {
    method: 'PATCH',
    body: { confirmedFields, editedFields: payload.editedFields, reviewSec: payload.reviewSec },
  });

  const detail = await apiFetch<BackendReviewDetail>(`/api/reviews/${id}`);
  return toCall(detail);
}

/**
 * 후속 처리 이력 작성. 작성만 하고 쌓는 로그라 수정·삭제 API는 없다.
 * 상담사 제한이 없어 다른 상담사가 받은 콜에도 이어서 쓸 수 있다.
 */
export async function addFollowupNote(callId: string, content: string): Promise<BackendFollowupNote> {
  return apiFetch<BackendFollowupNote>(`/api/reviews/${callId}/followup-notes`, {
    method: 'POST',
    body: { content },
  });
}

/** 오디오 업로드용 presigned URL 발급 */
export async function issueAudioUploadUrl(fileExtension?: string): Promise<BackendAudioUploadUrlResponse> {
  return apiFetch<BackendAudioUploadUrlResponse>('/api/audio/upload-url', {
    method: 'POST',
    body: fileExtension ? { fileExtension } : undefined,
  });
}

/** 검토(콜) 생성 — 사보원/중앙 시스템 연동용. web 화면에서 직접 쓰진 않지만 데모/시뮬레이션에 필요. */
export async function createReview(params: {
  sourceRequestId: string;
  counselorId: string;
  audioFileUrl: string;
}): Promise<BackendReviewCreateResponse> {
  return apiFetch<BackendReviewCreateResponse>('/api/reviews', {
    method: 'POST',
    body: params,
  });
}

/**
 * FAQ 검수. Spring이 FastAPI(EXAONE 배치 생성)를 대신 호출해주는 프록시라 web은 Spring만 알면 된다.
 * generate-batch는 여러 소분류를 순회하며 Ollama를 호출해서 오래 걸릴 수 있다 — 호출부에서 로딩 처리 필수.
 */
export async function triggerFaqBatch(): Promise<BackendFaqBatchResult> {
  return apiFetch<BackendFaqBatchResult>('/api/faq-entries/generate-batch', { method: 'POST' });
}

export async function getFaqEntries(status?: 'DRAFT' | 'PUBLISHED' | 'DISCARDED'): Promise<BackendFaqEntry[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<BackendFaqEntry[]>(`/api/faq-entries${qs}`);
}

export async function updateFaqEntry(id: string, question: string, answer: string): Promise<BackendFaqEntry> {
  return apiFetch<BackendFaqEntry>(`/api/faq-entries/${id}`, {
    method: 'PATCH',
    body: { question, answer },
  });
}

export async function publishFaqEntry(id: string): Promise<BackendFaqEntry> {
  return apiFetch<BackendFaqEntry>(`/api/faq-entries/${id}/publish`, { method: 'POST' });
}

export async function discardFaqEntry(id: string): Promise<BackendFaqEntry> {
  return apiFetch<BackendFaqEntry>(`/api/faq-entries/${id}/discard`, { method: 'POST' });
}

export async function getFaqSimilar(id: string): Promise<BackendFaqSimilar[]> {
  return apiFetch<BackendFaqSimilar[]>(`/api/faq-entries/${id}/similar`);
}

export async function mergeFaqEntry(draftId: string, targetId: string): Promise<BackendFaqEntry> {
  return apiFetch<BackendFaqEntry>(`/api/faq-entries/${draftId}/merge-into/${targetId}`, { method: 'POST' });
}

export async function getFaqRevisions(id: string): Promise<BackendFaqRevision[]> {
  return apiFetch<BackendFaqRevision[]>(`/api/faq-entries/${id}/revisions`);
}

export async function getCustomers(query = ''): Promise<BackendCustomerList> {
  const items = await getAllPages<BackendCustomerList['items'][number]>((page, size) => {
    const qs = new URLSearchParams({ query, page: String(page), size: String(size) });
    return `/api/customers?${qs}`;
  });
  return { items, page: 0, size: items.length, totalCount: items.length };
}

export async function getCustomerDetail(id: string): Promise<BackendCustomerDetail> {
  return apiFetch<BackendCustomerDetail>(`/api/customers/${id}`);
}

export async function getCustomerCalls(id: string): Promise<BackendCustomerCallList> {
  const items = await getAllPages<BackendCustomerCallList['items'][number]>(
    (page, size) => `/api/customers/${id}/calls?page=${page}&size=${size}`,
  );
  return { items, page: 0, size: items.length, totalCount: items.length };
}

export async function getCounselors(date: string): Promise<BackendCounselorSummary[]> {
  return apiFetch<BackendCounselorSummary[]>(`/api/counselors?date=${encodeURIComponent(date)}`);
}

export async function getCounselorDetail(id: string, date: string): Promise<BackendCounselorDetail> {
  return apiFetch<BackendCounselorDetail>(`/api/counselors/${id}?date=${encodeURIComponent(date)}`);
}

export async function getCounselorCalls(id: string, date: string): Promise<BackendCounselorCallList> {
  const items = await getAllPages<BackendCounselorCallList['items'][number]>(
    (page, size) => `/api/counselors/${id}/calls?date=${encodeURIComponent(date)}&page=${page}&size=${size}`,
  );
  return { items, page: 0, size: items.length, totalCount: items.length };
}
