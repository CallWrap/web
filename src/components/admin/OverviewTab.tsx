import { useMemo, useState } from 'react';
import type { BackendReviewStats } from '../../api/backendTypes';
import { CalendarIcon, CalendarPop, Popover, toISODate } from '../counselor/CounselorBits';
import { Donut, GRADE_COLOR, RankedBars, type Slice } from './Charts';

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

  // 시간대별 — 집계가 시간대 총계만 오고 등급별로 쪼개져 있지 않다.
  // 총계를 특정 등급 색으로 칠하면 "전부 그 등급"으로 읽히므로 중립 남색 한 가지로 그리고
  // 등급 범례도 띄우지 않는다(백엔드_요청사항_관리자화면.md 1번).
  const hourly = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.hourlyThroughput ?? {})
      .map(([h, v]) => ({ label: String(h).padStart(2, '0'), value: Number(v) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [stats]);

  const typeSlices: Slice[] = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.typeCounts ?? {})
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
                <span><i style={{ background: GRADE_COLOR.normal }} />처리 건수</span>
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
            <RankedBars data={hourly} color="#1f4b99" />
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
          {/* 집계 API가 상담사별 "악성콜 수"만 주고 총 처리 건수를 주지 않는다.
              악성 수를 처리 건수 자리에 그리면 다른 숫자가 되므로 비워 둔다. */}
          <Blank text="상담사별 처리 건수 집계가 없습니다." />
        </section>
      </div>

      <div className="aw-col aw-side">
        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>알림</h2>
            <span className="cw-rule" />
            <span className="aw-count-red">0</span>
          </div>
          <Blank text="알림 정보가 없습니다." />
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
          {/* 집계 API에 중분류(consultation_category) 항목이 없다 */}
          <Blank text="중분류 집계가 없습니다." />
        </section>
      </div>
    </div>
  );
}
