import {
  BarsIcon, ChartIcon, ChatIcon, CompareIcon, LedgerIcon, PieIcon, ShieldIcon,
} from '../components/icons';

export type AdminTab = 'overview' | 'measure' | 'grade' | 'ledger' | 'quality' | 'holdout' | 'faq';

export const ADMIN_TABS: { key: AdminTab; label: string; short: string }[] = [
  { key: 'overview', label: '개요', short: '개요' },
  { key: 'measure', label: '측정 결과', short: '측정' },
  { key: 'grade', label: '등급·분포', short: '분포' },
  { key: 'ledger', label: '상담대장', short: '대장' },
  { key: 'quality', label: '상담품질 자동평가', short: '품질' },
  { key: 'holdout', label: '홀드아웃 검증', short: '검증' },
  { key: 'faq', label: 'FAQ 검수', short: 'FAQ' },
];

/** 탭 이름을 아이콘으로도 보여준다 — 사이드바 분류 패널과 같은 아이콘을 재사용해
 * 텍스트를 안 읽어도 어떤 탭인지 모양으로 구분되게 한다. */
export const ADMIN_TAB_ICONS: Record<AdminTab, (props: { size?: number }) => JSX.Element> = {
  overview: ChartIcon,
  measure: BarsIcon,
  grade: PieIcon,
  ledger: LedgerIcon,
  quality: ShieldIcon,
  holdout: CompareIcon,
  faq: ChatIcon,
};
