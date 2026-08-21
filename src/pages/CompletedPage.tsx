import { useCallStore } from '../store/callStore';
import { GradeBadge } from '../components/StatusBadge';
import { EmptyTrayIcon } from '../components/icons';
import { EMPTY, fmtCallNo, fmtTime, summaryText } from '../lib/format';

/*
 * 확정(CONFIRMED)된 콜 목록. 대기열 상단의 "오늘 처리 완료" 카드와 같은 집합을 본다 —
 * 후속 처리가 필요한 콜도 확정된 것이므로 여기 포함된다(그쪽 탭에서 액션을 따로 관리할 뿐).
 * 카드 형식은 후속 처리 목록과 맞췄다. 다른 건 체크리스트 대신 후속 처리 여부만 표시한다는 점이다.
 */
export function CompletedPage() {
  const calls = useCallStore((s) => s.calls);
  const completed = calls.filter((c) => c.status === 'confirmed' || c.status === 'followup');

  return (
    <div className="content">
      <div className="section-head">
        <h2>처리 완료 목록</h2>
        <span className="count">{completed.length}건</span>
      </div>
      <div className="info-note">
        <span>ℹ</span>
        <span>상담사가 검토를 마치고 <strong>확정</strong>한 콜입니다. 후속 처리가 필요한 건은 별도 탭에서 관리합니다.</span>
      </div>

      {completed.length === 0 ? (
        <div className="empty">
          <div className="big"><EmptyTrayIcon /></div>
          <h3>처리 완료된 콜이 없습니다</h3>
          <p>검토 화면에서 확정한 콜이 이곳에 모입니다.</p>
        </div>
      ) : (
        completed.map((c) => (
          <div className="followup-card" key={c.callId}>
            <div className="fc-head">
              <span className="cid">{fmtCallNo(c.callNo)}</span>
              <GradeBadge grade={c.grade} />
              {/* 목록 API는 요약 본문을 안 준다(대용량 JSONB를 목록에 안 싣는 설계) — 제목을 먼저 쓰고,
                  상세를 이미 받아온 콜이면 요약 본문으로 대체한다. */}
              <span className="sum">{c.title || summaryText(c.fields.summary.value) || EMPTY.summary}</span>
              <span className="count" style={{ marginLeft: 'auto' }}>
                {fmtTime(c.startedAt)}
              </span>
            </div>
            <div className="fc-progress">
              {c.status === 'followup' ? '후속 처리 필요 — 후속 처리 탭에서 관리' : '검토 확정 완료 ✓'}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
