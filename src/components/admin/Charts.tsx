/* ─────────────────────────────────────────────────────────────
   관리자 화면 차트 (관리자_화면_구현_지침.md 2·4·5절).
   recharts 대신 SVG/CSS로 직접 그린다 — 지침이 요구하는 규격
   (조각 사이 흰 테두리 1.5, 12단계 그라데이션, 막대 두께 18,
   도넛 가운데 총계)을 픽셀 단위로 맞추기에 이쪽이 짧고 정확하다.
   ───────────────────────────────────────────────────────────── */

/** 등급 색 — 상담사 화면 토큰과 같은 값 (지침 2절 예외 규정) */
export const GRADE_COLOR = {
  malicious: '#c8102e',
  praise: '#0f766e',
  normal: '#5b6472',
} as const;

/** 분포 차트 범주 색 8종. 악성콜 적색과 겹치는 강한 빨강은 쓰지 않는다. */
export const CATEGORY_COLORS = [
  '#1f4b99', '#0f766e', '#b45309', '#0284c7',
  '#4d7c0f', '#a21caf', '#475569', '#a8a29e',
];

/* ── 누적 세로 막대 — 시간대별 처리 추이 ───────────────────── */

export interface StackedBar {
  label: string;
  normal: number;
  praise: number;
  malicious: number;
}

export function StackedBars({ data }: { data: StackedBar[] }) {
  const totals = data.map((d) => d.normal + d.praise + d.malicious);
  const max = Math.max(1, ...totals);

  return (
    <div className="aw-chart">
      <div className="aw-bars">
        {data.map((d, i) => {
          const total = totals[i];
          return (
            <div className="aw-bar" key={d.label}>
              <span className="v">{total || ''}</span>
              {/* 높이는 비율로. column-reverse라 아래부터 일반 → 칭찬 → 악성 순으로 쌓인다 */}
              <div className="aw-stack" style={{ height: `${(total / max) * 100}%` }}>
                {(['normal', 'praise', 'malicious'] as const).map((k) =>
                  d[k] > 0 ? (
                    <i key={k} style={{ height: `${(d[k] / total) * 100}%`, background: GRADE_COLOR[k] }} />
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="aw-xlabels">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ── 그라데이션 세로 막대 — 상담사별 처리 건수 ─────────────── */

/** 1위에서 꼴찌로 갈수록 남색이 옅어지는 12단계. 순위(0부터)로 색을 고른다. */
function rankColor(rank: number, total: number): string {
  const steps = Math.max(1, Math.min(total, 12) - 1);
  const t = Math.min(rank, steps) / steps; // 0(1위) ~ 1(꼴찌)
  // #14294f(진한 남색) → #cfe0f5(옅은 남색)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(20, 207)}, ${mix(41, 224)}, ${mix(79, 245)})`;
}

/**
 * `color`를 주면 모든 막대가 그 색이 된다 — 순위 의미가 없는 데이터(시간대별 등)에 쓴다.
 * 안 주면 1위→꼴찌 그라데이션이 걸린다.
 */
export function RankedBars({ data, color }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="aw-chart">
      <div className="aw-bars">
        {data.map((d, i) => (
          <div className="aw-bar" key={d.label}>
            <span className="v">{d.value}</span>
            <div
              className="aw-stack"
              style={{ height: `${(d.value / max) * 100}%`, background: color ?? rankColor(i, data.length) }}
            />
          </div>
        ))}
      </div>
      <div className="aw-xlabels">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ── 도넛 ────────────────────────────────────────────────── */

export interface Slice {
  label: string;
  value: number;
}

/**
 * 도넛 130 + 범례. 조각 사이 흰 테두리 1.5px, 가운데에 총 건수.
 * stroke-dasharray로 그린다 — path 계산 없이 원 하나로 끝난다.
 */
export function Donut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const size = 130;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  return (
    <div className="aw-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s, i) => {
            const len = total > 0 ? (s.value / total) * circ : 0;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                strokeWidth={stroke}
                // 조각 사이를 1.5px 비워 흰 테두리처럼 보이게 한다
                strokeDasharray={`${Math.max(0, len - 1.5)} ${circ - Math.max(0, len - 1.5)}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text className="aw-donut-total" textAnchor="middle">
          <tspan className="n" x={size / 2} y={size / 2 + 2}>{total}</tspan>
          <tspan className="u" x={size / 2} y={size / 2 + 16}>건</tspan>
        </text>
      </svg>

      <div className="aw-dlegend">
        {slices.map((s, i) => (
          <div className={`r ${i === 0 ? 'top' : ''}`} key={s.label}>
            <i style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
            <span className="nm">{s.label}</span>
            <span className="ct">{s.value}</span>
            <span className="pc">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 가로 막대 — 등급별 처리 / 등급별 이력 ─────────────────── */

export function GradeBars({ counts }: { counts: { malicious: number; normal: number; praise: number } }) {
  const rows = [
    { label: '악성콜', value: counts.malicious, color: GRADE_COLOR.malicious },
    { label: '일반콜', value: counts.normal, color: GRADE_COLOR.normal },
    { label: '칭찬콜', value: counts.praise, color: GRADE_COLOR.praise },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="aw-hbars">
      {rows.map((r) => (
        <div className="aw-hbar" key={r.label}>
          <span className="lb">{r.label}</span>
          <span className="tr">
            <i style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </span>
          <span className="ct" style={{ color: r.color }}>{r.value}건</span>
        </div>
      ))}
    </div>
  );
}

/* ── 값에 따라 색이 변하는 세로 막대 — 발화 감정 분석 ──────── */

/** 값이 오를수록 청록 → 황색 → 적색 */
function sentimentColor(v: number, max: number): string {
  const t = max > 0 ? v / max : 0;
  if (t >= 0.8) return GRADE_COLOR.malicious;
  if (t >= 0.55) return '#9a6b00';
  return GRADE_COLOR.praise;
}

export function SentimentBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="aw-chart">
      <div className="aw-bars">
        {data.map((d) => (
          <div className="aw-bar" key={d.label}>
            <span className="v" style={{ color: sentimentColor(d.value, max), fontWeight: 700 }}>{d.value}</span>
            <div
              className="aw-stack"
              style={{ height: `${(d.value / max) * 100}%`, background: sentimentColor(d.value, max) }}
            />
          </div>
        ))}
      </div>
      <div className="aw-xlabels">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ── 월별 막대 — 문의 추이 ─────────────────────────────────── */

export interface MonthPoint {
  label: string;
  total: number;
  malicious: number;
  praise: number;
}

/** 악성콜이 있던 달은 적색, 칭찬만 있으면 청록, 둘 다 없으면 회색 */
export function MonthBars({ data }: { data: MonthPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="aw-chart">
      <div className="aw-bars">
        {data.map((d) => {
          const color = d.malicious > 0 ? GRADE_COLOR.malicious : d.praise > 0 ? GRADE_COLOR.praise : GRADE_COLOR.normal;
          return (
            <div className="aw-bar" key={d.label}>
              <span className="v">{d.total}</span>
              <div className="aw-stack" style={{ height: `${(d.total / max) * 100}%`, background: color }} />
            </div>
          );
        })}
      </div>
      <div className="aw-xlabels">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
