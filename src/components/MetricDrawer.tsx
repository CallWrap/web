import type { Call } from '../api/types';
import { fmtCallNo, fmtDuration, fmtTime, gradeLabel, statusLabel, summaryText } from '../lib/format';

interface Props {
  title: string;
  note?: string;
  calls: Call[];
  onSelect: (callId: string) => void;
  onClose: () => void;
}

/**
 * 모니터링 카드(오늘 처리 건수 / 평균 검토 시간 / 악성콜 발생률 / 검토 대기 중)를 클릭했을 때
 * 그 숫자를 이룬 콜 목록을 오른쪽에서 밀어 보여준다 — 숫자만 보고 "그래서 어떤 콜인데?"를
 * 매번 상담대장 탭에서 검색으로 찾아야 했던 걸 줄인다. 행을 누르면 상담대장 탭으로 이동해서
 * 그 콜의 상세를 펼친다 — 상세 필드 렌더링을 여기 또 만들지 않고 기존 화면을 재사용한다.
 */
export function MetricDrawer({ title, note, calls, onSelect, onClose }: Props) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label={title}>
        <div className="drawer-head">
          <div>
            <h3>{title}</h3>
            <span className="count">{calls.length}건</span>
          </div>
          <button className="btn ghost sm" onClick={onClose}>
            닫기 ✕
          </button>
        </div>
        {note && <div className="drawer-note">{note}</div>}
        <div className="drawer-list">
          {calls.length === 0 ? (
            <div className="empty">
              <p>해당하는 콜이 없습니다.</p>
            </div>
          ) : (
            calls.map((c) => (
              <button key={c.callId} className="drawer-row" onClick={() => onSelect(c.callId)}>
                <span className="cid">
                  {fmtCallNo(c.callNo)}
                  <small>{fmtTime(c.startedAt)}</small>
                </span>
                <span className={`badge-pill grade-${c.grade}`}>{gradeLabel[c.grade]}</span>
                <span className="ellipsis">
                  {summaryText(c.fields.summary.value) || c.fields.type.value || statusLabel[c.status]}
                </span>
                <span className="tnum">{fmtDuration(c.reviewSec)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
