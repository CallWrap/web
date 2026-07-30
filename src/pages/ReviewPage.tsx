import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Call, CallFields, FieldKey } from '../api/types';
import { useCallStore } from '../store/callStore';
import { useToastStore } from '../store/toastStore';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { TriageForm } from '../components/TriageForm';
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
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [settled, setSettled] = useState(false);

  const enterTime = useRef<number>(Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const uttRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 콜 로드 — 자동으로 다음 콜로 넘어갈 때도 같은 라우트 컴포넌트가 재사용되므로
  // 검토 관련 상태를 매번 명시적으로 리셋한다.
  useEffect(() => {
    let alive = true;
    setSaving(false);
    setFlashId(null);
    setSettled(false);
    fetchCall(callId).then((c) => {
      if (!alive) return;
      setCall(c);
      if (c) {
        const v = {} as Values;
        FIELD_ORDER.forEach((k) => (v[k] = c.fields[k].value));
        setValues(v);
        enterTime.current = Date.now();
      }
      setSettled(true);
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

  // 키보드 단축키 — 입력 필드 포커스 중엔 비활성. 매 렌더마다 최신 클로저로 재구독해
  // handleSave/jumpCall이 오래된 values를 참조하는 문제를 피한다.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        navigate('/queue');
      } else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        jumpCall(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        jumpCall(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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
        {!settled ? (
          <div className="empty">
            <div className="spinner" style={{ width: 20, height: 20 }} />
            <p>상담 내용을 불러오는 중…</p>
          </div>
        ) : (
          <div className="empty error">
            <h3>콜을 불러오지 못했습니다</h3>
            <p>콜 #{callId}를 찾을 수 없거나 통신 중 문제가 발생했습니다.</p>
            <button className="btn primary sm" onClick={() => navigate('/queue')}>
              대기열로 돌아가기
            </button>
          </div>
        )}
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

  function jumpCall(dir: 1 | -1) {
    const reviewIds = allCalls.filter((c) => c.status === 'review').map((c) => c.callId);
    if (reviewIds.length === 0) return;
    const idx = reviewIds.indexOf(callId);
    const nextIdx = idx === -1 ? (dir === 1 ? 0 : reviewIds.length - 1) : (idx + dir + reviewIds.length) % reviewIds.length;
    navigate(`/review/${reviewIds[nextIdx]}`);
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
    try {
      await approveCall(call.callId, {
        fields: newFields,
        editCount: editedKeys.length,
        reviewSec,
        followupNeeded,
      });
    } catch {
      pushToast('저장에 실패했습니다 · 다시 시도해 주세요');
      setSaving(false);
      return;
    }
    const savedCallId = call.callId;
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
  }

  const mm = Math.floor(elapsed / 60);
  const ss = (elapsed % 60).toString().padStart(2, '0');

  return (
    <>
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
        <span className="kbd-hint">↑↓ 이동 · Enter 승인 · Esc 대기열</span>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중…' : '승인 및 저장'}
        </button>
      </div>
    </>
  );
}
