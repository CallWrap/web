import type { CallGrade, CallStatus, SummaryValue, Tier } from '../api/types';

export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
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
  return no == null ? '—' : `#${String(no).padStart(3, '0')}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
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
