/**
 * 관리자 탭 5종 (관리자_화면_구현_지침.md 1절).
 * 기존 7탭 중 측정 결과·등급/분포·상담품질·홀드아웃은 설계에서 빠졌고,
 * 상담사 관리·민원인 관리가 새로 들어왔다.
 */
export type AdminTab = 'overview' | 'ledger' | 'counselors' | 'customers' | 'faq';

export const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'ledger', label: '상담대장' },
  { key: 'counselors', label: '상담사 관리' },
  { key: 'customers', label: '민원인 관리' },
  { key: 'faq', label: 'FAQ 검수' },
];

export function isAdminTab(value: string | undefined): value is AdminTab {
  return ADMIN_TABS.some((t) => t.key === value);
}
