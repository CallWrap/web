import { useMemo, useState } from 'react';
import type { Call } from '../../api/types';
import { useCallStore } from '../../store/callStore';
import { CONSULTATION_GRADES, CONSULTATION_TYPES } from '../../lib/classificationOptions';
import { NO_DATA, fmtCallSeq, fmtTime, gradeLabel } from '../../lib/format';
import { downloadCsv } from '../../lib/exportCsv';
import {
  CalendarIcon,
  CalendarPop,
  Caret,
  Menu,
  Popover,
  ProgressBadge,
  progressOf,
  PROGRESS_STEPS,
  SearchIcon,
  toISODate,
} from '../counselor/CounselorBits';
import { CallDetailModal } from './CallDetailModal';

/* ─────────────────────────────────────────────────────────────
   상담대장 (Figma 18 · 지침 3절).
   목록/상세가 아니라 전체 폭 표 하나. 행을 눌러도 펼쳐지지 않고,
   `상세 보기` 버튼이 프레임 24 팝업을 연다.
   ───────────────────────────────────────────────────────────── */

/** 헤더와 행이 이 배열을 공유한다 — 컬럼명과 값이 어긋날 수 없게(지침 3절) */
const COLS = '88px 58px 62px 112px 60px 320px 66px 72px 62px 20px 1fr 88px';

const GRADE_CLASS: Record<string, string> = {
  malicious: 'bad',
  praise: 'praise',
  normal: 'normal',
  pending: 'normal',
};

function monthStartISO(): string {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** 유형 · 중분류 · 소분류 한 칸. 목록 API가 분류를 안 줘서 대부분 비어 있다. */
function classifyText(c: Call): string {
  const parts = [c.fields.type.value, c.fields.category.value, c.fields.subcategory.value]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '';
}

type Filter = { grade: string; type: string; counselor: string; status: string };
const ALL = '전체';


/** 라벨 + 드롭다운 한 세트. 컴포넌트 밖에 둔다 — 안에서 정의하면 렌더마다
 *  새 컴포넌트가 되어 열려 있던 드롭다운이 remount된다. */
function FilterSet({
  label, value, options, open, onToggle, onPick,
}: {
  label: string;
  value: string;
  options: string[];
  open: boolean;
  onToggle: () => void;
  onPick: (v: string) => void;
}) {
  return (
    <div className="aw-fset">
      <label>{label}</label>
      <span className="cw-anchor">
        <button className={`cw-filter ${open ? 'on' : ''}`} onClick={onToggle}>
          <span>{value}</span>
          <Caret />
        </button>
        {open && (
          <Popover onClose={() => onToggle()} className="cw-filter-pop">
            <Menu options={options} value={value} onPick={onPick} />
          </Popover>
        )}
      </span>
    </div>
  );
}

export function LedgerTab() {
  const calls = useCallStore((s) => s.calls);
  const loaded = useCallStore((s) => s.loaded);
  const refreshAdminQueue = useCallStore((s) => s.refreshAdminQueue);

  const [from, setFrom] = useState(monthStartISO);
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [datePop, setDatePop] = useState<'from' | 'to' | null>(null);
  const [filter, setFilter] = useState<Filter>({ grade: ALL, type: ALL, counselor: ALL, status: ALL });
  const [openPop, setOpenPop] = useState<keyof Filter | null>(null);
  const [query, setQuery] = useState('');
  const [detailOf, setDetailOf] = useState<Call | null>(null);

  const counselorNames = [...new Set(calls
    .map((c) => c.counselor?.name)
    .filter((value): value is string => Boolean(value)))];
  const options: Record<keyof Filter, string[]> = {
    grade: [ALL, ...CONSULTATION_GRADES],
    type: [ALL, ...CONSULTATION_TYPES],
    counselor: [ALL, ...counselorNames.sort((a, b) => a.localeCompare(b, 'ko'))],
    status: [ALL, ...PROGRESS_STEPS],
  };

  const rows = useMemo(() => {
    const q = query.trim();
    return calls.filter((c) => {
      if (filter.status !== ALL && progressOf(c.status) !== filter.status) return false;
      if (filter.grade !== ALL && gradeLabel[c.grade] !== filter.grade) return false;
      if (filter.type !== ALL && String(c.fields.type.value) !== filter.type) return false;
      if (filter.counselor !== ALL && c.counselor?.name !== filter.counselor) return false;
      if (q) {
        const hay = [fmtCallSeq(c), c.complainant?.name ?? '', c.title ?? ''].join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, filter, query]);

  function exportCsv() {
    downloadCsv(
      `상담대장_${from}_${to}.csv`,
      ['상담번호', '시각', '민원인', '소속', '상담사', '유형·중분류·소분류', '등급', '검토시간', '상태', '요약'],
      rows.map((c) => [
        fmtCallSeq(c),
        fmtTime(c.startedAt),
        c.complainant?.name ?? '',
        c.complainant?.org ?? '',
        c.counselor?.name ?? '',
        classifyText(c),
        gradeLabel[c.grade],
        c.reviewSec ?? '',
        progressOf(c.status),
        c.title ?? '',
      ]),
    );
  }

  return (
    <div className="aw-body">
      <section className="cw-panel" style={{ flex: 1, minWidth: 0 }}>
        <div className="cw-phead">
          <i className="cw-tick" />
          <h2>상담대장</h2>
          <span className="cw-rule" />

          <div className="aw-filters">
            <div className="aw-fset">
              <label>기간</label>
              <span className="cw-anchor">
                <button className={`cw-datebtn ${datePop === 'from' ? 'on' : ''}`} onClick={() => setDatePop(datePop === 'from' ? null : 'from')}>
                  {from}
                  <CalendarIcon />
                </button>
                {datePop === 'from' && (
                  <Popover onClose={() => setDatePop(null)}>
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
                  <Popover onClose={() => setDatePop(null)}>
                    <CalendarPop value={to} from={from} to={to} onPick={setTo} onApply={() => setDatePop(null)} />
                  </Popover>
                )}
              </span>
            </div>

            <FilterSet
              label="등급"
              value={filter.grade}
              options={options.grade}
              open={openPop === 'grade'}
              onToggle={() => setOpenPop(openPop === 'grade' ? null : 'grade')}
              onPick={(v) => {
                setFilter((f) => ({ ...f, grade: v }));
                setOpenPop(null);
              }}
            />
            <FilterSet
              label="유형"
              value={filter.type}
              options={options.type}
              open={openPop === 'type'}
              onToggle={() => setOpenPop(openPop === 'type' ? null : 'type')}
              onPick={(v) => {
                setFilter((f) => ({ ...f, type: v }));
                setOpenPop(null);
              }}
            />
            <FilterSet
              label="상담사"
              value={filter.counselor}
              options={options.counselor}
              open={openPop === 'counselor'}
              onToggle={() => setOpenPop(openPop === 'counselor' ? null : 'counselor')}
              onPick={(v) => {
                setFilter((f) => ({ ...f, counselor: v }));
                setOpenPop(null);
              }}
            />
            <FilterSet
              label="상태"
              value={filter.status}
              options={options.status}
              open={openPop === 'status'}
              onToggle={() => setOpenPop(openPop === 'status' ? null : 'status')}
              onPick={(v) => {
                setFilter((f) => ({ ...f, status: v }));
                setOpenPop(null);
              }}
            />

            <span className="cw-search" style={{ width: 200 }}>
              <input
                placeholder="상담번호 · 민원인 · 요약"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <SearchIcon />
            </span>

            <div className="aw-fset">
              <button className="cw-btn primary" style={{ width: 48, padding: 0 }} onClick={() => void refreshAdminQueue({ from, to })}>
                조회
              </button>
              <button className="cw-btn" style={{ width: 72, padding: 0 }} onClick={exportCsv} disabled={rows.length === 0}>
                CSV
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M6 1v7M3 5.5 6 8.5 9 5.5M2 10.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="aw-thead" style={{ gridTemplateColumns: COLS }}>
          <span>상담번호</span>
          <span>시각</span>
          <span>민원인</span>
          <span>소속</span>
          <span>상담사</span>
          <span>유형 · 중분류 · 소분류</span>
          <span>등급</span>
          <span>검토시간</span>
          <span>상태</span>
          <span />
          <span className="l">요약</span>
          <span />
        </div>

        <div className="aw-tbody">
          {!loaded ? (
            <div className="aw-blank">목록을 불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div className="aw-blank">
              조건에 맞는 상담이 없습니다.
              {calls.length === 0 && ' 조회 기간에 등록된 상담이 없습니다.'}
            </div>
          ) : (
            rows.map((c) => (
              <div className="aw-row" style={{ gridTemplateColumns: COLS, height: 34 }} key={c.callId}>
                <span className="aw-no">{fmtCallSeq(c)}</span>
                <span>{fmtTime(c.startedAt)}</span>
                <span className={c.complainant?.name ? '' : 'cw-muted'}>{c.complainant?.name || NO_DATA}</span>
                <span className={c.complainant?.org ? '' : 'cw-muted'}>{c.complainant?.org || NO_DATA}</span>
                <span className={c.counselor?.name ? '' : 'cw-muted'}>{c.counselor?.name || NO_DATA}</span>
                <span className={classifyText(c) ? '' : 'cw-muted'}>{classifyText(c) || NO_DATA}</span>
                <span>
                  <span className={`cw-badge ${GRADE_CLASS[c.grade]}`}>{gradeLabel[c.grade]}</span>
                </span>
                <span className={c.reviewSec != null ? '' : 'cw-muted'}>{c.reviewSec != null ? `${c.reviewSec}초` : NO_DATA}</span>
                <span><ProgressBadge value={progressOf(c.status)} /></span>
                <span />
                <span className="l">{c.title ?? ''}</span>
                <span>
                  <button className="cw-btn" style={{ width: 76, padding: 0, fontWeight: 700 }} onClick={() => setDetailOf(c)}>
                    상세 보기
                  </button>
                </span>
              </div>
            ))
          )}
        </div>

        <div className="aw-tfoot">총 {calls.length}건 중 1-{rows.length}</div>
      </section>

      {detailOf && (
        <CallDetailModal
          callId={detailOf.callId}
          title={fmtCallSeq(detailOf)}
          subtitle={fmtTime(detailOf.startedAt)}
          onClose={() => setDetailOf(null)}
        />
      )}
    </div>
  );
}
