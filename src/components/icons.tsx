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

/** 처리 완료 — 체크 원 (SealIcon과 같은 모양, 사이드바 크기용) */
export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3 10.7 14.7 15.7 9.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 측정 결과 — 막대 3개 */
export function BarsIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 19V10M12 19V5M19 19v-6" strokeLinecap="round" />
    </svg>
  );
}

/** 등급·분포 — 시계형 파이 */
export function PieIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 4v8l6 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 상담대장 — 목록 */
export function LedgerIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="3.5" width="16" height="17" rx="1.6" />
      <path d="M8 8.5h8M8 12.5h8M8 16.5h5" strokeLinecap="round" />
    </svg>
  );
}

/** 상담품질 자동평가 — 방패 체크 */
export function ShieldIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3.5 19 6v5c0 5-3.2 8.2-7 9-3.8-.8-7-4-7-9V6l7-2.5Z" strokeLinejoin="round" />
      <path d="M8.7 12 11 14.3l4.3-4.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 홀드아웃 검증 — 좌우 비교 막대 */
export function CompareIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3.5" y="5" width="9" height="14" rx="1.4" />
      <rect x="14.5" y="5" width="6" height="14" rx="1.4" />
    </svg>
  );
}

/** FAQ 검수 — 말풍선 물음표 */
export function ChatIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 4.5h16v10.5H9l-3.5 3.5v-3.5H4V4.5Z" strokeLinejoin="round" />
      <path d="M9.5 9.6a2.4 2.4 0 1 1 3.2 2.2c-.6.25-.85.6-.85 1.2" strokeLinecap="round" />
      <circle cx="12" cy="15" r="0.2" fill="currentColor" />
    </svg>
  );
}

/** 사이드바 열기 — 햄버거 */
export function MenuIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

/** 사이드바 닫기 — X */
export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5l14 14M19 5 5 19" strokeLinecap="round" />
    </svg>
  );
}

/** CallWrap 로고 — 사용자가 실제 파일을 주기 전까지 쓰는 임시 마크(둥근 사각형 + 헤드셋). */
export function LogoMark({ size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="10" fill="#152549" />
      <path
        d="M13 22v-3a7 7 0 0 1 14 0v3"
        fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"
      />
      <rect x="10.5" y="20.5" width="4.5" height="7" rx="2.2" fill="#fff" />
      <rect x="25" y="20.5" width="4.5" height="7" rx="2.2" fill="#fff" />
      <path d="M27.2 27.5v1a3 3 0 0 1-3 3h-2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20.4" cy="31.4" r="1.6" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}
