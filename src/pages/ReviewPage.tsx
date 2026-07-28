import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Call, CallFields, FieldKey } from '../api/types';
import { useCallStore } from '../store/callStore';
import { useToastStore } from '../store/toastStore';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { TriageForm } from '../components/TriageForm';
import { WellbeingModal } from '../components/WellbeingModal';
import { GradeBadge } from '../components/StatusBadge';
import { fmtDuration, fmtTime } from '../lib/format';

export type Values = Record<FieldKey, string | boolean>;

export const FIELD_ORDER: FieldKey[] = ['type', 'category', 'grade', 'summary', 'followup'];

export function ReviewPage() {
  const { callId = '' } = useParams();
  const navigate = useNavigate();
  const fetchCall = useCallStore((s) => s.fetchCall);
  const approveCall = useCallStore((s) => s.approveCall);
  const allCalls = useCallStore((s) => s.calls);
  const pushToast = useToastStore((s) => s.push);

  const [call, setCall] = useState<Call | undefined>();
  const [values, setValues] = useState<Values | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showWellbeing, setShowWellbeing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stamped, setStamped] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const enterTime = useRef<number>(Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const uttRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 콜 로드
  useEffect(() => {
    let alive = true;
    fetchCall(callId).then((c) => {
      if (!alive) return;
      setCall(c);
      if (c) {
        const v = {} as Values;
        FIELD_ORDER.forEach((k) => (v[k] = c.fields[k].value));
        setValues(v);
        if (c.grade === 'malicious') setShowWellbeing(true);
        enterTime.current = Date.now();
      }
    });
    return () => {
      alive = false;
    };
  }, [callId, fetchCall]);

  // 검토 타이머 (진입~저장). 대시보드 평균 검토시간에 반영.
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - enterTime.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call]);

  const evidenceIds = useMemo(() => {
    const set = new Set<string>();
    if (call) FIELD_ORDER.forEach((k) => call.fields[k].evidence.forEach((id) => set.add(id)));
    return set;
  }, [call]);

  const doneCount = allCalls.filter((c) => c.status === 'confirmed' || c.status === 'followup').length;
  const totalCount = allCalls.length || 1;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  if (!call || !values) {
    return (
      <div className="content">
        <div className="empty">
          <div className="spinner" style={{ width: 20, height: 20 }} />
          <p>상담 내용을 불러오는 중…</p>
        </div>
      </div>
    );
  }

  const editedKeys = FIELD_ORDER.filter((k) => values[k] !== call.fields[k].value);

  function registerRef(id: string, el: HTMLDivElement | null) {
    if (el) uttRefs.current.set(id, el);
  }

  function scrollToEvidence(uttId: string) {
    const el = uttRefs.current.get(uttId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashId(null);
      // 리렌더 후 flash 트리거
      requestAnimationFrame(() => setFlashId(uttId));
      setTimeout(() => setFlashId((f) => (f === uttId ? null : f)), 1700);
    }
  }

  function setValue(k: FieldKey, v: string | boolean) {
    setValues((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function handleSave() {
    if (!call || !values) return;
    setSaving(true);
    const reviewSec = Math.max(1, Math.floor((Date.now() - enterTime.current) / 1000));
    const newFields = {} as CallFields;
    FIELD_ORDER.forEach((k) => {
      // 원본 메타(confidence/tier/evidence)는 유지, value만 상담사 확정값으로
      (newFields[k] as CallFields[FieldKey]) = { ...call.fields[k], value: values[k] } as never;
    });
    const followupNeeded = Boolean(values.followup);
    await approveCall(call.callId, {
      fields: newFields,
      editCount: editedKeys.length,
      reviewSec,
      followupNeeded,
    });
    setStamped(true);
    const savedCallId = call.callId;
    setTimeout(() => {
      const remaining = useCallStore.getState().calls.filter(
        (c) => c.status === 'review' && c.callId !== savedCallId,
      );
      if (remaining.length > 0) {
        pushToast(`콜 #${savedCallId} 저장됨 · 다음 콜로 이동`);
        navigate(`/review/${remaining[0].callId}`);
      } else {
        pushToast(
          followupNeeded
            ? `콜 #${savedCallId} 저장됨 · 후속처리 탭으로 이동`
            : `콜 #${savedCallId} 저장됨 · 검토 완료`,
        );
        navigate('/queue');
      }
    }, 700);
  }

  const mm = Math.floor(elapsed / 60);
  const ss = (elapsed % 60).toString().padStart(2, '0');

  return (
    <>
      {showWellbeing && (
        <WellbeingModal callId={call.callId} onClose={() => setShowWellbeing(false)} />
      )}

      {stamped && (
        <div className="stamp-overlay" aria-hidden>
          <div className="stamp-mark">검토완료</div>
        </div>
      )}

      <div className="zen-header">
        <div className="zen-left">
          <button className="btn ghost sm" onClick={() => navigate('/queue')}>
            ← 대기열
          </button>
          <span className="zen-meta">
            {fmtTime(call.startedAt)} · 통화 {fmtDuration(call.durationSec)}
          </span>
          <GradeBadge grade={call.grade} />
        </div>
        <div className="zen-progress">
          <span className="zen-progress-label">
            검토 {doneCount + 1} / {totalCount}
          </span>
          <div className="zen-progress-bar">
            <i style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="zen-right">
          <span className="zen-timer">{mm}:{ss}</span>
        </div>
      </div>

      <div className="content review-page">
        <div className="review-grid">
          <TranscriptPanel
            ref={scrollRef}
            transcript={call.transcript}
            evidenceIds={evidenceIds}
            flashId={flashId}
            registerRef={registerRef}
          />

          <div className="panel">
            <div className="panel-head">
              <h3>AI 후처리 폼</h3>
              <span className="hint">확신 우선 트리아지</span>
            </div>
            <TriageForm
              key={call.callId}
              fields={call.fields}
              values={values}
              editedKeys={editedKeys}
              onChange={setValue}
              onEvidenceClick={scrollToEvidence}
            />
          </div>
        </div>
      </div>

      <div className="floating-toolbar">
        <span className="info">
          수정 항목 <strong>{editedKeys.length}건</strong>
        </span>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중…' : '승인 및 저장'}
        </button>
      </div>
    </>
  );
}
