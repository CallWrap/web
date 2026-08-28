import { useState } from 'react';
import { CalendarIcon, SearchIcon, toISODate } from '../counselor/CounselorBits';
import { GradeBars } from './Charts';

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

  // 목록 API가 없다 — 지어내지 않고 빈 배열로 둔다.
  const rows: CustomerRow[] = [];

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
          <button className="cw-btn primary" style={{ width: 48, padding: 0 }}>조회</button>
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
            <div className="aw-blank">민원인 조회 API가 없어 목록을 표시할 수 없습니다.</div>
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
                <span>{r.lastCalledAt}</span>
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
              <span className="cw-empty">정보 없음</span>
            </div>
            <div className="aw-infolabel" style={{ width: 88 }}>전화번호</div>
            <div className="aw-infoval" style={{ width: 150, flex: 'none' }}>
              <span className="cw-empty">정보 없음</span>
            </div>
            <div className="aw-infolabel" style={{ width: 78 }}>소속</div>
            <div className="aw-infoval" style={{ flex: 1 }}>
              <span className="cw-empty">정보 없음</span>
            </div>
            <div className="aw-infolabel" style={{ width: 88 }}>최초 상담</div>
            <div className="aw-infoval" style={{ width: 130, flex: 'none' }}>
              <span className="cw-empty">정보 없음</span>
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
            {selected ? (
              <GradeBars counts={{ malicious: 0, normal: 0, praise: 0 }} />
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
            <div className="aw-blank">월별 문의 집계가 없습니다.</div>
            <div className="aw-stateline">
              <span className="lb">응대 참고</span>
              <span className="cw-empty">판정 기준 미정</span>
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
            <div className="aw-blank">민원인별 상담 이력 조회 API가 없습니다.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
