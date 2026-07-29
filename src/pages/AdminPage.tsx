import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCallStore } from '../store/callStore';

const BASELINE_REVIEW_SEC = 210; // 기존 수기 후처리 평균 3분 30초

// 시간대별 처리량 (데모용 정적 데이터)
const throughput = [
  { h: '09시', n: 42 },
  { h: '10시', n: 68 },
  { h: '11시', n: 74 },
  { h: '12시', n: 31 },
  { h: '13시', n: 58 },
  { h: '14시', n: 81 },
  { h: '15시', n: 77 },
];

// 상담사별 악성콜 밸런싱 (데모용)
const agentBalance = [
  { name: '김상담', n: 3 },
  { name: '이상담', n: 2 },
  { name: '박상담', n: 4 },
  { name: '최상담', n: 1 },
  { name: '정상담', n: 2 },
];

const typeColors = ['#4f46e5', '#0891b2', '#d97706', '#be185d', '#059669', '#7c3aed'];

export function AdminPage() {
  const { calls, totalReviewSec } = useCallStore();

  const processed = calls.filter((c) => c.status === 'confirmed' || c.status === 'followup');
  const processedWithTime = processed.filter((c) => c.reviewSec != null);
  const avgReview =
    processedWithTime.length > 0
      ? Math.round(totalReviewSec / processedWithTime.length)
      : 0;
  const savingPct =
    avgReview > 0 ? Math.round((1 - avgReview / BASELINE_REVIEW_SEC) * 100) : 68;

  const maliciousCount = calls.filter((c) => c.grade === 'malicious').length;
  const maliciousRate = Math.round((maliciousCount / Math.max(1, calls.length)) * 100);

  // 상담유형 분포
  const typeCounts = new Map<string, number>();
  calls.forEach((c) => {
    const t = c.fields.type.value || '미분류';
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  });
  const typeDist = Array.from(typeCounts, ([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n);

  const avgMM = Math.floor(avgReview / 60);
  const avgSS = (avgReview % 60).toString().padStart(2, '0');

  return (
    <div className="content">
      <div className="section-head">
        <h2>모니터링 대시보드</h2>
      </div>
      <div className="metric-row four">
        <div className="metric">
          <div className="label">오늘 처리 건수</div>
          <div className="value">
            {processed.length || calls.length}
            <small> / {calls.length + 470}</small>
          </div>
          <div className="sub">누적 목표 대비</div>
        </div>
        <div className="metric">
          <div className="label">평균 검토 시간</div>
          <div className="value">
            {avgReview > 0 ? (
              <>
                {avgMM}:{avgSS}
              </>
            ) : (
              <>—</>
            )}
          </div>
          <div className="sub good">
            기존 대비 {savingPct}% 단축 (수기 3:30)
          </div>
        </div>
        <div className="metric">
          <div className="label">악성콜 발생률</div>
          <div className="value">
            {maliciousRate}
            <small>%</small>
          </div>
          <div className="sub warn">감정노동 보호 {maliciousCount}건 발생</div>
        </div>
        <div className="metric">
          <div className="label">개방 후보 (Level 3↑)</div>
          <div className="value">
            12
            <small> 건</small>
          </div>
          <div className="sub">검증 완료 시 자동 개방 대상</div>
        </div>
      </div>

      <div className="info-note">
        <span>ℹ</span>
        <span>
          평균 검토 시간은 상담사가 이 데모에서 <strong>실제 검토한 시간</strong>을 반영합니다. 콜을
          검토·저장할수록 수치가 갱신됩니다.
        </span>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>상담유형 분포</h3>
          <div className="sub">오늘 처리된 콜 기준</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={typeDist} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
              <Bar dataKey="n" radius={[5, 5, 0, 0]} name="건수" isAnimationActive={false}>
                {typeDist.map((_, i) => (
                  <Cell key={i} fill={typeColors[i % typeColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>상담사별 악성콜 밸런싱</h3>
          <div className="sub">특정 상담사 편중 방지 모니터링</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={agentBalance} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
              <Bar dataKey="n" radius={[5, 5, 0, 0]} fill="var(--danger)" name="악성콜" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card wide">
          <h3>시간대별 처리량</h3>
          <div className="sub">AI 후처리 자동화로 피크 시간 처리 지연 완화</div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={throughput} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
              <XAxis dataKey="h" tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
              <Line type="monotone" dataKey="n" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3 }} name="처리 건수" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
