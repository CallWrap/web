import { useEffect } from "react";
import { useCallStore } from "../store/callStore";
import { QueueRow } from "../components/QueueRow";
import { SealIcon } from "../components/icons";

export function QueuePage() {
  const { calls, loaded, loadError, loadQueue } = useCallStore();

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // 악성콜(감정노동 보호 대상)을 맨 위로 — 상담원이 대기열을 훑을 때 가장 먼저 눈에 들어와야 함
  const pending = calls
    .filter((c) => c.status === "analyzing" || c.status === "review")
    .sort(
      (a, b) =>
        Number(b.grade === "malicious") - Number(a.grade === "malicious"),
    );
  const analyzingCount = calls.filter((c) => c.status === "analyzing").length;
  const confirmedCount = calls.filter((c) => c.status === "confirmed").length;
  const followupCount = calls.filter((c) => c.status === "followup").length;

  return (
    <div className="content">
      <div className="metric-row">
        <div className="metric">
          <div className="label">오늘 처리 완료</div>
          <div className="value">
            {confirmedCount + followupCount}
            <small> 건</small>
          </div>
          <div className="sub good">후처리 시간 평균 68% 단축</div>
        </div>
        <div className="metric">
          <div className="label">검토 대기</div>
          <div className="value">
            {pending.length}
            <small> 건</small>
          </div>
          <div className="sub">
            {analyzingCount > 0 ? `분석 중 ${analyzingCount}건` : "실시간 반영"}
          </div>
        </div>
        <div className="metric">
          <div className="label">후속처리 필요</div>
          <div className="value">
            {followupCount}
            <small> 건</small>
          </div>
          <div className="sub">별도 탭에서 관리</div>
        </div>
      </div>

      <div className="info-note">
        <span>ℹ</span>
        <span>
          상담이 종료되면 AI가 자동으로 후처리 폼을 채웁니다.{" "}
          <strong>분석 중 → 검토 대기</strong>로 바뀐 콜을 클릭해
          검토·승인하세요.
        </span>
      </div>

      <div className="section-head">
        <h2>검토 대기열</h2>
        <span className="count">{pending.length}건</span>
      </div>

      {loadError ? (
        <div className="empty error">
          <h3>대기열을 불러오지 못했습니다</h3>
          <p>{loadError}</p>
          <button className="btn primary sm" onClick={() => loadQueue()}>
            다시 시도
          </button>
        </div>
      ) : !loaded ? (
        <div className="queue" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="qrow skeleton-row">
              <div className="skeleton-block" style={{ height: 34 }} />
              <div>
                <div className="skeleton-block" style={{ height: 16, width: '40%', marginBottom: 8 }} />
                <div className="skeleton-block" style={{ height: 12, width: '65%' }} />
              </div>
              <div className="skeleton-block" style={{ height: 30, width: 80 }} />
            </div>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="empty">
          <div className="big ok">
            <SealIcon />
          </div>
          <h3>모든 상담이 처리되었습니다</h3>
          <p>새 상담이 종료되면 이곳에 검토 대기 콜이 표시됩니다.</p>
        </div>
      ) : (
        <div className="queue">
          {pending.map((c) => (
            <QueueRow key={c.callId} call={c} />
          ))}
        </div>
      )}
    </div>
  );
}
