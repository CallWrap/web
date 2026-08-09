export type AdminTab = 'overview' | 'measure' | 'grade' | 'ledger' | 'quality' | 'holdout';

export const ADMIN_TABS: { key: AdminTab; label: string; short: string }[] = [
  { key: 'overview', label: '개요', short: '개요' },
  { key: 'measure', label: '측정 결과', short: '측정' },
  { key: 'grade', label: '등급·분포', short: '분포' },
  { key: 'ledger', label: '상담대장', short: '대장' },
  { key: 'quality', label: '상담품질 자동평가', short: '품질' },
  { key: 'holdout', label: '홀드아웃 검증', short: '검증' },
];
