type IconProps = { size?: number };

/** 검토 대기열 — 서류함 */
export function TrayIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 13h4.2l1.4 2.4h4.8L15.8 13H20" strokeLinejoin="round" />
      <path d="M4 13 6 5h12l2 8v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

/** 후속처리 — 되돌이 화살표 */
export function LoopIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 12a8 8 0 0 1 13.6-5.7L20 8" strokeLinecap="round" />
      <path d="M20 4v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12a8 8 0 0 1-13.6 5.7L4 16" strokeLinecap="round" />
      <path d="M4 20v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 모니터링 대시보드 — 막대그래프 */
export function ChartIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" />
      <path d="M3 20h18" strokeLinecap="round" />
    </svg>
  );
}

/** 빈 서류함 — 후속처리 없음 */
export function EmptyTrayIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M4 13h4.2l1.4 2.4h4.8L15.8 13H20" strokeLinejoin="round" />
      <path d="M4 13 6 5h12l2 8v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" strokeLinejoin="round" strokeDasharray="2 2.4" />
    </svg>
  );
}

/** 도장 — 결재 완료(완료 대기열 없음) */
export function SealIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3 10.7 14.7 15.7 9.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
