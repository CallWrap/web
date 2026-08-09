// ─────────────────────────────────────────────────────────────
// 실제 Spring REST 호출 레이어. 함수 시그니처는 이전 mock 레이어와 최대한 동일하게 유지해서
// 스토어/페이지 쪽 변경을 최소화했다.
// ─────────────────────────────────────────────────────────────

import { apiFetch } from './http';
import type {
  BackendAudioUploadUrlResponse,
  BackendReviewCreateResponse,
  BackendReviewDetail,
  BackendReviewListResponse,
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
 * 검토 확정. 백엔드 ReviewConfirmRequest는 { confirmedFields, editedFields }만 받는다
 * (reviewSec은 백엔드에 저장 컬럼이 없어 아직 전송하지 않는다 — 갭 목록 참고).
 * 확정 응답엔 갱신된 필드 전체가 안 실려오므로, 확정 직후 상세를 다시 조회해 최신 상태로 맞춘다.
 */
export async function saveCall(id: string, payload: SaveCallPayload): Promise<Call> {
  const confirmedFields: Record<string, unknown> = {};
  (Object.keys(payload.fields) as FieldKey[]).forEach((key) => {
    confirmedFields[key] = payload.fields[key].value;
  });

  await apiFetch(`/api/reviews/${id}/confirm`, {
    method: 'PATCH',
    body: { confirmedFields, editedFields: payload.editedFields },
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
