/** 값에 쉼표·줄바꿈·따옴표가 있으면 큰따옴표로 감싸고 내부 따옴표는 이스케이프한다. */
function csvCell(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number | boolean)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return lines.join('\r\n');
}

/** 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙여 실제 파일로 내려받는다. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean)[][]): void {
  const csv = '﻿' + toCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
