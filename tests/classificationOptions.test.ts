import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findInvalidClassificationField,
  getSubcategoryOptions,
  normalizeSubcategoryForCategory,
} from '../src/lib/classificationOptions.ts';

test('선택한 중분류에 속한 소분류만 반환한다', () => {
  assert.deepEqual(getSubcategoryOptions('제공기관관리'), ['제공기관운영', '제공기관정보']);
  assert.deepEqual(getSubcategoryOptions('부정사용'), ['신고대상', '신고절차', '포상금']);
});

test('중분류 변경 후 호환되지 않는 소분류를 비운다', () => {
  assert.equal(normalizeSubcategoryForCategory('제공기관관리', '제공기관정보'), '제공기관정보');
  assert.equal(normalizeSubcategoryForCategory('대상자관리', '제공기관정보'), '');
  assert.equal(normalizeSubcategoryForCategory('알 수 없는 분류', '대상자정보'), '');
});

test('저장 전에 분류값과 중·소분류 조합을 검증한다', () => {
  assert.equal(
    findInvalidClassificationField({
      type: '자료확인',
      category: '대상자관리',
      subcategory: '대상자정보',
      grade: '칭찬콜',
    }),
    null,
  );
  assert.equal(
    findInvalidClassificationField({
      type: '자료확인',
      category: '대상자관리',
      subcategory: '제공기관정보',
      grade: '칭찬콜',
    }),
    'subcategory',
  );
  assert.equal(
    findInvalidClassificationField({
      type: '알 수 없는 유형',
      category: '대상자관리',
      subcategory: '대상자정보',
      grade: '칭찬콜',
    }),
    'type',
  );
});
