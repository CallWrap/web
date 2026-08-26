import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../store/callStore";
import { useReviewStream } from "../hooks/useReviewStream";
import { QueueRow } from "../components/QueueRow";
import { SealIcon } from "../components/icons";
import { EMPTY, fmtCallNo, fmtTime } from "../lib/format";

export function QueuePage() {
  const { calls, loaded, loadError, loadQueue, totalReviewSec } = useCallStore();
  const navigate = useNavigate();
  // "검토 대기"는 이미 이 화면이라 이동할 곳이 없다 — 아래 목록으로 스크롤한다.
  const queueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // 상담이 끝나서 상태가 바뀌거나(분석 중→검토 대기) 다른 상담사가 확정해서 항목이
  // 빠지는 걸 새로고침 없이 실시간으로 반영한다.
  const { connected } = useReviewStream();

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

  // "후처리 시간 평균 68% 단축"은 근거가 없던 값이었다 — 대신 상담사가 이 화면에서 실제로
  // 검토·확정한 시간(store에 쌓이는 reviewSec)의 평균을 보여준다. 기록이 없으면 정직하게 빈 상태.
  const processed = calls.filter((c) => c.status === "confirmed" || c.status === "followup");
  const processedWithTime = processed.filter((c) => c.reviewSec != null);
  const avgReviewSec = processedWithTime.length > 0
    ? Math.round(totalReviewSec / processedWithTime.length)
    : null;
  const avgReviewLabel = avgReviewSec != null
    ? `평균 검토 ${Math.floor(avgReviewSec / 60)}:${(avgReviewSec % 60).toString().padStart(2, "0")}`
    : "아직 검토 기록 없음";

  // 오른쪽 남는 공간 — 오늘 확정한 콜을 최근 순으로 몇 개 보여준다(꾸며낸 통계 아님).
  const recentProcessed = [...processed]
    .sort((a, b) => (b.confirmedAt ?? "").localeCompare(a.confirmedAt ?? ""))
    .slice(0, 3);

  return (
    <div className="content">
      <div className="top-row">
        <div className="metric-row compact">
          <button className="metric" onClick={() => navigate("/completed")}>
            <div className="label">오늘 처리 완료</div>
            <div className="value">
              {confirmedCount + followupCount}
              <small> 건</small>
            </div>
            <div className="sub">{avgReviewLabel}</div>
          </button>
          <button
            className={`metric ${pending.length > 0 ? "attention" : ""}`}
            onClick={() => queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <div className="label">
              {pending.length > 0 && <span className="dot" />}
              검토 대기
            </div>
            <div className="value">
              {pending.length}
              <small> 건</small>
            </div>
            <div className="sub">
              {!connected
                ? "실시간 연결 끊김 · 재연결 중…"
                : analyzingCount > 0
                  ? `분석 중 ${analyzingCount}건`
                  : "실시간 반영"}
            </div>
          </button>
          <button className="metric" onClick={() => navigate("/followups")}>
            <div className="label">후속 처리 필요</div>
            <div className="value">
              {followupCount}
              <small> 건</small>
            </div>
            <div className="sub">별도 탭에서 관리</div>
          </button>
        </div>

        <div className="recent-panel">
          <div className="rp-head">
            <h3>최근 처리 완료</h3>
            <span>확정 순</span>
          </div>
          {recentProcessed.length === 0 ? (
            <div className="rp-empty">아직 오늘 처리한 콜이 없습니다.</div>
          ) : (
            recentProcessed.map((c) => (
              <div className="rp-row" key={c.callId}>
                <span className="rp-cid">{fmtCallNo(c.callNo)}</span>
                <span className="rp-title">{c.title ?? EMPTY.title}</span>
                <span className="rp-time">{fmtTime(c.confirmedAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="info-note stacked">
        <div className="headline">상담이 끝나면 AI가 후처리 폼을 자동으로 채워둡니다.</div>
        <div className="flow">
          <span className="state-chip">분석 중</span>
          <span className="state-arrow">→</span>
          <span className="state-chip done">검토 대기</span>
          <span>로 바뀐 콜을 클릭해 검토·승인하세요.</span>
        </div>
      </div>

      <div className="section-head" ref={queueRef}>
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
