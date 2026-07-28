import type { CallGrade, CallStatus, Tier } from '../api/types';

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s.toString().padStart(2, '0')}초`;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export const statusLabel: Record<CallStatus, string> = {
  transcribing: '전사 중',
  quality_check: '품질 검사',
  analyzing: '분석 중',
  review: '검토 대기',
  confirmed: '완료',
  followup: '후속필요',
};

export const gradeLabel: Record<CallGrade, string> = {
  normal: '일반',
  praise: '칭찬',
  malicious: '악성콜',
};

export const tierLabel: Record<Tier, string> = {
  high: 'AI 확신',
  medium: '검토 필요',
  low: '직접 판단',
};

export const fieldLabel: Record<string, string> = {
  type: '상담유형',
  category: '상담분류',
  grade: '상담등급',
  summary: '문의·처리내용 요약',
  followup: '후속처리',
};
