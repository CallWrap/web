// ─────────────────────────────────────────────────────────────
// 실제 Spring REST 호출 레이어. 함수 시그니처는 이전 mock 레이어와 최대한 동일하게 유지해서
// 스토어/페이지 쪽 변경을 최소화했다.
// ─────────────────────────────────────────────────────────────

import { apiFetch } from './http';
import type {
  BackendAudioUploadUrlResponse,
  BackendFaqBatchResult,
  BackendFaqEntry,
  BackendReviewCreateResponse,
  BackendReviewDetail,
  BackendReviewListResponse,
  BackendReviewStats,
} from './backendTypes';
import { toCall, toCallFromSummary } from './adapt';
import type { Call, FieldKey, SaveCallPayload } from './types';

/**
 * 대기열 조회. 목록 API가 상태/시각만 주므로 fields/grade/transcript는 placeholder다
 * (Call.isSummary === true). 실제 값이 필요한 화면(검토 화면)은 getCall로 상세를 따로 받는다.
 */
export async function getQueue(): Promise<Call[]> {
  const res = await apiFetch<BackendReviewListResponse>('/api/reviews?page=0&size=100');
  return res.items.map(toCallFromSummary);
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
