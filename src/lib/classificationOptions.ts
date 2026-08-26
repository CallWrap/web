export const CONSULTATION_TYPES: readonly string[] = [
  '사용법문의',
  '시스템오류',
  '고객PC환경',
  '자료확인',
  '자료보정',
  '정책 및 지침문의',
  '기능개선',
  '기타',
];

export const SUBCATEGORIES_BY_CATEGORY: Readonly<Record<string, readonly string[]>> = {
  결제및비용지급: [
    '가산단가',
    '결제내역',
    '결제방법 및 오류',
    '과오결제',
    '교통비 지급',
    '기타',
    '서비스비용 지급',
    '예외적 결제',
    '예외지급',
  ],
  대상자관리: [
    '가상계좌',
    '대상자정보',
    '바우처 사용 방법',
    '바우처생성',
    '본인부담금입금',
    '본인부담금환급',
    '신청기준및절차',
    '자격변경',
    '캡방식',
  ],
  부정사용: ['신고대상', '신고절차', '포상금'],
  제공기관관리: ['제공기관운영', '제공기관정보'],
  제공인력관리: ['급여등록', '자격 및 교육', '제공인력 정보'],
  지자체사업관리: ['사업운영 및 기존정보', '예탁금관리', '행복e음 연계'],
};

export const CONSULTATION_CATEGORIES: readonly string[] = Object.keys(SUBCATEGORIES_BY_CATEGORY);

export const CONSULTATION_GRADES: readonly string[] = ['일반', '칭찬콜', '악성콜'];

export type ClassificationField = 'type' | 'category' | 'subcategory';

interface ClassificationValues {
  type: string;
  category: string;
  subcategory: string;
}

export function getSubcategoryOptions(category: string): readonly string[] {
  return SUBCATEGORIES_BY_CATEGORY[category] ?? [];
}

export function normalizeSubcategoryForCategory(category: string, subcategory: string): string {
  return getSubcategoryOptions(category).includes(subcategory) ? subcategory : '';
}

// 상담등급은 검토분석 화면에서 빠지고 관리자 기능으로 옮겨가서 여기서는 검증하지 않는다.
export function findInvalidClassificationField(values: ClassificationValues): ClassificationField | null {
  if (!CONSULTATION_TYPES.includes(values.type)) return 'type';
  if (!CONSULTATION_CATEGORIES.includes(values.category)) return 'category';
  if (!getSubcategoryOptions(values.category).includes(values.subcategory)) return 'subcategory';
  return null;
}
