// ─────────────────────────────────────────────────────────────
// API 계약 (Contract)
// 이 파일의 타입 = 백엔드 응답 스키마. 실제 API 전환 시에도 이 형태를 유지한다.
// ─────────────────────────────────────────────────────────────

/** 콜 처리 상태 머신 */
export type CallStatus =
  | 'transcribing'
  | 'quality_check'
  | 'analyzing'
  | 'review'
  | 'confirmed'
  | 'followup';

/** 상담 등급 (감정노동/악성콜 분류) */
export type CallGrade = 'normal' | 'praise' | 'malicious';

/** AI 신뢰도 tier. confidence에서 계산 가능하나 캘리브레이션은 백엔드 책임이므로 응답에 포함. */
export type Tier = 'high' | 'medium' | 'low';

export type SpeakerRole = 'client' | 'agent';

/** 화자 분리된 단일 발화 */
export interface Utterance {
  id: string;
  speaker: SpeakerRole;
  ts: number; // 통화 시작 기준 초
  text: string;
}

/** AI가 채운 후처리 폼의 단일 항목 */
export interface FormFieldData<T = string | boolean> {
  value: T;
  confidence: number; // 0~1
  tier: Tier;
  evidence: string[]; // 근거가 되는 Utterance id 배열
}

/** 후처리 폼 전체 */
export interface CallFields {
  type: FormFieldData<string>; // 상담유형
  category: FormFieldData<string>; // 상담분류
  grade: FormFieldData<string>; // 상담등급
  summary: FormFieldData<string>; // 문의·처리내용 요약
  followup: FormFieldData<boolean>; // 후속처리 필요 여부
}

export type FieldKey = keyof CallFields;

/** 콜 1건 (= /calls/:id 응답) */
export interface Call {
  callId: string;
  startedAt: string; // ISO
  durationSec: number;
  status: CallStatus;
  grade: CallGrade;
  transcript: Utterance[];
  fields: CallFields;
  editCount?: number; // 상담사 수정 건수 (재학습 데이터 축적 지표)
  reviewSec?: number; // 검토 소요 시간(초)
  followupActions?: FollowupAction[];
}

export interface FollowupAction {
  id: string;
  label: string;
  done: boolean;
}

/** saveCall 페이로드 */
export interface SaveCallPayload {
  fields: CallFields;
  editCount: number;
  reviewSec: number;
  followupNeeded: boolean;
}
