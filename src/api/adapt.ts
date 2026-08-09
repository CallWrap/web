// ─────────────────────────────────────────────────────────────
// 백엔드 응답(backendTypes.ts) → web UI 타입(types.ts) 변환.
// "Spring이 실제로 뭘 주는가"와 "화면이 뭘 원하는가"의 경계를 이 파일 하나로 좁혀둔다 —
// 계약이 바뀌면 여기만 고치면 되게.
// ─────────────────────────────────────────────────────────────

import type {
  BackendJudgment,
  BackendReviewDetail,
  BackendReviewSummary,
  BackendSpeaker,
  BackendUtterance,
} from './backendTypes';
import type {
  Call,
  CallFields,
  CallGrade,
  CallStatus,
  FormFieldData,
  SpeakerRole,
  Utterance,
} from './types';

const EMPTY_STRING_FIELD: FormFieldData<string> = { value: '', confidence: 0, tier: 'low', evidence: [] };
const EMPTY_BOOL_FIELD: FormFieldData<boolean> = { value: false, confidence: 0, tier: 'low', evidence: [] };

const EMPTY_FIELDS: CallFields = {
  type: EMPTY_STRING_FIELD,
  category: EMPTY_STRING_FIELD,
  grade: EMPTY_STRING_FIELD,
  summary: EMPTY_STRING_FIELD,
  followup: EMPTY_BOOL_FIELD,
};

/** confidence → tier 파생 (백엔드가 tier를 안 줄 때의 프론트 fallback) */
export function deriveTier(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

const GRADE_MAP: Record<string, CallGrade> = {
  일반: 'normal',
  칭찬콜: 'praise',
  악성콜: 'malicious',
};

const SPEAKER_MAP: Record<BackendSpeaker, SpeakerRole> = {
  상담사: 'agent',
  고객: 'client',
};

/**
 * Spring CallStatus → web CallStatus.
 * Spring은 UPLOADED/PROCESSING을 구분해서 안 주고(둘 다 파이프라인 진행 중), web의
 * transcribing/quality_check/analyzing 3단계는 지금 하나(analyzing)로 뭉뚱그려진다.
 * CONFIRMED는 needsFollowup 값으로 confirmed/followup을 다시 가른다(Spring엔 별도 상태 없음).
 */
export function mapCallStatus(backendStatus: string, needsFollowup?: boolean): CallStatus {
  switch (backendStatus) {
    case 'UPLOADED':
    case 'PROCESSING':
      return 'analyzing';
    case 'NEEDS_HUMAN_REVIEW':
    case 'DONE':
      return 'review';
    case 'FAILED':
      return 'failed';
    case 'CONFIRMED':
      return needsFollowup ? 'followup' : 'confirmed';
    default:
      return 'analyzing';
  }
}

function mapGrade(judgment: BackendJudgment<unknown> | null | undefined): CallGrade {
  if (!judgment) return 'normal';
  return GRADE_MAP[String(judgment.value)] ?? 'normal';
}

function judgmentToStringField(judgment: BackendJudgment<unknown> | null | undefined): FormFieldData<string> {
  if (!judgment) {
    return { value: '', confidence: 0, tier: 'low', evidence: [] };
  }
  return {
    value: judgment.value == null ? '' : String(judgment.value),
    confidence: judgment.confidence ?? 0,
    tier: deriveTier(judgment.confidence ?? 0),
    evidence: (judgment.evidenceIndices ?? []).map((i) => `u${i}`),
  };
}

function judgmentToBoolField(judgment: BackendJudgment<unknown> | null | undefined): FormFieldData<boolean> {
  if (!judgment) {
    return { value: false, confidence: 0, tier: 'low', evidence: [] };
  }
  return {
    value: Boolean(judgment.value),
    confidence: judgment.confidence ?? 0,
    tier: deriveTier(judgment.confidence ?? 0),
    evidence: (judgment.evidenceIndices ?? []).map((i) => `u${i}`),
  };
}

/** callId 기준 고정 체크리스트. 백엔드에 저장 안 됨 — 새로고침하면 done 상태가 초기화된다. */
export function defaultFollowupActions(callId: string) {
  return [
    { id: `${callId}-f1`, label: '타 기관 자료 연계 결과 확인', done: false },
    { id: `${callId}-f2`, label: '처리 완료 후 민원인에게 문자 안내', done: false },
    { id: `${callId}-f3`, label: '상담 이력 시스템 등록', done: false },
  ];
}

/**
 * 목록 API 항목 → Call placeholder. fields/grade/transcript는 진짜 값이 아니라 빈 값이다
 * (목록 API가 안 주므로) — isSummary: true로 표시해 화면단에서 실수로 신뢰하지 않게 한다.
 */
export function toCallFromSummary(item: BackendReviewSummary): Call {
  return {
    callId: item.reviewId,
    startedAt: null,
    durationSec: null,
    status: mapCallStatus(item.status),
    grade: 'normal', // TODO(백엔드 갭): 목록 API가 등급을 안 줘서 항상 normal로 고정됨
    transcript: [],
    fields: EMPTY_FIELDS,
    isSummary: true,
  };
}

/** 전사가 실제로 내려오기 시작하면 toCall 안에서 (detail.transcript ?? []).map(toUtterance)로 쓴다. */
export function toUtterance(u: BackendUtterance): Utterance {
  return {
    id: `u${u.index}`,
    speaker: SPEAKER_MAP[u.speaker] ?? 'agent',
    ts: u.start,
    text: u.text,
  };
}

export function toCall(detail: BackendReviewDetail): Call {
  const needsFollowup = Boolean(detail.needsFollowup?.value);
  const fields: CallFields = {
    type: judgmentToStringField(detail.classification?.type),
    category: judgmentToStringField(detail.classification?.category),
    grade: judgmentToStringField(detail.classification?.grade),
    summary: judgmentToStringField(detail.summary),
    followup: judgmentToBoolField(detail.needsFollowup),
  };

  return {
    callId: detail.reviewId,
    startedAt: null, // TODO(백엔드 갭): call_started_at 노출되면 채우기
    durationSec: null, // TODO(백엔드 갭): call_duration_sec 노출되면 채우기
    status: mapCallStatus(detail.status, needsFollowup),
    grade: mapGrade(detail.classification?.grade),
    transcript: [], // TODO(백엔드 갭): ResultMessage에 transcript 실리면 매핑 (toUtterance 사용)
    fields,
    confirmedAt: detail.confirmedAt,
    followupActions: needsFollowup ? defaultFollowupActions(detail.reviewId) : undefined,
  };
}
