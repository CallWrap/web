import { useState } from 'react';
import { CalendarIcon, Caret, Menu, Popover, toISODate } from '../counselor/CounselorBits';
import { GradeBars } from './Charts';

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

  // 목록 API가 없다 — 지어내지 않고 빈 배열로 둔다.
  const rows: CounselorRow[] = [];

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
          <button className="cw-btn primary" style={{ width: 48, padding: 0 }}>조회</button>
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
          {rows.length === 0 ? (
            <div className="aw-blank">상담사 집계 API가 없어 목록을 표시할 수 없습니다.</div>
          ) : (
            rows.map((r) => (
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
              <span className="cw-empty">정보 없음</span>
            </div>
            <div className="aw-infolabel" style={{ width: 78 }}>소속</div>
            <div className="aw-infoval" style={{ flex: 1 }}>
              <span className="cw-empty">정보 없음</span>
            </div>
            <div className="aw-infolabel" style={{ width: 88 }}>오늘 처리</div>
            <div className="aw-infoval" style={{ width: 110, flex: 'none' }}>
              <span className="cw-empty">정보 없음</span>
            </div>
            <div className="aw-infolabel" style={{ width: 104 }}>총 통화 시간</div>
            <div className="aw-infoval" style={{ width: 140, flex: 'none' }}>
              <span className="cw-empty">정보 없음</span>
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
            {selected ? (
              <GradeBars counts={{ malicious: 0, normal: 0, praise: 0 }} />
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
            {/* 발화별 감정은 저장되기 시작했지만 상담사·날짜로 묶은 집계 API가 아직 없다 */}
            <div className="aw-blank">일자별 부정 발화 집계가 없습니다.</div>
            <div className="aw-stateline">
              <span className="lb">현재 상태</span>
              <span className="cw-empty">판정 기준 미정</span>
            </div>
          </section>
        </div>

        <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>최근 담당 콜</h2>
            <span className="cw-rule" />
            <button className="cw-datebtn">
              {toISODate(new Date())}
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
            <div className="aw-blank">상담사별 담당 콜 조회 API가 없습니다.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
