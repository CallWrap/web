import { useNavigate } from 'react-router-dom';
import type { Call, Tier } from '../api/types';
import { fmtTime } from '../lib/format';
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
      {/* 콜 식별은 UUID 앞 8자로 충분하다 — 36자를 다 찍으면 84px 칸에서 여섯 줄로 접힌다.
          사람이 콜을 구분하는 건 아래 제목이고, id는 문의·장애 추적용 보조 표시다. */}
      <div className="cid">
        {isMalicious && '⚠ '}#{call.callId.slice(0, 8)}
        <small>{fmtTime(call.startedAt)}</small>
      </div>

      <div className="mid">
        <div className="title">{call.title ?? '(제목 없음)'}</div>
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
