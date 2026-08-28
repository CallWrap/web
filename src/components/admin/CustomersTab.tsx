import { useEffect, useState } from 'react';
import type { BackendCustomerCall, BackendCustomerDetail } from '../../api/backendTypes';
import { getCustomerCalls, getCustomerDetail, getCustomers } from '../../api/api';
import { CalendarIcon, SearchIcon, toISODate } from '../counselor/CounselorBits';
import { GradeBars, MonthBars } from './Charts';
import { NO_DATA } from '../../lib/format';
import { CallDetailModal } from './CallDetailModal';

/* ─────────────────────────────────────────────────────────────
   민원인 관리 (Figma 22 · 지침 5절).
   상담사 관리와 1:1로 대응하는 구성이다.
     상담사 정보 → 민원인 정보 (h 62)
     등급별 처리 | 발화 감정 → 등급별 이력 | 문의 추이 (h 232)
     최근 담당 콜 → 상담 이력

   `/api/customers*`가 아직 없어 목록·상세 전부 비어 있다
   (백엔드_요청_관리자화면.md 4번).
   ───────────────────────────────────────────────────────────── */

const LIST_COLS = '72px 116px 1fr 52px 52px 76px';
const HIST_COLS = '92px 108px 66px 66px 1fr 72px 88px';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  org: string;
  totalCalls: number;
  maliciousCalls: number;
  lastCalledAt: string;
}

export function CustomersTab() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [detail, setDetail] = useState<BackendCustomerDetail | null>(null);
  const [calls, setCalls] = useState<BackendCustomerCall[]>([]);
  const [busy, setBusy] = useState(false);
  const [detailOf, setDetailOf] = useState<BackendCustomerCall | null>(null);

  async function load(nextQuery = query) {
    setBusy(true);
    try {
      const response = await getCustomers(nextQuery);
      const nextRows = response.items.map((item) => ({
        ...item,
        name: item.name ?? '',
        phone: item.phone ?? '',
        org: item.org ?? '',
        lastCalledAt: item.lastCalledAt ?? '',
      }));
      setRows(nextRows);
      setSelected((current) => nextRows.find((row) => row.id === current?.id) ?? nextRows[0] ?? null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load('');
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setCalls([]);
      return;
    }
    let alive = true;
    Promise.all([getCustomerDetail(selected.id), getCustomerCalls(selected.id)]).then(([nextDetail, history]) => {
      if (!alive) return;
      setDetail(nextDetail);
      setCalls(history.items);
    });
    return () => {
      alive = false;
    };
  }, [selected]);

  return (
    <div className="aw-body">
      <section className="cw-panel aw-list">
        <div className="cw-phead">
          <i className="cw-tick" />
          <h2>민원인</h2>
          <span className="cw-sub">{rows.length}명</span>
          <span className="cw-rule" />
          <span className="cw-search" style={{ width: 186 }}>
            <input
              placeholder="이름 · 전화번호 · 소속"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <SearchIcon />
          </span>
          <button className="cw-btn primary" style={{ width: 48, padding: 0 }} onClick={() => void load()} disabled={busy}>조회</button>
        </div>

        <div className="aw-thead" style={{ gridTemplateColumns: LIST_COLS }}>
          <span>이름</span>
          <span>전화번호</span>
          <span className="l">소속</span>
          <span>상담</span>
          <span>악성</span>
          <span>최근 상담</span>
        </div>

        <div className="aw-tbody">
          {rows.length === 0 ? (
            <div className="aw-blank">{busy ? '민원인을 불러오는 중…' : '조건에 맞는 민원인이 없습니다.'}</div>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                className={`aw-row ${selected?.id === r.id ? 'sel' : ''}`}
                style={{ gridTemplateColumns: LIST_COLS }}
                onClick={() => setSelected(r)}
              >
                <span>{r.name}</span>
                <span>{r.phone}</span>
                <span className="l">{r.org}</span>
                <span>{r.totalCalls}</span>
                <span>{r.maliciousCalls}</span>
                <span>{r.lastCalledAt ? r.lastCalledAt.slice(5, 10) : NO_DATA}</span>
              </button>
            ))
          )}
        </div>

        <div className="aw-tfoot">총 {rows.length}명</div>
      </section>

      <div className="aw-detail">
        <section className="cw-panel aw-info">
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>민원인 정보</h2>
          </div>
          <div className="aw-inforow">
            <div className="aw-infolabel" style={{ width: 78 }}>이름</div>
            <div className="aw-infoval" style={{ width: 120, flex: 'none' }}>
              <span className={detail?.name ? '' : 'cw-empty'}>{detail?.name || NO_DATA}</span>
            </div>
            <div className="aw-infolabel" style={{ width: 88 }}>전화번호</div>
            <div className="aw-infoval" style={{ width: 150, flex: 'none' }}>
              <span className={detail?.phone ? '' : 'cw-empty'}>{detail?.phone || NO_DATA}</span>
            </div>
            <div className="aw-infolabel" style={{ width: 78 }}>소속</div>
            <div className="aw-infoval" style={{ flex: 1 }}>
              <span className={detail?.org ? '' : 'cw-empty'}>{detail?.org || NO_DATA}</span>
            </div>
            <div className="aw-infolabel" style={{ width: 88 }}>최초 상담</div>
            <div className="aw-infoval" style={{ width: 130, flex: 'none' }}>
              <span className={detail?.firstCalledAt ? '' : 'cw-empty'}>{detail?.firstCalledAt?.slice(0, 10) || NO_DATA}</span>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, height: 232, flex: 'none' }}>
          <section className="cw-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>등급별 이력</h2>
              <span className="cw-sub">누적</span>
            </div>
            {detail ? (
              <GradeBars counts={detail.gradeCounts} />
            ) : (
              <div className="aw-blank">등급별 이력 집계가 없습니다.</div>
            )}
          </section>

          <section className="cw-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>문의 추이</h2>
              <span className="cw-sub">최근 6개월</span>
            </div>
            {detail ? (
              <MonthBars data={detail.monthlyCounts.map((point) => ({
                label: point.month.slice(5),
                total: point.total,
                malicious: point.malicious,
                praise: point.praise,
              }))} />
            ) : (
              <div className="aw-blank">월별 문의 집계가 없습니다.</div>
            )}
            <div className="aw-stateline">
              <span className="lb">응대 참고</span>
              <span className={detail?.topSubcategories[0] ? '' : 'cw-empty'}>
                {detail?.topSubcategories[0]
                  ? `주요 문의 · ${detail.topSubcategories[0].label} ${detail.topSubcategories[0].count}건`
                  : '주요 문의 정보 없음'}
              </span>
            </div>
          </section>
        </div>

        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>상담 이력</h2>
            <span className="cw-rule" />
            <button className="cw-datebtn">
              {toISODate(new Date())}
              <CalendarIcon />
            </button>
          </div>
          <div className="aw-thead" style={{ gridTemplateColumns: HIST_COLS }}>
            <span>상담번호</span>
            <span>일시</span>
            <span>상담사</span>
            <span>등급</span>
            <span className="l">요약</span>
            <span>통화</span>
            <span />
          </div>
          <div className="aw-tbody">
            {calls.length === 0 ? (
              <div className="aw-blank">상담 이력이 없습니다.</div>
            ) : calls.map((call) => (
              <div className="aw-row" style={{ gridTemplateColumns: HIST_COLS }} key={call.reviewId}>
                <span className="aw-no">{`${call.calledAt.slice(0, 4)}-${`${call.callNo}`.padStart(4, '0')}`}</span>
                <span>{call.calledAt.slice(5, 16).replace('T', ' ')}</span>
                <span>{call.counselorName}</span>
                <span>{call.grade ?? NO_DATA}</span>
                <span className="l">{call.summary ?? ''}</span>
                <span>{call.callDurationSec != null ? `${call.callDurationSec}초` : NO_DATA}</span>
                <span><button className="cw-btn" style={{ width: 76, padding: 0 }} onClick={() => setDetailOf(call)}>상세 보기</button></span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {detailOf && (
        <CallDetailModal
          callId={detailOf.reviewId}
          title={`${detailOf.calledAt.slice(0, 4)}-${`${detailOf.callNo}`.padStart(4, '0')}`}
          subtitle={detailOf.calledAt.slice(11, 16)}
          onClose={() => setDetailOf(null)}
        />
      )}
    </div>
  );
}
