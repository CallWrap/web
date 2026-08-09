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
  if (grade === 'normal') return null;
  const cls = grade === 'malicious' ? 'grade-malicious' : 'grade-praise';
  const icon = grade === 'malicious' ? '⚠' : '★';
  return (
    <span className={`badge-pill ${cls}`}>
      {icon} {gradeLabel[grade]}
    </span>
  );
}
