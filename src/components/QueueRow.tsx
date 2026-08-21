import { useNavigate } from 'react-router-dom';
import type { Call, Tier } from '../api/types';
import { EMPTY, fmtCallNo, fmtTime } from '../lib/format';
import { GradeBadge, StatusBadge } from './StatusBadge';

/** 확신(high) 항목 개수 + 5개 항목의 신뢰도 지문. 목록 API는 필드를 안 줘서 placeholder(call.isSummary)면 못 그린다. */
function confidenceSummary(call: Call): { high: number; total: number; tiers: Tier[] } {
  const fields = Object.values(call.fields);
  return {
    high: fields.filter((f) => f.tier === 'high').length,
    total: fields.length,
    tiers: fields.map((f) => f.tier),
  };
}

export function QueueRow({ call }: { call: Call }) {
  const navigate = useNavigate();
  const analyzing = call.status === 'analyzing';
  const { high, total, tiers } = confidenceSummary(call);
  const isMalicious = call.grade === 'malicious';

  return (
    <button
      className={`qrow ${isMalicious ? 'malicious' : ''}`}
      disabled={analyzing}
      onClick={() => navigate(`/review/${call.callId}`)}
    >
      {/* 접수 순번을 보여준다. UUID는 사람이 부를 수 없고(36자), 사보원 요청번호는 형식이
          아직 안 정해져서 표시용으로 못 쓴다. 상담사끼리는 "3번 콜"로 부르면 된다. */}
      <div className="cid">
        {isMalicious && '⚠ '}{fmtCallNo(call.callNo)}
        <small>{fmtTime(call.startedAt)}</small>
      </div>

      <div className="mid">
        <div className="title">{call.title ?? EMPTY.title}</div>
        <div className="line1">
          <StatusBadge status={call.status} />
          <GradeBadge grade={call.grade} />
        </div>
        {isMalicious && (
          <div className="meta">
            <span className="warn">감정노동 보호 대상</span>
          </div>
        )}
      </div>

      <div className="right">
        {analyzing ? (
          <span className="ai-summary">AI가 후처리 폼을 채우는 중…</span>
        ) : call.isSummary && call.confidenceSummary ? (
          <span className="ai-summary">
            AI 확신 <strong>{call.confidenceSummary.high}/{call.confidenceSummary.total}</strong> 항목
          </span>
        ) : (
          <span className="ai-summary">
            <span>
              AI 확신 <strong>{high}/{total}</strong> 항목
            </span>
            <span className="tier-dots" aria-hidden>
              {tiers.map((t, i) => (
                <span key={i} className={`dot ${t}`} />
              ))}
            </span>
          </span>
        )}
        <span className="btn sm primary" aria-hidden style={{ pointerEvents: 'none', opacity: analyzing ? 0.4 : 1 }}>
          검토 →
        </span>
      </div>
    </button>
  );
}
