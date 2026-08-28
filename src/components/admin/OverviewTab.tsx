import { useEffect, useMemo, useState } from 'react';
import type {
  BackendCounselorSummary,
  BackendCustomerSummary,
  BackendReviewStats,
} from '../../api/backendTypes';
import { getCounselors, getCustomers, getFaqEntries } from '../../api/api';
import { CalendarIcon, CalendarPop, Popover, toISODate } from '../counselor/CounselorBits';
import { Donut, GRADE_COLOR, RankedBars, StackedBars, type Slice } from './Charts';
import { buildOverviewAlerts } from './overviewAlerts';

/* ─────────────────────────────────────────────────────────────
   개요 탭 (Figma 17 · 지침 2절).
   좌: 시간대별 처리 추이(394) + 상담사별 처리 건수(394)
   우: 알림(394) + 상담유형별 도넛 + 중분류별 도넛   폭 352
   ───────────────────────────────────────────────────────────── */

function monthStartISO(): string {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** 지침 2절: 넘치는 칸만 스크롤. 데이터가 없으면 지어내지 않고 비어 있음을 알린다. */
function Blank({ text }: { text: string }) {
  return <div className="aw-blank">{text}</div>;
}

export function OverviewTab({ stats }: { stats: BackendReviewStats | null }) {
  const [from, setFrom] = useState(monthStartISO);
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [datePop, setDatePop] = useState<'from' | 'to' | null>(null);
  const [counselors, setCounselors] = useState<BackendCounselorSummary[]>([]);
  const [customers, setCustomers] = useState<BackendCustomerSummary[]>([]);
  const [draftFaqCount, setDraftFaqCount] = useState(0);

  useEffect(() => {
    let alive = true;
    getCounselors(to)
      .then((items) => {
        if (alive) setCounselors(items);
      })
      .catch(() => {
        if (alive) setCounselors([]);
      });
    return () => {
      alive = false;
    };
  }, [to]);

  // 알림 패널 재료. 상담사 현황은 위에서 이미 받으므로 나머지 둘만 더 받는다.
  useEffect(() => {
    let alive = true;
    Promise.all([getCustomers(), getFaqEntries('DRAFT')])
      .then(([customerList, drafts]) => {
        if (!alive) return;
        setCustomers(customerList.items);
        setDraftFaqCount(drafts.length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const counselorCounts = useMemo(
    () => counselors.map((item) => ({ label: item.name, value: item.totalCalls })),
    [counselors],
  );

  const alerts = useMemo(
    () => buildOverviewAlerts(stats, counselors, customers, draftFaqCount),
    [stats, counselors, customers, draftFaqCount],
  );

  // 시간대별 — 등급(악성/칭찬/일반)으로 쪼갠 3색 누적 막대(피그마 17).
  // 처리가 없던 시간대는 집계에 행이 없어서 그냥 빼면 09·11·13처럼 띄엄띄엄 남은 막대가
  // 패널 폭을 나눠 가져 "그 시간대만 일했다"는 그림이 된다. 최소~최대 시각을 채워 빈 칸을 만든다.
  const hourly = useMemo(() => {
    const rows = stats?.hourlyThroughput ?? [];
    if (rows.length === 0) return [];
    const byHour = new Map(rows.map((r) => [r.hour, r]));
    const first = Math.min(...rows.map((r) => r.hour));
    const last = Math.max(...rows.map((r) => r.hour));
    return Array.from({ length: last - first + 1 }, (_, i) => {
      const hour = first + i;
      const row = byHour.get(hour);
      return {
        label: String(hour).padStart(2, '0'),
        normal: row?.normal ?? 0,
        praise: row?.praise ?? 0,
        malicious: row?.malicious ?? 0,
      };
    });
  }, [stats]);

  const typeSlices: Slice[] = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.typeCounts ?? {})
      .map(([label, value]) => ({ label, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const categorySlices: Slice[] = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.categoryCounts ?? {})
      .map(([label, value]) => ({ label, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  return (
    <div className="aw-body">
      <div className="aw-col grow">
        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>시간대별 처리 추이</h2>
            <span className="cw-rule" />
            {hourly.length > 0 && (
              <span className="aw-legend">
                <span><i style={{ background: GRADE_COLOR.malicious }} />악성콜</span>
                <span><i style={{ background: GRADE_COLOR.praise }} />칭찬콜</span>
                <span><i style={{ background: GRADE_COLOR.normal }} />일반콜</span>
              </span>
            )}
            <span className="cw-sub">기간</span>
            <span className="cw-anchor">
              <button className={`cw-datebtn ${datePop === 'from' ? 'on' : ''}`} onClick={() => setDatePop(datePop === 'from' ? null : 'from')}>
                {from}
                <CalendarIcon />
              </button>
              {datePop === 'from' && (
                <Popover onClose={() => setDatePop(null)} align="right">
                  <CalendarPop value={from} from={from} to={to} onPick={setFrom} onApply={() => setDatePop(null)} />
                </Popover>
              )}
            </span>
            <span className="cw-tilde">~</span>
            <span className="cw-anchor">
              <button className={`cw-datebtn ${datePop === 'to' ? 'on' : ''}`} onClick={() => setDatePop(datePop === 'to' ? null : 'to')}>
                {to}
                <CalendarIcon />
              </button>
              {datePop === 'to' && (
                <Popover onClose={() => setDatePop(null)} align="right">
                  <CalendarPop value={to} from={from} to={to} onPick={setTo} onApply={() => setDatePop(null)} />
                </Popover>
              )}
            </span>
          </div>
          {hourly.length === 0 ? (
            <Blank text="시간대별 집계가 없습니다." />
          ) : (
            <StackedBars data={hourly} />
          )}
        </section>

        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>상담사별 처리 건수</h2>
            <span className="cw-rule" />
            <span className="cw-sub">{toISODate(new Date())}</span>
            <span className="cw-sub">정렬</span>
            <b style={{ fontSize: 12 }}>처리 많은 순</b>
          </div>
          {counselorCounts.length === 0
            ? <Blank text="상담사별 처리 건수 집계가 없습니다." />
            : <RankedBars data={counselorCounts} />}
        </section>
      </div>

      <div className="aw-col aw-side">
        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>알림</h2>
            <span className="cw-rule" />
            <span className="aw-count-red">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <Blank text="알림 정보가 없습니다." />
          ) : (
            <div className="aw-alerts">
              {alerts.map((a) => (
                <div className="aw-alert" key={a.id}>
                  <span className={`aw-alert-tag ${a.kind === '상담사' ? 'counselor' : a.kind === '민원인' ? 'customer' : 'faq'}`}>
                    {a.kind}
                  </span>
                  <span className="aw-alert-text">{a.text}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>상담유형별</h2>
            <span className="cw-sub">전체</span>
          </div>
          {typeSlices.length === 0 ? <Blank text="유형 집계가 없습니다." /> : <Donut slices={typeSlices} />}
        </section>

        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>중분류별</h2>
            <span className="cw-sub">전체</span>
          </div>
          {categorySlices.length === 0 ? <Blank text="중분류 집계가 없습니다." /> : <Donut slices={categorySlices} />}
        </section>
      </div>
    </div>
  );
}
