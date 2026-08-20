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
  SummaryValue,
  CallGrade,
  CallStatus,
  FormFieldData,
  SpeakerRole,
  Utterance,
} from './types';

const EMPTY_STRING_FIELD: FormFieldData<string> = { value: '', confidence: 0, tier: 'low', evidence: [] };
const EMPTY_BOOL_FIELD: FormFieldData<boolean> = { value: false, confidence: 0, tier: 'low', evidence: [] };
const EMPTY_SUMMARY: SummaryValue = { title: '', inquiry: '', resolution: '' };
const EMPTY_SUMMARY_FIELD: FormFieldData<SummaryValue> = {
  value: EMPTY_SUMMARY, confidence: 0, tier: 'low', evidence: [],
};

const EMPTY_FIELDS: CallFields = {
  type: EMPTY_STRING_FIELD,
  category: EMPTY_STRING_FIELD,
  subcategory: EMPTY_STRING_FIELD,
  grade: EMPTY_STRING_FIELD,
  summary: EMPTY_SUMMARY_FIELD,
  followup: EMPTY_BOOL_FIELD,
  faq: EMPTY_BOOL_FIELD,
};

/** confidence → tier 파생 (백엔드가 tier를 안 줄 때의 프론트 fallback) */
export function deriveTier(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

// AdminPage가 /api/reviews/stats의 gradeCounts(한글 라벨) 키를 web CallGrade로 옮길 때도 쓴다.
export const GRADE_MAP: Record<string, CallGrade> = {
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

/**
 * 요약 Judgment → 폼 필드. **합치지 않는다.**
 * 예전엔 title/inquiry/resolution을 한 덩어리 텍스트로 합쳐 textarea 하나에 태웠는데,
 * 상담사가 확정하면 그 문자열이 백엔드 JSONB의 구조를 통째로 덮어썼다 —
 * 그 순간 대기열 제목(summary.value.title)이 사라지고 FAQ 후보 조회
 * (summary->'value'->>'inquiry')도 null이 됐다. 구조를 그대로 들고 다닌다.
 *
 * 확정 이전 데이터 중에는 이미 평문으로 뭉개진 값이 있어서(문자열 케이스) 그것도 읽을 수는 있게 둔다.
 */
function judgmentToSummaryField(
  judgment: BackendJudgment<unknown> | null | undefined,
): FormFieldData<SummaryValue> {
  if (!judgment) {
    return EMPTY_SUMMARY_FIELD;
  }
  const raw = judgment.value as Partial<SummaryValue> | string | null;
  const value: SummaryValue =
    typeof raw === 'string'
      ? { ...EMPTY_SUMMARY, inquiry: raw } // 구버전 확정 데이터 — 최소한 내용은 보여준다
      : {
          title: raw?.title ?? '',
          inquiry: raw?.inquiry ?? '',
          resolution: raw?.resolution ?? '',
        };
  return {
    value,
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
 * 목록 API 항목 → Call. 등급/후속필요/신뢰도 집계/통화시작시각은 이제 실값이지만,
 * type/category/summary 등 필드 전체와 전사는 여전히 상세 조회에서만 받는다(isSummary: true).
 */
export function toCallFromSummary(item: BackendReviewSummary): Call {
  const needsFollowup = Boolean(item.needsFollowup?.value);
  return {
    callId: item.reviewId,
    callNo: item.callNo ?? null,
    title: item.title ?? null,
    startedAt: item.callStartedAt ?? null,
    durationSec: null, // TODO(백엔드 갭): 목록 API엔 call_duration_sec이 없음 — 상세에서만 나옴
    status: mapCallStatus(item.status, needsFollowup),
    grade: mapGrade(item.grade),
    transcript: [],
    fields: EMPTY_FIELDS,
    isSummary: true,
    confidenceSummary: { high: item.highConfidenceFieldCount, total: item.totalFieldCount },
    failures: [], // 목록 API엔 안 옴 — 상세 조회에서만 채워짐
  };
}

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
    subcategory: judgmentToStringField(detail.classification?.subcategory),
    grade: judgmentToStringField(detail.classification?.grade),
    summary: judgmentToSummaryField(detail.summary),
    followup: judgmentToBoolField(detail.needsFollowup),
    faq: judgmentToBoolField(detail.needsFaq),
  };

  return {
    callId: detail.reviewId,
    callNo: detail.callNo ?? null,
    title: (detail.summary?.value as { title?: string } | null | undefined)?.title ?? null,
    startedAt: detail.callStartedAt,
    durationSec: detail.callDurationSec,
    status: mapCallStatus(detail.status, needsFollowup),
    grade: mapGrade(detail.classification?.grade),
    transcript: (detail.transcript ?? []).map(toUtterance),
    fields,
    failures: detail.failures ?? [],
    confirmedAt: detail.confirmedAt,
    followupActions: needsFollowup ? defaultFollowupActions(detail.reviewId) : undefined,
  };
}
