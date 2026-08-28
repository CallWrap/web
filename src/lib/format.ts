import type { Call, CallGrade, CallStatus, SummaryValue, Tier } from '../api/types';

/** 백엔드가 아직 안 주는 값. 지어내지 않고 비어 있다는 사실을 그대로 보여준다. */
export const NO_DATA = '정보 없음';

/**
 * 값이 아직 없을 때 보여줄 문구. 절대 '—'나 '(없음)'류의 무의미한 자리표시를 쓰지 않는다 —
 * 최소한 "왜 비어 있는지"가 읽혀야 한다. 새 화면을 추가할 때도 이 상수를 통해서만 빈 값을 표시한다.
 */
export const EMPTY = {
  callNo: '접수 처리 중',
  time: '시각 미기록',
  duration: '검토 진행 중',
  title: '제목 정리 중',
  summary: '요약 정리 중',
  choiceValue: '선택 필요',
  fieldValue: '입력 필요',
  confidence: '판정 없음',
} as const;

export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return EMPTY.duration;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s.toString().padStart(2, '0')}초`;
}

/**
 * 요약을 한 줄 텍스트로. 목록·검색·CSV처럼 "읽기만" 하는 자리에서만 쓴다.
 * 저장 경로에서는 절대 쓰지 않는다 — 구조를 잃으면 백엔드 JSONB가 망가진다.
 */
export function summaryText(s: SummaryValue | null | undefined): string {
  if (!s) return '';
  return [s.title && `[${s.title}]`, s.inquiry && `문의: ${s.inquiry}`, s.resolution && `처리: ${s.resolution}`]
    .filter(Boolean)
    .join('\n');
}

/** 접수 순번 → 화면 표기. 세 자리로 채우고, 1000번을 넘으면 자연스럽게 네 자리가 된다. */
export function fmtCallNo(no: number | null | undefined): string {
  return no == null ? EMPTY.callNo : `#${String(no).padStart(3, '0')}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY.time;
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export const statusLabel: Record<CallStatus, string> = {
  transcribing: '전사 중',
  quality_check: '품질 검사',
  analyzing: '분석 중',
  review: '검토 대기',
  confirmed: '완료',
  followup: '후속 필요',
  failed: '처리 실패',
};

export const gradeLabel: Record<CallGrade, string> = {
  normal: '일반',
  praise: '칭찬콜',
  malicious: '악성콜',
  pending: '판정 대기',
};

export const tierLabel: Record<Tier, string> = {
  high: 'AI 확신',
  medium: '검토 필요',
  low: '직접 판단',
};

export const fieldLabel: Record<string, string> = {
  type: '상담유형(SR)',
  category: '상담분류(중분류)',
  subcategory: '상담분류(소분류)',
  grade: '상담등급',
  summary: '문의·처리내용 요약',
  followup: '후속 처리',
  faq: 'FAQ 반영 필요',
};

/**
 * 화면에 찍는 상담번호 (Figma 표기 `2026-0273`) — 접수 순번에 연도를 붙인다.
 * 상담사 화면 목록·관리자 상담대장·민원인 상담 이력이 모두 이 표기를 쓴다.
 */
export function fmtCallSeq(call: Pick<Call, 'callNo' | 'startedAt' | 'confirmedAt'>): string {
  if (call.callNo == null) return NO_DATA;
  const year = (call.startedAt ?? call.confirmedAt ?? '').slice(0, 4) || `${new Date().getFullYear()}`;
  return `${year}-${`${call.callNo}`.padStart(4, '0')}`;
}

/** `08-27 14:22` 형식. 후속 처리 이력·상담 이력에서 쓴다. */
export function fmtStamp(d: Date): string {
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
