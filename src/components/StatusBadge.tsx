import type { CallGrade, CallStatus } from '../api/types';
import { gradeLabel, statusLabel } from '../lib/format';

export function StatusBadge({ status }: { status: CallStatus }) {
  const cls =
    status === 'analyzing'
      ? 'badge-analyzing'
      : status === 'review'
        ? 'badge-review'
        : status === 'followup'
          ? 'badge-followup'
          : status === 'failed'
            ? 'badge-failed'
            : 'badge-confirmed';
  return (
    <span className={`badge-pill ${cls}`}>
      {status === 'analyzing' ? <span className="spinner" /> : <span className="dot" />}
      {statusLabel[status]}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: CallGrade }) {
  // 일반/판정 대기는 특별히 알릴 게 없으니 배지 자체를 안 그린다 — 악성·칭찬만 눈에 띄면 된다.
  if (grade !== 'malicious' && grade !== 'praise') return null;
  const cls = grade === 'malicious' ? 'grade-malicious' : 'grade-praise';
  const icon = grade === 'malicious' ? '⚠' : '★';
  return (
    <span className={`badge-pill ${cls}`}>
      {icon} {gradeLabel[grade]}
    </span>
  );
}
