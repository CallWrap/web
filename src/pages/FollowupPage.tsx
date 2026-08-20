import { useCallStore } from '../store/callStore';
import { GradeBadge } from '../components/StatusBadge';
import { EmptyTrayIcon } from '../components/icons';
import { fmtTime, summaryText } from '../lib/format';

export function FollowupPage() {
  const calls = useCallStore((s) => s.calls);
  const toggle = useCallStore((s) => s.toggleFollowupAction);
  const followups = calls.filter((c) => c.status === 'followup');

  return (
    <div className="content">
      <div className="section-head">
        <h2>후속처리 목록</h2>
        <span className="count">{followups.length}건</span>
      </div>
      <div className="info-note">
        <span>ℹ</span>
        <span>검토 시 <strong>후속처리 필요</strong>로 저장된 콜입니다. 액션을 완료하면 체크하세요.</span>
      </div>

      {followups.length === 0 ? (
        <div className="empty">
          <div className="big"><EmptyTrayIcon /></div>
          <h3>후속처리할 콜이 없습니다</h3>
          <p>검토 화면에서 후속필요로 저장된 콜이 이곳에 모입니다.</p>
        </div>
      ) : (
        followups.map((c) => {
          const actions = c.followupActions ?? [];
          const done = actions.filter((a) => a.done).length;
          return (
            <div className="followup-card" key={c.callId}>
              <div className="fc-head">
                <span className="cid">#{c.callId}</span>
                <GradeBadge grade={c.grade} />
                <span className="sum">{summaryText(c.fields.summary.value) || '요약 없음'}</span>
                <span className="count" style={{ marginLeft: 'auto' }}>
                  {fmtTime(c.startedAt)}
                </span>
              </div>
              <div className="actions">
                {actions.map((a) => (
                  <label key={a.id} className={`action ${a.done ? 'done' : ''}`}>
                    <input type="checkbox" checked={a.done} onChange={() => toggle(c.callId, a.id)} />
                    <span>{a.label}</span>
                  </label>
                ))}
              </div>
              <div className="fc-progress">
                완료 {done}/{actions.length}
                {done === actions.length && actions.length > 0 && ' · 모든 후속처리 완료 ✓'}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
