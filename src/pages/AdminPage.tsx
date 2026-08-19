import { useMemo, useState } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';
import type { FieldKey } from '../api/types';
import { FaqReviewPanel } from '../components/FaqReviewPanel';
import { useCallStore } from '../store/callStore';
import { fieldLabel, fmtDuration, fmtTime, gradeLabel, statusLabel, tierLabel } from '../lib/format';
import { downloadCsv } from '../lib/exportCsv';
import { ADMIN_TABS, type AdminTab } from '../lib/adminTabs';
import {
  CALL_QUALITY_SCORES,
  QUALITY_CATEGORIES,
  QUALITY_SUBCATEGORIES,
  SUBCATEGORY_ORDER,
  callQualityTotal,
  worstSubcategory,
} from '../mock/qualityScores';
import {
  GRADE_CONFUSION,
  HOLDOUT_METRICS,
  RULE_VS_LLM_CLASSIFICATION,
  RULE_VS_LLM_JUDGMENT,
  TYPE_GOLDEN_DIST,
  TYPE_REAL_WORLD_REF,
} from '../mock/validation';

const BASELINE_REVIEW_SEC = 210; // 기존 수기 후처리 평균 3분 30초
const LEDGER_FIELDS: FieldKey[] = ['type', 'category', 'grade', 'summary', 'followup'];

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

const GRADE_ORDER: Array<'칭찬콜' | '악성콜' | '일반'> = ['칭찬콜', '악성콜', '일반'];

export function AdminPage() {
  const { calls, totalReviewSec } = useCallStore();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const tab: AdminTab = ADMIN_TABS.some((t) => t.key === tabParam) ? (tabParam as AdminTab) : 'overview';
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const processed = calls.filter((c) => c.status === 'confirmed' || c.status === 'followup');
  const processedWithTime = processed.filter((c) => c.reviewSec != null);
  const avgReview =
    processedWithTime.length > 0
      ? Math.round(totalReviewSec / processedWithTime.length)
      : 0;
  const savingPct =
    avgReview > 0 ? Math.round((1 - avgReview / BASELINE_REVIEW_SEC) * 100) : 68;

  const maliciousCount = calls.filter((c) => c.grade === 'malicious').length;
  const praiseCount = calls.filter((c) => c.grade === 'praise').length;
  const normalCount = calls.filter((c) => c.grade === 'normal').length;
  const maliciousRate = Math.round((maliciousCount / Math.max(1, calls.length)) * 100);

  // 상담유형 분포 (오늘 큐 기준)
  const typeCounts = new Map<string, number>();
  calls.forEach((c) => {
    const t = c.fields.type.value || '미분류';
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  });
  const typeDist = Array.from(typeCounts, ([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n);
  const typeColors = ['#4f46e5', '#0891b2', '#d97706', '#be185d', '#059669', '#7c3aed', '#0284c7', '#65a30d'];

  const avgMM = Math.floor(avgReview / 60);
  const avgSS = (avgReview % 60).toString().padStart(2, '0');

  const filteredCalls = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter(
      (c) =>
        c.callId.toLowerCase().includes(q) ||
        c.fields.summary.value.toLowerCase().includes(q) ||
        c.fields.type.value.toLowerCase().includes(q),
    );
  }, [calls, query]);

  // 상담품질 자동평가 파생값
  const qualityTotals = CALL_QUALITY_SCORES.map((s) => ({ call: s, total: callQualityTotal(s) }));
  const qualityAvg = qualityTotals.reduce((sum, t) => sum + t.total, 0) / qualityTotals.length;
  const qualityMin = Math.min(...qualityTotals.map((t) => t.total));
  const qualityMax = Math.max(...qualityTotals.map((t) => t.total));
  const sortedByTotal = [...qualityTotals].sort((a, b) => a.total - b.total);
  const qualityMedian = sortedByTotal[Math.floor(sortedByTotal.length / 2)].total;

  function categoryAvg(catKey: string) {
    const cat = QUALITY_CATEGORIES.find((c) => c.key === catKey)!;
    const sum = qualityTotals.reduce(
      (acc, t) => acc + cat.subKeys.reduce((s, k) => s + (t.call.scores[k] ?? 0), 0),
      0,
    );
    return sum / qualityTotals.length;
  }

  function subcatAvg(key: string) {
    const sum = qualityTotals.reduce((acc, t) => acc + (t.call.scores[key] ?? 0), 0);
    return sum / qualityTotals.length;
  }

  function handleExportLedger() {
    downloadCsv(
      `aftercall-상담대장-${new Date().toISOString().slice(0, 10)}.csv`,
      ['통화ID', '상담유형', '상담분류', '상담등급', '요약', '상태', '검토시간(초)'],
      filteredCalls.map((c) => [
        c.callId,
        c.fields.type.value,
        c.fields.category.value,
        gradeLabel[c.grade],
        c.fields.summary.value,
        statusLabel[c.status],
        c.reviewSec ?? '',
      ]),
    );
  }

  function handleExportQuality() {
    downloadCsv(
      `aftercall-상담품질-${new Date().toISOString().slice(0, 10)}.csv`,
      ['통화ID', '총점', ...QUALITY_CATEGORIES.map((c) => c.label), '최저항목', '판정근거'],
      CALL_QUALITY_SCORES.map((s) => {
        const worst = worstSubcategory(s);
        return [
          s.callId,
          callQualityTotal(s),
          ...QUALITY_CATEGORIES.map((cat) => cat.subKeys.reduce((sum, k) => sum + (s.scores[k] ?? 0), 0)),
          QUALITY_SUBCATEGORIES[worst.key].label,
          s.reason,
        ];
      }),
    );
  }

  return (
    <div className="content">
      <div className="admin-stats">
        <span className="stat-pill malicious">
          악성 <b>{maliciousCount}</b>
        </span>
        <span className="stat-pill normal">
          일반 <b>{normalCount}</b>
        </span>
        <span className="stat-pill praise">
          칭찬 <b>{praiseCount}</b>
        </span>
        <span className="stat-pill total">
          전체 <b>{calls.length}</b>
        </span>
      </div>

      <div className="admin-tabs">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => navigate(t.key === 'overview' ? '/admin' : `/admin/${t.key}`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ 개요 ═══════ */}
      {tab === 'overview' && (
        <>
          <div className="improve-banner">
            <div className="improve-card">
              <div className="label">후처리 시간 단축</div>
              <div className="big">
                {savingPct}<small>%</small>
              </div>
              <div className="sub">
                수기 3:30 → 자동화 후 {avgReview > 0 ? `${avgMM}:${avgSS}` : '측정 중'}
              </div>
            </div>
            <div className="improve-card">
              <div className="label">채점 방식 전환</div>
              <div className="big">
                10건<small> → 24건</small>
              </div>
              <div className="sub">표본 채점(QAA 4명 · 분기별 1인당 10콜) → 전수 채점으로 확대</div>
            </div>
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
              <div className="sub good">기존 대비 {savingPct}% 단축 (수기 3:30)</div>
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
                  <XAxis dataKey="type" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
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
        </>
      )}

      {/* ═══════ 측정 결과 ═══════ */}
      {tab === 'measure' && (
        <>
          <div className="dense-head">
            <h2>측정 결과</h2>
            <p>큰 수치가 조정셋(골든셋), 작은 수치가 홀드아웃(별도 시드 세트) — 목업 값이며 실제 파이프라인 연동 전 자리채움입니다.</p>
          </div>

          <div className="measure-grid">
            {HOLDOUT_METRICS.slice(0, 4).map((m) => (
              <div key={m.key} className="metric measure-metric">
                <div className="label">{m.label}</div>
                <div className="value">
                  {m.adjusted}
                  <small>{m.unit}</small>
                </div>
                <div className="sub">홀드아웃 {m.holdout}{m.unit}</div>
              </div>
            ))}
          </div>

          <div className="dense-head" style={{ marginTop: 26 }}>
            <h2>규칙 기반 vs LLM 자동 추출</h2>
            <p>같은 전사·같은 골든셋 정답으로 채점 — 판단형(등급·후속처리)과 분류형(유형·분류)을 나눠서 비교합니다.</p>
          </div>
          <div className="rulecmp-grid">
            <div className="rulecmp-card">
              <h4>판단형 필드</h4>
              <table className="cmp-table">
                <thead>
                  <tr><th>필드</th><th>규칙기반</th><th>LLM</th><th>차이</th></tr>
                </thead>
                <tbody>
                  {RULE_VS_LLM_JUDGMENT.map((r) => (
                    <tr key={r.field}>
                      <td>{r.field}</td><td>{r.rule}</td><td>{r.llm}</td>
                      <td className="diff pos">+{(r.llm - r.rule).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rulecmp-card">
              <h4>분류형 필드 (Macro-F1)</h4>
              <table className="cmp-table">
                <thead>
                  <tr><th>필드</th><th>규칙기반</th><th>LLM</th><th>차이</th></tr>
                </thead>
                <tbody>
                  {RULE_VS_LLM_CLASSIFICATION.map((r) => (
                    <tr key={r.field}>
                      <td>{r.field}</td><td>{r.rule}</td><td>{r.llm}</td>
                      <td className="diff pos">+{(r.llm - r.rule).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════ 등급·분포 ═══════ */}
      {tab === 'grade' && (
        <>
          <div className="dense-head">
            <h2>상담등급 혼동행렬</h2>
            <p>행 = 정답, 열 = 자동판정. 대각선이 적중입니다. (골든셋 24건 · 목업)</p>
          </div>
          <div className="ledger" style={{ marginBottom: 26, overflowX: 'auto' }}>
            <table className="confusion-table">
              <thead>
                <tr>
                  <th />
                  {GRADE_ORDER.map((g) => (
                    <th key={g}>{g}</th>
                  ))}
                  <th>적중</th>
                </tr>
              </thead>
              <tbody>
                {GRADE_CONFUSION.map((row) => {
                  const rowTotal = GRADE_ORDER.reduce((sum, g) => sum + row.predicted[g], 0);
                  const hit = row.predicted[row.actual];
                  return (
                    <tr key={row.actual}>
                      <th>{row.actual}</th>
                      {GRADE_ORDER.map((g) => (
                        <td key={g} className={g === row.actual ? 'diag' : row.predicted[g] > 0 ? 'off' : ''}>
                          {row.predicted[g] || ''}
                        </td>
                      ))}
                      <td className="tnum">{hit}/{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="dense-head">
            <h2>상담유형 분포 — 골든셋 vs 실제 모집단</h2>
            <p>골든셋은 희소 클래스를 의도적으로 과표집합니다. 실제 모집단은 극단적으로 불균형(사용법문의 65%)이라 그대로 학습하면 희소 유형을 못 배웁니다.</p>
          </div>
          <div className="chart-grid">
            <div className="chart-card">
              <h3>골든셋 표본 분포</h3>
              <div className="sub">총 {TYPE_GOLDEN_DIST.reduce((s, d) => s + d.n, 0)}건</div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={TYPE_GOLDEN_DIST} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 10.5, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                  <Bar dataKey="n" radius={[5, 5, 0, 0]} fill="var(--brand)" name="건수" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>실제 모집단 참고치</h3>
              <div className="sub">타 사업군 통계(label_spec.md) · 스코프는 다르므로 참고만</div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={TYPE_REAL_WORLD_REF} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 10.5, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} scale="log" domain={[1, 300000]} allowDataOverflow />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                  <Bar dataKey="n" radius={[5, 5, 0, 0]} fill="var(--text-3)" name="건수" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ═══════ 상담대장 ═══════ */}
      {tab === 'ledger' && (
        <>
          <div className="dense-head">
            <h2>상담대장</h2>
            <p>전체 {calls.length}건 · 행을 클릭하면 AI 판정 상세가 펼쳐집니다.</p>
          </div>

          <div className="ledger-toolbar">
            <input
              className="ledger-search"
              type="text"
              placeholder="통화ID · 요약 · 상담유형 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn primary sm" onClick={handleExportLedger}>
              CSV 내려받기
            </button>
          </div>

          <div className="ledger">
            <div className="ledger-row ledger-head">
              <span>통화</span>
              <span>유형</span>
              <span>분류</span>
              <span>등급</span>
              <span>요약</span>
              <span>신뢰도</span>
              <span>상태</span>
              <span>검토시간</span>
            </div>

            {filteredCalls.length === 0 ? (
              <div className="empty">
                <h3>검색 결과가 없습니다</h3>
                <p>다른 검색어로 다시 시도해 보세요.</p>
              </div>
            ) : (
              filteredCalls.map((c) => {
                const tiers = LEDGER_FIELDS.map((k) => c.fields[k].tier);
                const open = openId === c.callId;
                return (
                  <div key={c.callId} className="ledger-item">
                    <button
                      className="ledger-row ledger-body"
                      onClick={() => setOpenId(open ? null : c.callId)}
                      aria-expanded={open}
                    >
                      <span className="cid">
                        {open ? '▾' : '▸'} #{c.callId}
                        <small>{fmtTime(c.startedAt)}</small>
                      </span>
                      <span>{c.fields.type.value || '—'}</span>
                      <span>{c.fields.category.value || '—'}</span>
                      <span className={`badge-pill grade-${c.grade}`}>{gradeLabel[c.grade]}</span>
                      <span className="ellipsis">{c.fields.summary.value || '요약 없음'}</span>
                      <span className="tier-dots">
                        {tiers.map((t, i) => (
                          <span key={i} className={`dot ${t}`} />
                        ))}
                      </span>
                      <span>{statusLabel[c.status]}</span>
                      <span className="tnum">{c.reviewSec != null ? fmtDuration(c.reviewSec) : '—'}</span>
                    </button>

                    {open && (
                      <div className="ledger-detail">
                        <div className="ledger-detail-fields">
                          {LEDGER_FIELDS.map((k) => (
                            <div key={k} className="ledger-field">
                              <span className="k">{fieldLabel[k]}</span>
                              <span className={`tier-badge ${c.fields[k].tier}`}>
                                {tierLabel[c.fields[k].tier]} {Math.round(c.fields[k].confidence * 100)}%
                              </span>
                              <span className="v">
                                {k === 'followup' ? (c.fields[k].value ? '필요' : '불필요') : String(c.fields[k].value || '—')}
                              </span>
                            </div>
                          ))}
                        </div>
                        <button className="btn ghost sm" onClick={() => navigate(`/review/${c.callId}`)}>
                          검토 화면 열기 →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ═══════ 상담품질 자동평가 ═══════ */}
      {tab === 'quality' && (
        <>
          <div className="honesty-note">
            배점 체계(100점 · 4대분류 · 11소분류)는 한국사회보장정보원 「상담품질 평가기술서」 공식 기준입니다.
            <strong> 채점 로직은 AI 자동화이며, 세부 채점 루브릭(문항별 판정 기준 원문)은 아직 확보하지 못했습니다.</strong>
            "기준표를 그대로 구현했다"는 표현은 쓰지 않습니다 — 배점만 공식, 판정은 AI 추정입니다.
          </div>

          <div className="quality-summary">
            <div className="quality-score-card">
              <div className="label">총점 (100점 만점)</div>
              <div className="big">{qualityAvg.toFixed(1)}</div>
              <div className="sub">평균 · 최저 {qualityMin} · 최고 {qualityMax} · 중앙 {qualityMedian}</div>
              {QUALITY_CATEGORIES.map((cat) => {
                const avg = categoryAvg(cat.key);
                return (
                  <div key={cat.key} className="quality-cat-row">
                    <span className="cat-label">{cat.label}</span>
                    <div className="cat-bar"><i style={{ width: `${(avg / cat.max) * 100}%` }} /></div>
                    <span className="cat-num">{avg.toFixed(1)} /{cat.max}</span>
                  </div>
                );
              })}
            </div>

            <div className="quality-sub-card">
              <h4>항목별 평균 <span className="hint">신뢰도로 정렬</span></h4>
              <table className="cmp-table sub-table">
                <thead>
                  <tr><th>항목</th><th>평균</th><th>배점</th><th>달성</th><th>신뢰도</th></tr>
                </thead>
                <tbody>
                  {[...SUBCATEGORY_ORDER]
                    .sort((a, b) => subcatAvg(a) / QUALITY_SUBCATEGORIES[a].max - subcatAvg(b) / QUALITY_SUBCATEGORIES[b].max)
                    .map((key) => {
                      const sub = QUALITY_SUBCATEGORIES[key];
                      const avg = subcatAvg(key);
                      const pct = Math.round((avg / sub.max) * 100);
                      return (
                        <tr key={key}>
                          <td>{sub.label}</td>
                          <td>{avg.toFixed(1)}</td>
                          <td>{sub.max}</td>
                          <td>
                            <div className="mini-bar"><i style={{ width: `${pct}%`, background: pct < 60 ? 'var(--danger)' : 'var(--high)' }} /></div>
                            {pct}%
                          </td>
                          <td>
                            <span className={`conf-badge ${sub.confidence}`}>
                              {sub.confidence === 'auto' ? '자동' : 'AI+사람'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dense-head" style={{ marginTop: 26 }}>
            <h2>통화별 채점</h2>
            <p>낮은 점수 순 · 코칭 우선순위. 판정 근거 문장은 이의신청 처리에 그대로 사용할 수 있습니다.</p>
          </div>
          <button className="btn primary sm" style={{ marginBottom: 10 }} onClick={handleExportQuality}>
            CSV 내려받기
          </button>
          <div className="ledger">
            <div className="quality-row quality-head">
              <span>통화</span>
              <span>총점</span>
              {QUALITY_CATEGORIES.map((c) => (
                <span key={c.key}>{c.label}</span>
              ))}
              <span>최대 감점 항목</span>
              <span>판정 근거</span>
            </div>
            {sortedByTotal.map(({ call, total }) => {
              const worst = worstSubcategory(call);
              return (
                <div key={call.callId} className="quality-row">
                  <span className="cid">{call.callId}</span>
                  <span className={`tnum total ${total < 70 ? 'low' : ''}`}>{total}</span>
                  {QUALITY_CATEGORIES.map((cat) => (
                    <span key={cat.key} className="tnum">
                      {cat.subKeys.reduce((s, k) => s + (call.scores[k] ?? 0), 0)}
                    </span>
                  ))}
                  <span className="worst-tag">{QUALITY_SUBCATEGORIES[worst.key].label} {Math.round(worst.pct * 100)}%</span>
                  <span className="reason">{call.reason}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═══════ 홀드아웃 검증 ═══════ */}
      {tab === 'holdout' && (
        <>
          <div className="dense-head">
            <h2>홀드아웃 검증</h2>
            <p>분류 임계값·규칙은 조정셋(골든셋)의 실측 분포를 보고 정했습니다. 같은 세트로만 성능을 말하면 자기 데이터에 맞춘 값(in-sample)이 됩니다. 그래서 다른 시드로 생성한 별도 세트에 규칙을 그대로 적용해 재측정했습니다.</p>
          </div>

          <div className="ledger" style={{ overflowX: 'auto' }}>
            <table className="cmp-table holdout-table">
              <thead>
                <tr><th>지표</th><th>조정셋</th><th>홀드아웃</th><th>차이</th></tr>
              </thead>
              <tbody>
                {HOLDOUT_METRICS.map((m) => {
                  const diff = m.holdout - m.adjusted;
                  return (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td>{m.adjusted}</td>
                      <td>{m.holdout}</td>
                      <td className={`diff ${diff >= 0 ? 'pos' : 'neg'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="honesty-note" style={{ marginTop: 16 }}>
            <strong>한계</strong> — 홀드아웃 표본이 조정셋보다 작아 소수점 차이가 과장돼 보일 수 있습니다. 또한 STT 정확도는 녹취 없이
            합성 음성으로 대체 측정한 값이라 실제 상담 녹취의 겹침말·배경잡음·사투리·비문과는 차이가 있을 수 있습니다.
            이 수치는 파이프라인·지표 체계가 갖춰졌다는 것을 보여주는 목업이지, 최종 성능 실측치가 아닙니다.
          </div>
        </>
      )}

      {/* ═══════ FAQ 검수 ═══════ */}
      {tab === 'faq' && <FaqReviewPanel />}
    </div>
  );
}
