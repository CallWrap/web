import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCallStore } from '../store/callStore';
import { useReviewStream } from '../hooks/useReviewStream';
import { NO_DATA, fmtCallSeq } from '../lib/format';
import { AppTopbar } from '../components/AppTopbar';
import { CallDetailPane } from '../components/counselor/CallDetailPane';
import {
  CalendarIcon,
  CalendarPop,
  Caret,
  Menu,
  Popover,
  ProgressBadge,
  progressOf,
  PROGRESS_STEPS,
  toISODate,
  type Progress,
} from '../components/counselor/CounselorBits';
import '../styles.counselor.css';

/* ─────────────────────────────────────────────────────────────
   상담사 통합 검토 화면 — Figma "14 상담사 통합 검토 화면 / 15 오버레이 동작".
   기존 /queue(검토 대기열)와 /review/:id(콜 검토)를 한 화면으로 합쳤다.
   좌측 목록에서 콜을 고르면 우측이 그 콜의 내용으로 채워진다.
   우측 상세는 관리자 `상세 보기` 팝업과 같은 컴포넌트(CallDetailPane)를 쓴다.
   ───────────────────────────────────────────────────────────── */

function todayISO(): string {
  return toISODate(new Date());
}

function monthStartISO(): string {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function CounselorPage() {
  const { callId: routeCallId } = useParams();

  const calls = useCallStore((s) => s.calls);
  const loaded = useCallStore((s) => s.loaded);
  const loadError = useCallStore((s) => s.loadError);
  const loadQueue = useCallStore((s) => s.loadQueue);
  const refreshQueue = useCallStore((s) => s.refreshQueue);

  useReviewStream();

  // ── 목록 조건 ──────────────────────────────────────────
  // 기간은 `조회`를 눌러야 반영된다. 상태 필터는 고르는 즉시 걸린다(지침 4절).
  const [draftFrom, setDraftFrom] = useState(monthStartISO);
  const [draftTo, setDraftTo] = useState(todayISO);
  const [statusFilter, setStatusFilter] = useState<'전체' | Progress>('전체');
  const [datePop, setDatePop] = useState<'from' | 'to' | null>(null);
  const [filterPop, setFilterPop] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(routeCallId ?? null);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // ── 목록 필터링 ────────────────────────────────────────
  const rows = useMemo(() => {
    // 기간은 서버가 이미 걸러서 준다(조회 버튼 → refreshQueue). 여기선 상태만 거른다.
    return calls.filter((c) => statusFilter === '전체' || progressOf(c.status) === statusFilter);
  }, [calls, statusFilter]);

  // 첫 진입 시 목록의 첫 콜을 자동으로 연다 — 우측이 빈 채로 남지 않게.
  useEffect(() => {
    if (selectedId || rows.length === 0) return;
    setSelectedId(rows[0].callId);
  }, [rows, selectedId]);

  const counters = useMemo(() => {
    const c: Record<Progress, number> = { '검토 대기': 0, '진행 중': 0, 완료: 0 };
    calls.forEach((call) => (c[progressOf(call.status)] += 1));
    return c;
  }, [calls]);

  return (
    <div className="cw">
      {/* ── 상단바 (h 44) ───────────────────────────────── */}
      <AppTopbar counters={counters} />

      <div className="cw-body">
        {/* ── 좌측 목록 (w 560) ─────────────────────────── */}
        <section className="cw-panel cw-list">
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>목록</h2>
            <span className="cw-rule" />

            <div className="cw-range">
              <span className="cw-anchor">
                <button
                  className={`cw-datebtn ${datePop === 'from' ? 'on' : ''}`}
                  onClick={() => setDatePop(datePop === 'from' ? null : 'from')}
                >
                  {draftFrom}
                  <CalendarIcon />
                </button>
                {datePop === 'from' && (
                  <Popover onClose={() => setDatePop(null)}>
                    <CalendarPop
                      value={draftFrom}
                      from={draftFrom}
                      to={draftTo}
                      onPick={setDraftFrom}
                      onApply={() => setDatePop(null)}
                    />
                  </Popover>
                )}
              </span>

              <span className="cw-tilde">~</span>

              <span className="cw-anchor">
                <button
                  className={`cw-datebtn ${datePop === 'to' ? 'on' : ''}`}
                  onClick={() => setDatePop(datePop === 'to' ? null : 'to')}
                >
                  {draftTo}
                  <CalendarIcon />
                </button>
                {datePop === 'to' && (
                  <Popover onClose={() => setDatePop(null)} align="right">
                    <CalendarPop
                      value={draftTo}
                      from={draftFrom}
                      to={draftTo}
                      onPick={setDraftTo}
                      onApply={() => setDatePop(null)}
                    />
                  </Popover>
                )}
              </span>
            </div>

            <button
              className="cw-btn primary"
              style={{ width: 48, padding: 0 }}
              // 서버에 기간을 넘겨 다시 받아온다 (size=100 밖의 과거 콜도 나오도록)
              onClick={() => void refreshQueue({ from: draftFrom, to: draftTo })}
            >
              조회
            </button>

            <span className="cw-anchor">
              <button className={`cw-filter ${filterPop ? 'on' : ''}`} onClick={() => setFilterPop((v) => !v)}>
                {/* 글자칸 폭을 가장 긴 항목("검토 대기")에 고정 — 어떤 값을 골라도
                    글자 시작점과 삼각형 위치가 그대로다 */}
                <span>{statusFilter}</span>
                <Caret />
              </button>
              {filterPop && (
                <Popover onClose={() => setFilterPop(false)} align="right" className="cw-filter-pop">
                  <Menu
                    options={['전체', ...PROGRESS_STEPS] as const}
                    value={statusFilter}
                    onPick={(v) => {
                      setStatusFilter(v);
                      setFilterPop(false);
                    }}
                  />
                </Popover>
              )}
            </span>
          </div>

          <div className="cw-thead">
            <span>상담번호</span>
            <span>민원인</span>
            <span>소속</span>
            <span>전화번호</span>
            <span>상태</span>
          </div>

          <div className="cw-tbody">
            {loadError ? (
              <div className="cw-blank">목록을 불러오지 못했습니다 · {loadError}</div>
            ) : !loaded ? (
              <div className="cw-blank">목록을 불러오는 중…</div>
            ) : rows.length === 0 ? (
              <div className="cw-blank">조건에 맞는 상담이 없습니다.</div>
            ) : (
              rows.map((c) => (
                <button
                  key={c.callId}
                  className={`cw-row ${c.callId === selectedId ? 'sel' : ''}`}
                  onClick={() => setSelectedId(c.callId)}
                >
                  <span>{fmtCallSeq(c)}</span>
                  <span className={c.complainant?.name ? '' : 'cw-muted'}>{c.complainant?.name || NO_DATA}</span>
                  <span className={c.complainant?.org ? '' : 'cw-muted'}>{c.complainant?.org || NO_DATA}</span>
                  <span className={c.complainant?.phone ? '' : 'cw-muted'}>{c.complainant?.phone || NO_DATA}</span>
                  <span><ProgressBadge value={progressOf(c.status)} /></span>
                </button>
              ))
            )}
          </div>

          <div className="cw-tfoot">
            <span className="cw-rule" />
            <span>총 {calls.length}건 중 1-{rows.length}</span>
          </div>
        </section>

        {/* ── 우측 상세 — 관리자 `상세 보기` 팝업과 같은 컴포넌트 ─── */}
        <CallDetailPane callId={selectedId} onSaved={() => undefined} />
      </div>

    </div>
  );
}
