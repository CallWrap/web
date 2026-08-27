/* 한 칸 = 한 줄. 긴 발화는 칸을 두껍게 하지 않고 같은 화자로 다음 칸에 이어 붙인다. */

/** 글자 폭 재는 함수. 실제 화면에선 canvas measureText, 테스트에선 가짜 함수를 넣는다. */
export type Measure = (text: string) => number;

/**
 * 한 줄에 들어갈 만큼씩 끊는다. **어절(공백) 경계에서만 끊어** 단어가 중간에 잘리지 않는다.
 * 한 어절 자체가 한 줄보다 길 때만 예외적으로 글자 단위로 쪼갠다.
 */
export function fitLines(text: string, maxWidth: number, measure: Measure): string[] {
  if (maxWidth <= 0) return [text];
  const fits = (t: string) => measure(t) <= maxWidth;

  const lines: string[] = [];
  let line = '';
  const flush = () => {
    if (line) {
      lines.push(line);
      line = '';
    }
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    flush();
    if (fits(word)) {
      line = word;
      continue;
    }
    // 한 어절이 줄보다 길다 — 이때만 글자 단위로 쪼갠다
    let chunk = '';
    for (const ch of word) {
      if (chunk && !fits(chunk + ch)) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    line = chunk;
  }
  flush();
  return lines.length > 0 ? lines : [text];
}

let measureCanvas: CanvasRenderingContext2D | null = null;

/** canvas 기반 측정기. font가 바뀌면 새로 만들 필요 없이 매번 세팅만 한다. */
export function canvasMeasure(font: string): Measure {
  if (!measureCanvas) measureCanvas = document.createElement('canvas').getContext('2d');
  const ctx = measureCanvas;
  if (!ctx) return (t) => t.length * 12; // canvas를 못 쓰면 대략치로라도 끊는다
  return (t) => {
    ctx.font = font;
    return ctx.measureText(t).width;
  };
}
