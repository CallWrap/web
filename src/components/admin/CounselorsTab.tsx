import { useEffect, useMemo, useState } from 'react';
import type { BackendCounselorCall, BackendCounselorDetail } from '../../api/backendTypes';
import { getCounselorCalls, getCounselorDetail, getCounselors } from '../../api/api';
import { CalendarIcon, Caret, Menu, Popover, toISODate } from '../counselor/CounselorBits';
import { GradeBars, SentimentBars } from './Charts';
import { NO_DATA } from '../../lib/format';

/* ─────────────────────────────────────────────────────────────
   상담사 관리 (Figma 21 · 지침 4절).
   좌: 상담사 목록 560 / 우: 상담사 정보 62 + 등급별 처리 | 발화 감정 232 + 최근 담당 콜

   `/api/counselors*`가 아직 없어서 목록·상세 전부 비어 있다
   (백엔드_요청_관리자화면.md 3번). API가 붙으면 이 컴포넌트는
   데이터만 갈아끼우면 되도록 형태를 그대로 만들어 뒀다.
   ───────────────────────────────────────────────────────────── */

const LIST_COLS = '92px 52px 52px 92px 84px 1fr';
const CALL_COLS = '92px 58px 66px 66px 1fr 72px 56px 64px';

const STATE_OPTIONS = ['전체', '양호', '주의', '휴식 권장'];

export interface CounselorRow {
  id: string;
  name: string;
  team: string;
  totalCalls: number;
  maliciousCalls: number;
  avgCallSec: number;
  avgReviewSec: number;
  state: '양호' | '주의' | '휴식 권장';
}

export function CounselorsTab() {
  const [stateFilter, setStateFilter] = useState('전체');
  const [statePop, setStatePop] = useState(false);
  const [selected, setSelected] = useState<CounselorRow | null>(null);
  const [rows, setRows] = useState<CounselorRow[]>([]);
  const [detail, setDetail] = useState<BackendCounselorDetail | null>(null);
  const [calls, setCalls] = useState<BackendCounselorCall[]>([]);
  const [date] = useState(() => toISODate(new Date()));
  const [busy, setBusy] = useState(false);

  async function load(nextDate = date) {
    setBusy(true);
    try {
      const response = await getCounselors(nextDate);
      const nextRows = response.map((item) => ({ ...item, team: item.team ?? '' }));
      setRows(nextRows);
      setSelected((current) => nextRows.find((row) => row.id === current?.id) ?? nextRows[0] ?? null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(date);
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setCalls([]);
      return;
    }
    let alive = true;
    Promise.all([getCounselorDetail(selected.id, date), getCounselorCalls(selected.id, date)])
      .then(([nextDetail, recentCalls]) => {
        if (!alive) return;
        setDetail(nextDetail);
        setCalls(recentCalls.items);
      });
    return () => {
      alive = false;
    };
  }, [selected, date]);

  const visibleRows = useMemo(
    () => stateFilter === '전체' ? rows : rows.filter((row) => row.state === stateFilter),
    [rows, stateFilter],
  );

  return (
    <div className="aw-body">
      <section className="cw-panel aw-list">
        <div className="cw-phead">
          <i className="cw-tick" />
          <h2>상담사</h2>
          <span className="cw-sub">{rows.length}명</span>
          <span className="cw-rule" />
          <div className="aw-fset">
            <label>상태</label>
            <span className="cw-anchor">
              <button className={`cw-filter ${statePop ? 'on' : ''}`} onClick={() => setStatePop((v) => !v)}>
                <span>{stateFilter}</span>
                <Caret />
              </button>
              {statePop && (
                <Popover onClose={() => setStatePop(false)} align="right" className="cw-filter-pop">
                  <Menu
                    options={STATE_OPTIONS}
                    value={stateFilter}
                    onPick={(v) => {
                      setStateFilter(v);
                      setStatePop(false);
                    }}
                  />
                </Popover>
              )}
            </span>
          </div>
          <button className="cw-btn primary" style={{ width: 48, padding: 0 }} onClick={() => void load()} disabled={busy}>조회</button>
        </div>

        <div className="aw-thead" style={{ gridTemplateColumns: LIST_COLS }}>
          <span>상담사</span>
          <span>처리</span>
          <span>악성</span>
          <span>평균 통화</span>
          <span>평균 검토</span>
          <span>상태</span>
        </div>

        <div className="aw-tbody">
          {visibleRows.length === 0 ? (
            <div className="aw-blank">{busy ? '상담사 현황을 불러오는 중…' : '조건에 맞는 상담사가 없습니다.'}</div>
          ) : (
            visibleRows.map((r) => (
              <button
                key={r.id}
                className={`aw-row ${selected?.id === r.id ? 'sel' : ''}`}
                style={{ gridTemplateColumns: LIST_COLS }}
                onClick={() => setSelected(r)}
              >
                <span>{r.name}</span>
                <span>{r.totalCalls}</span>
                {/* 악성 건수를 색으로 강조하지 않는다 — 전부 같은 회색(지침 4절) */}
                <span>{r.maliciousCalls}</span>
                <span>{Math.floor(r.avgCallSec / 60)}분 {`${r.avgCallSec % 60}`.padStart(2, '0')}초</span>
                <span>{Math.floor(r.avgReviewSec / 60)}:{`${r.avgReviewSec % 60}`.padStart(2, '0')}</span>
                <span>
                  <span className={`cw-badge ${r.state === '양호' ? 'good' : r.state === '주의' ? 'warn' : 'rest'}`}>
                    {r.state}
                  </span>
                </span>
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
            <h2>상담사 정보</h2>
          </div>
          <div className="aw-inforow">
            <div className="aw-infolabel" style={{ width: 78 }}>이름</div>
            <div className="aw-infoval" style={{ width: 120, flex: 'none' }}>
              <span className={detail?.name ? '' : 'cw-empty'}>{detail?.name || NO_DATA}</span>
            </div>
            <div className="aw-infolabel" style={{ width: 78 }}>소속</div>
            <div className="aw-infoval" style={{ flex: 1 }}>
              <span className={detail?.team ? '' : 'cw-empty'}>{detail?.team || NO_DATA}</span>
            </div>
            <div className="aw-infolabel" style={{ width: 88 }}>오늘 처리</div>
            <div className="aw-infoval" style={{ width: 110, flex: 'none' }}>
              <span className={detail ? '' : 'cw-empty'}>{detail ? `${detail.totalCalls}건` : NO_DATA}</span>
            </div>
            <div className="aw-infolabel" style={{ width: 104 }}>총 통화 시간</div>
            <div className="aw-infoval" style={{ width: 140, flex: 'none' }}>
              <span className={detail ? '' : 'cw-empty'}>{detail ? `${Math.floor(detail.totalCallSec / 60)}분 ${detail.totalCallSec % 60}초` : NO_DATA}</span>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, height: 232, flex: 'none' }}>
          <section className="cw-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>등급별 처리</h2>
              <span className="cw-sub">오늘</span>
            </div>
            {detail ? (
              <GradeBars counts={detail.gradeCounts} />
            ) : (
              <div className="aw-blank">등급별 처리 집계가 없습니다.</div>
            )}
          </section>

          <section className="cw-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>발화 감정 분석</h2>
              <span className="cw-sub">최근 7일</span>
            </div>
            {detail ? (
              <SentimentBars data={detail.sentimentTrend.map((point) => ({
                label: point.date.slice(5),
                value: Math.round(point.negativeScore * 100),
              }))} />
            ) : (
              <div className="aw-blank">일자별 부정 발화 집계가 없습니다.</div>
            )}
            <div className="aw-stateline">
              <span className="lb">현재 상태</span>
              {detail ? (
                <>
                  <span className={`cw-badge ${detail.state === '양호' ? 'good' : detail.state === '주의' ? 'warn' : 'rest'}`}>{detail.state}</span>
                  <span>{detail.stateReason}</span>
                </>
              ) : <span className="cw-empty">상태 정보 없음</span>}
            </div>
          </section>
        </div>

        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>최근 담당 콜</h2>
            <span className="cw-rule" />
            <button className="cw-datebtn">
              {date}
              <CalendarIcon />
            </button>
          </div>
          <div className="aw-thead" style={{ gridTemplateColumns: CALL_COLS }}>
            <span>상담번호</span>
            <span>시각</span>
            <span>민원인</span>
            <span>등급</span>
            <span className="l">요약</span>
            <span>통화</span>
            <span>검토</span>
            <span>부정 발화</span>
          </div>
          <div className="aw-tbody">
            {calls.length === 0 ? (
              <div className="aw-blank">선택일 담당 콜이 없습니다.</div>
            ) : calls.map((call) => (
              <div className="aw-row" style={{ gridTemplateColumns: CALL_COLS }} key={call.reviewId}>
                <span className="aw-no">{`${call.calledAt.slice(0, 4)}-${`${call.callNo}`.padStart(4, '0')}`}</span>
                <span>{call.calledAt.slice(11, 16)}</span>
                <span>{call.customerName ?? NO_DATA}</span>
                <span>{call.grade ?? NO_DATA}</span>
                <span className="l">{call.summary ?? ''}</span>
                <span>{call.callDurationSec != null ? `${call.callDurationSec}초` : NO_DATA}</span>
                <span>{call.reviewSec != null ? `${call.reviewSec}초` : NO_DATA}</span>
                <span>{Math.round(call.negativeScore * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
