import { useEffect, useMemo, useState } from 'react';
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
import type { BackendReviewStats } from '../api/backendTypes';
import { getReviewStats } from '../api/api';
import { GRADE_MAP } from '../api/adapt';
import { FaqReviewPanel } from '../components/FaqReviewPanel';
import { PendingMetric } from '../components/PendingMetric';
import { useCallStore } from '../store/callStore';
import { EMPTY, fieldLabel, fmtCallNo, fmtDuration, fmtTime, gradeLabel, statusLabel, summaryText, tierLabel } from '../lib/format';
import { downloadCsv } from '../lib/exportCsv';
import { ADMIN_TABS, type AdminTab } from '../lib/adminTabs';
import { QUALITY_CATEGORIES, QUALITY_SUBCATEGORIES } from '../mock/qualityScores';
import { MEASUREMENT_LABEL, GRADE_MODEL_COMPARISON, GRADE_MODEL_NOTE, PIPELINE_METRICS } from '../data/measuredMetrics';

const BASELINE_REVIEW_SEC = 210; // 기존 수기 후처리 평균 3분 30초
const LEDGER_FIELDS: FieldKey[] = ['type', 'category', 'grade', 'summary', 'followup'];

export function AdminPage() {
  const { calls, totalReviewSec } = useCallStore();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const tab: AdminTab = ADMIN_TABS.some((t) => t.key === tabParam) ? (tabParam as AdminTab) : 'overview';
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // 개요 탭 집계: DB에서 GROUP BY/AVG로 계산해서 온다 (/api/reviews/stats).
  // getQueue()가 주는 calls는 최근 100건 캡이 걸려 있어서 그걸로 세면 100건이 넘는 순간부터
  // 통계가 틀어진다 — stats가 로드되기 전까지만 기존 방식(calls 기준)으로 fallback한다.
  const [stats, setStats] = useState<BackendReviewStats | null>(null);
  useEffect(() => {
    getReviewStats()
      .then(setStats)
      .catch(() => {
        // 집계 실패는 조용히 넘어간다 — 아래 fallback(calls 기준 계산)이 그대로 쓰인다.
      });
  }, []);

  function gradeCountFrom(gradeCounts: Record<string, number>, webGrade: 'normal' | 'praise' | 'malicious') {
    return Object.entries(gradeCounts).reduce(
      (sum, [label, n]) => sum + (GRADE_MAP[label] === webGrade ? n : 0),
      0,
    );
  }

  const processed = calls.filter((c) => c.status === 'confirmed' || c.status === 'followup');
  const processedWithTime = processed.filter((c) => c.reviewSec != null);
  const avgReview = stats?.avgReviewSec != null
    ? Math.round(stats.avgReviewSec)
    : processedWithTime.length > 0
      ? Math.round(totalReviewSec / processedWithTime.length)
      : 0;
  const savingPct =
    avgReview > 0 ? Math.round((1 - avgReview / BASELINE_REVIEW_SEC) * 100) : 68;

  const maliciousCount = stats
    ? gradeCountFrom(stats.gradeCounts, 'malicious')
    : calls.filter((c) => c.grade === 'malicious').length;
  const praiseCount = stats
    ? gradeCountFrom(stats.gradeCounts, 'praise')
    : calls.filter((c) => c.grade === 'praise').length;
  const normalCount = stats
    ? gradeCountFrom(stats.gradeCounts, 'normal')
    : calls.filter((c) => c.grade === 'normal').length;
  const totalCount = stats ? stats.totalCalls : calls.length;
  const maliciousRate = Math.round((maliciousCount / Math.max(1, totalCount)) * 100);

  // 상담유형 분포 — stats가 오면 전체 기준(DB 집계), 아니면 지금 로드된 큐 기준 fallback
  const typeDist = stats
    ? Object.entries(stats.typeCounts)
        .map(([type, n]) => ({ type, n }))
        .sort((a, b) => b.n - a.n)
    : (() => {
        const typeCounts = new Map<string, number>();
        calls.forEach((c) => {
          const t = c.fields.type.value || '미분류';
          typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
        });
        return Array.from(typeCounts, ([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n);
      })();
  const typeColors = ['#4f46e5', '#0891b2', '#d97706', '#be185d', '#059669', '#7c3aed', '#0284c7', '#65a30d'];

  // 시간대별 처리량 — 오늘 자정 이후 접수된 콜을 시간별로 센 실측 집계 (/api/reviews/stats).
  // stats?.hourlyThroughput ?? {} — 백엔드 계약이 어긋나 필드가 안 오는 경우에도 전체 페이지가
  // 죽지 않게 방어한다(Object.entries(undefined)는 예외를 던진다).
  const hourlyThroughput = Object.entries(stats?.hourlyThroughput ?? {})
    .map(([h, n]) => ({ h: `${h}시`, n, hourNum: Number(h) }))
    .sort((a, b) => a.hourNum - b.hourNum);

  // 상담사별 악성콜 밸런싱 — 상담사 이름별 악성콜 확정 건수 실측 집계.
  const agentBalance = Object.entries(stats?.maliciousByCounselor ?? {})
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n);

  // 검토 대기 중 — AI 분석은 끝났지만 상담사 확인이 아직 안 된 콜.
  const inReview = calls.filter((c) => c.status === 'review' || c.status === 'analyzing').length;

  const avgMM = Math.floor(avgReview / 60);
  const avgSS = (avgReview % 60).toString().padStart(2, '0');

  const filteredCalls = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter(
      (c) =>
        c.callId.toLowerCase().includes(q) ||
        summaryText(c.fields.summary.value).toLowerCase().includes(q) ||
        c.fields.type.value.toLowerCase().includes(q),
    );
  }, [calls, query]);

  function handleExportLedger() {
    downloadCsv(
      `aftercall-상담대장-${new Date().toISOString().slice(0, 10)}.csv`,
      ['통화ID', '상담유형', '상담분류', '상담등급', '요약', '상태', '검토시간(초)'],
      filteredCalls.map((c) => [
        c.callId,
        c.fields.type.value,
        c.fields.category.value,
        gradeLabel[c.grade],
        summaryText(c.fields.summary.value),
        statusLabel[c.status],
        c.reviewSec ?? '',
      ]),
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
          전체 <b>{totalCount}</b>
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
                수기 3:30 → 자동화 후 {avgReview > 0 ? `${avgMM}:${avgSS}` : EMPTY.duration}
              </div>
            </div>
          </div>

          <div className="metric-row four">
            <div className="metric">
              <div className="label">오늘 처리 건수</div>
              <div className="value">{processed.length || calls.length}</div>
              <div className="sub">확정 + 후속 처리 포함</div>
            </div>
            <div className="metric">
              <div className="label">평균 검토 시간</div>
              <div className="value">
                {avgReview > 0 ? (
                  <>
                    {avgMM}:{avgSS}
                  </>
                ) : (
                  EMPTY.duration
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
              <div className="label">검토 대기 중</div>
              <div className="value">
                {inReview}
                <small> 건</small>
              </div>
              <div className="sub">AI 분석 완료 후 상담사 확인 대기</div>
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
              {typeDist.length > 0 ? (
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
              ) : (
                <p className="choice-hint">아직 처리된 콜이 없습니다.</p>
              )}
            </div>

            <div className="chart-card">
              <h3>상담사별 악성콜 밸런싱</h3>
              <div className="sub">특정 상담사 편중 방지 모니터링</div>
              {agentBalance.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={agentBalance} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                    <Bar dataKey="n" radius={[5, 5, 0, 0]} fill="var(--danger)" name="악성콜" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="choice-hint">악성콜로 확정된 건이 아직 없습니다.</p>
              )}
            </div>

            <div className="chart-card wide">
              <h3>시간대별 처리량</h3>
              <div className="sub">AI 후처리 자동화로 피크 시간 처리 지연 완화 (오늘 기준)</div>
              {hourlyThroughput.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={hourlyThroughput} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
                    <XAxis dataKey="h" tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                    <Line type="monotone" dataKey="n" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3 }} name="처리 건수" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="choice-hint">오늘 접수된 콜이 아직 없습니다.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════ 측정 결과 ═══════ */}
      {tab === 'measure' && (
        <>
          <div className="dense-head">
            <h2>측정 결과</h2>
            <p>{MEASUREMENT_LABEL} — 실제 상담 녹취가 아니라 합성 음성·생성 대본 기준입니다. 실제 상담 녹취로 재검증되기 전까지 참고치로만 사용해 주세요.</p>
          </div>

          <div className="measure-grid">
            {PIPELINE_METRICS.map((m) => (
              <div key={m.key} className="metric measure-metric">
                <div className="label">{m.label}</div>
                <div className="value">
                  {m.macroF1}
                  <small> Macro-F1</small>
                </div>
                <div className="sub">{m.note}</div>
              </div>
            ))}
          </div>

          <div className="dense-head" style={{ marginTop: 26 }}>
            <h2>상담등급 판정 모델 선정 비교</h2>
            <p>183건 5-fold 교차검증 · {MEASUREMENT_LABEL}</p>
          </div>
          <div className="ledger" style={{ overflowX: 'auto' }}>
            <table className="cmp-table">
              <thead>
                <tr><th>모델</th><th>파라미터</th><th>Macro-F1</th><th>악성 Recall</th><th>채택</th></tr>
              </thead>
              <tbody>
                {GRADE_MODEL_COMPARISON.map((r) => (
                  <tr key={r.model}>
                    <td>{r.model}</td>
                    <td>{r.params}</td>
                    <td>{r.macroF1.toFixed(4)}</td>
                    <td>{r.maliciousRecall.toFixed(4)}</td>
                    <td>{r.adopted ? '✓ 채택' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="honesty-note" style={{ marginTop: 12 }}>{GRADE_MODEL_NOTE}</div>

          <div className="dense-head" style={{ marginTop: 26 }}>
            <h2>규칙 기반 vs LLM 자동 추출</h2>
            <p>같은 전사·같은 골든셋 정답으로 채점해 판단형·분류형 필드의 정확도를 비교하는 절차입니다.</p>
          </div>
          <div className="measure-grid">
            <PendingMetric
              label="판단형 필드 (등급·후속 처리)"
              plan="규칙 기반 베이스라인 구현과 골든셋 정답이 준비되면 LLM 대비 정확도 비교가 여기 표시됩니다."
            />
            <PendingMetric
              label="분류형 필드 (유형·분류, Macro-F1)"
              plan="규칙 기반 베이스라인 구현과 골든셋 정답이 준비되면 LLM 대비 Macro-F1 비교가 여기 표시됩니다."
            />
          </div>
        </>
      )}

      {/* ═══════ 등급·분포 ═══════ */}
      {tab === 'grade' && (
        <>
          <div className="dense-head">
            <h2>상담등급 판정 성능</h2>
            <p>{MEASUREMENT_LABEL}</p>
          </div>
          <div className="measure-grid" style={{ marginBottom: 26 }}>
            {PIPELINE_METRICS.filter((m) => m.key === 'grade').map((m) => (
              <div key={m.key} className="metric measure-metric">
                <div className="label">{m.label}</div>
                <div className="value">
                  {m.macroF1}
                  <small> Macro-F1</small>
                </div>
                <div className="sub">{m.note}</div>
              </div>
            ))}
            <PendingMetric
              label="상담등급 혼동행렬"
              plan="골든셋이 구축되면 정답(행) vs 자동판정(열) 혼동행렬이 여기 표시됩니다."
            />
          </div>

          <div className="dense-head">
            <h2>상담유형 분포</h2>
            <p>오늘 처리된 콜 기준 실제 분포입니다. sr_type.py(SR유형 8종) 모델이 analyze()에 병합되어 반영됩니다.</p>
          </div>
          <div className="chart-grid">
            <div className="chart-card wide">
              <h3>상담유형 분포</h3>
              <div className="sub">오늘 처리된 콜 기준</div>
              {typeDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={typeDist} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" vertical={false} />
                    <XAxis dataKey="type" tick={{ fontSize: 10.5, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                    <Bar dataKey="n" radius={[5, 5, 0, 0]} name="건수" isAnimationActive={false}>
                      {typeDist.map((_, i) => (
                        <Cell key={i} fill={typeColors[i % typeColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="choice-hint">아직 처리된 콜이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="measure-grid" style={{ marginTop: 26 }}>
            <PendingMetric
              label="골든셋 vs 실제 모집단 분포 비교"
              plan="골든셋이 구축되면 희소 클래스 과표집 표본 분포와 실제 모집단 분포(불균형) 대조가 여기 표시됩니다."
            />
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
                        {open ? '▾' : '▸'} {fmtCallNo(c.callNo)}
                        <small>{fmtTime(c.startedAt)}</small>
                      </span>
                      <span>{c.fields.type.value || EMPTY.choiceValue}</span>
                      <span>{c.fields.category.value || EMPTY.choiceValue}</span>
                      <span className={`badge-pill grade-${c.grade}`}>{gradeLabel[c.grade]}</span>
                      <span className="ellipsis">{summaryText(c.fields.summary.value) || EMPTY.summary}</span>
                      <span className="tier-dots">
                        {tiers.map((t, i) => (
                          <span key={i} className={`dot ${t}`} />
                        ))}
                      </span>
                      <span>{statusLabel[c.status]}</span>
                      <span className="tnum">{fmtDuration(c.reviewSec)}</span>
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
                                {k === 'followup' ? (c.fields[k].value ? '필요' : '불필요') : String(c.fields[k].value || EMPTY.fieldValue)}
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
            <strong> 채점 로직은 아직 파이프라인에 연동되지 않았습니다.</strong> 아래는 배점 구조만 반영한 것이며,
            "기준표를 그대로 구현했다"는 표현은 쓰지 않습니다 — 배점만 공식, 통화별 채점 결과는 아직 없습니다.
          </div>

          <div className="dense-head" style={{ marginTop: 20 }}>
            <h2>배점 구조</h2>
            <p>4대분류 100점 · 11소분류</p>
          </div>
          <div className="quality-sub-card">
            <table className="cmp-table sub-table">
              <thead>
                <tr><th>대분류</th><th>소분류</th><th>배점</th><th>채점 방식</th></tr>
              </thead>
              <tbody>
                {QUALITY_CATEGORIES.flatMap((cat) =>
                  cat.subKeys.map((key, i) => {
                    const sub = QUALITY_SUBCATEGORIES[key];
                    return (
                      <tr key={key}>
                        {i === 0 && (
                          <td rowSpan={cat.subKeys.length}>
                            {cat.label} ({cat.max}점)
                          </td>
                        )}
                        <td>{sub.label}</td>
                        <td>{sub.max}</td>
                        <td>
                          <span className={`conf-badge ${sub.confidence}`}>
                            {sub.confidence === 'auto' ? '자동' : 'AI+사람'}
                          </span>
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>

          <div className="measure-grid" style={{ marginTop: 26 }}>
            <PendingMetric
              label="통화별 채점 결과"
              plan="채점 로직이 파이프라인에 연동되고 실제 상담 녹취로 검증되면 통화별 총점·항목별 점수·판정 근거가 여기 표시됩니다."
            />
          </div>
        </>
      )}

      {/* ═══════ 홀드아웃 검증 ═══════ */}
      {tab === 'holdout' && (
        <>
          <div className="dense-head">
            <h2>홀드아웃 검증</h2>
            <p>분류 임계값·규칙을 조정셋(골든셋)의 실측 분포만 보고 정하면 자기 데이터에 맞춘 값(in-sample)이 됩니다. 다른 시드로 생성한 별도 세트에 규칙을 그대로 적용해 재측정하는 절차입니다.</p>
          </div>

          <div className="measure-grid">
            <PendingMetric
              label="조정셋 대비 홀드아웃 성능"
              plan="별도 시드로 홀드아웃 세트가 구축되면 조정셋과 동일 지표로 재측정한 대조표가 여기 표시됩니다."
            />
            <PendingMetric
              label="STT 정확도"
              plan="실제 상담 녹취로 재검증되면(현재는 합성 음성 기준) 정확도가 여기 표시됩니다. 실제 녹취는 겹침말·배경잡음·사투리·비문이 있어 합성 음성과 다를 수 있습니다."
            />
          </div>

          <div className="honesty-note" style={{ marginTop: 16 }}>
            <strong>현재 상태</strong> — {MEASUREMENT_LABEL}만 확보돼 있고, 별도 시드의 홀드아웃 세트는 아직 구축 전입니다.
            "측정 결과" 탭의 수치도 이 홀드아웃 검증을 거치지 않은 조정셋 기준 값입니다.
          </div>
        </>
      )}

      {/* ═══════ FAQ 검수 ═══════ */}
      {tab === 'faq' && <FaqReviewPanel />}
    </div>
  );
}
