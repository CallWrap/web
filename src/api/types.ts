// ─────────────────────────────────────────────────────────────
// web 내부에서 쓰는 UI 타입. 실제 백엔드 응답(backendTypes.ts)과는
// adapt.ts가 변환해서 이어준다 — 이 파일 자체는 더 이상 "백엔드 응답 스키마"가 아니다.
// ─────────────────────────────────────────────────────────────

/** 콜 처리 상태 머신. failed는 Spring CallStatus.FAILED에 대응 (mock 단계엔 없던 상태). */
export type CallStatus =
  | 'transcribing'
  | 'quality_check'
  | 'analyzing'
  | 'review'
  | 'confirmed'
  | 'followup'
  | 'failed';

/** 상담 등급 (감정노동/악성콜 분류) */
export type CallGrade = 'normal' | 'praise' | 'malicious';

/** AI 신뢰도 tier. confidence에서 프론트가 파생시킨다 (deriveTier). */
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
  type: FormFieldData<string>; // 상담유형 (SR모델 미통합 — 항상 ETC 자리표시자, PR 후 갱신 예정)
  category: FormFieldData<string>; // 상담분류(중분류)
  subcategory: FormFieldData<string>; // 상담분류(소분류, 29종 — 보조 출력)
  grade: FormFieldData<string>; // 상담등급
  summary: FormFieldData<string>; // 문의·처리내용 요약 (title/inquiry/resolution을 합쳐 표시)
  followup: FormFieldData<boolean>; // 후속처리 필요 여부
  faq: FormFieldData<boolean>; // FAQ/지식베이스 반영 필요 여부
}

export type FieldKey = keyof CallFields;

/**
 * 콜 1건. Spring의 목록 API(GET /api/reviews)는 상태·시각만 주고 전사·필드·등급은 안 준다
 * (대용량 JSONB를 목록에서 안 실어보내려는 설계) — 그래서 목록 화면에서 만든 Call은
 * fields/grade/transcript가 전부 placeholder다. 실제 값은 상세 조회(getCall)에서만 채워진다.
 * isSummary로 "이 객체가 placeholder인지"를 구분한다.
 */
export interface Call {
  callId: string;
  /** AI 요약 제목. 대기열에서 콜을 구분하는 사람이 읽는 식별자 — 분석 전이면 null */
  title?: string | null;
  startedAt: string | null; // 백엔드가 아직 call_started_at을 안 줌 — null 가능
  durationSec: number | null; // 백엔드가 아직 안 줌 — null 가능
  status: CallStatus;
  grade: CallGrade;
  transcript: Utterance[]; // 백엔드 계약에 전사 필드가 아직 없어 항상 빈 배열
  fields: CallFields;
  confirmedAt?: string | null;
  editCount?: number; // 상담사 수정 건수 (재학습 데이터 축적 지표) — editedFields.length로 파생
  reviewSec?: number; // 검토 소요 시간(초) — 프론트에서만 재고, 백엔드에 저장 안 됨
  followupActions?: FollowupAction[];
  /** true면 목록 API에서 온 placeholder — fields/transcript는 여전히 비어있음 (grade/후속필요는 이제 실값) */
  isSummary?: boolean;
  /** 목록에서 온 AI 확신 집계 (fields 전체 없이도 "N/M 항목 확신" 표시용) */
  confidenceSummary?: { high: number; total: number };
  /**
   * 백엔드가 실패로 보고한 AI 모듈명 목록 (예: "summarize", "needs_followup").
   * "확신도가 낮음"과 "이 항목 자체가 아직 미구현"은 다른 상황이라 구분해서 보여준다.
   * 목록 API에선 안 옴 — 상세 조회에서만 채워짐.
   */
  failures: string[];
}

export interface FollowupAction {
  id: string;
  label: string;
  done: boolean;
}

/** saveCall 페이로드 */
export interface SaveCallPayload {
  fields: CallFields;
  editedFields: FieldKey[];
  reviewSec: number;
  followupNeeded: boolean;
}
