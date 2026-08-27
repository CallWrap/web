import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLines } from '../src/components/counselor/fitLines.ts';

// 글자 1개 = 1폭인 가짜 측정기. 실제 화면에선 canvas measureText가 들어간다.
const measure = (t: string) => t.length;

test('어절 경계에서만 끊는다 — 단어가 중간에 잘리지 않는다', () => {
  // 폭 8 → '가나다 라마바'(7)까지 들어가고 '사아자'를 붙이면 11이라 넘친다
  const lines = fitLines('가나다 라마바 사아자 차카타', 8, measure);
  assert.deepEqual(lines, ['가나다 라마바', '사아자 차카타']);
});

test('한 어절이 줄보다 길면 그 어절만 글자 단위로 쪼갠다', () => {
  const lines = fitLines('짧다 아주아주아주긴한덩어리다', 6, measure);
  assert.deepEqual(lines, ['짧다', '아주아주아주', '긴한덩어리다']);
});

test('줄 첫머리에 공백이 남지 않는다', () => {
  for (const line of fitLines('가나 다라 마바 사아 자차', 5, measure)) {
    assert.equal(line, line.trim());
    assert.ok(line.length > 0);
  }
});

test('내용을 잃지 않는다 — 공백을 빼면 원문과 같다', () => {
  const text = '결제분은 익일 반영되며 반영 완료 시 문자로 안내드리겠습니다.';
  const joined = fitLines(text, 13, measure).join(' ');
  assert.equal(joined.replace(/\s/g, ''), text.replace(/\s/g, ''));
});

test('폭을 모르면(0) 원문 한 줄로 둔다', () => {
  assert.deepEqual(fitLines('아무 내용', 0, measure), ['아무 내용']);
});
